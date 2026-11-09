import os


TOKEN = {'X-Ingest-Token': 'tok-123'}


def _prep(monkeypatch, collector=False):
    monkeypatch.setenv('FINGERPRINT_INGEST_TOKEN', 'tok-123')
    if collector:
        monkeypatch.setenv('FINGERPRINT_COLLECTOR_URL', 'https://api.example.test')
    else:
        monkeypatch.delenv('FINGERPRINT_COLLECTOR_URL', raising=False)


def test_broker_flow_request_claim_report(client, auth_headers, db_session, monkeypatch):
    _prep(monkeypatch)
    st = client.get('/api/hr/fingerprint/refresh/status', headers=auth_headers).get_json()
    assert st['status'] == 'idle' and st['collector'] is False
    r = client.post('/api/hr/fingerprint/refresh', headers=auth_headers).get_json()
    assert r['status'] == 'pending'
    again = client.post('/api/hr/fingerprint/refresh', headers=auth_headers).get_json()
    assert again['status'] == 'pending' and again['id'] == r['id']          # tidak menumpuk permintaan
    assert client.get('/api/hr/fingerprint/refresh/pending').status_code == 401
    assert client.get('/api/hr/fingerprint/refresh/pending', headers={'X-Ingest-Token': 'salah'}).status_code == 401
    claim = client.get('/api/hr/fingerprint/refresh/pending', headers=TOKEN).get_json()
    assert claim['id'] == r['id']
    assert client.get('/api/hr/fingerprint/refresh/pending', headers=TOKEN).get_json()['id'] is None   # hanya satu pengambil
    assert client.get('/api/hr/fingerprint/refresh/status', headers=auth_headers).get_json()['status'] == 'running'
    res = client.post('/api/hr/fingerprint/refresh/result', headers=TOKEN, json={'id': claim['id'], 'ok': True, 'message': 'ok', 'new_logs': 7}).get_json()
    assert res['recorded'] is True
    done = client.get('/api/hr/fingerprint/refresh/status', headers=auth_headers).get_json()
    assert done['status'] == 'done' and done['new_logs'] == 7
    cool = client.post('/api/hr/fingerprint/refresh', headers=auth_headers).get_json()
    assert cool['status'] == 'done' and 'baru saja' in cool['message']          # cooldown


def test_failure_message_is_friendly_and_wrong_id_ignored(client, auth_headers, db_session, monkeypatch):
    _prep(monkeypatch)
    rid = client.post('/api/hr/fingerprint/refresh', headers=auth_headers).get_json()['id']
    client.get('/api/hr/fingerprint/refresh/pending', headers=TOKEN)
    assert client.post('/api/hr/fingerprint/refresh/result', headers=TOKEN, json={'id': rid + 1, 'ok': True}).get_json()['recorded'] is False
    client.post('/api/hr/fingerprint/refresh/result', headers=TOKEN, json={'id': rid, 'ok': False, 'message': 'GAGAL ... ZKNetworkError: [Errno 32] Broken pipe'})
    st = client.get('/api/hr/fingerprint/refresh/status', headers=auth_headers).get_json()
    assert st['status'] == 'failed' and 'tidak merespons' in st['message'] and 'Broken pipe' not in st['message']


def test_stuck_request_expires(client, auth_headers, db_session, monkeypatch):
    from datetime import datetime, timedelta
    from utils import fingerprint_refresh as fr
    _prep(monkeypatch)
    client.post('/api/hr/fingerprint/refresh', headers=auth_headers)
    s = fr.load_state(); s['requested_at'] = s['updated_at'] = (datetime.utcnow() - timedelta(minutes=10)).isoformat() + 'Z'; fr.save_state(s)
    st = client.get('/api/hr/fingerprint/refresh/status', headers=auth_headers).get_json()
    assert st['status'] == 'failed' and 'kantor' in st['message']
    assert client.post('/api/hr/fingerprint/refresh', headers=auth_headers).get_json()['status'] == 'pending'   # tombol bisa dipakai lagi


def test_collector_runs_local_pull_without_touching_device(app, client, auth_headers, db_session, monkeypatch):
    from utils import fingerprint_refresh as fr
    _prep(monkeypatch, collector=True)
    calls = []
    monkeypatch.setattr(fr, 'pull_from_device', lambda: calls.append(1) or (True, 'Data absensi diperbarui.', 3))
    r = client.post('/api/hr/fingerprint/refresh', headers=auth_headers).get_json()
    import time
    for _ in range(40):
        st = client.get('/api/hr/fingerprint/refresh/status', headers=auth_headers).get_json()
        if st['status'] == 'done':
            break
        time.sleep(0.1)
    assert st['status'] == 'done' and st['new_logs'] == 3 and calls == [1] and st['collector'] is True


def test_pull_parses_script_output(monkeypatch):
    import subprocess
    from utils import fingerprint_refresh as fr
    class P: stdout = '[2026-11-09 08:00] OK: pengguna alat 352 (baru 0), log di alat 91960, diperiksa 62, log baru 27, 107 dtk.\n'; stderr = ''
    monkeypatch.setattr(subprocess, 'run', lambda *a, **k: P)
    assert fr.pull_from_device() == (True, 'Data absensi diperbarui.', 27)
    class Q: stdout = '[2026-11-09 08:00] GAGAL tersambung/membaca 192.168.0.85:4370 - ZKNetworkError: [Errno 32] Broken pipe\n'; stderr = ''
    monkeypatch.setattr(subprocess, 'run', lambda *a, **k: Q)
    ok, msg, n = fr.pull_from_device()
    assert ok is False and 'Broken pipe' in msg and n is None
