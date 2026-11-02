from models.production import Machine
from models import SparePart


def _machine(db_session, code='MC-SP-1'):
    m = Machine(code=code, name='Mesin Uji', machine_type='nonwoven_machine', status='idle')
    db_session.add(m); db_session.commit()
    return m


def _part(client, headers, **kw):
    body = {'part_number': 'BRG-6205', 'part_name': 'Bearing 6205', 'uom': 'pcs', 'min_stock': 5, 'unit_cost': 25000, 'opening_stock': 10}
    body.update(kw)
    r = client.post('/api/spare-parts', headers=headers, json=body)
    assert r.status_code == 201, r.get_json()
    return r.get_json()['id']


def test_stock_moves_only_through_movements(client, auth_headers, db_session):
    pid = _part(client, auth_headers)
    d = client.get(f'/api/spare-parts/{pid}', headers=auth_headers).get_json()
    assert d['spare_part']['current_stock'] == 10 and d['movements'][0]['notes'] == 'Stok awal'

    client.put(f'/api/spare-parts/{pid}', headers=auth_headers, json={'current_stock': 999, 'part_name': 'Bearing 6205 ZZ'})
    d = client.get(f'/api/spare-parts/{pid}', headers=auth_headers).get_json()['spare_part']
    assert d['current_stock'] == 10 and d['part_name'] == 'Bearing 6205 ZZ'

    r = client.post(f'/api/spare-parts/{pid}/movements', headers=auth_headers, json={'movement_type': 'out', 'quantity': 11})
    assert r.status_code == 400 and 'tidak cukup' in r.get_json()['error']
    r = client.post(f'/api/spare-parts/{pid}/movements', headers=auth_headers, json={'movement_type': 'out', 'quantity': 6})
    assert r.status_code == 201 and r.get_json()['current_stock'] == 4
    r = client.post(f'/api/spare-parts/{pid}/movements', headers=auth_headers, json={'movement_type': 'adjustment', 'quantity': 7})
    mv = r.get_json()['movement']
    assert r.get_json()['current_stock'] == 7 and mv['quantity'] == 3 and mv['stock_before'] == 4

    lst = client.get('/api/spare-parts?low_stock=1', headers=auth_headers).get_json()
    assert lst['spare_parts'] == [] and lst['summary']['total'] == 1
    client.post(f'/api/spare-parts/{pid}/movements', headers=auth_headers, json={'movement_type': 'out', 'quantity': 3})
    lst = client.get('/api/spare-parts?low_stock=1', headers=auth_headers).get_json()
    assert [p['part_number'] for p in lst['spare_parts']] == ['BRG-6205']


def test_duplicate_code_and_machine_link(client, auth_headers, db_session):
    pid = _part(client, auth_headers)
    r = client.post('/api/spare-parts', headers=auth_headers, json={'part_number': 'BRG-6205', 'part_name': 'x', 'uom': 'pcs'})
    assert r.status_code == 400
    m = _machine(db_session)
    r = client.post(f'/api/spare-parts/machines/{m.id}', headers=auth_headers, json={'spare_part_id': pid, 'qty_installed': 4, 'replace_interval_days': 180})
    assert r.status_code == 201
    assert client.post(f'/api/spare-parts/machines/{m.id}', headers=auth_headers, json={'spare_part_id': pid}).status_code == 400
    mp = client.get(f'/api/spare-parts/machines/{m.id}', headers=auth_headers).get_json()
    assert mp['parts'][0]['qty_installed'] == 4 and mp['parts'][0]['replace_interval_days'] == 180
    assert client.get(f'/api/spare-parts?machine_id={m.id}', headers=auth_headers).get_json()['total'] == 1
    assert client.get(f'/api/spare-parts/{pid}', headers=auth_headers).get_json()['machines'][0]['machine_code'] == 'MC-SP-1'
    link = mp['parts'][0]['link_id']
    assert client.delete(f'/api/spare-parts/machine-links/{link}', headers=auth_headers).status_code == 200
    assert client.get(f'/api/spare-parts/machines/{m.id}', headers=auth_headers).get_json()['parts'] == []


def test_request_approval_deducts_stock_atomically(client, auth_headers, db_session):
    a = _part(client, auth_headers)
    b = _part(client, auth_headers, part_number='BLT-V32', part_name='V-belt', opening_stock=2)
    r = client.post('/api/spare-parts/requests', headers=auth_headers, json={'items': [
        {'spare_part_id': a, 'qty_requested': 3}, {'spare_part_id': b, 'qty_requested': 5}]})
    assert r.status_code == 201
    rid = r.get_json()['request_id']
    assert r.get_json()['request_number'].startswith('SPR')

    r = client.post(f'/api/spare-parts/requests/{rid}/approve', headers=auth_headers, json={})
    assert r.status_code == 400 and 'tidak cukup' in r.get_json()['error']
    db_session.expire_all()
    assert float(db_session.get(SparePart, a).current_stock) == 10  # tidak ada yang terpotong sebagian
    assert client.get(f'/api/spare-parts/requests/{rid}', headers=auth_headers).get_json()['status'] == 'pending'

    r2 = client.post('/api/spare-parts/requests', headers=auth_headers, json={'items': [{'spare_part_id': a, 'qty_requested': 3}, {'spare_part_id': b, 'qty_requested': 2}]})
    rid2 = r2.get_json()['request_id']
    assert client.post(f'/api/spare-parts/requests/{rid2}/approve', headers=auth_headers, json={}).status_code == 200
    db_session.expire_all()
    assert float(db_session.get(SparePart, a).current_stock) == 7 and float(db_session.get(SparePart, b).current_stock) == 0
    assert client.post(f'/api/spare-parts/requests/{rid2}/approve', headers=auth_headers, json={}).status_code == 400

    assert client.post(f'/api/spare-parts/requests/{rid}/reject', headers=auth_headers, json={}).status_code == 400
    assert client.post(f'/api/spare-parts/requests/{rid}/reject', headers=auth_headers, json={'note': 'stok kurang'}).status_code == 200
    assert client.get('/api/spare-parts/requests?status=pending', headers=auth_headers).get_json()['pending'] == 0
