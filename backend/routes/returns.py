from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db, CustomerReturn, ReturnItem, ReturnQCRecord, ReturnDisposition
from models import SalesOrder, Customer, Product, User, Inventory, WasteRecord
from utils.i18n import success_response, error_response, get_message
from utils import generate_number
from datetime import datetime, date
from utils.timezone import get_local_now, get_local_today

returns_bp = Blueprint('returns', __name__)

# ===============================
# CUSTOMER RETURNS MANAGEMENT
# ===============================

@returns_bp.route('/', methods=['GET'])
@jwt_required()
@require_permission('returns.view')
def get_returns():
    """Get all customer returns with filtering"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        status = request.args.get('status')
        qc_status = request.args.get('qc_status')
        
        query = CustomerReturn.query
        
        if status:
            query = query.filter(CustomerReturn.status == status)
        if qc_status:
            query = query.filter(CustomerReturn.qc_status == qc_status)
            
        returns = query.order_by(CustomerReturn.return_date.desc()).paginate(
            page=page, per_page=per_page
        )
        
        return jsonify({
            'returns': [{
                'id': r.id,
                'return_number': r.return_number,
                'customer_name': r.customer.company_name if r.customer else 'Unknown',
                'return_date': r.return_date.isoformat(),
                'reason': r.reason,
                'status': r.status,
                'qc_status': r.qc_status,
                'total_items': r.total_items,
                'total_value': float(r.total_value),
                'qc_required': r.qc_required
            } for r in returns.items],
            'total': returns.total,
            'pages': returns.pages,
            'current_page': returns.page
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@returns_bp.route('/', methods=['POST'])
@jwt_required()
@require_permission('returns.create')
def create_return():
    """Create new customer return"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # Generate return number
        return_number = generate_number('RTN', CustomerReturn, 'return_number')
        
        # Create return
        customer_return = CustomerReturn(
            return_number=return_number,
            sales_order_id=data.get('sales_order_id'),
            customer_id=data['customer_id'],
            return_date=datetime.strptime(data['return_date'], '%Y-%m-%d').date(),
            reason=data['reason'],
            description=data.get('description'),
            qc_required=data.get('qc_required', True),
            received_by=user_id
        )
        
        db.session.add(customer_return)
        db.session.flush()  # Get return ID
        
        # Add return items
        total_items = 0
        total_value = 0
        
        for item_data in data.get('items', []):
            return_item = ReturnItem(
                return_id=customer_return.id,
                sales_order_item_id=item_data.get('sales_order_item_id'),
                product_id=item_data['product_id'],
                quantity_returned=item_data['quantity_returned'],
                unit_price=item_data['unit_price'],
                total_value=item_data['quantity_returned'] * item_data['unit_price'],
                condition_received=item_data['condition_received'],
                defect_description=item_data.get('defect_description'),
                batch_number=item_data.get('batch_number')
            )
            
            db.session.add(return_item)
            total_items += item_data['quantity_returned']
            total_value += return_item.total_value
        
        # Update totals
        customer_return.total_items = total_items
        customer_return.total_value = total_value
        
        # Set initial status
        if customer_return.qc_required:
            customer_return.status = 'qc_pending'
            customer_return.qc_status = 'pending'
        else:
            customer_return.status = 'received'
        
        db.session.commit()
        
        return jsonify({
            'message': 'Return created successfully',
            'return_id': customer_return.id,
            'return_number': return_number
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@returns_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('returns.view')
def get_return(id):
    """Get return details"""
    try:
        customer_return = db.session.get(CustomerReturn, id) or abort(404)
        
        return jsonify({
            'id': customer_return.id,
            'return_number': customer_return.return_number,
            'sales_order_number': customer_return.sales_order.order_number if customer_return.sales_order else None,
            'customer': {
                'id': customer_return.customer.id,
                'name': customer_return.customer.company_name,
                'contact': customer_return.customer.phone
            },
            'return_date': customer_return.return_date.isoformat(),
            'reason': customer_return.reason,
            'description': customer_return.description,
            'status': customer_return.status,
            'qc_status': customer_return.qc_status,
            'qc_required': customer_return.qc_required,
            'qc_notes': customer_return.qc_notes,
            'total_items': customer_return.total_items,
            'total_value': float(customer_return.total_value),
            'items': [{
                'id': item.id,
                'product_name': item.product.name,
                'quantity_returned': item.quantity_returned,
                'unit_price': float(item.unit_price),
                'total_value': float(item.total_value),
                'condition_received': item.condition_received,
                'defect_description': item.defect_description,
                'qc_status': item.qc_status,
                'qc_quantity_approved': item.qc_quantity_approved,
                'qc_quantity_rejected': item.qc_quantity_rejected,
                'disposition': item.disposition,
                'batch_number': item.batch_number
            } for item in customer_return.items],
            'qc_records': [{
                'id': qc.id,
                'qc_date': qc.qc_date.isoformat(),
                'qc_by': qc.qc_by_user.username if qc.qc_by_user else None,
                'overall_result': qc.overall_result,
                'quantity_inspected': qc.quantity_inspected,
                'quantity_approved': qc.quantity_approved,
                'quantity_rejected': qc.quantity_rejected,
                'defects_found': qc.defects_found,
                'recommendation': qc.recommendation,
                'qc_notes': qc.qc_notes
            } for qc in customer_return.qc_records]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===============================
# QC INSPECTION FOR RETURNS
# ===============================

@returns_bp.route('/<int:return_id>/qc', methods=['POST'])
@jwt_required()
@require_permission('returns.create')
def create_qc_inspection():
    """Create QC inspection for return"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        return_id = request.view_args['return_id']
        
        customer_return = db.session.get(CustomerReturn, return_id) or abort(404)
        
        # Create QC record
        qc_record = ReturnQCRecord(
            return_id=return_id,
            return_item_id=data.get('return_item_id'),
            qc_by=user_id,
            visual_inspection=data['visual_inspection'],
            functional_test=data.get('functional_test'),
            dimensional_check=data.get('dimensional_check'),
            overall_result=data['overall_result'],
            quantity_inspected=data['quantity_inspected'],
            quantity_approved=data.get('quantity_approved', 0),
            quantity_rejected=data.get('quantity_rejected', 0),
            defects_found=data.get('defects_found'),
            qc_notes=data.get('qc_notes'),
            recommendation=data.get('recommendation')
        )
        
        db.session.add(qc_record)
        
        # Update return status
        customer_return.qc_status = qc_record.overall_result
        customer_return.qc_date = get_local_now()
        customer_return.qc_by = user_id
        customer_return.qc_notes = data.get('qc_notes')
        
        if qc_record.overall_result == 'approved':
            customer_return.status = 'qc_approved'
        elif qc_record.overall_result == 'rejected':
            customer_return.status = 'qc_rejected'
        
        # Update individual items if specified
        if data.get('return_item_id'):
            return_item = db.session.get(ReturnItem, data['return_item_id'])
            if return_item:
                return_item.qc_status = qc_record.overall_result
                return_item.qc_quantity_approved = qc_record.quantity_approved
                return_item.qc_quantity_rejected = qc_record.quantity_rejected
        
        db.session.commit()
        
        return jsonify({
            'message': 'QC inspection completed',
            'qc_record_id': qc_record.id,
            'overall_result': qc_record.overall_result
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ===============================
# RETURN DISPOSITION
# ===============================

@returns_bp.route('/<int:return_id>/disposition', methods=['POST'])
@jwt_required()
@require_permission('returns.create')
def create_disposition():
    """Create disposition for return items"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        return_id = request.view_args['return_id']
        
        customer_return = db.session.get(CustomerReturn, return_id) or abort(404)
        
        for disposition_data in data.get('dispositions', []):
            disposition = ReturnDisposition(
                return_id=return_id,
                return_item_id=disposition_data['return_item_id'],
                disposition_type=disposition_data['disposition_type'],
                quantity=disposition_data['quantity'],
                warehouse_location=disposition_data.get('warehouse_location'),
                waste_category=disposition_data.get('waste_category'),
                work_order_id=disposition_data.get('work_order_id'),
                processed_by=user_id,
                notes=disposition_data.get('notes')
            )
            
            db.session.add(disposition)
            
            # Update return item
            return_item = db.session.get(ReturnItem, disposition_data['return_item_id'])
            if return_item:
                return_item.disposition = disposition_data['disposition_type']
                return_item.warehouse_location = disposition_data.get('warehouse_location')
                return_item.waste_category = disposition_data.get('waste_category')
            
            # Process based on disposition type
            _process_disposition(disposition, return_item)
        
        # Update return status
        customer_return.status = 'processed'
        customer_return.processed_by = user_id
        customer_return.processed_date = get_local_now()
        
        db.session.commit()
        
        return jsonify(success_response('api.success')), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def _process_disposition(disposition, return_item):
    """Process disposition based on type.
    Rewritten - the previous version passed keyword args (product_id/location/
    quantity on Inventory; product_id/waste_type/source on WasteRecord) that
    don't exist on either model, so both branches would TypeError the instant
    they ran. Never caught because the bug was masked by the bare `except`
    below silently swallowing it."""
    from models.warehouse import WarehouseLocation
    from models.waste import WasteCategory

    # No bare except here (2026-09-11 fix) - a failure processing a
    # disposition (bad warehouse_location, DB error, etc) must surface to the
    # caller and roll back the whole return, not fail silently while the
    # return still gets marked 'processed' anyway. The endpoint that calls
    # this already wraps everything in its own try/except + rollback.
    if disposition.disposition_type == 'warehouse':
        location = WarehouseLocation.query.filter_by(location_code=disposition.warehouse_location).first()
        if not location:
            raise ValueError(f"Lokasi gudang '{disposition.warehouse_location}' tidak ditemukan")

        inventory = Inventory.query.filter_by(
            product_id=return_item.product_id,
            location_id=location.id
        ).first()

        if inventory:
            inventory.quantity_on_hand = float(inventory.quantity_on_hand or 0) + disposition.quantity
            inventory.quantity_available = float(inventory.quantity_available or 0) + disposition.quantity
        else:
            inventory = Inventory(
                product_id=return_item.product_id,
                location_id=location.id,
                quantity_on_hand=disposition.quantity,
                quantity_available=disposition.quantity,
                stock_status='quarantine',  # returned goods need QC release, not auto-available
            )
            db.session.add(inventory)

    elif disposition.disposition_type == 'waste':
        category_name = disposition.waste_category or 'Customer Return - Defective'
        category = WasteCategory.query.filter(
            db.or_(WasteCategory.code == category_name, WasteCategory.name == category_name)
        ).first()
        if not category:
            category = WasteCategory(
                code=category_name[:50], name=category_name, waste_type='general_waste',
            )
            db.session.add(category)
            db.session.flush()

        waste_record = WasteRecord(
            record_number=generate_number('WR', WasteRecord, 'record_number'),
            category_id=category.id,
            waste_date=get_local_today(),
            product_id=return_item.product_id,
            quantity=disposition.quantity,
            uom=return_item.product.primary_uom if return_item.product else 'PCS',
            reason=f"Dari retur {return_item.customer_return.return_number}",
            recorded_by=disposition.processed_by,
        )
        db.session.add(waste_record)

# ===============================
# RETURN ANALYTICS
# ===============================

@returns_bp.route('/analytics', methods=['GET'])
@jwt_required()
@require_permission('returns.view')
def get_return_analytics():
    """Get return analytics and metrics"""
    try:
        # Basic counts
        total_returns = CustomerReturn.query.count()
        pending_qc = CustomerReturn.query.filter_by(qc_status='pending').count()
        approved_returns = CustomerReturn.query.filter_by(qc_status='approved').count()
        rejected_returns = CustomerReturn.query.filter_by(qc_status='rejected').count()
        
        # Return reasons analysis
        reason_stats = db.session.query(
            CustomerReturn.reason,
            db.func.count(CustomerReturn.id).label('count')
        ).group_by(CustomerReturn.reason).all()
        
        # Monthly return trends (SQLite compatible)
        monthly_returns = db.session.query(
            db.func.strftime('%Y-%m', CustomerReturn.return_date).label('month'),
            db.func.count(CustomerReturn.id).label('count')
        ).group_by('month').order_by('month').limit(12).all()
        
        return jsonify({
            'summary': {
                'total_returns': total_returns,
                'pending_qc': pending_qc,
                'approved_returns': approved_returns,
                'rejected_returns': rejected_returns,
                'qc_approval_rate': (approved_returns / max(1, approved_returns + rejected_returns)) * 100
            },
            'return_reasons': [
                {'reason': r.reason, 'count': r.count}
                for r in reason_stats
            ],
            'monthly_trends': [
                {'month': r.month, 'count': r.count}
                for r in monthly_returns
            ]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
