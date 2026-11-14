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


def test_surat_jalan_pilih_gudang_dan_batch(client, auth_headers, db_session):
    from models import Inventory
    from models.product import Product
    from models.warehouse import WarehouseLocation, WarehouseZone
    z1 = WarehouseZone(code='ZA', name='Gudang A', material_type='finished_goods')
    z2 = WarehouseZone(code='ZB', name='Gudang B', material_type='finished_goods')
    db_session.add_all([z1, z2]); db_session.flush()
    l1 = WarehouseLocation(zone_id=z1.id, location_code='ZA-1', rack='A', level='1', position='1', capacity_uom='PCS')
    l2 = WarehouseLocation(zone_id=z2.id, location_code='ZB-1', rack='A', level='1', position='1', capacity_uom='PCS')
    p = Product(code='SJ-P1', name='Barang SJ', material_type='finished_goods', primary_uom='PCS', is_active=True)
    cu = Customer(code='CZ', company_name='PT Z')
    db_session.add_all([l1, l2, p, cu]); db_session.flush()
    db_session.add_all([Inventory(product_id=p.id, location_id=l1.id, batch_number='B-1', quantity_on_hand=50, quantity_available=50, stock_status='available'),
                        Inventory(product_id=p.id, location_id=l2.id, batch_number='B-2', quantity_on_hand=200, quantity_available=200, stock_status='available')])
    db_session.commit()
    o = client.get(f'/api/shipping/stock-options?product_id={p.id}', headers=auth_headers).get_json()['zones']
    assert [z['name'] for z in o] == ['Gudang A', 'Gudang B']
    base = {'customer_id': cu.id, 'shipping_date': '2026-11-14'}
    # gudang A hanya 50: tidak boleh mengambil dari gudang B
    bad = client.post('/api/shipping/orders', headers=auth_headers, json={**base, 'items': [{'product_id': p.id, 'quantity': 80, 'uom': 'PCS', 'zone_id': z1.id}]})
    assert bad.status_code == 400
    ok = client.post('/api/shipping/orders', headers=auth_headers, json={**base, 'items': [{'product_id': p.id, 'quantity': 30, 'uom': 'PCS', 'zone_id': z1.id, 'batch_number': 'B-1'}]})
    assert ok.status_code == 201, ok.get_json()
    left = {i.batch_number: float(i.quantity_on_hand) for i in Inventory.query.filter_by(product_id=p.id).all()}
    assert left == {'B-1': 20.0, 'B-2': 200.0}
    wrong = client.post('/api/shipping/orders', headers=auth_headers, json={**base, 'items': [{'product_id': p.id, 'quantity': 5, 'uom': 'PCS', 'zone_id': z1.id, 'batch_number': 'B-2'}]})
    assert wrong.status_code == 400
