def _po(client, headers, supplier_id, material_id, **flags):
    body = {'supplier_id': supplier_id, 'order_date': '2026-10-28', 'currency': 'IDR',
            'items': [{'material_id': material_id, 'quantity': 10, 'unit_price': 1000, 'uom': 'KG'}], **flags}
    r = client.post('/api/purchasing/purchase-orders', json=body, headers=headers)
    assert r.status_code == 201, r.get_json()
    return client.get(f"/api/purchasing/purchase-orders/{r.get_json()['po_id']}", headers=headers).get_json()


def _setup(db_session, test_material, ppn=None):
    from models.purchasing import Supplier
    s = Supplier(code='SUP-TAX', company_name='Sup Tax', is_active=True, ppn_code=ppn)
    db_session.add(s); db_session.commit()
    return s.id, test_material.id


def test_no_tax_when_not_taxable(client, auth_headers, db_session, test_material):
    sid, mid = _setup(db_session, test_material, 'Y')
    d = _po(client, auth_headers, sid, mid)
    assert d['is_taxable'] is False and d['tax_amount'] == 0 and d['subtotal'] == 10000 and d['total_amount'] == 10000


def test_taxable_exclusive_adds_ppn_from_supplier_code(client, auth_headers, db_session, test_material):
    sid, mid = _setup(db_session, test_material, 'Y')
    d = _po(client, auth_headers, sid, mid, is_taxable=True)
    assert d['ppn_code'] == 'Y' and d['tax_amount'] == 1100 and d['subtotal'] == 10000 and d['total_amount'] == 11100


def test_taxable_inclusive_extracts_ppn_total_unchanged(client, auth_headers, db_session, test_material):
    sid, mid = _setup(db_session, test_material, 'Y')
    d = _po(client, auth_headers, sid, mid, is_taxable=True, tax_inclusive=True)
    assert d['tax_inclusive'] is True and d['tax_amount'] == round(10000 - 10000 / 1.11, 2)
    assert round(d['subtotal'] + d['tax_amount'], 2) == 10000 and d['total_amount'] == 10000


def test_explicit_code_overrides_supplier_and_defaults_to_Y(client, auth_headers, db_session, test_material):
    sid, mid = _setup(db_session, test_material, None)
    assert _po(client, auth_headers, sid, mid, is_taxable=True)['ppn_code'] == 'Y'
    d = _po(client, auth_headers, sid, mid, is_taxable=True, ppn_code='L')
    assert d['ppn_code'] == 'L' and d['tax_amount'] == 1200


def test_inclusive_requires_taxable_and_update_recomputes(client, auth_headers, db_session, test_material):
    sid, mid = _setup(db_session, test_material, 'Y')
    d = _po(client, auth_headers, sid, mid, tax_inclusive=True)
    assert d['tax_inclusive'] is False and d['tax_amount'] == 0
    r = client.put(f"/api/purchasing/purchase-orders/{d['id']}", json={'is_taxable': True}, headers=auth_headers)
    assert r.status_code == 200
    d2 = client.get(f"/api/purchasing/purchase-orders/{d['id']}", headers=auth_headers).get_json()
    assert d2['tax_amount'] == 1100 and d2['total_amount'] == 11100
    client.put(f"/api/purchasing/purchase-orders/{d['id']}", json={'is_taxable': True, 'tax_inclusive': True}, headers=auth_headers)
    d3 = client.get(f"/api/purchasing/purchase-orders/{d['id']}", headers=auth_headers).get_json()
    assert d3['total_amount'] == 10000


def test_supplier_ppn_code_roundtrip(client, auth_headers, db_session):
    r = client.post('/api/purchasing/suppliers', json={'name': 'PT PPN Uji', 'ppn_code': 'a'}, headers=auth_headers)
    assert r.status_code in (200, 201), r.get_json()
    sid = r.get_json().get('supplier_id') or r.get_json().get('id')
    assert client.get(f'/api/purchasing/suppliers/{sid}', headers=auth_headers).get_json()['ppn_code'] == 'A'


def test_custom_po_number_used_and_duplicates_rejected(client, auth_headers, db_session, test_material):
    sid, mid = _setup(db_session, test_material, None)
    body = {'supplier_id': sid, 'order_date': '2026-10-28', 'currency': 'IDR', 'po_number': ' PO-MANUAL-77 ',
            'items': [{'material_id': mid, 'quantity': 1, 'unit_price': 1000, 'uom': 'KG'}]}
    r = client.post('/api/purchasing/purchase-orders', json=body, headers=auth_headers)
    assert r.status_code == 201 and r.get_json()['po_number'] == 'PO-MANUAL-77'
    dup = client.post('/api/purchasing/purchase-orders', json={**body, 'po_number': 'po-manual-77'}, headers=auth_headers)
    assert dup.status_code == 400 and 'sudah dipakai' in dup.get_json()['error']
    auto = client.post('/api/purchasing/purchase-orders', json={k: v for k, v in body.items() if k != 'po_number'}, headers=auth_headers)
    assert auto.status_code == 201 and auto.get_json()['po_number'].startswith('PO-')
    blank = client.post('/api/purchasing/purchase-orders', json={**body, 'po_number': '   '}, headers=auth_headers)
    assert blank.status_code == 201 and blank.get_json()['po_number'] != ''


def test_manual_exchange_rate_saved_and_locked_on_submit(client, auth_headers, db_session, test_material):
    sid, mid = _setup(db_session, test_material, None)
    body = {'supplier_id': sid, 'order_date': '2026-10-28', 'currency': 'USD', 'manual_exchange_rate': 16250.5,
            'items': [{'material_id': mid, 'quantity': 1, 'unit_price': 10, 'uom': 'KG'}]}
    r = client.post('/api/purchasing/purchase-orders', json=body, headers=auth_headers)
    assert r.status_code == 201, r.get_json()
    pid = r.get_json()['po_id']
    d = client.get(f'/api/purchasing/purchase-orders/{pid}', headers=auth_headers).get_json()
    assert d['manual_exchange_rate'] == 16250.5
    bad = client.post('/api/purchasing/purchase-orders', json={**body, 'manual_exchange_rate': -1}, headers=auth_headers)
    assert bad.status_code == 400
    client.post(f'/api/purchasing/purchase-orders/{pid}/submit-approval', json={}, headers=auth_headers)
    d2 = client.get(f'/api/purchasing/purchase-orders/{pid}', headers=auth_headers).get_json()
    assert d2['exchange_rate'] == 16250.5 and d2['exchange_rate_source'] == 'manual'
    idr = client.post('/api/purchasing/purchase-orders', json={**body, 'currency': 'IDR'}, headers=auth_headers).get_json()
    assert client.get(f"/api/purchasing/purchase-orders/{idr['po_id']}", headers=auth_headers).get_json()['manual_exchange_rate'] is None
