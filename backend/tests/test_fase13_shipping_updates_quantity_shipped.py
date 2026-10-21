"""
Fase 13 (fix_report_3.md, 2026-10-02): create_shipping_from_qc()
(POST /api/shipping/create-from-qc, routes/shipping.py) deducts real
Inventory and creates a ShippingItem, but never touched
SalesOrderItem.quantity_shipped - "how much of this SO line has actually
shipped" stayed 0 forever through this path. Found via a real end-to-end
production test (SO fully shipped+invoiced+paid, item still showed
quantity_shipped=0).
"""
from datetime import date


def test_create_shipping_from_qc_updates_sales_order_item_quantity_shipped(client, auth_headers, db_session, test_product, test_user):
    from models.sales import Customer, SalesOrder, SalesOrderItem
    from models.production import WorkOrder
    from models.warehouse import WarehouseZone, WarehouseLocation, Inventory

    customer = Customer(code='CUST-F13-SHIP', company_name='Test Customer F13', is_active=True)
    db_session.add(customer)
    db_session.commit()

    so = SalesOrder(
        order_number='SO-F13-SHIP-001', customer_id=customer.id, order_date=date.today(),
        status='in_production',
    )
    db_session.add(so)
    db_session.commit()

    so_item = SalesOrderItem(
        order_id=so.id, line_number=1, product_id=test_product.id, quantity=100, uom='PCS',
        unit_price=1000, total_price=100000, quantity_shipped=0,
    )
    db_session.add(so_item)
    db_session.commit()

    wo = WorkOrder(
        wo_number='WO-F13-SHIP-001', product_id=test_product.id, quantity=100, uom='PCS',
        status='completed', sales_order_id=so.id, quantity_produced=100, quantity_good=100,
    )
    db_session.add(wo)
    db_session.commit()

    zone = WarehouseZone(code='Z-F13-SHIP', name='Zone FG F13', material_type='finished_goods')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code='LOC-F13-SHIP', rack='R1', level='L1', position='P1',
        capacity=1000, capacity_uom='pcs',
    )
    db_session.add(location)
    db_session.commit()
    inv = Inventory(
        product_id=test_product.id, location_id=location.id, batch_number=None,
        quantity_on_hand=100, quantity_available=100, stock_status='released',
    )
    db_session.add(inv)
    db_session.commit()

    resp = client.post('/api/shipping/create-from-qc', json={
        'work_order_id': wo.id,
        'delivery_method': 'expedition',
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    db_session.refresh(so_item)
    assert float(so_item.quantity_shipped) == 100.0
