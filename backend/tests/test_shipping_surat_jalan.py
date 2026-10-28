def test_shipping_create_and_print_surat_jalan(client, auth_headers, db_session, test_customer, test_product, test_user):
    from datetime import date
    from models import Inventory
    from models.sales import SalesOrder, SalesOrderItem
    from models.warehouse import WarehouseZone, WarehouseLocation
    so = SalesOrder(order_number='SO-SJ-1', customer_id=test_customer.id, order_date=date.today(), status='confirmed',
                    subtotal=0, total_amount=0, delivery_address='Jl. Kirim 1', notes='catatan so', created_by=test_user.id)
    db_session.add(so); db_session.commit()
    item = SalesOrderItem(order_id=so.id, line_number=1, product_id=test_product.id, quantity=10, uom='PCS', unit_price=1000, total_price=10000, description='ket item')
    db_session.add(item); db_session.commit()
    zone = WarehouseZone(code='Z-SJ', name='Zona SJ', zone_type='all', material_type='all')
    db_session.add(zone); db_session.commit()
    loc = WarehouseLocation(zone_id=zone.id, location_code='LOC-SJ-1', rack='R1', level='L1', position='P1', capacity=1000, capacity_uom='pcs')
    db_session.add(loc); db_session.commit()
    db_session.add(Inventory(product_id=test_product.id, batch_number='B1', quantity_on_hand=50, quantity_available=50, quantity_reserved=0, location_id=loc.id))
    db_session.commit()
    r = client.post('/api/shipping/orders', headers=auth_headers, json={
        'sales_order_id': so.id, 'customer_id': test_customer.id, 'shipping_date': '2026-10-29',
        'driver_name': 'Pak Budi', 'vehicle_number': 'B 1234 XY', 'notes': 'hati-hati',
        'items': [{'product_id': test_product.id, 'quantity': 4, 'uom': 'PCS'}]})
    assert r.status_code == 201, r.get_json()
    sid = r.get_json()['shipping_id']
    d = client.post(f'/api/documents/generate-from-shipping-order/{sid}', headers=auth_headers)
    assert d.status_code == 201, d.get_json()
    from models.document_management import Document
    data = Document.query.filter_by(reference_type='shipping_order', reference_id=sid).first().document_data
    assert data['driver_name'] == 'Pak Budi' and data['vehicle_number'] == 'B 1234 XY' and data['notes'] == 'hati-hati'
    assert data['total_quantity'] == 4 and data['items'][0]['description'] == 'ket item' and 'B1' in data['items'][0]['batch_text']
    assert data['customer_address'] == 'Jl. Kirim 1'
    # no SO -> clear error, not a crash
    bad = client.post('/api/shipping/orders', headers=auth_headers, json={'items': []})
    assert bad.status_code == 400


def test_shipping_import_preview_then_commit(client, auth_headers, db_session, test_customer, test_product, test_user):
    import io
    from datetime import date
    import openpyxl
    from models import Inventory
    from models.shipping import ShippingOrder
    from models.sales import SalesOrder, SalesOrderItem
    from models.warehouse import WarehouseZone, WarehouseLocation
    so = SalesOrder(order_number='SO-IMP-SJ', customer_id=test_customer.id, order_date=date.today(), status='confirmed',
                    subtotal=0, total_amount=0, created_by=test_user.id)
    db_session.add(so); db_session.commit()
    db_session.add(SalesOrderItem(order_id=so.id, line_number=1, product_id=test_product.id, quantity=10, uom='PCS', unit_price=1000, total_price=10000))
    zone = WarehouseZone(code='Z-SJI', name='Zona', zone_type='all', material_type='all')
    db_session.add(zone); db_session.commit()
    loc = WarehouseLocation(zone_id=zone.id, location_code='LOC-SJI', rack='R', level='L', position='P', capacity=1000, capacity_uom='pcs')
    db_session.add(loc); db_session.commit()
    db_session.add(Inventory(product_id=test_product.id, batch_number='BI1', quantity_on_hand=50, quantity_available=50, quantity_reserved=0, location_id=loc.id))
    db_session.commit()

    def book():
        wb = openpyxl.Workbook(); ws = wb.active
        ws.append(['No. Pengiriman', 'No. Sales Order', 'Tanggal', 'Kode Barang', 'Qty Kirim', 'Satuan', 'Sopir', 'No. Kendaraan'])
        ws.append(['K1', 'SO-IMP-SJ', '2026-10-29', test_product.code, 3, '', 'Pak Andi', 'D 1 AB'])
        ws.append(['K2', 'SO-IMP-SJ', '2026-10-29', test_product.code, 99, '', '', ''])
        b = io.BytesIO(); wb.save(b); b.seek(0); return b
    post = lambda c: client.post('/api/imports/shipping_order', headers=auth_headers, content_type='multipart/form-data', data={'file': (book(), 's.xlsx'), 'commit': c}).get_json()
    before = ShippingOrder.query.count()
    prev = post('0')
    assert prev['summary']['ok'] == 1 and prev['summary']['error'] == 1, prev
    assert ShippingOrder.query.count() == before
    done = post('1')
    assert done['committed'] and ShippingOrder.query.count() == before + 1
    ship = ShippingOrder.query.order_by(ShippingOrder.id.desc()).first()
    assert ship.driver_name == 'Pak Andi' and ship.vehicle_number == 'D 1 AB'


def test_invoice_from_shipping_links_sj_and_tiered_discount(client, auth_headers, db_session, test_customer, test_product, test_user):
    from datetime import date
    from tests.test_void_gl import _setup_accounts
    from models.shipping import ShippingOrder
    from models.sales import SalesOrder, SalesOrderItem
    from models.finance import Invoice, InvoiceItem
    _setup_accounts(db_session)
    so = SalesOrder(order_number='SO-INV-1', customer_id=test_customer.id, order_date=date.today(), status='confirmed',
                    subtotal=0, total_amount=0, created_by=test_user.id)
    db_session.add(so); db_session.commit()
    ship = ShippingOrder(shipping_number='SHP-T-1', sales_order_id=so.id, customer_id=test_customer.id, shipping_date=date.today())
    db_session.add(ship); db_session.commit()
    r = client.get(f'/api/shipping/orders/uninvoiced?sales_order_id={so.id}', headers=auth_headers)
    assert r.status_code == 200 and [o['shipping_number'] for o in r.get_json()['orders']] == ['SHP-T-1']
    resp = client.post('/api/finance/invoices', headers=auth_headers, json={
        'invoice_type': 'sales', 'invoice_date': date.today().isoformat(), 'customer_id': test_customer.id,
        'sales_order_id': so.id, 'shipping_order_ids': [ship.id], 'payment_terms': 'net_30',
        'items': [{'product_id': test_product.id, 'description': 'X', 'uom': 'KG', 'quantity': 10, 'unit_price': 1000, 'discount_tiers': '10+5'}]})
    assert resp.status_code in (200, 201), resp.get_json()
    inv = Invoice.query.order_by(Invoice.id.desc()).first()
    item = InvoiceItem.query.filter_by(invoice_id=inv.id).first()
    assert float(item.discount_percent) == 14.5 and item.uom == 'KG' and float(item.total_amount) == 8550
    db_session.refresh(ship)
    assert ship.invoice_id == inv.id
    r2 = client.get(f'/api/shipping/orders/uninvoiced?sales_order_id={so.id}', headers=auth_headers)
    assert r2.get_json()['orders'] == []
