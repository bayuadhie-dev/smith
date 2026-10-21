"""
Validasi shared-secret untuk endpoint yang dipanggil crontab server sendiri
(bukan user login) - mis. sync Accurate, exchange rate, machine-health
check. @jwt_required() tidak cocok di sini karena pemanggilnya curl polos
dari cron, tanpa sesi user.
"""
from functools import wraps
from flask import request, jsonify, current_app


def require_cron_secret(fn):
    """Decorator: tolak request kalau header X-Cron-Secret kosong/salah,
    atau kalau CRON_SECRET_TOKEN belum di-set di server (fail closed,
    bukan fail open - token kosong tidak pernah dianggap valid)."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        expected = current_app.config.get('CRON_SECRET_TOKEN') or ''
        provided = request.headers.get('X-Cron-Secret') or ''
        if not expected or provided != expected:
            return jsonify({'error': 'Unauthorized - invalid or missing X-Cron-Secret'}), 401
        return fn(*args, **kwargs)
    return wrapper
