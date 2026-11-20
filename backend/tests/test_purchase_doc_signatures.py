"""Nama penanda tangan ikut tercetak di Faktur Pembelian dan Pencocokan 3 Arah.

Dua lembar ini sebelumnya hanya punya garis kosong, sementara lembar PO sudah
mencetak nama pembuat dan penyetuju - Finance menandatangani kertas tanpa tahu
siapa yang seharusnya tanda tangan.
"""
from datetime import date


def _purchase_invoice(db_session, test_user):
    from models.purchasing import Supplier, PurchaseOrder, PurchaseOrderItem
    from models.finance import Invoice, InvoiceItem

    supplier = Supplier(code='SUP-SIGN', company_name='PT Uji Tanda Tangan', address='Jl. Uji 1')
    db_session.add(supplier)
    db_session.commit()
    po = PurchaseOrder(po_number='PO-SIGN-1', supplier_id=supplier.id, order_date=date.today(),
                       status='approved', currency='IDR', subtotal=1000, total_amount=1000,
                       created_by=test_user.id)
    db_session.add(po)
    db_session.commit()
    db_session.add(PurchaseOrderItem(po_id=po.id, line_number=1, description='Kain', quantity=10,
                                     unit_price=100, total_price=1000, uom='KG'))
    inv = Invoice(invoice_number='PI-SIGN-1', invoice_type='purchase', supplier_id=supplier.id,
                  purchase_order_id=po.id, invoice_date=date.today(), due_date=date.today(),
                  subtotal=1000, total_amount=1000, status='draft', created_by=test_user.id)
    db_session.add(inv)
    db_session.commit()
    db_session.add(InvoiceItem(invoice_id=inv.id, line_number=1, description='Kain', quantity=10,
                               unit_price=100, total_amount=1000, uom='KG'))
    db_session.commit()
    return inv


def _setting(db_session, key, value):
    from models.settings import SystemSetting
    db_session.add(SystemSetting(setting_key=key, setting_category='general',
                                 setting_name=key, setting_value=value, data_type='string'))
    db_session.commit()


def test_purchase_invoice_prints_names(client, auth_headers, db_session, test_user):
    _setting(db_session, 'general.po_approver_name', 'Hizkia Wijaya')
    inv = _purchase_invoice(db_session, test_user)

    resp = client.post(f'/api/documents/generate-from-purchase-invoice/{inv.id}', headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    from models.document_management import Document
    doc = Document.query.filter_by(reference_type='purchase_invoice', reference_id=inv.id).first()
    d = doc.document_data
    assert d['prepared_by_name'] == (test_user.full_name or test_user.username)
    # tanpa setelan khusus dokumen keuangan, memakai nama penyetuju PO
    assert d['approved_by_name'] == 'Hizkia Wijaya'
    assert 'Hizkia Wijaya' in doc.html_content


def test_doc_approver_overrides_po_approver(client, auth_headers, db_session, test_user):
    _setting(db_session, 'general.po_approver_name', 'Hizkia Wijaya')
    _setting(db_session, 'general.doc_approver_name', 'Jessica')
    inv = _purchase_invoice(db_session, test_user)

    resp = client.post(f'/api/documents/generate-from-purchase-invoice/{inv.id}', headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()
    from models.document_management import Document
    d = Document.query.filter_by(reference_type='purchase_invoice', reference_id=inv.id).first().document_data
    assert d['approved_by_name'] == 'Jessica'


def test_three_way_match_prints_three_names(client, auth_headers, db_session, test_user):
    _setting(db_session, 'general.po_approver_name', 'Hizkia Wijaya')
    inv = _purchase_invoice(db_session, test_user)

    resp = client.post(f'/api/documents/generate-from-three-way-match/{inv.id}', headers=auth_headers)
    assert resp.status_code == 201, (resp.status_code, resp.get_json())
    from models.document_management import Document
    doc = Document.query.filter_by(document_type='three_way_match', reference_id=inv.id).first()
    d = doc.document_data
    nama = test_user.full_name or test_user.username
    assert d['prepared_by_name'] == nama and d['checked_by_name'] == nama
    assert d['approved_by_name'] == 'Hizkia Wijaya'
