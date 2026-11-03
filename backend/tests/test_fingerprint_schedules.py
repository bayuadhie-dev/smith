from datetime import date

from models import Employee, FingerprintUser, AttendanceSchedule


def _emp(db_session, num, first, last, dev):
    e = Employee(employee_number=num, first_name=first, last_name=last, full_name=f'{first} {last}', status='active',
                 hire_date=date(2024, 1, 1), fingerprint_id=dev)
    db_session.add(e)
    return e


def _logs(client, headers, rows):
    r = client.post('/api/hr/fingerprint/logs/import', headers=headers, json={'logs': [{'user_id': u, 'timestamp': t} for u, t in rows]})
    assert r.status_code == 200, r.get_json()


def _day(client, headers, dev, d):
    r = client.get(f'/api/hr/fingerprint/attendance?date_from={d}&date_to={d}&include_unmapped=1', headers=headers).get_json()
    return next(x for x in r['days'] if x['device_user_id'] == dev)


def _mk_schedule(client, headers, name='Shift 1 Uji'):
    days = {str(i): {'start': '07:00', 'end': '15:00', 'break': 30} for i in range(5)}
    days['4']['break'] = 60
    days['5'] = {'start': '07:00', 'end': '10:00', 'break': 0}
    r = client.post('/api/hr/fingerprint/schedules', headers=headers, json={'name': name, 'days': days, 'late_tolerance_minutes': 10, 'early_tolerance_minutes': 10})
    assert r.status_code == 201, r.get_json()
    return r.get_json()['id']


def test_schedule_validation_and_assignment(client, auth_headers, db_session):
    bad = client.post('/api/hr/fingerprint/schedules', headers=auth_headers, json={'name': 'X', 'days': {'0': {'start': '15:00', 'end': '07:00', 'break': 30}}})
    assert bad.status_code == 400
    assert client.post('/api/hr/fingerprint/schedules', headers=auth_headers, json={'name': 'X', 'days': {}}).status_code == 400
    sid = _mk_schedule(client, auth_headers)
    assert client.post('/api/hr/fingerprint/schedules', headers=auth_headers, json={'name': 'Shift 1 Uji', 'days': {'0': {'start': '07:00', 'end': '15:00'}}}).status_code == 400
    client.post('/api/hr/fingerprint/users/import', headers=auth_headers, json={'users': [{'user_id': '31', 'name': 'Uji Jadwal'}]})
    r = client.post('/api/hr/fingerprint/schedules/assign', headers=auth_headers, json={'schedule_id': sid, 'device_user_ids': ['31']})
    assert r.get_json()['updated'] == 1
    lst = client.get('/api/hr/fingerprint/schedules', headers=auth_headers).get_json()
    assert next(s for s in lst['schedules'] if s['id'] == sid)['assigned'] == 1


def test_schedule_drives_target_late_and_early(client, auth_headers, db_session):
    _emp(db_session, 'S1', 'Rina', 'Lestari', '41'); db_session.commit()
    sid = _mk_schedule(client, auth_headers)
    client.post('/api/hr/fingerprint/users/import', headers=auth_headers, json={'users': [{'user_id': '41', 'name': 'Rina'}]})
    client.post('/api/hr/fingerprint/schedules/assign', headers=auth_headers, json={'schedule_id': sid, 'device_user_ids': ['41']})
    _logs(client, auth_headers, [
        ('41', '2026-10-05T07:30:00'), ('41', '2026-10-05T15:00:00'),    # Senin: terlambat 30, jam bersih 7:00 vs target 7:30
        ('41', '2026-10-06T07:00:00'), ('41', '2026-10-06T12:00:00'),    # Selasa: pulang cepat 180 menit
        ('41', '2026-10-09T07:00:00'), ('41', '2026-10-09T15:00:00'),    # Jumat: istirahat 60 -> 7:00 = target
        ('41', '2026-10-10T07:00:00'), ('41', '2026-10-10T10:00:00')])   # Sabtu: jadwal 3 jam
    a = _day(client, auth_headers, '41', '2026-10-05')
    assert a['late_minutes'] == 30 and a['target_minutes'] == 450 and a['net_minutes'] == 420 and a['sched_start'] == '07:00'
    b = _day(client, auth_headers, '41', '2026-10-06')
    assert b['early_minutes'] == 180 and b['early_excused'] is False and b['net_minutes'] == 300
    c = _day(client, auth_headers, '41', '2026-10-09')
    assert c['target_minutes'] == 420 and c['diff_minutes'] == 0 and c['late_minutes'] == 0
    d = _day(client, auth_headers, '41', '2026-10-10')
    assert d['target_minutes'] == 180 and d['diff_minutes'] == 0


def test_early_leave_needs_hrd_letter_and_absence_adjustments(client, auth_headers, db_session):
    e = _emp(db_session, 'S2', 'Tono', 'Wijaya', '42'); db_session.commit()
    sid = _mk_schedule(client, auth_headers, 'Shift 1 B')
    client.post('/api/hr/fingerprint/users/import', headers=auth_headers, json={'users': [{'user_id': '42', 'name': 'Tono'}]})
    client.post('/api/hr/fingerprint/schedules/assign', headers=auth_headers, json={'schedule_id': sid, 'device_user_ids': ['42']})
    _logs(client, auth_headers, [('42', '2026-10-06T07:00:00'), ('42', '2026-10-06T11:00:00'),
                                 ('43', '2026-10-07T07:00:00'), ('43', '2026-10-07T12:00:00'), ('43', '2026-10-07T15:00:00'), ('43', '2026-10-08T07:00:00'), ('43', '2026-10-08T15:00:00')])
    no_letter = client.post('/api/hr/fingerprint/adjustments', headers=auth_headers, json={'employee_id': e.id, 'date_from': '2026-10-06', 'adj_type': 'izin_pulang_cepat'})
    assert no_letter.status_code == 400 and 'surat' in no_letter.get_json()['error'].lower()
    ok = client.post('/api/hr/fingerprint/adjustments', headers=auth_headers, json={'employee_id': e.id, 'date_from': '2026-10-06', 'adj_type': 'izin_pulang_cepat', 'letter_number': 'HRD/045/X/2026', 'note': 'Periksa dokter'})
    assert ok.status_code == 201
    r = _day(client, auth_headers, '42', '2026-10-06')
    assert r['early_excused'] is True and r['early_minutes'] == 240
    ppl = client.get('/api/hr/fingerprint/attendance?date_from=2026-10-06&date_to=2026-10-06', headers=auth_headers).get_json()['people']
    p = next(x for x in ppl if x['device_user_id'] == '42')
    assert p['early_unexcused_count'] == 0 and p['short_excused_minutes'] > 0 and p['diff_minutes'] == 0

    # tidak ada cap -> cuti sah
    assert _day(client, auth_headers, '42', '2026-10-07')['status'] == 'tidak_ada_cap'
    client.post('/api/hr/fingerprint/adjustments', headers=auth_headers, json={'employee_id': e.id, 'date_from': '2026-10-07', 'date_to': '2026-10-07', 'adj_type': 'sakit', 'note': 'demam'})
    s = _day(client, auth_headers, '42', '2026-10-07')
    assert s['status'] == 'izin' and s['excused'] is True and s['adjustment_label'] == 'Sakit' and s['diff_minutes'] == 0

    # lupa cap pulang -> dikoreksi jadi hadir
    _logs(client, auth_headers, [('42', '2026-10-08T07:00:00')])
    assert _day(client, auth_headers, '42', '2026-10-08')['status'] == 'tidak_lengkap'
    assert client.post('/api/hr/fingerprint/adjustments', headers=auth_headers, json={'employee_id': e.id, 'date_from': '2026-10-08', 'adj_type': 'lupa_cap'}).status_code == 400
    client.post('/api/hr/fingerprint/adjustments', headers=auth_headers, json={'employee_id': e.id, 'date_from': '2026-10-08', 'adj_type': 'lupa_cap', 'corrected_out': '15:00', 'note': 'lupa cap'})
    f = _day(client, auth_headers, '42', '2026-10-08')
    assert f['status'] == 'hadir' and f['last'] == '15:00'


def test_special_holiday_day_detail_and_pdf(client, auth_headers, db_session):
    e = _emp(db_session, 'S3', 'Dewi', 'Anggraini', '44'); db_session.commit()
    sid = _mk_schedule(client, auth_headers, 'Shift 1 C')
    client.post('/api/hr/fingerprint/users/import', headers=auth_headers, json={'users': [{'user_id': '44', 'name': 'Dewi'}]})
    client.post('/api/hr/fingerprint/schedules/assign', headers=auth_headers, json={'schedule_id': sid, 'device_user_ids': ['44']})
    _logs(client, auth_headers, [('44', '2026-10-12T07:00:00'), ('44', '2026-10-12T07:00:30'), ('44', '2026-10-12T15:00:00'),
                                 ('44', '2026-10-13T07:00:00'), ('44', '2026-10-13T15:00:00'), ('44', '2026-10-13T15:10:00')])
    assert client.post('/api/hr/fingerprint/adjustments', headers=auth_headers, json={'adj_type': 'libur_khusus', 'date_from': '2026-10-14', 'note': 'Cuti bersama'}).status_code == 201
    h = client.get('/api/hr/fingerprint/attendance?date_from=2026-10-14&date_to=2026-10-14', headers=auth_headers).get_json()
    assert h['special_holidays'] == {'2026-10-14': 'Cuti bersama'}
    assert next(x for x in h['days'] if x['device_user_id'] == '44')['status'] == 'libur'
    det = client.get('/api/hr/fingerprint/attendance/day?date=2026-10-12&device_user_id=44', headers=auth_headers).get_json()
    assert len(det['punches']) == 3 and [p['counted'] for p in det['punches']] == [True, False, True]
    assert any('Jadwal' in x for x in det['explain'])
    pdf = client.get('/api/hr/fingerprint/attendance/export?date_from=2026-10-12&date_to=2026-10-13&format=pdf', headers=auth_headers)
    assert pdf.status_code == 200 and pdf.data[:4] == b'%PDF'
    pdf2 = client.get(f'/api/hr/fingerprint/attendance/export?date_from=2026-10-12&date_to=2026-10-13&format=pdf&employee_id={e.id}', headers=auth_headers)
    assert pdf2.status_code == 200 and pdf2.data[:4] == b'%PDF'
    sug = client.get('/api/hr/fingerprint/schedules/people', headers=auth_headers)
    assert sug.status_code == 200
