def test_so_line_description_saved_and_read(client, auth_headers, test_customer, test_product):
    r = client.post('/api/sales/orders', headers=auth_headers, json={
        'customer_id': test_customer.id, 'order_date': '2026-10-28',
        'items': [{'product_id': test_product.id, 'quantity': 2, 'unit_price': 1000, 'description': 'Karbon rotary joint 2 inch'}]})
    assert r.status_code == 201, r.get_json()
    oid = r.get_json().get('order_id') or r.get_json().get('id')
    d = client.get(f'/api/sales/orders/{oid}', headers=auth_headers).get_json()
    assert d['items'][0]['description'] == 'Karbon rotary joint 2 inch'


def test_po_line_description_saved_updated_and_printed(client, auth_headers, db_session, test_user, test_product):
    from datetime import date
    from models.purchasing import Supplier
    sup = Supplier(code='SUP-DESC', company_name='CV Uji', address='x', city='y', country='ID')
    db_session.add(sup); db_session.commit()
    r = client.post('/api/purchasing/purchase-orders', headers=auth_headers, json={
        'supplier_id': sup.id, 'order_date': date.today().isoformat(),
        'items': [{'product_id': test_product.id, 'quantity': 3, 'unit_price': 500, 'uom': 'PCS', 'description': 'Karbon rotary joint blabla'}]})
    assert r.status_code == 201, r.get_json()
    pid = r.get_json().get('po_id') or r.get_json().get('id')
    d = client.get(f'/api/purchasing/purchase-orders/{pid}', headers=auth_headers).get_json()
    assert d['items'][0]['description'] == 'Karbon rotary joint blabla'
    u = client.put(f'/api/purchasing/purchase-orders/{pid}', headers=auth_headers, json={
        'supplier_id': sup.id, 'items': [{'product_id': test_product.id, 'quantity': 3, 'unit_price': 500, 'uom': 'PCS', 'description': 'Seal baru'}]})
    assert u.status_code == 200, u.get_json()
    d = client.get(f'/api/purchasing/purchase-orders/{pid}', headers=auth_headers).get_json()
    assert d['items'][0]['description'] == 'Seal baru'
    g = client.post(f'/api/documents/generate-from-purchase-order/{pid}', headers=auth_headers)
    assert g.status_code == 201, g.get_json()
    from models.document_management import Document
    doc = Document.query.filter_by(reference_type='purchase_order', reference_id=pid).first()
    assert doc.document_data['line_items'][0]['item_name'] == 'Seal baru' and 'Seal baru' in doc.html_content


def test_po_line_notes_and_net_terms(client, auth_headers, db_session, test_product):
    from models.purchasing import Supplier
    sup = Supplier(code='SUP-NET', company_name='PT Net', payment_terms_days=30)
    db_session.add(sup); db_session.commit()
    body = {'supplier_id': sup.id, 'order_date': '2026-11-04', 'payment_terms': 'NET_45', 'delivery_address': 'Jl. Pabrik 1',
            'items': [{'product_id': test_product.id, 'quantity': 2, 'unit_price': 1000, 'uom': 'PCS', 'description': 'Karbon rotary joint', 'notes': 'Ganti seal sisi kiri'}]}
    r = client.post('/api/purchasing/purchase-orders', headers=auth_headers, json=body)
    assert r.status_code == 201, r.get_json()
    po = client.get(f"/api/purchasing/purchase-orders/{r.get_json()['po_id'] if 'po_id' in r.get_json() else r.get_json().get('id')}", headers=auth_headers).get_json()
    assert po['payment_terms'] == 'NET_45'
    it = po['items'][0]
    assert it['description'] == 'Karbon rotary joint' and it['notes'] == 'Ganti seal sisi kiri'
