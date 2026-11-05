def test_account_bank_info_and_fx_payment(client, auth_headers, db_session):
    from models.finance import Account, AccountingEntry
    from tests.test_finance_sync_regressions import _acc
    exp = _acc(db_session, '9-1000')
    r = client.post('/api/finance/chart-of-accounts', headers=auth_headers, json={
        'code': '1-USD1', 'name': 'Bank USD', 'type': 'asset', 'is_cash_bank': True, 'currency': 'usd',
        'bank_name': 'BCA', 'account_number': '123', 'account_holder': 'PT X'})
    assert r.status_code == 201, r.get_json()
    acc = Account.query.filter_by(account_code='1-USD1').first()
    assert acc.currency == 'USD' and acc.bank_name == 'BCA'
    r2 = client.post('/api/finance/chart-of-accounts', headers=auth_headers, json={
        'code': '6-X1', 'name': 'Beban', 'type': 'expense', 'bank_name': 'BCA'})
    assert Account.query.filter_by(account_code='6-X1').first().bank_name is None  # bukan kas/bank
    body = {'payment_date': '2026-11-05T10:00:00', 'payment_type': 'payment', 'payment_method': 'bank_transfer', 'amount': 100,
            'bank_account_id': acc.id, 'exchange_rate': 16000, 'lines': [{'account_id': exp.id, 'amount': 100}]}
    p = client.post('/api/finance/payments', headers=auth_headers, json=body)
    assert p.status_code == 201, p.get_json()
    ents = AccountingEntry.query.filter_by(reference_type='payment', reference_id=p.get_json()['payment_id']).all()
    assert round(sum(float(e.debit_amount or 0) for e in ents), 2) == 1600000 == round(sum(float(e.credit_amount or 0) for e in ents), 2)
    body.pop('exchange_rate')
    assert client.post('/api/finance/payments', headers=auth_headers, json=body).status_code in (201, 400)
    ch = client.put('/api/finance/chart-of-accounts/1-USD1', headers=auth_headers, json={'currency': 'IDR'})
    assert ch.status_code == 400  # sudah ada jurnal
