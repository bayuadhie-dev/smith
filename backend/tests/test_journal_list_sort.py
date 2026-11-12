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
