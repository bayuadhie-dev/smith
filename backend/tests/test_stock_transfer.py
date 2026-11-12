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


def test_incoming_qc_updates_grn_status(client, auth_headers, db_session, test_material):
    from models.purchasing import GoodsReceivedNote, GRNItem
    a = _loc(db_session, 'QA')
    from models.purchasing import Supplier
    sup = Supplier(code='SUP-QC1', company_name='Pemasok QC', is_active=True)
    db_session.add(sup); db_session.flush()
    g = GoodsReceivedNote(grn_number='BPB-TEST/001', supplier_id=sup.id, receipt_date=__import__('datetime').date.today(), status='pending', received_by=1)
    db_session.add(g); db_session.flush()
    it = GRNItem(grn_id=g.id, material_id=test_material.id, item_name='Bahan', quantity_ordered=10, quantity_received=10,
                 quantity_accepted=10, uom='KG', location_id=a.id, batch_number='B9')
    db_session.add(it); db_session.commit()
    lst = client.get('/api/quality/incoming-materials', headers=auth_headers).get_json()
    assert any(m['id'] == it.id and m['grn_id'] == g.id for m in lst['materials'])
    r = client.post(f'/api/quality/incoming-materials/{it.id}/inspect', headers=auth_headers, json={'result': 'accepted', 'visual_inspection': 'passed'})
    assert r.status_code == 201, r.get_json()
    db_session.refresh(g)
    assert g.status == 'inspected' and g.quality_status == 'passed'
    passed = client.get('/api/quality/incoming-materials?status=passed', headers=auth_headers).get_json()
    assert any(m['id'] == it.id for m in passed['materials'])


def test_zone_stock_summary(client, auth_headers, db_session, test_material):
    a = _loc(db_session, 'ZS1')
    _inv(db_session, test_material, a, 12, 'B1')
    r = client.get(f'/api/stock-transfers/zone-stock/{a.zone_id}', headers=auth_headers)
    assert r.status_code == 200
    d = r.get_json()
    assert any(i['item_id'] == test_material.id and i['on_hand'] == 12 for i in d['items'])
    assert any(l['id'] == a.id and l['on_hand'] == 12 for l in d['locations'])
    assert client.get('/api/stock-transfers/zone-stock/99999', headers=auth_headers).status_code == 404


def test_receipts_list_has_grn_origin(client, auth_headers, db_session, test_material):
    from models.purchasing import GoodsReceivedNote, GRNItem, Supplier
    a = _loc(db_session, 'RC1')
    sup = Supplier(code='SUP-RC1', company_name='Pemasok RC', is_active=True)
    db_session.add(sup); db_session.flush()
    g = GoodsReceivedNote(grn_number='BPB-RC/001', supplier_id=sup.id, receipt_date=__import__('datetime').date.today(), status='approved', received_by=1)
    db_session.add(g); db_session.flush()
    db_session.add(GRNItem(grn_id=g.id, material_id=test_material.id, item_name='Bahan', quantity_ordered=1, quantity_received=1, quantity_accepted=1, uom='KG', location_id=a.id))
    db_session.commit()
    d = client.get('/api/stock-transfers/receipts', headers=auth_headers).get_json()
    row = next(r for r in d['receipts'] if r['number'] == 'BPB-RC/001')
    assert row['origin'] == 'grn' and row['from_label'] == 'Pemasok RC' and row['href'].endswith(str(g.id))
    assert client.get('/api/stock-transfers/receipts?origin=transfer', headers=auth_headers).get_json()['total'] == 0


def test_qc_status_change_is_ledger_neutral(client, db_session, test_material):
    from sqlalchemy import text
    from models import Inventory
    from utils.inventory_helpers import apply_qc_disposition_splits
    a = _loc(db_session, 'QN1')
    inv = _inv(db_session, test_material, a, 40, 'BQ')
    inv.stock_status = 'quarantine'
    db_session.commit()
    apply_qc_disposition_splits(inv.id, [{'status': 'available', 'quantity': 40}], user_id=1)
    db_session.commit()
    net = db_session.execute(text("select coalesce(sum(case when direction='in' then quantity else -quantity end),0) from inventory_transactions where material_id=:m"),
                             {'m': test_material.id}).scalar()
    assert float(net) == 0
    assert sum(float(i.quantity_on_hand) for i in Inventory.query.filter_by(material_id=test_material.id)) == 40


def test_material_issue_requires_printed_spk(client, auth_headers, db_session, test_product):
    from models.production import WorkOrder
    wo = WorkOrder(wo_number='WO-SPK-GATE', product_id=test_product.id, quantity=10, uom='PCS', status='planned')
    db_session.add(wo); db_session.commit()
    r = client.post('/api/production/material-issues', headers=auth_headers, json={'work_order_id': wo.id, 'items': []})
    assert r.status_code == 400 and 'Cetak SPK' in (r.get_json().get('error') or '')
    r2 = client.post(f'/api/production/material-issues/from-work-order/{wo.id}', headers=auth_headers)
    assert r2.status_code == 400 and 'Cetak SPK' in (r2.get_json().get('error') or '')


def test_inspection_over_delivery_posts_gl_delta(client, auth_headers, db_session, test_material):
    from datetime import date
    from models import Inventory
    from models.finance import Account, GlobalAccountDefault
    from models.purchasing import GoodsReceivedNote, GRNItem, PurchaseOrder, PurchaseOrderItem, Supplier
    from tests.test_grn_reject_quarantine import _setup_warehouse
    loc, _ = _setup_warehouse(db_session)
    inv_acc = Account(account_code='1-5000', account_name='Persediaan Bahan Baku', account_type='asset', normal_balance='debit', is_active=True)
    gr = Account(account_code='2-7000', account_name='GR/IR', account_type='liability', normal_balance='credit', is_active=True)
    db_session.add_all([inv_acc, gr]); db_session.flush()
    db_session.add(GlobalAccountDefault(transaction_key='akun_persediaan_id', account_id=inv_acc.id))
    db_session.add(GlobalAccountDefault(transaction_key='gr_ir_clearing', account_id=gr.id)); db_session.commit()
    sup = Supplier(code='SUP-DG', company_name='Sup DG', is_active=True); db_session.add(sup); db_session.commit()
    po = PurchaseOrder(po_number='PO-DG-1', supplier_id=sup.id, order_date=date.today(), status='approved', total_amount=2400)
    db_session.add(po); db_session.commit()
    poi = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=test_material.id, quantity=2400, uom='KG', unit_price=10, total_price=24000)
    db_session.add(poi); db_session.commit()
    g = GoodsReceivedNote(grn_number='BPB-DG-1', po_id=po.id, supplier_id=sup.id, receipt_date=date.today(), status='pending')
    db_session.add(g); db_session.commit()
    it = GRNItem(grn_id=g.id, po_item_id=poi.id, material_id=test_material.id, quantity_ordered=2400, quantity_received=2400, quantity_accepted=2400,
                 uom='KG', location_id=loc.id, batch_number='B1')
    db_session.add(it)
    db_session.add(Inventory(material_id=test_material.id, location_id=loc.id, quantity_on_hand=2400, quantity_available=2400, batch_number='B1', is_active=True))
    db_session.commit()
    r = client.post(f'/api/purchasing/grn/{g.id}/inspect', headers=auth_headers, json={'items': [{'id': it.id, 'quantity_accepted': 2628.7, 'quantity_rejected': 0}]})
    assert r.status_code == 200, r.get_json()
    from models.finance import AccountingEntry
    rows = AccountingEntry.query.filter(AccountingEntry.reference_number == 'BPB-DG-1').all()
    dr = sum(float(x.debit_amount or 0) for x in rows)
    cr = sum(float(x.credit_amount or 0) for x in rows)
    assert round(dr, 2) == round(cr, 2) == 2287.0
