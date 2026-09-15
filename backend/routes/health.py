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
        return {
            'bars': [], 'cpu_series': [], 'mem_series': [], 'disk_series': [],
            'uptime_pct': None, 'avg_cpu': None, 'avg_mem': None, 'avg_disk': None,
            'avg_response_ms': None, 'sample_count': 0, 'streak_human': None,
        }

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
    # The same time-slices also produce a per-bucket average for CPU/mem/
    # disk, so the trend line charts share the exact same x-axis as the
    # uptime strip above them.
    bars = []
    cpu_series, mem_series, disk_series = [], [], []
    if len(points) <= buckets:
        chunks = [[p] for p in points]
    else:
        step = len(points) / buckets
        chunks = []
        for i in range(buckets):
            start = int(i * step)
            end = int((i + 1) * step) or 1
            chunk = points[start:end] or [points[min(start, len(points) - 1)]]
            chunks.append(chunk)

    for chunk in chunks:
        healthy = sum(1 for p in chunk if p.get('database_status') == 'healthy')
        bars.append(healthy / len(chunk))
        c = [p['resources']['cpu_percent'] for p in chunk if (p.get('resources') or {}).get('cpu_percent') is not None]
        m = [p['resources']['memory_percent'] for p in chunk if (p.get('resources') or {}).get('memory_percent') is not None]
        d = [p['resources']['disk_percent'] for p in chunk if (p.get('resources') or {}).get('disk_percent') is not None]
        cpu_series.append(_avg(c))
        mem_series.append(_avg(m))
        disk_series.append(_avg(d))

    # Longest unbroken healthy streak, in points - converted to a human
    # duration using the actual average spacing between real samples
    # (~2 minutes in practice) rather than assuming a fixed interval.
    longest_streak = cur_streak = 0
    for p in points:
        if p.get('database_status') == 'healthy':
            cur_streak += 1
            longest_streak = max(longest_streak, cur_streak)
        else:
            cur_streak = 0
    if len(points) > 1:
        span_secs = (datetime.fromisoformat(points[-1]['timestamp']) - datetime.fromisoformat(points[0]['timestamp'])).total_seconds()
        avg_interval = span_secs / (len(points) - 1) if span_secs > 0 else 120
    else:
        avg_interval = 120
    streak_secs = int(longest_streak * avg_interval)
    if streak_secs >= 86400:
        streak_human = f"{streak_secs // 86400} hari"
    elif streak_secs >= 3600:
        streak_human = f"{streak_secs // 3600} jam"
    else:
        streak_human = f"{max(streak_secs // 60, 1)} menit"

    return {
        'bars': bars,
        'cpu_series': cpu_series,
        'mem_series': mem_series,
        'disk_series': disk_series,
        'uptime_pct': uptime_pct,
        'avg_cpu': _avg(cpu_vals),
        'avg_mem': _avg(mem_vals),
        'avg_disk': _avg(disk_vals),
        'avg_response_ms': _avg(resp_vals),
        'sample_count': len(points),
        'streak_human': streak_human,
    }


def _smooth_path(values, width=300, height=64, pad=4):
    """Converts a list of 0-100 values (None allowed, gaps are skipped) into
    a smoothed SVG path string using quadratic-through-midpoints - simple
    enough to not need a charting library, smooth enough not to look like a
    jagged sensor readout."""
    pts = [(i, v) for i, v in enumerate(values) if v is not None]
    if len(pts) < 2:
        return '', ''
    n = len(values)
    xs = [pad + (i / max(n - 1, 1)) * (width - 2 * pad) for i, _ in pts]
    ys = [height - pad - (v / 100) * (height - 2 * pad) for _, v in pts]
    coords = list(zip(xs, ys))

    d = f"M {coords[0][0]:.1f},{coords[0][1]:.1f} "
    for i in range(1, len(coords)):
        if i == len(coords) - 1:
            d += f"L {coords[i][0]:.1f},{coords[i][1]:.1f} "
        else:
            midx = (coords[i][0] + coords[i + 1][0]) / 2
            midy = (coords[i][1] + coords[i + 1][1]) / 2
            d += f"Q {coords[i][0]:.1f},{coords[i][1]:.1f} {midx:.1f},{midy:.1f} "

    area = d + f"L {coords[-1][0]:.1f},{height} L {coords[0][0]:.1f},{height} Z"
    return d.strip(), area


_STATUS_PAGE_TEMPLATE = """<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SMITH ERP — Status</title>
<link rel="icon" href="data:image/svg+xml,{favicon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {{
    --bg: #08090b; --surface: #0d0f13; --line: rgba(255,255,255,0.09); --line-soft: rgba(255,255,255,0.05);
    --text-1: #f2f3f5; --text-2: #9a9ea6; --text-3: #5c6068;
    --ok: #2dd4a7; --bad: #f0475a; --warn: #f2a93b;
    --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  }}
  @media (prefers-color-scheme: light) {{
    :root {{
      --bg: #f4f5f7; --surface: #ffffff; --line: rgba(15,23,42,0.10); --line-soft: rgba(15,23,42,0.05);
      --text-1: #101215; --text-2: #5b6068; --text-3: #9296a0;
    }}
  }}
  * {{ box-sizing: border-box; }}
  html {{ background: var(--bg); }}
  body {{
    margin: 0; min-height: 100vh;
    background:
      linear-gradient(var(--line-soft) 1px, transparent 1px) 0 0 / 100% 34px,
      var(--bg);
    color: var(--text-1);
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
  }}
  .page {{ max-width: 760px; margin: 0 auto; padding: 56px 24px 40px; }}
  a {{ color: inherit; }}

  .topbar {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 44px; }}
  .mark {{ display: flex; align-items: center; gap: 11px; }}
  .mark .sq {{
    width: 26px; height: 26px; border: 1.5px solid var(--text-1); border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--mono); font-weight: 700; font-size: 13px;
  }}
  .mark .name {{ font-weight: 700; font-size: 14.5px; letter-spacing: -0.01em; }}
  .mark .div {{ width: 1px; height: 14px; background: var(--line); margin: 0 2px; }}
  .mark .sub {{ font-family: var(--mono); font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: .1em; }}
  .clock {{ font-family: var(--mono); font-size: 12.5px; color: var(--text-2); font-variant-numeric: tabular-nums; }}

  .hero {{ border-bottom: 1px solid var(--line); padding-bottom: 28px; margin-bottom: 28px; }}
  .hero-top {{ display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }}
  .dot {{ width: 8px; height: 8px; border-radius: 50%; background: var({status_color}); flex-shrink: 0; }}
  .dot.live::after {{
    content: ""; display: block; width: 8px; height: 8px; border-radius: 50%;
    background: var({status_color}); animation: fade 1.8s ease-in-out infinite;
  }}
  @keyframes fade {{ 0%,100% {{ opacity: .35; transform: scale(2.4); }} 50% {{ opacity: 0; transform: scale(3.4); }} }}
  .hero-eyebrow {{ font-family: var(--mono); font-size: 11.5px; color: var(--text-3); text-transform: uppercase; letter-spacing: .12em; }}
  h1 {{ font-size: 34px; font-weight: 800; margin: 0 0 10px; letter-spacing: -0.025em; line-height: 1.1; }}
  .hero p {{ margin: 0; color: var(--text-2); font-size: 15px; line-height: 1.6; max-width: 52ch; }}

  .stat-row {{ display: flex; flex-wrap: wrap; gap: 0; margin-top: 24px; border-top: 1px solid var(--line); }}
  .stat {{ flex: 1; min-width: 120px; padding: 14px 18px 0 0; border-right: 1px solid var(--line); }}
  .stat:last-child {{ border-right: none; }}
  .stat .k {{ font-family: var(--mono); font-size: 10.5px; color: var(--text-3); text-transform: uppercase; letter-spacing: .09em; margin-bottom: 5px; }}
  .stat .v {{ font-family: var(--mono); font-size: 19px; font-weight: 600; letter-spacing: -0.01em; }}
  .stat .v.ok {{ color: var(--ok); }}

  .section {{ margin-bottom: 34px; }}
  .section-head {{
    display: flex; align-items: baseline; justify-content: space-between;
    font-family: var(--mono); font-size: 11px; color: var(--text-3);
    text-transform: uppercase; letter-spacing: .1em; margin-bottom: 12px;
  }}

  .comp-list {{ border-top: 1px solid var(--line); }}
  .comp-row {{
    display: flex; align-items: center; justify-content: space-between;
    padding: 13px 2px; border-bottom: 1px solid var(--line);
  }}
  .comp-left {{ display: flex; align-items: center; gap: 11px; }}
  .comp-dot {{ width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }}
  .comp-name {{ font-size: 14px; font-weight: 500; }}
  .comp-right {{ display: flex; align-items: center; gap: 10px; }}
  .comp-ms {{ font-family: var(--mono); font-size: 12px; color: var(--text-3); }}
  .comp-state {{ font-family: var(--mono); font-size: 12px; font-weight: 600; }}
  .comp-state.ok {{ color: var(--ok); }}
  .comp-state.bad {{ color: var(--bad); }}

  .strip {{ display: flex; gap: 2px; height: 30px; align-items: stretch; }}
  .strip .seg {{ flex: 1; background: var(--seg-color, var(--ok)); opacity: var(--seg-op, 1); border-radius: 1px; }}
  .strip-foot {{ display: flex; justify-content: space-between; font-family: var(--mono); font-size: 10.5px; color: var(--text-3); margin-top: 7px; }}

  .chart-box {{ border: 1px solid var(--line); border-radius: 8px; padding: 18px 18px 14px; background: var(--surface); }}
  .legend {{ display: flex; gap: 20px; margin-bottom: 14px; flex-wrap: wrap; }}
  .legend-item {{ display: flex; align-items: center; gap: 7px; font-family: var(--mono); font-size: 12px; color: var(--text-2); }}
  .legend-item .sw {{ width: 8px; height: 8px; border-radius: 2px; }}
  .legend-item b {{ color: var(--text-1); font-weight: 600; }}
  .chart-box svg {{ display: block; width: 100%; height: 120px; overflow: visible; }}
  .grid-line {{ stroke: var(--line); stroke-width: 1; }}
  .series-line {{ fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }}

  .foot {{
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
    border-top: 1px solid var(--line); padding-top: 18px; margin-top: 8px;
    font-family: var(--mono); font-size: 11.5px; color: var(--text-3);
  }}
  .foot b {{ color: var(--text-2); font-weight: 500; }}
  .foot-links a {{ text-decoration: none; color: var(--text-3); }}
  .foot-links a:hover {{ color: var(--text-1); }}
  .refresh-txt {{ display: flex; align-items: center; gap: 7px; }}
  .refresh-txt .rdot {{ width: 5px; height: 5px; border-radius: 50%; background: var(--text-3); animation: blink 1.4s steps(1) infinite; }}
  @keyframes blink {{ 0%,49% {{ opacity: 1; }} 50%,100% {{ opacity: .25; }} }}

  @media (max-width: 560px) {{
    h1 {{ font-size: 27px; }}
    .stat {{ min-width: 45%; padding-bottom: 12px; }}
    .legend {{ gap: 12px; }}
  }}
</style>
</head>
<body>
  <div class="page">

    <div class="topbar">
      <div class="mark">
        <span class="sq">S</span>
        <span class="name">SMITH ERP</span>
        <span class="div"></span>
        <span class="sub">Status</span>
      </div>
      <div class="clock" id="clock">{timestamp}</div>
    </div>

    <div class="hero">
      <div class="hero-top">
        <span class="dot live"></span>
        <span class="hero-eyebrow">{hero_eyebrow}</span>
      </div>
      <h1>{status_title}</h1>
      <p>{status_subtitle}</p>

      <div class="stat-row">
        <div class="stat"><div class="k">Uptime 24 Jam</div><div class="v ok">{uptime_pct}</div></div>
        <div class="stat"><div class="k">Tanpa Gangguan</div><div class="v">{streak_human}</div></div>
        <div class="stat"><div class="k">Latensi Rata²</div><div class="v">{avg_response_ms}</div></div>
        <div class="stat"><div class="k">Sampel</div><div class="v">{sample_count}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><span>Komponen</span></div>
      <div class="comp-list">
        {component_rows}
      </div>
    </div>

    <div class="section">
      <div class="section-head"><span>Riwayat 24 Jam</span><span>setiap ~16 menit</span></div>
      <div class="strip">
        {uptime_segments}
      </div>
      <div class="strip-foot"><span>−24j</span><span>sekarang</span></div>
    </div>

    <div class="section">
      <div class="section-head"><span>Sumber Daya Server</span><span>tren 24 jam</span></div>
      <div class="chart-box">
        <div class="legend">
          <span class="legend-item"><span class="sw" style="background:#60a5fa"></span>CPU <b>{cpu_now}</b></span>
          <span class="legend-item"><span class="sw" style="background:#2dd4a7"></span>Memory <b>{mem_now}</b></span>
          <span class="legend-item"><span class="sw" style="background:#f2a93b"></span>Disk <b>{disk_now}</b></span>
        </div>
        {resource_chart_svg}
      </div>
    </div>

    <div class="foot">
      <div>v{version} &nbsp;·&nbsp; proses aktif <b>{uptime}</b></div>
      <div class="refresh-txt"><span class="rdot"></span><span id="countdown">memperbarui dalam 15dtk</span></div>
    </div>

  </div>
<script>
  (function () {{
    var el = document.getElementById('countdown');
    var n = 15;
    setInterval(function () {{
      n -= 1;
      if (n < 0) {{ location.reload(); return; }}
      el.textContent = 'memperbarui dalam ' + n + 'dtk';
    }}, 1000);
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

    component_defs = [
        ('API Backend', checks.get('database') is not None, None),
        ('Database', checks['database']['healthy'], checks['database']['ms']),
        ('Cache (Redis)', checks['cache']['healthy'], checks['cache']['ms']),
    ]
    component_rows = []
    for name, healthy, ms in component_defs:
        dot_color = 'var(--ok)' if healthy else 'var(--bad)'
        state_cls = 'ok' if healthy else 'bad'
        state_text = 'OPERATIONAL' if healthy else 'DOWN'
        ms_html = f'<span class="comp-ms">{ms}ms</span>' if ms is not None else ''
        component_rows.append(f"""<div class="comp-row">
          <div class="comp-left"><span class="comp-dot" style="background:{dot_color}"></span><span class="comp-name">{name}</span></div>
          <div class="comp-right">{ms_html}<span class="comp-state {state_cls}">{state_text}</span></div>
        </div>""")

    history = _load_uptime_history(hours=24, buckets=90)

    seg_html = []
    if history['bars']:
        for ratio in history['bars']:
            if ratio >= 0.999:
                color, op = 'var(--ok)', 1
            elif ratio >= 0.5:
                color, op = 'var(--warn)', 1
            else:
                color, op = 'var(--bad)', 1
            seg_html.append(f'<span class="seg" style="--seg-color:{color};--seg-op:{op}"></span>')
    else:
        seg_html.append('<span style="color:var(--text-3);font-family:var(--mono);font-size:11px;">belum ada data</span>')

    def _fmt_pct(v):
        return f"{v:.0f}%" if v is not None else "N/A"

    chart_width, chart_height = 700, 120
    cpu_line, _ = _smooth_path(history['cpu_series'], width=chart_width, height=chart_height, pad=4)
    mem_line, _ = _smooth_path(history['mem_series'], width=chart_width, height=chart_height, pad=4)
    disk_line, _ = _smooth_path(history['disk_series'], width=chart_width, height=chart_height, pad=4)

    grid_lines = "".join([
        f'<line class="grid-line" x1="0" y1="{chart_height * f:.1f}" x2="{chart_width}" y2="{chart_height * f:.1f}"></line>'
        for f in (0, 0.25, 0.5, 0.75, 1.0)
    ])

    if cpu_line or mem_line or disk_line:
        resource_chart_svg = f"""<svg viewBox="0 0 {chart_width} {chart_height}" preserveAspectRatio="none">
          {grid_lines}
          <path class="series-line" d="{cpu_line}" stroke="#60a5fa"></path>
          <path class="series-line" d="{mem_line}" stroke="#2dd4a7"></path>
          <path class="series-line" d="{disk_line}" stroke="#f2a93b"></path>
        </svg>"""
    else:
        resource_chart_svg = '<div style="font-family:var(--mono);font-size:12px;color:var(--text-3);padding:20px 0;">Belum ada data histori</div>'

    from urllib.parse import quote as _urlquote
    favicon_emoji = "\U0001F7E2" if overall_healthy else "\U0001F534"
    favicon_svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
        f"<text y='.9em' font-size='90'>{favicon_emoji}</text></svg>"
    )
    html = _STATUS_PAGE_TEMPLATE.format(
        favicon=_urlquote(favicon_svg),
        status_color="--ok" if overall_healthy else "--bad",
        hero_eyebrow="Semua sistem berjalan" if overall_healthy else "Gangguan terdeteksi",
        status_title="All Systems Operational" if overall_healthy else "Partial System Outage",
        status_subtitle=(
            "Backend, database, dan layanan cache berjalan normal. Tidak ada insiden yang sedang berlangsung."
            if overall_healthy else
            "Salah satu atau lebih layanan pendukung sedang tidak dapat dijangkau. Tim teknis sudah diberi tahu."
        ),
        uptime_pct=(f"{history['uptime_pct']}%" if history['uptime_pct'] is not None else "N/A"),
        streak_human=history['streak_human'] or "—",
        avg_response_ms=(f"{history['avg_response_ms']}ms" if history['avg_response_ms'] is not None else "N/A"),
        sample_count=history['sample_count'],
        component_rows="\n        ".join(component_rows),
        uptime_segments="".join(seg_html),
        cpu_now=_fmt_pct(history['avg_cpu']),
        mem_now=_fmt_pct(history['avg_mem']),
        disk_now=_fmt_pct(history['avg_disk']),
        resource_chart_svg=resource_chart_svg,
        version=payload['version'],
        uptime=payload['uptime'],
        timestamp=get_local_now().strftime('%d %b %Y, %H:%M:%S'),
    )
    return Response(html, status=200 if overall_healthy else 503, mimetype='text/html')




_DATABASE_PAGE_TEMPLATE = """<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SMITH ERP — Status Database</title>
<link rel="icon" href="data:image/svg+xml,{favicon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {{
    --bg: #08090b; --surface: #0d0f13; --line: rgba(255,255,255,0.09); --line-soft: rgba(255,255,255,0.05);
    --text-1: #f2f3f5; --text-2: #9a9ea6; --text-3: #5c6068;
    --ok: #2dd4a7; --bad: #f0475a; --warn: #f2a93b;
    --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  }}
  @media (prefers-color-scheme: light) {{
    :root {{
      --bg: #f4f5f7; --surface: #ffffff; --line: rgba(15,23,42,0.10); --line-soft: rgba(15,23,42,0.05);
      --text-1: #101215; --text-2: #5b6068; --text-3: #9296a0;
    }}
  }}
  * {{ box-sizing: border-box; }}
  html {{ background: var(--bg); }}
  body {{
    margin: 0; min-height: 100vh;
    background: linear-gradient(var(--line-soft) 1px, transparent 1px) 0 0 / 100% 34px, var(--bg);
    color: var(--text-1); font-family: var(--sans); -webkit-font-smoothing: antialiased;
  }}
  .page {{ max-width: 760px; margin: 0 auto; padding: 56px 24px 40px; }}
  a {{ color: inherit; text-decoration: none; }}

  .topbar {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 44px; }}
  .mark {{ display: flex; align-items: center; gap: 11px; }}
  .mark .sq {{
    width: 26px; height: 26px; border: 1.5px solid var(--text-1); border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--mono); font-weight: 700; font-size: 13px;
  }}
  .mark .name {{ font-weight: 700; font-size: 14.5px; letter-spacing: -0.01em; }}
  .mark .div {{ width: 1px; height: 14px; background: var(--line); margin: 0 2px; }}
  .mark .sub {{ font-family: var(--mono); font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: .1em; }}
  .mark .sub a:hover {{ color: var(--text-1); }}
  .clock {{ font-family: var(--mono); font-size: 12.5px; color: var(--text-2); font-variant-numeric: tabular-nums; }}

  .hero {{ border-bottom: 1px solid var(--line); padding-bottom: 28px; margin-bottom: 28px; }}
  .hero-top {{ display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }}
  .dot {{ width: 8px; height: 8px; border-radius: 50%; background: var({status_color}); flex-shrink: 0; }}
  .dot.live::after {{
    content: ""; display: block; width: 8px; height: 8px; border-radius: 50%;
    background: var({status_color}); animation: fade 1.8s ease-in-out infinite;
  }}
  @keyframes fade {{ 0%,100% {{ opacity: .35; transform: scale(2.4); }} 50% {{ opacity: 0; transform: scale(3.4); }} }}
  .hero-eyebrow {{ font-family: var(--mono); font-size: 11.5px; color: var(--text-3); text-transform: uppercase; letter-spacing: .12em; }}
  h1 {{ font-size: 34px; font-weight: 800; margin: 0 0 10px; letter-spacing: -0.025em; line-height: 1.1; }}
  .hero p {{ margin: 0; color: var(--text-2); font-size: 15px; line-height: 1.6; max-width: 52ch; }}

  .stat-row {{ display: flex; flex-wrap: wrap; gap: 0; margin-top: 24px; border-top: 1px solid var(--line); }}
  .stat {{ flex: 1; min-width: 130px; padding: 14px 18px 0 0; border-right: 1px solid var(--line); }}
  .stat:last-child {{ border-right: none; }}
  .stat .k {{ font-family: var(--mono); font-size: 10.5px; color: var(--text-3); text-transform: uppercase; letter-spacing: .09em; margin-bottom: 5px; }}
  .stat .v {{ font-family: var(--mono); font-size: 19px; font-weight: 600; letter-spacing: -0.01em; }}
  .stat .v.ok {{ color: var(--ok); }}

  .section {{ margin-bottom: 34px; }}
  .section-head {{
    display: flex; align-items: baseline; justify-content: space-between;
    font-family: var(--mono); font-size: 11px; color: var(--text-3);
    text-transform: uppercase; letter-spacing: .1em; margin-bottom: 12px;
  }}

  .kv-list {{ border-top: 1px solid var(--line); }}
  .kv-row {{
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 2px; border-bottom: 1px solid var(--line);
  }}
  .kv-row .k {{ font-size: 14px; color: var(--text-2); }}
  .kv-row .v {{ font-family: var(--mono); font-size: 13.5px; font-weight: 500; }}

  .strip {{ display: flex; gap: 2px; height: 30px; align-items: stretch; }}
  .strip .seg {{ flex: 1; background: var(--seg-color, var(--ok)); opacity: var(--seg-op, 1); border-radius: 1px; }}
  .strip-foot {{ display: flex; justify-content: space-between; font-family: var(--mono); font-size: 10.5px; color: var(--text-3); margin-top: 7px; }}

  .foot {{
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
    border-top: 1px solid var(--line); padding-top: 18px; margin-top: 8px;
    font-family: var(--mono); font-size: 11.5px; color: var(--text-3);
  }}
  .foot b {{ color: var(--text-2); font-weight: 500; }}
  .refresh-txt {{ display: flex; align-items: center; gap: 7px; }}
  .refresh-txt .rdot {{ width: 5px; height: 5px; border-radius: 50%; background: var(--text-3); animation: blink 1.4s steps(1) infinite; }}
  @keyframes blink {{ 0%,49% {{ opacity: 1; }} 50%,100% {{ opacity: .25; }} }}

  @media (max-width: 560px) {{
    h1 {{ font-size: 27px; }}
    .stat {{ min-width: 45%; padding-bottom: 12px; }}
  }}
</style>
</head>
<body>
  <div class="page">

    <div class="topbar">
      <div class="mark">
        <span class="sq">S</span>
        <span class="name">SMITH ERP</span>
        <span class="div"></span>
        <span class="sub"><a href="/api/health">Status</a> &middot; Database</span>
      </div>
      <div class="clock">{timestamp}</div>
    </div>

    <div class="hero">
      <div class="hero-top">
        <span class="dot live"></span>
        <span class="hero-eyebrow">{hero_eyebrow}</span>
      </div>
      <h1>{status_title}</h1>
      <p>{status_subtitle}</p>

      <div class="stat-row">
        <div class="stat"><div class="k">Latensi</div><div class="v ok">{latency_ms}</div></div>
        <div class="stat"><div class="k">Ukuran Data</div><div class="v">{db_size}</div></div>
        <div class="stat"><div class="k">Jumlah Tabel</div><div class="v">{table_count}</div></div>
        <div class="stat"><div class="k">Koneksi Aktif</div><div class="v">{active_connections}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><span>Detail Mesin Database</span></div>
      <div class="kv-list">
        {detail_rows}
      </div>
    </div>

    <div class="section">
      <div class="section-head"><span>Riwayat 24 Jam</span><span>setiap ~16 menit</span></div>
      <div class="strip">
        {uptime_segments}
      </div>
      <div class="strip-foot"><span>−24j</span><span>sekarang</span></div>
    </div>

    <div class="foot">
      <div>Uptime 24 jam <b>{uptime_pct}</b> &nbsp;·&nbsp; {sample_count} sampel</div>
      <div class="refresh-txt"><span class="rdot"></span><span id="countdown">memperbarui dalam 15dtk</span></div>
    </div>

  </div>
<script>
  (function () {{
    var el = document.getElementById('countdown');
    var n = 15;
    setInterval(function () {{
      n -= 1;
      if (n < 0) {{ location.reload(); return; }}
      el.textContent = 'memperbarui dalam ' + n + 'dtk';
    }}, 1000);
  }})();
</script>
</body>
</html>"""


@health_bp.route('/database', methods=['GET'])
def database_status_page():
    """Public-safe database status page, same content-negotiation pattern
    as /health: JSON for monitoring tools, styled HTML for browsers. Never
    exposes the connection string, raw exception text, or which physical
    database is live (erp_db vs erp_db_v2) - only structural, safe-to-share
    numbers (size, table count, connection count, latency)."""
    from models import db as _db
    from sqlalchemy import text as _sql_text

    info = {'connected': False, 'latency_ms': None, 'engine': None, 'size_bytes': None,
            'table_count': None, 'active_connections': None, 'max_connections': None}

    t0 = time.perf_counter()
    try:
        _db.session.execute(_sql_text('SELECT 1'))
        info['connected'] = True
        info['latency_ms'] = round((time.perf_counter() - t0) * 1000, 1)

        version_row = _db.session.execute(_sql_text("SHOW server_version")).scalar()
        info['engine'] = f"PostgreSQL {version_row}" if version_row else "PostgreSQL"

        info['size_bytes'] = _db.session.execute(_sql_text("SELECT pg_database_size(current_database())")).scalar()

        info['table_count'] = _db.session.execute(_sql_text(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
        )).scalar()

        info['active_connections'] = _db.session.execute(_sql_text(
            "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
        )).scalar()

        max_conn_row = _db.session.execute(_sql_text("SHOW max_connections")).scalar()
        info['max_connections'] = int(max_conn_row) if max_conn_row else None
    except Exception:
        info['connected'] = False

    def _human_size(num_bytes):
        if num_bytes is None:
            return None
        size = float(num_bytes)
        for unit in ('B', 'KB', 'MB', 'GB', 'TB'):
            if size < 1024:
                return f"{size:.1f} {unit}" if unit != 'B' else f"{int(size)} {unit}"
            size /= 1024
        return f"{size:.1f} PB"

    payload = {
        'status': 'healthy' if info['connected'] else 'unhealthy',
        'timestamp': get_local_now().isoformat(),
        'connected': info['connected'],
        'latency_ms': info['latency_ms'],
        'engine': info['engine'],
        'size_human': _human_size(info['size_bytes']),
        'table_count': info['table_count'],
        'active_connections': info['active_connections'],
        'max_connections': info['max_connections'],
    }

    if not _wants_html():
        return jsonify(payload), 200 if info['connected'] else 503

    history = _load_uptime_history(hours=24, buckets=90)

    seg_html = []
    if history['bars']:
        for ratio in history['bars']:
            if ratio >= 0.999:
                color, op = 'var(--ok)', 1
            elif ratio >= 0.5:
                color, op = 'var(--warn)', 1
            else:
                color, op = 'var(--bad)', 1
            seg_html.append(f'<span class="seg" style="--seg-color:{color};--seg-op:{op}"></span>')
    else:
        seg_html.append('<span style="color:var(--text-3);font-family:var(--mono);font-size:11px;">belum ada data</span>')

    detail_defs = [
        ('Engine', info['engine'] or 'N/A'),
        ('Latensi koneksi', f"{info['latency_ms']}ms" if info['latency_ms'] is not None else 'N/A'),
        ('Ukuran data', payload['size_human'] or 'N/A'),
        ('Jumlah tabel', info['table_count'] if info['table_count'] is not None else 'N/A'),
        ('Koneksi aktif', f"{info['active_connections']} / {info['max_connections']}" if info['active_connections'] is not None and info['max_connections'] else (info['active_connections'] if info['active_connections'] is not None else 'N/A')),
    ]
    detail_rows = "\n        ".join([
        f'<div class="kv-row"><span class="k">{k}</span><span class="v">{v}</span></div>'
        for k, v in detail_defs
    ])

    from urllib.parse import quote as _urlquote
    favicon_emoji = "\U0001F7E2" if info['connected'] else "\U0001F534"
    favicon_svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
        f"<text y='.9em' font-size='90'>{favicon_emoji}</text></svg>"
    )
    html = _DATABASE_PAGE_TEMPLATE.format(
        favicon=_urlquote(favicon_svg),
        status_color="--ok" if info['connected'] else "--bad",
        hero_eyebrow="Database tersambung" if info['connected'] else "Database tidak dapat dijangkau",
        status_title="Database Operational" if info['connected'] else "Database Unreachable",
        status_subtitle=(
            "Koneksi ke database utama berjalan normal, query dasar merespons dalam batas wajar."
            if info['connected'] else
            "Backend tidak dapat menyambung ke database saat ini. Tim teknis sudah diberi tahu."
        ),
        latency_ms=(f"{info['latency_ms']}ms" if info['latency_ms'] is not None else "N/A"),
        db_size=payload['size_human'] or "N/A",
        table_count=(info['table_count'] if info['table_count'] is not None else "N/A"),
        active_connections=(info['active_connections'] if info['active_connections'] is not None else "N/A"),
        detail_rows=detail_rows,
        uptime_segments="".join(seg_html),
        uptime_pct=(f"{history['uptime_pct']}%" if history['uptime_pct'] is not None else "N/A"),
        sample_count=history['sample_count'],
        timestamp=get_local_now().strftime('%d %b %Y, %H:%M:%S'),
    )
    return Response(html, status=200 if info['connected'] else 503, mimetype='text/html')


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
