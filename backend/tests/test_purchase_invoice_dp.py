from datetime import date

from models.finance import Invoice, InvoiceItem
from tests.test_fase11_purchase_invoice_total_price_fallback import _setup_po
from tests.test_void_gl import _setup_accounts


def _make_invoice(client, h, supplier, po, po_item, material, qty=5, desc=None):
    item = {'po_item_id': po_item.id, 'material_id': material.id, 'quantity': qty, 'uom': 'KG', 'unit_price': 10000}
    if desc is not None:
        item['description'] = desc
    r = client.post('/api/purchasing/purchase-invoices', headers=h, json={
        'po_id': po.id, 'supplier_id': supplier.id, 'supplier_invoice_number': 'SI-1',
        'invoice_date': date.today().isoformat(), 'due_date': date.today().isoformat(), 'items': [item]})
    assert r.status_code == 201, r.get_json()
    return r.get_json()['invoice']['id']


def test_line_description_edited_in_invoice_is_saved(client, auth_headers, db_session):
    supplier, material, po, po_item = _setup_po(db_session)
    iid = _make_invoice(client, auth_headers, supplier, po, po_item, material, desc='Karbon rotary joint 2 inch')
    assert InvoiceItem.query.filter_by(invoice_id=iid).first().description == 'Karbon rotary joint 2 inch'


def test_line_description_defaults_to_po_line_when_not_sent(client, auth_headers, db_session):
    supplier, material, po, po_item = _setup_po(db_session)
    iid = _make_invoice(client, auth_headers, supplier, po, po_item, material)
    assert InvoiceItem.query.filter_by(invoice_id=iid).first().description == po_item.description


def test_open_down_payments_listed_and_allocated_after_invoice(client, auth_headers, db_session):
    from models.finance import GlobalAccountDefault
    acc = _setup_accounts(db_session)
    # _setup_po memasang akun bawaan sendiri; kosongkan yang dari _setup_accounts agar tidak bentrok (kunci unik)
    GlobalAccountDefault.query.filter(GlobalAccountDefault.transaction_key.in_(['accounts_payable', 'akun_persediaan_id'])).delete(synchronize_session=False)
    db_session.commit()
    supplier, material, po, po_item = _setup_po(db_session)
    dp = client.post('/api/purchasing/down-payments', headers=auth_headers, json={
        'amount': 30000, 'bank_account_id': acc['bank'].id, 'dp_date': date.today().isoformat(), 'po_id': po.id})
    assert dp.status_code == 201, dp.get_json()
    did = dp.get_json()['id']

    lst = client.get(f'/api/purchasing/down-payments?supplier_id={supplier.id}&open=1', headers=auth_headers).get_json()
    assert [d['id'] for d in lst['down_payments']] == [did] and lst['down_payments'][0]['remaining'] == 30000

    iid = _make_invoice(client, auth_headers, supplier, po, po_item, material, qty=5)
    ok = client.post(f'/api/purchasing/down-payments/{did}/allocate', headers=auth_headers, json={'invoice_id': iid, 'amount': 30000})
    assert ok.status_code == 201, ok.get_json()
    db_session.expire_all()
    assert float(db_session.get(Invoice, iid).balance_due) == 20000
    after = client.get(f'/api/purchasing/down-payments?supplier_id={supplier.id}&open=1', headers=auth_headers).get_json()
    assert after['down_payments'] == []
