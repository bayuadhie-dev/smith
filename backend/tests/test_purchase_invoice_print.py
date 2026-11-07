from datetime import datetime


def test_purchase_invoice_document(client, auth_headers, db_session, test_material):
    from models.purchasing import Supplier, PurchaseOrder, PurchaseOrderItem
    from models.finance import GlobalAccountDefault
    from tests.test_finance_sync_regressions import _acc
    sup = Supplier(code='SUP-PR', company_name='PT PRINT', address='Jl. Uji 1', tax_id='01.234'); db_session.add(sup); db_session.commit()
    po = PurchaseOrder(po_number='PO-PR-1', supplier_id=sup.id, order_date=datetime(2026, 11, 5), status='approved', currency='IDR', total_amount=0)
    db_session.add(po); db_session.commit()
    it = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=test_material.id, quantity=10, uom='KG', unit_price=100, total_price=1000, description='Nama PO', notes='ket')
    db_session.add(it); db_session.commit()
    exp = _acc(db_session, '9-1000')
    for key in ('akun_persediaan_id', 'akun_beban_id', 'accounts_payable'):
        if not GlobalAccountDefault.query.filter_by(transaction_key=key).first():
            db_session.add(GlobalAccountDefault(transaction_key=key, account_id=exp.id))
    db_session.commit()
    r = client.post('/api/purchasing/purchase-invoices', json={'po_id': po.id, 'supplier_id': sup.id, 'supplier_invoice_number': 'S-9', 'invoice_date': '2026-11-06',
                    'items': [{'po_item_id': it.id, 'quantity': 12, 'unit_price': 100}], 'notes': 'Catatan faktur'}, headers=auth_headers)
    assert r.status_code == 201, r.get_json()
    inv_id = r.get_json()['invoice']['id']
    g = client.post(f'/api/documents/generate-from-purchase-invoice/{inv_id}', headers=auth_headers)
    assert g.status_code == 201, g.get_json()
    p = client.get(f"/api/documents/{g.get_json()['document_id']}/preview", headers=auth_headers).get_json()
    html = p['document']['html_content']
    assert 'FAKTUR PEMBELIAN' in html and 'PT PRINT' in html and 'S-9' in html and 'Nama PO' in html
