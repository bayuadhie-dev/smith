from datetime import date

from models import AccountingEntry, Invoice
from models.purchasing import Supplier, PurchaseOrder
from tests.test_void_gl import _setup_accounts


def _sup(db_session, code='SUP-DP-1'):
    s = Supplier(code=code, company_name='Pemasok Uji ' + code)
    db_session.add(s); db_session.commit()
    return s


def _po(db_session, sup, num='PO-DP-1', status='approved'):
    po = PurchaseOrder(po_number=num, supplier_id=sup.id, order_date=date.today(), status=status, subtotal=0, total_amount=0)
    db_session.add(po); db_session.commit()
    return po


def _inv(db_session, sup, total=1000.0, po=None, num='PI-DP-1'):
    i = Invoice(invoice_number=num, invoice_type='purchase', invoice_date=date.today(), supplier_id=sup.id, purchase_order_id=po.id if po else None,
                subtotal=total, tax_amount=0, total_amount=total, balance_due=total, status='sent')
    db_session.add(i); db_session.commit()
    return i


def _dp(client, h, bank, po=None, sup=None, amount=600):
    body = {'amount': amount, 'bank_account_id': bank.id, 'dp_date': date.today().isoformat()}
    if po:
        body['po_id'] = po.id
    if sup:
        body['supplier_id'] = sup.id
    return client.post('/api/purchasing/down-payments', headers=h, json=body)


def _bal(db_session, ref_type, ref_id):
    rows = AccountingEntry.query.filter_by(reference_type=ref_type, reference_id=ref_id).all()
    return rows, round(sum(float(r.debit_amount) for r in rows), 2), round(sum(float(r.credit_amount) for r in rows), 2)


def test_post_allocate_reverse_and_cancel(client, auth_headers, db_session):
    acc = _setup_accounts(db_session)
    sup = _sup(db_session); po = _po(db_session, sup); inv = _inv(db_session, sup, 1000, po)
    r = _dp(client, auth_headers, acc['bank'], po=po)
    assert r.status_code == 201, r.get_json()
    did = r.get_json()['id']
    assert r.get_json()['dp_number'].startswith('DPP')
    rows, dr, cr = _bal(db_session, 'purchase_down_payment', did)
    assert dr == cr == 600.0 and len(rows) == 2
    dpacc = next(x for x in rows if float(x.debit_amount) > 0)
    assert 'Uang Muka' in dpacc.account_name and any(x.account_id == acc['bank'].id and float(x.credit_amount) == 600 for x in rows)

    assert client.post(f'/api/purchasing/down-payments/{did}/allocate', headers=auth_headers, json={'invoice_id': inv.id, 'amount': 700}).status_code == 400
    ok = client.post(f'/api/purchasing/down-payments/{did}/allocate', headers=auth_headers, json={'invoice_id': inv.id, 'amount': 250})
    assert ok.status_code == 201, ok.get_json()
    assert ok.get_json()['invoice_balance_due'] == 750 and ok.get_json()['remaining'] == 350
    db_session.expire_all()
    i = db_session.get(Invoice, inv.id)
    assert float(i.balance_due) == 750 and float(i.credit_applied) == 250 and i.status == 'partial'
    aid = ok.get_json()['allocation_id']
    arows, adr, acr = _bal(db_session, 'purchase_dp_allocation', aid)
    assert adr == acr == 250.0 and any(x.account_id == acc['hutang'].id and float(x.debit_amount) == 250 for x in arows)

    assert client.post(f'/api/purchasing/down-payments/{did}/cancel', headers=auth_headers).status_code == 400   # masih teralokasi
    assert client.post(f'/api/purchasing/down-payments/allocations/{aid}/reverse', headers=auth_headers).status_code == 200
    db_session.expire_all()
    i = db_session.get(Invoice, inv.id)
    assert float(i.balance_due) == 1000 and float(i.credit_applied) == 0
    _, vdr, vcr = _bal(db_session, 'void_purchase_dp_allocation', aid)
    assert vdr == vcr == 250.0
    assert client.get(f'/api/purchasing/down-payments/{did}', headers=auth_headers).get_json()['remaining'] == 600

    assert client.post(f'/api/purchasing/down-payments/{did}/cancel', headers=auth_headers).status_code == 200
    _, cdr, ccr = _bal(db_session, 'void_purchase_down_payment', did)
    assert cdr == ccr == 600.0
    assert client.post(f'/api/purchasing/down-payments/{did}/allocate', headers=auth_headers, json={'invoice_id': inv.id, 'amount': 10}).status_code == 400


def test_full_allocation_marks_invoice_paid_and_validations(client, auth_headers, db_session):
    acc = _setup_accounts(db_session)
    sup = _sup(db_session); other = _sup(db_session, 'SUP-DP-2')
    po = _po(db_session, sup, 'PO-DP-A'); po2 = _po(db_session, sup, 'PO-DP-B')
    inv = _inv(db_session, sup, 500, po, 'PI-DP-A')
    foreign_sup = _inv(db_session, other, 500, None, 'PI-DP-X')
    other_po = _inv(db_session, sup, 500, po2, 'PI-DP-B')
    no_po = _inv(db_session, sup, 100, None, 'PI-DP-C')
    did = _dp(client, auth_headers, acc['bank'], po=po, amount=500).get_json()['id']
    allocate = lambda i, a: client.post(f'/api/purchasing/down-payments/{did}/allocate', headers=auth_headers, json={'invoice_id': i.id, 'amount': a})
    assert allocate(foreign_sup, 10).status_code == 400
    assert allocate(other_po, 10).status_code == 400
    assert allocate(no_po, 100).status_code == 201          # faktur tanpa PO tetap boleh
    assert allocate(inv, 400).status_code == 201
    db_session.expire_all()
    assert db_session.get(Invoice, no_po.id).status == 'paid' and float(db_session.get(Invoice, no_po.id).balance_due) == 0
    assert allocate(inv, 1).status_code == 400              # uang muka habis


def test_create_validations_and_by_po(client, auth_headers, db_session):
    acc = _setup_accounts(db_session)
    sup = _sup(db_session)
    draft = _po(db_session, sup, 'PO-DP-D', status='draft')
    assert _dp(client, auth_headers, acc['bank'], po=draft).status_code == 400
    assert _dp(client, auth_headers, acc['bank'], sup=sup, amount=0).status_code == 400
    assert client.post('/api/purchasing/down-payments', headers=auth_headers, json={'amount': 5, 'supplier_id': sup.id, 'bank_account_id': acc['beban'].id}).status_code == 400
    po = _po(db_session, sup, 'PO-DP-OK')
    _dp(client, auth_headers, acc['bank'], po=po, amount=300); _dp(client, auth_headers, acc['bank'], po=po, amount=200)
    d = client.get(f'/api/purchasing/down-payments/by-po/{po.id}', headers=auth_headers).get_json()
    assert d['paid'] == 500 and d['remaining'] == 500
    lst = client.get('/api/purchasing/down-payments?open=1', headers=auth_headers).get_json()
    assert lst['summary']['paid'] == 500 and lst['total'] == 2
