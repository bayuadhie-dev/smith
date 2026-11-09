from datetime import datetime


def _setup(db_session, test_material):
    from models.purchasing import Supplier, PurchaseOrder, PurchaseOrderItem
    from models.finance import GlobalAccountDefault
    from tests.test_finance_sync_regressions import _acc
    exp = _acc(db_session, '9-1000')
    for key in ('akun_persediaan_id', 'akun_beban_id', 'accounts_payable'):
        if not GlobalAccountDefault.query.filter_by(transaction_key=key).first():
            db_session.add(GlobalAccountDefault(transaction_key=key, account_id=exp.id))
    sup = Supplier(code='SUP-ED', company_name='PT EDIT'); db_session.add(sup); db_session.commit()
    po = PurchaseOrder(po_number='PO-ED-1', supplier_id=sup.id, order_date=datetime(2026, 11, 5), status='approved', currency='IDR', total_amount=0)
    db_session.add(po); db_session.commit()
    it = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=test_material.id, quantity=100, uom='KG', unit_price=10, total_price=1000)
    db_session.add(it); db_session.commit()
    return sup, po, it


def _post(client, headers, sup, po, it, qty, price=10, **extra):
    body = {'po_id': po.id, 'supplier_id': sup.id, 'supplier_invoice_number': 'S-ED', 'invoice_date': '2026-11-06',
            'items': [{'po_item_id': it.id, 'quantity': qty, 'unit_price': price}], **extra}
    return client.post('/api/purchasing/purchase-invoices', json=body, headers=headers)


def test_edit_replaces_invoice_keeps_number_and_restores_qty(client, auth_headers, db_session, test_material):
    from models import Invoice
    from models.record_attachment import RecordAttachment
    sup, po, it = _setup(db_session, test_material)
    r = _post(client, auth_headers, sup, po, it, 60)
    assert r.status_code == 201, r.get_json()
    old_id = r.get_json()['invoice']['id']; old_no = r.get_json()['invoice']['invoice_number']
    db_session.add(RecordAttachment(entity_type='purchase_invoice', entity_id=old_id, filename='f.pdf', stored_name='x.pdf')); db_session.commit()
    r2 = _post(client, auth_headers, sup, po, it, 80, price=12, replace_invoice_id=old_id)
    assert r2.status_code == 201, r2.get_json()
    new = r2.get_json()['invoice']
    assert new['invoice_number'] == old_no and new['id'] != old_id
    db_session.expire_all()
    old = db_session.get(Invoice, old_id)
    assert old.status == 'cancelled' and old.invoice_number == f'{old_no}-V1'
    db_session.refresh(it); assert float(it.quantity_invoiced) == 80          # 60 dikembalikan, 80 ditagih
    assert RecordAttachment.query.filter_by(entity_type='purchase_invoice', entity_id=new['id']).count() == 1
    h = client.get(f"/api/history?table=invoices&id={new['id']}", headers=auth_headers).get_json()['history']
    assert any(c['field'] == 'Total' for e in h for c in e['changes'])
    again = _post(client, auth_headers, sup, po, it, 70, replace_invoice_id=old_id)
    assert again.status_code == 400                                              # faktur lama sudah dibatalkan


def test_edit_blocked_when_paid(client, auth_headers, db_session, test_material):
    from models import Invoice
    sup, po, it = _setup(db_session, test_material)
    r = _post(client, auth_headers, sup, po, it, 10)
    inv = db_session.get(Invoice, r.get_json()['invoice']['id']); inv.paid_amount = 50; db_session.commit()
    bad = _post(client, auth_headers, sup, po, it, 20, replace_invoice_id=inv.id)
    assert bad.status_code == 400 and 'pembayaran' in bad.get_json()['error'].lower()
    db_session.refresh(inv); assert inv.status != 'cancelled'


def test_three_way_match_document(client, auth_headers, db_session, test_material):
    sup, po, it = _setup(db_session, test_material)
    r = _post(client, auth_headers, sup, po, it, 120, price=11)          # lebih dari PO, harga beda, belum ada GRN
    inv_id = r.get_json()['invoice']['id']
    g = client.post(f'/api/documents/generate-from-three-way-match/{inv_id}', headers=auth_headers)
    assert g.status_code == 201, g.get_json()
    html = client.get(f"/api/documents/{g.get_json()['document_id']}/preview", headers=auth_headers).get_json()['document']['html_content']
    assert 'PENCOCOKAN 3 ARAH' in html and 'PT EDIT' in html and 'GRN belum ada' in html and 'Selisih' in html
