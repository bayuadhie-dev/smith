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


def test_auto_grn_for_non_inventory_and_overdelivery(client, auth_headers, db_session):
    from models.purchasing import Supplier, PurchaseOrder, PurchaseOrderItem, GoodsReceivedNote
    from models.product import Material
    from models.finance import GlobalAccountDefault
    from tests.test_finance_sync_regressions import _acc
    exp = _acc(db_session, '9-1000')
    for key in ('akun_persediaan_id', 'akun_beban_id', 'accounts_payable'):
        if not GlobalAccountDefault.query.filter_by(transaction_key=key).first():
            db_session.add(GlobalAccountDefault(transaction_key=key, account_id=exp.id))
    mat = Material(code='SVC-1', name='Bahan bakar', material_type='non_inventory', category='Service', primary_uom='KG', cost_per_unit=0, is_active=True)
    db_session.add(mat); db_session.commit()
    sup = Supplier(code='SUP-AG', company_name='PT AG'); db_session.add(sup); db_session.commit()
    po = PurchaseOrder(po_number='PO-AG-1', supplier_id=sup.id, order_date=datetime(2026, 11, 5), status='approved', currency='IDR', total_amount=0)
    db_session.add(po); db_session.commit()
    it = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=mat.id, quantity=10000, uom='KG', unit_price=1750, total_price=17500000)
    db_session.add(it); db_session.commit()
    r = client.post('/api/purchasing/purchase-invoices', json={'po_id': po.id, 'supplier_id': sup.id, 'supplier_invoice_number': 'S-AG', 'invoice_date': '2026-11-06',
                    'items': [{'po_item_id': it.id, 'quantity': 14920, 'unit_price': 1750}]}, headers=auth_headers)
    assert r.status_code == 201, r.get_json()
    g = GoodsReceivedNote.query.filter_by(po_id=po.id).all()
    assert len(g) == 1 and g[0].status == 'approved' and g[0].grn_number.startswith('BPB-')
    db_session.refresh(it); assert float(it.quantity_received) == 14920
    inv_id = r.get_json()['invoice']['id']
    from tests.test_void_gl import _void_invoice_direct
    _void_invoice_direct(inv_id, 'uji')
    db_session.refresh(it); db_session.refresh(g[0])
    assert g[0].status == 'rejected' and float(it.quantity_received) == 0
