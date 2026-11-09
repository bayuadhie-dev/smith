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
