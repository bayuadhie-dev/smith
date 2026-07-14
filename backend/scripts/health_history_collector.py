"""
Health History Collector
=========================
Runs every minute via cron. Takes a snapshot of:
  - CPU / memory / disk usage
  - DB status
  - WhatsApp gateway status
  - Per-endpoint response time (avg + max), aggregated from the last
    minute of backend/logs/combined.log ACCESS lines

Appends the snapshot to backend/logs/health_history/health_YYYY-MM-DD.json
and deletes any daily file older than HISTORY_RETENTION_DAYS.

Designed to be run standalone (not inside the Flask app process), so it
uses its own lightweight app context only where needed (DB check).
"""
import os
import re
import sys
import json
import time
import glob
from datetime import datetime, timedelta

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

HISTORY_DIR = os.path.join(BACKEND_DIR, 'logs', 'health_history')
COMBINED_LOG = os.path.join(BACKEND_DIR, 'logs', 'combined.log')
HISTORY_RETENTION_DAYS = 30

# Matches: [2026-05-08 16:29:21] INFO [access:87] - ACCESS: 127.0.0.1 [User:6] - "GET /api/production/work-orders/232" 200 53.89ms
ACCESS_LINE_RE = re.compile(
    r'^\[(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\].*ACCESS: .*?"(?P<method>[A-Z]+) (?P<path>/\S*)" (?P<status>\d{3}) (?P<duration>[\d.]+)ms'
)

# Normalize numeric IDs in paths so /api/x/232 and /api/x/455 aggregate together
ID_SEGMENT_RE = re.compile(r'/\d+(?=/|$)')


def normalize_path(path):
    """Collapse numeric path segments into :id so per-endpoint stats aggregate sensibly."""
    path = path.split('?')[0]  # drop query string
    return ID_SEGMENT_RE.sub('/:id', path)


def collect_resources():
    import psutil
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    cpu = psutil.cpu_percent(interval=0.2)
    return {
        'cpu_percent': cpu,
        'memory_percent': mem.percent,
        'disk_percent': disk.percent,
    }


def collect_db_status(app):
    try:
        from models import db as _db
        from sqlalchemy import text
        with app.app_context():
            _db.session.execute(text('SELECT 1'))
        return 'healthy'
    except Exception:
        return 'error'

def collect_whatsapp_status(app):
    try:
        import requests as req
        from utils.helpers import get_setting_value
        with app.app_context():
            owa_url = get_setting_value('notifications.whatsapp_api_url', '')
            owa_token = get_setting_value('notifications.whatsapp_token', '')
        mat = re.search(r'(https?://[^/]+)/api/sessions/([^/]+)', owa_url or '')
        if not mat:
            return 'not_configured'
        base, sid = mat.group(1), mat.group(2)
        resp = req.get(f"{base}/api/sessions/{sid}", headers={'X-API-Key': owa_token}, timeout=4)
        data = resp.json()
        return 'healthy' if data.get('status') == 'ready' else 'degraded'
    except Exception:
        return 'error'


def collect_response_times(window_start, window_end):
    """Parse the last minute of combined.log and aggregate response time per normalized endpoint."""
    endpoint_stats = {}  # path -> {'count', 'total_ms', 'max_ms'}
    if not os.path.exists(COMBINED_LOG):
        return {}

    try:
        with open(COMBINED_LOG, 'rb') as f:
            f.seek(0, os.SEEK_END)
            file_size = f.tell()
            read_size = min(file_size, 2 * 1024 * 1024)
            f.seek(file_size - read_size)
            chunk = f.read().decode('utf-8', errors='replace')
    except Exception:
        return {}

    for line in chunk.splitlines():
        m = ACCESS_LINE_RE.match(line)
        if not m:
            continue
        try:
            ts = datetime.strptime(m.group('ts'), '%Y-%m-%d %H:%M:%S')
        except ValueError:
            continue
        if not (window_start <= ts < window_end):
            continue

        path = normalize_path(m.group('path'))
        endpoint = f"{m.group('method')} {path}"
        duration = float(m.group('duration'))

        stats = endpoint_stats.setdefault(endpoint, {'count': 0, 'total_ms': 0.0, 'max_ms': 0.0})
        stats['count'] += 1
        stats['total_ms'] += duration
        stats['max_ms'] = max(stats['max_ms'], duration)

    return {
        ep: {
            'count': s['count'],
            'avg_ms': round(s['total_ms'] / s['count'], 1),
            'max_ms': round(s['max_ms'], 1),
        }
        for ep, s in endpoint_stats.items()
    }


def append_snapshot(snapshot):
    os.makedirs(HISTORY_DIR, exist_ok=True)
    today_str = datetime.now().strftime('%Y-%m-%d')
    file_path = os.path.join(HISTORY_DIR, f'health_{today_str}.json')

    data = []
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
        except (json.JSONDecodeError, IOError):
            data = []

    data.append(snapshot)

    tmp_path = file_path + '.tmp'
    with open(tmp_path, 'w') as f:
        json.dump(data, f)
    os.replace(tmp_path, file_path)


def rotate_old_files():
    cutoff = datetime.now() - timedelta(days=HISTORY_RETENTION_DAYS)
    for path in glob.glob(os.path.join(HISTORY_DIR, 'health_*.json')):
        fname = os.path.basename(path)
        m = re.match(r'health_(\d{4}-\d{2}-\d{2})\.json', fname)
        if not m:
            continue
        try:
            file_date = datetime.strptime(m.group(1), '%Y-%m-%d')
        except ValueError:
            continue
        if file_date < cutoff:
            try:
                os.remove(path)
            except OSError:
                pass


def main():
    now = datetime.now()
    window_end = now.replace(second=0, microsecond=0)
    window_start = window_end - timedelta(minutes=1)

    from app import create_app
    app = create_app()

    snapshot = {
        'timestamp': now.isoformat(),
        'resources': collect_resources(),
        'database_status': collect_db_status(app),
        'whatsapp_status': collect_whatsapp_status(app),
        'response_times': collect_response_times(window_start, window_end),
    }
    append_snapshot(snapshot)
    rotate_old_files()


if __name__ == '__main__':
    main()
