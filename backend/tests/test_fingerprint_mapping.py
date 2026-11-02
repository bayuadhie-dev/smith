from models import Employee


def _emp(db_session, num, first, last):
    e = Employee(employee_number=num, first_name=first, last_name=last, full_name=f'{first} {last}', status='active',
                 hire_date=__import__('datetime').date(2024, 1, 1))
    db_session.add(e)
    return e


def test_import_suggest_accept_and_manual_map(client, auth_headers, db_session):
    a = _emp(db_session, 'E1', 'Budi', 'Santoso')
    b = _emp(db_session, 'E2', 'Siti', 'Rahayu')
    c = _emp(db_session, 'E3', 'Agus', 'Wijaya')
    db_session.commit()
    r = client.post('/api/hr/fingerprint/users/import', headers=auth_headers, json={'users': [
        {'user_id': '11', 'name': 'BUDI SANTOSO'}, {'user_id': '12', 'name': 'Santoso Budi'},
        {'user_id': '13', 'name': 'Siti Rahayuu'}, {'user_id': '14', 'name': 'Orang Lain'}]})
    assert r.status_code == 200 and r.get_json()['created'] == 4
    d = client.get('/api/hr/fingerprint/users', headers=auth_headers).get_json()
    by = {u['device_user_id']: u for u in d['users']}
    assert by['11']['suggestion']['kind'] == 'exact' and by['11']['suggestion']['id'] == a.id
    assert by['13']['suggestion']['kind'] == 'similar' and by['13']['suggestion']['id'] == b.id
    assert by['14']['status'] == 'none' and d['summary']['mapped'] == 0

    ok = client.post('/api/hr/fingerprint/users/accept-exact', headers=auth_headers).get_json()
    assert ok['mapped'] == 1  # hanya satu yang bisa dipetakan: ID 11 (12 bersaing ke karyawan yang sama)
    d = client.get('/api/hr/fingerprint/users', headers=auth_headers).get_json()
    by = {u['device_user_id']: u for u in d['users']}
    assert by['11']['status'] == 'mapped' and by['11']['employee']['id'] == a.id
    assert d['summary']['mapped'] == 1 and d['summary']['employees_without_id'] == 2

    # karyawan yang sudah dipetakan tidak bisa dipakai dua kali
    bad = client.put(f"/api/hr/fingerprint/users/{by['12']['id']}/map", headers=auth_headers, json={'employee_id': a.id})
    assert bad.status_code == 400
    good = client.put(f"/api/hr/fingerprint/users/{by['13']['id']}/map", headers=auth_headers, json={'employee_id': b.id})
    assert good.status_code == 200
    db_session.expire_all()
    assert db_session.get(Employee, b.id).fingerprint_id == '13'
    # lepas
    client.put(f"/api/hr/fingerprint/users/{by['13']['id']}/map", headers=auth_headers, json={'employee_id': None})
    db_session.expire_all()
    assert db_session.get(Employee, b.id).fingerprint_id is None
    # import ulang tidak menghapus pemetaan
    client.post('/api/hr/fingerprint/users/import', headers=auth_headers, json={'users': [{'user_id': '11', 'name': 'Budi Santoso', 'log_count': 40}]})
    db_session.expire_all()
    assert db_session.get(Employee, a.id).fingerprint_id == '11'
    assert client.get('/api/hr/fingerprint/users?filter=mapped', headers=auth_headers).get_json()['users'][0]['log_count'] == 40


def test_logs_import_is_idempotent(client, auth_headers, db_session):
    from models import FingerprintLog
    body = {'source_device': 'K20', 'logs': [
        {'user_id': '11', 'timestamp': '2026-10-01T07:00:01', 'status': 1, 'punch': 0},
        {'user_id': '11', 'timestamp': '2026-10-01T16:01:00', 'status': 1, 'punch': 1},
        {'user_id': '12', 'timestamp': '2026-10-01T07:05:00', 'status': 3, 'punch': 0}]}
    r1 = client.post('/api/hr/fingerprint/logs/import', headers=auth_headers, json=body).get_json()
    assert r1['inserted'] == 3
    r2 = client.post('/api/hr/fingerprint/logs/import', headers=auth_headers, json=body).get_json()
    assert r2['inserted'] == 0 and r2['skipped'] == 3
    assert FingerprintLog.query.count() == 3


def test_attendance_rules(client, auth_headers, db_session):
    from datetime import date
    e1 = _emp(db_session, 'A1', 'Rina', 'Lestari'); e1.fingerprint_id = '21'
    e2 = _emp(db_session, 'A2', 'Tono', 'Wijaya'); e2.fingerprint_id = '22'
    db_session.commit()
    logs = [  # Senin 2026-10-05
        ('21', '2026-10-05T07:00:05'), ('21', '2026-10-05T07:00:40'), ('21', '2026-10-05T16:05:00'),   # 9h05 span -> 8h05 net, dedupe ketukan ganda
        ('22', '2026-10-05T08:10:00'),                                                                  # satu cap
        ('21', '2026-10-06T07:00:00'), ('21', '2026-10-06T14:00:00'),                                  # 7h span -> 6h net -> kurang 2h
        ('22', '2026-10-06T07:00:00'), ('22', '2026-10-06T18:30:00'),                                  # 11h30 -> 10h30 -> lembur 2h30
        ('21', '2026-10-10T08:00:00'), ('21', '2026-10-10T12:00:00')]                                  # Sabtu: target 0, 4h = lembur
    client.post('/api/hr/fingerprint/logs/import', headers=auth_headers, json={'logs': [{'user_id': u, 'timestamp': t} for u, t in logs]})
    r = client.get('/api/hr/fingerprint/attendance?date_from=2026-10-05&date_to=2026-10-10', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    d = r.get_json()
    day = {(x['device_user_id'], x['date']): x for x in d['days']}
    a = day[('21', '2026-10-05')]
    assert a['punches'] == 2 and a['status'] == 'hadir' and a['net_minutes'] == 484 and a['diff_minutes'] == 0
    assert day[('22', '2026-10-05')]['status'] == 'tidak_lengkap'
    assert day[('21', '2026-10-06')]['diff_minutes'] == -120
    assert day[('22', '2026-10-06')]['diff_minutes'] == 150
    assert day[('21', '2026-10-10')]['net_minutes'] == 240 and day[('21', '2026-10-10')]['diff_minutes'] == 240
    assert day[('22', '2026-10-07')]['status'] == 'libur'  # tidak ada cap dari siapa pun -> libur
    ppl = {p['device_user_id']: p for p in d['people']}
    assert ppl['21']['present'] == 3 and ppl['21']['diff_minutes'] == 0 - 120 + 240
    assert client.get('/api/hr/fingerprint/attendance?date_from=2026-10-05&date_to=2027-03-31', headers=auth_headers).status_code == 400
    x = client.get('/api/hr/fingerprint/attendance/export?date_from=2026-10-05&date_to=2026-10-10', headers=auth_headers)
    assert x.status_code == 200 and 'spreadsheetml' in x.content_type


def test_ingest_requires_token_and_is_idempotent(client, db_session, monkeypatch):
    from models import FingerprintLog, FingerprintUser
    body = {'source_device': 'K20', 'users': [{'user_id': '5', 'name': 'Uji Ingest'}],
            'logs': [{'user_id': '5', 'timestamp': '2026-10-01T07:00:00', 'status': 1, 'punch': 0}]}
    monkeypatch.delenv('FINGERPRINT_INGEST_TOKEN', raising=False)
    assert client.post('/api/hr/fingerprint/ingest', json=body, headers={'X-Ingest-Token': ''}).status_code == 401
    monkeypatch.setenv('FINGERPRINT_INGEST_TOKEN', 'rahasia-uji')
    assert client.post('/api/hr/fingerprint/ingest', json=body, headers={'X-Ingest-Token': 'salah'}).status_code == 401
    r = client.post('/api/hr/fingerprint/ingest', json=body, headers={'X-Ingest-Token': 'rahasia-uji'})
    assert r.status_code == 200 and r.get_json()['logs_inserted'] == 1 and r.get_json()['users_created'] == 1
    r = client.post('/api/hr/fingerprint/ingest', json=body, headers={'X-Ingest-Token': 'rahasia-uji'})
    assert r.get_json()['logs_inserted'] == 0 and r.get_json()['users_created'] == 0
    assert FingerprintLog.query.count() == 1 and FingerprintUser.query.first().log_count == 1
