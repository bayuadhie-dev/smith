"""Pencarian transaksi Finance (routes/finance_search.py)."""
from datetime import date

from routes.finance_search import split_terms
from tests.test_finance_reports import _customer_world, _q, _world


def test_split_terms_uses_percent_as_separator():
    assert split_terms('handmade%skirt') == ['handmade', 'skirt']
    assert split_terms(' a b % c ') == ['a b', 'c']
    assert split_terms('') == [] and split_terms(None) == [] and split_terms('%%') == []


def _search(client, auth_headers, qs):
    return client.get('/api/finance/search?' + qs, headers=auth_headers)


def test_search_requires_a_keyword_or_filter(client, auth_headers, db_session):
    assert _search(client, auth_headers, '').status_code == 400
    assert _search(client, auth_headers, 'date_from=bukan-tanggal').status_code == 400


def test_percent_keywords_match_all_terms_in_any_order_and_case(client, auth_headers, db_session):
    _customer_world()
    assert {r['number'] for r in _search(client, auth_headers, 'q=pelanggan&types=sales_invoice').get_json()['results']} == {'INV-R1', 'INV-R2', 'INV-RX'}
    for q in ('PELANGGAN%inv-r1', 'inv-r1%pelanggan', 'r1%PT'):
        data = _search(client, auth_headers, f'q={q}&types=sales_invoice').get_json()
        assert [r['number'] for r in data['results']] == ['INV-R1'], q
    assert _search(client, auth_headers, 'q=pelanggan%tidak-ada&types=sales_invoice').get_json()['total'] == 0


def test_filters_status_date_amount_and_types(client, auth_headers, db_session):
    cust = _customer_world()
    d = date.today()
    everything = _search(client, auth_headers, 'q=INV-R&types=sales_invoice').get_json()
    assert {r['number'] for r in everything['results']} == {'INV-R1', 'INV-R2', 'INV-RX'}
    cancelled = _search(client, auth_headers, 'q=INV-R&types=sales_invoice&status=cancelled').get_json()
    assert [r['number'] for r in cancelled['results']] == ['INV-RX']
    big = _search(client, auth_headers, 'types=sales_invoice&amount_min=1000&amount_max=2000').get_json()
    assert [r['number'] for r in big['results']] == ['INV-R1']
    recent = _search(client, auth_headers, f'types=sales_invoice&date_from={d.isoformat()}&q=INV').get_json()
    assert {r['number'] for r in recent['results']} == {'INV-RX'}
    pay = _search(client, auth_headers, 'q=RCP-R1%pelanggan&types=receipt').get_json()
    assert [r['number'] for r in pay['results']] == ['RCP-R1'] and pay['results'][0]['url'].startswith('/app/finance/payments/')
    assert pay['counts'] == {'receipt': 1}
    assert cust.company_name == pay['results'][0]['party']


def test_search_finds_journal_lines_and_accounts(client, auth_headers, db_session):
    w = _world()
    j = _search(client, auth_headers, 'q=JE-RPT%BCA&types=journal').get_json()
    assert j['total'] >= 1 and all(r['type'] == 'journal' for r in j['results'])
    assert j['results'][0]['url'].endswith(f"/ledger/{w['bca'].id}") or j['results'][0]['url'].startswith('/app/finance/reports/ledger/')
    acc = _search(client, auth_headers, 'q=100101&types=account').get_json()
    assert [r['number'] for r in acc['results']] == ['100101']
