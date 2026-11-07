from datetime import date

from tests.test_grn_reject_quarantine import _setup_warehouse


def _sup(db_session, code):
    from models.purchasing import Supplier
    s = Supplier(code=code, company_name=f'Sup {code}', is_active=True)
    db_session.add(s); db_session.commit()
    return s


def test_grn_without_po_and_notes_saved(client, auth_headers, db_session, test_material):
    from models.purchasing import GoodsReceivedNote, GRNItem
    from models.warehouse import Inventory
    loc, _ = _setup_warehouse(db_session)
    sup = _sup(db_session, 'S-NOPO')
    body = {'supplier_id': sup.id, 'notes': 'Barang titipan tanpa PO', 'receipt_date': '2026-10-20', 'items': [{
        'material_id': test_material.id, 'quantity_received': 5, 'quantity_accepted': 5, 'uom': 'KG', 'location_id': loc.id}]}
    r = client.post('/api/purchasing/grn', json=body, headers=auth_headers)
    assert r.status_code == 201, r.get_json()
    g = GoodsReceivedNote.query.get(r.get_json()['grn_id'])
    assert g.po_id is None and g.notes == 'Barang titipan tanpa PO' and g.receipt_date.date().isoformat() == '2026-10-20'
    gi = GRNItem.query.filter_by(grn_id=g.id).one()
    assert gi.po_item_id is None and float(gi.quantity_ordered) == 5
    assert float(Inventory.query.filter_by(location_id=loc.id, material_id=test_material.id).one().quantity_on_hand) == 5
    d = client.get(f'/api/purchasing/grn/{g.id}', headers=auth_headers).get_json()
    assert d['po_id'] is None and d['notes'] == 'Barang titipan tanpa PO'
    assert any(x['id'] == g.id for x in client.get('/api/purchasing/grn', headers=auth_headers).get_json()['grns'])
    # tanpa pemasok ditolak, stok tanpa gudang ditolak
    assert client.post('/api/purchasing/grn', json={'items': body['items']}, headers=auth_headers).status_code == 400
    nol = dict(body['items'][0]); nol.pop('location_id')
    assert client.post('/api/purchasing/grn', json={'supplier_id': sup.id, 'items': [nol]}, headers=auth_headers).status_code == 400


def test_service_line_received_without_warehouse(client, auth_headers, db_session, test_material):
    from models.product import Material
    from models.purchasing import GRNItem, PurchaseOrder, PurchaseOrderItem
    from models.warehouse import Inventory
    jasa = Material(code='JASA-1', name='Pemeliharaan Mesin', material_type='non_inventory', category='Jasa', primary_uom='JOB', cost_per_unit=0, is_active=True)
    db_session.add(jasa); db_session.commit()
    sup = _sup(db_session, 'S-JASA')
    po = PurchaseOrder(po_number='PO-JASA-1', supplier_id=sup.id, order_date=date.today(), status='approved', total_amount=500000)
    db_session.add(po); db_session.commit()
    poi = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=jasa.id, description='Karbon rotary joint', quantity=1, uom='JOB', unit_price=500000, total_price=500000)
    db_session.add(poi); db_session.commit()
    body = {'po_id': po.id, 'supplier_id': sup.id, 'notes': po.notes, 'items': [{
        'po_item_id': poi.id, 'material_id': jasa.id, 'quantity_ordered': 1, 'quantity_received': 1, 'quantity_accepted': 1, 'uom': 'JOB'}]}
    r = client.post('/api/purchasing/grn', json=body, headers=auth_headers)
    assert r.status_code == 201, r.get_json()
    gi = GRNItem.query.filter_by(po_item_id=poi.id).one()
    assert gi.location_id is None
    assert Inventory.query.filter_by(material_id=jasa.id).count() == 0
    db_session.refresh(poi)
    assert float(poi.quantity_received) == 1


def test_po_lookups_open_to_receiving_roles_and_supplier_filter(client, auth_headers, db_session):
    from models.purchasing import PurchaseOrder
    a, b = _sup(db_session, 'S-A'), _sup(db_session, 'S-B')
    for i, s in enumerate((a, a, b)):
        db_session.add(PurchaseOrder(po_number=f'PO-FLT-{i}', supplier_id=s.id, order_date=date.today(), status='approved', total_amount=1, notes='catatan PO'))
    db_session.commit()
    r = client.get(f'/api/purchasing/purchase-orders?status=approved,partial&supplier_id={a.id}', headers=auth_headers).get_json()
    assert len(r['purchase_orders']) == 2 and r['purchase_orders'][0]['notes'] == 'catatan PO'


def test_inspection_over_delivery_is_not_negative_rejection(client, auth_headers, db_session, test_material):
    from models.purchasing import GRNItem
    loc, _ = _setup_warehouse(db_session)
    sup = _sup(db_session, 'S-OVER')
    body = {'supplier_id': sup.id, 'items': [{'material_id': test_material.id, 'quantity_received': 2400, 'quantity_accepted': 2400, 'uom': 'KG', 'location_id': loc.id}]}
    r = client.post('/api/purchasing/grn', json=body, headers=auth_headers)
    assert r.status_code == 201, r.get_json()
    gid = r.get_json()['grn_id']
    gi = GRNItem.query.filter_by(grn_id=gid).one()
    ins = client.post(f'/api/purchasing/grn/{gid}/inspect', headers=auth_headers,
                      json={'items': [{'id': gi.id, 'quantity_accepted': 2628.7, 'quantity_rejected': 0}]})
    assert ins.status_code == 200, ins.get_json()
    assert 'ditolak: 0' in ins.get_json()['message'] and '-' not in ins.get_json()['message'].split('ditolak:')[1]
    db_session.refresh(gi)
    assert float(gi.quantity_rejected) == 0 and float(gi.quantity_received) == 2628.7 and float(gi.quantity_accepted) == 2628.7
