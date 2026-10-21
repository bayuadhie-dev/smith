"""
Tests for Finance Module
"""
import pytest


def test_get_finance_dashboard(client, auth_headers):
    """Test finance dashboard"""
    response = client.get('/api/finance/dashboard/kpis', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_cash_flow(client, auth_headers):
    """Test cash flow endpoint"""
    response = client.get('/api/finance/dashboard/cash-flow', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_expenses(client, auth_headers):
    """Test expenses endpoint"""
    response = client.get('/api/finance/dashboard/expenses', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_revenue(client, auth_headers):
    """Test revenue endpoint"""
    response = client.get('/api/finance/dashboard/revenue', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_chart_of_accounts(client, auth_headers):
    """Test chart of accounts"""
    response = client.get('/api/finance/chart-of-accounts', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_journal_entries(client, auth_headers):
    """Test journal entries"""
    response = client.get('/api/finance/accounting/journal-entries', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_balance_sheet_includes_current_year_net_income(client, auth_headers, db_session):
    """
    Fase 1 (audit 29 Sept 2026): get_balance_sheet() hanya membaca saldo akun
    equity 3-1000/3-2000/3-3000 dan tidak memasukkan laba berjalan (net income
    tahun berjalan dari akun 4-xxxx dikurangi 5-xxxx/6-xxxx), sehingga neraca
    tidak seimbang begitu ada transaksi pendapatan/beban yang belum masuk ke
    akun equity manapun.

    Skenario reproduksi (persis seperti temuan audit):
      Dr Kas 1-1000 1.000.000 / Cr Modal 3-1000 1.000.000
      Dr Piutang 1-1100 500.000 / Cr Pendapatan 4-1000 500.000

    Tanpa fix: Total Assets = 1.500.000, Total Liabilities+Equity = 1.000.000
    (selisih 500.000 = net income yang hilang). Diverifikasi lewat endpoint
    HTTP asli (bukan panggil fungsi langsung), sesuai aturan verifikasi di
    prompt perbaikan.
    """
    from models.finance import Account

    accounts = [
        Account(account_code='1-1000', account_name='Kas', account_type='asset', normal_balance='debit'),
        Account(account_code='3-1000', account_name='Modal', account_type='equity', normal_balance='credit'),
        Account(account_code='1-1100', account_name='Piutang Dagang', account_type='asset', normal_balance='debit'),
        Account(account_code='4-1000', account_name='Pendapatan Penjualan', account_type='revenue', normal_balance='credit'),
    ]
    for acc in accounts:
        db_session.add(acc)
    db_session.commit()

    acc_by_code = {a.account_code: a.id for a in accounts}

    resp1 = client.post('/api/finance/general-ledger', json={
        'entry_date': '2026-09-29',
        'description': 'Setoran modal awal',
        'lines': [
            {'account_id': acc_by_code['1-1000'], 'debit': 1000000, 'credit': 0},
            {'account_id': acc_by_code['3-1000'], 'debit': 0, 'credit': 1000000},
        ],
    }, headers=auth_headers)
    assert resp1.status_code in (200, 201), resp1.get_json()

    resp2 = client.post('/api/finance/general-ledger', json={
        'entry_date': '2026-09-29',
        'description': 'Penjualan kredit',
        'lines': [
            {'account_id': acc_by_code['1-1100'], 'debit': 500000, 'credit': 0},
            {'account_id': acc_by_code['4-1000'], 'debit': 0, 'credit': 500000},
        ],
    }, headers=auth_headers)
    assert resp2.status_code in (200, 201), resp2.get_json()

    resp = client.get('/api/finance/reports/balance-sheet?date=2026-09-29', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    bs = resp.get_json()['balance_sheet']

    total_assets = bs['assets']['total_assets']
    total_liabilities_equity = bs['total_liabilities_equity']

    assert total_assets == 1500000
    assert total_liabilities_equity == total_assets, (
        f"Neraca tidak seimbang: total_assets={total_assets} "
        f"vs total_liabilities_equity={total_liabilities_equity}"
    )
