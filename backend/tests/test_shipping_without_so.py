from models.sales import Customer


def test_surat_jalan_tanpa_so_terbawa_ke_faktur(client, auth_headers, db_session):
    cu = Customer(code='CX1', company_name='PT Uji Waste')
    db_session.add(cu)
    db_session.commit()
    r = client.post('/api/shipping/orders', headers=auth_headers, json={
        'customer_id': cu.id, 'shipping_date': '2026-11-13',
        'items': [{'description': 'Jasa maklon cutting', 'quantity': 3, 'uom': 'LOT'}, {'description': 'jasa maklon cutting', 'quantity': 2, 'uom': 'LOT'}]})
    assert r.status_code == 201, r.get_json()
    sid = r.get_json()['shipping_id']
    u = client.get(f'/api/shipping/orders/uninvoiced?customer_id={cu.id}', headers=auth_headers).get_json()['orders']
    assert [o['id'] for o in u] == [sid]
    assert u[0]['items'] == [{'product_id': None, 'product_code': None, 'description': 'Jasa maklon cutting', 'quantity': 5.0, 'uom': 'LOT'}]
    from datetime import date
    from models.finance import Invoice
    from models.shipping import ShippingOrder
    inv = Invoice(invoice_number='INV-UJI-1', invoice_type='sales', invoice_date=date.today(), customer_id=cu.id, subtotal=500000, total_amount=500000, status='sent')
    db_session.add(inv)
    db_session.commit()
    db_session.get(ShippingOrder, sid).invoice_id = inv.id
    db_session.commit()
    assert client.get(f'/api/shipping/orders/uninvoiced?customer_id={cu.id}', headers=auth_headers).get_json()['orders'] == []
