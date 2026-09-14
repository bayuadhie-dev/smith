from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db, Material, Inventory, InventoryMovement
from datetime import datetime
from utils.timezone import get_local_now, get_local_today
from utils.master_data_usage import get_usage

materials_crud_bp = Blueprint('materials_crud', __name__)

@materials_crud_bp.route('/<int:material_id>/usage', methods=['GET'])
@jwt_required()
@require_permission('materials.view')
def get_material_usage(material_id):
    """Where-used report: which tables across the whole schema reference this material,
    discovered dynamically via FK introspection (not a hardcoded per-module list)."""
    material = db.session.get(Material, material_id) or abort(404)
    return jsonify({'usage': get_usage('materials', material_id)}), 200

@materials_crud_bp.route('/<int:material_id>', methods=['GET'])
@jwt_required()
@require_permission('materials.view')
def get_material(material_id):
    """Get single material by ID for viewing"""
    try:
        material = db.session.get(Material, material_id) or abort(404)
        
        return jsonify({
            'material': {
                'id': material.id,
                'code': material.code,
                'name': material.name,
                'description': material.description,
                'material_type': material.material_type,
                'category': material.category,
                'primary_uom': material.primary_uom,
                'secondary_uom': material.secondary_uom,
                'cost_per_unit': float(material.cost_per_unit) if material.cost_per_unit else 0,
                'min_stock_level': float(material.min_stock_level) if material.min_stock_level else 0,
                'max_stock_level': float(material.max_stock_level) if material.max_stock_level else 0,
                'reorder_point': float(material.reorder_point) if material.reorder_point else 0,
                'lead_time_days': material.lead_time_days,
                'is_active': material.is_active,
                'is_hazardous': material.is_hazardous,
                'storage_conditions': material.storage_conditions,
                'expiry_days': material.expiry_days,
                'safety_stock_qty': float(material.safety_stock_qty) if material.safety_stock_qty is not None else None,
                'safety_stock_days': material.safety_stock_days,
                'min_order_qty': float(material.min_order_qty) if material.min_order_qty is not None else None,
                'is_excluded_from_mrp': material.is_excluded_from_mrp,
                'supplier_id': material.supplier_id,
                'supplier': material.supplier.name if material.supplier else None,
                'kelompok': material.kelompok,
                'ppn_code': material.ppn_code,
                'erp_approval': material.erp_approval,
                'akun_persediaan_id': material.akun_persediaan_id,
                'akun_penjualan_id': material.akun_penjualan_id,
                'akun_retur_penjualan_id': material.akun_retur_penjualan_id,
                'akun_diskon_penjualan_id': material.akun_diskon_penjualan_id,
                'akun_barang_terkirim_id': material.akun_barang_terkirim_id,
                'akun_hpp_id': material.akun_hpp_id,
                'akun_retur_pembelian_id': material.akun_retur_pembelian_id,
                'akun_beban_id': material.akun_beban_id,
                'akun_pembelian_belum_tertagih_id': material.akun_pembelian_belum_tertagih_id,
                'created_at': material.created_at.isoformat() if material.created_at else None,
                'updated_at': material.updated_at.isoformat() if material.updated_at else None
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@materials_crud_bp.route('/<int:material_id>', methods=['PUT'])
@jwt_required()
@require_permission('materials.edit')
def update_material(material_id):
    """Update material"""
    try:
        material = db.session.get(Material, material_id) or abort(404)
        data = request.get_json()
        
        # Update fields - allow full editing including code
        if 'code' in data and data['code'] != material.code:
            # Check if new code is unique
            existing = Material.query.filter(
                Material.code == data['code'],
                Material.id != material_id
            ).first()
            if existing:
                return jsonify({'error': 'Material code already exists'}), 400
            material.code = data['code']
        
        if 'name' in data:
            material.name = data['name']
        if 'description' in data:
            material.description = data['description']
        if 'material_type' in data:
            material.material_type = data['material_type']
        if 'category' in data:
            material.category = data['category']
        if 'primary_uom' in data:
            material.primary_uom = data['primary_uom']
        if 'secondary_uom' in data:
            material.secondary_uom = data['secondary_uom']
        if 'cost_per_unit' in data:
            material.cost_per_unit = data['cost_per_unit']
        if 'min_stock_level' in data:
            material.min_stock_level = data['min_stock_level']
        if 'max_stock_level' in data:
            material.max_stock_level = data['max_stock_level']
        if 'reorder_point' in data:
            material.reorder_point = data['reorder_point']
        if 'lead_time_days' in data:
            material.lead_time_days = data['lead_time_days']
        if 'is_active' in data:
            material.is_active = data['is_active']
        if 'is_hazardous' in data:
            material.is_hazardous = data['is_hazardous']
        if 'storage_conditions' in data:
            material.storage_conditions = data['storage_conditions']
        if 'expiry_days' in data:
            material.expiry_days = data['expiry_days']
        if 'safety_stock_qty' in data:
            material.safety_stock_qty = data['safety_stock_qty'] if data['safety_stock_qty'] not in ('', None) else None
        if 'safety_stock_days' in data:
            material.safety_stock_days = data['safety_stock_days'] if data['safety_stock_days'] not in ('', None) else None
        if 'min_order_qty' in data:
            material.min_order_qty = data['min_order_qty'] if data['min_order_qty'] not in ('', None) else None
        if 'is_excluded_from_mrp' in data:
            material.is_excluded_from_mrp = bool(data['is_excluded_from_mrp'])
        if 'supplier_id' in data:
            material.supplier_id = data['supplier_id']
        if 'kelompok' in data:
            material.kelompok = data['kelompok']
        if 'ppn_code' in data:
            material.ppn_code = data['ppn_code']
        if 'erp_approval' in data:
            material.erp_approval = data['erp_approval']
        for akun_field in ('akun_persediaan_id', 'akun_penjualan_id', 'akun_retur_penjualan_id',
                           'akun_diskon_penjualan_id', 'akun_barang_terkirim_id', 'akun_hpp_id',
                           'akun_retur_pembelian_id', 'akun_beban_id', 'akun_pembelian_belum_tertagih_id'):
            if akun_field in data:
                setattr(material, akun_field, data[akun_field])

        material.updated_at = get_local_now()
        db.session.commit()
        
        return jsonify({
            'message': 'Material updated successfully',
            'material_id': material.id
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@materials_crud_bp.route('/<int:material_id>', methods=['DELETE'])
@jwt_required()
@require_permission('materials.delete')
def delete_material(material_id):
    """Delete material with safety checks"""
    try:
        material = db.session.get(Material, material_id) or abort(404)
        
        # Check if material is used in inventory
        inventory_count = db.session.query(Inventory).filter_by(material_id=material_id).count()
        if inventory_count > 0:
            return jsonify({
                'error': 'Cannot delete material. It has inventory records.',
                'inventory_count': inventory_count,
                'can_delete': False
            }), 400
        
        # Check BOM usage
        try:
            from models.production import BOMItem
            bom_count = db.session.query(BOMItem).filter_by(material_id=material_id).count()
            if bom_count > 0:
                return jsonify({
                    'error': 'Cannot delete material. It is used in BOMs.',
                    'bom_count': bom_count,
                    'can_delete': False
                }), 400
        except (ImportError, Exception) as e:
            # If BOMItem doesn't exist or has issues, log but continue
            print(f"Warning: Could not check BOM usage: {str(e)}")
            pass
        
        # Check purchase order usage
        try:
            from models.purchasing import PurchaseOrder
            # Check if material is referenced in purchase orders
            po_count = db.session.query(PurchaseOrder).filter(
                PurchaseOrder.material_id == material_id
            ).count()
            if po_count > 0:
                return jsonify({
                    'error': 'Cannot delete material. It is used in purchase orders.',
                    'po_count': po_count,
                    'can_delete': False
                }), 400
        except (ImportError, Exception) as e:
            # If PurchaseOrder doesn't have material_id field, skip check
            print(f"Warning: Could not check PO usage: {str(e)}")
            pass
        
        # Safe to delete
        material_name = material.name
        material_code = material.code
        
        db.session.delete(material)
        db.session.commit()
        
        return jsonify({
            'message': f'Material {material_code} - {material_name} deleted successfully',
            'material_id': material_id,
            'can_delete': True
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@materials_crud_bp.route('/', methods=['POST'])
@jwt_required()
@require_permission('materials.create')
def create_material():
    """Create new material"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['code', 'name', 'material_type', 'category', 'primary_uom']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Field {field} is required'}), 400
        
        # Check if code already exists
        existing = Material.query.filter_by(code=data['code']).first()
        if existing:
            return jsonify({'error': 'Material code already exists'}), 400
        
        # Create new material
        material = Material(
            code=data['code'],
            name=data['name'],
            description=data.get('description', ''),
            material_type=data['material_type'],
            category=data['category'],
            primary_uom=data['primary_uom'],
            secondary_uom=data.get('secondary_uom'),
            cost_per_unit=data.get('cost_per_unit', 0),
            min_stock_level=data.get('min_stock_level', 0),
            max_stock_level=data.get('max_stock_level', 0),
            reorder_point=data.get('reorder_point', 0),
            lead_time_days=data.get('lead_time_days', 0),
            is_active=data.get('is_active', True),
            is_hazardous=data.get('is_hazardous', False),
            storage_conditions=data.get('storage_conditions'),
            expiry_days=data.get('expiry_days'),
            safety_stock_qty=data.get('safety_stock_qty') if data.get('safety_stock_qty') not in ('', None) else None,
            safety_stock_days=data.get('safety_stock_days') if data.get('safety_stock_days') not in ('', None) else None,
            is_excluded_from_mrp=bool(data.get('is_excluded_from_mrp', False)),
            supplier_id=data.get('supplier_id')
        )
        
        db.session.add(material)
        db.session.commit()
        
        return jsonify({
            'message': 'Material created successfully',
            'material_id': material.id
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
