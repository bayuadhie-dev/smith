"""Tombol "Perbarui data" Log Absensi.

Hanya server kantor yang bisa menjangkau mesin fingerprint. Rancangan:
- Server kantor (FINGERPRINT_COLLECTOR_URL terisi) menarik data langsung dari mesin lewat scripts/pull_fingerprint.py
  (HANYA MEMBACA) dan mendorongnya ke server broker.
- Server lain (VPS, tanpa FINGERPRINT_COLLECTOR_URL) hanya mencatat permintaan. Server kantor menanyakannya tiap beberapa
  detik lewat jalur keluar yang sudah dipakai untuk push, jadi tidak perlu jalur masuk ke jaringan kantor.
Status satu slot disimpan di system_settings (kunci fingerprint_refresh), tanpa tabel baru.
"""
import json
import os
import subprocess
import sys
import threading
from datetime import datetime, timedelta

from models import db
from models.settings import SystemSetting

KEY = 'fingerprint_refresh'
COOLDOWN_SECONDS = 30
STALE_RUNNING = timedelta(minutes=6)
STALE_PENDING = timedelta(minutes=5)
_local_lock = threading.Lock()


def _now():
    return datetime.utcnow()


def _iso(d):
    return d.isoformat() + 'Z' if d else None


def load_state():
    row = SystemSetting.query.filter_by(setting_key=KEY).first()
    try:
        return json.loads(row.setting_value) if row and row.setting_value else {}
    except ValueError:
        return {}


def save_state(state):
    row = SystemSetting.query.filter_by(setting_key=KEY).first()
    if not row:
        row = SystemSetting(setting_key=KEY, setting_category='integration', setting_name='Status perbarui data fingerprint',
                            data_type='json', is_editable=False)
        db.session.add(row)
    row.setting_value = json.dumps(state)
    db.session.commit()


def is_collector():
    return bool(os.getenv('FINGERPRINT_COLLECTOR_URL'))


def friendly(message):
    m = message or ''
    if 'Broken pipe' in m or 'ZKNetworkError' in m or 'timed out' in m or 'tersambung' in m:
        return ('Mesin fingerprint tidak merespons (sambungan terputus). Coba lagi beberapa menit lagi; '
                'kalau terus gagal, mesin mungkin perlu dinyalakan ulang oleh admin.')
    if 'Penarikan lain' in m:
        return 'Penarikan lain sedang berjalan. Coba lagi sebentar lagi.'
    return m or 'Penarikan gagal.'


def _expire(state):
    """Permintaan yang macet jangan menahan tombol selamanya."""
    try:
        at = datetime.fromisoformat((state.get('updated_at') or state.get('requested_at') or '').rstrip('Z'))
    except ValueError:
        return state
    limit = STALE_RUNNING if state.get('status') == 'running' else STALE_PENDING
    if state.get('status') in ('pending', 'running') and _now() - at > limit:
        state = dict(state, status='failed', message='Server kantor tidak menjawab. Pastikan server kantor menyala, lalu coba lagi.',
                     updated_at=_iso(_now()))
        save_state(state)
    return state


def public_state():
    from models import FingerprintLog
    state = _expire(load_state())
    last = db.session.query(db.func.max(FingerprintLog.punched_at)).scalar()
    out = {k: state.get(k) for k in ('id', 'status', 'message', 'requested_at', 'updated_at', 'finished_at', 'new_logs')}
    out['status'] = out.get('status') or 'idle'
    out['last_punch'] = last.isoformat() if last else None
    out['last_success_at'] = state.get('last_success_at')
    out['collector'] = is_collector()
    return out


def request_refresh(user_id, app):
    """Dipanggil tombol. Mengembalikan status terbaru (tidak menunggu penarikan selesai)."""
    state = _expire(load_state())
    if state.get('status') in ('pending', 'running'):
        return public_state()
    ok_at = state.get('last_success_at')
    if ok_at:
        try:
            if _now() - datetime.fromisoformat(ok_at.rstrip('Z')) < timedelta(seconds=COOLDOWN_SECONDS):
                return dict(public_state(), status='done', message='Data baru saja diperbarui.')
        except ValueError:
            pass
    rid = int(_now().timestamp() * 1000)
    save_state(dict(state, id=rid, status='pending', message='Menunggu penarikan dari mesin...', requested_by=user_id,
                    requested_at=_iso(_now()), updated_at=_iso(_now()), new_logs=None))
    if is_collector():
        threading.Thread(target=run_local_pull, args=(app, rid), daemon=True).start()
    return public_state()


def claim_pending():
    """Server kantor menanyakan: adakah permintaan? Kalau ada, tandai sedang berjalan (hanya satu pengambil)."""
    state = _expire(load_state())
    if state.get('status') != 'pending':
        return None
    save_state(dict(state, status='running', message='Menarik data dari mesin...', updated_at=_iso(_now())))
    return state.get('id')


def report_result(rid, ok, message, new_logs=None):
    state = load_state()
    if state.get('id') != rid:
        return False
    now = _iso(_now())
    state.update(status='done' if ok else 'failed', message=(message if ok else friendly(message)), updated_at=now, finished_at=now,
                 new_logs=new_logs)
    if ok:
        state['last_success_at'] = now
    save_state(state)
    return True


def _push_urls():
    url = os.getenv('FINGERPRINT_COLLECTOR_URL', '').strip()
    return [url] if url and 'localhost' not in url and '127.0.0.1' not in url else []


def pull_from_device():
    """Jalankan skrip tarik (read-only). Mengembalikan (ok, pesan, log_baru)."""
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cmd = [sys.executable, os.path.join(here, 'scripts', 'pull_fingerprint.py')]
    for u in _push_urls():
        cmd += ['--push', u]
    try:
        proc = subprocess.run(cmd, cwd=here, capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        return False, 'Penarikan melewati batas waktu 5 menit.', None
    lines = [l for l in (proc.stdout + '\n' + proc.stderr).splitlines() if l.startswith('[20')]
    last = lines[-1] if lines else ''
    if ' OK:' in last or any(' OK:' in l for l in lines):
        import re
        m = re.search(r'log baru (\d+)', ' '.join(l for l in lines if ' OK:' in l))
        return True, 'Data absensi diperbarui.', int(m.group(1)) if m else None
    msg = next((l for l in reversed(lines) if 'GAGAL' in l or 'dilewati' in l), last or (proc.stderr or '')[-200:])
    return False, msg, None


def run_local_pull(app, rid):
    with app.app_context():
        if not _local_lock.acquire(blocking=False):
            return
        try:
            state = load_state()
            if state.get('id') != rid:
                return
            save_state(dict(state, status='running', message='Menarik data dari mesin...', updated_at=_iso(_now())))
            ok, msg, n = pull_from_device()
            report_result(rid, ok, msg, n)
        except Exception as e:
            db.session.rollback()
            report_result(rid, False, f'{type(e).__name__}: {e}')
        finally:
            _local_lock.release()


def collector_tick(app):
    """Dijalankan terjadwal di server kantor: tanyakan broker, tarik kalau diminta, lapor hasilnya."""
    base = os.getenv('FINGERPRINT_COLLECTOR_URL', '').strip().rstrip('/')
    if not base:
        return
    import requests
    try:
        tok = os.getenv('FINGERPRINT_PUSH_TOKEN') or open(os.path.expanduser('~/.fingerprint_push_token')).read().strip()
        hdr = {'X-Ingest-Token': tok}
        r = requests.get(base + '/api/hr/fingerprint/refresh/pending', headers=hdr, timeout=15)
        r.raise_for_status()
        rid = r.json().get('id')
    except Exception:
        return
    if not rid or not _local_lock.acquire(blocking=False):
        return
    try:
        ok, msg, n = pull_from_device()
        requests.post(base + '/api/hr/fingerprint/refresh/result', json={'id': rid, 'ok': ok, 'message': msg, 'new_logs': n},
                      headers=hdr, timeout=30)
    except Exception:
        pass
    finally:
        _local_lock.release()
