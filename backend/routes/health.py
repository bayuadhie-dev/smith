"""
Health Check Endpoints for Docker and Monitoring
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from datetime import datetime
import redis
import json
import os
from utils.timezone import get_local_now, get_local_today

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health_check():
    """
    Basic health check endpoint
    ---
    tags:
      - Health
    summary: Basic health check
    description: Returns 200 if application is running
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
    return jsonify({
        'status': 'healthy',
        'timestamp': get_local_now().isoformat(),
        'service': 'ERP Backend',
        'version': '1.0.0'
    }), 200


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
        pm2 = subprocess.run(['pm2', 'jlist'], capture_output=True, text=True, timeout=5)
        procs = _json.loads(pm2.stdout) if pm2.returncode == 0 else []
        result['pm2'] = {'processes': [{
            'name': p.get('name'),
            'status': p.get('pm2_env', {}).get('status'),
            'restarts': p.get('pm2_env', {}).get('restart_time', 0),
            'uptime_ms': p.get('pm2_env', {}).get('pm_uptime'),
            'memory_mb': round(p.get('monit', {}).get('memory', 0) / 1024 / 1024, 1),
            'cpu': p.get('monit', {}).get('cpu', 0),
        } for p in procs]}
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
@jwt_required()
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
