from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db, Invoice, InvoiceItem, PurchaseOrder, PurchaseOrderItem, Supplier, User, Payment, Account
from utils.i18n import success_response, error_response, get_message
from utils import generate_number, generate_number_v2
from datetime import datetime, date
from utils.timezone import get_local_now, get_local_today

purchase_invoice_bp = Blueprint('purchase_invoice', __name__)

# ===============================
# STATUS MAPPING
# ===============================
# Prior to the 2026-08-18 migration, purchase invoices lived in their own
# PurchaseInvoice table with two separate fields: status (draft/posted/paid/
# cancelled) and payment_status (unpaid/partial/paid/overdue). The unified
# Invoice table (shared with Sales) only has a single `status` field -
# Bayu's 2026-08-18 decision was to follow the Sales pattern rather than
# reintroduce a second field: draft -> sent -> partial -> paid -> overdue ->
# cancelled. `posted_at`/`posted_by` (non-null once the accounting journal
# is posted) now carry the "has this been posted to the GL" signal that
# status='posted' used to carry.
_LEGACY_TO_UNIFIED_STATUS = {
    'draft': 'draft',
    'posted': 'sent',
    'paid': 'paid',
    'cancelled': 'cancelled',
}


def _resolve_incoming_status(data, default='draft'):
    """Collapse legacy (status, payment_status) pair from old frontend
    payloads into a single Invoice.status value."""
    payment_status = data.get('payment_status')
    if payment_status == 'paid':
        return 'paid'
    if payment_status == 'partial':
        return 'partial'
    if payment_status == 'overdue':
        return 'overdue'
    status = data.get('status')
    if status:
        return _LEGACY_TO_UNIFIED_STATUS.get(status, status)
    return default


def _serialize_invoice_list_item(inv):
    return {
        'id': inv.id,
        'invoice_number': inv.invoice_number,
        'po_id': inv.purchase_order_id,
        'po_number': inv.purchase_order.po_number if inv.purchase_order else None,
        'supplier_id': inv.supplier_id,
        'supplier_name': inv.supplier.company_name if inv.supplier else None,
        'invoice_date': inv.invoice_date.isoformat() if inv.invoice_date else None,
        'due_date': inv.due_date.isoformat() if inv.due_date else None,
        'supplier_invoice_number': inv.supplier_invoice_number,
        'supplier_invoice_date': inv.supplier_invoice_date.isoformat() if inv.supplier_invoice_date else None,
        'status': inv.status,
        # Kept for old frontend callers still reading payment_status - derived
        # from the unified status field rather than stored separately.
        'payment_status': _status_to_legacy_payment_status(inv.status),
        'on_hold': inv.on_hold,
        'hold_reason': inv.hold_reason,
        'currency': inv.currency,
        'exchange_rate': float(inv.exchange_rate) if inv.exchange_rate else None,
        'subtotal': float(inv.subtotal) if inv.subtotal else 0,
        'tax_amount': float(inv.tax_amount) if inv.tax_amount else 0,
        'discount_amount': float(inv.discount_amount) if inv.discount_amount else 0,
        'shipping_amount': float(inv.shipping_amount) if inv.shipping_amount else 0,
        'other_charges': float(inv.other_charges) if inv.other_charges else 0,
        'total_amount': float(inv.total_amount) if inv.total_amount else 0,
        'amount_paid': float(inv.paid_amount) if inv.paid_amount else 0,
        'balance_due': float(inv.balance_due) if inv.balance_due else 0,
        'notes': inv.notes,
        'received_by': inv.received_by,
        'received_by_name': inv.received_by_user.username if inv.received_by_user else None,
        'posted_by': inv.posted_by,
        'posted_by_name': inv.posted_by_user.username if inv.posted_by_user else None,
        'posted_at': inv.posted_at.isoformat() if inv.posted_at else None,
        'created_at': inv.created_at.isoformat() if inv.created_at else None,
        'updated_at': inv.updated_at.isoformat() if inv.updated_at else None,
    }


def _status_to_legacy_payment_status(status):
    if status == 'paid':
        return 'paid'
    if status == 'partial':
        return 'partial'
    if status == 'overdue':
        return 'overdue'
    return 'unpaid'


# ===============================
# PURCHASE INVOICE CRUD
# ===============================

@purchase_invoice_bp.route('/purchase-invoices', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def get_purchase_invoices():
    """
    Get all purchase invoices with filtering
    ---
    tags:
      - Purchasing
    summary: Get all purchase invoices
    description: Retrieve all purchase invoices (Invoice rows with invoice_type='purchase') with optional filtering
    security:
      - BearerAuth: []
    parameters:
      - name: page
        in: query
        type: integer
        default: 1
      - name: per_page
        in: query
        type: integer
        default: 50
      - name: status
        in: query
        type: string
        description: Filter by unified status (draft, sent, partial, paid, overdue, cancelled)
      - name: payment_status
        in: query
        type: string
        description: Legacy filter (unpaid, partial, paid, overdue) - mapped onto status
      - name: supplier_id
        in: query
        type: integer
      - name: po_id
        in: query
        type: integer
      - name: date_from
        in: query
        type: string
        format: date
      - name: date_to
        in: query
        type: string
        format: date
    responses:
      200:
        description: Purchase invoices retrieved successfully
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

        query = Invoice.query.filter(Invoice.invoice_type == 'purchase')

        if status:
            query = query.filter(Invoice.status == status)
        if payment_status == 'unpaid':
            query = query.filter(Invoice.status.in_(['draft', 'sent']))
        elif payment_status in ('partial', 'paid', 'overdue'):
            query = query.filter(Invoice.status == payment_status)
        if supplier_id:
            query = query.filter(Invoice.supplier_id == supplier_id)
        if po_id:
            query = query.filter(Invoice.purchase_order_id == po_id)
        if date_from:
            query = query.filter(Invoice.invoice_date >= date_from)
        if date_to:
            query = query.filter(Invoice.invoice_date <= date_to)

        invoices = query.order_by(Invoice.invoice_date.desc()).paginate(
            page=page, per_page=per_page
        )

        return jsonify({
            'invoices': [_serialize_invoice_list_item(inv) for inv in invoices.items],
            'total': invoices.total,
            'pages': invoices.pages,
            'current_page': invoices.page
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@purchase_invoice_bp.route('/purchase-invoices/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def get_purchase_invoice(id):
    """
    Get purchase invoice detail by ID
    ---
    tags:
      - Purchasing
    summary: Get purchase invoice detail
    security:
      - BearerAuth: []
    parameters:
      - name: id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Purchase invoice detail retrieved successfully
      404:
        description: Purchase invoice not found
    """
    try:
        invoice = db.session.get(Invoice, id)
        if not invoice or invoice.invoice_type != 'purchase':
            abort(404)

        return jsonify({
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'po_id': invoice.purchase_order_id,
            'po_number': invoice.purchase_order.po_number if invoice.purchase_order else None,
            'supplier_id': invoice.supplier_id,
            'supplier_name': invoice.supplier.company_name if invoice.supplier else None,
            'invoice_date': invoice.invoice_date.isoformat() if invoice.invoice_date else None,
            'due_date': invoice.due_date.isoformat() if invoice.due_date else None,
            'supplier_invoice_number': invoice.supplier_invoice_number,
            'supplier_invoice_date': invoice.supplier_invoice_date.isoformat() if invoice.supplier_invoice_date else None,
            'status': invoice.status,
            'payment_status': _status_to_legacy_payment_status(invoice.status),
            'on_hold': invoice.on_hold,
            'hold_reason': invoice.hold_reason,
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
            'amount_paid': float(invoice.paid_amount) if invoice.paid_amount else 0,
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
                'total_price': float(item.total_amount) if item.total_amount else 0,
                'quantity_returned': float(item.quantity_returned) if item.quantity_returned else 0,
                'notes': item.notes,
            } for item in invoice.items]
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@purchase_invoice_bp.route('/purchase-invoices', methods=['POST'])
@jwt_required()
@require_permission('purchasing.create')
def create_purchase_invoice():
    """
    Create new purchase invoice
    ---
    tags:
      - Purchasing
    summary: Create purchase invoice
    description: Create a new Invoice (invoice_type='purchase') with line items linked to a purchase order
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
            payment_status:
              type: string
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
      400:
        description: Invalid request data
      404:
        description: Purchase order not found
    """
    try:
        data = request.get_json()
        user_id = get_jwt_identity()

        # Generate invoice number
        invoice_number = generate_number_v2('purchase_invoice', 'PI', Invoice, 'invoice_number')

        # Get PO to validate
        po = db.session.get(PurchaseOrder, data.get('po_id'))
        if not po:
            return jsonify({'error': 'Purchase Order not found'}), 404

        invoice_date_parsed = datetime.strptime(data.get('invoice_date'), '%Y-%m-%d').date() if data.get('invoice_date') else get_local_today()

        from utils.finance_helpers import is_period_locked
        if is_period_locked(invoice_date_parsed):
            return jsonify({'error': f'Periode {invoice_date_parsed.strftime("%Y-%m")} sudah ditutup (period-close). Tidak bisa membuat transaksi baru di periode ini.'}), 400

        # Create invoice - journal is posted immediately below (see original
        # PurchaseInvoice behavior), so posted_by/posted_at are set here too.
        invoice = Invoice(
            invoice_number=invoice_number,
            invoice_type='purchase',
            purchase_order_id=data.get('po_id'),
            supplier_id=data.get('supplier_id') or po.supplier_id,
            invoice_date=invoice_date_parsed,
            due_date=datetime.strptime(data.get('due_date'), '%Y-%m-%d').date() if data.get('due_date') else None,
            supplier_invoice_number=data.get('supplier_invoice_number'),
            supplier_invoice_date=datetime.strptime(data.get('supplier_invoice_date'), '%Y-%m-%d').date() if data.get('supplier_invoice_date') else None,
            status=_resolve_incoming_status(data, default='sent'),
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
            paid_amount=data.get('amount_paid', 0),
            balance_due=data.get('balance_due', data.get('total_amount', 0)),
            notes=data.get('notes'),
            internal_notes=data.get('internal_notes'),
            received_by=data.get('received_by') or user_id,
            posted_by=user_id,
            posted_at=get_local_now(),
            created_by=user_id,
            created_at=get_local_now()
        )

        db.session.add(invoice)
        db.session.flush()

        # Add invoice items
        # Guard rail: every item must link back to a PO line item, so
        # quantity_invoiced tracking and 3-way match stay accurate.
        items_data = data.get('items', [])
        for idx, item_data in enumerate(items_data, 1):
            if not item_data.get('po_item_id'):
                return jsonify({
                    'error': f'Item {idx}: po_item_id is required. '
                             'Every invoice line must reference a purchase order line item.'
                }), 400

        from models.product import Product, Material
        from models.approval_workflow import PendingJournalEntry
        from utils.finance_helpers import post_pending_journal, resolve_account, resolve_accounts_payable

        journal_lines = []
        total_debit_amount = 0

        for idx, item_data in enumerate(items_data, 1):
            item = InvoiceItem(
                invoice_id=invoice.id,
                po_item_id=item_data.get('po_item_id'),
                line_number=idx,
                product_id=item_data.get('product_id'),
                material_id=item_data.get('material_id'),
                description=item_data.get('description') or '',
                quantity=item_data.get('quantity'),
                uom=item_data.get('uom'),
                unit_price=item_data.get('unit_price'),
                discount_percent=item_data.get('discount_percent', 0),
                discount_amount=item_data.get('discount_amount', 0),
                tax_percent=item_data.get('tax_percent', 0),
                tax_amount=item_data.get('tax_amount', 0),
                total_amount=item_data.get('total_price'),
                notes=item_data.get('notes'),
                created_at=get_local_now()
            )
            db.session.add(item)

            # Track quantity_invoiced on the PO line item
            po_item = db.session.get(PurchaseOrderItem, item_data.get('po_item_id'))
            if po_item:
                po_item.quantity_invoiced = (po_item.quantity_invoiced or 0) + (item_data.get('quantity') or 0)

            # Determine debit account: inventory if this is a stocked item
            # (Material is always inventory; Product depends on material_type),
            # otherwise expense.
            line_amount = item_data.get('total_price') or 0
            product_id = item_data.get('product_id')
            material_id = item_data.get('material_id')

            is_inventory_item = False
            if material_id:
                is_inventory_item = True
            elif product_id:
                product = db.session.get(Product, product_id)
                if product and product.material_type in ('raw_materials', 'packaging_materials', 'chemical_materials', 'finished_goods'):
                    is_inventory_item = True

            slot = 'akun_persediaan_id' if is_inventory_item else 'akun_beban_id'
            debit_account_id = resolve_account(slot, product_id=product_id, category_id=None)

            journal_lines.append({
                'account_id': debit_account_id,
                'debit': float(line_amount),
                'credit': 0,
                'description': item_data.get('description') or f'Purchase invoice {invoice_number} line {idx}',
            })
            total_debit_amount += float(line_amount)

        # Invoice blocking (SAP MM concept, 2026-09-14) - a 3-way-match discrepancy
        # bigger than the configured tolerance now HOLDS the invoice's journal entry
        # for manual review instead of always silently auto-posting the variance
        # (the direction found inverted vs real SAP during the MM gap audit -
        # see project_sap_alignment_survey memory). Small/no variance still
        # auto-posts exactly as before - this only changes behavior for genuine
        # discrepancies past the tolerance.
        from models.finance import PurchaseAccountSettings
        from utils.finance_helpers import get_or_create_singleton
        purchase_settings = get_or_create_singleton(PurchaseAccountSettings)
        hold_reason = None
        try:
            match_result = _compute_three_way_match(invoice)
            total_price_variance = sum(
                (line['inv_price'] - line['po_price']) * line['inv_qty']
                for line in match_result['lines']
                if abs(line['price_variance']) > 0.01
            )
            variance_percent = (abs(total_price_variance) / total_debit_amount * 100) if total_debit_amount else 0
            tolerance = float(purchase_settings.invoice_variance_tolerance_percent or 0)
            if abs(total_price_variance) > 0.01 and variance_percent > tolerance:
                discrepancy_lines = [
                    f"{l.get('description', l.get('product_id') or l.get('material_id'))}: PO Rp{l['po_price']:,.0f} vs Invoice Rp{l['inv_price']:,.0f}"
                    for l in match_result['lines'] if abs(l['price_variance']) > 0.01
                ]
                hold_reason = (
                    f"Selisih harga {variance_percent:.1f}% melebihi toleransi {tolerance:.1f}%. " +
                    '; '.join(discrepancy_lines)
                )
            if abs(total_price_variance) > 0.01 and not hold_reason:
                if purchase_settings.akun_selisih_pembelian_id:
                    if total_price_variance > 0:
                        journal_lines.append({
                            'account_id': purchase_settings.akun_selisih_pembelian_id,
                            'debit': float(total_price_variance),
                            'credit': 0,
                            'description': f'Selisih harga pembelian - {invoice_number}',
                        })
                        for line in journal_lines:
                            if line['debit'] > 0 and line['account_id'] != purchase_settings.akun_selisih_pembelian_id:
                                reduction = min(line['debit'], float(total_price_variance))
                                line['debit'] -= reduction
                                break
                    else:
                        journal_lines.append({
                            'account_id': purchase_settings.akun_selisih_pembelian_id,
                            'debit': 0,
                            'credit': float(abs(total_price_variance)),
                            'description': f'Selisih harga pembelian - {invoice_number}',
                        })
                        for line in journal_lines:
                            if line['debit'] > 0:
                                line['debit'] += float(abs(total_price_variance))
                                break
        except ValueError:
            # No PO linked, or no GRN yet - skip variance posting silently,
            # this is a normal case (e.g. invoice created before any goods
            # receipt), not an error condition for invoice creation itself.
            pass

        # Credit: accounts payable (resolved per-supplier per Accurate's pattern)
        payable_account_id = resolve_accounts_payable(invoice.supplier_id)
        journal_lines.append({
            'account_id': payable_account_id,
            'debit': 0,
            'credit': total_debit_amount,
            'description': f'Accounts payable for {invoice_number}',
        })

        pending = PendingJournalEntry(
            workflow_id=None,
            entry_date=invoice.invoice_date,
            description=f'Purchase Invoice {invoice_number}',
            reference=invoice_number,
            lines=journal_lines,
            total_debit=total_debit_amount,
            total_credit=total_debit_amount,
            created_by=user_id,
        )
        db.session.add(pending)
        db.session.flush()

        invoice.pending_journal_entry_id = pending.id
        if hold_reason:
            # Held for review - journal deliberately left UNPOSTED (see
            # POST /purchase-invoices/<id>/release-hold). The invoice row itself
            # still exists so nothing is lost, but no GL entries exist yet.
            invoice.on_hold = True
            invoice.hold_reason = hold_reason
            invoice.posted_by = None
            invoice.posted_at = None
        else:
            post_pending_journal(pending.id, posted_by_user_id=user_id, reference_type='purchase_invoice', reference_id=invoice.id)

        db.session.commit()

        return jsonify({
            'message': 'Purchase invoice ditahan untuk review (selisih harga melebihi toleransi)' if hold_reason else 'Purchase invoice created successfully',
            'invoice': {
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'on_hold': bool(hold_reason),
                'hold_reason': hold_reason,
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchase_invoice_bp.route('/purchase-invoices/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('purchasing.edit')
def update_purchase_invoice(id):
    """
    Update purchase invoice
    ---
    tags:
      - Purchasing
    summary: Update purchase invoice
    security:
      - BearerAuth: []
    parameters:
      - name: id
        in: path
        type: integer
        required: true
      - name: body
        in: body
        required: true
        schema:
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
        invoice = db.session.get(Invoice, id)
        if not invoice or invoice.invoice_type != 'purchase':
            abort(404)
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
        if 'status' in data or 'payment_status' in data:
            new_status = _resolve_incoming_status(data, default=invoice.status)
            invoice.status = new_status
            if new_status == 'sent' and not invoice.posted_at:
                invoice.posted_by = user_id
                invoice.posted_at = get_local_now()
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
            invoice.paid_amount = data['amount_paid']
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
            InvoiceItem.query.filter_by(invoice_id=id).delete()

            # Add new items
            for idx, item_data in enumerate(data['items'], 1):
                item = InvoiceItem(
                    invoice_id=invoice.id,
                    po_item_id=item_data.get('po_item_id'),
                    line_number=idx,
                    product_id=item_data.get('product_id'),
                    material_id=item_data.get('material_id'),
                    description=item_data.get('description') or '',
                    quantity=item_data.get('quantity'),
                    uom=item_data.get('uom'),
                    unit_price=item_data.get('unit_price'),
                    discount_percent=item_data.get('discount_percent', 0),
                    discount_amount=item_data.get('discount_amount', 0),
                    tax_percent=item_data.get('tax_percent', 0),
                    tax_amount=item_data.get('tax_amount', 0),
                    total_amount=item_data.get('total_price'),
                    notes=item_data.get('notes'),
                )
                db.session.add(item)

        db.session.commit()

        return jsonify({'message': 'Purchase invoice updated successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchase_invoice_bp.route('/purchase-invoices/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('purchasing.delete')
def delete_purchase_invoice(id):
    """
    Delete purchase invoice
    ---
    tags:
      - Purchasing
    summary: Delete purchase invoice
    description: Delete a purchase invoice - only allowed if nothing has been paid against it yet (same guard rail as the shared /api/finance/invoices/<id> DELETE)
    security:
      - BearerAuth: []
    parameters:
      - name: id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Purchase invoice deleted successfully
      400:
        description: Cannot delete invoice with payments recorded
      404:
        description: Purchase invoice not found
    """
    try:
        invoice = db.session.get(Invoice, id)
        if not invoice or invoice.invoice_type != 'purchase':
            abort(404)

        if float(invoice.paid_amount or 0) > 0:
            return jsonify({'error': 'Cannot delete invoice with payments recorded'}), 400

        db.session.delete(invoice)
        db.session.commit()

        return jsonify({'message': 'Purchase invoice deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# =============================================
# 3-WAY MATCHING: PO vs GRN vs Invoice
# =============================================

def _compute_three_way_match(invoice):
    """
    Pure computation, extracted from the three_way_match() endpoint so it
    can also be called internally from create_purchase_invoice() to
    auto-post price variances to akun_selisih_pembelian_id, matching
    Accurate's behavior of posting variance automatically when the invoice
    is created rather than via a separate manual step.

    Returns a dict (not a Flask response) with the same shape as the
    three-way-match endpoint's JSON body, or raises ValueError if there is
    no PO linked to the invoice.
    """
    from models import GoodsReceivedNote, GRNItem

    po = invoice.purchase_order
    if not po:
        raise ValueError('No PO linked to this invoice')

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
        po_item = db.session.get(PurchaseOrderItem, inv_item.po_item_id) if inv_item.po_item_id else None
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
            'item_name': getattr(po_item, 'item_name', None) or (inv_item.description or ''),
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
            'inv_total': float(inv_item.total_amount or 0),
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

    return {
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
    }


@purchase_invoice_bp.route('/purchase-invoices/<int:id>/three-way-match', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def three_way_match(id):
    """
    Compare PO ordered quantities/prices vs GRN received quantities vs Invoice billed quantities/prices.
    Returns line-level discrepancies and an overall match status.
    """
    try:
        invoice = db.session.get(Invoice, id)
        if not invoice or invoice.invoice_type != 'purchase':
            return jsonify({'error': 'Invoice not found'}), 404

        result = _compute_three_way_match(invoice)
        return jsonify(result), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@purchase_invoice_bp.route('/purchase-invoices/<int:id>/release-hold', methods=['POST'])
@jwt_required()
@require_permission('purchasing.create')
def release_invoice_hold(id):
    """Release an invoice held by the invoice-blocking check (3-way-match discrepancy
    beyond tolerance, see create_purchase_invoice) - posts its previously-unposted
    PendingJournalEntry to the real ledger now that a human has reviewed it."""
    try:
        invoice = db.session.get(Invoice, id)
        if not invoice or invoice.invoice_type != 'purchase':
            return jsonify({'error': 'Invoice not found'}), 404
        if not invoice.on_hold:
            return jsonify({'error': 'Invoice ini tidak sedang ditahan'}), 400
        if not invoice.pending_journal_entry_id:
            return jsonify({'error': 'Tidak ada jurnal tertunda untuk invoice ini'}), 400

        from utils.finance_helpers import post_pending_journal
        user_id = get_jwt_identity()
        post_pending_journal(invoice.pending_journal_entry_id, posted_by_user_id=user_id,
                              reference_type='purchase_invoice', reference_id=invoice.id)

        invoice.on_hold = False
        invoice.posted_by = user_id
        invoice.posted_at = get_local_now()
        db.session.commit()

        return jsonify({'message': 'Invoice dilepas dari hold dan jurnal diposting'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchase_invoice_bp.route('/purchase-invoices/summary', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def invoice_match_summary():
    """List invoices with their match status overview"""
    try:
        from models import GoodsReceivedNote, GRNItem
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 30, type=int)
        status = request.args.get('status')
        search = request.args.get('search', '').strip()

        q = Invoice.query.filter(Invoice.invoice_type == 'purchase')
        if status:
            q = q.filter(Invoice.status == status)
        if search:
            q = q.filter(Invoice.invoice_number.ilike(f'%{search}%'))

        paginated = q.order_by(Invoice.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        result = []
        for inv in paginated.items:
            po = inv.purchase_order
            grn_count = GoodsReceivedNote.query.filter_by(po_id=inv.purchase_order_id).count() if inv.purchase_order_id else 0
            result.append({
                'id': inv.id,
                'invoice_number': inv.invoice_number,
                'po_number': po.po_number if po else None,
                'supplier_name': inv.supplier.company_name if inv.supplier else None,
                'invoice_date': inv.invoice_date.isoformat() if inv.invoice_date else None,
                'due_date': inv.due_date.isoformat() if inv.due_date else None,
                'total_amount': float(inv.total_amount or 0),
                'status': inv.status,
                'payment_status': _status_to_legacy_payment_status(inv.status),
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
# Per Bayu's 2026-08-18 decision: this now creates a real Payment row and
# requires bank_account_id (a Kas/Bank account), reusing the same
# validation POST /api/finance/payments already enforces, rather than just
# mutating amount_paid/balance_due in place like before.

@purchase_invoice_bp.route('/purchase-invoices/<int:id>/record-payment', methods=['POST'])
@jwt_required()
@require_permission('ap.create')
def record_payment(id):
    """Catat pembayaran untuk purchase invoice - membuat baris Payment sungguhan."""
    try:
        invoice = db.session.get(Invoice, id)
        if not invoice or invoice.invoice_type != 'purchase':
            return jsonify({'error': 'Invoice not found'}), 404
        if invoice.status == 'cancelled':
            return jsonify({'error': 'Invoice sudah dibatalkan'}), 400
        if invoice.status == 'paid':
            return jsonify({'error': 'Invoice sudah lunas'}), 400

        data = request.get_json() or {}
        user_id = get_jwt_identity()

        amount = float(data.get('amount', 0))
        if amount <= 0:
            return jsonify({'error': 'Jumlah pembayaran harus lebih dari 0'}), 400

        if not data.get('bank_account_id'):
            return jsonify({'error': 'bank_account_id is required'}), 400

        bank_account = db.session.get(Account, data['bank_account_id'])
        if not bank_account or not bank_account.is_cash_bank:
            return jsonify({'error': 'bank_account_id must reference a Kas/Bank account'}), 400

        balance = float(invoice.balance_due or invoice.total_amount or 0)
        if amount > balance + 0.01:
            return jsonify({'error': f'Jumlah melebihi sisa tagihan Rp {balance:,.2f}'}), 400

        payment_number = generate_number('PAY', Payment, 'payment_number')
        payment = Payment(
            payment_number=payment_number,
            payment_date=datetime.strptime(data['payment_date'], '%Y-%m-%d').date() if data.get('payment_date') else get_local_today(),
            payment_type='payment',
            invoice_id=invoice.id,
            supplier_id=invoice.supplier_id,
            payment_method=data.get('payment_method', 'transfer'),
            amount=amount,
            reference_number=data.get('reference_number'),
            bank_account_id=data['bank_account_id'],
            notes=data.get('notes'),
            received_by=user_id,
        )
        db.session.add(payment)

        invoice.paid_amount = float(invoice.paid_amount or 0) + amount
        invoice.balance_due = max(0, float(invoice.total_amount or 0) - float(invoice.paid_amount))

        if invoice.balance_due <= 0.01:
            invoice.status = 'paid'
        else:
            invoice.status = 'partial'

        db.session.commit()

        return jsonify({
            'message': f'Pembayaran Rp {amount:,.0f} berhasil dicatat',
            'invoice_id': invoice.id,
            'payment_id': payment.id,
            'amount_paid': float(invoice.paid_amount),
            'balance_due': float(invoice.balance_due),
            'status': invoice.status,
            'payment_status': _status_to_legacy_payment_status(invoice.status),
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
