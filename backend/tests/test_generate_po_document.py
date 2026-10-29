def _make_po(db_session, test_user, currency, taxable, inclusive):
    from datetime import date
    from models.purchasing import Supplier, PurchaseOrder, PurchaseOrderItem

    supplier = Supplier(code=f'SUP-PO-{currency}', company_name='Hangzhou Uji Textile', address='No. 1 Road',
                        city='Hangzhou', country='China', phone='+86 123', email='a@b.cn',
                        contact_person='Mr Li', tax_id='TX-9')
    db_session.add(supplier)
    db_session.commit()
    po = PurchaseOrder(po_number=f'PO-DOC-{currency}', supplier_id=supplier.id, order_date=date.today(),
                       expected_date=date(2026, 12, 1), status='draft', currency=currency, exchange_rate=17900,
                       subtotal=1000, tax_amount=0, total_amount=1000, is_taxable=taxable, tax_inclusive=inclusive,
                       ppn_code='Y' if taxable else None, created_by=test_user.id)
    db_session.add(po)
    db_session.commit()
    db_session.add(PurchaseOrderItem(po_id=po.id, line_number=1, description='Kain Spunbond', quantity=10, unit_price=100,
                                     total_price=1000, uom='KG'))
    db_session.commit()
    return po


def test_po_document_foreign_currency(client, auth_headers, db_session, test_user):
    po = _make_po(db_session, test_user, 'USD', True, False)
    resp = client.post(f'/api/documents/generate-from-purchase-order/{po.id}', headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()
    from models.document_management import Document
    doc = Document.query.filter_by(reference_type='purchase_order', reference_id=po.id).first()
    d = doc.document_data
    assert d['total_text'] == 'US$ 1.000,00'
    assert d['line_items'][0]['unit_price_text'] == 'US$ 100,00'
    assert d['expected_date'] == '01-12-2026'
    assert 'ditambahkan di atas harga' in d['tax_note'] and '11%' in d['tax_note'] and d['tax_label'] == 'PPN 11%'
    assert d['supplier_contact'].startswith('Attn: Mr Li')
    assert 'US$ 1.000,00' in doc.html_content and 'Hangzhou Uji Textile' in doc.html_content


def test_po_document_idr_no_tax(client, auth_headers, db_session, test_user):
    po = _make_po(db_session, test_user, 'IDR', False, False)
    resp = client.post(f'/api/documents/generate-from-purchase-order/{po.id}', headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()
    from models.document_management import Document
    d = Document.query.filter_by(reference_type='purchase_order', reference_id=po.id).first().document_data
    assert d['total_text'] == 'Rp 1.000' and d['tax_note'] == 'Tanpa pajak'


def test_po_document_inclusive_tax_wording_matches_form(client, auth_headers, db_session, test_user):
    po = _make_po(db_session, test_user, 'IDR', True, True)
    resp = client.post(f'/api/documents/generate-from-purchase-order/{po.id}', headers=auth_headers)
    assert resp.status_code == 201
    from models.document_management import Document
    d = Document.query.filter_by(reference_type='purchase_order', reference_id=po.id).first().document_data
    assert d['subtotal_label'] == 'DPP (tanpa PPN)' and d['tax_label'] == 'PPN 11% (termasuk)'
    assert d['tax_note'].startswith('Harga sudah termasuk pajak (PPN Y - 11%)')
