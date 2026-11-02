def test_customer_get_matches_form_fields_and_put_saves_them(client, auth_headers, db_session, test_customer):
    r = client.get(f'/api/sales/customers/{test_customer.id}', headers=auth_headers)
    assert r.status_code == 200
    d = r.get_json()
    assert d['company_name'] == test_customer.company_name
    assert 'tax_number' in d and d['payment_terms'] in ('COD',) or d['payment_terms'].startswith('Net ')

    r = client.put(f'/api/sales/customers/{test_customer.id}', headers=auth_headers,
                   json={'tax_number': '01.234.567.8-901.000', 'payment_terms': 'Net 45', 'notes': 'catatan uji'})
    assert r.status_code == 200, r.get_json()
    d = client.get(f'/api/sales/customers/{test_customer.id}', headers=auth_headers).get_json()
    assert d['tax_number'] == '01.234.567.8-901.000' and d['tax_id'] == '01.234.567.8-901.000'
    assert d['payment_terms'] == 'Net 45' and d['payment_terms_days'] == 45
    assert d['notes'] == 'catatan uji'

    client.put(f'/api/sales/customers/{test_customer.id}', headers=auth_headers, json={'payment_terms': 'COD'})
    d = client.get(f'/api/sales/customers/{test_customer.id}', headers=auth_headers).get_json()
    assert d['payment_terms'] == 'COD' and d['payment_terms_days'] == 0
