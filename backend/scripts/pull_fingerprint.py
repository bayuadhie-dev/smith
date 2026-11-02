"""
Tarik absensi dari mesin fingerprint ZKTeco (HANYA MEMBACA) ke tabel fingerprint_logs.

Mesin tidak pernah diubah: skrip ini tidak memanggil disable_device, clear_attendance,
set_user, atau perintah tulis apa pun, jadi absensi dan ZKBio tetap berjalan normal.

Idempotent: cap yang sudah ada dilewati, aman dijalankan berulang.

Cron (server kantor), tiap hari 05.30:
    30 5 * * * cd /path/to/backend && venv/bin/python scripts/pull_fingerprint.py >> logs/pull_fingerprint.log 2>&1

Host/port mesin: argumen --host/--port atau variabel FINGERPRINT_HOST / FINGERPRINT_PORT
(bawaan 192.168.0.85:4370). Butuh paket pyzk.
"""
import argparse
import fcntl
import os
import sys
import time
from datetime import datetime, timedelta

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app import create_app
from models import db, FingerprintLog
from utils.fingerprint_sync import insert_new_logs, refresh_user_stats, upsert_users


def run(host, port, timeout, full):
    from zk import ZK

    lock = open('/tmp/pull_fingerprint.lock', 'w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print(f"[{datetime.now():%Y-%m-%d %H:%M}] Penarikan lain masih berjalan, dilewati.")
        return 0

    t0 = time.time()
    conn = None
    try:
        conn = ZK(host, port=port, timeout=timeout, ommit_ping=True).connect()
        serial = conn.get_serialnumber()
        users = conn.get_users()
        logs = conn.get_attendance()
    except Exception as e:
        print(f"[{datetime.now():%Y-%m-%d %H:%M}] GAGAL tersambung/membaca {host}:{port} - {type(e).__name__}: {e}")
        return 2
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass

    app = create_app()
    with app.app_context():
        try:
            created, updated = upsert_users([
                {'user_id': u.user_id, 'name': u.name, 'privilege': u.privilege, 'card': u.card} for u in users])
            last = db.session.query(db.func.max(FingerprintLog.punched_at)).scalar()
            cutoff = None if (full or not last) else last - timedelta(days=2)
            rows = [{'device_user_id': str(a.user_id), 'punched_at': a.timestamp, 'status': a.status,
                     'punch': a.punch, 'source_device': f'K20 {serial}'}
                    for a in logs if cutoff is None or a.timestamp >= cutoff]
            inserted = insert_new_logs(rows)
            refresh_user_stats()
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"[{datetime.now():%Y-%m-%d %H:%M}] GAGAL menyimpan - {type(e).__name__}: {e}")
            return 3
        print(f"[{datetime.now():%Y-%m-%d %H:%M}] OK: pengguna alat {len(users)} (baru {created}), log di alat {len(logs)}, "
              f"diperiksa {len(rows)}, log baru {inserted}, {time.time() - t0:.0f} dtk.")
    return 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--host', default=os.getenv('FINGERPRINT_HOST', '192.168.0.85'))
    ap.add_argument('--port', type=int, default=int(os.getenv('FINGERPRINT_PORT', '4370')))
    ap.add_argument('--timeout', type=int, default=30)
    ap.add_argument('--full', action='store_true', help='periksa semua log di alat, bukan hanya yang baru')
    a = ap.parse_args()
    sys.exit(run(a.host, a.port, a.timeout, a.full))
