"""
Tests for GET /api/finance/budget/variance-analysis (2026-10-06) - was a
stale TODO always returning an empty analysis list, even though the
Budget/BudgetLine models it claimed were "not yet created" already existed
and were used by the endpoint right above it (/budget/budgets). Now
computes real variance grouped by BudgetLine.category, live from
budget_amount/actual_amount (not the dead variance_amount/variance_percent
columns, which are never written anywhere in the codebase).
"""
from datetime import date, timedelta


def _make_budget_line(db_session, category, budget_amount, actual_amount, account_code):
    from models.finance import Account, Budget, BudgetLine

    account = Account(
        account_code=account_code, account_name=f'Test {account_code}', account_type='expense',
        normal_balance='debit',
    )
    db_session.add(account)
    db_session.commit()

    today = date.today()
    budget = Budget(
        budget_name=f'Test Budget {account_code}', budget_year=today.year, budget_period='annual',
        start_date=today - timedelta(days=30), end_date=today + timedelta(days=30),
        status='active', total_budget=budget_amount, is_active=True,
    )
    db_session.add(budget)
    db_session.commit()

    line = BudgetLine(
        budget_id=budget.id, account_id=account.id, category=category,
        budget_amount=budget_amount, actual_amount=actual_amount,
        # Dead columns - never written by any code path, set to a wrong
        # value on purpose to prove the endpoint doesn't read them.
        variance_amount=99999, variance_percent=99999,
    )
    db_session.add(line)
    db_session.commit()
    return budget, line


def test_variance_analysis_computes_live_not_from_dead_columns(client, auth_headers, db_session):
    _make_budget_line(db_session, 'Operasional', 1_000_000, 1_200_000, 'TEST-VAR-01')

    resp = client.get('/api/finance/budget/variance-analysis', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'analysis' in data
    row = next(r for r in data['analysis'] if r['category'] == 'Operasional')
    assert row['budget'] == 1_000_000
    assert row['actual'] == 1_200_000
    assert row['variance'] == 200_000
    assert abs(row['variance_percent'] - 20.0) < 0.01
    # Must not equal the poisoned dead-column value.
    assert row['variance'] != 99999


def test_variance_analysis_groups_multiple_budgets_by_category(client, auth_headers, db_session):
    _make_budget_line(db_session, 'Produksi', 500_000, 400_000, 'TEST-VAR-02')
    _make_budget_line(db_session, 'Produksi', 300_000, 350_000, 'TEST-VAR-03')

    resp = client.get('/api/finance/budget/variance-analysis', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    row = next(r for r in data['analysis'] if r['category'] == 'Produksi')
    assert row['budget'] == 800_000
    assert row['actual'] == 750_000
    assert row['variance'] == -50_000


def test_variance_analysis_empty_when_no_budgets(client, auth_headers, db_session):
    resp = client.get('/api/finance/budget/variance-analysis', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['analysis'] == []
    assert 'message' in data


def test_variance_analysis_excludes_inactive_budgets(client, auth_headers, db_session):
    from models.finance import Account, Budget, BudgetLine

    account = Account(
        account_code='TEST-VAR-04', account_name='Test inactive', account_type='expense',
        normal_balance='debit',
    )
    db_session.add(account)
    db_session.commit()

    today = date.today()
    budget = Budget(
        budget_name='Inactive Budget', budget_year=today.year, budget_period='annual',
        start_date=today - timedelta(days=30), end_date=today + timedelta(days=30),
        status='closed', total_budget=1_000_000, is_active=False,
    )
    db_session.add(budget)
    db_session.commit()

    db_session.add(BudgetLine(
        budget_id=budget.id, account_id=account.id, category='Nonaktif',
        budget_amount=1_000_000, actual_amount=1_000_000,
    ))
    db_session.commit()

    resp = client.get('/api/finance/budget/variance-analysis', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert all(r['category'] != 'Nonaktif' for r in data['analysis'])
