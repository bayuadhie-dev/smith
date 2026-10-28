def _machine(db_session, mtype='slitting'):
    from models import ConvertingMachine
    m = ConvertingMachine(code=f'T-{mtype}', name=f'Mesin {mtype}', machine_type=mtype, is_active=True)
    db_session.add(m); db_session.commit()
    return m


def test_slitting_totals_are_derived_from_rows_and_reach_dashboard(client, auth_headers, db_session):
    m = _machine(db_session)
    rows = [{'no_roll': '14', 'weight': 175.2, 'slitting': [17.5] * 10, 'loss': 2.4, 'total_weight': 172.8},
            {'no_roll': '15', 'weight': 100.0, 'slitting': [10] * 10, 'loss': 0.5, 'total_weight': 99.5}]
    r = client.post('/api/converting/production', headers=auth_headers, json={
        'production_date': '2026-10-27', 'shift': 1, 'machine_id': m.id, 'product_name': 'Stardec',
        'grade_a': 0, 'grade_b': 0, 'loss_kg': 0, 'machine_data': {'rows': rows}})
    assert r.status_code == 201, r.get_json()
    p = client.get('/api/converting/production?date=2026-10-27', headers=auth_headers).get_json()['productions'][0]
    assert p['grade_a'] == 272.3 and p['loss_kg'] == 2.9
    dash = client.get('/api/converting/dashboard?date=2026-10-27', headers=auth_headers).get_json()
    assert dash['summary']['total_good'] == 272.3


def test_other_machine_types_keep_their_own_grades(client, auth_headers, db_session):
    m = _machine(db_session, 'cutting')
    r = client.post('/api/converting/production', headers=auth_headers, json={
        'production_date': '2026-10-27', 'shift': 1, 'machine_id': m.id, 'grade_a': 50, 'grade_b': 2, 'loss_kg': 1,
        'machine_data': {'rows': [{'weight': 999, 'total_weight': 999, 'loss': 9}]}})
    assert r.status_code == 201
    p = client.get('/api/converting/production?date=2026-10-27', headers=auth_headers).get_json()['productions'][0]
    assert p['grade_a'] == 50 and p['loss_kg'] == 1


def test_production_detail_returns_rows_and_404(client, auth_headers, db_session):
    m = _machine(db_session)
    rows = [{'no_roll': '14', 'weight': 175.2, 'slitting': [17.5] * 10, 'loss': 2.4, 'total_weight': 172.8}]
    r = client.post('/api/converting/production', headers=auth_headers, json={
        'production_date': '2026-10-27', 'shift': 2, 'machine_id': m.id, 'product_name': 'Stardec', 'operator_name': 'Budi',
        'machine_data': {'rows': rows, 'downtime_entries': [{'reason': 'ganti roll', 'duration_minutes': 15, 'frequency': 2}]}})
    pid = r.get_json()['production']['id']
    d = client.get(f'/api/converting/production/{pid}', headers=auth_headers).get_json()['production']
    assert d['machine']['machine_type'] == 'slitting' and d['shift'] == 2 and d['operator_name'] == 'Budi'
    assert d['grade_a'] == 172.8 and d['machine_data']['rows'][0]['no_roll'] == '14'
    assert d['machine_data']['downtime_entries'][0]['duration_minutes'] == 15
    assert client.get('/api/converting/production/999999', headers=auth_headers).status_code == 404
