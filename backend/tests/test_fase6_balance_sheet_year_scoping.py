"""
Fase 6 (fix_report_2.md, lanjutan audit): get_balance_sheet() (Fase 1
fix_report.md) menghitung current_year_earnings = prefix_balance('4-') -
(prefix_balance('5-') + prefix_balance('6-')) - TANPA filter tanggal sama
sekali (prefix_balance() menjumlahkan SEMUA AccountingEntry posted untuk
akun itu sepanjang masa, lewat Account.balance property yang juga tidak
filter tanggal - fungsi ini bahkan sudah punya pesan eksplisit di response
JSON-nya sendiri: "as_of_date belum memfilter per tanggal").

Tes ini membuktikan: jurnal pendapatan/beban DUA TAHUN BERBEDA (tahun lalu
dan tahun ini) tercampur jadi satu di current_year_earnings, padahal laba
tahun lalu seharusnya sudah masuk ke retained earnings (akumulasi), bukan
current_year_earnings.

Diverifikasi lewat endpoint HTTP asli.
"""
from datetime import date


def test_prior_year_profit_should_not_leak_into_current_year_earnings(client, auth_headers, db_session):
    from models.finance import Account

    accounts = [
        Account(account_code='1-1000', account_name='Kas', account_type='asset', normal_balance='debit'),
        Account(account_code='3-1000', account_name='Modal', account_type='equity', normal_balance='credit'),
        Account(account_code='4-1000', account_name='Pendapatan Penjualan', account_type='revenue', normal_balance='credit'),
    ]
    for acc in accounts:
        db_session.add(acc)
    db_session.commit()
    acc_by_code = {a.account_code: a.id for a in accounts}

    last_year = date.today().year - 1
    this_year = date.today().year

    # Jurnal TAHUN LALU: Dr Kas 1.000.000 / Cr Pendapatan 1.000.000
    resp1 = client.post('/api/finance/general-ledger', json={
        'entry_date': f'{last_year}-06-15',
        'description': 'Penjualan tahun lalu',
        'lines': [
            {'account_id': acc_by_code['1-1000'], 'debit': 1000000, 'credit': 0},
            {'account_id': acc_by_code['4-1000'], 'debit': 0, 'credit': 1000000},
        ],
    }, headers=auth_headers)
    assert resp1.status_code in (200, 201), resp1.get_json()

    # Jurnal TAHUN INI: Dr Kas 300.000 / Cr Pendapatan 300.000
    resp2 = client.post('/api/finance/general-ledger', json={
        'entry_date': f'{this_year}-03-10',
        'description': 'Penjualan tahun ini',
        'lines': [
            {'account_id': acc_by_code['1-1000'], 'debit': 300000, 'credit': 0},
            {'account_id': acc_by_code['4-1000'], 'debit': 0, 'credit': 300000},
        ],
    }, headers=auth_headers)
    assert resp2.status_code in (200, 201), resp2.get_json()

    resp = client.get(f'/api/finance/reports/balance-sheet?date={this_year}-12-31', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    bs = resp.get_json()['balance_sheet']

    current_year_earnings = bs['equity']['current_year_earnings']
    assert current_year_earnings == 300000.0, (
        f"current_year_earnings harus HANYA pendapatan tahun ini (300.000), "
        f"dapat {current_year_earnings} - kemungkinan laba tahun lalu ikut tercampur"
    )

    # Neraca tetap harus seimbang meski sekarang dipecah 2 komponen
    total_assets = bs['assets']['total_assets']
    total_liabilities_equity = bs['total_liabilities_equity']
    assert total_assets == total_liabilities_equity == 1300000.0


def test_expense_account_with_7_prefix_is_counted(client, auth_headers, db_session):
    """Follow-up fix (2026-10-01, ditemukan lewat testing nyata ke produksi
    setelah server online kembali): chart of accounts produksi punya akun
    beban dengan prefix '7-xxxx' (7-1000 Beban Gaji/payroll, sengaja
    dipisah dari 6-xxxx Beban Operasional per konfirmasi pemilik) yang
    tidak pernah dihitung formula lama (hanya cek prefix 5-/6-) - beban
    jadi understated, current_year_earnings overstated, Neraca jadi tidak
    seimbang. Tes ini membuktikan akun 7-xxxx sekarang ikut dihitung."""
    from models.finance import Account

    accounts = [
        Account(account_code='1-1000', account_name='Kas', account_type='asset', normal_balance='debit'),
        Account(account_code='3-1000', account_name='Modal', account_type='equity', normal_balance='credit'),
        Account(account_code='4-1000', account_name='Pendapatan', account_type='revenue', normal_balance='credit'),
        Account(account_code='7-1000', account_name='Beban Gaji', account_type='expense', normal_balance='debit'),
    ]
    for acc in accounts:
        db_session.add(acc)
    db_session.commit()
    acc_by_code = {a.account_code: a.id for a in accounts}

    today = date.today().isoformat()

    resp1 = client.post('/api/finance/general-ledger', json={
        'entry_date': today,
        'description': 'Modal awal',
        'lines': [
            {'account_id': acc_by_code['1-1000'], 'debit': 1000000, 'credit': 0},
            {'account_id': acc_by_code['3-1000'], 'debit': 0, 'credit': 1000000},
        ],
    }, headers=auth_headers)
    assert resp1.status_code in (200, 201), resp1.get_json()

    resp2 = client.post('/api/finance/general-ledger', json={
        'entry_date': today,
        'description': 'Pendapatan jasa',
        'lines': [
            {'account_id': acc_by_code['1-1000'], 'debit': 500000, 'credit': 0},
            {'account_id': acc_by_code['4-1000'], 'debit': 0, 'credit': 500000},
        ],
    }, headers=auth_headers)
    assert resp2.status_code in (200, 201), resp2.get_json()

    resp3 = client.post('/api/finance/general-ledger', json={
        'entry_date': today,
        'description': 'Bayar gaji',
        'lines': [
            {'account_id': acc_by_code['7-1000'], 'debit': 200000, 'credit': 0},
            {'account_id': acc_by_code['1-1000'], 'debit': 0, 'credit': 200000},
        ],
    }, headers=auth_headers)
    assert resp3.status_code in (200, 201), resp3.get_json()

    resp = client.get('/api/finance/reports/balance-sheet', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    bs = resp.get_json()['balance_sheet']

    current_year_earnings = bs['equity']['current_year_earnings']
    assert current_year_earnings == 300000.0, (
        f"current_year_earnings harus 500.000 pendapatan - 200.000 beban gaji (7-xxxx) = 300.000, "
        f"dapat {current_year_earnings} - kemungkinan akun 7-xxxx tidak ikut terhitung"
    )

    total_assets = bs['assets']['total_assets']
    total_liabilities_equity = bs['total_liabilities_equity']
    assert total_assets == total_liabilities_equity == 1300000.0


def test_liability_account_outside_2_11_prefix_is_counted(client, auth_headers, db_session):
    """Follow-up fix (2026-10-01, ditemukan lewat testing nyata ke produksi):
    accrued_liabilities sebelumnya cuma prefix_balance('2-11'), melewatkan
    akun seperti '2-1210' Hutang PPN (prefix '2-12', bukan '2-11') yang
    tetap merupakan hutang lancar. Diperbaiki jadi prefix '2-1' penuh
    dikurangi 2-1000/2-1300 yang sudah dihitung terpisah."""
    from models.finance import Account

    accounts = [
        Account(account_code='1-1000', account_name='Kas', account_type='asset', normal_balance='debit'),
        Account(account_code='3-1000', account_name='Modal', account_type='equity', normal_balance='credit'),
        Account(account_code='2-1210', account_name='Hutang PPN', account_type='liability', normal_balance='credit'),
    ]
    for acc in accounts:
        db_session.add(acc)
    db_session.commit()
    acc_by_code = {a.account_code: a.id for a in accounts}

    resp1 = client.post('/api/finance/general-ledger', json={
        'entry_date': date.today().isoformat(),
        'description': 'Modal awal',
        'lines': [
            {'account_id': acc_by_code['1-1000'], 'debit': 1000000, 'credit': 0},
            {'account_id': acc_by_code['3-1000'], 'debit': 0, 'credit': 1000000},
        ],
    }, headers=auth_headers)
    assert resp1.status_code in (200, 201), resp1.get_json()

    resp2 = client.post('/api/finance/general-ledger', json={
        'entry_date': date.today().isoformat(),
        'description': 'Simulasi hutang PPN bertambah',
        'lines': [
            {'account_id': acc_by_code['1-1000'], 'debit': 100000, 'credit': 0},
            {'account_id': acc_by_code['2-1210'], 'debit': 0, 'credit': 100000},
        ],
    }, headers=auth_headers)
    assert resp2.status_code in (200, 201), resp2.get_json()

    resp = client.get('/api/finance/reports/balance-sheet', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    bs = resp.get_json()['balance_sheet']

    accrued = bs['liabilities']['current_liabilities']['accrued_liabilities']
    assert accrued == 100000.0, (
        f"accrued_liabilities harus menangkap akun 2-1210 (Hutang PPN, prefix '2-12'), dapat {accrued}"
    )

    total_assets = bs['assets']['total_assets']
    total_liabilities_equity = bs['total_liabilities_equity']
    assert total_assets == total_liabilities_equity == 1100000.0
