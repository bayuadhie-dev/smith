"""
Fase 3 (audit 29 Sept 2026): tidak ada endpoint void untuk Sales Invoice
maupun Payment, dan tidak ada logika jurnal pembalik. Void Sales Order
(routes/sales.py, cancel_order) sudah benar dan tidak disentuh di fase ini.

Keputusan pemilik (dikonfirmasi sebelum kode ditulis):
- Void Payment yang sudah dicocokkan (matched) di Rekonsiliasi Bank DITOLAK
  (tidak otomatis unmatch).
- Purchase Invoice ikut dicakup (bukan cuma Sales Invoice).

Diverifikasi lewat endpoint HTTP asli.
"""
from datetime import date


def _setup_accounts(db_session):
    from models.finance import Account, GlobalAccountDefault

    accounts = {
        'piutang': Account(account_code='TEST-VOID-AR', account_name='Piutang Dagang',
                            account_type='asset', normal_balance='debit'),
        'penjualan': Account(account_code='TEST-VOID-SALES', account_name='Penjualan',
                              account_type='revenue', normal_balance='credit'),
        'hutang': Account(account_code='TEST-VOID-AP', account_name='Hutang Usaha',
                           account_type='liability', normal_balance='credit'),
        'beban': Account(account_code='TEST-VOID-EXP', account_name='Beban',
                          account_type='expense', normal_balance='debit'),
        'bank': Account(account_code='TEST-VOID-BANK', account_name='Bank',
                         account_type='asset', normal_balance='debit', is_cash_bank=True),
    }
    for acc in accounts.values():
        db_session.add(acc)
    db_session.commit()

    db_session.add(GlobalAccountDefault(transaction_key='accounts_receivable', account_id=accounts['piutang'].id))
    db_session.add(GlobalAccountDefault(transaction_key='accounts_payable', account_id=accounts['hutang'].id))
    db_session.add(GlobalAccountDefault(transaction_key='akun_penjualan_id', account_id=accounts['penjualan'].id))
    db_session.commit()
    return accounts


def _create_sales_invoice(client, auth_headers, customer_id, product_id, qty, unit_price):
    resp = client.post('/api/finance/invoices', json={
        'invoice_type': 'sales',
        'invoice_date': date.today().isoformat(),
        'customer_id': customer_id,
        'items': [{
            'product_id': product_id,
            'description': 'Test item',
            'quantity': qty,
            'unit_price': unit_price,
        }],
    }, headers=auth_headers)
    assert resp.status_code in (200, 201), resp.get_json()
    return resp.get_json()


def test_void_sales_invoice_without_payment_reverses_journal(client, auth_headers, db_session, test_customer, test_product):
    accounts = _setup_accounts(db_session)
    created = _create_sales_invoice(client, auth_headers, test_customer.id, test_product.id, qty=5, unit_price=100.0)
    invoice_id = created['invoice_id']

    from models.finance import AccountingEntry, Invoice
    from models import db

    original_entries = AccountingEntry.query.filter_by(reference_type='sales_invoice', reference_id=invoice_id).all()
    assert len(original_entries) > 0

    resp = client.post(f'/api/finance/invoices/{invoice_id}/void', json={'reason': 'test void'}, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    invoice = db.session.get(Invoice, invoice_id)
    assert invoice.status == 'cancelled'
    assert invoice.balance_due == 0
    assert invoice.voided_by is not None

    for entry in original_entries:
        db.session.refresh(entry)
        assert entry.status == 'reversed'

    reversal_entries = AccountingEntry.query.filter_by(reference_type='void_sales_invoice', reference_id=invoice_id).all()
    assert len(reversal_entries) > 0
    total_debit = sum(float(e.debit_amount or 0) for e in reversal_entries)
    total_credit = sum(float(e.credit_amount or 0) for e in reversal_entries)
    assert round(total_debit, 2) == round(total_credit, 2)

    # AR (piutang) yang tadinya di-debit harus di-credit balik sebesar total invoice
    piutang_reversal = [e for e in reversal_entries if e.account_id == accounts['piutang'].id]
    assert sum(float(e.credit_amount or 0) for e in piutang_reversal) == float(invoice.total_amount)


def test_void_sales_invoice_with_payment_rejected(client, auth_headers, db_session, test_customer, test_product):
    _setup_accounts(db_session)
    created = _create_sales_invoice(client, auth_headers, test_customer.id, test_product.id, qty=5, unit_price=100.0)
    invoice_id = created['invoice_id']

    from models.finance import Invoice
    from models import db
    invoice = db.session.get(Invoice, invoice_id)
    invoice.paid_amount = 100.0
    db.session.commit()

    resp = client.post(f'/api/finance/invoices/{invoice_id}/void', headers=auth_headers)
    assert resp.status_code == 400
    assert 'Payment' in resp.get_json()['error']


def test_void_payment_reverses_journal_and_restores_invoice_balance(client, auth_headers, db_session, test_customer, test_product):
    accounts = _setup_accounts(db_session)
    created = _create_sales_invoice(client, auth_headers, test_customer.id, test_product.id, qty=5, unit_price=100.0)
    invoice_id = created['invoice_id']

    resp = client.post('/api/finance/payments', json={
        'payment_date': date.today().isoformat(),
        'payment_type': 'receipt',
        'invoice_id': invoice_id,
        'customer_id': test_customer.id,
        'payment_method': 'bank_transfer',
        'amount': 500.0,
        'bank_account_id': accounts['bank'].id,
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()
    payment_id = resp.get_json()['payment_id']

    from models.finance import Invoice
    from models import db
    invoice = db.session.get(Invoice, invoice_id)
    assert invoice.status == 'paid'
    assert float(invoice.balance_due) == 0

    resp2 = client.post(f'/api/finance/payments/{payment_id}/void', json={'reason': 'test void payment'}, headers=auth_headers)
    assert resp2.status_code == 200, resp2.get_json()

    from models.finance import Payment
    payment = db.session.get(Payment, payment_id)
    assert payment.status == 'cancelled'
    assert payment.voided_by is not None

    db.session.refresh(invoice)
    assert float(invoice.paid_amount) == 0
    assert float(invoice.balance_due) == 500.0
    assert invoice.status != 'paid'

    from models.finance import AccountingEntry
    reversal_entries = AccountingEntry.query.filter_by(reference_type='void_payment', reference_id=payment_id).all()
    assert len(reversal_entries) > 0
    total_debit = sum(float(e.debit_amount or 0) for e in reversal_entries)
    total_credit = sum(float(e.credit_amount or 0) for e in reversal_entries)
    assert round(total_debit, 2) == round(total_credit, 2)


def test_void_payment_bank_matched_rejected(client, auth_headers, db_session, test_customer, test_product):
    accounts = _setup_accounts(db_session)
    created = _create_sales_invoice(client, auth_headers, test_customer.id, test_product.id, qty=5, unit_price=100.0)
    invoice_id = created['invoice_id']

    resp = client.post('/api/finance/payments', json={
        'payment_date': date.today().isoformat(),
        'payment_type': 'receipt',
        'invoice_id': invoice_id,
        'customer_id': test_customer.id,
        'payment_method': 'bank_transfer',
        'amount': 500.0,
        'bank_account_id': accounts['bank'].id,
    }, headers=auth_headers)
    payment_id = resp.get_json()['payment_id']

    from models.finance import AccountingEntry, BankStatement, BankStatementLine
    from models import db

    payment_entry = AccountingEntry.query.filter_by(reference_type='payment', reference_id=payment_id).first()
    assert payment_entry is not None

    statement = BankStatement(account_id=accounts['bank'].id, period_start=date.today(), period_end=date.today())
    db.session.add(statement)
    db.session.commit()
    line = BankStatementLine(
        statement_id=statement.id, line_date=date.today(), amount=500.0,
        is_matched=True, matched_accounting_entry_id=payment_entry.id,
    )
    db.session.add(line)
    db.session.commit()

    resp2 = client.post(f'/api/finance/payments/{payment_id}/void', headers=auth_headers)
    assert resp2.status_code == 400
    assert 'Rekonsiliasi' in resp2.get_json()['error']


def test_void_purchase_invoice_reverses_journal(client, auth_headers, db_session):
    """Purchase Invoice void - dites dengan journal yang disiapkan langsung
    (reference_type='purchase_invoice') supaya tidak perlu membangun seluruh
    rantai PO->GRN->Purchase Invoice hanya untuk menguji endpoint void-nya."""
    accounts = _setup_accounts(db_session)

    from models.purchasing import Supplier
    from models.finance import Invoice, AccountingEntry
    from models import db

    supplier = Supplier(code='SUP-VOID-01', company_name='Test Supplier')
    db_session.add(supplier)
    db_session.commit()

    invoice = Invoice(
        invoice_number='PI-VOID-TEST-001', invoice_type='purchase',
        invoice_date=date.today(), supplier_id=supplier.id,
        subtotal=800.0, tax_amount=0, total_amount=800.0, balance_due=800.0,
        status='sent',
    )
    db_session.add(invoice)
    db_session.commit()

    entry1 = AccountingEntry(
        entry_number='JE-VOID-TEST-01', entry_date=date.today(), entry_type='general',
        reference_type='purchase_invoice', reference_id=invoice.id,
        account_id=accounts['beban'].id, account_code=accounts['beban'].account_code,
        account_name=accounts['beban'].account_name, debit_amount=800.0, credit_amount=0,
        status='posted',
    )
    entry2 = AccountingEntry(
        entry_number='JE-VOID-TEST-02', entry_date=date.today(), entry_type='general',
        reference_type='purchase_invoice', reference_id=invoice.id,
        account_id=accounts['hutang'].id, account_code=accounts['hutang'].account_code,
        account_name=accounts['hutang'].account_name, debit_amount=0, credit_amount=800.0,
        status='posted',
    )
    db_session.add_all([entry1, entry2])
    db_session.commit()

    resp = client.post(f'/api/finance/invoices/{invoice.id}/void', json={'reason': 'test PI void'}, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    db.session.refresh(invoice)
    assert invoice.status == 'cancelled'

    db.session.refresh(entry1)
    db.session.refresh(entry2)
    assert entry1.status == 'reversed'
    assert entry2.status == 'reversed'

    reversal_entries = AccountingEntry.query.filter_by(reference_type='void_purchase_invoice', reference_id=invoice.id).all()
    assert len(reversal_entries) > 0
    total_debit = sum(float(e.debit_amount or 0) for e in reversal_entries)
    total_credit = sum(float(e.credit_amount or 0) for e in reversal_entries)
    assert round(total_debit, 2) == round(total_credit, 2)
