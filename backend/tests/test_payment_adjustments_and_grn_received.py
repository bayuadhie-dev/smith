from datetime import date

from tests.test_finance_sync_regressions import _acc, _bank, _foreign_ap
from tests.test_grn_reject_quarantine import _setup_warehouse


def _pay(client, headers, bank, inv, alloc, adjustments=None, **extra):
    body = {'payment_date': '2026-10-31T10:00:00', 'payment_type': 'payment', 'payment_method': 'bank_transfer',
            'bank_account_id': bank.id, 'allocations': [{'invoice_id': inv.id, 'amount': alloc}]}
    if adjustments is not None:
        body['adjustments'] = adjustments
    body.update(extra)
    return client.post('/api/finance/payments', headers=headers, json=body)


def test_invoice_payment_with_adjustment_posts_balanced_journal(client, auth_headers, db_session):
    from models.finance import AccountingEntry, Payment
    bank = _bank(db_session); exp = _acc(db_session, '9-1000')
    _, inv = _foreign_ap(db_session, currency='IDR', rate=1, amount=1_000_000)
    r = _pay(client, auth_headers, bank, inv, 1_000_000, [{'account_id': exp.id, 'amount': 200_000, 'description': 'selisih'}])
    assert r.status_code == 201, r.get_json()
    pay = db_session.get(Payment, r.get_json()['payment_id'])
    assert float(pay.amount) == 1_200_000
    assert [float(l.amount) for l in pay.lines] == [200_000]
    entries = AccountingEntry.query.filter_by(reference_type='payment', reference_id=pay.id).all()
    assert round(sum(float(e.debit_amount or 0) for e in entries), 2) == round(sum(float(e.credit_amount or 0) for e in entries), 2) == 1_200_000
    db_session.refresh(inv)
    assert inv.status == 'paid' and float(inv.balance_due) == 0


def test_adjustment_negative_is_discount_and_requires_allocation(client, auth_headers, db_session):
    bank = _bank(db_session); disc = _acc(db_session, '6-6000')
    _, inv = _foreign_ap(db_session, currency='IDR', rate=1, amount=500_000)
    r = _pay(client, auth_headers, bank, inv, 500_000, [{'account_id': disc.id, 'amount': -50_000}])
    assert r.status_code == 201, r.get_json()
    r2 = client.post('/api/finance/payments', headers=auth_headers, json={
        'payment_date': '2026-10-31T10:00:00', 'payment_type': 'payment', 'payment_method': 'bank_transfer', 'bank_account_id': bank.id,
        'lines': [{'account_id': disc.id, 'amount': 10}], 'adjustments': [{'account_id': disc.id, 'amount': 5}]})
    assert r2.status_code == 400


def test_grn_received_can_be_corrected_on_approved_grn(client, auth_headers, db_session, test_material):
    from models.purchasing import GoodsReceivedNote, GRNItem, PurchaseOrder, PurchaseOrderItem, Supplier
    main_location, _ = _setup_warehouse(db_session)
    sup = Supplier(code='SUP-GR', company_name='Sup GR', is_active=True)
    db_session.add(sup); db_session.commit()
    po = PurchaseOrder(po_number='PO-GR-1', supplier_id=sup.id, order_date=date.today(), status='approved', total_amount=1000)
    db_session.add(po); db_session.commit()
    poi = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=test_material.id, quantity=2400, uom='KG', unit_price=1, total_price=2400)
    db_session.add(poi); db_session.commit()
    grn = GoodsReceivedNote(grn_number='BPB-GR-1', po_id=po.id, supplier_id=sup.id, receipt_date=date.today(), status='approved')
    db_session.add(grn); db_session.commit()
    gi = GRNItem(grn_id=grn.id, po_item_id=poi.id, material_id=test_material.id, quantity_ordered=2400, quantity_received=2400,
                 quantity_accepted=2628.7, quantity_rejected=-228.7, uom='KG', location_id=main_location.id)
    db_session.add(gi); db_session.commit()

    bad = client.put(f'/api/purchasing/grn/{grn.id}', json={'items': [{'id': gi.id, 'po_item_id': poi.id, 'quantity_received': 100}]}, headers=auth_headers)
    assert bad.status_code == 400

    ok = client.put(f'/api/purchasing/grn/{grn.id}', json={'items': [{'id': gi.id, 'po_item_id': poi.id, 'quantity_received': 2628.7}]}, headers=auth_headers)
    assert ok.status_code == 200, ok.get_json()
    db_session.refresh(gi)
    assert float(gi.quantity_received) == 2628.7 and float(gi.quantity_accepted) == 2628.7 and float(gi.quantity_rejected) == 0


def test_full_discount_zero_cash_payment_saves(client, auth_headers, db_session):
    bank = _bank(db_session); disc = _acc(db_session, '6-6000')
    _, inv = _foreign_ap(db_session, currency='IDR', rate=1, amount=300_000)
    r = _pay(client, auth_headers, bank, inv, 300_000, [{'account_id': disc.id, 'amount': -300_000}], amount=0)
    assert r.status_code == 201, r.get_json()
    db_session.refresh(inv)
    assert inv.status == 'paid'


def test_advances_summary_tracks_open_and_settled(client, auth_headers, db_session):
    from models.finance import Account
    from models.purchasing import Supplier
    bank = _bank(db_session)
    adv = Account(account_code='1-1999', account_name='Uang Muka Lainnya', account_type='asset', normal_balance='debit', is_active=True)
    db_session.add(adv); sup = Supplier(code='SUP-ADV', company_name='PT Adv', is_active=True); db_session.add(sup); db_session.commit()
    body = {'payment_date': '2026-10-31T10:00:00', 'payment_type': 'payment', 'payment_method': 'bank_transfer', 'bank_account_id': bank.id,
            'lines': [{'account_id': adv.id, 'amount': 1000, 'party_type': 'supplier', 'party_id': sup.id}]}
    assert client.post('/api/finance/payments', headers=auth_headers, json=body).status_code == 201
    r = client.get('/api/finance/advances-summary', headers=auth_headers).get_json()
    assert 'advances' in r, r
    assert r['advances'][0]['outstanding'] == 1000 and r['advances'][0]['status'] == 'menggantung'
    body['lines'][0]['amount'] = -1000
    assert client.post('/api/finance/payments', headers=auth_headers, json=body).status_code == 201
    r = client.get('/api/finance/advances-summary', headers=auth_headers).get_json()
    assert r['advances'][0]['status'] == 'lunas'


def test_purchase_invoice_from_grn_without_po(client, auth_headers, db_session, test_material):
    from models.finance import Invoice
    from models.purchasing import GoodsReceivedNote, GRNItem, Supplier
    from models.finance import GlobalAccountDefault
    main_location, _ = _setup_warehouse(db_session)
    db_session.add(GlobalAccountDefault(transaction_key='gr_ir_clearing', account_id=_acc(db_session, '6-6000').id))
    db_session.add(GlobalAccountDefault(transaction_key='accounts_payable', account_id=_acc(db_session, '9-1000').id)); db_session.commit()
    sup = Supplier(code='SUP-NOPO', company_name='Sup NoPO', is_active=True)
    db_session.add(sup); db_session.commit()
    grn = GoodsReceivedNote(grn_number='BPB-NOPO-1', po_id=None, supplier_id=sup.id, receipt_date=date.today(), status='approved')
    db_session.add(grn); db_session.commit()
    db_session.add(GRNItem(grn_id=grn.id, material_id=test_material.id, quantity_ordered=5, quantity_received=5, quantity_accepted=5, uom='KG', location_id=main_location.id))
    db_session.commit()
    body = {'grn_id': grn.id, 'supplier_id': sup.id, 'supplier_invoice_number': 'F-1', 'invoice_date': '2026-11-09',
            'items': [{'material_id': test_material.id, 'quantity': 5, 'unit_price': 1000, 'uom': 'KG', 'description': 'tes'}]}
    r = client.post('/api/purchasing/purchase-invoices', json=body, headers=auth_headers)
    assert r.status_code == 201, r.get_json()
    inv = Invoice.query.filter_by(grn_id=grn.id).first()
    assert inv.purchase_order_id is None and float(inv.total_amount) == 5000
    again = client.post('/api/purchasing/purchase-invoices', json=body, headers=auth_headers)
    assert again.status_code == 400


def test_purchase_invoice_next_number_and_manual_number(client, auth_headers, db_session):
    r = client.get('/api/purchasing/purchase-invoices/next-number', headers=auth_headers)
    assert r.status_code == 200 and r.get_json()['next_number'].startswith('PI-')


def test_grn_number_can_be_corrected_and_stays_unique(client, auth_headers, db_session):
    from models.purchasing import GoodsReceivedNote, Supplier
    sup = Supplier(code='SUP-GN', company_name='Sup GN', is_active=True); db_session.add(sup); db_session.commit()
    a = GoodsReceivedNote(grn_number='BPB-N-1', supplier_id=sup.id, receipt_date=date.today(), status='pending')
    b = GoodsReceivedNote(grn_number='BPB-N-2', supplier_id=sup.id, receipt_date=date.today(), status='approved')
    db_session.add_all([a, b]); db_session.commit()
    assert client.put(f'/api/purchasing/grn/{a.id}', json={'grn_number': 'BPB-N-2'}, headers=auth_headers).status_code == 400
    assert client.put(f'/api/purchasing/grn/{b.id}', json={'grn_number': 'BPB-N-9'}, headers=auth_headers).status_code == 200
    db_session.refresh(b)
    assert b.grn_number == 'BPB-N-9'


def test_edit_purchase_invoice_without_po_replaces_and_keeps_number(client, auth_headers, db_session, test_material):
    from models.finance import GlobalAccountDefault, Invoice
    from models.purchasing import GoodsReceivedNote, GRNItem, Supplier
    main_location, _ = _setup_warehouse(db_session)
    db_session.add(GlobalAccountDefault(transaction_key='gr_ir_clearing', account_id=_acc(db_session, '6-6000').id))
    db_session.add(GlobalAccountDefault(transaction_key='accounts_payable', account_id=_acc(db_session, '9-1000').id)); db_session.commit()
    sup = Supplier(code='SUP-EDNP', company_name='Sup EdNP', is_active=True); db_session.add(sup); db_session.commit()
    grn = GoodsReceivedNote(grn_number='BPB-EDNP-1', supplier_id=sup.id, receipt_date=date.today(), status='approved')
    db_session.add(grn); db_session.commit()
    db_session.add(GRNItem(grn_id=grn.id, material_id=test_material.id, quantity_ordered=2, quantity_received=2, quantity_accepted=2, uom='KG', location_id=main_location.id)); db_session.commit()
    body = {'grn_id': grn.id, 'supplier_id': sup.id, 'supplier_invoice_number': 'F-9', 'invoice_date': '2026-11-09',
            'items': [{'material_id': test_material.id, 'quantity': 2, 'unit_price': 500, 'uom': 'KG', 'description': 'x'}]}
    first = client.post('/api/purchasing/purchase-invoices', json=body, headers=auth_headers).get_json()
    old_id = first['invoice']['id']; number = first['invoice']['invoice_number']
    body['replace_invoice_id'] = old_id; body['items'][0]['unit_price'] = 700
    r = client.post('/api/purchasing/purchase-invoices', json=body, headers=auth_headers)
    assert r.status_code == 201, r.get_json()
    new = Invoice.query.filter_by(invoice_number=number).first()
    assert float(new.total_amount) == 1400 and new.grn_id == grn.id and new.id != old_id


def test_no_auto_grn_when_service_line_already_received_by_manual_grn(client, auth_headers, db_session):
    from models.finance import GlobalAccountDefault
    from models.product import Material
    from models.purchasing import GoodsReceivedNote, GRNItem, PurchaseOrder, PurchaseOrderItem, Supplier
    db_session.add(GlobalAccountDefault(transaction_key='accounts_payable', account_id=_acc(db_session, '9-1000').id)); db_session.commit()
    m = Material(code='JASA-1', name='Jasa Kirim', material_type='non_inventory', category='Jasa', primary_uom='UNIT', akun_beban_id=_acc(db_session, '6-6000').id, is_active=True)
    db_session.add(m); sup = Supplier(code='SUP-AG', company_name='Sup AG', is_active=True); db_session.add(sup); db_session.commit()
    po = PurchaseOrder(po_number='PO-AG-1', supplier_id=sup.id, order_date=date.today(), status='approved', total_amount=100)
    db_session.add(po); db_session.commit()
    poi = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=m.id, quantity=1, uom='UNIT', unit_price=100, total_price=100)
    db_session.add(poi); db_session.commit()
    g = GoodsReceivedNote(grn_number='BPB-AG-1', po_id=po.id, supplier_id=sup.id, receipt_date=date.today(), status='approved')
    db_session.add(g); db_session.commit()
    db_session.add(GRNItem(grn_id=g.id, po_item_id=poi.id, material_id=m.id, quantity_ordered=1, quantity_received=1, quantity_accepted=1, uom='UNIT')); db_session.commit()
    r = client.post('/api/purchasing/purchase-invoices', headers=auth_headers, json={
        'po_id': po.id, 'supplier_id': sup.id, 'supplier_invoice_number': 'F-AG', 'invoice_date': '2026-11-09',
        'items': [{'po_item_id': poi.id, 'quantity': 1, 'unit_price': 100}]})
    assert r.status_code == 201, r.get_json()
    assert GoodsReceivedNote.query.filter_by(po_id=po.id).count() == 1


def test_grn_print_normal_and_batch_detail(client, auth_headers, db_session, test_material):
    from models.purchasing import GoodsReceivedNote, GRNItem, Supplier
    sup = Supplier(code='SUP-PR', company_name='Sup Print', is_active=True); db_session.add(sup); db_session.commit()
    g = GoodsReceivedNote(grn_number='BPB-PR-1', supplier_id=sup.id, receipt_date=date.today(), status='approved'); db_session.add(g); db_session.commit()
    for b, q in (('B1', 3), ('B2', 4)):
        db_session.add(GRNItem(grn_id=g.id, po_item_id=None, material_id=test_material.id, quantity_ordered=q, quantity_received=q, quantity_accepted=q, uom='KG', batch_number=b))
    db_session.commit()
    r1 = client.post(f'/api/documents/generate-from-grn/{g.id}', json={}, headers=auth_headers)
    r2 = client.post(f'/api/documents/generate-from-grn/{g.id}', json={'detail': True}, headers=auth_headers)
    assert r1.status_code == 201 and r2.status_code == 201, (r1.get_json(), r2.get_json())
    from models.document_management import Document
    d1 = db_session.get(Document, r1.get_json()['document_id']); d2 = db_session.get(Document, r2.get_json()['document_id'])
    assert len(d1.document_data['lines']) == 1 and d1.document_data['lines'][0]['qty'] == 7 and d1.document_data['lines'][0]['batch_text'] == '2 batch'
    assert [x['batch_text'] for x in d2.document_data['lines']] == ['B1', 'B2']


def test_uom_options_include_roll_conversion(client, auth_headers, db_session, test_material):
    from models.uom import UnitOfMeasure, UoMConversion
    pcs = UnitOfMeasure(code='PCS', name='Pieces', category='count', is_active=True)
    rol = UnitOfMeasure(code='ROL', name='Roll', category='count', is_active=True)
    db_session.add_all([pcs, rol]); db_session.commit()
    test_material.primary_uom = 'PCS'; db_session.commit()
    db_session.add(UoMConversion(from_uom_id=rol.id, to_uom_id=pcs.id, conversion_factor=13635, material_id=test_material.id)); db_session.commit()
    r = client.get(f'/api/purchasing/uom-options?material_id={test_material.id}', headers=auth_headers).get_json()
    assert r['base'] == 'PCS' and {'code': 'ROL', 'factor': 13635.0} in r['options'] and {'code': 'PCS', 'factor': 1.0} in r['options']


def test_zero_total_purchase_invoice_is_paid_automatically(client, auth_headers, db_session, test_material):
    from models.finance import GlobalAccountDefault, Invoice
    from models.purchasing import GoodsReceivedNote, GRNItem, Supplier
    main_location, _ = _setup_warehouse(db_session)
    db_session.add(GlobalAccountDefault(transaction_key='gr_ir_clearing', account_id=_acc(db_session, '6-6000').id))
    db_session.add(GlobalAccountDefault(transaction_key='accounts_payable', account_id=_acc(db_session, '9-1000').id)); db_session.commit()
    sup = Supplier(code='SUP-ZERO', company_name='Sup Zero', is_active=True); db_session.add(sup); db_session.commit()
    grn = GoodsReceivedNote(grn_number='BPB-ZERO-1', supplier_id=sup.id, receipt_date=date.today(), status='approved'); db_session.add(grn); db_session.commit()
    db_session.add(GRNItem(grn_id=grn.id, material_id=test_material.id, quantity_ordered=2, quantity_received=2, quantity_accepted=2, uom='KG', location_id=main_location.id)); db_session.commit()
    r = client.post('/api/purchasing/purchase-invoices', headers=auth_headers, json={
        'grn_id': grn.id, 'supplier_id': sup.id, 'supplier_invoice_number': 'F-0', 'invoice_date': '2026-11-09',
        'items': [{'material_id': test_material.id, 'quantity': 2, 'unit_price': 0, 'uom': 'KG', 'description': 'titipan customer'}]})
    assert r.status_code == 201, r.get_json()
    inv = Invoice.query.filter_by(grn_id=grn.id).first()
    assert inv.status == 'paid' and float(inv.balance_due) == 0


def test_purchase_invoice_with_pph_reduces_payable_and_posts_balanced_journal(client, auth_headers, db_session, test_material):
    from models.finance import AccountingEntry, GlobalAccountDefault, Invoice
    from models.purchasing import GoodsReceivedNote, GRNItem, Supplier
    main_location, _ = _setup_warehouse(db_session)
    db_session.add(GlobalAccountDefault(transaction_key='gr_ir_clearing', account_id=_acc(db_session, '6-6000').id))
    db_session.add(GlobalAccountDefault(transaction_key='accounts_payable', account_id=_acc(db_session, '9-1000').id)); db_session.commit()
    sup = Supplier(code='SUP-PPH', company_name='Sup PPh', is_active=True); db_session.add(sup); db_session.commit()
    grn = GoodsReceivedNote(grn_number='BPB-PPH-1', supplier_id=sup.id, receipt_date=date.today(), status='approved'); db_session.add(grn); db_session.commit()
    db_session.add(GRNItem(grn_id=grn.id, material_id=test_material.id, quantity_ordered=14920, quantity_received=14920, quantity_accepted=14920, uom='KG', location_id=main_location.id)); db_session.commit()
    r = client.post('/api/purchasing/purchase-invoices', headers=auth_headers, json={
        'grn_id': grn.id, 'supplier_id': sup.id, 'supplier_invoice_number': 'F-PPH', 'invoice_date': '2026-11-09',
        'pph_type': 'PPh 22', 'pph_rate': 1.5, 'pph_amount': 384936,
        'items': [{'material_id': test_material.id, 'quantity': 14920, 'unit_price': 1720, 'uom': 'KG', 'description': 'batu bara', 'ppn_code': 'Y'}]})
    assert r.status_code == 201, r.get_json()
    inv = Invoice.query.filter_by(grn_id=grn.id).first()
    assert round(float(inv.total_amount), 2) == 28100328.0 and float(inv.pph_amount) == 384936 and inv.pph_type == 'PPh 22'
    entries = AccountingEntry.query.filter_by(reference_type='purchase_invoice', reference_id=inv.id).all()
    assert round(sum(float(e.debit_amount or 0) for e in entries), 2) == round(sum(float(e.credit_amount or 0) for e in entries), 2) == 28485264.0
    assert any('PPh 22' in (e.description or '') and float(e.credit_amount) == 384936 for e in entries)
