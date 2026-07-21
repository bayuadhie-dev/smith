from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import pandas as pd
import os
from werkzeug.utils import secure_filename
from app import db
from models import Product, Material, Inventory, User, WarehouseLocation, ProductCategory
from models.product import ProductSpecification
from models.purchasing import Supplier
from datetime import datetime
import traceback
from utils.timezone import get_local_now, get_local_today

import_bp = Blueprint('import', __name__)

ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def read_file(file_path):
    """Read CSV or Excel file into pandas DataFrame"""
    if file_path.endswith('.csv'):
        return pd.read_csv(file_path)
    else:
        return pd.read_excel(file_path)

def is_empty_val(val):
    """Helper to detect empty, NaN, or string literal 'nan' from pandas readings"""
    if pd.isnull(val):
        return True
    val_str = str(val).strip()
    if val_str == '' or val_str.lower() == 'nan':
        return True
    return False

@import_bp.route('/api/import/data', methods=['POST'])
@jwt_required()
def import_data():
    try:
        current_user_id = get_jwt_identity()
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        import_type = request.form.get('type')
        
        if file.filename == '':
            return jsonify({'error': 'Filename is empty'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File extension not allowed'}), 400
        
        if not import_type or import_type not in ['products', 'materials', 'inventory']:
            return jsonify({'error': 'Invalid import type'}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0, os.SEEK_SET)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': 'File size exceeds limit'}), 400
        
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        temp_path = os.path.join('temp_uploads', filename)
        os.makedirs('temp_uploads', exist_ok=True)
        file.save(temp_path)
        
        try:
            # Read the file
            df = read_file(temp_path)
            
            # Process based on import type
            if import_type == 'products':
                result = import_products(df, current_user_id)
            elif import_type == 'materials':
                result = import_materials(df, current_user_id)
            elif import_type == 'inventory':
                result = import_inventory(df, current_user_id)
            
            # Clean up temp file
            os.remove(temp_path)
            
            # If result contains a direct fatal error dict, return that with status code
            if 'error' in result and 'imported_count' not in result:
                return jsonify(result), 400
            
            status_code = 200
            if result.get('errors') and len(result['errors']) > 0:
                result['success'] = False
                status_code = 207
            else:
                result['success'] = True
            
            return jsonify(result), status_code
            
        except Exception as e:
            # Clean up temp file on error
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
        
    except Exception as e:
        print(f"Import error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

def import_products(df, user_id):
    """Import products from DataFrame"""
    required_columns = ['product_code', 'product_name', 'material_type', 'primary_uom', 'price', 'cost', 'category_code']
    
    # Validate columns
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        return {'error': f'Missing required columns: {", ".join(missing_columns)}'}
    
    imported_count = 0
    errors = []
    seen_codes = set()
    
    for index, row in df.iterrows():
        try:
            # Validate cell-level emptiness (detect blank cells or NaN)
            if any(is_empty_val(row.get(col)) for col in required_columns):
                errors.append(f'Row {index + 2}: Required column has empty or NaN value')
                continue
                
            code = str(row['product_code']).strip()
            name = str(row['product_name']).strip()
            material_type = str(row['material_type']).strip()
            primary_uom = str(row['primary_uom']).strip()
            price = float(row['price'])
            cost = float(row['cost'])
            category_code = str(row['category_code']).strip()
            
            # 1. Check duplicate intra-file
            if code in seen_codes:
                errors.append(f'Row {index + 2}: Skip product code {code} - duplicate in file')
                continue
            seen_codes.add(code)
            
            # 2. Verify Category exists
            category = ProductCategory.query.filter_by(code=category_code).first()
            if not category:
                errors.append(f'Row {index + 2}: Category code {category_code} not found in database')
                continue
            
            # 3. Check duplicate in database
            existing_product = Product.query.filter_by(code=code).first()
            if existing_product:
                errors.append(f'Row {index + 2}: Skip product code {code} - already exists in database')
                continue
            
            # Create new product
            gsm_val = float(row.get('gsm')) if pd.notnull(row.get('gsm')) and str(row.get('gsm')).strip().lower() != 'nan' else None
            width_val = float(row.get('width')) if pd.notnull(row.get('width')) and str(row.get('width')).strip().lower() != 'nan' else None
            length_val = float(row.get('length')) if pd.notnull(row.get('length')) and str(row.get('length')).strip().lower() != 'nan' else None
            
            product = Product(
                code=code,
                name=name,
                material_type=material_type,
                primary_uom=primary_uom,
                price=price,
                cost=cost,
                category_id=category.id,
                gramasi=gsm_val,
                slitting_cm=width_val,
                meter_kain=length_val,
                is_active=True,
                is_sellable=True,
                is_purchasable=True,
                is_producible=True,
                created_at=get_local_now()
            )
            db.session.add(product)
            
            # Flush session - stop and rollback if fatal operational/database error occurs
            try:
                db.session.flush()
            except Exception as db_err:
                db.session.rollback()
                return {'error': f'Fatal database error on row {index + 2} during flush. The entire import batch was cancelled (rolled back) and NO data was saved: {str(db_err)}'}
            
            # Create specifications (One-to-One linked table)
            spec = ProductSpecification(
                product_id=product.id,
                gsm=gsm_val,
                width_cm=width_val,
                length_m=length_val,
                created_at=get_local_now()
            )
            db.session.add(spec)
            
            imported_count += 1
            
        except Exception as e:
            errors.append(f'Row {index + 2}: {str(e)}')
            
    try:
        db.session.commit()
        return {
            'imported_count': imported_count,
            'errors': errors,
            'message': f'Successfully imported {imported_count} products'
        }
    except Exception as e:
        db.session.rollback()
        return {'error': f'Database error: {str(e)}'}

def import_materials(df, user_id):
    """Import raw materials from DataFrame"""
    required_columns = ['material_code', 'material_name', 'material_type', 'category', 'primary_uom', 'cost_per_unit']
    
    # Validate columns
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        return {'error': f'Missing required columns: {", ".join(missing_columns)}'}
    
    imported_count = 0
    errors = []
    seen_codes = set()
    
    for index, row in df.iterrows():
        try:
            # Validate cell-level emptiness (detect blank cells or NaN)
            if any(is_empty_val(row.get(col)) for col in required_columns):
                errors.append(f'Row {index + 2}: Required column has empty or NaN value')
                continue
                
            code = str(row['material_code']).strip()
            name = str(row['material_name']).strip()
            material_type = str(row['material_type']).strip()
            category = str(row['category']).strip()
            primary_uom = str(row['primary_uom']).strip()
            cost_per_unit = float(row['cost_per_unit'])
            
            # 1. Check duplicate intra-file
            if code in seen_codes:
                errors.append(f'Row {index + 2}: Skip material code {code} - duplicate in file')
                continue
            seen_codes.add(code)
            
            # 2. Check duplicate in database
            existing_material = Material.query.filter_by(code=code).first()
            if existing_material:
                errors.append(f'Row {index + 2}: Skip material code {code} - already exists in database')
                continue
            
            # 3. Lookup supplier ID from company name if filled (optional)
            supplier_id = None
            supplier_name = row.get('supplier_name')
            if pd.notnull(supplier_name) and str(supplier_name).strip() != '' and str(supplier_name).strip().lower() != 'nan':
                supplier = Supplier.query.filter_by(company_name=str(supplier_name).strip()).first()
                if supplier:
                    supplier_id = supplier.id
            
            # Create new material
            material = Material(
                code=code,
                name=name,
                material_type=material_type,
                category=category,
                primary_uom=primary_uom,
                cost_per_unit=cost_per_unit,
                supplier_id=supplier_id,
                is_active=True,
                is_hazardous=False,
                created_at=get_local_now()
            )
            db.session.add(material)
            
            try:
                db.session.flush()
            except Exception as db_err:
                db.session.rollback()
                return {'error': f'Fatal database error on row {index + 2} during flush. The entire import batch was cancelled (rolled back) and NO data was saved: {str(db_err)}'}
                
            imported_count += 1
            
        except Exception as e:
            errors.append(f'Row {index + 2}: {str(e)}')
            
    try:
        db.session.commit()
        return {
            'imported_count': imported_count,
            'errors': errors,
            'message': f'Successfully imported {imported_count} raw materials'
        }
    except Exception as e:
        db.session.rollback()
        return {'error': f'Database error: {str(e)}'}

def import_inventory(df, user_id):
    """Import inventory data from DataFrame"""
    required_columns = ['item_code', 'location_code', 'quantity']
    
    # Validate columns
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        return {'error': f'Missing required columns: {", ".join(missing_columns)}'}
    
    imported_count = 0
    errors = []
    
    for index, row in df.iterrows():
        try:
            # Validate cell-level emptiness (detect blank cells or NaN)
            if any(is_empty_val(row.get(col)) for col in required_columns):
                errors.append(f'Row {index + 2}: Required column has empty or NaN value')
                continue
                
            item_code = str(row['item_code']).strip()
            location_code = str(row['location_code']).strip()
            quantity = float(row['quantity'])
            
            # 1. Verify entity exists (can be Product or Material)
            product = Product.query.filter_by(code=item_code).first()
            material = Material.query.filter_by(code=item_code).first()
            
            if not product and not material:
                errors.append(f'Row {index + 2}: Item code {item_code} not found as product or material')
                continue
            
            # 2. Verify WarehouseLocation exists
            location = WarehouseLocation.query.filter_by(location_code=location_code).first()
            if not location:
                errors.append(f'Row {index + 2}: Location code {location_code} not found')
                continue
            
            # 3. Lookup source min/max stock dynamically from master data (highly symmetric)
            if product:
                source_min_stock = float(product.min_stock_level) if product.min_stock_level is not None else 0.0
                source_max_stock = float(product.max_stock_level) if product.max_stock_level is not None else 0.0
            else:
                source_min_stock = float(material.min_stock_level) if material.min_stock_level is not None else 0.0
                source_max_stock = float(material.max_stock_level) if material.max_stock_level is not None else 0.0
            
            # 4. Check if inventory record already exists
            if product:
                existing_inventory = Inventory.query.filter_by(
                    product_id=product.id,
                    location_id=location.id
                ).first()
            else:
                existing_inventory = Inventory.query.filter_by(
                    material_id=material.id,
                    location_id=location.id
                ).first()
            
            batch_number = str(row.get('batch_number')).strip() if pd.notnull(row.get('batch_number')) and str(row.get('batch_number')).strip().lower() != 'nan' else ''
            
            # Parse expiry date safely converting Timestamp to python date
            expiry_val = pd.to_datetime(row.get('expiry_date'), errors='coerce') if pd.notnull(row.get('expiry_date')) and str(row.get('expiry_date')).strip().lower() != 'nan' else None
            expiry_date = expiry_val.to_pydatetime().date() if pd.notnull(expiry_val) else None
            
            # 5. Handle stock_status override if provided in sheet, else default logically
            excel_status = row.get('stock_status')
            if pd.notnull(excel_status) and str(excel_status).strip() != '' and str(excel_status).strip().lower() != 'nan':
                stock_status = str(excel_status).strip()
            else:
                stock_status = 'released' if product else 'available'
            
            if existing_inventory:
                # Update (Upsert) - Refresh quantity & sync latest thresholds from Master Data
                # Correct quantity_available calculations preserving reserved quantity
                reserved_qty = float(existing_inventory.quantity_reserved or 0.0)
                existing_inventory.quantity_on_hand = quantity
                existing_inventory.quantity_available = max(0.0, quantity - reserved_qty)
                existing_inventory.min_stock_level = source_min_stock
                existing_inventory.max_stock_level = source_max_stock
                existing_inventory.batch_number = batch_number
                existing_inventory.expiry_date = expiry_date
                existing_inventory.stock_status = stock_status
                existing_inventory.updated_at = get_local_now()
            else:
                # Create new inventory record
                inventory = Inventory(
                    product_id=product.id if product else None,
                    material_id=material.id if material else None,
                    location_id=location.id,
                    quantity_on_hand=quantity,
                    quantity_reserved=0.0,
                    quantity_available=quantity,
                    min_stock_level=source_min_stock,
                    max_stock_level=source_max_stock,
                    batch_number=batch_number,
                    expiry_date=expiry_date,
                    stock_status=stock_status,
                    is_active=True,
                    created_by=user_id,
                    created_at=get_local_now()
                )
                db.session.add(inventory)
            
            try:
                db.session.flush()
            except Exception as db_err:
                db.session.rollback()
                return {'error': f'Fatal database error on row {index + 2} during flush. The entire import batch was cancelled (rolled back) and NO data was saved: {str(db_err)}'}
            
            imported_count += 1
            
        except Exception as e:
            errors.append(f'Row {index + 2}: {str(e)}')
            
    try:
        db.session.commit()
        return {
            'imported_count': imported_count,
            'errors': errors,
            'message': f'Successfully imported {imported_count} inventory records'
        }
    except Exception as e:
        db.session.rollback()
        return {'error': f'Database error: {str(e)}'}
