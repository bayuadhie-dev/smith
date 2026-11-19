def _acc(db_session, code, kind, nb):
    from models.finance import Account
    a = Account(account_code=code, account_name=f'Akun {code}', account_type=kind, normal_balance=nb, is_active=True)
    db_session.add(a); db_session.commit()
    return a


def test_journal_list_sort_and_source_filter(client, auth_headers, db_session):
    a, b = _acc(db_session, '1-9001', 'asset', 'debit'), _acc(db_session, '4-9001', 'revenue', 'credit')
    for d, amt, desc in (('2026-11-02', 100.5, 'AAA jurnal kecil'), ('2026-11-05', 900.25, 'ZZZ jurnal besar')):
        r = client.post('/api/finance/general-ledger', headers=auth_headers, json={'entry_date': d, 'description': desc, 'lines': [
            {'account_id': a.id, 'debit': amt, 'credit': 0}, {'account_id': b.id, 'debit': 0, 'credit': amt}]})
        assert r.status_code == 201, r.get_json()
    base = '/api/finance/accounting/journal-entries'
    asc = client.get(f'{base}?sort=total_debit&dir=asc', headers=auth_headers).get_json()['entries']
    desc = client.get(f'{base}?sort=total_debit&dir=desc', headers=auth_headers).get_json()['entries']
    assert [e['total_debit'] for e in asc] == [100.5, 900.25] and [e['total_debit'] for e in desc] == [900.25, 100.5]
    by_desc = client.get(f'{base}?sort=description&dir=asc', headers=auth_headers).get_json()['entries']
    assert by_desc[0]['description'].startswith('AAA')
    manual = client.get(f'{base}?source=manual', headers=auth_headers).get_json()
    auto = client.get(f'{base}?source=auto', headers=auth_headers).get_json()
    assert manual['total'] == 2 and auto['total'] == 0


def test_general_ledger_sorting_is_done_by_the_server(client, auth_headers, db_session):
    """The GL list is paginated server-side, so sorting must happen in SQL -
    sorting only the rows on one page would put the wrong row first."""
    a, b = _acc(db_session, '1-9101', 'asset', 'debit'), _acc(db_session, '4-9101', 'revenue', 'credit')
    rows = (('2026-11-02', 100.0, 'BBB middle'), ('2026-11-09', 25.0, 'AAA smallest'), ('2026-11-04', 700.0, 'CCC largest'))
    for d, amt, desc in rows:
        r = client.post('/api/finance/general-ledger', headers=auth_headers, json={
            'entry_date': d, 'description': desc,
            'lines': [{'account_id': a.id, 'debit': amt, 'credit': 0}, {'account_id': b.id, 'debit': 0, 'credit': amt}]})
        assert r.status_code == 201, r.get_json()

    url = '/api/finance/general-ledger?account_id=%d' % a.id

    def ask(**params):
        q = '&'.join(f'{k}={v}' for k, v in params.items())
        res = client.get(f'{url}&{q}', headers=auth_headers)
        assert res.status_code == 200, res.get_json()
        return res.get_json()['entries']

    # default: newest first
    assert [e['entry_date'][:10] for e in ask()] == ['2026-11-09', '2026-11-04', '2026-11-02']
    assert [e['entry_date'][:10] for e in ask(sort_by='entry_date', sort_dir='asc')] == ['2026-11-02', '2026-11-04', '2026-11-09']
    assert [e['debit_amount'] for e in ask(sort_by='debit_amount', sort_dir='asc')] == [25.0, 100.0, 700.0]
    assert [e['debit_amount'] for e in ask(sort_by='debit_amount', sort_dir='desc')] == [700.0, 100.0, 25.0]
    assert [e['description'][:3] for e in ask(sort_by='description', sort_dir='asc')] == ['AAA', 'BBB', 'CCC']
    # an unknown column falls back to the date (direction still honoured)
    # instead of failing or being passed through to SQL
    assert [e['entry_date'][:10] for e in ask(sort_by='drop table', sort_dir='asc')] == ['2026-11-02', '2026-11-04', '2026-11-09']
