def _emp(db_session, num, name, fid=None):
    from models.hr import Employee
    e = Employee(employee_number=num, first_name=name, last_name='', full_name=name, fingerprint_id=fid, status='active')
    db_session.add(e); db_session.commit()
    return e


def test_assign_fingerprint_id_and_uniqueness(client, auth_headers, db_session):
    a = _emp(db_session, 'EMP-T1', 'Satu', '77'); b = _emp(db_session, 'EMP-T2', 'Dua')
    r = client.put(f'/api/hr/employees/{b.id}', json={'fingerprint_id': '77'}, headers=auth_headers)
    assert r.status_code == 400
    r = client.put(f'/api/hr/employees/{b.id}', json={'fingerprint_id': '78', 'last_name': ''}, headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    d = client.get(f'/api/hr/employees/{b.id}', headers=auth_headers).get_json()['employee']
    assert d['fingerprint_id'] == '78' and d['full_name'] == 'Dua'
    assert client.put(f'/api/hr/employees/{b.id}', json={'fingerprint_id': ''}, headers=auth_headers).status_code == 200
    assert client.get('/api/hr/fingerprint/users/options', headers=auth_headers).status_code == 200
