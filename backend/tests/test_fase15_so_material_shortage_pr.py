"""
Fase 15 (fix_report_3.md, 2026-10-02): confirm_order_core()
(utils/sales_order_workflow.py) only checked FINISHED-GOODS stock (ATP) on
SO confirm, never whether there's enough RAW MATERIAL to actually
manufacture it - found via a real production test where an SO for
120,000 pcs confirmed, auto-created a Work Order, and ran all the way to
shipped+invoiced+paid while every one of its 13 BOM raw materials had
ZERO stock the entire time.

Design (confirmed with owner, warning-only - a legitimate business case
is "sell now, procure the shortfall after"): when SO confirm detects a
BOM shortfall, auto-create ONE PurchaseRequisition for the shortfall
(linked back via PurchaseRequisition.sales_order_id) and summarize it on
SalesOrder.material_shortage_note. SO confirmation itself is NOT blocked.
material_eta_date stays NULL until purchasing manually fills it in later
via PUT /sales/orders/<id>.
"""
from datetime import date


def _setup_product_with_bom(db_session, required_qty_per_unit=1, available_stock=0):
    from models.product import Product, Material
    from models.production import BillOfMaterials, BOMItem
    from models.warehouse import WarehouseZone, WarehouseLocation, Inventory

    product = Product(code='PROD-F15-001', name='Test Product F15', material_type='finished_goods', primary_uom='PCS', is_producible=True, is_active=True)
    db_session.add(product)
    db_session.commit()

    material = Material(code='MAT-F15-001', name='Test Material F15', material_type='raw_materials', category='Raw', primary_uom='KG', cost_per_unit=100, is_active=True)
    db_session.add(material)
    db_session.commit()

    bom = BillOfMaterials(bom_number='BOM-F15-001', product_id=product.id, bom_level='finished_goods', version='1.0', is_active=True, batch_size=1, batch_uom='PCS')
    db_session.add(bom)
    db_session.commit()
    bom_item = BOMItem(bom_id=bom.id, line_number=1, material_id=material.id, quantity=required_qty_per_unit, uom='KG')
    db_session.add(bom_item)
    db_session.commit()

    if available_stock > 0:
        zone = WarehouseZone(code='Z-F15', name='Zone F15', material_type='raw_materials')
        db_session.add(zone)
        db_session.commit()
        location = WarehouseLocation(zone_id=zone.id, location_code='LOC-F15', rack='R1', level='L1', position='P1', capacity=100000, capacity_uom='kg')
        db_session.add(location)
        db_session.commit()
        inv = Inventory(material_id=material.id, location_id=location.id, quantity_on_hand=available_stock, quantity_available=available_stock, stock_status='available')
        db_session.add(inv)
        db_session.commit()

    return product, material


def test_confirm_with_insufficient_material_creates_pr_and_does_not_block(client, auth_headers, db_session, test_user):
    from models.sales import Customer, SalesOrder, SalesOrderItem
    from models.purchasing import PurchaseRequisition

    product, material = _setup_product_with_bom(db_session, required_qty_per_unit=2, available_stock=0)

    customer = Customer(code='CUST-F15', company_name='Test Customer F15', is_active=True)
    db_session.add(customer)
    db_session.commit()

    so = SalesOrder(order_number='SO-F15-001', customer_id=customer.id, order_date=date.today(), status='draft', created_by=test_user.id)
    db_session.add(so)
    db_session.commit()
    so_item = SalesOrderItem(order_id=so.id, line_number=1, product_id=product.id, quantity=100, uom='PCS', unit_price=1000, total_price=100000)
    db_session.add(so_item)
    db_session.commit()

    resp = client.put(f'/api/sales/orders/{so.id}/confirm', json={}, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    db_session.refresh(so)
    assert so.status == 'confirmed'
    assert so.material_shortage_note is not None
    assert 'PR-' in so.material_shortage_note

    pr = PurchaseRequisition.query.filter_by(sales_order_id=so.id).first()
    assert pr is not None
    assert pr.status == 'submitted'
    assert len(pr.items) == 1
    assert float(pr.items[0].quantity) == 200.0  # 100 pcs * 2 kg/pcs, 0 stock


def test_confirm_with_sufficient_material_creates_no_pr(client, auth_headers, db_session, test_user):
    from models.sales import Customer, SalesOrder, SalesOrderItem
    from models.purchasing import PurchaseRequisition

    product, material = _setup_product_with_bom(db_session, required_qty_per_unit=2, available_stock=1000)

    customer = Customer(code='CUST-F15B', company_name='Test Customer F15B', is_active=True)
    db_session.add(customer)
    db_session.commit()

    so = SalesOrder(order_number='SO-F15-002', customer_id=customer.id, order_date=date.today(), status='draft', created_by=test_user.id)
    db_session.add(so)
    db_session.commit()
    so_item = SalesOrderItem(order_id=so.id, line_number=1, product_id=product.id, quantity=100, uom='PCS', unit_price=1000, total_price=100000)
    db_session.add(so_item)
    db_session.commit()

    resp = client.put(f'/api/sales/orders/{so.id}/confirm', json={}, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    db_session.refresh(so)
    assert so.material_shortage_note is None
    assert PurchaseRequisition.query.filter_by(sales_order_id=so.id).first() is None


def test_purchasing_admin_can_fill_material_eta_date(client, auth_headers, db_session, test_user):
    from models.sales import Customer, SalesOrder

    customer = Customer(code='CUST-F15C', company_name='Test Customer F15C', is_active=True)
    db_session.add(customer)
    db_session.commit()
    so = SalesOrder(order_number='SO-F15-003', customer_id=customer.id, order_date=date.today(), status='confirmed', created_by=test_user.id)
    db_session.add(so)
    db_session.commit()

    resp = client.put(f'/api/sales/orders/{so.id}', json={'material_eta_date': '2026-11-01'}, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    db_session.refresh(so)
    assert so.material_eta_date.isoformat() == '2026-11-01'
