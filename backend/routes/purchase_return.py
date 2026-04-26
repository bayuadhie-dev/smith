from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, PurchaseReturn, PurchaseReturnItem, PurchaseInvoice, PurchaseInvoiceItem, Supplier, User
from utils.i18n import success_response, error_response, get_message
from utils import generate_number
from datetime import datetime, date
from utils.timezone import get_local_now, get_local_today

purchase_return_bp = Blueprint('purchase_return', __name__)

# ===============================
# PURCHASE RETURN CRUD
# ===============================

@purchase_return_bp.route('/purchase-returns', methods=['GET'])
@jwt_required()
def get_purchase_returns():
    """
    Get all purchase returns with filtering
    ---
    tags:
      - Purchasing
    summary: Get all purchase returns
    description: Retrieve all purchase returns with optional filtering by status, approval status, supplier, invoice, and date range
    security:
      - BearerAuth: []
    parameters:
      - name: page
        in: query
        type: integer
        default: 1
        description: Page number
      - name: per_page
        in: query
        type: integer
        default: 50
        description: Items per page
      - name: status
        in: query
        type: string
        description: Filter by return status (draft, submitted, approved, rejected, completed)
      - name: approval_status
        in: query
        type: string
        description: Filter by approval status (pending, approved, rejected)
      - name: supplier_id
        in: query
        type: integer
        description: Filter by supplier ID
      - name: invoice_id
        in: query
        type: integer
        description: Filter by purchase invoice ID
      - name: date_from
        in: query
        type: string
        format: date
        description: Filter returns from this date (YYYY-MM-DD)
      - name: date_to
        in: query
        type: string
        format: date
        description: Filter returns until this date (YYYY-MM-DD)
    responses:
      200:
        description: Purchase returns retrieved successfully
        schema:
          type: object
          properties:
            returns:
              type: array
              items:
                type: object
            total:
              type: integer
            pages:
              type: integer
            current_page:
              type: integer
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        status = request.args.get('status')
        approval_status = request.args.get('approval_status')
        supplier_id = request.args.get('supplier_id', type=int)
        invoice_id = request.args.get('invoice_id', type=int)
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        query = PurchaseReturn.query
        
        if status:
            query = query.filter(PurchaseReturn.status == status)
        if approval_status:
            query = query.filter(PurchaseReturn.approval_status == approval_status)
        if supplier_id:
            query = query.filter(PurchaseReturn.supplier_id == supplier_id)
        if invoice_id:
            query = query.filter(PurchaseReturn.invoice_id == invoice_id)
        if date_from:
            query = query.filter(PurchaseReturn.return_date >= date_from)
        if date_to:
            query = query.filter(PurchaseReturn.return_date <= date_to)
            
        returns = query.order_by(PurchaseReturn.return_date.desc()).paginate(
            page=page, per_page=per_page
        )
        
        return jsonify({
            'returns': [{
                'id': ret.id,
                'return_number': ret.return_number,
                'invoice_id': ret.invoice_id,
                'invoice_number': ret.invoice.invoice_number if ret.invoice else None,
                'supplier_id': ret.supplier_id,
                'supplier_name': ret.supplier.company_name if ret.supplier else None,
                'return_date': ret.return_date.isoformat() if ret.return_date else None,
                'reason': ret.reason,
                'return_type': ret.return_type,
                'status': ret.status,
                'approval_status': ret.approval_status,
                'currency': ret.currency,
                'exchange_rate': float(ret.exchange_rate) if ret.exchange_rate else None,
                'subtotal': float(ret.subtotal) if ret.subtotal else 0,
                'tax_amount': float(ret.tax_amount) if ret.tax_amount else 0,
                'discount_amount': float(ret.discount_amount) if ret.discount_amount else 0,
                'total_amount': float(ret.total_amount) if ret.total_amount else 0,
                'credit_note_number': ret.credit_note_number,
                'credit_note_date': ret.credit_note_date.isoformat() if ret.credit_note_date else None,
                'notes': ret.notes,
                'internal_notes': ret.internal_notes,
                'created_by': ret.created_by,
                'created_by_name': ret.created_by_user.username if ret.created_by_user else None,
                'approved_by': ret.approved_by,
                'approved_by_name': ret.approved_by_user.username if ret.approved_by_user else None,
                'approved_at': ret.approved_at.isoformat() if ret.approved_at else None,
                'created_at': ret.created_at.isoformat() if ret.created_at else None,
                'updated_at': ret.updated_at.isoformat() if ret.updated_at else None,
            } for ret in returns.items],
            'total': returns.total,
            'pages': returns.pages,
            'current_page': returns.page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@purchase_return_bp.route('/purchase-returns/<int:id>', methods=['GET'])
@jwt_required()
def get_purchase_return(id):
    """
    Get purchase return detail by ID
    ---
    tags:
      - Purchasing
    summary: Get purchase return detail
    description: Retrieve detailed information about a specific purchase return including all line items
    security:
      - BearerAuth: []
    parameters:
      - name: id
        in: path
        type: integer
        required: true
        description: Purchase return ID
    responses:
      200:
        description: Purchase return detail retrieved successfully
        schema:
          type: object
          properties:
            id:
              type: integer
            return_number:
              type: string
            invoice_id:
              type: integer
            supplier_id:
              type: integer
            return_date:
              type: string
              format: date
            reason:
              type: string
            return_type:
              type: string
            status:
              type: string
            approval_status:
              type: string
            total_amount:
              type: number
            items:
              type: array
              items:
                type: object
      404:
        description: Purchase return not found
    """
    try:
        return_obj = db.session.get(PurchaseReturn, id) or abort(404)
        
        return jsonify({
            'id': return_obj.id,
            'return_number': return_obj.return_number,
            'invoice_id': return_obj.invoice_id,
            'invoice_number': return_obj.invoice.invoice_number if return_obj.invoice else None,
            'supplier_id': return_obj.supplier_id,
            'supplier_name': return_obj.supplier.company_name if return_obj.supplier else None,
            'return_date': return_obj.return_date.isoformat() if return_obj.return_date else None,
            'reason': return_obj.reason,
            'return_type': return_obj.return_type,
            'status': return_obj.status,
            'approval_status': return_obj.approval_status,
            'currency': return_obj.currency,
            'exchange_rate': float(return_obj.exchange_rate) if return_obj.exchange_rate else None,
            'subtotal': float(return_obj.subtotal) if return_obj.subtotal else 0,
            'tax_amount': float(return_obj.tax_amount) if return_obj.tax_amount else 0,
            'discount_amount': float(return_obj.discount_amount) if return_obj.discount_amount else 0,
            'total_amount': float(return_obj.total_amount) if return_obj.total_amount else 0,
            'credit_note_number': return_obj.credit_note_number,
            'credit_note_date': return_obj.credit_note_date.isoformat() if return_obj.credit_note_date else None,
            'notes': return_obj.notes,
            'internal_notes': return_obj.internal_notes,
            'created_by': return_obj.created_by,
            'created_by_name': return_obj.created_by_user.username if return_obj.created_by_user else None,
            'approved_by': return_obj.approved_by,
            'approved_by_name': return_obj.approved_by_user.username if return_obj.approved_by_user else None,
            'approved_at': return_obj.approved_at.isoformat() if return_obj.approved_at else None,
            'created_at': return_obj.created_at.isoformat() if return_obj.created_at else None,
            'updated_at': return_obj.updated_at.isoformat() if return_obj.updated_at else None,
            'items': [{
                'id': item.id,
                'line_number': item.line_number,
                'invoice_item_id': item.invoice_item_id,
                'product_id': item.product_id,
                'product_name': item.product.name if item.product else None,
                'material_id': item.material_id,
                'material_name': item.material.name if item.material else None,
                'description': item.description,
                'quantity': float(item.quantity) if item.quantity else 0,
                'uom': item.uom,
                'unit_price': float(item.unit_price) if item.unit_price else 0,
                'discount_percent': float(item.discount_percent) if item.discount_percent else 0,
                'discount_amount': float(item.discount_amount) if item.discount_amount else 0,
                'tax_percent': float(item.tax_percent) if item.tax_percent else 0,
                'tax_amount': float(item.tax_amount) if item.tax_amount else 0,
                'total_price': float(item.total_price) if item.total_price else 0,
                'reason': item.reason,
                'notes': item.notes,
            } for item in return_obj.items]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@purchase_return_bp.route('/purchase-returns', methods=['POST'])
@jwt_required()
def create_purchase_return():
    """
    Create new purchase return
    ---
    tags:
      - Purchasing
    summary: Create purchase return
    description: Create a new purchase return with line items linked to a purchase invoice
    security:
      - BearerAuth: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - invoice_id
            - reason
            - return_type
          properties:
            invoice_id:
              type: integer
            supplier_id:
              type: integer
            return_date:
              type: string
              format: date
            reason:
              type: string
            return_type:
              type: string
              enum: [defective, wrong_item, damaged, other]
            status:
              type: string
              enum: [draft, submitted, approved, rejected, completed]
            approval_status:
              type: string
              enum: [pending, approved, rejected]
            currency:
              type: string
            exchange_rate:
              type: number
            subtotal:
              type: number
            tax_amount:
              type: number
            discount_amount:
              type: number
            total_amount:
              type: number
            credit_note_number:
              type: string
            credit_note_date:
              type: string
              format: date
            items:
              type: array
              items:
                type: object
                properties:
                  invoice_item_id:
                    type: integer
                  product_id:
                    type: integer
                  material_id:
                    type: integer
                  quantity:
                    type: number
                  uom:
                    type: string
                  unit_price:
                    type: number
                  total_price:
                    type: number
                  reason:
                    type: string
    responses:
      201:
        description: Purchase return created successfully
        schema:
          type: object
          properties:
            message:
              type: string
            return:
              type: object
              properties:
                id:
                  type: integer
                return_number:
                  type: string
      400:
        description: Invalid request data
      404:
        description: Purchase invoice not found
    """
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # Generate return number
        return_number = generate_number('PR')
        
        # Get invoice to validate
        invoice = db.session.get(PurchaseInvoice, data.get('invoice_id'))
        if not invoice:
            return jsonify({'error': 'Purchase Invoice not found'}), 404
        
        # Create return
        return_obj = PurchaseReturn(
            return_number=return_number,
            invoice_id=data.get('invoice_id'),
            supplier_id=data.get('supplier_id') or invoice.supplier_id,
            return_date=datetime.strptime(data.get('return_date'), '%Y-%m-%d').date() if data.get('return_date') else get_local_today(),
            reason=data.get('reason'),
            return_type=data.get('return_type'),
            status=data.get('status', 'draft'),
            approval_status=data.get('approval_status', 'pending'),
            currency=data.get('currency', 'USD'),
            exchange_rate=data.get('exchange_rate', 1.0),
            subtotal=data.get('subtotal', 0),
            tax_amount=data.get('tax_amount', 0),
            discount_amount=data.get('discount_amount', 0),
            total_amount=data.get('total_amount', 0),
            credit_note_number=data.get('credit_note_number'),
            credit_note_date=datetime.strptime(data.get('credit_note_date'), '%Y-%m-%d').date() if data.get('credit_note_date') else None,
            notes=data.get('notes'),
            internal_notes=data.get('internal_notes'),
            created_by=user_id,
            created_at=get_local_now()
        )
        
        db.session.add(return_obj)
        db.session.flush()
        
        # Add return items
        items_data = data.get('items', [])
        for idx, item_data in enumerate(items_data, 1):
            item = PurchaseReturnItem(
                return_id=return_obj.id,
                invoice_item_id=item_data.get('invoice_item_id'),
                line_number=idx,
                product_id=item_data.get('product_id'),
                material_id=item_data.get('material_id'),
                description=item_data.get('description'),
                quantity=item_data.get('quantity'),
                uom=item_data.get('uom'),
                unit_price=item_data.get('unit_price'),
                discount_percent=item_data.get('discount_percent', 0),
                discount_amount=item_data.get('discount_amount', 0),
                tax_percent=item_data.get('tax_percent', 0),
                tax_amount=item_data.get('tax_amount', 0),
                total_price=item_data.get('total_price'),
                reason=item_data.get('reason'),
                notes=item_data.get('notes'),
                created_at=get_local_now()
            )
            db.session.add(item)
            
            # Update invoice item quantity_returned
            invoice_item = db.session.get(PurchaseInvoiceItem, item_data.get('invoice_item_id'))
            if invoice_item:
                invoice_item.quantity_returned = (invoice_item.quantity_returned or 0) + item_data.get('quantity', 0)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Purchase return created successfully',
            'return': {
                'id': return_obj.id,
                'return_number': return_obj.return_number
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchase_return_bp.route('/purchase-returns/<int:id>', methods=['PUT'])
@jwt_required()
def update_purchase_return(id):
    """
    Update purchase return
    ---
    tags:
      - Purchasing
    summary: Update purchase return
    description: Update an existing purchase return and its line items
    security:
      - BearerAuth: []
    parameters:
      - name: id
        in: path
        type: integer
        required: true
        description: Purchase return ID
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            return_date:
              type: string
              format: date
            reason:
              type: string
            return_type:
              type: string
            status:
              type: string
            approval_status:
              type: string
            total_amount:
              type: number
            credit_note_number:
              type: string
            credit_note_date:
              type: string
              format: date
            notes:
              type: string
            items:
              type: array
              items:
                type: object
    responses:
      200:
        description: Purchase return updated successfully
      400:
        description: Invalid request data
      404:
        description: Purchase return not found
    """
    try:
        return_obj = db.session.get(PurchaseReturn, id) or abort(404)
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # Update return fields
        if 'return_date' in data:
            return_obj.return_date = datetime.strptime(data['return_date'], '%Y-%m-%d').date()
        if 'reason' in data:
            return_obj.reason = data['reason']
        if 'return_type' in data:
            return_obj.return_type = data['return_type']
        if 'status' in data:
            return_obj.status = data['status']
        if 'approval_status' in data:
            return_obj.approval_status = data['approval_status']
            if data['approval_status'] == 'approved':
                return_obj.approved_by = user_id
                return_obj.approved_at = get_local_now()
        if 'currency' in data:
            return_obj.currency = data['currency']
        if 'exchange_rate' in data:
            return_obj.exchange_rate = data['exchange_rate']
        if 'subtotal' in data:
            return_obj.subtotal = data['subtotal']
        if 'tax_amount' in data:
            return_obj.tax_amount = data['tax_amount']
        if 'discount_amount' in data:
            return_obj.discount_amount = data['discount_amount']
        if 'total_amount' in data:
            return_obj.total_amount = data['total_amount']
        if 'credit_note_number' in data:
            return_obj.credit_note_number = data['credit_note_number']
        if 'credit_note_date' in data:
            return_obj.credit_note_date = datetime.strptime(data['credit_note_date'], '%Y-%m-%d').date()
        if 'notes' in data:
            return_obj.notes = data['notes']
        if 'internal_notes' in data:
            return_obj.internal_notes = data['internal_notes']
        return_obj.updated_at = get_local_now()
        
        # Update items if provided
        if 'items' in data:
            # Delete existing items
            PurchaseReturnItem.query.filter_by(return_id=id).delete()
            
            # Add new items
            for idx, item_data in enumerate(data['items'], 1):
                item = PurchaseReturnItem(
                    return_id=return_obj.id,
                    invoice_item_id=item_data.get('invoice_item_id'),
                    line_number=idx,
                    product_id=item_data.get('product_id'),
                    material_id=item_data.get('material_id'),
                    description=item_data.get('description'),
                    quantity=item_data.get('quantity'),
                    uom=item_data.get('uom'),
                    unit_price=item_data.get('unit_price'),
                    discount_percent=item_data.get('discount_percent', 0),
                    discount_amount=item_data.get('discount_amount', 0),
                    tax_percent=item_data.get('tax_percent', 0),
                    tax_amount=item_data.get('tax_amount', 0),
                    total_price=item_data.get('total_price'),
                    reason=item_data.get('reason'),
                    notes=item_data.get('notes'),
                    updated_at=get_local_now()
                )
                db.session.add(item)
        
        db.session.commit()
        
        return jsonify({'message': 'Purchase return updated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchase_return_bp.route('/purchase-returns/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_purchase_return(id):
    """
    Delete purchase return
    ---
    tags:
      - Purchasing
    summary: Delete purchase return
    description: Delete a purchase return (only non-approved returns can be deleted)
    security:
      - BearerAuth: []
    parameters:
      - name: id
        in: path
        type: integer
        required: true
        description: Purchase return ID
    responses:
      200:
        description: Purchase return deleted successfully
      400:
        description: Cannot delete approved return
      404:
        description: Purchase return not found
    """
    try:
        return_obj = db.session.get(PurchaseReturn, id) or abort(404)
        
        # Check if return is approved - cannot delete approved returns
        if return_obj.approval_status == 'approved':
            return jsonify({'error': 'Cannot delete approved return'}), 400
        
        db.session.delete(return_obj)
        db.session.commit()
        
        return jsonify({'message': 'Purchase return deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchase_return_bp.route('/purchase-returns/<int:id>/approve', methods=['POST'])
@jwt_required()
def approve_purchase_return(id):
    """
    Approve purchase return
    ---
    tags:
      - Purchasing
    summary: Approve purchase return
    description: Approve a purchase return and set its status to completed
    security:
      - BearerAuth: []
    parameters:
      - name: id
        in: path
        type: integer
        required: true
        description: Purchase return ID
    responses:
      200:
        description: Purchase return approved successfully
      400:
        description: Return already approved
      404:
        description: Purchase return not found
    """
    try:
        return_obj = db.session.get(PurchaseReturn, id) or abort(404)
        user_id = get_jwt_identity()
        
        if return_obj.approval_status == 'approved':
            return jsonify({'error': 'Return already approved'}), 400
        
        return_obj.approval_status = 'approved'
        return_obj.approved_by = user_id
        return_obj.approved_at = get_local_now()
        return_obj.status = 'completed'
        
        db.session.commit()
        
        return jsonify({'message': 'Purchase return approved successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchase_return_bp.route('/purchase-returns/<int:id>/reject', methods=['POST'])
@jwt_required()
def reject_purchase_return(id):
    """
    Reject purchase return
    ---
    tags:
      - Purchasing
    summary: Reject purchase return
    description: Reject a purchase return and set its status to cancelled
    security:
      - BearerAuth: []
    parameters:
      - name: id
        in: path
        type: integer
        required: true
        description: Purchase return ID
      - name: body
        in: body
        schema:
          type: object
          properties:
            notes:
              type: string
              description: Rejection notes
    responses:
      200:
        description: Purchase return rejected successfully
      400:
        description: Cannot reject approved return
      404:
        description: Purchase return not found
    """
    try:
        return_obj = db.session.get(PurchaseReturn, id) or abort(404)
        data = request.get_json()
        user_id = get_jwt_identity()
        
        if return_obj.approval_status == 'approved':
            return jsonify({'error': 'Cannot reject approved return'}), 400
        
        return_obj.approval_status = 'rejected'
        return_obj.approved_by = user_id
        return_obj.approved_at = get_local_now()
        return_obj.status = 'cancelled'
        if data.get('notes'):
            return_obj.internal_notes = (return_obj.internal_notes or '') + f'\nRejection: {data.get("notes")}'
        
        db.session.commit()
        
        return jsonify({'message': 'Purchase return rejected successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
