import pytest
from datetime import datetime, timedelta
from app import db
from models.user import User
from models.production import WorkOrder, Machine
from models.product import Product
from models.sales import Customer
from models.warehouse import WarehouseZone, WarehouseLocation, Inventory

def test_auth_validation_failures(client):
    """Test validation errors for Auth and User management (Negative Paths)"""
    # 1. Register with invalid email format
    invalid_email_payload = {
        'username': 'bad_user',
        'email': 'bad-email-format',
        'password': 'password123',
        'role_ids': [1]
    }
    response = client.post('/api/auth/register', json=invalid_email_payload)
    # Validation should fail (400 Bad Request)
    assert response.status_code == 400
    assert 'error' in response.json or 'message' in response.json

    # 2. Login with empty credentials
    empty_login_payload = {
        'username': '',
        'password': ''
    }
    response = client.post('/api/auth/login', json=empty_login_payload)
    assert response.status_code in [400, 401]


def test_production_validation_failures(client, auth_headers, db_session):
    """Test validation errors for Production and Work Orders (Negative Paths)"""
    # Create test product
    product = Product(
        code='PROD-VAL-01',
        name='Validation Test Product',
        material_type='finished_goods',
        primary_uom='PCS',
        price=100.0
    )
    db_session.add(product)
    
    # Create test machine (machine_type is required/nullable=False)
    machine = Machine(
        code='MC-VAL-01',
        name='Validation Machine',
        machine_type='cutting_machine',
        status='active'
    )
    db_session.add(machine)
    db_session.commit()

    # 1. Create Work Order with invalid date sequence (end_date before start_date)
    invalid_wo_payload = {
        'wo_number': 'WO-VAL-BAD-DATES',
        'product_id': product.id,
        'machine_id': machine.id,
        'planned_quantity': 100,
        'scheduled_start_date': (datetime.utcnow() + timedelta(days=5)).isoformat(),
        'scheduled_end_date': datetime.utcnow().isoformat(),  # End date is earlier
        'status': 'planned'
    }
    response = client.post('/api/production/work-orders', json=invalid_wo_payload, headers=auth_headers)
    assert response.status_code == 400
    
    # 2. Create Work Order with negative planned quantity
    negative_qty_payload = {
        'wo_number': 'WO-VAL-NEG-QTY',
        'product_id': product.id,
        'machine_id': machine.id,
        'planned_quantity': -500,  # Negative quantity
        'scheduled_start_date': datetime.utcnow().isoformat(),
        'scheduled_end_date': (datetime.utcnow() + timedelta(days=1)).isoformat(),
        'status': 'planned'
    }
    response = client.post('/api/production/work-orders', json=negative_qty_payload, headers=auth_headers)
    assert response.status_code == 400


def test_production_output_record_validation(client, auth_headers, db_session):
    """Test validation failures when recording production outputs (Negative Paths)"""
    # Create test product, machine, and valid Work Order
    product = Product(
        code='PROD-VAL-02',
        name='Validation Product 2',
        material_type='finished_goods',
        primary_uom='PCS',
        price=100.0
    )
    machine = Machine(
        code='MC-VAL-02', 
        name='Validation Machine 2', 
        machine_type='packing_machine',
        status='active'
    )
    db_session.add_all([product, machine])
    db_session.commit()

    wo = WorkOrder(
        wo_number='WO-VAL-02',
        product_id=product.id,
        machine_id=machine.id,
        planned_quantity=100,
        scheduled_start_date=datetime.utcnow(),
        scheduled_end_date=datetime.utcnow() + timedelta(days=1),
        status='in_progress'
    )
    db_session.add(wo)
    db_session.commit()

    # 1. Report output with negative good quantity
    negative_output_payload = {
        'machine_id': machine.id,
        'production_date': datetime.utcnow().date().isoformat(),
        'shift': '1',
        'good_quantity': -10,  # Negative good qty
        'reject_quantity': 0,
        'actual_runtime': 480
    }
    response = client.post(f'/api/production/work-orders/{wo.id}/output', json=negative_output_payload, headers=auth_headers)
    assert response.status_code == 400

    # 2. Report output with negative runtime minutes
    negative_runtime_payload = {
        'machine_id': machine.id,
        'production_date': datetime.utcnow().date().isoformat(),
        'shift': '1',
        'good_quantity': 50,
        'reject_quantity': 2,
        'actual_runtime': -60  # Negative runtime minutes
    }
    response = client.post(f'/api/production/work-orders/{wo.id}/output', json=negative_runtime_payload, headers=auth_headers)
    assert response.status_code == 400


def test_warehouse_transfer_validation(client, auth_headers, db_session):
    """Test validation failures in Warehouse and Stock Transfers (Negative Paths)"""
    # Create warehouse zone
    zone = WarehouseZone(
        code='ZONE-VAL-1',
        name='Zone 1',
        material_type='finished_goods'
    )
    db_session.add(zone)
    db_session.commit()

    # Create locations
    loc1 = WarehouseLocation(
        zone_id=zone.id,
        location_code='LOC-VAL-A',
        rack='R1',
        level='L1',
        position='P1',
        capacity=100.0,
        capacity_uom='pcs'
    )
    loc2 = WarehouseLocation(
        zone_id=zone.id,
        location_code='LOC-VAL-B',
        rack='R1',
        level='L1',
        position='P2',
        capacity=100.0,
        capacity_uom='pcs'
    )
    db_session.add_all([loc1, loc2])
    db_session.commit()

    # 1. Transfer stock from location to itself (invalid self-transfer)
    self_transfer_payload = {
        'source_location_id': loc1.id,
        'destination_location_id': loc1.id,  # Same location
        'product_id': 1,
        'quantity': 10
    }
    response = client.post('/api/warehouse/transfers', json=self_transfer_payload, headers=auth_headers)
    assert response.status_code == 400

    # 2. Transfer negative quantity of stock
    neg_transfer_payload = {
        'source_location_id': loc1.id,
        'destination_location_id': loc2.id,
        'product_id': 1,
        'quantity': -5  # Negative quantity
    }
    response = client.post('/api/warehouse/transfers', json=neg_transfer_payload, headers=auth_headers)
    assert response.status_code == 400


def test_sales_order_input_validation(client, auth_headers, db_session):
    """Test payload validation failures on sales order placement (Negative Paths)"""
    # Create a customer
    customer = Customer(
        code='CUST-VAL-01',
        company_name='Input Testing Corp',
        credit_limit=1000.00,
        payment_terms_days=30,
        is_active=True
    )
    product = Product(
        code='PROD-VAL-VAL',
        name='Expensive Product',
        material_type='finished_goods',
        primary_uom='PCS',
        price=500.00
    )
    db_session.add_all([customer, product])
    db_session.commit()

    # 1. Sales order with negative quantity
    negative_qty_payload = {
        'customer_id': customer.id,
        'order_date': datetime.utcnow().date().isoformat(),
        'items': [
            {
                'product_id': product.id,
                'quantity': -3,  # Negative quantity
                'unit_price': 500.00
            }
        ]
    }
    response = client.post('/api/sales/orders', json=negative_qty_payload, headers=auth_headers)
    assert response.status_code in [400, 422]

    # 2. Sales order with missing items list
    missing_items_payload = {
        'customer_id': customer.id,
        'order_date': datetime.utcnow().date().isoformat(),
        'items': []  # Empty items list
    }
    response = client.post('/api/sales/orders', json=missing_items_payload, headers=auth_headers)
    assert response.status_code in [400, 422]
