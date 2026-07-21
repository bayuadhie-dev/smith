import pytest
import io
import pandas as pd
from models.product import Product, Material, ProductCategory
from models.warehouse import WarehouseLocation, Inventory
from models.purchasing import Supplier

def test_import_products_success(client, db_session, auth_headers):
    # Prepare dependencies
    category = ProductCategory(code='WET-TISSUE', name='Wet Tissue', is_active=True)
    db_session.add(category)
    db_session.commit()

    # Create CSV content
    csv_data = (
        "product_code,product_name,material_type,primary_uom,price,cost,category_code,gsm,width,length\n"
        "PROD-TEST-1,Test Product 1,finished_goods,Roll,15000,10000,WET-TISSUE,50,15,100\n"
    )
    
    data = {
        'file': (io.BytesIO(csv_data.encode('utf-8')), 'products.csv'),
        'type': 'products'
    }
    
    response = client.post('/api/import/data', data=data, content_type='multipart/form-data', headers=auth_headers)
    assert response.status_code == 200
    res_json = response.get_json()
    assert res_json['success'] is True
    assert res_json['imported_count'] == 1
    assert len(res_json['errors']) == 0
    
    # Check DB
    prod = Product.query.filter_by(code='PROD-TEST-1').first()
    assert prod is not None
    assert prod.name == 'Test Product 1'
    assert prod.price == 15000
    assert prod.cost == 10000
    assert prod.category.code == 'WET-TISSUE'
    
    # Assert NOT NULL default fields (Point 3.1)
    assert prod.is_active is True
    assert prod.is_sellable is True
    assert prod.is_purchasable is True
    assert prod.is_producible is True
    
    # Check specifications
    assert prod.specification is not None
    assert prod.specification.gsm == 50
    assert prod.specification.width_cm == 15
    assert prod.specification.length_m == 100

def test_import_products_duplicate_and_missing_category(client, db_session, auth_headers):
    category = ProductCategory(code='WET-TISSUE', name='Wet Tissue', is_active=True)
    db_session.add(category)
    db_session.commit()

    # CSV with:
    # 1. Valid row
    # 2. Duplicate row of the first
    # 3. Missing category code
    # 4. Empty product code (NaN check - Point 3.3)
    csv_data = (
        "product_code,product_name,material_type,primary_uom,price,cost,category_code,gsm,width,length\n"
        "PROD-TEST-2,Test Product 2,finished_goods,Roll,15000,10000,WET-TISSUE,50,15,100\n"
        "PROD-TEST-2,Test Product 2 Duplicate,finished_goods,Roll,15000,10000,WET-TISSUE,50,15,100\n"
        "PROD-TEST-3,Test Product 3,finished_goods,Roll,15000,10000,INVALID-CAT,50,15,100\n"
        ",Test Product 4 Empty,finished_goods,Roll,15000,10000,WET-TISSUE,50,15,100\n"
    )
    
    data = {
        'file': (io.BytesIO(csv_data.encode('utf-8')), 'products.csv'),
        'type': 'products'
    }
    
    response = client.post('/api/import/data', data=data, content_type='multipart/form-data', headers=auth_headers)
    assert response.status_code == 207
    res_json = response.get_json()
    assert res_json['success'] is False
    assert res_json['imported_count'] == 1
    assert len(res_json['errors']) == 3
    assert "duplicate" in res_json['errors'][0].lower()
    assert "category" in res_json['errors'][1].lower()
    assert "empty" in res_json['errors'][2].lower()
    
    # Assert database does NOT contain 'nan' as code (Point 3.3)
    nan_prod = Product.query.filter_by(code='nan').first()
    assert nan_prod is None

def test_import_materials_success(client, db_session, auth_headers):
    # Prepare dependencies
    supplier = Supplier(code='SPL-001', company_name='Test Supplier', is_active=True)
    db_session.add(supplier)
    db_session.commit()

    # CSV with:
    # 1. Valid material with supplier
    # 2. Valid material without supplier name (Point 3.2)
    csv_data = (
        "material_code,material_name,material_type,category,primary_uom,cost_per_unit,supplier_name\n"
        "MAT-TEST-1,Test Material 1,raw_materials,Chemical,Liter,5000,Test Supplier\n"
        "MAT-TEST-2,Test Material 2,raw_materials,Chemical,Liter,6000,\n"
    )
    
    data = {
        'file': (io.BytesIO(csv_data.encode('utf-8')), 'materials.csv'),
        'type': 'materials'
    }
    
    response = client.post('/api/import/data', data=data, content_type='multipart/form-data', headers=auth_headers)
    assert response.status_code == 200
    res_json = response.get_json()
    assert res_json['success'] is True
    assert res_json['imported_count'] == 2
    assert len(res_json['errors']) == 0
    
    # Check DB
    mat1 = Material.query.filter_by(code='MAT-TEST-1').first()
    assert mat1 is not None
    assert mat1.supplier.company_name == 'Test Supplier'
    
    mat2 = Material.query.filter_by(code='MAT-TEST-2').first()
    assert mat2 is not None
    assert mat2.supplier_id is None # Verify it correctly defaults to None without crashing

def test_import_inventory_success_and_upsert(client, db_session, auth_headers):
    # Prepare dependencies
    prod = Product(code='PROD-INV', name='Inv Product', material_type='finished_goods', primary_uom='Pcs', price=10, cost=5, is_active=True, is_sellable=True, is_purchasable=True, is_producible=True, min_stock_level=10, max_stock_level=100)
    mat = Material(code='MAT-INV', name='Inv Material', material_type='raw_materials', category='Fiber', primary_uom='Kg', cost_per_unit=5, is_active=True, is_hazardous=False, min_stock_level=20, max_stock_level=200)
    loc = WarehouseLocation(zone_id=1, location_code='LOC-A', rack='R1', level='L1', position='P1', capacity=1000, capacity_uom='Kg', occupied=0, is_active=True, is_available=True)
    db_session.add_all([prod, mat, loc])
    db_session.commit()

    # CSV with:
    # 1. Product in inventory (no custom status - defaults to released)
    # 2. Material in inventory (custom status specified - quarantine)
    csv_data = (
        "item_code,location_code,quantity,stock_status\n"
        "PROD-INV,LOC-A,50,\n"
        "MAT-INV,LOC-A,30,quarantine\n"
    )
    
    data = {
        'file': (io.BytesIO(csv_data.encode('utf-8')), 'inventory.csv'),
        'type': 'inventory'
    }
    
    # First Import (inserts)
    response = client.post('/api/import/data', data=data, content_type='multipart/form-data', headers=auth_headers)
    assert response.status_code == 200
    res_json = response.get_json()
    assert res_json['success'] is True
    assert res_json['imported_count'] == 2
    
    inv_p = Inventory.query.filter_by(product_id=prod.id, location_id=loc.id).first()
    assert inv_p is not None
    assert inv_p.quantity_on_hand == 50
    assert inv_p.quantity_available == 50
    assert inv_p.stock_status == 'released' # Check default
    
    inv_m = Inventory.query.filter_by(material_id=mat.id, location_id=loc.id).first()
    assert inv_m is not None
    assert inv_m.quantity_on_hand == 30
    assert inv_m.quantity_available == 30
    assert inv_m.stock_status == 'quarantine' # Check custom stock status (Point 2 & 3.5)

    # Manually simulate quantity reservation on Product inventory
    inv_p.quantity_reserved = 10.0
    inv_p.quantity_available = 40.0
    db_session.commit()

    # Simulate threshold revisions on Product master data
    prod.min_stock_level = 15
    prod.max_stock_level = 150
    db_session.commit()

    # Second Import (upserts with quantity_available correction check and threshold refresh)
    csv_data_new = (
        "item_code,location_code,quantity\n"
        "PROD-INV,LOC-A,70\n"
    )
    data_new = {
        'file': (io.BytesIO(csv_data_new.encode('utf-8')), 'inventory.csv'),
        'type': 'inventory'
    }
    
    response = client.post('/api/import/data', data=data_new, content_type='multipart/form-data', headers=auth_headers)
    assert response.status_code == 200
    
    db_session.refresh(inv_p)
    
    assert inv_p.quantity_on_hand == 70
    assert inv_p.min_stock_level == 15
    assert inv_p.max_stock_level == 150
    
    # Assert correct quantity_available calculation: 70 - 10 = 60 (Point 1 & 3.4)
    assert inv_p.quantity_available == 60

def test_import_materials_validation_and_intra_file_duplicates(client, db_session, auth_headers):
    # Prepare dependencies
    supplier = Supplier(code='SPL-001', company_name='Test Supplier', is_active=True)
    db_session.add(supplier)
    db_session.commit()

    # CSV with combination cases:
    # 1. Empty code (NaN check)
    # 2. Duplicate code in file
    # 3. Duplicate code in file (second instance)
    # 4. Empty category value
    csv_data = (
        "material_code,material_name,material_type,category,primary_uom,cost_per_unit,supplier_name\n"
        ",Empty Code Mat,raw_materials,Chemical,Liter,5000,Test Supplier\n"
        "MAT-DUP,Dup Material 1,raw_materials,Chemical,Liter,5000,Test Supplier\n"
        "MAT-DUP,Dup Material 2,raw_materials,Chemical,Liter,6000,Test Supplier\n"
        "MAT-NO-CAT,No Cat Material,raw_materials,,Liter,4000,Test Supplier\n"
    )
    data = {
        'file': (io.BytesIO(csv_data.encode('utf-8')), 'materials.csv'),
        'type': 'materials'
    }
    
    response = client.post('/api/import/data', data=data, content_type='multipart/form-data', headers=auth_headers)
    assert response.status_code == 207
    res_json = response.get_json()
    assert res_json['success'] is False
    assert res_json['imported_count'] == 1 # only MAT-DUP (the first instance) succeeded
    assert len(res_json['errors']) == 3
    assert "required" in res_json['errors'][0].lower() or "empty" in res_json['errors'][0].lower()
    assert "duplicate in file" in res_json['errors'][1].lower()
    assert "required" in res_json['errors'][2].lower() or "empty" in res_json['errors'][2].lower()

def test_import_inventory_upsert_stock_status_and_symmetric_thresholds(client, db_session, auth_headers):
    # Prepare dependencies
    prod = Product(code='PROD-INV-STATUS', name='Inv Status Prod', material_type='finished_goods', primary_uom='Pcs', price=10, cost=5, is_active=True, is_sellable=True, is_purchasable=True, is_producible=True, min_stock_level=10, max_stock_level=100)
    loc = WarehouseLocation(zone_id=1, location_code='LOC-B', rack='R1', level='L1', position='P1', capacity=1000, capacity_uom='Kg', occupied=0, is_active=True, is_available=True)
    db_session.add_all([prod, loc])
    db_session.commit()

    # 1. Create inventory with status 'quarantine'
    csv_data1 = (
        "item_code,location_code,quantity,stock_status\n"
        "PROD-INV-STATUS,LOC-B,50,quarantine\n"
    )
    data1 = {
        'file': (io.BytesIO(csv_data1.encode('utf-8')), 'inventory.csv'),
        'type': 'inventory'
    }
    response1 = client.post('/api/import/data', data=data1, content_type='multipart/form-data', headers=auth_headers)
    assert response1.status_code == 200
    
    inv = Inventory.query.filter_by(product_id=prod.id, location_id=loc.id).first()
    assert inv is not None
    assert inv.quantity_on_hand == 50
    assert inv.stock_status == 'quarantine'

    # 2. Upsert inventory, changing status to 'released' and quantity to 80
    csv_data2 = (
        "item_code,location_code,quantity,stock_status\n"
        "PROD-INV-STATUS,LOC-B,80,released\n"
    )
    data2 = {
        'file': (io.BytesIO(csv_data2.encode('utf-8')), 'inventory.csv'),
        'type': 'inventory'
    }
    response2 = client.post('/api/import/data', data=data2, content_type='multipart/form-data', headers=auth_headers)
    assert response2.status_code == 200
    
    db_session.refresh(inv)
    assert inv.quantity_on_hand == 80
    assert inv.stock_status == 'released'

def test_import_fatal_database_error(client, db_session, auth_headers, monkeypatch):
    # Prepare dependencies
    category = ProductCategory(code='WET-TISSUE', name='Wet Tissue', is_active=True)
    db_session.add(category)
    db_session.commit()

    csv_data = (
        "product_code,product_name,material_type,primary_uom,price,cost,category_code\n"
        "PROD-CRASH,Crash Product,finished_goods,Roll,15000,10000,WET-TISSUE\n"
    )
    data = {
        'file': (io.BytesIO(csv_data.encode('utf-8')), 'products.csv'),
        'type': 'products'
    }
    
    # Mock db.session.flush to raise an exception
    def mock_flush():
        raise Exception("Simulated fatal DB connection crash during flush")
    
    monkeypatch.setattr(db_session, "flush", mock_flush)
    
    response = client.post('/api/import/data', data=data, content_type='multipart/form-data', headers=auth_headers)
    
    # Assert status code is 400 (bad request return envelope for fatal error dicts)
    assert response.status_code == 400
    res_json = response.get_json()
    assert "error" in res_json
    assert "Fatal database error" in res_json['error']
    assert "NO data was saved" in res_json['error']
    assert "Simulated fatal DB connection" in res_json['error']

    # Check DB - verify product was not saved (rolled back)
    prod = Product.query.filter_by(code='PROD-CRASH').first()
    assert prod is None
