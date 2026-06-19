from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, PurchaseInvoice, PurchaseInvoiceItem, PurchaseOrder, PurchaseOrderItem, Supplier, User
from utils.i18n import success_response, error_response, get_message
from utils import generate_number
from datetime import datetime, date
from utils.timezone import get_local_now, get_local_today

purchase_invoice_bp = Blueprint('purchase_invoice', __name__)

# ===============================
# PURCHASE INVOICE CRUD
# ===============================

@purchase_invoice_bp.route('/purchase-invoices', methods=['GET'])
@jwt_required()
def get_purchase_invoices():
    """
    Get all purchase invoices with filtering
    ---
    tags:
      - Purchasing
    summary: Get all purchase invoices
    description: Retrieve all purchase invoices with optional filtering by status, payment status, supplier, PO, and date range
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
        description: Filter by invoice status (draft, posted, paid, cancelled)
      - name: payment_status
        in: query
        type: string
        description: Filter by payment status (unpaid, partial, paid, overdue)
      - name: supplier_id
        in: query
        type: integer
        description: Filter by supplier ID
      - name: po_id
        in: query
        type: integer
        description: Filter by purchase order ID
      - name: date_from
        in: query
        type: string
        format: date
        description: Filter invoices from this date (YYYY-MM-DD)
      - name: date_to
        in: query
        type: string
        format: date
        description: Filter invoices until this date (YYYY-MM-DD)
    responses:
      200:
        description: Purchase invoices retrieved successfully
        schema:
          type: object
          properties:
            invoices:
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
        payment_status = request.args.get('payment_status')
        supplier_id = request.args.get('supplier_id', type=int)
        po_id = request.args.get('po_id', type=int)
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        query = PurchaseInvoice.query
        
        if status:
            query = query.filter(PurchaseInvoice.status == status)
        if payment_status:
            query = query.filter(PurchaseInvoice.payment_status == payment_status)
        if supplier_id:
            query = query.filter(PurchaseInvoice.supplier_id == supplier_id)
        if po_id:
            query = query.filter(PurchaseInvoice.po_id == po_id)
        if date_from:
            query = query.filter(PurchaseInvoice.invoice_date >= date_from)
        if date_to:
            query = query.filter(PurchaseInvoice.invoice_date <= date_to)
            
        invoices = query.order_by(PurchaseInvoice.invoice_date.desc()).paginate(
            page=page, per_page=per_page
        )
        
        return jsonify({
            'invoices': [{
                'id': inv.id,
                'invoice_number': inv.invoice_number,
                'po_id': inv.po_id,
                'po_number': inv.purchase_order.po_number if inv.purchase_order else None,
                'supplier_id': inv.supplier_id,
                'supplier_name': inv.supplier.company_name if inv.supplier else None,
                'invoice_date': inv.invoice_date.isoformat() if inv.invoice_date else None,
                'due_date': inv.due_date.isoformat() if inv.due_date else None,
                'supplier_invoice_number': inv.supplier_invoice_number,
                'supplier_invoice_date': inv.supplier_invoice_date.isoformat() if inv.supplier_invoice_date else None,
                'status': inv.status,
                'payment_status': inv.payment_status,
                'currency': inv.currency,
                'exchange_rate': float(inv.exchange_rate) if inv.exchange_rate else None,
                'subtotal': float(inv.subtotal) if inv.subtotal else 0,
                'tax_amount': float(inv.tax_amount) if inv.tax_amount else 0,
                'discount_amount': float(inv.discount_amount) if inv.discount_amount else 0,
                'shipping_amount': float(inv.shipping_amount) if inv.shipping_amount else 0,
                'other_charges': float(inv.other_charges) if inv.other_charges else 0,
                'total_amount': float(inv.total_amount) if inv.total_amount else 0,
                'amount_paid': float(inv.amount_paid) if inv.amount_paid else 0,
                'balance_due': float(inv.balance_due) if inv.balance_due else 0,
                'notes': inv.notes,
                'received_by': inv.received_by,
                'received_by_name': inv.received_by_user.username if inv.received_by_user else None,
                'posted_by': inv.posted_by,
                'posted_by_name': inv.posted_by_user.username if inv.posted_by_user else None,
                'posted_at': inv.posted_at.isoformat() if inv.posted_at else None,
                'created_at': inv.created_at.isoformat() if inv.created_at else None,
                'updated_at': inv.updated_at.isoformat() if inv.updated_at else None,
            } for inv in invoices.items],
            'total': invoices.total,
            'pages': invoices.pages,
            'current_page': invoices.page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@purchase_invoice_bp.route('/purchase-invoices/<int:id>', methods=['GET'])
@jwt_required()
def get_purchase_invoice(id):
    """
    Get purchase invoice detail by ID
    ---
    tags:
      - Purchasing
    summary: Get purchase invoice detail
    description: Retrieve detailed information about a specific purchase invoice including all line items
    security:
      - BearerAuth: []
    parameters:
      - name: id
        in: path
        type: integer
        required: true
        description: Purchase invoice ID
    responses:
      200:
        description: Purchase invoice detail retrieved successfully
        schema:
          type: object
          properties:
            id:
              type: integer
            invoice_number:
              type: string
            po_id:
              type: integer
            supplier_id:
              type: integer
            invoice_date:
              type: string
              format: date
            total_amount:
              type: number
            items:
              type: array
              items:
                type: object
      404:
        description: Purchase invoice not found
    """
    try:
        invoice = db.session.get(PurchaseInvoice, id) or abort(404)
        
        return jsonify({
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'po_id': invoice.po_id,
            'po_number': invoice.purchase_order.po_number if invoice.purchase_order else None,
            'supplier_id': invoice.supplier_id,
            'supplier_name': invoice.supplier.company_name if invoice.supplier else None,
            'invoice_date': invoice.invoice_date.isoformat() if invoice.invoice_date else None,
            'due_date': invoice.due_date.isoformat() if invoice.due_date else None,
            'supplier_invoice_number': invoice.supplier_invoice_number,
            'supplier_invoice_date': invoice.supplier_invoice_date.isoformat() if invoice.supplier_invoice_date else None,
            'status': invoice.status,
            'payment_status': invoice.payment_status,
            'currency': invoice.currency,
            'exchange_rate': float(invoice.exchange_rate) if invoice.exchange_rate else None,
            'payment_terms': invoice.payment_terms,
            'payment_method': invoice.payment_method,
            'subtotal': float(invoice.subtotal) if invoice.subtotal else 0,
            'tax_amount': float(invoice.tax_amount) if invoice.tax_amount else 0,
            'discount_amount': float(invoice.discount_amount) if invoice.discount_amount else 0,
            'shipping_amount': float(invoice.shipping_amount) if invoice.shipping_amount else 0,
            'other_charges': float(invoice.other_charges) if invoice.other_charges else 0,
            'total_amount': float(invoice.total_amount) if invoice.total_amount else 0,
            'amount_paid': float(invoice.amount_paid) if invoice.amount_paid else 0,
            'balance_due': float(invoice.balance_due) if invoice.balance_due else 0,
            'notes': invoice.notes,
            'internal_notes': invoice.internal_notes,
            'received_by': invoice.received_by,
            'received_by_name': invoice.received_by_user.username if invoice.received_by_user else None,
            'posted_by': invoice.posted_by,
            'posted_by_name': invoice.posted_by_user.username if invoice.posted_by_user else None,
            'posted_at': invoice.posted_at.isoformat() if invoice.posted_at else None,
            'created_at': invoice.created_at.isoformat() if invoice.created_at else None,
            'updated_at': invoice.updated_at.isoformat() if invoice.updated_at else None,
            'items': [{
                'id': item.id,
                'line_number': item.line_number,
                'po_item_id': item.po_item_id,
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
                'quantity_returned': float(item.quantity_returned) if item.quantity_returned else 0,
                'notes': item.notes,
            } for item in invoice.items]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@purchase_invoice_bp.route('/purchase-invoices', methods=['POST'])
@jwt_required()
def create_purchase_invoice():
    """
    Create new purchase invoice
    ---
    tags:
      - Purchasing
    summary: Create purchase invoice
    description: Create a new purchase invoice with line items linked to a purchase order
    security:
      - BearerAuth: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - po_id
          properties:
            po_id:
              type: integer
            supplier_id:
              type: integer
            invoice_date:
              type: string
              format: date
            due_date:
              type: string
              format: date
            supplier_invoice_number:
              type: string
            status:
              type: string
              enum: [draft, posted, paid, cancelled]
            payment_status:
              type: string
              enum: [unpaid, partial, paid, overdue]
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
            shipping_amount:
              type: number
            total_amount:
              type: number
            items:
              type: array
              items:
                type: object
                properties:
                  po_item_id:
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
    responses:
      201:
        description: Purchase invoice created successfully
        schema:
          type: object
          properties:
            message:
              type: string
            invoice:
              type: object
              properties:
                id:
                  type: integer
                invoice_number:
                  type: string
      400:
        description: Invalid request data
      404:
        description: Purchase order not found
    """
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # Generate invoice number
        invoice_number = generate_number('PI')
        
        # Get PO to validate
        po = db.session.get(PurchaseOrder, data.get('po_id'))
        if not po:
            return jsonify({'error': 'Purchase Order not found'}), 404
        
        # Create invoice
        invoice = PurchaseInvoice(
            invoice_number=invoice_number,
            po_id=data.get('po_id'),
            supplier_id=data.get('supplier_id') or po.supplier_id,
            invoice_date=datetime.strptime(data.get('invoice_date'), '%Y-%m-%d').date() if data.get('invoice_date') else get_local_today(),
            due_date=datetime.strptime(data.get('due_date'), '%Y-%m-%d').date() if data.get('due_date') else None,
            supplier_invoice_number=data.get('supplier_invoice_number'),
            supplier_invoice_date=datetime.strptime(data.get('supplier_invoice_date'), '%Y-%m-%d').date() if data.get('supplier_invoice_date') else None,
            status=data.get('status', 'draft'),
            payment_status=data.get('payment_status', 'unpaid'),
            currency=data.get('currency', 'USD'),
            exchange_rate=data.get('exchange_rate', 1.0),
            payment_terms=data.get('payment_terms'),
            payment_method=data.get('payment_method'),
            subtotal=data.get('subtotal', 0),
            tax_amount=data.get('tax_amount', 0),
            discount_amount=data.get('discount_amount', 0),
            shipping_amount=data.get('shipping_amount', 0),
            other_charges=data.get('other_charges', 0),
            total_amount=data.get('total_amount', 0),
            amount_paid=data.get('amount_paid', 0),
            balance_due=data.get('balance_due', data.get('total_amount', 0)),
            notes=data.get('notes'),
            internal_notes=data.get('internal_notes'),
            received_by=data.get('received_by') or user_id,
            created_at=get_local_now()
        )
        
        db.session.add(invoice)
        db.session.flush()
        
        # Add invoice items
        items_data = data.get('items', [])
        for idx, item_data in enumerate(items_data, 1):
            item = PurchaseInvoiceItem(
                invoice_id=invoice.id,
                po_item_id=item_data.get('po_item_id'),
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
                notes=item_data.get('notes'),
                created_at=get_local_now()
            )
            db.session.add(item)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Purchase invoice created successfully',
            'invoice': {
                'id': invoice.id,
                'invoice_number': invoice.invoice_number
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchase_invoice_bp.route('/purchase-invoices/<int:id>', methods=['PUT'])
@jwt_required()
def update_purchase_invoice(id):
    """
    Update purchase invoice
    ---
    tags:
      - Purchasing
    summary: Update purchase invoice
    description: Update an existing purchase invoice and its line items
    security:
      - BearerAuth: []
    parameters:
      - name: id
        in: path
        type: integer
        required: true
        description: Purchase invoice ID
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            invoice_date:
              type: string
              format: date
            due_date:
              type: string
              format: date
            status:
              type: string
              enum: [draft, posted, paid, cancelled]
            payment_status:
              type: string
            total_amount:
              type: number
            amount_paid:
              type: number
            balance_due:
              type: number
            notes:
              type: string
            items:
              type: array
              items:
                type: object
    responses:
      200:
        description: Purchase invoice updated successfully
      400:
        description: Invalid request data
      404:
        description: Purchase invoice not found
    """
    try:
        invoice = db.session.get(PurchaseInvoice, id) or abort(404)
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # Update invoice fields
        if 'invoice_date' in data:
            invoice.invoice_date = datetime.strptime(data['invoice_date'], '%Y-%m-%d').date()
        if 'due_date' in data:
            invoice.due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
        if 'supplier_invoice_number' in data:
            invoice.supplier_invoice_number = data['supplier_invoice_number']
        if 'supplier_invoice_date' in data:
            invoice.supplier_invoice_date = datetime.strptime(data['supplier_invoice_date'], '%Y-%m-%d').date()
        if 'status' in data:
            invoice.status = data['status']
            if data['status'] == 'posted':
                invoice.posted_by = user_id
                invoice.posted_at = get_local_now()
        if 'payment_status' in data:
            invoice.payment_status = data['payment_status']
        if 'currency' in data:
            invoice.currency = data['currency']
        if 'exchange_rate' in data:
            invoice.exchange_rate = data['exchange_rate']
        if 'payment_terms' in data:
            invoice.payment_terms = data['payment_terms']
        if 'payment_method' in data:
            invoice.payment_method = data['payment_method']
        if 'subtotal' in data:
            invoice.subtotal = data['subtotal']
        if 'tax_amount' in data:
            invoice.tax_amount = data['tax_amount']
        if 'discount_amount' in data:
            invoice.discount_amount = data['discount_amount']
        if 'shipping_amount' in data:
            invoice.shipping_amount = data['shipping_amount']
        if 'other_charges' in data:
            invoice.other_charges = data['other_charges']
        if 'total_amount' in data:
            invoice.total_amount = data['total_amount']
        if 'amount_paid' in data:
            invoice.amount_paid = data['amount_paid']
        if 'balance_due' in data:
            invoice.balance_due = data['balance_due']
        if 'notes' in data:
            invoice.notes = data['notes']
        if 'internal_notes' in data:
            invoice.internal_notes = data['internal_notes']
        invoice.updated_at = get_local_now()
        
        # Update items if provided
        if 'items' in data:
            # Delete existing items
            PurchaseInvoiceItem.query.filter_by(invoice_id=id).delete()
            
            # Add new items
            for idx, item_data in enumerate(data['items'], 1):
                item = PurchaseInvoiceItem(
                    invoice_id=invoice.id,
                    po_item_id=item_data.get('po_item_id'),
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
                    notes=item_data.get('notes'),
                    updated_at=get_local_now()
                )
                db.session.add(item)
        
        db.session.commit()
        
        return jsonify({'message': 'Purchase invoice updated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchase_invoice_bp.route('/purchase-invoices/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_purchase_invoice(id):
    """
    Delete purchase invoice
    ---
    tags:
      - Purchasing
    summary: Delete purchase invoice
    description: Delete a purchase invoice (only draft invoices can be deleted)
    security:
      - BearerAuth: []
    parameters:
      - name: id
        in: path
        type: integer
        required: true
        description: Purchase invoice ID
    responses:
      200:
        description: Purchase invoice deleted successfully
      400:
        description: Cannot delete posted invoice
      404:
        description: Purchase invoice not found
    """
    try:
        invoice = db.session.get(PurchaseInvoice, id) or abort(404)
        
        # Check if invoice is posted - cannot delete posted invoices
        if invoice.status == 'posted':
            return jsonify({'error': 'Cannot delete posted invoice'}), 400
        
        db.session.delete(invoice)
        db.session.commit()
        
        return jsonify({'message': 'Purchase invoice deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# =============================================
# 3-WAY MATCHING: PO vs GRN vs Invoice
# =============================================

@purchase_invoice_bp.route('/purchase-invoices/<int:id>/three-way-match', methods=['GET'])
@jwt_required()
def three_way_match(id):
    """
    Compare PO ordered quantities/prices vs GRN received quantities vs Invoice billed quantities/prices.
    Returns line-level discrepancies and an overall match status.
    """
    try:
        from models import GoodsReceivedNote, GRNItem

        invoice = db.session.get(PurchaseInvoice, id)
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404

        po = invoice.purchase_order
        if not po:
            return jsonify({'error': 'No PO linked to this invoice'}), 400

        # Gather all GRN items for this PO
        grns = GoodsReceivedNote.query.filter_by(po_id=po.id).all()
        # Sum received quantity per po_item_id across all GRNs
        grn_received: dict = {}   # po_item_id -> total received
        grn_accepted: dict = {}   # po_item_id -> total accepted
        for grn in grns:
            for gi in grn.items:
                key = gi.po_item_id
                grn_received[key] = grn_received.get(key, 0.0) + float(gi.quantity_received or 0)
                grn_accepted[key] = grn_accepted.get(key, 0.0) + float(gi.quantity_accepted or 0)

        # Build match lines
        lines = []
        has_price_variance = False
        has_qty_variance = False
        has_missing_grn = False

        for inv_item in invoice.items:
            po_item = inv_item.po_item
            if not po_item:
                continue

            po_qty = float(po_item.quantity or 0)
            po_price = float(po_item.unit_price or 0)
            inv_qty = float(inv_item.quantity or 0)
            inv_price = float(inv_item.unit_price or 0)
            rcv_qty = grn_received.get(po_item.id, 0.0)
            acc_qty = grn_accepted.get(po_item.id, 0.0)

            price_variance = round(inv_price - po_price, 4)
            qty_vs_grn = round(inv_qty - acc_qty, 4)   # invoice bills more than accepted?
            qty_vs_po = round(inv_qty - po_qty, 4)

            status = 'matched'
            issues = []

            if abs(price_variance) > 0.01:
                has_price_variance = True
                issues.append(f'Harga berbeda: PO Rp{po_price:,.2f} vs Invoice Rp{inv_price:,.2f}')
                status = 'discrepancy'

            if qty_vs_grn > 0.001:
                has_qty_variance = True
                issues.append(f'Tagihan {inv_qty} > diterima {acc_qty} {inv_item.uom}')
                status = 'discrepancy'

            if rcv_qty == 0 and inv_qty > 0:
                has_missing_grn = True
                issues.append('Belum ada GRN untuk item ini')
                status = 'discrepancy'

            lines.append({
                'po_item_id': po_item.id,
                'invoice_item_id': inv_item.id,
                'item_name': po_item.item_name,
                'uom': inv_item.uom,
                # PO column
                'po_qty': po_qty,
                'po_price': po_price,
                'po_total': round(po_qty * po_price, 2),
                # GRN column
                'grn_received': rcv_qty,
                'grn_accepted': acc_qty,
                # Invoice column
                'inv_qty': inv_qty,
                'inv_price': inv_price,
                'inv_total': float(inv_item.total_price or 0),
                # Variances
                'price_variance': price_variance,
                'qty_vs_grn': qty_vs_grn,
                'qty_vs_po': qty_vs_po,
                'status': status,
                'issues': issues,
            })

        # Overall status
        if has_missing_grn:
            overall = 'missing_grn'
        elif has_price_variance or has_qty_variance:
            overall = 'discrepancy'
        else:
            overall = 'matched'

        return jsonify({
            'invoice_id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'po_id': po.id,
            'po_number': po.po_number,
            'supplier_name': invoice.supplier.company_name if invoice.supplier else None,
            'invoice_total': float(invoice.total_amount or 0),
            'po_total': sum(float(i.total_price or 0) for i in po.items),
            'grn_count': len(grns),
            'overall_status': overall,
            'has_price_variance': has_price_variance,
            'has_qty_variance': has_qty_variance,
            'has_missing_grn': has_missing_grn,
            'lines': lines,
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@purchase_invoice_bp.route('/purchase-invoices/summary', methods=['GET'])
@jwt_required()
def invoice_match_summary():
    """List invoices with their match status overview"""
    try:
        from models import GoodsReceivedNote, GRNItem
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 30, type=int)
        status = request.args.get('status')
        search = request.args.get('search', '').strip()

        q = PurchaseInvoice.query
        if status:
            q = q.filter(PurchaseInvoice.status == status)
        if search:
            q = q.filter(PurchaseInvoice.invoice_number.ilike(f'%{search}%'))

        paginated = q.order_by(PurchaseInvoice.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        result = []
        for inv in paginated.items:
            po = inv.purchase_order
            grn_count = GoodsReceivedNote.query.filter_by(po_id=inv.po_id).count() if inv.po_id else 0
            result.append({
                'id': inv.id,
                'invoice_number': inv.invoice_number,
                'po_number': po.po_number if po else None,
                'supplier_name': inv.supplier.company_name if inv.supplier else None,
                'invoice_date': inv.invoice_date.isoformat() if inv.invoice_date else None,
                'due_date': inv.due_date.isoformat() if inv.due_date else None,
                'total_amount': float(inv.total_amount or 0),
                'status': inv.status,
                'payment_status': inv.payment_status,
                'grn_count': grn_count,
            })

        return jsonify({
            'invoices': result,
            'total': paginated.total,
            'pages': paginated.pages,
            'current_page': page,
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================
# PEMBAYARAN (PAYMENT RECORDING)
# =============================================

@purchase_invoice_bp.route('/purchase-invoices/<int:id>/record-payment', methods=['POST'])
@jwt_required()
def record_payment(id):
    """Catat pembayaran untuk purchase invoice"""
    try:
        from utils.timezone import get_local_now, get_local_today

        invoice = db.session.get(PurchaseInvoice, id)
        if not invoice:
            return jsonify({'error': 'Invoice not found'}), 404
        if invoice.status == 'cancelled':
            return jsonify({'error': 'Invoice sudah dibatalkan'}), 400
        if invoice.payment_status == 'paid':
            return jsonify({'error': 'Invoice sudah lunas'}), 400

        data = request.get_json() or {}
        amount = float(data.get('amount', 0))
        if amount <= 0:
            return jsonify({'error': 'Jumlah pembayaran harus lebih dari 0'}), 400

        balance = float(invoice.balance_due or invoice.total_amount or 0)
        if amount > balance + 0.01:
            return jsonify({'error': f'Jumlah melebihi sisa tagihan Rp {balance:,.2f}'}), 400

        invoice.amount_paid = float(invoice.amount_paid or 0) + amount
        invoice.balance_due = max(0, float(invoice.total_amount or 0) - float(invoice.amount_paid))

        if invoice.balance_due <= 0.01:
            invoice.payment_status = 'paid'
            invoice.status = 'paid'
        else:
            invoice.payment_status = 'partial'

        payment_note = (
            f"[BAYAR {get_local_today().strftime('%d/%m/%Y')}] "
            f"Rp {amount:,.0f} via {data.get('payment_method', 'transfer')}. "
            f"{data.get('notes', '')}"
        ).strip()
        invoice.internal_notes = ((invoice.internal_notes or '') + '\n' + payment_note).strip()

        db.session.commit()

        return jsonify({
            'message': f'Pembayaran Rp {amount:,.0f} berhasil dicatat',
            'invoice_id': invoice.id,
            'amount_paid': float(invoice.amount_paid),
            'balance_due': float(invoice.balance_due),
            'payment_status': invoice.payment_status,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
