"""
Fase 20 (fix_report_3.md, 2026-10-05): user explicitly asked for real
frontend detail pages for the dead-end routes found while screenshotting
the WETKINS BABY BLUE E2E verification report
(/finance/payments/:id -> PaymentForm, /quality/inspections/:id ->
QualityTestForm), both of which ignore their own :id param and always
render a blank create form. Added GET /payments/<id> and
GET /inspections/<id> backend detail endpoints to back the new
PaymentDetail.tsx / QualityInspectionDetail.tsx frontend pages.
"""
from datetime import date, datetime


def test_get_payment_detail_includes_invoice_and_gl_entries(client, auth_headers, db_session, test_user):
    from models.sales import Customer
    from models.finance import Invoice, InvoiceItem, Payment, Account, AccountingEntry

    customer = Customer(code='CUST-F20-PAY', company_name='PT Uji Payment')
    db_session.add(customer)
    db_session.commit()

    invoice = Invoice(
        invoice_number='INV-TEST-F20-PAY', invoice_type='sales', invoice_date=date.today(),
        customer_id=customer.id, subtotal=100000, total_amount=100000, status='paid',
        created_by=test_user.id,
    )
    db_session.add(invoice)
    db_session.commit()

    bank = Account(account_code='TEST-F20-BANK', account_name='Kas Test F20', account_type='asset', normal_balance='debit', is_cash_bank=True)
    ar = Account(account_code='TEST-F20-AR', account_name='Piutang Test F20', account_type='asset', normal_balance='debit')
    db_session.add_all([bank, ar])
    db_session.commit()

    payment = Payment(
        payment_number='PAY-TEST-F20-001', payment_date=date.today(), payment_type='receipt',
        invoice_id=invoice.id, customer_id=customer.id, payment_method='bank_transfer',
        amount=100000, bank_account_id=bank.id, status='cleared', received_by=test_user.id,
    )
    db_session.add(payment)
    db_session.commit()

    entry1 = AccountingEntry(entry_number='JE-TEST-F20-01', entry_date=date.today(), entry_type='payment', account_id=bank.id, account_code=bank.account_code, account_name=bank.account_name, debit_amount=100000, credit_amount=0, reference_type='payment', reference_id=payment.id, description='Kas masuk')
    entry2 = AccountingEntry(entry_number='JE-TEST-F20-02', entry_date=date.today(), entry_type='payment', account_id=ar.id, account_code=ar.account_code, account_name=ar.account_name, debit_amount=0, credit_amount=100000, reference_type='payment', reference_id=payment.id, description='Piutang berkurang')
    db_session.add_all([entry1, entry2])
    db_session.commit()

    resp = client.get(f'/api/finance/payments/{payment.id}', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()
    assert data['payment_number'] == 'PAY-TEST-F20-001'
    assert data['invoice_number'] == 'INV-TEST-F20-PAY'
    assert data['customer_name'] == 'PT Uji Payment'
    assert data['bank_account_code'] == 'TEST-F20-BANK'
    assert len(data['gl_entries']) == 2
    total_debit = sum(e['debit_amount'] for e in data['gl_entries'])
    total_credit = sum(e['credit_amount'] for e in data['gl_entries'])
    assert total_debit == total_credit == 100000.0


def test_get_payment_detail_404_for_missing_payment(client, auth_headers):
    resp = client.get('/api/finance/payments/999999', headers=auth_headers)
    assert resp.status_code == 404


def test_get_inspection_detail_includes_product_and_disposition(client, auth_headers, db_session, test_product, test_user):
    from models.quality import QualityInspection

    inspection = QualityInspection(
        inspection_number='QI-TEST-F20-001', inspection_date=datetime.utcnow(), inspection_type='final',
        product_id=test_product.id, batch_number='BATCH-F20-TEST', sample_size=10, defect_count=0,
        status='completed', result='passed', disposition='released', disposition_notes='Lolos QC fisik+kimia',
        inspector_id=test_user.id, created_by=test_user.id,
    )
    db_session.add(inspection)
    db_session.commit()

    resp = client.get(f'/api/quality/inspections/{inspection.id}', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()
    assert data['inspection_number'] == 'QI-TEST-F20-001'
    assert data['product_id'] == test_product.id
    assert data['disposition'] == 'released'
    assert data['disposition_notes'] == 'Lolos QC fisik+kimia'
    assert data['inspector_name'] is not None


def test_get_inspection_detail_404_for_missing_inspection(client, auth_headers):
    resp = client.get('/api/quality/inspections/999999', headers=auth_headers)
    assert resp.status_code == 404
