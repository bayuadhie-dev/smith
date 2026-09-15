"""
Health Check Endpoints for Docker and Monitoring
"""
from flask import Blueprint, jsonify, request, Response
from flask_jwt_extended import jwt_required
from datetime import datetime
import redis
import json
import os
import time
from utils.timezone import get_local_now, get_local_today

health_bp = Blueprint('health', __name__)

_PROCESS_START = time.time()


def _wants_html():
    """True when the request looks like a real browser tab, not a
    monitoring tool/health-checker (curl, uptime robots, k8s probes all
    send Accept: */* or nothing at all, never a text/html preference)."""
    best = request.accept_mimetypes.best_match(['text/html', 'application/json'])
    return best == 'text/html' and request.accept_mimetypes[best] > request.accept_mimetypes['application/json']


def _uptime_human():
    secs = int(time.time() - _PROCESS_START)
    d, rem = divmod(secs, 86400)
    h, rem = divmod(rem, 3600)
    m, s = divmod(rem, 60)
    if d:
        return f"{d}h {h}j {m}m"
    if h:
        return f"{h}j {m}m"
    return f"{m}m {s}dtk"


def _quick_checks():
    """Lightweight, public-safe status of each dependency - booleans only,
    never the raw exception text (this endpoint is unauthenticated and
    internet-reachable, so connection strings/stack traces never belong
    in the response)."""
    checks = {}

    t0 = time.perf_counter()
    try:
        from models import db as _db
        from sqlalchemy import text as _sql_text
        _db.session.execute(_sql_text('SELECT 1'))
        checks['database'] = {'healthy': True, 'ms': round((time.perf_counter() - t0) * 1000, 1)}
    except Exception:
        checks['database'] = {'healthy': False, 'ms': None}

    t0 = time.perf_counter()
    try:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        r = redis.from_url(redis_url, socket_connect_timeout=1.5)
        r.ping()
        checks['cache'] = {'healthy': True, 'ms': round((time.perf_counter() - t0) * 1000, 1)}
    except Exception:
        checks['cache'] = {'healthy': False, 'ms': None}

    return checks


def _load_uptime_history(hours=24, buckets=90):
    """Reads the real health_history log files (written every ~2 minutes by
    a scheduled job, already used by GET /health/history for the in-app
    charts) and reduces them to what a public status page actually needs:
    an evenly-bucketed uptime strip, a real uptime percentage, and average
    resource/response-time numbers - all computed from genuine recorded
    checks, not synthesized."""
    import glob
    from datetime import timedelta

    history_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs', 'health_history')
    now = get_local_now()
    cutoff = now - timedelta(hours=hours)

    points = []
    if os.path.isdir(history_dir):
        for file_path in sorted(glob.glob(os.path.join(history_dir, 'health_*.json'))):
            file_date_str = os.path.basename(file_path)[7:17]
            try:
                file_date = datetime.strptime(file_date_str, '%Y-%m-%d')
            except ValueError:
                continue
            if file_date.replace(tzinfo=None) < (cutoff.replace(tzinfo=None) - timedelta(days=1)):
                continue
            try:
                with open(file_path, 'r') as f:
                    day_data = json.load(f)
            except (json.JSONDecodeError, IOError):
                continue
            for point in day_data:
                try:
                    ts = datetime.fromisoformat(point['timestamp'])
                except (KeyError, ValueError):
                    continue
                if ts.replace(tzinfo=None) >= cutoff.replace(tzinfo=None):
                    points.append(point)

    points.sort(key=lambda p: p['timestamp'])

    if not points:
        return {'bars': [], 'uptime_pct': None, 'avg_cpu': None, 'avg_mem': None, 'avg_disk': None, 'avg_response_ms': None, 'sample_count': 0}

    healthy_count = sum(1 for p in points if p.get('database_status') == 'healthy')
    uptime_pct = round((healthy_count / len(points)) * 100, 2)

    cpu_vals, mem_vals, disk_vals, resp_vals = [], [], [], []
    for p in points:
        res = p.get('resources') or {}
        if res.get('cpu_percent') is not None:
            cpu_vals.append(res['cpu_percent'])
        if res.get('memory_percent') is not None:
            mem_vals.append(res['memory_percent'])
        if res.get('disk_percent') is not None:
            disk_vals.append(res['disk_percent'])
        for stats in (p.get('response_times') or {}).values():
            if stats.get('avg_ms') is not None:
                resp_vals.append(stats['avg_ms'])

    def _avg(vals):
        return round(sum(vals) / len(vals), 1) if vals else None

    # Downsample into `buckets` even time-slices, each bucket's "health" is
    # the fraction of its points that were healthy (partial outages inside
    # a bucket render as a partially-dimmed bar, not a hard on/off flip).
    bars = []
    if len(points) <= buckets:
        for p in points:
            bars.append(1.0 if p.get('database_status') == 'healthy' else 0.0)
    else:
        step = len(points) / buckets
        for i in range(buckets):
            start = int(i * step)
            end = int((i + 1) * step) or 1
            chunk = points[start:end] or [points[min(start, len(points) - 1)]]
            healthy = sum(1 for p in chunk if p.get('database_status') == 'healthy')
            bars.append(healthy / len(chunk))

    return {
        'bars': bars,
        'uptime_pct': uptime_pct,
        'avg_cpu': _avg(cpu_vals),
        'avg_mem': _avg(mem_vals),
        'avg_disk': _avg(disk_vals),
        'avg_response_ms': _avg(resp_vals),
        'sample_count': len(points),
    }


_STATUS_PAGE_TEMPLATE = """<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SMITH ERP — Status Sistem</title>
<link rel="icon" href="data:image/svg+xml,{favicon}">
<style>
  :root {{
    --bg-1: #0b1220; --bg-2: #0e1a2e;
    --card-bg: rgba(255,255,255,0.04);
    --card-border: rgba(255,255,255,0.08);
    --text-1: #eef2f7; --text-2: #9aa7bd; --text-3: #6b7688;
    --ok: #34d399; --ok-glow: rgba(52,211,153,0.35);
    --bad: #f87171; --bad-glow: rgba(248,113,113,0.35);
    --accent: #60a5fa;
    --tile-bg: rgba(255,255,255,0.03);
  }}
  @media (prefers-color-scheme: light) {{
    :root {{
      --bg-1: #eef2f9; --bg-2: #dde6f5;
      --card-bg: rgba(255,255,255,0.75);
      --card-border: rgba(15,23,42,0.08);
      --text-1: #0f172a; --text-2: #475569; --text-3: #94a3b8;
      --tile-bg: rgba(15,23,42,0.03);
    }}
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ height: 100%; margin: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
    color: var(--text-1);
    background: radial-gradient(1200px 600px at 15% -10%, rgba(96,165,250,0.16), transparent 60%),
                radial-gradient(1000px 500px at 110% 10%, rgba(52,211,153,0.10), transparent 60%),
                linear-gradient(160deg, var(--bg-1), var(--bg-2));
    background-attachment: fixed;
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    overflow-x: hidden;
  }}
  .orb {{
    position: fixed;
    width: 42vw; height: 42vw;
    max-width: 520px; max-height: 520px;
    border-radius: 50%;
    filter: blur(90px);
    opacity: 0.35;
    z-index: 0;
    animation: float 18s ease-in-out infinite;
  }}
  .orb.a {{ background: #60a5fa; top: -10%; left: -10%; }}
  .orb.b {{ background: {orb_b_color}; bottom: -15%; right: -8%; animation-delay: -9s; }}
  @keyframes float {{
    0%, 100% {{ transform: translate(0,0) scale(1); }}
    50% {{ transform: translate(30px,-20px) scale(1.08); }}
  }}
  .noise {{
    position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: .5; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
  }}
  .wrap {{ position: relative; z-index: 1; width: 100%; max-width: 720px; }}
  .card {{
    position: relative;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 28px;
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    box-shadow: 0 24px 70px -24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
    padding: 40px 40px 30px;
    animation: rise .6s cubic-bezier(.2,.9,.25,1) both;
    overflow: hidden;
  }}
  .card::before {{
    content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background: linear-gradient(120deg, rgba(255,255,255,0.10), transparent 35%);
  }}
  @keyframes rise {{ from {{ opacity: 0; transform: translateY(14px); }} to {{ opacity: 1; transform: translateY(0); }} }}
  .brand-row {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; gap: 12px; flex-wrap: wrap; }}
  .brand {{
    display: flex; align-items: center; gap: 10px;
    color: var(--text-3); font-size: 13px; font-weight: 600;
    letter-spacing: .06em; text-transform: uppercase;
  }}
  .brand svg {{ width: 18px; height: 18px; flex-shrink: 0; }}
  .uptime-badge {{
    display: flex; align-items: center; gap: 6px;
    background: var(--tile-bg); border: 1px solid var(--card-border);
    border-radius: 999px; padding: 5px 12px 5px 10px;
    font-size: 12.5px; font-weight: 600; color: var(--text-2);
  }}
  .uptime-badge b {{ color: var(--ok); font-weight: 700; }}
  .uptime-badge svg {{ width: 13px; height: 13px; color: var(--ok); }}
  .status-row {{ display: flex; align-items: center; gap: 16px; margin-bottom: 6px; }}
  .dot {{
    position: relative;
    width: 14px; height: 14px; border-radius: 50%;
    background: var({status_color});
    box-shadow: 0 0 0 0 var({status_glow});
    animation: pulse 2.2s ease-out infinite;
    flex-shrink: 0;
  }}
  @keyframes pulse {{
    0% {{ box-shadow: 0 0 0 0 var({status_glow}); }}
    70% {{ box-shadow: 0 0 0 14px rgba(0,0,0,0); }}
    100% {{ box-shadow: 0 0 0 0 rgba(0,0,0,0); }}
  }}
  h1 {{ font-size: 26px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }}
  .subtitle {{ color: var(--text-2); font-size: 14.5px; margin: 8px 0 28px; line-height: 1.5; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); gap: 12px; margin-bottom: 26px; }}
  .tile {{
    background: var(--tile-bg);
    border: 1px solid var(--card-border);
    border-radius: 14px;
    padding: 14px 16px;
    transition: transform .2s ease, background .2s ease;
  }}
  .tile:hover {{ transform: translateY(-2px); }}
  .tile .label {{ display:flex; align-items:center; gap:7px; font-size: 12px; color: var(--text-3); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px; }}
  .tile .mini-dot {{ width: 7px; height: 7px; border-radius: 50%; flex-shrink:0; }}
  .tile .value {{ font-size: 15px; font-weight: 600; }}
  .tile .value.ok {{ color: var(--ok); }}
  .tile .value.bad {{ color: var(--bad); }}
  .tile .ms {{ font-size: 12px; color: var(--text-3); font-weight: 400; margin-left: 4px; }}
  .section-label {{
    font-size: 12px; font-weight: 600; color: var(--text-3);
    text-transform: uppercase; letter-spacing: .05em;
    display: flex; align-items: center; justify-content: space-between;
    margin: 30px 0 10px;
  }}
  .uptime-strip {{
    display: flex; align-items: flex-end; gap: 2.5px;
    height: 44px; margin-bottom: 6px;
  }}
  .uptime-strip .bar {{
    flex: 1; min-width: 2px; border-radius: 2px;
    background: var(--bar-color, var(--ok));
    opacity: var(--bar-op, 1);
    height: var(--bar-h, 100%);
    transition: transform .15s ease;
    transform-origin: bottom;
  }}
  .uptime-strip .bar:hover {{ transform: scaleY(1.08); }}
  .strip-labels {{
    display: flex; justify-content: space-between;
    font-size: 11px; color: var(--text-3); margin-bottom: 24px;
  }}
  .res-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 8px; }}
  .gauge {{
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    background: var(--tile-bg); border: 1px solid var(--card-border);
    border-radius: 16px; padding: 16px 8px 14px;
  }}
  .gauge svg {{ transform: rotate(-90deg); width: 64px; height: 64px; }}
  .gauge circle {{ fill: none; stroke-width: 5.5; }}
  .gauge .bg {{ stroke: var(--card-border); }}
  .gauge .fg {{ stroke-linecap: round; transition: stroke-dashoffset .8s cubic-bezier(.2,.9,.25,1); }}
  .gauge-wrap {{ position: relative; width: 64px; height: 64px; }}
  .gauge-pct {{
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 13.5px; font-weight: 700;
  }}
  .gauge .g-label {{ font-size: 11.5px; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; }}
  .meta {{
    display: flex; flex-wrap: wrap; gap: 6px 18px;
    font-size: 13px; color: var(--text-2);
    border-top: 1px solid var(--card-border);
    padding-top: 20px;
  }}
  .meta b {{ color: var(--text-1); font-weight: 600; }}
  .foot {{
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 22px; font-size: 12px; color: var(--text-3);
  }}
  .refresh {{ display: flex; align-items: center; gap: 8px; }}
  .ring {{ width: 14px; height: 14px; position: relative; }}
  .ring svg {{ transform: rotate(-90deg); width: 100%; height: 100%; }}
  .ring circle {{ fill: none; stroke-width: 2.5; }}
  .ring .bg {{ stroke: var(--card-border); }}
  .ring .fg {{ stroke: var(--accent); stroke-linecap: round; transition: stroke-dashoffset 1s linear; }}
  a {{ color: var(--accent); text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
</style>
</head>
<body>
  <div class="noise"></div>
  <div class="orb a"></div>
  <div class="orb b"></div>
  <div class="wrap">
    <div class="card">
      <div class="brand-row">
        <div class="brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 3 7v6c0 5 4 8.5 9 9 5-.5 9-4 9-9V7l-9-5Z"/></svg>
          SMITH ERP &middot; System Status
        </div>
        {uptime_badge}
      </div>
      <div class="status-row">
        <span class="dot"></span>
        <h1>{status_title}</h1>
      </div>
      <p class="subtitle">{status_subtitle}</p>

      <div class="grid">
        {tiles}
      </div>

      <div class="section-label"><span>Riwayat 24 Jam Terakhir</span><span>{sample_count} sampel</span></div>
      <div class="uptime-strip">
        {uptime_bars}
      </div>
      <div class="strip-labels"><span>24 jam lalu</span><span>sekarang</span></div>

      <div class="section-label"><span>Sumber Daya Server</span><span>rata-rata 24 jam</span></div>
      <div class="res-grid">
        {resource_gauges}
      </div>

      <div class="meta">
        <div>Versi <b>{version}</b></div>
        <div>Proses aktif <b>{uptime}</b></div>
        <div>Rata-rata respons <b>{avg_response_ms}</b></div>
        <div>Waktu server <b id="server-time">{timestamp}</b> WIB</div>
      </div>

      <div class="foot">
        <span>Diperbarui otomatis setiap 15 detik</span>
        <span class="refresh">
          <span class="ring">
            <svg viewBox="0 0 20 20">
              <circle class="bg" cx="10" cy="10" r="8"></circle>
              <circle class="fg" id="ring-fg" cx="10" cy="10" r="8" stroke-dasharray="50.24" stroke-dashoffset="0"></circle>
            </svg>
          </span>
          <span id="countdown">15s</span>
        </span>
      </div>
    </div>
  </div>
<script>
  (function () {{
    var total = 15, remaining = total;
    var ring = document.getElementById('ring-fg');
    var countdown = document.getElementById('countdown');
    var circumference = 50.24;
    function tick() {{
      remaining -= 1;
      if (remaining < 0) {{ location.reload(); return; }}
      countdown.textContent = remaining + 's';
      ring.setAttribute('stroke-dashoffset', circumference * (1 - remaining / total));
    }}
    setInterval(tick, 1000);
  }})();
</script>
</body>
</html>"""


@health_bp.route('/health', methods=['GET'])
def health_check():
    """
    Basic health check endpoint
    ---
    tags:
      - Health
    summary: Basic health check
    description: Returns 200 if application is running. Returns a styled
      HTML status page for browser requests, JSON for everything else
      (monitoring tools, curl, k8s probes) so nothing that already parses
      this endpoint's JSON breaks.
    responses:
      200:
        description: Service is healthy
        schema:
          type: object
          properties:
            status:
              type: string
              example: healthy
            timestamp:
              type: string
              format: date-time
            service:
              type: string
              example: ERP Backend
            version:
              type: string
              example: 1.0.0
    """
    checks = _quick_checks()
    overall_healthy = all(c['healthy'] for c in checks.values())
    payload = {
        'status': 'healthy' if overall_healthy else 'degraded',
        'timestamp': get_local_now().isoformat(),
        'service': 'ERP Backend',
        'version': '1.0.0',
        'uptime': _uptime_human(),
        'checks': checks,
    }

    if not _wants_html():
        return jsonify(payload), 200 if overall_healthy else 503

    tile_defs = [
        ('API', checks.get('database') is not None, None),  # API itself is always up if we got this far
        ('Database', checks['database']['healthy'], checks['database']['ms']),
        ('Cache', checks['cache']['healthy'], checks['cache']['ms']),
    ]
    tiles_html = []
    for label, healthy, ms in tile_defs:
        cls = 'ok' if healthy else 'bad'
        dot_color = 'var(--ok)' if healthy else 'var(--bad)'
        value_text = 'Operasional' if healthy else 'Gangguan'
        ms_html = f'<span class="ms">{ms}ms</span>' if ms is not None else ''
        tiles_html.append(f"""<div class="tile">
          <div class="label"><span class="mini-dot" style="background:{dot_color}"></span>{label}</div>
          <div class="value {cls}">{value_text}{ms_html}</div>
        </div>""")

    history = _load_uptime_history(hours=24, buckets=90)

    if history['uptime_pct'] is not None:
        uptime_badge = f"""<div class="uptime-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
          <b>{history['uptime_pct']}%</b>&nbsp;uptime (24j)
        </div>"""
    else:
        uptime_badge = ""

    bars_html = []
    if history['bars']:
        for ratio in history['bars']:
            if ratio >= 0.999:
                color, op = 'var(--ok)', 1
            elif ratio >= 0.5:
                color, op = '#fbbf24', 0.9
            else:
                color, op = 'var(--bad)', 1
            height_pct = max(18, round(ratio * 100))
            bars_html.append(
                f'<span class="bar" style="--bar-color:{color};--bar-op:{op};--bar-h:{height_pct}%"></span>'
            )
    else:
        bars_html.append('<span style="color:var(--text-3);font-size:12px;">Belum ada data histori</span>')

    def _gauge(label, pct):
        if pct is None:
            pct = 0
            display = "N/A"
        else:
            display = f"{pct:.0f}%"
        circumference = 2 * 3.14159265 * 26
        offset = circumference * (1 - min(pct, 100) / 100)
        color = 'var(--bad)' if pct > 85 else ('#fbbf24' if pct > 65 else 'var(--ok)')
        return f"""<div class="gauge">
          <div class="gauge-wrap">
            <svg viewBox="0 0 64 64">
              <circle class="bg" cx="32" cy="32" r="26"></circle>
              <circle class="fg" cx="32" cy="32" r="26" stroke="{color}"
                stroke-dasharray="{circumference:.2f}" stroke-dashoffset="{offset:.2f}"></circle>
            </svg>
            <div class="gauge-pct">{display}</div>
          </div>
          <div class="g-label">{label}</div>
        </div>"""

    resource_gauges = "\n        ".join([
        _gauge("CPU", history['avg_cpu']),
        _gauge("Memory", history['avg_mem']),
        _gauge("Disk", history['avg_disk']),
    ])

    avg_response_display = f"{history['avg_response_ms']}ms" if history['avg_response_ms'] is not None else "N/A"

    from urllib.parse import quote as _urlquote
    favicon_emoji = "\U0001F7E2" if overall_healthy else "\U0001F534"
    favicon_svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
        f"<text y='.9em' font-size='90'>{favicon_emoji}</text></svg>"
    )
    html = _STATUS_PAGE_TEMPLATE.format(
        favicon=_urlquote(favicon_svg),
        orb_b_color="#34d399" if overall_healthy else "#f87171",
        status_color="--ok" if overall_healthy else "--bad",
        status_glow="--ok-glow" if overall_healthy else "--bad-glow",
        status_title="All Systems Operational" if overall_healthy else "Sebagian Layanan Bermasalah",
        status_subtitle=(
            "Semua layanan inti berjalan normal. Tidak ada gangguan terdeteksi saat ini."
            if overall_healthy else
            "Salah satu atau lebih layanan pendukung sedang tidak dapat dijangkau. Tim teknis sudah diberi tahu."
        ),
        tiles="\n        ".join(tiles_html),
        uptime_badge=uptime_badge,
        uptime_bars="".join(bars_html),
        sample_count=history['sample_count'],
        resource_gauges=resource_gauges,
        version=payload['version'],
        uptime=payload['uptime'],
        avg_response_ms=avg_response_display,
        timestamp=get_local_now().strftime('%d %b %Y, %H:%M:%S'),
    )
    return Response(html, status=200 if overall_healthy else 503, mimetype='text/html')


@health_bp.route('/health/detailed', methods=['GET'])
def detailed_health_check():
    """
    Detailed health check including database and redis
    ---
    tags:
      - Health
    summary: Detailed health check
    description: Checks database and redis connections
    responses:
      200:
        description: All services are healthy
        schema:
          type: object
          properties:
            status:
              type: string
              example: healthy
            timestamp:
              type: string
              format: date-time
            service:
              type: string
              example: ERP Backend
            version:
              type: string
              example: 1.0.0
            checks:
              type: object
              properties:
                database:
                  type: object
                  properties:
                    status:
                      type: string
                      example: healthy
                    message:
                      type: string
                redis:
                  type: object
                  properties:
                    status:
                      type: string
                      example: healthy
                    message:
                      type: string
      503:
        description: Service unhealthy
    """
    health_status = {
        'status': 'healthy',
        'timestamp': get_local_now().isoformat(),
        'service': 'ERP Backend',
        'version': '1.0.0',
        'checks': {}
    }
    
    # Check Database
    try:
        from app import db
        db.session.execute('SELECT 1')
        health_status['checks']['database'] = {
            'status': 'healthy',
            'message': 'Database connection successful'
        }
    except Exception as e:
        health_status['status'] = 'unhealthy'
        health_status['checks']['database'] = {
            'status': 'unhealthy',
            'message': str(e)
        }
    
    # Check Redis
    try:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        r = redis.from_url(redis_url)
        r.ping()
        health_status['checks']['redis'] = {
            'status': 'healthy',
            'message': 'Redis connection successful'
        }
    except Exception as e:
        health_status['checks']['redis'] = {
            'status': 'unhealthy',
            'message': str(e)
        }
    
    # Determine overall status
    if health_status['status'] == 'unhealthy':
        return jsonify(health_status), 503
    
    return jsonify(health_status), 200


@health_bp.route('/ready', methods=['GET'])
def readiness_check():
    """
    Readiness check for Kubernetes/Docker
    Returns 200 when application is ready to serve traffic
    """
    try:
        from app import db
        db.session.execute('SELECT 1')
        return jsonify({
            'status': 'ready',
            'timestamp': get_local_now().isoformat()
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'not ready',
            'error': str(e),
            'timestamp': get_local_now().isoformat()
        }), 503


@health_bp.route('/live', methods=['GET'])
def liveness_check():
    """
    Liveness check for Kubernetes/Docker
    Returns 200 if application is alive
    """
    return jsonify({
        'status': 'alive',
        'timestamp': get_local_now().isoformat()
    }), 200


@health_bp.route('/cache/stats', methods=['GET'])
def cache_stats():
    """
    Get Redis cache statistics
    ---
    tags:
      - Health
    summary: Get cache statistics
    description: Retrieve Redis cache performance metrics
    security:
      - BearerAuth: []
    responses:
      200:
        description: Cache statistics retrieved successfully
      401:
        description: Unauthorized
    """
    try:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        r = redis.from_url(redis_url)
        
        # Get Redis info
        info = r.info()
        
        stats = {
            'redis_connected': True,
            'used_memory': info.get('used_memory_human', 'N/A'),
            'total_keys': info.get('db0', {}).get('keys', 0),
            'hits': info.get('keyspace_hits', 0),
            'misses': info.get('keyspace_misses', 0),
        }
        
        # Calculate hit rate
        total_requests = stats['hits'] + stats['misses']
        if total_requests > 0:
            stats['hit_rate'] = round((stats['hits'] / total_requests) * 100, 2)
        else:
            stats['hit_rate'] = 0.0
        
        return jsonify(stats), 200
        
    except Exception as e:
        return jsonify({
            'redis_connected': False,
            'error': str(e)
        }), 200


@health_bp.route('/cache/clear', methods=['POST'])
def clear_cache():
    """
    Clear all Redis cache
    ---
    tags:
      - Health
    summary: Clear cache
    description: Clear all cached data from Redis
    security:
      - BearerAuth: []
    responses:
      200:
        description: Cache cleared successfully
      401:
        description: Unauthorized
    """
    try:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        r = redis.from_url(redis_url)
        r.flushdb()
        
        return jsonify({
            'message': 'Cache cleared successfully'
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 200


@health_bp.route('/health/system', methods=['GET'])
def system_health():
    """Comprehensive system health  CPU, memory, disk, DB, OpenWA, PM2, recent errors."""
    import psutil, time, os, requests as req
    from utils.helpers import get_setting_value

    result = {
        'timestamp': get_local_now().isoformat(),
        'server': os.uname().nodename,
        'api': {}, 'resources': {}, 'database': {},
        'whatsapp': {}, 'pm2': {}, 'recent_errors': [],
    }

    # API uptime
    try:
        proc = psutil.Process(os.getpid())
        uptime_secs = time.time() - proc.create_time()
        days, rem = divmod(int(uptime_secs), 86400)
        hours, rem = divmod(rem, 3600)
        result['api'] = {
            'status': 'healthy',
            'uptime_seconds': int(uptime_secs),
            'uptime_human': f"{days}d {hours}h {rem//60}m",
            'pid': os.getpid(),
            'python_version': __import__('sys').version.split()[0],
        }
    except Exception as e:
        result['api'] = {'status': 'error', 'error': str(e)}

    # Resources
    try:
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        cpu = psutil.cpu_percent(interval=0.2)
        result['resources'] = {
            'cpu_percent': cpu,
            'cpu_status': 'warning' if cpu > 80 else 'healthy',
            'memory_used_mb': round(mem.used / 1024 / 1024, 1),
            'memory_total_mb': round(mem.total / 1024 / 1024, 1),
            'memory_percent': mem.percent,
            'memory_status': 'warning' if mem.percent > 85 else 'healthy',
            'disk_used_gb': round(disk.used / 1024**3, 1),
            'disk_total_gb': round(disk.total / 1024**3, 1),
            'disk_percent': disk.percent,
            'disk_status': 'warning' if disk.percent > 85 else 'healthy',
        }
    except Exception as e:
        result['resources'] = {'status': 'error', 'error': str(e)}

    # Database
    try:
        from models import db as _db
        from sqlalchemy import text, inspect as sa_inspect
        _db.session.execute(text('SELECT 1'))
        db_uri = str(_db.engine.url)
        db_path = db_uri.replace('sqlite:///', '')
        if not db_path.startswith('/'):
            db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'instance', db_path))
        db_size_mb = round(os.path.getsize(db_path) / 1024 / 1024, 1) if os.path.exists(db_path) else None
        table_count = len(sa_inspect(_db.engine).get_table_names())
        backup_dir = backup_dir = os.path.expanduser('~/backups')
        backup_age = None
        if os.path.isdir(backup_dir):
            backups = sorted([
                os.path.getmtime(os.path.join(backup_dir, f))
                for f in os.listdir(backup_dir)
                if f.endswith('.db') and f.startswith('erp_database')
            ], reverse=True)
            if backups:
                age = int(time.time() - backups[0])
                h, m2 = divmod(age // 60, 60)
                backup_age = f"{h}h {m2}m ago" if h else f"{m2}m ago"
        result['database'] = {
            'status': 'healthy',
            'size_mb': db_size_mb,
            'table_count': table_count,
            'last_backup': backup_age or 'unknown',
            'engine': 'SQLite',
        }
    except Exception as e:
        result['database'] = {'status': 'error', 'error': str(e)}

    # WhatsApp / OpenWA
    try:
        import re as _re
        owa_url = get_setting_value('notifications.whatsapp_api_url', '')
        owa_token = get_setting_value('notifications.whatsapp_token', '')
        mat = _re.search(r'(https?://[^/]+)/api/sessions/([^/]+)', owa_url or '')
        if mat:
            base, sid = mat.group(1), mat.group(2)
            resp = req.get(f"{base}/api/sessions/{sid}", headers={'X-API-Key': owa_token}, timeout=4)
            data = resp.json()
            la = data.get('lastActive') or data.get('lastActiveAt') or ''
            if la:
                import datetime as _dt
                ts = _dt.datetime.fromisoformat(la.replace('Z', '+00:00'))
                age = int(time.time() - ts.timestamp())
                la_human = 'just now' if age < 60 else (f"{age//60}m ago" if age < 3600 else f"{age//3600}h {(age%3600)//60}m ago")
            else:
                la_human = 'unknown'
            result['whatsapp'] = {
                'status': data.get('status', 'unknown'),
                'healthy': data.get('status') == 'ready',
                'session_name': data.get('name', ''),
                'session_id': sid,
                'phone': data.get('phone') or '',
                'push_name': data.get('pushName', ''),
                'last_active': la_human,
                'gateway_url': base,
            }
        else:
            result['whatsapp'] = {'status': 'not_configured', 'healthy': False}
    except Exception as e:
        result['whatsapp'] = {'status': 'error', 'healthy': False, 'error': str(e)}

    # PM2 processes
    try:
        import subprocess, json as _json
        PM2_DISPLAY_ALIAS = {
            'smith-backend': 'Backend Server',
            'smith-frontend': 'Antarmuka',
            'openwa': 'WA Gateway',
        }
        PM2_HIDDEN_PREFIXES = ('porto-',)

        pm2 = subprocess.run(['pm2', 'jlist'], capture_output=True, text=True, timeout=5)
        procs = _json.loads(pm2.stdout) if pm2.returncode == 0 else []
        visible_procs = [p for p in procs if not str(p.get('name', '')).startswith(PM2_HIDDEN_PREFIXES)]
        result['pm2'] = {'processes': [{
            'name': PM2_DISPLAY_ALIAS.get(p.get('name'), p.get('name')),
            'status': p.get('pm2_env', {}).get('status'),
            'restarts': p.get('pm2_env', {}).get('restart_time', 0),
            'uptime_ms': p.get('pm2_env', {}).get('pm_uptime'),
            'memory_mb': round(p.get('monit', {}).get('memory', 0) / 1024 / 1024, 1),
            'cpu': p.get('monit', {}).get('cpu', 0),
        } for p in visible_procs]}
    except Exception as e:
        result['pm2'] = {'processes': [], 'error': str(e)}

    # Recent errors
    try:
        log_path = os.path.expanduser('~/.pm2/logs/smith-backend-error.log')
        errors = []
        if os.path.exists(log_path):
            lines = open(log_path, errors='replace').readlines()
            for line in lines[-200:]:
                line = line.strip()
                if not line or ('404' in line and 'HEAD /' in line):
                    continue
                if any(k in line for k in ['ERROR', 'Error', 'Exception', 'Traceback', 'CRITICAL']):
                    errors.append(line[-200:])
        result['recent_errors'] = errors[-10:]
    except Exception:
        result['recent_errors'] = []

    return jsonify(result), 200

@health_bp.route('/health/history', methods=['GET'])
def health_history():
    """
    Return aggregated health history for trend charts.
    Query params:
      range: '24h' | '7d' | '30d' (default '24h')
      downsample: optional int, max number of points to return (default varies by range)
    """
    import glob

    range_param = request.args.get('range', '24h')
    range_days = {'24h': 1, '7d': 7, '30d': 30}.get(range_param, 1)

    history_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs', 'health_history')
    now = get_local_now()
    cutoff = now - __import__('datetime').timedelta(days=range_days)

    all_points = []
    if os.path.isdir(history_dir):
        for file_path in sorted(glob.glob(os.path.join(history_dir, 'health_*.json'))):
            try:
                with open(file_path, 'r') as f:
                    day_data = json.load(f)
            except (json.JSONDecodeError, IOError):
                continue
            for point in day_data:
                try:
                    ts = datetime.fromisoformat(point['timestamp'])
                except (KeyError, ValueError):
                    continue
                if ts.replace(tzinfo=None) >= cutoff.replace(tzinfo=None):
                    all_points.append(point)

    all_points.sort(key=lambda p: p['timestamp'])

    # Downsample so the frontend isn't rendering 40k+ points for a 30-day range
    default_max_points = {'24h': 288, '7d': 336, '30d': 360}  # ~5min, ~30min, ~2hr buckets
    max_points = int(request.args.get('downsample', default_max_points.get(range_param, 288)))

    if len(all_points) > max_points:
        step = len(all_points) / max_points
        sampled = []
        i = 0.0
        while int(i) < len(all_points):
            sampled.append(all_points[int(i)])
            i += step
        all_points = sampled

    # Build lightweight series for charts (resources) + separate status timeline
    resource_series = [{
        'timestamp': p['timestamp'],
        'cpu_percent': p.get('resources', {}).get('cpu_percent'),
        'memory_percent': p.get('resources', {}).get('memory_percent'),
        'disk_percent': p.get('resources', {}).get('disk_percent'),
    } for p in all_points]

    status_series = [{
        'timestamp': p['timestamp'],
        'database_status': p.get('database_status'),
        'whatsapp_status': p.get('whatsapp_status'),
    } for p in all_points]

    # Aggregate response times across the whole range: top slowest endpoints by avg
    endpoint_totals = {}
    for p in all_points:
        for endpoint, stats in (p.get('response_times') or {}).items():
            agg = endpoint_totals.setdefault(endpoint, {'count': 0, 'total_ms': 0.0, 'max_ms': 0.0})
            agg['count'] += stats.get('count', 0)
            agg['total_ms'] += stats.get('avg_ms', 0) * stats.get('count', 0)
            agg['max_ms'] = max(agg['max_ms'], stats.get('max_ms', 0))

    slowest_endpoints = sorted([
        {
            'endpoint': ep,
            'avg_ms': round(agg['total_ms'] / agg['count'], 1) if agg['count'] else 0,
            'max_ms': round(agg['max_ms'], 1),
            'request_count': agg['count'],
        }
        for ep, agg in endpoint_totals.items()
    ], key=lambda x: x['avg_ms'], reverse=True)[:10]

    return jsonify({
        'range': range_param,
        'point_count': len(all_points),
        'resource_series': resource_series,
        'status_series': status_series,
        'slowest_endpoints': slowest_endpoints,
    }), 200

@health_bp.route('/health/whatsapp/reconnect', methods=['POST'])
def whatsapp_reconnect():
    """Trigger OpenWA session reconnect."""
    import requests as req, re as _re
    from utils.helpers import get_setting_value
    owa_url = get_setting_value('notifications.whatsapp_api_url', '')
    owa_token = get_setting_value('notifications.whatsapp_token', '')
    mat = _re.search(r'(https?://[^/]+)/api/sessions/([^/]+)', owa_url or '')
    if not mat:
        return jsonify({'success': False, 'error': 'OpenWA not configured'}), 400
    base, sid = mat.group(1), mat.group(2)
    try:
        r = req.post(f"{base}/api/sessions/{sid}/start", headers={'X-API-Key': owa_token}, timeout=6)
        return jsonify({'success': r.status_code in (200, 201), 'status': r.json().get('status')}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
