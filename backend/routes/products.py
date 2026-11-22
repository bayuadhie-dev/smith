from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db, Product, ProductCategory, ProductSpecification, ProductPackaging, Material, Inventory, SalesOrder
from utils.i18n import success_response, error_response, get_message
from sqlalchemy import or_, func
from sqlalchemy.orm import joinedload
from utils.calculations import (
    calculate_gsm, calculate_sheet_weight, validate_nonwoven_specs,
    calculate_packaging_structure, convert_uom, NONWOVEN_CATEGORIES
)
from utils.timezone import get_local_now, get_local_today
from utils.master_data_usage import get_usage
import redis
import os
import json

products_bp = Blueprint('products', __name__)

@products_bp.route('/<int:id>/usage', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_product_usage(id):
    """Where-used report: which tables across the whole schema reference this product,
    discovered dynamically via FK introspection (not a hardcoded per-module list)."""
    product = db.session.get(Product, id)
    if not product:
        return jsonify(error_response('api.error', error_code=404)), 404
    return jsonify({'usage': get_usage('products', id)}), 200

@products_bp.route('/categories', methods=['GET'])
def get_nonwoven_categories():
    """Get all nonwoven product categories"""
    return jsonify({
        'categories': [
            {
                'id': key,
                'name': category['name'],
                'gsm_range': category['typical_gsm_range'],
                'width_range': category['typical_width_range'],
                'length_range': category['typical_length_range'],
                'weight_range': category['weight_per_sheet_range']
            }
            for key, category in NONWOVEN_CATEGORIES.items()
        ]
    })

@products_bp.route('/calculate/gsm', methods=['POST'])
def calculate_gsm_endpoint():
    """Calculate GSM for nonwoven fabric"""
    try:
        data = request.get_json()
        width_cm = data.get('width_cm', 0)
        length_m = data.get('length_m', 0)
        weight_g = data.get('weight_g', 0)

        gsm = calculate_gsm(width_cm, length_m, weight_g)

        return jsonify({
            'gsm': gsm,
            'inputs': {
                'width_cm': width_cm,
                'length_m': length_m,
                'weight_g': weight_g
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@products_bp.route('/calculate/sheet-weight', methods=['POST'])
def calculate_sheet_weight_endpoint():
    """Calculate weight per sheet"""
    try:
        data = request.get_json()
        gsm = data.get('gsm', 0)
        width_cm = data.get('width_cm', 0)
        length_cm = data.get('length_cm', 0)

        weight_g = calculate_sheet_weight(gsm, width_cm, length_cm)

        return jsonify({
            'weight_per_sheet_g': weight_g,
            'inputs': {
                'gsm': gsm,
                'width_cm': width_cm,
                'length_cm': length_cm
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@products_bp.route('/validate/specifications', methods=['POST'])
def validate_specifications():
    """Validate nonwoven specifications against category standards"""
    try:
        data = request.get_json()
        category = data.get('category', '')
        gsm = data.get('gsm', 0)
        width_cm = data.get('width_cm', 0)
        length_cm = data.get('length_cm', 0)

        validation = validate_nonwoven_specs(category, gsm, width_cm, length_cm)

        return jsonify(validation)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@products_bp.route('/calculate/packaging', methods=['POST'])
def calculate_packaging():
    """Calculate packaging structure"""
    try:
        data = request.get_json()
        sheets_per_pack = data.get('sheets_per_pack', 0)
        packs_per_karton = data.get('packs_per_karton', 0)

        packaging = calculate_packaging_structure(sheets_per_pack, packs_per_karton)

        return jsonify(packaging)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@products_bp.route('/convert/uom', methods=['POST'])
def convert_uom_endpoint():
    """Convert between units of measurement"""
    try:
        data = request.get_json()
        value = data.get('value', 0)
        from_uom = data.get('from_uom', '')
        to_uom = data.get('to_uom', '')

        converted_value = convert_uom(value, from_uom, to_uom)

        return jsonify({
            'original_value': value,
            'from_uom': from_uom,
            'to_uom': to_uom,
            'converted_value': converted_value
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@products_bp.route('', methods=['GET'])
@products_bp.route('/', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_products():
    """Get all products with filtering and pagination"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        all_products = request.args.get('all', 'false').lower() == 'true'
        search = request.args.get('search', '')
        category_id = request.args.get('category_id', type=int)
        material_type = request.args.get('material_type')
        is_active = request.args.get('is_active', type=bool)
        
        # Try cache
        cache_key = f'products_list_page{page}_per{per_page}_all{all_products}_search{search}_cat{category_id or "none"}_type{material_type or "none"}_active{is_active or "all"}'
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            cached_data = r.get(cache_key)
            if cached_data:
                return jsonify(json.loads(cached_data)), 200
        except Exception as cache_error:
            print(f"Redis cache error (using fallback): {cache_error}")
        
        # Kategori dan kemasan ikut diambil sekalian - kalau malas-muat,
        # 1000 produk berarti 2000 query tambahan dan daftarnya tidak pernah
        # sempat tampil (2026-11-22).
        query = Product.query.options(
            joinedload(Product.category),
            joinedload(Product.packaging)
        )
        
        if search:
            query = query.filter(or_(
                Product.code.ilike(f'%{search}%'),
                Product.name.ilike(f'%{search}%')
            ))
        
        if category_id:
            query = query.filter_by(category_id=category_id)
        
        if material_type:
            query = query.filter_by(material_type=material_type)
        
        if is_active is not None:
            query = query.filter_by(is_active=is_active)
        
        # If all=true, return all products without pagination (for dropdowns)
        if all_products:
            products_list = query.order_by(Product.code).all()
            response_data = {
                'products': [{
                    'id': p.id,
                    'code': p.code,
                    'name': p.name,
                    'description': p.description,
                    'category': p.category.name if p.category else None,
                    'nonwoven_category': p.nonwoven_category,
                    'primary_uom': p.primary_uom,
                    'price': float(p.price) if p.price else 0,
                    'cost': float(p.cost) if p.cost else 0,
                    'material_type': p.material_type,
                    'is_active': p.is_active,
                    'is_sellable': p.is_sellable,
                    'is_purchasable': p.is_purchasable,
                    'is_producible': p.is_producible,
                    'kelompok': p.kelompok,
                    'ppn_code': p.ppn_code,
                    'barcode': p.barcode, 'brand': p.brand,
                    'erp_approval': p.erp_approval,
                    'packs_per_karton': p.packaging.packs_per_karton if p.packaging else None,  # From ProductPackaging
                    'created_at': p.created_at.isoformat() if p.created_at else None
                } for p in products_list],
                'total': len(products_list)
            }
            try:
                redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
                r = redis.from_url(redis_url)
                r.setex(cache_key, 600, json.dumps(response_data))
            except Exception as cache_error:
                print(f"Redis cache set error (continuing without cache): {cache_error}")
            return jsonify(response_data), 200
        
        products = query.paginate(page=page, per_page=per_page, error_out=False)
        
        response_data = {
            'products': [{
                'id': p.id,
                'code': p.code,
                'name': p.name,
                'description': p.description,
                'category': p.category.name if p.category else None,
                'nonwoven_category': p.nonwoven_category,
                'primary_uom': p.primary_uom,
                'price': float(p.price) if p.price else 0,
                'cost': float(p.cost) if p.cost else 0,
                'material_type': p.material_type,
                'is_active': p.is_active,
                'is_sellable': p.is_sellable,
                'is_purchasable': p.is_purchasable,
                'is_producible': p.is_producible,
                'kelompok': p.kelompok,
                    'ppn_code': p.ppn_code,
                'erp_approval': p.erp_approval,
                'packs_per_karton': p.packaging.packs_per_karton if p.packaging else None,  # From ProductPackaging
                'created_at': p.created_at.isoformat() if p.created_at else None
            } for p in products.items],
            'total': products.total,
            'pages': products.pages,
            'current_page': products.page
        }
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            r.setex(cache_key, 600, json.dumps(response_data))
        except Exception as cache_error:
            print(f"Redis cache set error (continuing without cache): {cache_error}")
            
        return jsonify(response_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_product(id):
    """Get single product details"""
    try:
        product = db.session.get(Product, id)
        
        if not product:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        result = {
            'id': product.id,
            'code': product.code,
            'name': product.name,
            'description': product.description,
            'category_id': product.category_id,
            'category': product.category.name if product.category else None,
            'nonwoven_category': product.nonwoven_category,
            'primary_uom': product.primary_uom,
            'secondary_uom': product.secondary_uom,
            'price': float(product.price),
            'cost': float(product.cost),
            'material_type': product.material_type,
            'min_stock_level': float(product.min_stock_level) if product.min_stock_level else 0,
            'max_stock_level': float(product.max_stock_level) if product.max_stock_level else 0,
            'reorder_point': float(product.reorder_point) if product.reorder_point else 0,
            'is_active': product.is_active,
            'is_sellable': product.is_sellable,
            'is_purchasable': product.is_purchasable,
            'is_producible': product.is_producible,
            'lead_time_days': product.lead_time_days,
            'min_order_qty': float(product.min_order_qty) if product.min_order_qty is not None else None,
            'kelompok': product.kelompok,
            'barcode': product.barcode, 'brand': product.brand, 'require_batch': product.require_batch, 'require_expiry': product.require_expiry,
            'item_length_m': float(product.item_length_m) if product.item_length_m is not None else None,
            'item_width_m': float(product.item_width_m) if product.item_width_m is not None else None,
            'item_height_m': float(product.item_height_m) if product.item_height_m is not None else None,
            'item_weight_kg': float(product.item_weight_kg) if product.item_weight_kg is not None else None,
            'ppn_code': product.ppn_code,
            'erp_approval': product.erp_approval,
            'self_life_days': product.self_life_days,
            'retest_period_days': product.retest_period_days,
            'akun_persediaan_id': product.akun_persediaan_id,
            'akun_penjualan_id': product.akun_penjualan_id,
            'akun_retur_penjualan_id': product.akun_retur_penjualan_id,
            'akun_diskon_penjualan_id': product.akun_diskon_penjualan_id,
            'akun_barang_terkirim_id': product.akun_barang_terkirim_id,
            'akun_hpp_id': product.akun_hpp_id,
            'akun_retur_pembelian_id': product.akun_retur_pembelian_id,
            'akun_beban_id': product.akun_beban_id,
            'akun_pembelian_belum_tertagih_id': product.akun_pembelian_belum_tertagih_id,
            'created_at': product.created_at.isoformat()
        }
        
        # Add specification fields to top level (for easier form handling)
        if product.specification:
            spec = product.specification
            result.update({
                'gsm': float(spec.gsm) if spec.gsm else None,
                'width_cm': float(spec.width_cm) if spec.width_cm else None,
                'length_m': float(spec.length_m) if spec.length_m else None,
                'thickness_mm': float(spec.thickness_mm) if spec.thickness_mm else None,
                'color': spec.color,
                'weight_per_sheet_g': float(spec.weight_per_sheet_g) if spec.weight_per_sheet_g else None,
                'absorbency': spec.absorbency,
                'tensile_strength': spec.tensile_strength,
                'ph_level': spec.ph_level,
                'fragrance': spec.fragrance,
                'alcohol_content': spec.alcohol_content,
                'cone_weight_kg': float(spec.cone_weight_kg) if spec.cone_weight_kg else None,
            })
            # Also keep nested structure for backward compatibility
            result['specification'] = {
                'gsm': float(spec.gsm) if spec.gsm else None,
                'width_cm': float(spec.width_cm) if spec.width_cm else None,
                'length_m': float(spec.length_m) if spec.length_m else None,
                'thickness_mm': float(spec.thickness_mm) if spec.thickness_mm else None,
                'color': spec.color,
                'weight_per_sheet_g': float(spec.weight_per_sheet_g) if spec.weight_per_sheet_g else None,
                'absorbency': spec.absorbency,
                'tensile_strength': spec.tensile_strength,
                'ph_level': spec.ph_level,
                'fragrance': spec.fragrance,
                'alcohol_content': spec.alcohol_content
            }
        
        # Add packaging fields to top level (for easier form handling)
        if product.packaging:
            pack = product.packaging
            result.update({
                'sheets_per_pack': pack.sheets_per_pack,
                'packs_per_karton': pack.packs_per_karton,
                'sheets_per_karton': pack.sheets_per_karton,
                'pack_weight_kg': float(pack.pack_weight_kg) if pack.pack_weight_kg else None,
                'karton_weight_kg': float(pack.karton_weight_kg) if pack.karton_weight_kg else None,
                'pack_dimensions': pack.pack_dimensions,
                'karton_dimensions': pack.karton_dimensions,
                'barcode_pack': pack.barcode_pack,
                'barcode_karton': pack.barcode_karton
            })
            # Also keep nested structure for backward compatibility
            result['packaging'] = {
                'sheets_per_pack': pack.sheets_per_pack,
                'packs_per_karton': pack.packs_per_karton,
                'sheets_per_karton': pack.sheets_per_karton,
                'pack_weight_kg': float(pack.pack_weight_kg) if pack.pack_weight_kg else None,
                'karton_weight_kg': float(pack.karton_weight_kg) if pack.karton_weight_kg else None,
                'pack_dimensions': pack.pack_dimensions,
                'karton_dimensions': pack.karton_dimensions,
                'barcode_pack': pack.barcode_pack,
                'barcode_karton': pack.barcode_karton
            }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/', methods=['POST'])
@jwt_required()
@require_permission('products.create')
def create_product():
    """Create new product"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('code') or not data.get('name'):
            return jsonify(error_response('api.error', error_code=400)), 400
        
        # Check if code exists
        if Product.query.filter_by(code=data['code']).first():
            return jsonify(error_response('api.error', error_code=409)), 409
        
        # Create product
        product = Product(
            code=data['code'],
            name=data['name'],
            description=data.get('description'),
            category_id=data.get('category_id'),
            nonwoven_category=data.get('nonwoven_category'),
            primary_uom=data.get('primary_uom', 'PCS'),
            secondary_uom=data.get('secondary_uom'),
            price=data.get('price', 0),
            cost=data.get('cost', 0),
            material_type=data.get('material_type', 'finished_goods'),
            min_stock_level=data.get('min_stock_level', 0),
            max_stock_level=data.get('max_stock_level', 0),
            reorder_point=data.get('reorder_point', 0),
            is_active=data.get('is_active', True),
            is_sellable=data.get('is_sellable', True),
            is_purchasable=data.get('is_purchasable', True),
            is_producible=data.get('is_producible', False),
            lead_time_days=data.get('lead_time_days', 0)
        )
        
        db.session.add(product)
        db.session.flush()
        
        # Create specification if provided (handle both nested and flat structure)
        spec_fields = ['gsm', 'width_cm', 'length_m', 'thickness_mm', 'color', 
                      'weight_per_sheet_g', 'absorbency', 'tensile_strength', 
                      'ph_level', 'fragrance', 'alcohol_content', 'cone_weight_kg']
        
        if 'specification' in data:
            # Nested structure
            spec_data = data['specification']
        else:
            # Flat structure - extract spec fields from main data
            spec_data = {field: data.get(field) for field in spec_fields if field in data}
        
        if spec_data and any(v is not None for v in spec_data.values()):
            spec = ProductSpecification(
                product_id=product.id,
                **{k: v for k, v in spec_data.items() if v is not None}
            )
            db.session.add(spec)
        
        # Create packaging if provided (handle both nested and flat structure)
        pack_fields = ['sheets_per_pack', 'packs_per_karton', 'pack_weight_kg', 
                      'karton_weight_kg', 'pack_dimensions', 'karton_dimensions',
                      'barcode_pack', 'barcode_karton']
        
        if 'packaging' in data:
            # Nested structure
            pack_data = data['packaging']
        else:
            # Flat structure - extract pack fields from main data
            pack_data = {field: data.get(field) for field in pack_fields if field in data}
        
        if pack_data and any(v is not None for v in pack_data.values()):
            # Calculate sheets_per_karton if both sheets_per_pack and packs_per_karton are provided
            if pack_data.get('sheets_per_pack') and pack_data.get('packs_per_karton'):
                pack_data['sheets_per_karton'] = pack_data['sheets_per_pack'] * pack_data['packs_per_karton']
            
            pack = ProductPackaging(
                product_id=product.id,
                **{k: v for k, v in pack_data.items() if v is not None}
            )
            db.session.add(pack)
        
        db.session.commit()
        
        # Invalidate cache
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            keys = r.keys('products_list_*')
            if keys:
                r.delete(*keys)
        except Exception as cache_error:
            print(f"Redis cache invalidation error (continuing): {cache_error}")
        
        return jsonify({
            'message': 'Product created successfully',
            'product_id': product.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@products_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('products.edit')
def update_product(id):
    """Update product"""
    try:
        product = db.session.get(Product, id)
        
        if not product:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        data = request.get_json()
        
        # Update basic fields
        if 'name' in data:
            product.name = data['name']
        if 'description' in data:
            product.description = data['description']
        if 'category_id' in data:
            product.category_id = data['category_id']
        if 'nonwoven_category' in data:
            product.nonwoven_category = data['nonwoven_category']
        if 'primary_uom' in data:
            product.primary_uom = data['primary_uom']
        if 'material_type' in data:
            product.material_type = data['material_type']
        if 'price' in data:
            product.price = data['price']
        if 'cost' in data:
            product.cost = data['cost']
        if 'is_active' in data:
            product.is_active = data['is_active']
        if 'kelompok' in data:
            product.kelompok = data['kelompok']
        if 'ppn_code' in data:
            product.ppn_code = data['ppn_code']
        for _f in ('barcode', 'brand'):
            if _f in data:
                setattr(product, _f, (str(data[_f]).strip()[:100] or None) if data[_f] not in (None, '') else None)
        for _f in ('item_length_m', 'item_width_m', 'item_height_m', 'item_weight_kg'):
            if _f in data:
                setattr(product, _f, data[_f] if data[_f] not in ('', None) else None)
        for _f in ('require_batch', 'require_expiry'):
            if _f in data:
                setattr(product, _f, bool(data[_f]))
        if 'erp_approval' in data:
            product.erp_approval = data['erp_approval']
        if 'lead_time_days' in data:
            product.lead_time_days = data['lead_time_days']
        if 'min_order_qty' in data:
            product.min_order_qty = data['min_order_qty'] if data['min_order_qty'] not in ('', None) else None
        if 'reorder_point' in data:
            product.reorder_point = data['reorder_point']
        if 'self_life_days' in data:
            product.self_life_days = data['self_life_days']
        if 'retest_period_days' in data:
            product.retest_period_days = data['retest_period_days']
        for akun_field in ('akun_persediaan_id', 'akun_penjualan_id', 'akun_retur_penjualan_id',
                           'akun_diskon_penjualan_id', 'akun_barang_terkirim_id', 'akun_hpp_id',
                           'akun_retur_pembelian_id', 'akun_beban_id', 'akun_pembelian_belum_tertagih_id'):
            if akun_field in data:
                setattr(product, akun_field, data[akun_field])

        # Update specification if provided (handle both nested and flat structure)
        spec_fields = ['gsm', 'width_cm', 'length_m', 'thickness_mm', 'color', 
                      'weight_per_sheet_g', 'absorbency', 'tensile_strength', 
                      'ph_level', 'fragrance', 'alcohol_content', 'cone_weight_kg']
        
        if 'specification' in data:
            # Nested structure
            spec_data = data['specification']
        else:
            # Flat structure - extract spec fields from main data
            spec_data = {field: data.get(field) for field in spec_fields if field in data}
        
        if spec_data and any(v is not None for v in spec_data.values()):
            if product.specification:
                spec = product.specification
                for key, value in spec_data.items():
                    if hasattr(spec, key):
                        setattr(spec, key, value)
            else:
                spec = ProductSpecification(
                    product_id=product.id, 
                    **{k: v for k, v in spec_data.items() if v is not None}
                )
                db.session.add(spec)
        
        # Update packaging if provided (handle both nested and flat structure)
        pack_fields = ['sheets_per_pack', 'packs_per_karton', 'pack_weight_kg', 
                      'karton_weight_kg', 'pack_dimensions', 'karton_dimensions',
                      'barcode_pack', 'barcode_karton']
        
        if 'packaging' in data:
            # Nested structure
            pack_data = data['packaging']
        else:
            # Flat structure - extract pack fields from main data
            pack_data = {field: data.get(field) for field in pack_fields if field in data}
        
        if pack_data and any(v is not None for v in pack_data.values()):
            # Calculate sheets_per_karton if both sheets_per_pack and packs_per_karton are provided
            if pack_data.get('sheets_per_pack') and pack_data.get('packs_per_karton'):
                pack_data['sheets_per_karton'] = pack_data['sheets_per_pack'] * pack_data['packs_per_karton']
            
            if product.packaging:
                pack = product.packaging
                for key, value in pack_data.items():
                    if hasattr(pack, key):
                        setattr(pack, key, value)
            else:
                pack = ProductPackaging(
                    product_id=product.id, 
                    **{k: v for k, v in pack_data.items() if v is not None}
                )
                db.session.add(pack)
        
        db.session.commit()
        
        # Invalidate cache
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            keys = r.keys('products_list_*')
            if keys:
                r.delete(*keys)
        except Exception as cache_error:
            print(f"Redis cache invalidation error (continuing): {cache_error}")
        
        return jsonify(success_response('api.success')), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@products_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('products.delete')
def delete_product(id):
    """Delete product"""
    try:
        product = db.session.get(Product, id)
        
        if not product:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        db.session.delete(product)
        db.session.commit()
        
        # Invalidate cache
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            keys = r.keys('products_list_*')
            if keys:
                r.delete(*keys)
        except Exception as cache_error:
            print(f"Redis cache invalidation error (continuing): {cache_error}")
        
        return jsonify(success_response('api.success')), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@products_bp.route('/delete-all', methods=['DELETE'])
@jwt_required()
@require_permission('products.delete')
def delete_all_products():
    """Delete all products from database"""
    try:
        # Get count before deletion for confirmation
        total_products = Product.query.count()
        
        if total_products == 0:
            return jsonify({
                'message': 'No products found to delete',
                'deleted_count': 0
            }), 200
        
        # Delete all products
        deleted_count = Product.query.delete()
        db.session.commit()
        
        # Invalidate cache
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            keys = r.keys('products_list_*')
            if keys:
                r.delete(*keys)
        except Exception as cache_error:
            print(f"Redis cache invalidation error (continuing): {cache_error}")
        
        return jsonify({
            'message': f'Successfully deleted all products from database',
            'deleted_count': deleted_count,
            'previous_total': total_products
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@products_bp.route('/product-categories', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_categories():
    """Get all product categories.

    Bug fixed 2026-10-07 (system-wide fabricated-data sweep): the frontend's
    `ProductCategories.tsx` page (the real, routed "Kategori Produk" CRUD
    page) was calling `GET /api/products/categories` - a URL that collides
    with a completely unrelated endpoint at the same path (line ~30, a
    static nonwoven spec-range lookup: gsm/width/length ranges, not a
    product category CRUD list at all). That shape mismatch rendered as
    "Products: NaN" / "Total Value: RpNaN" on every category card live in
    production. THIS is the real product-category list endpoint
    (`/product-categories`) - now also includes is_active/parent_id/
    parent_name/product_count/total_value/created_at/updated_at (real,
    computed from the actual Product rows in each category), which the
    frontend needs and this endpoint didn't previously return at all.
    """
    try:
        cache_key = 'products_categories_all_v2'
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            cached_data = r.get(cache_key)
            if cached_data:
                return jsonify(json.loads(cached_data)), 200
        except Exception as cache_error:
            print(f"Redis cache error (using fallback): {cache_error}")

        categories = ProductCategory.query.all()
        category_ids = [c.id for c in categories]

        product_counts = dict(db.session.query(
            Product.category_id, func.count(Product.id)
        ).filter(Product.category_id.in_(category_ids)).group_by(Product.category_id).all()) if category_ids else {}

        inventory_value_rows = db.session.query(
            Product.category_id, func.sum(Inventory.quantity_on_hand * Product.price)
        ).join(Inventory, Inventory.product_id == Product.id).filter(
            Product.category_id.in_(category_ids)
        ).group_by(Product.category_id).all() if category_ids else []
        total_value_by_category = {cat_id: float(val or 0) for cat_id, val in inventory_value_rows}

        categories_by_id = {c.id: c for c in categories}

        response_data = {
            'categories': [{
                'id': c.id,
                'code': c.code,
                'name': c.name,
                'description': c.description,
                'parent_id': c.parent_id,
                'parent_name': categories_by_id[c.parent_id].name if c.parent_id and c.parent_id in categories_by_id else None,
                'is_active': c.is_active,
                'product_count': product_counts.get(c.id, 0),
                'total_value': total_value_by_category.get(c.id, 0),
                'created_at': c.created_at.isoformat() if c.created_at else None,
                'updated_at': c.updated_at.isoformat() if c.updated_at else None,
            } for c in categories]
        }
        
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            r.setex(cache_key, 600, json.dumps(response_data))
        except Exception as cache_error:
            print(f"Redis cache set error (continuing without cache): {cache_error}")

        return jsonify(response_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/categories', methods=['POST'])
@jwt_required()
@require_permission('products.create')
def create_category():
    """Create new product category"""
    try:
        data = request.get_json()
        
        if not data.get('code') or not data.get('name'):
            return jsonify(error_response('api.error', error_code=400)), 400
        
        if ProductCategory.query.filter_by(code=data['code']).first():
            return jsonify(error_response('api.error', error_code=409)), 409
        
        category = ProductCategory(
            code=data['code'],
            name=data['name'],
            description=data.get('description'),
            parent_id=data.get('parent_id')
        )
        
        db.session.add(category)
        db.session.commit()
        
        # Invalidate cache
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            r.delete('products_categories_all')
        except Exception as cache_error:
            print(f"Redis cache invalidation error (continuing): {cache_error}")
        
        return jsonify({
            'message': 'Category created successfully',
            'category_id': category.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@products_bp.route('/categories/<category_id>', methods=['PUT'])
@jwt_required()
@require_permission('products.edit')
def update_category(category_id):
    """Update product category"""
    try:
        category = db.session.get(ProductCategory, category_id) or abort(404)
        data = request.get_json()
        
        if data.get('code') and data['code'] != category.code:
            if ProductCategory.query.filter_by(code=data['code']).first():
                return jsonify(error_response('api.error', error_code=409)), 409
            category.code = data['code']
        
        if data.get('name'):
            category.name = data['name']
        if data.get('description'):
            category.description = data['description']
        if 'parent_id' in data:
            category.parent_id = data['parent_id']
        
        db.session.commit()
        
        # Invalidate cache
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            r.delete('products_categories_all')
        except Exception as cache_error:
            print(f"Redis cache invalidation error (continuing): {cache_error}")
        
        return jsonify({
            'message': 'Category updated successfully',
            'category': {
                'id': category.id,
                'code': category.code,
                'name': category.name,
                'description': category.description
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@products_bp.route('/categories/<category_id>', methods=['DELETE'])
@jwt_required()
@require_permission('products.delete')
def delete_category(category_id):
    """Delete product category"""
    try:
        category = db.session.get(ProductCategory, category_id) or abort(404)
        
        # Check if category has products
        product_count = Product.query.filter_by(category_id=category.id).count()
        if product_count > 0:
            return jsonify({
                'error': f'Cannot delete category. It has {product_count} products assigned.'
            }), 400
        
        # Soft delete by setting is_active to False
        category.is_active = False
        db.session.commit()
        
        # Invalidate cache
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            r.delete('products_categories_all')
        except Exception as cache_error:
            print(f"Redis cache invalidation error (continuing): {cache_error}")
        
        return jsonify({
            'message': 'Category deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Dashboard and Analytics Endpoints
@products_bp.route('/dashboard/kpis', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_dashboard_kpis():
    """Angka ringkas dashboard produk.

    Sampai 2026-11 nilai persediaan dan peringatan stok di sini masih
    hardcoded 0. Sekarang dihitung dari tabel inventory. Peringatan stok
    hanya dihitung untuk produk yang ambang minimumnya memang diisi -
    tanpa ambang, 'stok habis' tidak berarti apa-apa untuk ratusan baris
    master data yang belum pernah diproduksi.
    """
    try:
        total_products = Product.query.count()
        active_products = Product.query.filter_by(is_active=True).count()
        inactive_products = total_products - active_products

        total_categories = ProductCategory.query.count()

        # Stok per produk (hanya baris inventory yang masih aktif).
        stok = db.session.query(
            Inventory.product_id.label('product_id'),
            func.coalesce(func.sum(Inventory.quantity_on_hand), 0).label('qty')
        ).filter(
            Inventory.product_id.isnot(None),
            Inventory.is_active == True
        ).group_by(Inventory.product_id).subquery()

        ambang = db.session.query(
            Product.id,
            Product.min_stock_level,
            func.coalesce(stok.c.qty, 0).label('qty')
        ).outerjoin(stok, stok.c.product_id == Product.id).filter(
            Product.is_active == True,
            func.coalesce(Product.min_stock_level, 0) > 0
        ).all()

        low_stock_products = sum(1 for _, minimum, qty in ambang if 0 < float(qty) <= float(minimum))
        out_of_stock_products = sum(1 for _, _minimum, qty in ambang if float(qty) <= 0)

        # Nilai persediaan produk jadi: stok x harga pokok.
        total_value = db.session.query(
            func.coalesce(func.sum(Inventory.quantity_on_hand * func.coalesce(Product.cost, 0)), 0)
        ).join(Product, Product.id == Inventory.product_id).filter(
            Inventory.is_active == True
        ).scalar() or 0

        avg_price = db.session.query(func.avg(Product.price)).filter(
            Product.is_active == True
        ).scalar() or 0

        kpis = {
            'total_products': total_products,
            'active_products': active_products,
            'inactive_products': inactive_products,
            'total_categories': total_categories,
            'low_stock_products': low_stock_products,
            'out_of_stock_products': out_of_stock_products,
            # Berapa produk yang punya ambang minimum - supaya layar bisa
            # jujur bilang "belum diisi" ketika angkanya 0 karena tidak ada
            # ambang, bukan karena stok aman.
            'products_with_threshold': len(ambang),
            'total_value': float(total_value),
            'avg_price': float(avg_price)
        }

        return jsonify({'kpis': kpis}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/dashboard/top-products', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_top_products():
    """Produk paling laku 12 bulan terakhir, dari baris pesanan penjualan.

    Pesanan draft dan batal tidak dihitung - sama seperti laporan omzet.
    """
    try:
        from models.sales import SalesOrderItem
        from datetime import timedelta

        sejak = get_local_now() - timedelta(days=365)

        baris = db.session.query(
            Product.name.label('nama'),
            Product.cost.label('cost'),
            func.coalesce(func.sum(SalesOrderItem.quantity), 0).label('qty'),
            func.coalesce(func.sum(SalesOrderItem.total_price), 0).label('nilai')
        ).join(SalesOrder, SalesOrder.id == SalesOrderItem.order_id
        ).join(Product, Product.id == SalesOrderItem.product_id
        ).filter(
            SalesOrder.order_date >= sejak,
            func.lower(func.coalesce(SalesOrder.status, '')).notin_(['draft', 'cancelled', 'canceled'])
        ).group_by(Product.id, Product.name, Product.cost
        ).order_by(func.sum(SalesOrderItem.total_price).desc()).limit(10).all()

        products = []
        for nama, cost, qty, nilai in baris:
            nilai = float(nilai or 0)
            qty = float(qty or 0)
            # Margin hanya dihitung kalau harga pokoknya memang ada.
            hpp = float(cost or 0) * qty
            margin = round((nilai - hpp) / nilai * 100, 1) if nilai > 0 and hpp > 0 else None
            products.append({
                'product_name': nama,
                'sales_qty': qty,
                'sales_value': nilai,
                'profit_margin': margin
            })

        return jsonify({'products': products}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/dashboard/categories', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_dashboard_categories():
    """Sebaran produk per kategori, berikut nilai persediaannya."""
    try:
        stok = db.session.query(
            Inventory.product_id.label('product_id'),
            func.coalesce(func.sum(Inventory.quantity_on_hand), 0).label('qty')
        ).filter(
            Inventory.product_id.isnot(None),
            Inventory.is_active == True
        ).group_by(Inventory.product_id).subquery()

        baris = db.session.query(
            ProductCategory.name,
            func.count(Product.id).label('jumlah'),
            func.coalesce(func.sum(func.coalesce(stok.c.qty, 0) * func.coalesce(Product.cost, 0)), 0).label('nilai')
        ).outerjoin(Product, Product.category_id == ProductCategory.id
        ).outerjoin(stok, stok.c.product_id == Product.id
        ).group_by(ProductCategory.id, ProductCategory.name
        ).order_by(func.count(Product.id).desc()).all()

        categories = [{
            'category': nama or 'Tanpa kategori',
            'product_count': int(jumlah or 0),
            'total_value': float(nilai or 0)
        } for nama, jumlah, nilai in baris]

        return jsonify({'categories': categories}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/dashboard/stock-alerts', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_stock_alerts():
    """Produk yang stoknya di bawah ambang minimumnya sendiri."""
    try:
        stok = db.session.query(
            Inventory.product_id.label('product_id'),
            func.coalesce(func.sum(Inventory.quantity_on_hand), 0).label('qty'),
            func.max(Inventory.updated_at).label('terakhir')
        ).filter(
            Inventory.product_id.isnot(None),
            Inventory.is_active == True
        ).group_by(Inventory.product_id).subquery()

        baris = db.session.query(
            Product.id, Product.name, Product.min_stock_level,
            func.coalesce(stok.c.qty, 0).label('qty'),
            stok.c.terakhir
        ).outerjoin(stok, stok.c.product_id == Product.id).filter(
            Product.is_active == True,
            func.coalesce(Product.min_stock_level, 0) > 0,
            func.coalesce(stok.c.qty, 0) <= Product.min_stock_level
        ).order_by(func.coalesce(stok.c.qty, 0).asc()).limit(20).all()

        alerts = [{
            'id': pid,
            'product_name': nama,
            'current_stock': float(qty or 0),
            'min_stock': float(minimum or 0),
            'status': 'out_of_stock' if float(qty or 0) <= 0 else 'low_stock',
            'last_updated': terakhir.isoformat() if terakhir else None
        } for pid, nama, minimum, qty, terakhir in baris]

        return jsonify({'alerts': alerts}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/dashboard/trends', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_dashboard_trends():
    """Pergerakan 12 bulan: produk baru didaftarkan dan volume penjualannya.

    'Produk dihentikan' tidak dilaporkan karena tanggal penonaktifan tidak
    disimpan - menebaknya dari updated_at akan salah.
    """
    try:
        from models.sales import SalesOrderItem
        from datetime import timedelta

        sejak = (get_local_now() - timedelta(days=365)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # extract() jalan di Postgres maupun SQLite (harness tes); to_char
        # hanya ada di Postgres dan bikin endpoint ini 500 di tes.
        th_produk = func.extract('year', Product.created_at)
        bl_produk = func.extract('month', Product.created_at)
        bulan_baru = {f'{int(th):04d}-{int(bl):02d}': n for th, bl, n in db.session.query(
            th_produk, bl_produk, func.count(Product.id)
        ).filter(Product.created_at >= sejak).group_by(th_produk, bl_produk).all()}

        th_jual = func.extract('year', SalesOrder.order_date)
        bl_jual = func.extract('month', SalesOrder.order_date)
        bulan_jual = {f'{int(th):04d}-{int(bl):02d}': q for th, bl, q in db.session.query(
            th_jual, bl_jual, func.coalesce(func.sum(SalesOrderItem.quantity), 0)
        ).join(SalesOrderItem, SalesOrderItem.order_id == SalesOrder.id
        ).filter(
            SalesOrder.order_date >= sejak,
            func.lower(func.coalesce(SalesOrder.status, '')).notin_(['draft', 'cancelled', 'canceled'])
        ).group_by(th_jual, bl_jual).all()}

        # Bulan kosong tetap ditampilkan supaya garis waktunya tidak melompat.
        kunci = []
        th, bl = sejak.year, sejak.month
        for _ in range(13):
            kunci.append(f'{th:04d}-{bl:02d}')
            bl += 1
            if bl > 12:
                bl, th = 1, th + 1

        trends = [{
            'month': k,
            'new_products': int(bulan_baru.get(k, 0)),
            'sales_volume': float(bulan_jual.get(k, 0))
        } for k in kunci]

        return jsonify({'trends': trends}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===============================
# LIFECYCLE ENDPOINTS
# ===============================

def _tahap_daur_hidup(jumlah_spk, diproduksi, hari_sejak_spk_pertama, ada_kegiatan_baru):
    """Tahap daur hidup produk, ditebak dari kegiatan produksinya.

    Ini aturan ambang, bukan data yang disimpan: ERP belum mencatat riwayat
    tahap per produk. Dipakai sama persis di semua endpoint daur hidup supaya
    satu produk tidak muncul di dua tahap berbeda antar layar.
    """
    if jumlah_spk > 0 and not ada_kegiatan_baru and hari_sejak_spk_pertama > 180:
        return 'decline'
    if jumlah_spk >= 10 and diproduksi > 50000:
        return 'maturity'
    if jumlah_spk >= 5 or diproduksi > 10000:
        return 'growth'
    return 'introduction'


def _kumpulkan_daur_hidup(start_date):
    """Angka produksi per produk untuk satu rentang, sekali jalan.

    Sebelum 2026-11-22 setiap endpoint daur hidup menyusuri produk satu per
    satu dan menembak 3-4 query per produk; halaman Daur Hidup Produk bahkan
    tidak pernah selesai memuat (axios menyerah di detik ke-10) sehingga
    layarnya kosong padahal datanya ada.
    """
    from models.production import WorkOrder
    from datetime import timedelta
    from sqlalchemy import func

    sekarang = get_local_now()
    panjang = sekarang - start_date
    sebelumnya = start_date - panjang

    agregat = db.session.query(
        WorkOrder.product_id,
        func.count(WorkOrder.id),
        func.coalesce(func.sum(WorkOrder.quantity_produced), 0),
        func.coalesce(func.sum(WorkOrder.quantity), 0)
    ).filter(
        WorkOrder.created_at >= start_date,
        WorkOrder.product_id.isnot(None)
    ).group_by(WorkOrder.product_id).all()

    data = {pid: {
        'jumlah_spk': int(n or 0),
        'diproduksi': float(produced or 0),
        'direncanakan': float(planned or 0),
    } for pid, n, produced, planned in agregat}

    if not data:
        return {}

    ids = list(data)

    pertama = dict(db.session.query(
        WorkOrder.product_id, func.min(WorkOrder.created_at)
    ).filter(WorkOrder.product_id.in_(ids)).group_by(WorkOrder.product_id).all())

    baru = dict(db.session.query(
        WorkOrder.product_id, func.count(WorkOrder.id)
    ).filter(
        WorkOrder.product_id.in_(ids),
        WorkOrder.created_at >= sekarang - timedelta(days=60)
    ).group_by(WorkOrder.product_id).all())

    lalu = dict(db.session.query(
        WorkOrder.product_id, func.coalesce(func.sum(WorkOrder.quantity_produced), 0)
    ).filter(
        WorkOrder.product_id.in_(ids),
        WorkOrder.created_at >= sebelumnya,
        WorkOrder.created_at < start_date
    ).group_by(WorkOrder.product_id).all())

    for pid, d in data.items():
        spk_pertama = pertama.get(pid)
        d['spk_pertama'] = spk_pertama
        d['umur_hari'] = (sekarang - spk_pertama).days if spk_pertama else 0
        d['kegiatan_baru'] = int(baru.get(pid, 0)) > 0
        d['diproduksi_lalu'] = float(lalu.get(pid, 0) or 0)
        d['tahap'] = _tahap_daur_hidup(d['jumlah_spk'], d['diproduksi'], d['umur_hari'], d['kegiatan_baru'])

    return data


@products_bp.route('/lifecycle/products', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_lifecycle_products():
    """Daftar produk berikut tahap daur hidupnya, dari kegiatan produksi nyata.

    Dibersihkan 2026-11-22: total_revenue dulu diisi qty produksi x harga
    karangan Rp15.000/unit, growth_rate dipatok per tahap (15/8/-5/25%), dan
    roi/profit_margin sebenarnya cuma persentase penyelesaian SPK yang diberi
    nama lain. Sekarang pendapatan diambil dari faktur penjualan nyata dan
    pertumbuhan dibandingkan dengan periode sebelumnya yang sama panjang;
    kalau tidak ada pembandingnya, nilainya null - bukan angka tebakan.
    """
    try:
        from models.finance import Invoice, InvoiceItem
        from datetime import timedelta
        from sqlalchemy import func

        period = request.args.get('period', '6months')
        hari = {'3months': 90, '6months': 180, '1year': 365}.get(period, 730)
        start_date = get_local_now() - timedelta(days=hari)

        data = _kumpulkan_daur_hidup(start_date)
        if not data:
            return jsonify({'products': []}), 200

        ids = list(data)
        total_produksi = sum(d['diproduksi'] for d in data.values()) or 1

        omzet = dict(db.session.query(
            InvoiceItem.product_id, func.coalesce(func.sum(InvoiceItem.total_amount), 0)
        ).join(Invoice, InvoiceItem.invoice_id == Invoice.id).filter(
            InvoiceItem.product_id.in_(ids),
            Invoice.invoice_type == 'sales',
            Invoice.status.notin_(['draft', 'cancelled']),
            Invoice.invoice_date >= start_date.date()
        ).group_by(InvoiceItem.product_id).all())

        hasil = []
        for product in Product.query.filter(Product.id.in_(ids)).all():
            d = data[product.id]
            lalu = d['diproduksi_lalu']
            hasil.append({
                'product_id': product.id,
                'product_name': product.name,
                'product_code': product.code,
                'category': product.spunlace or 'Tanpa kategori',
                'launch_date': d['spk_pertama'].isoformat() if d['spk_pertama'] else None,
                'current_stage': d['tahap'],
                'stage_duration': d['umur_hari'],
                'total_produced': int(d['diproduksi']),
                'total_planned': int(d['direncanakan']),
                'completion_rate': round(d['diproduksi'] / d['direncanakan'] * 100, 1) if d['direncanakan'] > 0 else None,
                'total_revenue': float(omzet.get(product.id, 0) or 0),
                # Pangsa dihitung terhadap seluruh produksi pada rentang ini.
                'production_share': round(d['diproduksi'] / total_produksi * 100, 2),
                'growth_rate': round((d['diproduksi'] - lalu) / lalu * 100, 1) if lalu > 0 else None,
                'work_order_count': d['jumlah_spk'],
                'recent_activity': d['kegiatan_baru'],
            })

        hasil.sort(key=lambda x: x['total_produced'], reverse=True)
        return jsonify({'products': hasil}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@products_bp.route('/lifecycle/stage-metrics', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_lifecycle_stage_metrics():
    """Ringkasan per tahap daur hidup.

    Dibersihkan 2026-11-22: avg_duration dulu selalu 120 hari dan success_rate
    selalu 85%/60% - dua angka karangan. Sekarang lama tahap adalah rata-rata
    umur sejak SPK pertama, dan yang dulu disebut "success rate" diganti
    rata-rata penyelesaian SPK yang memang bisa dihitung.
    """
    try:
        from datetime import timedelta

        period = request.args.get('period', '6months')
        hari = {'3months': 90, '6months': 180, '1year': 365}.get(period, 730)
        start_date = get_local_now() - timedelta(days=hari)

        data = _kumpulkan_daur_hidup(start_date)

        nama = {'introduction': 'Introduction', 'growth': 'Growth', 'maturity': 'Maturity', 'decline': 'Decline'}
        ringkas = {k: {'count': 0, 'produced': 0.0, 'planned': 0.0, 'umur': []} for k in nama}

        for d in data.values():
            r = ringkas[d['tahap']]
            r['count'] += 1
            r['produced'] += d['diproduksi']
            r['planned'] += d['direncanakan']
            r['umur'].append(d['umur_hari'])

        metrics = [{
            'stage': nama[k],
            'product_count': r['count'],
            'total_produced': int(r['produced']),
            'avg_duration': int(sum(r['umur']) / len(r['umur'])) if r['umur'] else 0,
            'avg_completion': round(r['produced'] / r['planned'] * 100, 1) if r['planned'] > 0 else None,
        } for k, r in ringkas.items()]

        return jsonify({'metrics': metrics}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@products_bp.route('/lifecycle/timeline', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_lifecycle_timeline():
    """Kegiatan produksi per bulan: berapa produk yang jalan dan berapa yang baru.

    Dibersihkan 2026-11-22: isi endpoint ini dulu angka karangan murni
    (introduction = 2 + i, growth = 5 + i, dan seterusnya) - grafiknya
    menggambar pola yang tidak pernah terjadi. ERP belum menyimpan riwayat
    tahap per bulan, jadi yang dilaporkan sekarang hal yang memang tercatat:
    jumlah produk yang berproduksi tiap bulan, berapa di antaranya baru
    pertama kali, dan total kuantitas produksinya.
    """
    try:
        from models.production import WorkOrder
        from datetime import timedelta
        from sqlalchemy import func

        period = request.args.get('period', '6months')
        hari = {'3months': 90, '6months': 180, '1year': 365}.get(period, 730)
        start_date = (get_local_now() - timedelta(days=hari)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        th = func.extract('year', WorkOrder.created_at)
        bl = func.extract('month', WorkOrder.created_at)
        baris = db.session.query(
            th, bl,
            func.count(func.distinct(WorkOrder.product_id)),
            func.coalesce(func.sum(WorkOrder.quantity_produced), 0),
            func.count(WorkOrder.id)
        ).filter(
            WorkOrder.created_at >= start_date,
            WorkOrder.product_id.isnot(None)
        ).group_by(th, bl).all()
        per_bulan = {f'{int(y):04d}-{int(m):02d}': (int(n or 0), float(q or 0), int(spk or 0))
                     for y, m, n, q, spk in baris}

        # Produk yang SPK pertamanya jatuh di bulan itu.
        pertama = db.session.query(
            WorkOrder.product_id, func.min(WorkOrder.created_at)
        ).filter(WorkOrder.product_id.isnot(None)).group_by(WorkOrder.product_id).all()
        baru_per_bulan = {}
        for _pid, tanggal in pertama:
            if tanggal and tanggal >= start_date:
                k = tanggal.strftime('%Y-%m')
                baru_per_bulan[k] = baru_per_bulan.get(k, 0) + 1

        kunci = []
        th, bl = start_date.year, start_date.month
        while (th, bl) <= (get_local_now().year, get_local_now().month):
            kunci.append(f'{th:04d}-{bl:02d}')
            bl += 1
            if bl > 12:
                bl, th = 1, th + 1

        timeline = []
        for k in kunci:
            produk_aktif, produksi, jumlah_spk = per_bulan.get(k, (0, 0.0, 0))
            timeline.append({
                'date': k,
                'active_products': produk_aktif,
                'new_products': baru_per_bulan.get(k, 0),
                'work_orders': jumlah_spk,
                'produced': produksi,
            })

        return jsonify({'timeline': timeline}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@products_bp.route('/lifecycle/transitions', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_lifecycle_transitions():
    """Get recent lifecycle transitions"""
    try:
        # Return empty transitions for now
        transitions = []
        
        return jsonify({'transitions': transitions}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===============================
# ANALYTICS ENDPOINTS
# ===============================

@products_bp.route('/analytics/performance', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_analytics_performance():
    """Kinerja produk: produksi, penjualan nyata, dan perputaran stok.

    Bug diperbaiki 2026-10-07: respons endpoint ini membuat halaman Product
    Analytics blank karena field yang dibaca frontend (sales_value,
    profit_margin, growth_rate, stock_turnover, last_sale_date) tidak pernah
    dikirim. Field itu sekarang ada, dihitung dari Invoice penjualan nyata.
    profit_margin sengaja 0 - skema ini belum punya harga pokok per unit yang
    bisa dipercaya, dan menebaknya lebih buruk daripada mengaku belum ada.

    Bug diperbaiki 2026-11-22: versi sebelumnya menyusuri 700+ produk satu per
    satu dan menembak 2-5 query per produk ke database yang ada di server lain
    - halamannya tidak pernah selesai memuat. Sekarang semuanya dihitung dengan
    agregat berkelompok, jumlah query tetap walau produknya bertambah.
    """
    try:
        from models.production import WorkOrder, ShiftProduction
        from models.finance import Invoice, InvoiceItem
        from datetime import timedelta
        from sqlalchemy import func

        period = request.args.get('period', '3months')
        category = request.args.get('category', 'all')

        end_date = get_local_now()
        days = {'1month': 30, '3months': 90, '6months': 180}.get(period, 365)
        start_date = end_date - timedelta(days=days)
        prev_period_start = start_date - timedelta(days=days)

        # Produksi per produk.
        wo_rows = db.session.query(
            WorkOrder.product_id,
            func.count(WorkOrder.id),
            func.coalesce(func.sum(WorkOrder.quantity_produced), 0),
            func.coalesce(func.sum(WorkOrder.quantity), 0)
        ).filter(WorkOrder.created_at >= start_date).group_by(WorkOrder.product_id).all()
        wo_map = {pid: (int(jml), float(produced or 0), float(planned or 0))
                  for pid, jml, produced, planned in wo_rows if pid}

        if not wo_map:
            return jsonify({'products': []}), 200

        ids = list(wo_map.keys())

        sp_rows = db.session.query(
            ShiftProduction.product_id,
            func.coalesce(func.sum(ShiftProduction.good_quantity), 0),
            func.coalesce(func.sum(ShiftProduction.reject_quantity), 0)
        ).filter(
            ShiftProduction.product_id.in_(ids),
            ShiftProduction.production_date >= start_date.date()
        ).group_by(ShiftProduction.product_id).all()
        sp_map = {pid: (float(good or 0), float(reject or 0)) for pid, good, reject in sp_rows}

        def penjualan(sejak, sampai=None):
            q = db.session.query(
                InvoiceItem.product_id,
                func.coalesce(func.sum(InvoiceItem.quantity), 0),
                func.coalesce(func.sum(InvoiceItem.total_amount), 0),
                func.max(Invoice.invoice_date)
            ).join(Invoice, InvoiceItem.invoice_id == Invoice.id).filter(
                InvoiceItem.product_id.in_(ids),
                Invoice.invoice_type == 'sales',
                Invoice.status.notin_(['draft', 'cancelled']),
                Invoice.invoice_date >= sejak
            )
            if sampai is not None:
                q = q.filter(Invoice.invoice_date < sampai)
            return {pid: (float(qty or 0), float(nilai or 0), terakhir)
                    for pid, qty, nilai, terakhir in q.group_by(InvoiceItem.product_id).all()}

        jual_kini = penjualan(start_date.date())
        jual_lalu = penjualan(prev_period_start.date(), start_date.date())

        stok_rows = db.session.query(
            Inventory.product_id,
            func.coalesce(func.sum(Inventory.quantity_on_hand), 0)
        ).filter(Inventory.product_id.in_(ids)).group_by(Inventory.product_id).all()
        stok_map = {pid: float(qty or 0) for pid, qty in stok_rows}

        produk_q = Product.query.filter(Product.id.in_(ids))
        if category and category != 'all':
            produk_q = produk_q.filter(Product.spunlace == category)

        performance = []
        for product in produk_q.all():
            jml_wo, total_produced, total_planned = wo_map.get(product.id, (0, 0.0, 0.0))
            total_good, total_reject = sp_map.get(product.id, (0.0, 0.0))
            sales_qty, sales_value, last_sale = jual_kini.get(product.id, (0.0, 0.0, None))
            _, prev_value, _ = jual_lalu.get(product.id, (0.0, 0.0, None))
            current_stock = stok_map.get(product.id, 0.0)

            performance.append({
                'product_id': product.id,
                'product_name': product.name,
                'product_code': product.code,
                'category': product.spunlace or 'General',
                'total_produced': int(total_produced),
                'total_planned': int(total_planned),
                'total_good': int(total_good),
                'total_reject': int(total_reject),
                'quality_rate': round(total_good / total_produced * 100, 2) if total_produced > 0 else 0,
                'work_order_count': jml_wo,
                'completion_rate': round(total_produced / total_planned * 100, 2) if total_planned > 0 else 0,
                'sales_qty': sales_qty,
                'sales_value': sales_value,
                'profit_margin': 0,  # belum bisa dihitung - lihat docstring
                'growth_rate': round((sales_value - prev_value) / prev_value * 100, 2) if prev_value > 0 else 0,
                # Perputaran stok memakai stok saat ini, bukan rata-rata
                # periode: pendekatan nyata, tapi bukan rasio buku teks.
                'stock_turnover': round(sales_qty / current_stock, 2) if current_stock > 0 else 0,
                'last_sale_date': last_sale.isoformat() if last_sale else None,
            })

        performance.sort(key=lambda x: x['total_produced'], reverse=True)
        return jsonify({'products': performance[:20]}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@products_bp.route('/analytics/timeline', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_analytics_timeline():
    """Get production + real sales timeline.

    Bug fixed 2026-10-07 (found via a system-wide fabricated-data sweep,
    same class of bug as the Finance dashboard's hardcoded 0.76/0.36
    ratios): sales_value and profit used to be 'estimated' by multiplying
    PRODUCTION quantity by a flat invented price (Rp15,000/unit) and
    flat invented margin (Rp3,000/unit profit) - not derived from any
    real sales transaction at all, despite real sales data (Invoice/
    InvoiceItem, invoice_type='sales') already existing and being used
    elsewhere (routes/finance.py). sales_value now sums real
    InvoiceItem.total_amount per day. profit is NOT guessed at a fake
    ratio - there's no reliable per-unit standard cost in this schema
    yet (same reason /analytics/profitability below honestly returns
    empty instead of estimating) - left at 0, consistent with that
    endpoint's existing stance rather than inventing a second fake ratio.
    """
    try:
        from models.production import ShiftProduction
        from models.finance import Invoice, InvoiceItem
        from datetime import datetime, timedelta
        from sqlalchemy import func

        period = request.args.get('period', '3months')

        end_date = get_local_now()
        if period == '1month':
            start_date = end_date - timedelta(days=30)
        elif period == '3months':
            start_date = end_date - timedelta(days=90)
        elif period == '6months':
            start_date = end_date - timedelta(days=180)
        else:
            start_date = end_date - timedelta(days=365)

        # Get daily production aggregates
        daily_data = db.session.query(
            ShiftProduction.production_date,
            func.sum(ShiftProduction.actual_quantity).label('total_qty'),
            func.sum(ShiftProduction.good_quantity).label('good_qty'),
            func.sum(ShiftProduction.reject_quantity).label('reject_qty')
        ).filter(
            ShiftProduction.production_date >= start_date.date()
        ).group_by(
            ShiftProduction.production_date
        ).order_by(
            ShiftProduction.production_date
        ).all()

        # Real daily sales value from actual sales Invoices, keyed by date
        sales_rows = db.session.query(
            Invoice.invoice_date,
            func.sum(InvoiceItem.total_amount).label('total_sales')
        ).join(
            InvoiceItem, InvoiceItem.invoice_id == Invoice.id
        ).filter(
            Invoice.invoice_type == 'sales',
            Invoice.status.notin_(['draft', 'cancelled']),
            Invoice.invoice_date >= start_date.date()
        ).group_by(
            Invoice.invoice_date
        ).all()
        sales_by_date = {row.invoice_date: float(row.total_sales or 0) for row in sales_rows}

        # Kuantitas terjual - sebelumnya 'sales_qty' diisi kuantitas PRODUKSI,
        # jadi layar menyebut hasil pabrik sebagai penjualan (2026-11-22).
        qty_rows = db.session.query(
            Invoice.invoice_date,
            func.sum(InvoiceItem.quantity).label('qty')
        ).join(
            InvoiceItem, InvoiceItem.invoice_id == Invoice.id
        ).filter(
            Invoice.invoice_type == 'sales',
            Invoice.status.notin_(['draft', 'cancelled']),
            Invoice.invoice_date >= start_date.date()
        ).group_by(Invoice.invoice_date).all()
        qty_by_date = {row.invoice_date: float(row.qty or 0) for row in qty_rows}

        tanggal = sorted(set([r.production_date for r in daily_data if r.production_date])
                         | set(sales_by_date) | set(qty_by_date))
        produksi_by_date = {r.production_date: int(r.total_qty or 0) for r in daily_data}

        timeline = []
        for d in tanggal:
            timeline.append({
                'date': d.isoformat(),
                'production_qty': produksi_by_date.get(d, 0),
                'sales_qty': qty_by_date.get(d, 0),
                'sales_value': sales_by_date.get(d, 0),
                'profit': 0  # belum bisa dihitung - lihat docstring
            })

        return jsonify({'timeline': timeline}), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@products_bp.route('/analytics/categories', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_analytics_categories():
    """Kinerja per kategori produk (kolom spunlace).

    Bug diperbaiki 2026-10-07: total_sales dulu ditebak dari qty produksi x
    harga karangan Rp15.000/unit dan avg_margin dipatok 22,5% untuk semua
    kategori. Sekarang penjualan dijumlahkan dari Invoice nyata; avg_margin
    tetap 0 karena harga pokok per unit belum ada di skema ini.

    Bug diperbaiki 2026-11-22: kategori kosong jadi beberapa baris
    "Uncategorized" sekaligus (null, string kosong, dan spasi dihitung
    terpisah), dan produksi/penjualannya selalu 0 karena perbandingan
    `spunlace == None` tidak pernah cocok di SQL. Sekarang semuanya
    dinormalkan jadi satu kelompok "Tanpa kategori", dan angkanya dihitung
    sekaligus - bukan dua query per kategori.
    """
    try:
        from models.production import WorkOrder
        from models.finance import Invoice, InvoiceItem
        from datetime import timedelta
        from sqlalchemy import func

        period = request.args.get('period', '3months')
        hari = {'1month': 30, '3months': 90, '6months': 180}.get(period, 180)
        start_date = get_local_now() - timedelta(days=hari)

        kategori = func.coalesce(func.nullif(func.trim(Product.spunlace), ''), 'Tanpa kategori')

        jumlah = dict(db.session.query(kategori, func.count(Product.id)).filter(
            Product.is_active == True
        ).group_by(kategori).all())

        produksi = dict(db.session.query(
            kategori, func.coalesce(func.sum(WorkOrder.quantity_produced), 0)
        ).join(Product, WorkOrder.product_id == Product.id
        ).filter(WorkOrder.created_at >= start_date).group_by(kategori).all())

        penjualan = dict(db.session.query(
            kategori, func.coalesce(func.sum(InvoiceItem.total_amount), 0)
        ).join(InvoiceItem, InvoiceItem.product_id == Product.id
        ).join(Invoice, InvoiceItem.invoice_id == Invoice.id
        ).filter(
            Invoice.invoice_type == 'sales',
            Invoice.status.notin_(['draft', 'cancelled']),
            Invoice.invoice_date >= start_date.date()
        ).group_by(kategori).all())

        categories = [{
            'category': nama,
            'total_products': int(n or 0),
            'total_produced': int(produksi.get(nama, 0) or 0),
            'total_sales': float(penjualan.get(nama, 0) or 0),
            'avg_margin': 0,  # belum bisa dihitung - lihat docstring
            'growth_rate': 0  # butuh data historis
        } for nama, n in jumlah.items()]

        categories.sort(key=lambda c: (c['total_sales'], c['total_produced'], c['total_products']), reverse=True)

        return jsonify({'categories': categories}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@products_bp.route('/analytics/profitability', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_analytics_profitability():
    """Get profitability analytics"""
    try:
        period = request.args.get('period', '3months')
        
        # Return empty profitability data - to be implemented when cost tracking is available
        profitability = []
        
        return jsonify({'profitability': profitability}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/analytics/seasonality', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_analytics_seasonality():
    """Get seasonality analytics"""
    try:
        # Return empty seasonality data - to be implemented when seasonal analysis is needed
        seasonality = []
        
        return jsonify({'seasonality': seasonality}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===============================
# BOM ENDPOINTS
# ===============================

@products_bp.route('/bom', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_product_bom():
    """Get Bill of Materials for products"""
    try:
        # Return empty BOM list - to be implemented when BOM management is needed
        bom_list = []
        
        return jsonify({'bom_list': bom_list}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@products_bp.route('/materials', methods=['GET'])
@jwt_required()
@require_permission('products.view')
def get_product_materials():
    """Get materials for BOM management"""
    try:
        # Return empty materials - to be implemented when material management is integrated
        materials = []
        
        return jsonify({'materials': materials}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
