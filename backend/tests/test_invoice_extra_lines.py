from datetime import datetime


def test_invoice_over_qty_and_extra_line(client, auth_headers, db_session, test_material):
    from models.purchasing import Supplier, PurchaseOrder, PurchaseOrderItem
    from models.finance import Account
    from tests.test_finance_sync_regressions import _acc
    sup = Supplier(code='SUP-X1', company_name='PT X1'); db_session.add(sup); db_session.commit()
    po = PurchaseOrder(po_number='PO-X1', supplier_id=sup.id, order_date=datetime(2026, 11, 5), status='approved', currency='IDR', total_amount=0)
    db_session.add(po); db_session.commit()
    it = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=test_material.id, quantity=10, uom='KG', unit_price=100, total_price=1000)
    db_session.add(it); db_session.commit()
    exp = _acc(db_session, '9-1000')
    from models.finance import GlobalAccountDefault
    for key in ('akun_persediaan_id', 'akun_beban_id', 'accounts_payable'):
        if not GlobalAccountDefault.query.filter_by(transaction_key=key).first():
            db_session.add(GlobalAccountDefault(transaction_key=key, account_id=exp.id))
    db_session.commit()
    body = {'po_id': po.id, 'supplier_id': sup.id, 'supplier_invoice_number': 'S-1', 'invoice_date': '2026-11-06',
            'items': [{'po_item_id': it.id, 'quantity': 15, 'unit_price': 100},
                      {'account_id': exp.id, 'description': 'Ongkos kirim', 'quantity': 1, 'unit_price': 50}]}
    r = client.post('/api/purchasing/purchase-invoices', json=body, headers=auth_headers)
    assert r.status_code == 201, r.get_json()
    bad = {**body, 'items': [{'description': 'x', 'quantity': 1, 'unit_price': 5}]}
    assert client.post('/api/purchasing/purchase-invoices', json=bad, headers=auth_headers).status_code == 400
