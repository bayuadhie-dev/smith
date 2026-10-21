"""
Fase 20 (fix_report_3.md, 2026-10-03): found live while adding the missing
"Generate Invoice" frontend button (generate-from-invoice/<id> existed in
the backend since the Print Template Designer work but had no UI entry
point anywhere - InvoiceForm.tsx never used DocumentGenerateButton).
generate_invoice_document() (utils/document_generator.py) referenced
customer.address, a column that doesn't exist on the Customer model (it's
billing_address, same field the Surat Jalan generator already uses
correctly) - crashed with AttributeError on first real use.
"""


def test_generate_invoice_document_does_not_crash_on_customer_address(client, auth_headers, db_session, test_user):
    from datetime import date
    from models.sales import Customer
    from models.finance import Invoice, InvoiceItem

    customer = Customer(code='CUST-F20-001', company_name='PT Uji Invoice', billing_address='Jl. Uji No. 1')
    db_session.add(customer)
    db_session.commit()

    invoice = Invoice(
        invoice_number='INV-TEST-F20-001', invoice_type='sales', invoice_date=date.today(), customer_id=customer.id,
        subtotal=100000, tax_amount=11000, total_amount=111000, status='draft',
        created_by=test_user.id,
    )
    db_session.add(invoice)
    db_session.commit()
    item = InvoiceItem(invoice_id=invoice.id, line_number=1, description='Item Uji', quantity=1, unit_price=100000, total_amount=100000)
    db_session.add(item)
    db_session.commit()

    resp = client.post(f'/api/documents/generate-from-invoice/{invoice.id}', headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    from models.document_management import Document
    doc = Document.query.filter_by(reference_type='invoice', reference_id=invoice.id).first()
    assert doc is not None
    assert doc.document_data['customer_address'] == 'Jl. Uji No. 1'
