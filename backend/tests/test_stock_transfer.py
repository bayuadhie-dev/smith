import re


def _loc(db_session, code):
    from models import WarehouseLocation, WarehouseZone
    z = WarehouseZone.query.first()
    if not z:
        z = WarehouseZone(code='ZT', name='Zona Tes', material_type='finished_goods', zone_type='storage', is_active=True)
        db_session.add(z); db_session.commit()
    loc = WarehouseLocation(location_code=code, zone_id=z.id, rack='R1', level='1', position='1', capacity=1000, capacity_uom='PCS', is_active=True)
    db_session.add(loc); db_session.commit()
    return loc


def _inv(db_session, material, loc, qty, batch):
    from models import Inventory
    inv = Inventory(material_id=material.id, location_id=loc.id, quantity_on_hand=qty, quantity_available=qty, batch_number=batch, is_active=True)
    db_session.add(inv); db_session.commit()
    return inv


def test_transfer_ship_and_partial_receive(client, auth_headers, db_session, test_material):
    from models import Inventory
    a, b = _loc(db_session, 'TA'), _loc(db_session, 'TB')
    _inv(db_session, test_material, a, 30, 'B1')
    _inv(db_session, test_material, a, 40, 'B2')
    body = {'from_location_id': a.id, 'to_location_id': b.id,
            'lines': [{'material_id': test_material.id, 'item_name': 'Bahan', 'uom': 'KG', 'quantity': 50}]}
    r = client.post('/api/stock-transfers', headers=auth_headers, json=body)
    assert r.status_code == 201, r.get_json()
    t = r.get_json()
    assert re.fullmatch(r'IT/\d{2}/0001', t['transfer_number'])
    assert client.post('/api/stock-transfers', headers=auth_headers, json={**body, 'to_location_id': a.id}).status_code == 400

    r = client.post(f"/api/stock-transfers/{t['id']}/ship", headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    t = r.get_json()
    assert t['status'] == 'shipped' and sorted(l['batch_number'] for l in t['lines']) == ['B1', 'B2']
    assert sum(l['quantity'] for l in t['lines']) == 50
    on_a = sum(float(i.quantity_on_hand) for i in Inventory.query.filter_by(location_id=a.id))
    assert on_a == 20

    lines = {l['batch_number']: l for l in t['lines']}
    r = client.post(f"/api/stock-transfers/{t['id']}/receive", headers=auth_headers,
                    json={'lines': [{'line_id': lines['B1']['id'], 'quantity': lines['B1']['quantity']}]})
    assert r.status_code == 200, r.get_json()
    t = r.get_json()
    assert t['status'] == 'partial' and t['receipts'][0]['receipt_number'] == f"{t['transfer_number']}-1"
    pend = client.get('/api/stock-transfers?pending_receipt=1', headers=auth_headers).get_json()
    assert pend['total'] == 1

    over = client.post(f"/api/stock-transfers/{t['id']}/receive", headers=auth_headers,
                       json={'lines': [{'line_id': lines['B2']['id'], 'quantity': lines['B2']['quantity'] + 1}]})
    assert over.status_code == 400
    r = client.post(f"/api/stock-transfers/{t['id']}/receive", headers=auth_headers,
                    json={'lines': [{'line_id': lines['B2']['id'], 'quantity': lines['B2']['quantity']}]})
    t = r.get_json()
    assert t['status'] == 'received' and t['receipts'][1]['receipt_number'].endswith('-2')
    on_b = sum(float(i.quantity_on_hand) for i in Inventory.query.filter_by(location_id=b.id))
    assert on_b == 50

    s = client.get(f'/api/stock-transfers/item-stock?material_id={test_material.id}', headers=auth_headers).get_json()
    assert s['total_on_hand'] == 70 and any(m['type'] == 'transfer_in' for m in s['movements'])


def test_transfer_insufficient_stock_and_cancel(client, auth_headers, db_session, test_material):
    a, b = _loc(db_session, 'TA2'), _loc(db_session, 'TB2')
    _inv(db_session, test_material, a, 5, 'B1')
    r = client.post('/api/stock-transfers', headers=auth_headers, json={
        'from_location_id': a.id, 'to_location_id': b.id, 'lines': [{'material_id': test_material.id, 'item_name': 'Bahan', 'quantity': 9}]})
    tid = r.get_json()['id']
    assert client.post(f'/api/stock-transfers/{tid}/ship', headers=auth_headers).status_code == 400
    assert client.post(f'/api/stock-transfers/{tid}/cancel', headers=auth_headers).status_code == 200
    assert client.get('/api/stock-transfers/sources', headers=auth_headers).status_code == 200
