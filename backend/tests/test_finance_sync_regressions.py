"""
Regression tests for the 2026-10-24 finance/accounting audit: reports and
subledgers must stay in step with the GL, and the logic gaps found while
running full flows must stay closed.
"""
from datetime import date, timedelta


ACCOUNTS = {
    '1-1010': ('Kas di Bank', 'asset', 'debit', True),
    '1-1100': ('Piutang Usaha', 'asset', 'debit', False),
    '1-2000': ('Aset Tetap', 'asset', 'debit', False),
    '1-2100': ('Akumulasi Penyusutan', 'asset', 'debit', False),  # contra, credit balance
    '2-1000': ('Hutang Usaha', 'liability', 'credit', False),
    '2-1210': ('Hutang PPN', 'liability', 'credit', False),
    '3-1000': ('Modal', 'equity', 'credit', False),
    '4-1000': ('Pendapatan Penjualan', 'revenue', 'credit', False),
    '6-6000': ('Beban Penyusutan', 'expense', 'debit', False),
    '9-1000': ('Beban Bunga', 'expense', 'debit', False),
}
_seq = {'n': 0}


def _acc(db_session, code):
    from models.finance import Account
    acc = Account.query.filter_by(account_code=code).first()
    if acc:
        return acc
    name, typ, normal, cash = ACCOUNTS[code]
    acc = Account(account_code=code, account_name=name, account_type=typ, normal_balance=normal,
                  is_active=True, is_cash_bank=cash)
    db_session.add(acc)
    db_session.commit()
    return acc


def _post(db_session, code, debit=0, credit=0, on=None, status='posted', ref_type=None, ref_id=None):
    from models.finance import AccountingEntry
    acc = _acc(db_session, code)
    _seq['n'] += 1
    db_session.add(AccountingEntry(
        entry_number=f'JE-REG-{_seq["n"]:05d}-01', entry_date=on or date.today(), entry_type='general',
        reference_type=ref_type, reference_id=ref_id,
        account_id=acc.id, account_code=code, account_name=acc.account_name,
        debit_amount=debit, credit_amount=credit, status=status,
    ))
    db_session.commit()
    return acc


# ---------------------------------------------------------------- balance sheet

def test_balance_sheet_balances_with_accumulated_depreciation(client, auth_headers, db_session):
    """Regression: accumulated depreciation (credit balance) was ADDED to fixed
    assets, so the sheet was off by exactly 2x the accumulated depreciation."""
    _post(db_session, '1-1010', debit=1_000_000)
    _post(db_session, '3-1000', credit=1_000_000)
    _post(db_session, '1-2000', debit=270_000)
    _post(db_session, '1-1010', credit=270_000)
    _post(db_session, '6-6000', debit=3_000)
    _post(db_session, '1-2100', credit=3_000)

    bs = client.get('/api/finance/reports/balance-sheet', headers=auth_headers).get_json()['balance_sheet']
    assert bs['is_balanced'], bs['imbalance']
    assert bs['assets']['fixed_assets']['net_fixed_assets'] == 267_000
    assert bs['assets']['total_assets'] == 997_000


def test_balance_sheet_cuts_off_at_report_date(client, auth_headers, db_session):
    """Regression: balances were all-time while earnings were date-filtered, so a
    sheet for a past date was out of balance whenever later transactions existed."""
    long_ago = date.today() - timedelta(days=400)
    _post(db_session, '1-1010', debit=500_000, on=long_ago)
    _post(db_session, '3-1000', credit=500_000, on=long_ago)
    _post(db_session, '1-1010', debit=200_000)              # later sale, today
    _post(db_session, '4-1000', credit=200_000)

    past = client.get(f'/api/finance/reports/balance-sheet?date={long_ago.isoformat()}', headers=auth_headers).get_json()['balance_sheet']
    assert past['is_balanced']
    assert past['assets']['total_assets'] == 500_000          # later sale not in the past sheet
    now = client.get('/api/finance/reports/balance-sheet', headers=auth_headers).get_json()['balance_sheet']
    assert now['is_balanced']
    assert now['assets']['total_assets'] == 700_000


# ------------------------------------------------------------------- cash flow

def test_cash_flow_posted_only_and_sections_add_up(client, auth_headers, db_session):
    _post(db_session, '1-1010', debit=1_000_000, ref_type='payment')
    _post(db_session, '1-1010', credit=100_000, ref_type='manual_journal')
    _post(db_session, '1-1010', credit=270_000, ref_type='asset')
    _post(db_session, '1-1010', debit=999_999, status='draft')       # must be ignored
    _post(db_session, '1-1010', debit=888_888, status='reversed')    # must be ignored

    cf = client.get(f'/api/finance/reports/cash-flow?year={date.today().year}', headers=auth_headers).get_json()['cash_flow']
    ops = cf['operating_activities']['net_cash_from_operations']
    inv = cf['investing_activities']['net_cash_from_investing']
    fin = cf['financing_activities']['net_cash_from_financing']
    assert cf['net_change_in_cash'] == 630_000
    assert ops + inv + fin == cf['net_change_in_cash']
    assert inv == -270_000
    assert cf['ending_cash'] == 630_000


# -------------------------------------------------------------- standalone cash

def _bank(db_session):
    return _acc(db_session, '1-1010')


def test_standalone_cash_cannot_post_to_receivable_or_payable_control_accounts(client, auth_headers, db_session):
    bank = _bank(db_session)
    for code in ('1-1100', '2-1000'):
        acc = _acc(db_session, code)
        resp = client.post('/api/finance/payments', headers=auth_headers, json={
            'payment_date': date.today().isoformat(), 'payment_type': 'payment', 'payment_method': 'cash',
            'bank_account_id': bank.id, 'lines': [{'account_id': acc.id, 'amount': 10}],
        })
        assert resp.status_code == 400, code
        assert 'kontrol' in resp.get_json()['error'].lower()


def test_payment_list_works_for_supplier_payments(client, auth_headers, db_session):
    """Regression: the list crashed with 500 ('Supplier' has no attribute 'name')."""
    from models.finance import Payment
    from models.purchasing import Supplier
    bank = _bank(db_session)
    sup = Supplier(code='SUP-REG', company_name='PT Pemasok Uji', is_active=True)
    db_session.add(sup)
    db_session.commit()
    db_session.add(Payment(payment_number='PAY-REG-1', payment_date=date.today(), payment_type='payment',
                           supplier_id=sup.id, payment_method='cash', amount=1000, bank_account_id=bank.id, status='pending'))
    db_session.commit()

    resp = client.get('/api/finance/payments?type=payment', headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()['payments'][0]['party_name'] == 'PT Pemasok Uji'


# -------------------------------------------------------------- invoice credit

def _sales_invoice(db_session, total=1_000_000, paid=0):
    from models.finance import Invoice
    inv = Invoice(invoice_number=f'INV-REG-{_seq["n"]}', invoice_type='sales', invoice_date=date.today(),
                  total_amount=total, paid_amount=paid, balance_due=total - paid, status='sent')
    _seq['n'] += 1
    db_session.add(inv)
    db_session.commit()
    return inv


def test_apply_credit_to_invoice_reduces_balance_and_survives_payment_void(db_session):
    from utils.finance_helpers import apply_credit_to_invoice
    inv = _sales_invoice(db_session, total=1_000_000)
    apply_credit_to_invoice(inv, 160_000)
    assert float(inv.balance_due) == 840_000
    assert float(inv.credit_applied) == 160_000
    assert inv.status == 'partial'

    apply_credit_to_invoice(inv, 5_000_000)           # more than is still owed
    assert float(inv.balance_due) == 0                # never negative
    assert inv.status == 'paid'


def test_void_payment_keeps_credit_applied_in_balance(client, auth_headers, db_session):
    """Voiding a payment recomputed balance as total - paid, which silently
    undid any sales-return credit already applied to the invoice."""
    from utils.finance_helpers import apply_credit_to_invoice
    from models.finance import GlobalAccountDefault
    from models.sales import Customer
    bank = _bank(db_session)
    ar = _acc(db_session, '1-1100')
    db_session.add(GlobalAccountDefault(transaction_key='accounts_receivable', account_id=ar.id))
    cust = Customer(code='CUST-REG', company_name='Pelanggan Uji', is_active=True)
    db_session.add(cust)
    db_session.commit()
    inv = _sales_invoice(db_session, total=1_000_000)
    inv.customer_id = cust.id
    db_session.commit()
    apply_credit_to_invoice(inv, 100_000)             # balance 900,000
    resp = client.post('/api/finance/payments', headers=auth_headers, json={
        'payment_date': date.today().isoformat(), 'payment_method': 'cash', 'bank_account_id': bank.id,
        'allocations': [{'invoice_id': inv.id, 'amount': 300_000}],
    })
    assert resp.status_code == 201, resp.get_json()
    pid = resp.get_json()['payment_id']
    db_session.refresh(inv)
    assert float(inv.balance_due) == 600_000

    assert client.post(f'/api/finance/payments/{pid}/void', headers=auth_headers, json={}).status_code == 200
    db_session.refresh(inv)
    assert float(inv.balance_due) == 900_000          # 1,000,000 - 100,000 credit, NOT 1,000,000


# ------------------------------------------------------------ bank reconciliation

def _statement_line(db_session, bank, amount):
    from models.finance import BankStatement, BankStatementLine
    st = BankStatement(account_id=bank.id, period_start=date.today(), period_end=date.today(),
                       source_filename='t.csv', imported_by=1)
    db_session.add(st)
    db_session.flush()
    line = BankStatementLine(statement_id=st.id, line_date=date.today(), description='x', amount=amount, is_matched=False)
    db_session.add(line)
    db_session.commit()
    return line


def test_bank_match_validates_account_amount_status_and_uniqueness(client, auth_headers, db_session):
    from models.finance import AccountingEntry
    bank = _bank(db_session)
    _post(db_session, '1-1010', debit=500_000)
    e_bank = AccountingEntry.query.filter_by(account_code='1-1010').first()
    _post(db_session, '4-1000', credit=500_000)
    e_other = AccountingEntry.query.filter_by(account_code='4-1000').first()
    _post(db_session, '1-1010', debit=500_000, status='draft')
    e_draft = AccountingEntry.query.filter_by(account_code='1-1010', status='draft').first()

    def match(line, entry):
        return client.post(f'/api/finance/bank-reconciliation/lines/{line.id}/match', headers=auth_headers,
                           json={'accounting_entry_id': entry.id})

    l1, l2, l_out = (_statement_line(db_session, bank, 500_000), _statement_line(db_session, bank, 500_000),
                     _statement_line(db_session, bank, -500_000))
    assert match(l1, e_other).status_code == 400          # wrong account
    assert match(l1, e_draft).status_code == 400          # not posted
    assert match(l_out, e_bank).status_code == 400        # wrong direction
    assert match(l1, e_bank).status_code == 200
    assert match(l2, e_bank).status_code == 400           # already matched elsewhere
    client.post(f'/api/finance/bank-reconciliation/lines/{l1.id}/unmatch', headers=auth_headers, json={})
    assert match(l2, e_bank).status_code == 200


# ------------------------------------------------------------------ depreciation

def test_monthly_depreciation_is_idempotent(db_session):
    """Regression: re-closing a reopened period crashed on the unique
    (asset, period, book) constraint - depreciation must skip assets already posted."""
    from models.asset_management import Asset, DepreciationSchedule
    from models.finance import GlobalAccountDefault
    from utils.finance_helpers import run_monthly_depreciation

    exp = _acc(db_session, '6-6000')
    acc = _acc(db_session, '1-2100')
    db_session.add_all([GlobalAccountDefault(transaction_key='depreciation_expense', account_id=exp.id),
                        GlobalAccountDefault(transaction_key='accumulated_depreciation', account_id=acc.id)])
    asset = Asset(asset_code='AST-REG', asset_name='Mesin', asset_type='machinery', status='active',
                  purchase_cost=12_000_000, salvage_value=0, useful_life_years=10,
                  depreciation_method='straight_line', accumulated_depreciation=0)
    db_session.add(asset)
    db_session.commit()

    first = run_monthly_depreciation(2026, 10, posted_by_user_id=None)
    assert first['assets_processed'] == 1
    second = run_monthly_depreciation(2026, 10, posted_by_user_id=None)
    assert second['assets_processed'] == 0 and second['total_depreciation'] == 0
    assert DepreciationSchedule.query.filter_by(asset_id=asset.id).count() == 1
    db_session.refresh(asset)
    assert float(asset.accumulated_depreciation) == 100_000


# -------------------------------------------------------------------- tax / CoA

def test_tax_page_includes_invoice_ppn_without_double_counting(client, auth_headers, db_session):
    from models.finance import Invoice, TaxTransaction
    today = date.today()
    sales = Invoice(invoice_number='INV-TAX-1', invoice_type='sales', invoice_date=today, subtotal=1_000_000,
                    tax_amount=110_000, total_amount=1_110_000, balance_due=1_110_000, status='draft')
    purchase = Invoice(invoice_number='PI-TAX-1', invoice_type='purchase', invoice_date=today, subtotal=500_000,
                       tax_amount=55_000, total_amount=555_000, balance_due=555_000, status='sent')
    cancelled = Invoice(invoice_number='INV-TAX-X', invoice_type='sales', invoice_date=today, subtotal=100,
                        tax_amount=11, total_amount=111, status='cancelled')
    db_session.add_all([sales, purchase, cancelled])
    db_session.commit()

    data = client.get('/api/finance/tax-management', headers=auth_headers).get_json()
    assert data['tax_summary']['vat_payable'] == 110_000
    assert data['tax_summary']['vat_receivable'] == 55_000
    assert {r['transaction_number'] for r in data['tax_transactions']} == {'INV-TAX-1', 'PI-TAX-1'}
    assert all(r['source'] == 'invoice' for r in data['tax_transactions'])

    # once the same invoice is recorded manually it must not be counted twice
    db_session.add(TaxTransaction(
        transaction_number='TX-1', transaction_date=today, transaction_type='vat_out', tax_type='PPN', tax_rate=11,
        base_amount=1_000_000, tax_amount=110_000, status='draft', reporting_period=f'{today.year}-{today.month:02d}',
        reference_type='invoice', reference_id=sales.id))
    db_session.commit()
    data = client.get('/api/finance/tax-management', headers=auth_headers).get_json()
    assert data['tax_summary']['vat_payable'] == 110_000


def test_create_account_validates_required_fields(client, auth_headers, db_session):
    assert client.post('/api/finance/chart-of-accounts', headers=auth_headers, json={'name': 'tanpa kode'}).status_code == 400
    assert client.post('/api/finance/chart-of-accounts', headers=auth_headers,
                       json={'code': '9-7777', 'name': 'X', 'type': 'bogus'}).status_code == 400
    ok = client.post('/api/finance/chart-of-accounts', headers=auth_headers, json={'code': '9-7777', 'name': 'X', 'type': 'expense'})
    assert ok.status_code == 201


# ------------------------------------------------------------------- payroll

def test_paying_payroll_posts_hutang_gaji_to_kas_and_is_idempotent(db_session):
    """Regression: marking a payroll record 'paid' posted nothing, so Hutang Gaji
    was never relieved and the bank balance ignored salaries paid out."""
    from datetime import date
    from types import SimpleNamespace
    import pytest
    from models.finance import AccountingEntry, GlobalAccountDefault
    from utils.finance_helpers import post_payroll_payment_journal, PayrollPaymentError

    ACCOUNTS['2-1110'] = ('Hutang Gaji', 'liability', 'credit', False)
    bank = _acc(db_session, '1-1010')
    hg = _acc(db_session, '2-1110')
    db_session.add_all([GlobalAccountDefault(transaction_key='cash', account_id=bank.id),
                        GlobalAccountDefault(transaction_key='payroll_net_payable', account_id=hg.id)])
    db_session.commit()

    rec = SimpleNamespace(id=777, net_salary=2_424_999)
    entries = post_payroll_payment_journal(rec, payment_date=date.today())
    assert len(entries) == 2
    debit = next(e for e in entries if float(e.debit_amount) > 0)
    credit = next(e for e in entries if float(e.credit_amount) > 0)
    assert debit.account_code == '2-1110' and float(debit.debit_amount) == 2_424_999
    assert credit.account_code == '1-1010' and float(credit.credit_amount) == 2_424_999

    assert post_payroll_payment_journal(rec, payment_date=date.today()) == []          # idempotent
    assert AccountingEntry.query.filter_by(reference_type='payroll_payment', reference_id=777).count() == 2

    with pytest.raises(PayrollPaymentError):                                           # not a Kas/Bank account
        post_payroll_payment_journal(SimpleNamespace(id=778, net_salary=1000), date.today(), bank_account_id=hg.id)
