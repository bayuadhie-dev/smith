"""
Fase 12 (fix_report_3.md): get_balance_sheet() dan get_income_statement()
(routes/finance.py) sekarang memakai SATU fungsi klasifikasi akun yang
sama (classify_account() di utils/finance_helpers.py), bukan dua
himpunan prefix yang dipelihara terpisah. Ini menutup 3 celah:
1. '7-xxxx' expense terlewat dari Neraca (sudah pernah terjadi nyata di
   produksi - lihat fix_report_2.md Fase 11).
2. '2-12xx' liability terlewat dari Neraca (sudah pernah terjadi nyata
   di produksi - fix_report_2.md Fase 11 juga).
3. '8-xxxx'/'9-xxxx' expense terlewat dari current_year_earnings Neraca
   PADAHAL sudah dihitung oleh Laba Rugi - celah baru yang ditemukan
   saat menulis fase ini (belum pernah dilaporkan ke produksi), karena
   Neraca dulu cuma menjumlahkan prefix '5-'/'6-'/'7-' untuk expense,
   sementara Laba Rugi sudah mencakup '8-'/'9-' lewat filter terpisah.

Juga menambah (additive, tidak menghapus key lama) ke response Neraca:
unclassified_accounts, is_balanced, imbalance, warnings.
"""
from datetime import date


def _make_accounts(db_session, extra=None):
    from models.finance import Account
    accounts = {
        'kas': Account(account_code='1-1000', account_name='Kas', account_type='asset', normal_balance='debit'),
        'modal': Account(account_code='3-1000', account_name='Modal', account_type='equity', normal_balance='credit'),
        'pendapatan': Account(account_code='4-1000', account_name='Pendapatan', account_type='revenue', normal_balance='credit'),
    }
    if extra:
        accounts.update(extra)
    for acc in accounts.values():
        db_session.add(acc)
    db_session.commit()
    return accounts


def _post_journal(client, auth_headers, entry_date, description, lines):
    resp = client.post('/api/finance/general-ledger', json={
        'entry_date': entry_date, 'description': description, 'lines': lines,
    }, headers=auth_headers)
    assert resp.status_code in (200, 201), resp.get_json()


def test_balance_sheet_counts_7_prefix_expense(client, auth_headers, db_session):
    from models.finance import Account
    accounts = _make_accounts(db_session, extra={
        'gaji': Account(account_code='7-1000', account_name='Beban Gaji', account_type='expense', normal_balance='debit'),
    })
    today = date.today().isoformat()
    _post_journal(client, auth_headers, today, 'Modal awal', [
        {'account_id': accounts['kas'].id, 'debit': 1000000, 'credit': 0},
        {'account_id': accounts['modal'].id, 'debit': 0, 'credit': 1000000},
    ])
    _post_journal(client, auth_headers, today, 'Pendapatan', [
        {'account_id': accounts['kas'].id, 'debit': 500000, 'credit': 0},
        {'account_id': accounts['pendapatan'].id, 'debit': 0, 'credit': 500000},
    ])
    _post_journal(client, auth_headers, today, 'Bayar gaji', [
        {'account_id': accounts['gaji'].id, 'debit': 200000, 'credit': 0},
        {'account_id': accounts['kas'].id, 'debit': 0, 'credit': 200000},
    ])

    resp = client.get('/api/finance/reports/balance-sheet', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    bs = resp.get_json()['balance_sheet']
    assert bs['equity']['current_year_earnings'] == 300000.0
    assert bs['is_balanced'] is True
    assert bs['imbalance'] == 0.0
    assert bs['unclassified_accounts'] == []


def test_balance_sheet_counts_2_12xx_liability(client, auth_headers, db_session):
    from models.finance import Account
    accounts = _make_accounts(db_session, extra={
        'ppn': Account(account_code='2-1210', account_name='Hutang PPN', account_type='liability', normal_balance='credit'),
    })
    today = date.today().isoformat()
    _post_journal(client, auth_headers, today, 'Modal awal', [
        {'account_id': accounts['kas'].id, 'debit': 1000000, 'credit': 0},
        {'account_id': accounts['modal'].id, 'debit': 0, 'credit': 1000000},
    ])
    _post_journal(client, auth_headers, today, 'Hutang PPN bertambah', [
        {'account_id': accounts['kas'].id, 'debit': 100000, 'credit': 0},
        {'account_id': accounts['ppn'].id, 'debit': 0, 'credit': 100000},
    ])

    resp = client.get('/api/finance/reports/balance-sheet', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    bs = resp.get_json()['balance_sheet']
    assert bs['liabilities']['current_liabilities']['accrued_liabilities'] == 100000.0
    assert bs['is_balanced'] is True
    assert bs['unclassified_accounts'] == []


def test_balance_sheet_counts_8_and_9_prefix_expense(client, auth_headers, db_session):
    """Celah BARU ditemukan saat menulis tes ini (belum pernah kejadian
    nyata di produksi, tapi sudah ada bibitnya: account_type 'expense'
    rentang 5-1000 s/d 9-9000 di erp_db produksi). Sebelum fix:
    current_year_earnings Neraca hanya kurangi prefix 5/6/7, jadi expense
    di akun 9-xxxx (mis. Beban Bunga) TIDAK mengurangi laba di Neraca,
    padahal Laba Rugi SUDAH menghitungnya - 2 laporan jadi tidak sinkron."""
    from models.finance import Account
    accounts = _make_accounts(db_session, extra={
        'bunga': Account(account_code='9-1000', account_name='Beban Bunga', account_type='expense', normal_balance='debit'),
        'lain': Account(account_code='8-9000', account_name='Beban Lain-lain', account_type='expense', normal_balance='debit'),
    })
    today = date.today().isoformat()
    _post_journal(client, auth_headers, today, 'Modal awal', [
        {'account_id': accounts['kas'].id, 'debit': 1000000, 'credit': 0},
        {'account_id': accounts['modal'].id, 'debit': 0, 'credit': 1000000},
    ])
    _post_journal(client, auth_headers, today, 'Pendapatan', [
        {'account_id': accounts['kas'].id, 'debit': 500000, 'credit': 0},
        {'account_id': accounts['pendapatan'].id, 'debit': 0, 'credit': 500000},
    ])
    _post_journal(client, auth_headers, today, 'Beban bunga', [
        {'account_id': accounts['bunga'].id, 'debit': 50000, 'credit': 0},
        {'account_id': accounts['kas'].id, 'debit': 0, 'credit': 50000},
    ])
    _post_journal(client, auth_headers, today, 'Beban lain-lain', [
        {'account_id': accounts['lain'].id, 'debit': 30000, 'credit': 0},
        {'account_id': accounts['kas'].id, 'debit': 0, 'credit': 30000},
    ])

    resp = client.get('/api/finance/reports/balance-sheet', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    bs = resp.get_json()['balance_sheet']
    assert bs['equity']['current_year_earnings'] == 420000.0, (
        f"500.000 pendapatan - 50.000 (9-xxxx) - 30.000 (8-9000) = 420.000, dapat "
        f"{bs['equity']['current_year_earnings']} - kemungkinan 8-/9- tidak ikut terhitung"
    )
    assert bs['is_balanced'] is True


def test_balance_sheet_and_income_statement_net_income_match_two_different_years(client, auth_headers, db_session):
    """Laba Rugi dan Neraca harus sepakat soal net_income tahun berjalan,
    untuk 2 tahun yang berbeda (membuktikan keduanya memakai klasifikasi
    + filter tanggal yang konsisten, bukan kebetulan cocok di satu kasus)."""
    from models.finance import Account
    accounts = _make_accounts(db_session, extra={
        'beban': Account(account_code='6-1000', account_name='Beban Operasional', account_type='expense', normal_balance='debit'),
    })
    this_year = date.today().year
    last_year = this_year - 1

    _post_journal(client, auth_headers, f'{last_year}-06-15', 'Penjualan tahun lalu', [
        {'account_id': accounts['kas'].id, 'debit': 1000000, 'credit': 0},
        {'account_id': accounts['pendapatan'].id, 'debit': 0, 'credit': 1000000},
    ])
    _post_journal(client, auth_headers, f'{last_year}-06-16', 'Beban tahun lalu', [
        {'account_id': accounts['beban'].id, 'debit': 400000, 'credit': 0},
        {'account_id': accounts['kas'].id, 'debit': 0, 'credit': 400000},
    ])
    _post_journal(client, auth_headers, f'{this_year}-03-10', 'Penjualan tahun ini', [
        {'account_id': accounts['kas'].id, 'debit': 300000, 'credit': 0},
        {'account_id': accounts['pendapatan'].id, 'debit': 0, 'credit': 300000},
    ])
    _post_journal(client, auth_headers, f'{this_year}-03-11', 'Beban tahun ini', [
        {'account_id': accounts['beban'].id, 'debit': 120000, 'credit': 0},
        {'account_id': accounts['kas'].id, 'debit': 0, 'credit': 120000},
    ])

    for year in (last_year, this_year):
        bs_resp = client.get(f'/api/finance/reports/balance-sheet?date={year}-12-31', headers=auth_headers)
        assert bs_resp.status_code == 200, bs_resp.get_json()
        bs_net_income = bs_resp.get_json()['balance_sheet']['equity']['current_year_earnings']

        is_resp = client.get(f'/api/finance/reports/income-statement?year={year}', headers=auth_headers)
        assert is_resp.status_code == 200, is_resp.get_json()
        is_net_income = is_resp.get_json()['income_statement']['net_income']

        assert bs_net_income == is_net_income, (
            f"Tahun {year}: Neraca current_year_earnings={bs_net_income} != "
            f"Laba Rugi net_income={is_net_income}"
        )
