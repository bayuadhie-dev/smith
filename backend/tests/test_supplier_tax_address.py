def test_supplier_number_and_two_addresses(client, auth_headers, db_session):
    r = client.post('/api/purchasing/suppliers', headers=auth_headers, json={
        'code': 'SUP-MANUAL-1', 'name': 'PT Uji Alamat', 'address': 'Jl. Kantor No. 1, Bandung', 'tax_address': 'Jl. NPWP No. 9, Jakarta'})
    assert r.status_code == 201, r.get_json()
    sid = r.get_json()['supplier_id']
    d = client.get(f'/api/purchasing/suppliers/{sid}', headers=auth_headers).get_json()
    assert d['code'] == 'SUP-MANUAL-1' and d['address'] == 'Jl. Kantor No. 1, Bandung' and d['tax_address'] == 'Jl. NPWP No. 9, Jakarta'
    dup = client.post('/api/purchasing/suppliers', headers=auth_headers, json={'code': 'SUP-MANUAL-1', 'name': 'PT Lain'})
    assert dup.status_code == 400 and 'sudah dipakai' in dup.get_json()['error']
    auto = client.post('/api/purchasing/suppliers', headers=auth_headers, json={'name': 'PT Otomatis'})
    assert auto.status_code == 201
    a = client.get(f"/api/purchasing/suppliers/{auto.get_json()['supplier_id']}", headers=auth_headers).get_json()
    assert a['code'].startswith('SUP-') and a['tax_address'] is None
    u = client.put(f'/api/purchasing/suppliers/{sid}', headers=auth_headers, json={'tax_address': 'Alamat pajak baru', 'code': 'SUP-MANUAL-2'})
    assert u.status_code == 200
    d = client.get(f'/api/purchasing/suppliers/{sid}', headers=auth_headers).get_json()
    assert d['tax_address'] == 'Alamat pajak baru' and d['code'] == 'SUP-MANUAL-2' and d['address'] == 'Jl. Kantor No. 1, Bandung'
    clash = client.put(f"/api/purchasing/suppliers/{auto.get_json()['supplier_id']}", headers=auth_headers, json={'code': 'SUP-MANUAL-2'})
    assert clash.status_code == 400
