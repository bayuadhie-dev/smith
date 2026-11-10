def _post(client, headers, bank, a, amount, **extra):
    body = {'payment_date': '2026-10-31T10:00:00', 'payment_type': 'payment', 'payment_method': 'bank_transfer',
            'amount': amount, 'bank_account_id': bank.id, 'lines': [{'account_id': a.id, 'amount': amount}]}
    body.update(extra)
    return client.post('/api/finance/payments', headers=headers, json=body)


def test_edit_keeps_payment_number_and_voids_old(client, auth_headers, db_session):
    from models.finance import Payment
    from tests.test_finance_sync_regressions import _acc, _bank
    bank = _bank(db_session); a = _acc(db_session, '9-1000')
    r = _post(client, auth_headers, bank, a, 500, payment_number='PAY-KEEP-1')
    assert r.status_code == 201, r.get_json()
    old_id = r.get_json()['payment_id']

    r2 = _post(client, auth_headers, bank, a, 700, replace_payment_id=old_id)
    assert r2.status_code == 201, r2.get_json()
    new = r2.get_json()
    assert new['payment_number'] == 'PAY-KEEP-1'
    assert new['payment_id'] != old_id

    db_session.expire_all()
    assert db_session.get(Payment, old_id) is None          # pembayaran lama dihapus, bukan disimpan sebagai batal

    r3 = _post(client, auth_headers, bank, a, 900, replace_payment_id=new['payment_id'])
    assert r3.status_code == 201, r3.get_json()
    assert r3.get_json()['payment_number'] == 'PAY-KEEP-1'
    assert Payment.query.filter(Payment.payment_number.like('PAY-KEEP-1-V%')).count() == 0


def test_edit_records_history_and_hides_replaced(client, auth_headers, db_session):
    from tests.test_finance_sync_regressions import _acc, _bank
    bank = _bank(db_session); a = _acc(db_session, '9-1000')
    old_id = _post(client, auth_headers, bank, a, 500, payment_number='PAY-HIST-1').get_json()['payment_id']
    new_id = _post(client, auth_headers, bank, a, 700, replace_payment_id=old_id, reference_number='REK-123').get_json()['payment_id']
    h = client.get(f'/api/history?table=payments&id={new_id}', headers=auth_headers).get_json()['history']
    assert h and any(c['field'] == 'Jumlah' and c['new'] == 700 for c in h[0]['changes'])
    ids = [p['id'] for p in client.get('/api/finance/payments', headers=auth_headers).get_json()['payments']]
    assert new_id in ids and old_id not in ids
