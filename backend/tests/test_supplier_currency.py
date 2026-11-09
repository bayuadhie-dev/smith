def test_supplier_currency_and_type_roundtrip(client, auth_headers, db_session):
    r = client.post('/api/purchasing/suppliers', json={'code': 'SUP-FX', 'company_name': 'PT Luar Negeri', 'supplier_type': 'PACKAGING', 'currency': 'usd', 'supplier_subtype': 'CARTON BOX'}, headers=auth_headers)
    assert r.status_code == 201, r.get_json()
    sid = r.get_json().get('id') or r.get_json().get('supplier_id')
    d = client.get(f'/api/purchasing/suppliers/{sid}', headers=auth_headers).get_json()
    d = d.get('supplier', d)
    assert d['currency'] == 'USD' and d['supplier_type'] == 'PACKAGING' and d['supplier_subtype'] == 'CARTON BOX'
    client.put(f'/api/purchasing/suppliers/{sid}', json={'currency': 'XYZ'}, headers=auth_headers)
    d2 = client.get(f'/api/purchasing/suppliers/{sid}', headers=auth_headers).get_json(); d2 = d2.get('supplier', d2)
    assert d2['currency'] == 'IDR'
    lst = client.get('/api/purchasing/suppliers?search=Luar', headers=auth_headers).get_json()['suppliers']
    assert lst[0]['currency'] == 'IDR' and lst[0]['supplier_type'] == 'PACKAGING'
