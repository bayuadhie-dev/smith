def test_advance_line_stores_party(client, auth_headers, db_session):
    from models.purchasing import Supplier
    from tests.test_finance_sync_regressions import _acc, _bank
    bank = _bank(db_session); a = _acc(db_session, '9-1000')
    sup = Supplier(code='SUP-UM', company_name='PT Berkat'); db_session.add(sup); db_session.commit()
    body = {'payment_date': '2026-11-05T10:00:00', 'payment_type': 'payment', 'payment_method': 'bank_transfer', 'amount': 500,
            'bank_account_id': bank.id, 'lines': [{'account_id': a.id, 'amount': 500, 'party_type': 'supplier', 'party_id': sup.id}]}
    r = client.post('/api/finance/payments', headers=auth_headers, json=body)
    assert r.status_code == 201, r.get_json()
    d = client.get(f"/api/finance/payments/{r.get_json()['payment_id']}", headers=auth_headers).get_json()
    line = (d.get('payment') or d)['lines'][0]
    assert line['party_name'] == 'PT Berkat' and line['party_type'] == 'supplier'
    body['lines'][0]['party_id'] = 999999
    assert client.post('/api/finance/payments', headers=auth_headers, json=body).status_code == 400
