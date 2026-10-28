def test_so_item_discount_tiers_and_uom(client, auth_headers, test_customer, test_product):
    r = client.post('/api/sales/orders', headers=auth_headers, json={
        'customer_id': test_customer.id, 'order_date': '2026-10-28',
        'items': [{'product_id': test_product.id, 'quantity': 10, 'unit_price': 1000, 'uom': 'KG', 'discount_tiers': '10+5'}]})
    assert r.status_code == 201, r.get_json()
    oid = r.get_json().get('order_id') or r.get_json().get('id')
    d = client.get(f'/api/sales/orders/{oid}', headers=auth_headers).get_json()
    it = d['items'][0]
    assert it['uom'] == 'KG' and it['discount_tiers'] == '10+5' and it['discount_percent'] == 14.5
    assert round(it['total_price']) == round(10 * 1000 * 0.855 * (1 + it['tax_percent'] / 100))
