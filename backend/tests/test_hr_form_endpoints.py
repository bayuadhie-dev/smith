from datetime import date


def _emp(db_session, code='EMP-F1'):
    from models import Employee
    e = Employee(employee_number=code, first_name='Tes', last_name='Form', full_name='Tes Form', email=f'{code}@x.com', hire_date=date.today(), employment_type='permanent', status='active')
    db_session.add(e); db_session.commit()
    return e


def test_leave_get_and_put(client, auth_headers, db_session):
    e = _emp(db_session)
    r = client.post('/api/hr/leaves', headers=auth_headers, json={
        'employee_id': e.id, 'leave_type': 'annual', 'start_date': '2026-11-02', 'end_date': '2026-11-04', 'total_days': 3, 'reason': 'Liburan'})
    assert r.status_code == 201, r.get_json()
    lid = r.get_json()['leave_id']
    d = client.get(f'/api/hr/leaves/{lid}', headers=auth_headers).get_json()
    assert d['employee_id'] == e.id and d['total_days'] == 3 and d['reason'] == 'Liburan' and d['start_date'] == '2026-11-02'
    r = client.put(f'/api/hr/leaves/{lid}', headers=auth_headers, json={'end_date': '2026-11-05', 'total_days': 4, 'reason': 'Diperpanjang'})
    assert r.status_code == 200
    d = client.get(f'/api/hr/leaves/{lid}', headers=auth_headers).get_json()
    assert d['total_days'] == 4 and d['end_date'] == '2026-11-05'
    assert client.put(f'/api/hr/leaves/{lid}', headers=auth_headers, json={'start_date': '2026-12-01'}).status_code == 400
    assert client.get('/api/hr/leaves/99999', headers=auth_headers).status_code == 404


def test_leave_processed_cannot_be_edited(client, auth_headers, db_session):
    from models import Leave
    e = _emp(db_session, 'EMP-F2')
    r = client.post('/api/hr/leaves', headers=auth_headers, json={
        'employee_id': e.id, 'leave_type': 'sick', 'start_date': '2026-11-02', 'end_date': '2026-11-02', 'total_days': 1, 'reason': 'Sakit'})
    lid = r.get_json()['leave_id']
    db_session.get(Leave, lid).status = 'approved'; db_session.commit()
    assert client.put(f'/api/hr/leaves/{lid}', headers=auth_headers, json={'total_days': 2}).status_code == 400


def test_attendance_create_get_put(client, auth_headers, db_session):
    from models import Attendance
    e = _emp(db_session, 'EMP-F3')
    r = client.post('/api/hr/attendance', headers=auth_headers, json={
        'employee_id': e.id, 'attendance_date': '2026-11-02', 'status': 'present',
        'clock_in': '2026-11-02T08:00:00', 'clock_out': '2026-11-02T16:00:00', 'worked_hours': 8, 'overtime_hours': 1, 'notes': 'ok'})
    assert r.status_code == 201, r.get_json()
    aid = Attendance.query.filter_by(employee_id=e.id).first().id
    d = client.get(f'/api/hr/attendance/{aid}', headers=auth_headers).get_json()
    assert d['status'] == 'present' and d['overtime_hours'] == 1.0 and d['notes'] == 'ok' and d['clock_in'][11:16] == '08:00'
    r = client.put(f'/api/hr/attendance/{aid}', headers=auth_headers, json={
        'clock_out': '2026-11-02T17:00:00', 'worked_hours': 9, 'status': 'late', 'notes': 'koreksi'})
    assert r.status_code == 200, r.get_json()
    d = client.get(f'/api/hr/attendance/{aid}', headers=auth_headers).get_json()
    assert d['clock_out'][11:16] == '17:00' and d['worked_hours'] == 9.0 and d['status'] == 'late' and d['notes'] == 'koreksi'
    assert client.put('/api/hr/attendance/99999', headers=auth_headers, json={}).status_code == 404
