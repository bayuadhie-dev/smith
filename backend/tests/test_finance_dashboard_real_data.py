"""
Tests for routes/finance.py dashboard endpoints (2026-10-07) - continuation
of the user-requested "cek seluruh dashboard" audit. /dashboard/kpis,
/dashboard/expenses and /dashboard/revenue all used to fabricate figures
instead of reading the real Chart of Accounts/AccountingEntry data:
  - kpis: total_expenses = total_revenue * 0.76, cash_balance =
    total_revenue * 0.36 (so profit_margin was always exactly 24.0%
    whenever any revenue existed, regardless of real performance)
  - expenses: a single fabricated expense_base split into fixed
    percentages (36.8/29.5/15.8/8.9/5.5/3.5%) that never reflected the
    real books
  - revenue: 6 fixed month labels (Jul-Dec) with an invented +8%/month
    growth curve and repeating +/-5% variance, ignoring real Invoice data
    entirely

These tests prove the fix: feeding in a real expense account + a real
AccountingEntry must change the kpis/expenses output away from whatever
the pure-revenue-ratio guess would have produced.
"""
from datetime import date


def _make_expense_account(db_session, code='5-1100', name='Bahan Baku', amount=1_000_000):
    from models.finance import Account, AccountingEntry

    account = Account(
        account_code=code, account_name=name, account_type='expense',
        normal_balance='debit', is_active=True,
    )
    db_session.add(account)
    db_session.commit()

    entry = AccountingEntry(
        entry_number=f'JE-TEST-{code}', entry_date=date.today(), entry_type='general',
        account_id=account.id, account_code=code, account_name=name,
        debit_amount=amount, credit_amount=0, status='posted',
    )
    db_session.add(entry)
    db_session.commit()
    return account


def _make_sales_invoice(db_session, amount=5_000_000):
    from models.finance import Invoice

    inv = Invoice(
        invoice_number='INV-TEST-KPI-001', invoice_type='sales',
        invoice_date=date.today(), due_date=date.today(),
        total_amount=amount, balance_due=0, status='paid',
    )
    db_session.add(inv)
    db_session.commit()
    return inv


def test_kpis_total_expenses_is_not_fixed_ratio_of_revenue(client, auth_headers, db_session):
    """The old bug made total_expenses *always* equal exactly 76% of
    total_revenue. With a real expense account posting a DIFFERENT amount,
    the endpoint must reflect that real figure, not the ratio."""
    _make_sales_invoice(db_session, amount=5_000_000)
    _make_expense_account(db_session, amount=1_000_000)  # real expenses = 1,000,000, NOT 3,800,000 (76% of 5M)

    resp = client.get('/api/finance/dashboard/kpis', headers=auth_headers)
    assert resp.status_code == 200
    kpis = resp.get_json()['kpis']

    assert kpis['total_revenue'] == 5_000_000
    fabricated_ratio_value = 5_000_000 * 0.76
    assert abs(kpis['total_expenses'] - fabricated_ratio_value) > 1000
    assert kpis['total_expenses'] == 1_000_000
    assert kpis['net_profit'] == 4_000_000


def test_dashboard_expenses_reflects_real_account_category(client, auth_headers, db_session):
    """Old behavior: 'Raw Materials' was always exactly 36.8% of a
    fabricated base. Now it must equal the real posted amount on the
    5-1100 (bahan baku) account."""
    _make_expense_account(db_session, code='5-1100', amount=1_000_000)

    resp = client.get('/api/finance/dashboard/expenses', headers=auth_headers)
    assert resp.status_code == 200
    expenses = resp.get_json()['expenses']

    materials = next((e for e in expenses if e['category'] == 'Raw Materials'), None)
    assert materials is not None
    assert materials['amount'] == 1_000_000
    assert materials['percentage'] == 100.0


def test_dashboard_revenue_uses_real_current_month_not_fixed_jul_dec(client, auth_headers, db_session):
    """Old behavior always labeled months Jul-Dec regardless of today's
    real date, and fabricated a growth curve. Now the most recent month in
    the response must be the actual current month, with the real revenue
    amount."""
    inv = _make_sales_invoice(db_session, amount=2_000_000)

    resp = client.get('/api/finance/dashboard/revenue', headers=auth_headers)
    assert resp.status_code == 200
    revenue = resp.get_json()['revenue']

    assert len(revenue) == 6
    current_month_name = date.today().strftime('%b')
    assert revenue[-1]['month'] == current_month_name
    assert revenue[-1]['revenue'] == 2_000_000
