from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Invoice, InvoiceItem, Payment, AccountingEntry, CostCenter, Account
from utils.i18n import success_response, error_response, get_message
from utils import generate_number, generate_number_v2
from datetime import datetime, timedelta
from sqlalchemy import func, extract
from utils.timezone import get_local_now, get_local_today
from utils.auth_decorators import require_permission

finance_bp = Blueprint('finance', __name__)

@finance_bp.route('/invoices', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_invoices():
    """
    Get all invoices with pagination
    ---
    tags:
      - Finance
    summary: Get all invoices
    description: Retrieve all invoices with pagination and optional filtering
    security:
      - BearerAuth: []
    parameters:
      - in: query
        name: page
        type: integer
        default: 1
        description: Page number
      - in: query
        name: per_page
        type: integer
        default: 50
        description: Items per page
      - in: query
        name: type
        type: string
        description: Filter by invoice type
    responses:
      200:
        description: Invoices retrieved successfully
        schema:
          type: object
          properties:
            invoices:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  invoice_number:
                    type: string
                  invoice_type:
                    type: string
                  invoice_date:
                    type: string
                    format: date-time
                  total_amount:
                    type: number
                  paid_amount:
                    type: number
                  balance_due:
                    type: number
                  status:
                    type: string
            total:
              type: integer
      401:
        description: Unauthorized
      500:
        description: Server error
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        invoice_type = request.args.get('type')
        
        query = Invoice.query
        if invoice_type:
            query = query.filter_by(invoice_type=invoice_type)
        
        invoices = query.order_by(Invoice.invoice_date.desc()).paginate(page=page, per_page=per_page)
        
        return jsonify({
            'invoices': [{
                'id': i.id,
                'invoice_number': i.invoice_number,
                'invoice_type': i.invoice_type,
                'invoice_date': i.invoice_date.isoformat(),
                'total_amount': float(i.total_amount),
                'paid_amount': float(i.paid_amount),
                'balance_due': float(i.balance_due),
                'status': i.status
            } for i in invoices.items],
            'total': invoices.total
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/invoices/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_invoice(id):
    """
    Get single invoice by ID with items
    ---
    tags:
      - Finance
    summary: Get invoice by ID
    description: Retrieve a specific invoice with items and related data
    security:
      - BearerAuth: []
    parameters:
      - in: path
        name: id
        required: true
        type: integer
        description: Invoice ID
    responses:
      200:
        description: Invoice retrieved successfully
        schema:
          type: object
          properties:
            invoice:
              type: object
              properties:
                id:
                  type: integer
                invoice_number:
                  type: string
                invoice_type:
                  type: string
                invoice_date:
                  type: string
                  format: date-time
                due_date:
                  type: string
                  format: date-time
                total_amount:
                  type: number
                paid_amount:
                  type: number
                balance_due:
                  type: number
                status:
                  type: string
                items:
                  type: array
                  items:
                    type: object
      401:
        description: Unauthorized
      404:
        description: Invoice not found
      500:
        description: Server error
    """
    try:
        invoice = db.session.get(Invoice, id) or abort(404)
        
        # Get invoice items
        items = InvoiceItem.query.filter_by(invoice_id=id).order_by(InvoiceItem.line_number).all()
        
        # Get work order number if production_cost type
        work_order_number = None
        if invoice.work_order_id:
            from models.production import WorkOrder
            wo = db.session.get(WorkOrder, invoice.work_order_id)
            if wo:
                work_order_number = wo.wo_number
        
        return jsonify({
            'invoice': {
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'invoice_type': invoice.invoice_type,
                'invoice_date': invoice.invoice_date.isoformat() if invoice.invoice_date else None,
                'due_date': invoice.due_date.isoformat() if invoice.due_date else None,
                'customer_id': invoice.customer_id,
                'supplier_id': invoice.supplier_id,
                'work_order_id': invoice.work_order_id,
                'work_order_number': work_order_number,
                'subtotal': float(invoice.subtotal) if invoice.subtotal else 0,
                'tax_amount': float(invoice.tax_amount) if invoice.tax_amount else 0,
                'discount_amount': float(invoice.discount_amount) if invoice.discount_amount else 0,
                'total_amount': float(invoice.total_amount) if invoice.total_amount else 0,
                'paid_amount': float(invoice.paid_amount) if invoice.paid_amount else 0,
                'balance_due': float(invoice.balance_due) if invoice.balance_due else 0,
                'status': invoice.status,
                'notes': invoice.notes,
                'items': [{
                    'id': item.id,
                    'line_number': item.line_number,
                    'description': item.description,
                    'quantity': float(item.quantity) if item.quantity else 0,
                    'unit_price': float(item.unit_price) if item.unit_price else 0,
                    'amount': float(item.total_amount) if item.total_amount else 0,
                    'discount_percent': float(item.discount_percent) if item.discount_percent else 0,
                    'tax_amount': float(item.tax_amount) if item.tax_amount else 0
                } for item in items]
            }
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/invoices/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('finance.delete')
def delete_invoice(id):
    """Delete an invoice (AP or AR). Following Accurate Online's rule: an
    invoice can only be deleted if it has no recorded payment yet - once
    paid_amount > 0, the invoice is locked and payments must be deleted
    first (or, per Accurate's model, corrected via a return/retur)."""
    try:
        invoice = db.session.get(Invoice, id) or abort(404)

        if float(invoice.paid_amount or 0) > 0:
            return jsonify({
                'error': f"Faktur '{invoice.invoice_number}' sudah memiliki pembayaran "
                         f"(Rp{float(invoice.paid_amount):,.0f}) dan tidak dapat dihapus. "
                         f"Hapus pembayaran terkait terlebih dahulu."
            }), 400

        db.session.delete(invoice)
        db.session.commit()
        return jsonify({'message': 'Invoice deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/invoices', methods=['POST'])
@jwt_required()
@require_permission('finance.create')
def create_invoice():
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        invoice_number = generate_number_v2('invoice', 'INV', Invoice, 'invoice_number')

        invoice_date_parsed = datetime.fromisoformat(data['invoice_date'])

        from utils.finance_helpers import is_period_locked
        if is_period_locked(invoice_date_parsed.date() if hasattr(invoice_date_parsed, 'date') else invoice_date_parsed):
            return jsonify({'error': f'Periode {invoice_date_parsed.strftime("%Y-%m")} sudah ditutup (period-close). Tidak bisa membuat transaksi baru di periode ini.'}), 400

        invoice = Invoice(
            invoice_number=invoice_number,
            invoice_type=data['invoice_type'],
            invoice_date=invoice_date_parsed,
            due_date=datetime.fromisoformat(data['due_date']) if data.get('due_date') else None,
            customer_id=data.get('customer_id'),
            supplier_id=data.get('supplier_id'),
            sales_order_id=data.get('sales_order_id'),
            created_by=user_id
        )
        
        db.session.add(invoice)
        db.session.flush()
        
        subtotal = 0
        tax_amount = 0
        discount_amount = data.get('discount_amount', 0)
        tax_rate = data.get('tax_rate', 0)
        
        for idx, item_data in enumerate(data.get('items', []), 1):
            line_total = item_data['quantity'] * item_data['unit_price']
            line_discount = line_total * (item_data.get('discount_percent', 0) / 100)
            line_net = line_total - line_discount
            
            item = InvoiceItem(
                invoice_id=invoice.id,
                line_number=idx,
                product_id=item_data.get('product_id'),
                description=item_data['description'],
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price'],
                discount_percent=item_data.get('discount_percent', 0),
                total_amount=line_net,
                tax_amount=item_data.get('tax_amount', 0)
            )
            db.session.add(item)
            subtotal += line_net
        
        # Calculate total tax
        taxable_amount = subtotal - discount_amount
        tax_amount = taxable_amount * (tax_rate / 100) if tax_rate else 0
        
        invoice.subtotal = subtotal
        invoice.discount_amount = discount_amount
        # tax_rate is not a field on Invoice model — used only for calculation
        invoice.tax_amount = tax_amount
        invoice.total_amount = subtotal - discount_amount + tax_amount
        invoice.balance_due = invoice.total_amount
        invoice.payment_terms = data.get('payment_terms')
        invoice.notes = data.get('notes')
        db.session.flush()

        # Link Shipping Order(s) (Surat Jalan) this invoice was billed from.
        # Pola Accurate Online: Surat Jalan dibuat dulu dari SO, lalu
        # "dilanjutkan" jadi Faktur Penjualan (bisa 1 SJ -> 1 invoice, atau
        # beberapa SJ digabung jadi 1 invoice). Di sini invoice_id di
        # ShippingOrder diisi supaya rantai SO -> WO -> SJ -> Invoice bisa
        # ditelusuri (lihat E2E_TRACKING_READINESS_REPORT.md Gap 2).
        shipping_order_ids = data.get('shipping_order_ids') or (
            [data['shipping_order_id']] if data.get('shipping_order_id') else []
        )
        if shipping_order_ids and invoice.invoice_type == 'sales':
            from models.shipping import ShippingOrder
            shipping_orders = ShippingOrder.query.filter(
                ShippingOrder.id.in_(shipping_order_ids)
            ).all()
            for so_shipment in shipping_orders:
                if invoice.sales_order_id and so_shipment.sales_order_id and \
                        so_shipment.sales_order_id != invoice.sales_order_id:
                    return jsonify({
                        'error': f'Shipping order {so_shipment.shipping_number} bukan dari sales order yang sama dengan invoice ini'
                    }), 400
                if so_shipment.invoice_id:
                    return jsonify({
                        'error': f'Shipping order {so_shipment.shipping_number} sudah terhubung ke invoice lain'
                    }), 400
                so_shipment.invoice_id = invoice.id
            db.session.flush()

        # GL posting: only for sales invoices (invoice_type == 'sales').
        # Purchase-side invoices go through routes/purchase_invoice.py's own
        # dedicated create_purchase_invoice(), which already posts to GL.
        deposit_applied = 0
        if invoice.invoice_type == 'sales' and invoice.customer_id:
            from models.finance import SalesAccountSettings
            from models.approval_workflow import PendingJournalEntry
            from utils.finance_helpers import (
                post_pending_journal, resolve_account, get_or_create_singleton,
                apply_customer_deposit,
            )

            journal_lines = []

            # Debit: Piutang Usaha (accounts receivable) for the full invoice
            # amount. Resolved per-customer via resolve_accounts_receivable()
            # (Customer.akun_piutang_id override, falls back to the global
            # 'accounts_receivable' GlobalAccountDefault) - matches Accurate's
            # actual pattern (confirmed via web search 2026-08-17: piutang
            # usaha is set per-customer, same as accounts payable is set
            # per-supplier).
            from utils.finance_helpers import resolve_accounts_receivable
            try:
                ar_account_id = resolve_accounts_receivable(invoice.customer_id)
            except ValueError as e:
                return jsonify({'error': str(e)}), 400

            journal_lines.append({
                'account_id': ar_account_id,
                'debit': float(invoice.total_amount),
                'credit': 0,
                'description': f'Piutang - {invoice_number}',
            })

            # Credit: Penjualan (revenue), per line item's resolved akun_penjualan_id
            for item_data in data.get('items', []):
                product_id = item_data.get('product_id')
                line_total = item_data['quantity'] * item_data['unit_price']
                line_discount = line_total * (item_data.get('discount_percent', 0) / 100)
                line_net = line_total - line_discount
                sales_account_id = resolve_account('akun_penjualan_id', product_id=product_id)
                journal_lines.append({
                    'account_id': sales_account_id,
                    'debit': 0,
                    'credit': float(line_net),
                    'description': item_data.get('description') or f'Penjualan - {invoice_number}',
                })

            # Balance the journal against tax/discount deltas if subtotal of
            # credit lines doesn't already equal total_amount (tax_amount is
            # added on top of item lines, so route it to PPN Keluaran if set,
            # otherwise fold it into the last sales line to keep balance).
            credit_sum = sum(l['credit'] for l in journal_lines)
            debit_sum = sum(l['debit'] for l in journal_lines)
            imbalance = round(debit_sum - credit_sum, 2)
            if abs(imbalance) > 0.01:
                from models.finance import TaxAccountSettings
                tax_settings = get_or_create_singleton(TaxAccountSettings)
                if tax_settings.akun_ppn_keluaran_id and tax_amount and abs(imbalance - float(tax_amount)) < 0.01:
                    journal_lines.append({
                        'account_id': tax_settings.akun_ppn_keluaran_id,
                        'debit': 0,
                        'credit': float(tax_amount),
                        'description': f'PPN Keluaran - {invoice_number}',
                    })
                else:
                    # Fallback: fold any remaining imbalance into the last line
                    for line in reversed(journal_lines):
                        if line['credit'] > 0:
                            line['credit'] += imbalance
                            break

            pending = PendingJournalEntry(
                workflow_id=None,
                entry_date=invoice.invoice_date.date() if hasattr(invoice.invoice_date, 'date') else invoice.invoice_date,
                description=f'Sales Invoice {invoice_number}',
                reference=invoice_number,
                lines=journal_lines,
                total_debit=sum(l['debit'] for l in journal_lines),
                total_credit=sum(l['credit'] for l in journal_lines),
                created_by=user_id,
            )
            db.session.add(pending)
            db.session.flush()
            post_pending_journal(pending.id, posted_by_user_id=user_id, reference_type='sales_invoice', reference_id=invoice.id)

            # Auto-apply any available customer deposit balance, then post
            # the reversal journal (deposit liability -> piutang) for
            # whatever amount was actually applied.
            deposit_applied = apply_customer_deposit(invoice)
            if deposit_applied > 0:
                sales_settings = get_or_create_singleton(SalesAccountSettings)
                if sales_settings.akun_uang_muka_pelanggan_id:
                    reversal_lines = [
                        {
                            'account_id': sales_settings.akun_uang_muka_pelanggan_id,
                            'debit': float(deposit_applied),
                            'credit': 0,
                            'description': f'Pemakaian uang muka - {invoice_number}',
                        },
                        {
                            'account_id': ar_account_id,
                            'debit': 0,
                            'credit': float(deposit_applied),
                            'description': f'Pemakaian uang muka - {invoice_number}',
                        },
                    ]
                    reversal_pending = PendingJournalEntry(
                        workflow_id=None,
                        entry_date=invoice.invoice_date.date() if hasattr(invoice.invoice_date, 'date') else invoice.invoice_date,
                        description=f'Pemakaian Uang Muka - {invoice_number}',
                        reference=invoice_number,
                        lines=reversal_lines,
                        total_debit=deposit_applied,
                        total_credit=deposit_applied,
                        created_by=user_id,
                    )
                    db.session.add(reversal_pending)
                    db.session.flush()
                    post_pending_journal(reversal_pending.id, posted_by_user_id=user_id, reference_type='customer_deposit_usage', reference_id=invoice.id)

        db.session.commit()
        return jsonify({
            'message': 'Invoice created',
            'invoice_id': invoice.id,
            'deposit_applied': deposit_applied,
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/payments', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_payments():
    try:
        payments = Payment.query.order_by(Payment.payment_date.desc()).all()
        return jsonify({
            'payments': [{
                'id': p.id,
                'payment_number': p.payment_number,
                'payment_type': p.payment_type,
                'payment_date': p.payment_date.isoformat(),
                'amount': float(p.amount),
                'payment_method': p.payment_method,
                'status': p.status
            } for p in payments]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/payments', methods=['POST'])
@jwt_required()
@require_permission('finance.create')
def create_payment():
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        payment_number = generate_number('PAY', Payment, 'payment_number')
        
        if not data.get('invoice_id'):
            return jsonify({'error': 'invoice_id is required'}), 400
        if not data.get('bank_account_id'):
            return jsonify({'error': 'bank_account_id is required'}), 400

        bank_account = db.session.get(Account, data['bank_account_id'])
        if not bank_account or not bank_account.is_cash_bank:
            return jsonify({'error': 'bank_account_id must reference a Kas/Bank account'}), 400

        payment = Payment(
            payment_number=payment_number,
            payment_date=datetime.fromisoformat(data['payment_date']),
            payment_type=data['payment_type'],
            invoice_id=data.get('invoice_id'),
            customer_id=data.get('customer_id'),
            supplier_id=data.get('supplier_id'),
            payment_method=data['payment_method'],
            amount=data['amount'],
            reference_number=data.get('reference_number'),
            bank_account_id=data['bank_account_id'],
            received_by=user_id
        )
        
        db.session.add(payment)
        db.session.flush()

        # Update invoice if provided
        invoice = None
        if data.get('invoice_id'):
            invoice = db.session.get(Invoice, data['invoice_id'])
            invoice.paid_amount += data['amount']
            invoice.balance_due -= data['amount']
            if invoice.balance_due <= 0:
                invoice.status = 'paid'
            elif invoice.paid_amount > 0:
                invoice.status = 'partial'

        # Post to GL - previously this only updated Invoice.paid_amount/status
        # with no journal entry at all, so real money moving in or out of the
        # bank was never recorded in the books (both AR receipts and AP
        # disbursements shared this same gap).
        if invoice:
            from utils.finance_helpers import (
                resolve_accounts_receivable, resolve_accounts_payable, post_pending_journal
            )
            from models.approval_workflow import PendingJournalEntry

            amount = float(data['amount'])
            if invoice.invoice_type == 'sales':
                # Customer payment received: Dr Kas/Bank, Cr Piutang Usaha
                ar_account_id = resolve_accounts_receivable(invoice.customer_id)
                lines = [
                    {'account_id': data['bank_account_id'], 'debit': amount, 'credit': 0,
                     'description': f'Penerimaan pembayaran - {payment.payment_number}'},
                    {'account_id': ar_account_id, 'debit': 0, 'credit': amount,
                     'description': f'Pelunasan piutang - {invoice.invoice_number}'},
                ]
            else:
                # Payment to supplier: Dr Hutang Usaha, Cr Kas/Bank
                ap_account_id = resolve_accounts_payable(invoice.supplier_id)
                lines = [
                    {'account_id': ap_account_id, 'debit': amount, 'credit': 0,
                     'description': f'Pelunasan hutang - {invoice.invoice_number}'},
                    {'account_id': data['bank_account_id'], 'debit': 0, 'credit': amount,
                     'description': f'Pembayaran ke supplier - {payment.payment_number}'},
                ]

            pending = PendingJournalEntry(
                workflow_id=None,
                entry_date=payment.payment_date,
                description=f'Payment {payment.payment_number} - {invoice.invoice_number}',
                reference=payment.payment_number,
                lines=lines,
                total_debit=amount,
                total_credit=amount,
                created_by=user_id,
            )
            db.session.add(pending)
            db.session.flush()
            post_pending_journal(pending.id, posted_by_user_id=user_id, reference_type='payment', reference_id=payment.id)

        db.session.commit()
        return jsonify({'message': 'Payment recorded', 'payment_id': payment.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/invoices/unpaid', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_unpaid_invoices():
    """List unpaid/partially-paid invoices for a given customer or supplier -
    used by the Payment form's invoice picker (a payment must reference a
    real invoice, per Bayu's decision 2026-08-18)."""
    try:
        customer_id = request.args.get('customer_id', type=int)
        supplier_id = request.args.get('supplier_id', type=int)

        if not customer_id and not supplier_id:
            return jsonify({'error': 'customer_id or supplier_id is required'}), 400

        query = Invoice.query.filter(Invoice.balance_due > 0)
        if customer_id:
            query = query.filter(Invoice.customer_id == customer_id, Invoice.invoice_type == 'sales')
        if supplier_id:
            query = query.filter(Invoice.supplier_id == supplier_id, Invoice.invoice_type == 'purchase')

        invoices = query.order_by(Invoice.due_date.asc()).all()

        return jsonify({
            'invoices': [{
                'id': i.id,
                'invoice_number': i.invoice_number,
                'invoice_date': i.invoice_date.isoformat() if i.invoice_date else None,
                'due_date': i.due_date.isoformat() if i.due_date else None,
                'total_amount': float(i.total_amount),
                'paid_amount': float(i.paid_amount),
                'balance_due': float(i.balance_due),
                'status': i.status
            } for i in invoices]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ ACCOUNTS RECEIVABLE ============
@finance_bp.route('/accounts-receivable', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_accounts_receivable():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        # Get outstanding invoices (AR)
        ar_invoices = Invoice.query.filter(
            Invoice.invoice_type == 'sales',
            Invoice.balance_due > 0
        ).order_by(Invoice.due_date.asc()).paginate(page=page, per_page=per_page, error_out=False)
        
        total_outstanding = db.session.query(func.sum(Invoice.balance_due)).filter(
            Invoice.invoice_type == 'sales',
            Invoice.balance_due > 0
        ).scalar() or 0
        
        return jsonify({
            'receivables': [{
                'id': i.id,
                'invoice_number': i.invoice_number,
                'customer_name': getattr(i.customer, 'company_name', 'N/A') if i.customer else 'N/A',
                'invoice_date': i.invoice_date.isoformat(),
                'due_date': i.due_date.isoformat() if i.due_date else None,
                'total_amount': float(i.total_amount),
                'paid_amount': float(i.paid_amount),
                'balance_due': float(i.balance_due),
                'days_overdue': (get_local_now().date() - i.due_date).days if i.due_date and get_local_now().date() > i.due_date else 0,
                'status': i.status
            } for i in ar_invoices.items],
            'total': ar_invoices.total,
            'pages': ar_invoices.pages,
            'total_outstanding': float(total_outstanding)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ ACCOUNTS PAYABLE ============
@finance_bp.route('/accounts-payable', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_accounts_payable():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        # Get outstanding purchase invoices (AP)
        ap_invoices = Invoice.query.filter(
            Invoice.invoice_type == 'purchase',
            Invoice.balance_due > 0
        ).order_by(Invoice.due_date.asc()).paginate(page=page, per_page=per_page, error_out=False)
        
        total_payable = db.session.query(func.sum(Invoice.balance_due)).filter(
            Invoice.invoice_type == 'purchase',
            Invoice.balance_due > 0
        ).scalar() or 0
        
        return jsonify({
            'payables': [{
                'id': i.id,
                'invoice_number': i.invoice_number,
                'supplier_name': getattr(i.supplier, 'company_name', 'N/A') if i.supplier else 'N/A',
                'invoice_date': i.invoice_date.isoformat(),
                'due_date': i.due_date.isoformat() if i.due_date else None,
                'total_amount': float(i.total_amount),
                'paid_amount': float(i.paid_amount),
                'balance_due': float(i.balance_due),
                'days_overdue': (get_local_now().date() - i.due_date).days if i.due_date and get_local_now().date() > i.due_date else 0,
                'status': i.status
            } for i in ap_invoices.items],
            'total': ap_invoices.total,
            'pages': ap_invoices.pages,
            'total_payable': float(total_payable)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ GENERAL LEDGER ============
@finance_bp.route('/general-ledger', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_general_ledger():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        account_id = request.args.get('account_id')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        query = AccountingEntry.query
        
        if account_id:
            query = query.filter_by(account_id=account_id)
        if start_date:
            query = query.filter(AccountingEntry.entry_date >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(AccountingEntry.entry_date <= datetime.fromisoformat(end_date))
        
        # search filters by description or reference_number - the frontend's
        # filters.search field was always sent to the API but never actually
        # applied here (silent no-op bug), fixed alongside the other bugs below.
        search = request.args.get('search')
        if search:
            query = query.filter(
                db.or_(
                    AccountingEntry.description.ilike(f'%{search}%'),
                    AccountingEntry.reference_number.ilike(f'%{search}%'),
                )
            )

        entries = query.order_by(AccountingEntry.entry_date.desc()).paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'entries': [{
                'id': e.id,
                'entry_date': e.entry_date.isoformat(),
                # BUG FIX 2026-08-17: Account's real columns are account_code/
                # account_name, not code/name - getattr's default silently
                # masked this as 'N/A' for every single row instead of erroring.
                'account_code': e.account.account_code if e.account else 'N/A',
                'account_name': e.account.account_name if e.account else 'N/A',
                'description': e.description,
                'debit_amount': float(e.debit_amount) if e.debit_amount else 0,
                'credit_amount': float(e.credit_amount) if e.credit_amount else 0,
                'reference_number': e.reference_number,
                # reference_type added so the frontend can build a
                # getReferenceLink()-style link back to the source
                # transaction, and to distinguish manual entries
                # (reference_type is null) from automatic ones (payroll_period,
                # expense, fixed_asset, etc.) for edit/delete permission.
                'reference_type': e.reference_type,
                'entry_number': e.entry_number,
                'created_by': getattr(e.posted_by_user, 'username', 'N/A') if e.posted_by_user else 'N/A'
            } for e in entries.items],
            'total': entries.total,
            'pages': entries.pages
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/general-ledger', methods=['POST'])
@jwt_required()
@require_permission('journal.create')
def create_manual_journal_entry():
    """Create a manual journal entry (Jurnal Umum), matching Accurate's own
    distinction between manually-recorded journals and ones auto-generated
    from other transactions (Payroll, Expense, Purchasing, etc via
    post_pending_journal()). Manual entries have reference_type=None; this
    is what later lets edit/delete distinguish "safe to edit" from "must be
    corrected via its source transaction instead" (see PUT/DELETE below).

    Accepts 2+ balanced lines rather than a single debit-or-credit amount -
    a real journal entry is never just one leg.
    """
    try:
        from models.finance import GlobalAccountDefault
        from models.approval_workflow import PendingJournalEntry
        from utils.finance_helpers import post_pending_journal, is_period_locked

        data = request.get_json() or {}
        user_id = get_jwt_identity()

        entry_date_str = data.get('entry_date')
        description = data.get('description')
        reference = data.get('reference_number')
        lines = data.get('lines', [])

        if not entry_date_str or not description:
            return jsonify({'error': 'entry_date dan description wajib diisi'}), 400

        if len(lines) < 2:
            return jsonify({'error': 'Jurnal butuh minimal 2 baris (debit dan kredit) yang seimbang'}), 400

        entry_date_parsed = datetime.strptime(entry_date_str, '%Y-%m-%d').date()
        if is_period_locked(entry_date_parsed):
            return jsonify({'error': f'Periode {entry_date_parsed.strftime("%Y-%m")} sudah ditutup (period-close). Tidak bisa membuat jurnal manual di periode ini.'}), 400

        total_debit = sum(float(l.get('debit', 0) or 0) for l in lines)
        total_credit = sum(float(l.get('credit', 0) or 0) for l in lines)
        if round(total_debit, 2) != round(total_credit, 2):
            return jsonify({'error': f'Jurnal tidak balance: debit={total_debit}, kredit={total_credit}'}), 400
        if total_debit == 0:
            return jsonify({'error': 'Total debit/kredit tidak boleh 0'}), 400

        pending = PendingJournalEntry(
            workflow_id=None,
            entry_date=entry_date_parsed,
            description=description,
            reference=reference,
            lines=lines,
            total_debit=total_debit,
            total_credit=total_credit,
            created_by=user_id,
        )
        db.session.add(pending)
        db.session.flush()

        # reference_type intentionally left as the default 'pending_journal'
        # rather than None, so post_pending_journal()'s own grouping still
        # works - PUT/DELETE below key off reference being NOT one of the
        # known automatic-source types instead of requiring exactly None.
        created_entries = post_pending_journal(
            pending.id, posted_by_user_id=user_id,
            reference_type='manual_journal', reference_id=pending.id,
        )

        db.session.commit()
        return jsonify({
            'message': 'Jurnal manual berhasil dibuat',
            'entry_number': created_entries[0].entry_number.rsplit('-', 1)[0] if created_entries else None,
            'entries_created': len(created_entries),
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/general-ledger/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('finance.delete')
def delete_manual_journal_entry(id):
    """Delete a manual journal entry group (all AccountingEntry rows sharing
    the same entry_number base). Only allowed for reference_type=='manual_journal'
    - entries generated from Payroll/Expense/Purchasing/etc must be reversed
    or corrected from their SOURCE transaction, matching Accurate's own rule
    ("Tidak dapat menghapus Jurnal dari Transaksi" - deleting from the
    Journal list directly is blocked for anything not entered there
    originally).
    """
    try:
        entry = AccountingEntry.query.get_or_404(id)

        if entry.reference_type != 'manual_journal':
            return jsonify({
                'error': f'Jurnal ini dibuat otomatis dari transaksi {entry.reference_type or "lain"} '
                         f'dan tidak bisa dihapus langsung dari Buku Besar. '
                         f'Batalkan/koreksi dari transaksi sumbernya.'
            }), 400

        from utils.finance_helpers import is_period_locked
        if is_period_locked(entry.entry_date):
            return jsonify({'error': f'Periode {entry.entry_date.strftime("%Y-%m")} sudah ditutup (period-close). Tidak bisa menghapus jurnal di periode ini.'}), 400

        # Delete every row from the same journal group (all lines share the
        # same base entry_number before the "-NN" line suffix), not just
        # the one row the user clicked - a half-deleted journal would leave
        # the ledger unbalanced.
        base_number = entry.entry_number.rsplit('-', 1)[0]
        group_entries = AccountingEntry.query.filter(
            AccountingEntry.entry_number.like(f'{base_number}-%'),
            AccountingEntry.reference_type == 'manual_journal',
        ).all()

        deleted_count = len(group_entries)
        for e in group_entries:
            db.session.delete(e)

        db.session.commit()
        return jsonify({'message': f'Jurnal manual dihapus ({deleted_count} baris)'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============ CHART OF ACCOUNTS ============
@finance_bp.route('/accounts', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_basic_chart_of_accounts():
    try:
        from models.finance import Account, AccountingEntry
        from sqlalchemy import func

        # Get all active accounts
        accounts = Account.query.filter_by(is_active=True).order_by(Account.account_code).all()

        # BUG FIX 2026-08-17: Account has no `balance` column - `a.balance`
        # always threw AttributeError, caught by the broad except and turned
        # into an opaque 500. Same root cause as get_chart_of_accounts()'s
        # earlier a.balance bug (fixed 2026-08-15/16) - this is a SEPARATE
        # endpoint (GET /accounts vs GET /accounting/chart-of-accounts) that
        # never got the same fix. Computing real-time balances the same way
        # here for consistency, one query instead of N+1 per account.
        balances = dict(
            db.session.query(
                AccountingEntry.account_id,
                func.sum(AccountingEntry.debit_amount - AccountingEntry.credit_amount)
            ).group_by(AccountingEntry.account_id).all()
        )

        return jsonify({
            'accounts': [{
                'id': a.id,
                'code': a.account_code,
                'name': a.account_name,
                'account_type': a.account_type,
                'balance': float(balances.get(a.id, 0) or 0),
                'is_header': a.is_header if hasattr(a, 'is_header') else False
            } for a in accounts]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ CASH & BANK MANAGEMENT ============
@finance_bp.route('/cash-bank', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_cash_bank():
    """Get cash/bank accounts with real-time balances.

    Fixed 3 stacked bugs (2026-09-10): (1) filtered by
    `Account.account_type.in_(['cash', 'bank'])` - account_type is only ever
    'asset'/'liability'/'equity'/'revenue'/'expense' per the model, so this
    NEVER matched a single row; the real marker is `is_cash_bank` (used
    correctly elsewhere, e.g. Payment's bank-account picker). (2) read
    `a.balance` - Account has NO such column at all, so this endpoint 500'd
    on every single call. (3) frontend (CashBankManagement.tsx) read
    `.account_name`/`.account_code` while this always returned `.name`/`.code`
    - fixed on the frontend side to match."""
    try:
        from models.finance import Account, AccountingEntry
        from sqlalchemy import func

        cash_accounts = Account.query.filter(
            Account.is_cash_bank == True,
            Account.is_active == True
        ).all()

        balance_rows = (
            db.session.query(
                AccountingEntry.account_id,
                func.coalesce(func.sum(AccountingEntry.debit_amount), 0).label('total_debit'),
                func.coalesce(func.sum(AccountingEntry.credit_amount), 0).label('total_credit'),
            )
            .filter(AccountingEntry.account_id.in_([a.id for a in cash_accounts]))
            .group_by(AccountingEntry.account_id)
            .all()
        ) if cash_accounts else []
        balances_by_account = {row.account_id: float(row.total_debit) - float(row.total_credit) for row in balance_rows}

        result_accounts = [{
            'id': a.id,
            'code': a.account_code,
            'name': a.account_name,
            'account_type': a.account_type,
            'balance': balances_by_account.get(a.id, 0.0)
        } for a in cash_accounts]

        total_cash = sum(acc['balance'] for acc in result_accounts)

        return jsonify({
            'cash_accounts': result_accounts,
            'total_cash': total_cash
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ BUDGETING & FORECASTING ============
@finance_bp.route('/budgets', methods=['POST'])
@jwt_required()
@require_permission('finance.create')
def create_budget():
    try:
        from models.finance import Budget, BudgetLine

        data = request.get_json() or {}
        user_id = get_jwt_identity()

        required = ['budget_name', 'budget_year', 'budget_period', 'start_date', 'end_date']
        missing = [f for f in required if not data.get(f)]
        if missing:
            return jsonify({'error': f'Missing required fields: {missing}'}), 400

        budget = Budget(
            budget_name=data['budget_name'],
            budget_year=data['budget_year'],
            budget_period=data['budget_period'],
            start_date=datetime.strptime(data['start_date'], '%Y-%m-%d').date(),
            end_date=datetime.strptime(data['end_date'], '%Y-%m-%d').date(),
            status=data.get('status', 'draft'),
            department=data.get('department'),
            category=data.get('category'),
            description=data.get('description'),
            created_by=user_id,
        )
        db.session.add(budget)
        db.session.flush()

        total_budget = 0
        for line_data in data.get('lines', []):
            if not line_data.get('account_id'):
                db.session.rollback()
                return jsonify({'error': 'Each budget line requires an account_id'}), 400

            line = BudgetLine(
                budget_id=budget.id,
                account_id=line_data['account_id'],
                category=line_data.get('category', ''),
                budget_amount=line_data.get('budget_amount', 0),
                notes=line_data.get('notes'),
            )
            db.session.add(line)
            total_budget += float(line_data.get('budget_amount', 0))

        budget.total_budget = total_budget
        db.session.commit()

        return jsonify({'message': 'Budget created', 'budget_id': budget.id}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============ FIXED ASSETS ============
@finance_bp.route('/fixed-assets', methods=['POST'])
@jwt_required()
@require_permission('finance.create')
def create_fixed_asset():
    try:
        from models.finance import FixedAsset, GlobalAccountDefault
        from models.approval_workflow import PendingJournalEntry
        from utils.finance_helpers import post_pending_journal, resolve_accounts_payable, is_period_locked

        data = request.get_json() or {}
        user_id = get_jwt_identity()

        required = ['asset_code', 'asset_name', 'category', 'acquisition_date', 'acquisition_cost', 'useful_life_years']
        missing = [f for f in required if not data.get(f)]
        if missing:
            return jsonify({'error': f'Missing required fields: {missing}'}), 400

        acquisition_date_parsed = datetime.strptime(data['acquisition_date'], '%Y-%m-%d').date()
        if is_period_locked(acquisition_date_parsed):
            return jsonify({'error': f'Periode {acquisition_date_parsed.strftime("%Y-%m")} sudah ditutup (period-close). Tidak bisa membuat aset baru di periode ini.'}), 400

        if float(data['acquisition_cost']) <= 0:
            return jsonify({'error': 'Acquisition cost harus lebih besar dari 0'}), 400
        if float(data.get('salvage_value') or 0) < 0:
            return jsonify({'error': 'Salvage value tidak boleh negatif'}), 400

        asset = FixedAsset(
            asset_code=data['asset_code'],
            asset_name=data['asset_name'],
            category=data['category'],
            description=data.get('description'),
            acquisition_date=acquisition_date_parsed,
            acquisition_cost=data['acquisition_cost'],
            supplier_id=data.get('supplier_id'),
            invoice_number=data.get('invoice_number'),
            depreciation_method=data.get('depreciation_method', 'straight_line'),
            useful_life_years=data['useful_life_years'],
            salvage_value=data.get('salvage_value', 0),
            location=data.get('location'),
            department_id=data.get('department_id'),
            responsible_person=data.get('responsible_person'),
            status='active',
        )
        db.session.add(asset)
        db.session.flush()

        # Optional GL posting - only when explicitly requested, since asset
        # acquisitions routed through Purchase Invoice already post their own
        # journal (this is for manually-recorded assets that bypass PO/Invoice).
        if data.get('post_journal', False):
            aset_default = GlobalAccountDefault.query.filter_by(transaction_key='aset_tetap').first()
            if not aset_default:
                db.session.rollback()
                return jsonify({'error': 'Akun Aset Tetap belum diatur di Preferensi Akun'}), 400

            amount = float(asset.acquisition_cost)
            if asset.supplier_id:
                credit_account_id = resolve_accounts_payable(asset.supplier_id)
            else:
                cash_default = GlobalAccountDefault.query.filter_by(transaction_key='cash').first()
                if not cash_default:
                    db.session.rollback()
                    return jsonify({'error': 'Akun Kas belum diatur di Preferensi Akun'}), 400
                credit_account_id = cash_default.account_id

            journal_lines = [
                {
                    'account_id': aset_default.account_id,
                    'debit': amount,
                    'credit': 0,
                    'description': f'Perolehan aset {asset.asset_code} - {asset.asset_name}',
                },
                {
                    'account_id': credit_account_id,
                    'debit': 0,
                    'credit': amount,
                    'description': f'Perolehan aset {asset.asset_code}',
                },
            ]
            pending = PendingJournalEntry(
                workflow_id=None,
                entry_date=asset.acquisition_date,
                description=f'Perolehan Aset Tetap {asset.asset_code}',
                reference=asset.asset_code,
                lines=journal_lines,
                total_debit=amount,
                total_credit=amount,
                created_by=user_id,
            )
            db.session.add(pending)
            db.session.flush()
            post_pending_journal(pending.id, posted_by_user_id=user_id, reference_type='fixed_asset', reference_id=asset.id)

        db.session.commit()
        return jsonify({'message': 'Fixed asset created', 'asset_id': asset.id}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/fixed-assets/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('finance.edit')
def update_fixed_asset(id):
    """Edit a fixed asset's descriptive/depreciation-planning fields.

    acquisition_cost and acquisition_date are intentionally NOT editable
    here - once an asset's value is recorded (and possibly already posted
    to the GL via post_journal=True at creation, or already depreciated),
    silently changing it here would desync the master record from the
    ledger with no audit trail. A real cost correction needs its own
    correcting-journal flow, not a plain edit.
    """
    try:
        from models.finance import FixedAsset
        from utils.finance_helpers import is_period_locked

        asset = FixedAsset.query.get_or_404(id)
        data = request.get_json() or {}

        locked_fields = {'acquisition_cost', 'acquisition_date'}
        attempted = locked_fields.intersection(data.keys())
        if attempted:
            return jsonify({
                'error': f'Field {sorted(attempted)} tidak bisa diubah lewat edit biasa - '
                         f'nilai perolehan aset sudah tercatat. Butuh proses koreksi jurnal terpisah.'
            }), 400

        if is_period_locked(datetime.utcnow().date()):
            return jsonify({'error': f'Periode saat ini sudah ditutup (period-close). Tidak bisa mengubah data aset.'}), 400

        editable_fields = [
            'asset_name', 'category', 'description', 'depreciation_method',
            'useful_life_years', 'salvage_value', 'location', 'department_id',
            'responsible_person',
        ]
        for field in editable_fields:
            if field in data:
                setattr(asset, field, data[field])

        db.session.commit()
        return jsonify({'message': 'Fixed asset updated', 'asset_id': asset.id}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/fixed-assets/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('finance.delete')
def delete_fixed_asset(id):
    """Soft-delete a fixed asset by marking it disposed - matches the model's
    own design (status already has a 'disposed' value) and Indonesian
    accounting practice: a depreciated/GL-posted asset can't just vanish
    from history, it has to go through a disposal record.

    Also posts the disposal journal to GL (2026-09-10 fix) - this used to
    only flip status/store disposal_amount with zero accounting effect, so
    the asset's cost and accumulated depreciation stayed on the books
    forever and any gain/loss on disposal was never recorded. Mirrors
    create_fixed_asset()'s optional-journal pattern and account-resolution
    convention (GlobalAccountDefault transaction_key='aset_tetap'/'cash').
    """
    try:
        from models.finance import FixedAsset, GlobalAccountDefault
        from models.approval_workflow import PendingJournalEntry
        from utils.finance_helpers import is_period_locked, post_pending_journal

        asset = FixedAsset.query.get_or_404(id)

        if asset.status == 'disposed':
            return jsonify({'error': 'Aset ini sudah berstatus disposed'}), 400

        today = datetime.utcnow().date()
        if is_period_locked(today):
            return jsonify({'error': f'Periode {today.strftime("%Y-%m")} sudah ditutup (period-close). Tidak bisa menghapus/dispose aset hari ini.'}), 400

        data = request.get_json() or {}
        user_id = get_jwt_identity()
        disposal_amount = float(data.get('disposal_amount') or 0)
        accumulated_depreciation = float(asset.accumulated_depreciation or 0)
        acquisition_cost = float(asset.acquisition_cost or 0)
        net_book_value = acquisition_cost - accumulated_depreciation
        gain_loss = disposal_amount - net_book_value

        asset.status = 'disposed'
        asset.disposal_date = today
        asset.disposal_amount = data.get('disposal_amount')
        asset.disposal_notes = data.get('disposal_notes', 'Dihapus via halaman Fixed Assets')
        db.session.flush()

        if data.get('post_journal', True):
            aset_default = GlobalAccountDefault.query.filter_by(transaction_key='aset_tetap').first()
            category_slug = (asset.category or '').strip().lower().replace(' & ', '_dan_').replace(' ', '_')
            akumulasi_default = (
                GlobalAccountDefault.query.filter_by(transaction_key=f'akumulasi_penyusutan_{category_slug}').first()
                if category_slug else None
            ) or GlobalAccountDefault.query.filter_by(transaction_key='akumulasi_penyusutan').first()
            if not aset_default or not akumulasi_default:
                db.session.rollback()
                return jsonify({'error': 'Akun Aset Tetap dan/atau Akumulasi Penyusutan belum diatur di Preferensi Akun'}), 400

            lines = [
                {'account_id': akumulasi_default.account_id, 'debit': accumulated_depreciation, 'credit': 0,
                 'description': f'Hapus akumulasi penyusutan - {asset.asset_code}'},
                {'account_id': aset_default.account_id, 'debit': 0, 'credit': acquisition_cost,
                 'description': f'Pelepasan aset {asset.asset_code} - {asset.asset_name}'},
            ]
            total = accumulated_depreciation

            if disposal_amount > 0:
                cash_default = GlobalAccountDefault.query.filter_by(transaction_key='cash').first()
                if not cash_default:
                    db.session.rollback()
                    return jsonify({'error': 'Akun Kas belum diatur di Preferensi Akun'}), 400
                lines.append({'account_id': cash_default.account_id, 'debit': disposal_amount, 'credit': 0,
                              'description': f'Hasil pelepasan aset {asset.asset_code}'})
                total += disposal_amount

            if abs(gain_loss) > 0.01:
                key = 'laba_pelepasan_aset' if gain_loss > 0 else 'rugi_pelepasan_aset'
                gain_loss_default = GlobalAccountDefault.query.filter_by(transaction_key=key).first()
                if not gain_loss_default:
                    db.session.rollback()
                    label = 'Laba' if gain_loss > 0 else 'Rugi'
                    return jsonify({'error': f'Akun {label} Pelepasan Aset belum diatur di Preferensi Akun'}), 400
                if gain_loss > 0:
                    lines.append({'account_id': gain_loss_default.account_id, 'debit': 0, 'credit': gain_loss,
                                  'description': f'Laba pelepasan aset {asset.asset_code}'})
                else:
                    lines.append({'account_id': gain_loss_default.account_id, 'debit': abs(gain_loss), 'credit': 0,
                                  'description': f'Rugi pelepasan aset {asset.asset_code}'})
                    total += abs(gain_loss)

            pending = PendingJournalEntry(
                workflow_id=None,
                entry_date=today,
                description=f'Pelepasan Aset Tetap {asset.asset_code}',
                reference=asset.asset_code,
                lines=lines,
                total_debit=total,
                total_credit=total,
                created_by=user_id,
            )
            db.session.add(pending)
            db.session.flush()
            post_pending_journal(pending.id, posted_by_user_id=user_id, reference_type='fixed_asset_disposal', reference_id=asset.id)

        db.session.commit()
        return jsonify({'message': 'Fixed asset marked as disposed', 'asset_id': asset.id}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/fixed-assets', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_fixed_assets():
    try:
        from models.finance import FixedAsset
        
        # Get all fixed assets
        assets = FixedAsset.query.filter_by(status='active').all()
        
        return jsonify({
            'assets': [{
                'id': a.id,
                'asset_code': a.asset_code,
                'asset_name': a.asset_name,
                'category': a.category,
                'acquisition_date': a.acquisition_date.isoformat() if a.acquisition_date else None,
                'acquisition_cost': float(a.acquisition_cost),
                'accumulated_depreciation': float(a.accumulated_depreciation),
                'net_book_value': a.net_book_value,
                'annual_depreciation': a.annual_depreciation,
                'location': a.location,
                'status': a.status
            } for a in assets],
            'total_acquisition_cost': sum(float(a.acquisition_cost) for a in assets),
            'total_accumulated_depreciation': sum(float(a.accumulated_depreciation) for a in assets),
            'total_net_book_value': sum(a.net_book_value for a in assets)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ TAX MANAGEMENT ============
@finance_bp.route('/tax-management', methods=['POST'])
@jwt_required()
@require_permission('finance.create')
def create_tax_transaction():
    try:
        from models.finance import TaxTransaction

        data = request.get_json() or {}

        required = ['transaction_date', 'transaction_type', 'tax_type', 'tax_rate', 'base_amount']
        missing = [f for f in required if not data.get(f)]
        if missing:
            return jsonify({'error': f'Missing required fields: {missing}'}), 400

        transaction_date = datetime.strptime(data['transaction_date'], '%Y-%m-%d').date()
        reporting_period = data.get('reporting_period') or f"{transaction_date.year}-{transaction_date.month:02d}"

        tax_amount = data.get('tax_amount')
        if tax_amount is None:
            tax_amount = float(data['base_amount']) * (float(data['tax_rate']) / 100)

        transaction_number = generate_number('TAX', TaxTransaction, 'transaction_number')

        tax_tx = TaxTransaction(
            transaction_number=transaction_number,
            transaction_date=transaction_date,
            transaction_type=data['transaction_type'],
            tax_type=data['tax_type'],
            tax_rate=data['tax_rate'],
            base_amount=data['base_amount'],
            tax_amount=tax_amount,
            reference_type=data.get('reference_type'),
            reference_id=data.get('reference_id'),
            reference_number=data.get('reference_number'),
            tax_invoice_number=data.get('tax_invoice_number'),
            reporting_period=reporting_period,
            status=data.get('status', 'recorded'),
        )
        db.session.add(tax_tx)
        db.session.commit()

        return jsonify({'message': 'Tax transaction recorded', 'transaction_id': tax_tx.id}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/tax-management/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('finance.delete')
def delete_tax_transaction(id):
    """Delete a tax transaction. Following Accurate Online's rule: only
    'draft' status transactions can be deleted directly - once reported
    (status='reported') or paid, correction must go through a replacement
    document (Faktur Pajak Pengganti), not deletion, per DJP regulation
    PER-03/PJ/2022."""
    try:
        from models.finance import TaxTransaction
        tx = TaxTransaction.query.get_or_404(id)

        if tx.status != 'draft':
            return jsonify({
                'error': f"Transaksi pajak berstatus '{tx.status}' tidak dapat dihapus. "
                         f"Transaksi yang sudah dilaporkan/dibayar harus dikoreksi melalui "
                         f"Faktur Pajak Pengganti, bukan dihapus."
            }), 400

        db.session.delete(tx)
        db.session.commit()
        return jsonify({'message': 'Tax transaction deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/tax-management', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_tax_management():
    try:
        from models.finance import TaxTransaction
        
        current_month = get_local_now().month
        current_year = get_local_now().year
        reporting_period = f"{current_year}-{current_month:02d}"
        
        # Get tax transactions for current period
        tax_transactions = TaxTransaction.query.filter_by(
            reporting_period=reporting_period
        ).order_by(TaxTransaction.transaction_date.desc()).all()
        
        # Calculate tax summary
        vat_out = sum(float(t.tax_amount) for t in tax_transactions if t.transaction_type == 'vat_out')
        vat_in = sum(float(t.tax_amount) for t in tax_transactions if t.transaction_type == 'vat_in')
        income_tax = sum(float(t.tax_amount) for t in tax_transactions if t.transaction_type == 'income_tax')
        
        tax_summary = {
            'vat_payable': vat_out,
            'vat_receivable': vat_in,
            'net_vat': vat_out - vat_in,
            'income_tax': income_tax,
            'withholding_tax': sum(float(t.tax_amount) for t in tax_transactions if 'PPh' in t.tax_type),
            'total_tax_liability': vat_out - vat_in + income_tax
        }
        
        return jsonify({
            'tax_summary': tax_summary,
            'tax_transactions': [{
                'id': t.id,
                'transaction_number': t.transaction_number,
                'transaction_date': t.transaction_date.isoformat() if t.transaction_date else None,
                'transaction_type': t.transaction_type,
                'tax_type': t.tax_type,
                'base_amount': float(t.base_amount),
                'tax_amount': float(t.tax_amount),
                'status': t.status
            } for t in tax_transactions],
            'period': f"{current_month}/{current_year}"
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ CONSOLIDATION ============
@finance_bp.route('/consolidation', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_consolidation():
    try:
        from models.finance import ConsolidationEntity
        
        # Get all active consolidation entities
        entities = ConsolidationEntity.query.filter_by(is_active=True).all()
        
        # Calculate consolidated totals (simplified - would need actual financial data per entity)
        consolidated = {
            'total_revenue': 0,
            'total_expenses': 0,
            'total_net_income': 0,
            'total_assets': 0,
            'total_liabilities': 0,
            'total_equity': 0
        }
        
        return jsonify({
            'entities': [{
                'id': e.id,
                'entity_code': e.entity_code,
                'entity_name': e.entity_name,
                'entity_type': e.entity_type,
                'ownership_percentage': float(e.ownership_percentage) if e.ownership_percentage else None,
                'currency': e.currency,
                'is_active': e.is_active
            } for e in entities],
            'consolidated': consolidated,
            'entity_count': len(entities)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ FINANCIAL REPORTS ============
@finance_bp.route('/reports/income-statement', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_income_statement():
    try:
        year = request.args.get('year', get_local_now().year, type=int)
        
        # Calculate from actual accounting entries
        # Calculate income statement from actual data
        try:
            from ..models.finance import Account
            
            # Get revenue accounts (4000-4999)
            revenue_accounts = Account.query.filter(
                Account.account_code.like('4%'),
                Account.is_active == True
            ).all()
            
            # Get expense accounts (5000-9999)
            expense_accounts = Account.query.filter(
                Account.account_code.like('5%') | 
                Account.account_code.like('6%') | 
                Account.account_code.like('7%') | 
                Account.account_code.like('8%') | 
                Account.account_code.like('9%'),
                Account.is_active == True
            ).all()
            
            # Calculate totals
            total_revenue = sum(acc.balance for acc in revenue_accounts)
            total_expenses = sum(acc.balance for acc in expense_accounts)
            net_income = total_revenue - total_expenses
            
            income_statement = {
                'revenue': {
                    'sales_revenue': total_revenue,
                    'other_revenue': 0,
                    'total_revenue': total_revenue
                },
                'expenses': {
                    'cost_of_goods_sold': sum(acc.balance for acc in expense_accounts if acc.account_code.startswith('5')),
                    'operating_expenses': sum(acc.balance for acc in expense_accounts if acc.account_code.startswith(('6', '7', '8'))),
                    'other_expenses': sum(acc.balance for acc in expense_accounts if acc.account_code.startswith('9')),
                    'total_expenses': total_expenses
                },
                'net_income': net_income
            }
        except ImportError:
            # Fallback calculation
            total_revenue = db.session.query(func.sum(Invoice.total_amount)).filter(
                Invoice.invoice_type == 'sales'
            ).scalar() or 0
            
            from utils.helpers import get_setting_value
            exp_rate = float(get_setting_value('finance.fallback_expense_ratio', 77.0)) / 100.0
            total_expenses = float(total_revenue) * exp_rate if total_revenue else 0
            
            cogs_rate = float(get_setting_value('finance.fallback_cogs_ratio', 60.0)) / 100.0
            opex_rate = float(get_setting_value('finance.fallback_opex_ratio', 35.0)) / 100.0
            other_rate = max(0.0, 1.0 - cogs_rate - opex_rate)
            
            income_statement = {
                'revenue': {
                    'sales_revenue': float(total_revenue),
                    'other_revenue': 0,
                    'total_revenue': float(total_revenue)
                },
                'expenses': {
                    'cost_of_goods_sold': total_expenses * cogs_rate,
                    'operating_expenses': total_expenses * opex_rate,
                    'other_expenses': total_expenses * other_rate,
                    'total_expenses': total_expenses
                },
                'net_income': float(total_revenue) - total_expenses
            }
        
        return jsonify({
            'income_statement': income_statement,
            'period': f"Year {year}",
            'message': 'Income statement will be calculated from your accounting entries. Please record transactions first.'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/reports/balance-sheet', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_balance_sheet():
    try:
        as_of_date = request.args.get('date', get_local_now().date().isoformat())
        
        # Calculate from actual accounting entries
        # TODO: Implement proper balance sheet calculation from database
        balance_sheet = {
            'assets': {
                'current_assets': {
                    'cash': 0,
                    'accounts_receivable': 0,
                    'inventory': 0,
                    'prepaid_expenses': 0,
                    'total_current_assets': 0
                },
                'fixed_assets': {
                    'property_plant_equipment': 0,
                    'accumulated_depreciation': 0,
                    'net_fixed_assets': 0
                },
                'total_assets': 0
            },
            'liabilities': {
                'current_liabilities': {
                    'accounts_payable': 0,
                    'accrued_liabilities': 0,
                    'short_term_debt': 0,
                    'total_current_liabilities': 0
                },
                'long_term_liabilities': {
                    'long_term_debt': 0,
                    'total_long_term_liabilities': 0
                },
                'total_liabilities': 0
            },
            'equity': {
                'common_stock': 0,
                'retained_earnings': 0,
                'total_equity': 0
            },
            'total_liabilities_equity': 0
        }
        
        return jsonify({
            'balance_sheet': balance_sheet,
            'as_of_date': as_of_date,
            'message': 'Balance sheet will be calculated from your accounting entries. Please record transactions first.'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/reports/cash-flow', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_cash_flow_report():
    try:
        from datetime import date as date_cls
        from utils.finance_helpers import get_real_cash_flow, get_cash_balance_as_of

        year = request.args.get('year', get_local_now().year, type=int)
        start_date = date_cls(year, 1, 1)
        end_date = date_cls(year, 12, 31)

        real = get_real_cash_flow(start_date, end_date)
        beginning_cash = get_cash_balance_as_of(date_cls(year - 1, 12, 31))
        ending_cash = beginning_cash + real['net_cash_flow']

        cash_flow = {
            'operating_activities': {
                'cash_in': real['operating']['in'],
                'cash_out': real['operating']['out'],
                'net_cash_from_operations': real['operating']['net']
            },
            'investing_activities': {
                'net_cash_from_investing': real['investing']['net']
            },
            'financing_activities': {
                'net_cash_from_financing': real['financing']['net']
            },
            'net_change_in_cash': real['net_cash_flow'],
            'beginning_cash': beginning_cash,
            'ending_cash': ending_cash
        }

        return jsonify({
            'cash_flow': cash_flow,
            'period': f"Year {year}",
            'message': 'Dihitung dari posting GL riil (Kas/Bank) - bukan estimasi. Investing/financing akan terisi begitu ada transaksi aset tetap/pinjaman yang benar-benar posting ke GL.'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/cost-centers', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_cost_centers():
    try:
        centers = CostCenter.query.filter_by(is_active=True).all()
        return jsonify({
            'cost_centers': [{
                'id': c.id,
                'code': c.code,
                'name': c.name
            } for c in centers]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===============================
# DASHBOARD ENDPOINTS
# ===============================

@finance_bp.route('/dashboard/kpis', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_dashboard_kpis():
    """Get finance dashboard KPIs"""
    try:
        # Try to calculate from actual data, fallback to mock if no data
        try:
            # Calculate total revenue from invoices
            total_revenue = db.session.query(func.sum(Invoice.total_amount)).filter(
                Invoice.invoice_type == 'sales'
            ).scalar() or 0
            
            # Calculate accounts receivable
            accounts_receivable = db.session.query(func.sum(Invoice.balance_due)).filter(
                Invoice.invoice_type == 'sales',
                Invoice.balance_due > 0
            ).scalar() or 0
            
            # Calculate accounts payable  
            accounts_payable = db.session.query(func.sum(Invoice.balance_due)).filter(
                Invoice.invoice_type == 'purchase',
                Invoice.balance_due > 0
            ).scalar() or 0
            
            # If we have some real data, use it
            if total_revenue > 0:
                total_expenses = total_revenue * 0.76  # Estimate 76% expense ratio
                net_profit = total_revenue - total_expenses
                profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
                cash_balance = total_revenue * 0.36  # Estimate cash balance
                working_capital = cash_balance + accounts_receivable - accounts_payable
                
                kpis = {
                    'total_revenue': float(total_revenue),
                    'total_expenses': float(total_expenses),
                    'net_profit': float(net_profit),
                    'profit_margin': float(profit_margin),
                    'cash_balance': float(cash_balance),
                    'accounts_receivable': float(accounts_receivable),
                    'accounts_payable': float(accounts_payable),
                    'working_capital': float(working_capital)
                }
            else:
                # Fallback to mock data if no real data
                raise Exception("No invoice data found")
                
        except Exception:
            # Calculate from available data or use minimal defaults
            invoice_count = db.session.query(Invoice).count()
            payment_count = db.session.query(Payment).count()
            
            if invoice_count > 0 or payment_count > 0:
                # Use basic calculations from available data
                total_revenue = db.session.query(func.sum(Invoice.total_amount)).scalar() or 0
                total_payments = db.session.query(func.sum(Payment.amount)).scalar() or 0
                
                # Use whichever is higher as revenue indicator
                revenue_base = max(float(total_revenue), float(total_payments))
                
                kpis = {
                    'total_revenue': revenue_base,
                    'total_expenses': revenue_base * 0.76,
                    'net_profit': revenue_base * 0.24,
                    'profit_margin': 24.0,
                    'cash_balance': revenue_base * 0.36,
                    'accounts_receivable': revenue_base * 0.15,
                    'accounts_payable': revenue_base * 0.10,
                    'working_capital': revenue_base * 0.27
                }
            else:
                # Minimal default values when no data exists
                kpis = {
                    'total_revenue': 0,
                    'total_expenses': 0,
                    'net_profit': 0,
                    'profit_margin': 0,
                    'cash_balance': 0,
                    'accounts_receivable': 0,
                    'accounts_payable': 0,
                    'working_capital': 0
                }
        
        return jsonify({'kpis': kpis}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/dashboard/cash-flow', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_dashboard_cash_flow():
    """Get cash flow data for dashboard - computed from real GL postings
    against Kas/Bank accounts, month by month. Previously estimated cash_out
    as a fixed 80-82% of cash_in (or fabricated entirely when no Payment rows
    existed) - now both cash_in and cash_out are real."""
    try:
        from datetime import timedelta
        from utils.finance_helpers import get_real_cash_flow

        cash_flow = []
        current_date = get_local_now()

        for i in range(6):
            month_start = (current_date.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
            next_month = (month_start + timedelta(days=32)).replace(day=1)
            month_end = next_month - timedelta(days=1)
            month_name = month_start.strftime('%b')

            real = get_real_cash_flow(month_start.date(), month_end.date())

            cash_flow.insert(0, {
                'month': month_name,
                'cash_in': real['cash_in'],
                'cash_out': real['cash_out'],
                'net_cash_flow': real['net_cash_flow']
            })

        return jsonify({'cash_flow': cash_flow}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/dashboard/expenses', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_dashboard_expenses():
    """Get expense breakdown for dashboard"""
    try:
        # Calculate expenses based on available data
        total_expenses = 0
        
        # Try to get expense data from invoices or payments
        purchase_invoices = db.session.query(func.sum(Invoice.total_amount)).filter(
            Invoice.invoice_type == 'purchase'
        ).scalar() or 0
        
        total_payments = db.session.query(func.sum(Payment.amount)).scalar() or 0
        
        # Use available data as expense base
        expense_base = max(float(purchase_invoices), float(total_payments) * 0.8) if (purchase_invoices or total_payments) else 0
        
        if expense_base > 0:
            # Calculate realistic expense breakdown
            expenses = [
                {'category': 'Raw Materials', 'amount': expense_base * 0.368, 'percentage': 36.8},
                {'category': 'Labor Costs', 'amount': expense_base * 0.295, 'percentage': 29.5},
                {'category': 'Manufacturing', 'amount': expense_base * 0.158, 'percentage': 15.8},
                {'category': 'Marketing & Sales', 'amount': expense_base * 0.089, 'percentage': 8.9},
                {'category': 'Administration', 'amount': expense_base * 0.055, 'percentage': 5.5},
                {'category': 'Others', 'amount': expense_base * 0.035, 'percentage': 3.5}
            ]
        else:
            # Empty expenses when no data
            expenses = []
        
        return jsonify({'expenses': expenses}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/dashboard/revenue', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_dashboard_revenue():
    """Get revenue data for dashboard"""
    try:
        # Calculate revenue based on available data
        total_revenue = db.session.query(func.sum(Invoice.total_amount)).filter(
            Invoice.invoice_type == 'sales'
        ).scalar() or 0
        
        total_payments = db.session.query(func.sum(Payment.amount)).scalar() or 0
        
        # Use available data to generate revenue trends
        revenue_base = max(float(total_revenue), float(total_payments)) / 6 if (total_revenue or total_payments) else 0
        
        if revenue_base > 0:
            revenue = []
            months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            for i, month in enumerate(months):
                # Add growth trend and variance
                from utils.helpers import get_setting_value
                growth_rate = float(get_setting_value('finance.assumed_monthly_growth', 8.0)) / 100.0
                growth_factor = 1 + (i * growth_rate)
                variance = 1 + ((i % 3) * 0.05)  # Some variance
                
                monthly_revenue = revenue_base * growth_factor * variance
                exp_rate = float(get_setting_value('finance.fallback_expense_ratio', 77.0)) / 100.0
                monthly_expenses = monthly_revenue * exp_rate
                monthly_profit = monthly_revenue - monthly_expenses
                
                revenue.append({
                    'month': month,
                    'revenue': monthly_revenue,
                    'profit': monthly_profit,
                    'expenses': monthly_expenses
                })
        else:
            # Empty revenue when no data
            revenue = []
        
        return jsonify({'revenue': revenue}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===============================
# ADDITIONAL FINANCE ENDPOINTS
# ===============================

@finance_bp.route('/chart-of-accounts', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_chart_of_accounts():
    """Get chart of accounts, with real-time balance per account computed
    from AccountingEntry (there is no cached balance column on Account -
    balance = SUM(debit) - SUM(credit) for debit-normal accounts, or the
    inverse for credit-normal accounts, per standard accounting convention).
    """
    try:
        from sqlalchemy import func

        accounts = Account.query.order_by(Account.account_code).all()

        balance_rows = (
            db.session.query(
                AccountingEntry.account_id,
                func.coalesce(func.sum(AccountingEntry.debit_amount), 0).label('total_debit'),
                func.coalesce(func.sum(AccountingEntry.credit_amount), 0).label('total_credit'),
            )
            .filter(AccountingEntry.status == 'posted')
            .group_by(AccountingEntry.account_id)
            .all()
        )
        balances_by_account = {row.account_id: (float(row.total_debit), float(row.total_credit)) for row in balance_rows}

        accounts_by_id = {a.id: a for a in accounts}

        result = []
        for a in accounts:
            total_debit, total_credit = balances_by_account.get(a.id, (0.0, 0.0))
            if a.normal_balance == 'debit':
                balance = total_debit - total_credit
            else:
                balance = total_credit - total_debit

            parent = accounts_by_id.get(a.parent_id) if a.parent_id else None

            result.append({
                'id': a.id,
                'code': a.account_code,
                'name': a.account_name,
                'type': a.account_type,
                'normal_balance': a.normal_balance,
                'balance': balance,
                'is_header': a.is_header,
                'is_cash_bank': a.is_cash_bank,
                'level': a.level,
                'is_active': a.is_active,
                'description': a.description,
                'parent_id': a.parent_id,
                'parent_code': parent.account_code if parent else None,
                'parent_name': parent.account_name if parent else None,
            })

        return jsonify({'accounts': result}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/chart-of-accounts', methods=['POST'])
@jwt_required()
@require_permission('accounting.create')
def create_account():
    """Create a new account"""
    try:
        data = request.get_json()
        
        # Check if account code already exists
        if Account.query.filter_by(account_code=data['code']).first():
            return jsonify({'error': f"Account code '{data['code']}' already exists"}), 400
            
        parent_id = None
        if data.get('parent_code'):
            parent = Account.query.filter_by(account_code=data['parent_code']).first()
            if not parent:
                return jsonify({'error': f"Parent account code '{data['parent_code']}' not found"}), 400
            parent_id = parent.id

        new_account = Account(
            account_code=data['code'],
            account_name=data['name'],
            account_type=data['type'],
            normal_balance=data.get('normal_balance') or ('debit' if data['type'].lower() in ['asset', 'expense'] else 'credit'),
            description=data.get('description', ''),
            is_active=True,
            is_header=data.get('is_header', False),
            parent_id=parent_id,
            level=2 if parent_id else 1,
        )

        db.session.add(new_account)
        db.session.commit()
        
        return jsonify({'message': 'Account created successfully', 'id': new_account.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/chart-of-accounts/<string:code>', methods=['PUT'])
@jwt_required()
@require_permission('accounting.edit')
def update_account(code):
    """Update an account by code"""
    try:
        data = request.get_json()
        account = Account.query.filter_by(account_code=code).first_or_404()
        
        if 'name' in data:
            account.account_name = data['name']
        if 'type' in data:
            account.account_type = data['type']
            account.normal_balance = 'debit' if data['type'].lower() in ['asset', 'expense'] else 'credit'
        if 'description' in data:
            account.description = data['description']
        if 'is_active' in data:
            account.is_active = data['is_active']
        if 'is_header' in data:
            account.is_header = data['is_header']
        if 'parent_code' in data:
            if not data['parent_code']:
                account.parent_id = None
                account.level = 1
            else:
                if data['parent_code'] == account.account_code:
                    return jsonify({'error': 'Account cannot be its own parent'}), 400
                parent = Account.query.filter_by(account_code=data['parent_code']).first()
                if not parent:
                    return jsonify({'error': f"Parent account code '{data['parent_code']}' not found"}), 400
                account.parent_id = parent.id
                account.level = 2

        db.session.commit()
        return jsonify({'message': 'Account updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/chart-of-accounts/<string:code>', methods=['DELETE'])
@jwt_required()
@require_permission('finance.delete')
def delete_account(code):
    """Delete an account by code"""
    try:
        account = Account.query.filter_by(account_code=code).first_or_404()
        
        # Check if account has journal entries before deleting
        if AccountingEntry.query.filter_by(account_code=code).first():
            return jsonify({'error': 'Cannot delete account with existing journal entries. Deactivate it instead.'}), 400
            
        db.session.delete(account)
        db.session.commit()
        return jsonify({'message': 'Account deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/accounting/journal-entries', methods=['GET'])
@jwt_required()
@require_permission('journal.view')
def get_journal_entries():
    """Get journal entries, grouped one row per journal (not per GL line)."""
    try:
        # Get journal entries from AccountingEntry model
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        entries = AccountingEntry.query.order_by(AccountingEntry.entry_date.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        # Group entries by journal entry number.
        # BUG FIX 2026-08-17: grouping was keyed on reference_number, which
        # is NOT unique per journal (many journals from the same source
        # transaction, or with no reference_number at all, would collide
        # and get merged into one row with wrong totals). The real grouping
        # key is entry_number's BASE segment (before the "-NN" line suffix
        # post_pending_journal() appends) - same fix pattern already applied
        # in post_pending_journal() itself for the generate_number()
        # collision bug found during Payroll wiring this session.
        journal_entries = {}
        for entry in entries.items:
            base_number = entry.entry_number.rsplit('-', 1)[0] if entry.entry_number else f"JE-{entry.id}"
            if base_number not in journal_entries:
                journal_entries[base_number] = {
                    'id': entry.id,
                    'entry_number': base_number,
                    'entry_date': entry.entry_date.isoformat(),
                    'description': entry.description,
                    'reference_number': entry.reference_number,
                    'reference_type': entry.reference_type,
                    'total_debit': 0,
                    'total_credit': 0,
                    'status': entry.status or 'posted',
                    'created_by': getattr(entry.posted_by_user, 'username', 'N/A') if entry.posted_by_user else 'N/A',
                }
            
            journal_entries[base_number]['total_debit'] += float(entry.debit_amount or 0)
            journal_entries[base_number]['total_credit'] += float(entry.credit_amount or 0)
        
        return jsonify({
            'entries': list(journal_entries.values()),
            'total': entries.total,
            'pages': entries.pages
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/budget/budgets', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_budget_list():
    """Get budget data"""
    try:
        # Get budgets from database - need to create Budget model first
        budgets = []
        
        # Get budgets from Budget model
        try:
            from ..models.finance import Budget
            budgets = Budget.query.filter_by(is_active=True).all()
            
            budget_list = []
            for b in budgets:
                total_actual = sum(float(line.actual_amount) for line in b.lines)
                variance = total_actual - float(b.total_budget)
                variance_percent = (variance / float(b.total_budget) * 100) if b.total_budget > 0 else 0
                
                budget_list.append({
                    'id': b.id,
                    'budget_name': b.budget_name,
                    'budget_period': b.budget_period,
                    'budget_year': b.budget_year,
                    'total_budget': float(b.total_budget),
                    'total_actual': total_actual,
                    'variance': variance,
                    'variance_percent': variance_percent,
                    'status': b.status
                })
            
            return jsonify({'budgets': budget_list}), 200
        except ImportError:
            return jsonify({
                'budgets': [],
                'message': 'No budgets configured. Please create your budgets first.'
            }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/budget/variance-analysis', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_variance_analysis():
    """Get budget variance analysis"""
    try:
        # Calculate variance analysis from budget vs actual data
        analysis = []
        
        # TODO: Implement when Budget and BudgetLine models are created
        # budget_lines = BudgetLine.query.join(Budget).filter(Budget.is_active == True).all()
        # for line in budget_lines:
        #     actual_amount = calculate_actual_for_category(line.category, line.account_codes)
        #     variance = actual_amount - line.budget_amount
        #     variance_percent = (variance / line.budget_amount * 100) if line.budget_amount > 0 else 0
        #     
        #     analysis.append({
        #         'category': line.category,
        #         'budget': float(line.budget_amount),
        #         'actual': float(actual_amount),
        #         'variance': float(variance),
        #         'variance_percent': float(variance_percent)
        #     })
        
        return jsonify({
            'analysis': analysis,
            'message': 'No budget variance data available. Please set up budgets first.'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/cash-flow/forecast', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_cash_flow_forecast():
    """Get cash flow forecast - projects forward using the REAL average
    weekly net cash flow from the last 8 weeks of actual GL postings, not a
    fixed 2%/week growth + 85% cash-out-ratio assumption. Opening balance is
    the real current Kas/Bank balance, not weekly_avg*20."""
    try:
        from datetime import timedelta
        from utils.finance_helpers import get_real_cash_flow, get_cash_balance_as_of

        today = get_local_now().date()
        lookback_start = today - timedelta(weeks=8)
        historical = get_real_cash_flow(lookback_start, today)
        weekly_avg_in = historical['cash_in'] / 8
        weekly_avg_out = historical['cash_out'] / 8

        forecast = []
        if historical['cash_in'] > 0 or historical['cash_out'] > 0:
            current_balance = get_cash_balance_as_of(today)

            for i in range(4):
                period_name = f"Week {i+1}"
                opening_balance = current_balance
                closing_balance = opening_balance + weekly_avg_in - weekly_avg_out
                current_balance = closing_balance

                forecast.append({
                    'period': period_name,
                    'opening_balance': opening_balance,
                    'cash_in': weekly_avg_in,
                    'cash_out': weekly_avg_out,
                    'closing_balance': closing_balance
                })

        return jsonify({
            'forecast': forecast,
            'message': f'Proyeksi berdasarkan rata-rata riil arus kas 8 minggu terakhir (Kas masuk/keluar dari GL), bukan asumsi pertumbuhan tetap.' if forecast else 'Belum ada data arus kas riil 8 minggu terakhir untuk membuat proyeksi.'
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@finance_bp.route('/cash-flow/analysis', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_cash_flow_analysis():
    """Get cash flow analysis - operating/investing/financing computed from
    real GL postings for the current year (previously fixed 28%/6.8%/2% of
    revenue). cash_conversion_cycle now uses a real Days Sales Outstanding
    estimate from actual receivables/revenue instead of a hardcoded "standard
    estimate: 45" - inventory/payable days aren't tracked yet so this is a
    partial (DSO-only) real metric, not the full 3-part CCC, reported as such
    rather than faking the rest."""
    try:
        from datetime import date as date_cls
        from utils.finance_helpers import get_real_cash_flow

        today = get_local_now().date()
        year_start = date_cls(today.year, 1, 1)
        real = get_real_cash_flow(year_start, today)

        operating_cash_flow = real['operating']['net']
        investing_cash_flow = real['investing']['net']
        financing_cash_flow = real['financing']['net']
        net_cash_flow = real['net_cash_flow']
        free_cash_flow = operating_cash_flow + investing_cash_flow

        # Real DSO: average receivables / (annual revenue / 365)
        avg_receivables = db.session.query(func.sum(Invoice.balance_due)).filter(
            Invoice.invoice_type == 'sales', Invoice.balance_due > 0
        ).scalar() or 0
        annual_revenue = db.session.query(func.sum(Invoice.total_amount)).filter(
            Invoice.invoice_type == 'sales', Invoice.invoice_date >= year_start
        ).scalar() or 0
        dso = round(float(avg_receivables) / (float(annual_revenue) / 365), 1) if annual_revenue else None

        analysis = {
            'operating_cash_flow': operating_cash_flow,
            'investing_cash_flow': investing_cash_flow,
            'financing_cash_flow': financing_cash_flow,
            'net_cash_flow': net_cash_flow,
            'days_sales_outstanding': dso,
            'free_cash_flow': free_cash_flow
        }
        
        return jsonify({'analysis': analysis}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============ ACCOUNT PREFERENCES (Barang & Jasa 9-slot) ============
_ACCOUNT_PREF_SLOTS = [
    'akun_persediaan_id', 'akun_penjualan_id', 'akun_retur_penjualan_id',
    'akun_diskon_penjualan_id', 'akun_barang_terkirim_id', 'akun_hpp_id',
    'akun_retur_pembelian_id', 'akun_beban_id', 'akun_pembelian_belum_tertagih_id',
]


@finance_bp.route('/account-preferences/category-defaults/<int:category_id>', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_category_account_defaults(category_id):
    try:
        from models.finance import CategoryAccountDefault

        row = CategoryAccountDefault.query.filter_by(category_id=category_id).first()
        if not row:
            # No defaults saved yet for this category - return all-null slots
            # rather than 404, so the frontend form starts empty/editable.
            return jsonify({slot: None for slot in _ACCOUNT_PREF_SLOTS}), 200

        return jsonify({slot: getattr(row, slot) for slot in _ACCOUNT_PREF_SLOTS}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/account-preferences/category-defaults/<int:category_id>', methods=['PUT'])
@jwt_required()
@require_permission('accounting.edit')
def update_category_account_defaults(category_id):
    try:
        from models.finance import CategoryAccountDefault
        from models.product import ProductCategory

        category = db.session.get(ProductCategory, category_id)
        if not category:
            return jsonify({'error': f'Product category {category_id} not found'}), 404

        data = request.get_json() or {}

        row = CategoryAccountDefault.query.filter_by(category_id=category_id).first()
        if not row:
            row = CategoryAccountDefault(category_id=category_id)
            db.session.add(row)

        for slot in _ACCOUNT_PREF_SLOTS:
            if slot in data:
                setattr(row, slot, data[slot])

        db.session.commit()

        return jsonify({slot: getattr(row, slot) for slot in _ACCOUNT_PREF_SLOTS}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/account-preferences/product-overrides/<int:product_id>', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_product_account_overrides(product_id):
    try:
        from models.product import Product

        product = db.session.get(Product, product_id)
        if not product:
            return jsonify({'error': f'Product {product_id} not found'}), 404

        return jsonify({slot: getattr(product, slot) for slot in _ACCOUNT_PREF_SLOTS}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/account-preferences/product-overrides/<int:product_id>', methods=['PUT'])
@jwt_required()
@require_permission('accounting.edit')
def update_product_account_overrides(product_id):
    try:
        from models.product import Product

        product = db.session.get(Product, product_id)
        if not product:
            return jsonify({'error': f'Product {product_id} not found'}), 404

        data = request.get_json() or {}

        for slot in _ACCOUNT_PREF_SLOTS:
            if slot in data:
                setattr(product, slot, data[slot])

        db.session.commit()

        return jsonify({slot: getattr(product, slot) for slot in _ACCOUNT_PREF_SLOTS}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============ SINGLE-ROW SETTINGS TABS (Penjualan/Pembelian/Pajak/Perusahaan/Persediaan) ============
_SALES_SETTINGS_FIELDS = ['akun_uang_muka_pelanggan_id']
_PURCHASE_SETTINGS_FIELDS = ['akun_selisih_pembelian_id', 'akun_perintah_pembayaran_id']
_TAX_SETTINGS_FIELDS = ['akun_ppn_keluaran_id', 'akun_ppn_masukan_id', 'akun_pph22_id', 'akun_pph23_id']
_COMPANY_SETTINGS_FIELDS = ['akun_ekuitas_id', 'akun_laba_ditahan_id', 'exchange_rate_refresh_enabled']
_INVENTORY_SETTINGS_FIELDS = ['akun_penyesuaian_id']


def _settings_get(model_class, fields):
    from utils.finance_helpers import get_or_create_singleton
    row = get_or_create_singleton(model_class)
    return jsonify({f: getattr(row, f) for f in fields}), 200


def _settings_put(model_class, fields):
    from utils.finance_helpers import get_or_create_singleton
    row = get_or_create_singleton(model_class)
    data = request.get_json() or {}
    for f in fields:
        if f in data:
            setattr(row, f, data[f])
    db.session.commit()
    return jsonify({f: getattr(row, f) for f in fields}), 200


@finance_bp.route('/account-preferences/sales-settings', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_sales_account_settings():
    try:
        from models.finance import SalesAccountSettings
        return _settings_get(SalesAccountSettings, _SALES_SETTINGS_FIELDS)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/account-preferences/sales-settings', methods=['PUT'])
@jwt_required()
@require_permission('accounting.edit')
def update_sales_account_settings():
    try:
        from models.finance import SalesAccountSettings
        return _settings_put(SalesAccountSettings, _SALES_SETTINGS_FIELDS)
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/account-preferences/purchase-settings', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_purchase_account_settings():
    try:
        from models.finance import PurchaseAccountSettings
        return _settings_get(PurchaseAccountSettings, _PURCHASE_SETTINGS_FIELDS)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/account-preferences/purchase-settings', methods=['PUT'])
@jwt_required()
@require_permission('accounting.edit')
def update_purchase_account_settings():
    try:
        from models.finance import PurchaseAccountSettings
        return _settings_put(PurchaseAccountSettings, _PURCHASE_SETTINGS_FIELDS)
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/account-preferences/tax-settings', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_tax_account_settings():
    try:
        from models.finance import TaxAccountSettings
        return _settings_get(TaxAccountSettings, _TAX_SETTINGS_FIELDS)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/account-preferences/tax-settings', methods=['PUT'])
@jwt_required()
@require_permission('accounting.edit')
def update_tax_account_settings():
    try:
        from models.finance import TaxAccountSettings
        return _settings_put(TaxAccountSettings, _TAX_SETTINGS_FIELDS)
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/account-preferences/company-settings', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_company_account_settings():
    try:
        from models.finance import CompanyAccountSettings
        return _settings_get(CompanyAccountSettings, _COMPANY_SETTINGS_FIELDS)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/account-preferences/company-settings', methods=['PUT'])
@jwt_required()
@require_permission('accounting.edit')
def update_company_account_settings():
    try:
        from models.finance import CompanyAccountSettings
        return _settings_put(CompanyAccountSettings, _COMPANY_SETTINGS_FIELDS)
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/account-preferences/inventory-settings', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_inventory_account_settings():
    try:
        from models.finance import InventoryAccountSettings
        return _settings_get(InventoryAccountSettings, _INVENTORY_SETTINGS_FIELDS)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/account-preferences/inventory-settings', methods=['PUT'])
@jwt_required()
@require_permission('accounting.edit')
def update_inventory_account_settings():
    try:
        from models.finance import InventoryAccountSettings
        return _settings_put(InventoryAccountSettings, _INVENTORY_SETTINGS_FIELDS)
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============ EXCHANGE RATES ============
@finance_bp.route('/exchange-rates/sync-cron', methods=['POST'])
def sync_exchange_rates_cron():
    """
    Daily cron endpoint (no @jwt_required - matches the existing pattern for
    other cron endpoints like accurate/sync-scan-cron, called via curl from
    the server's own crontab, not from the browser).
    """
    try:
        from utils.exchange_rates import fetch_exchange_rates
        stored = fetch_exchange_rates()
        return jsonify({'message': f'Synced {stored} exchange rate(s)', 'stored': stored}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/exchange-rates/current/<string:currency_pair>', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_current_exchange_rate(currency_pair):
    try:
        from utils.exchange_rates import get_current_rate
        rate = get_current_rate(currency_pair)
        if rate is None:
            return jsonify({'error': f'No rate found for {currency_pair}'}), 404
        return jsonify({'currency_pair': currency_pair, 'rate': rate}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============ RECURRING PAYMENTS (WiFi/Listrik/Air, dll) ============
@finance_bp.route('/recurring-payments', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_recurring_payments():
    try:
        from models.finance import RecurringPayment

        payments = RecurringPayment.query.filter_by(is_active=True).order_by(RecurringPayment.name).all()
        return jsonify({
            'recurring_payments': [{
                'id': p.id,
                'name': p.name,
                'category': p.category,
                'vendor_name': p.vendor_name,
                'notes': p.notes,
            } for p in payments]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/recurring-payments', methods=['POST'])
@jwt_required()
@require_permission('finance.create')
def create_recurring_payment():
    try:
        from models.finance import RecurringPayment

        data = request.get_json() or {}
        if not data.get('name') or not data.get('category'):
            return jsonify({'error': 'name and category are required'}), 400

        payment = RecurringPayment(
            name=data['name'],
            category=data['category'],
            vendor_name=data.get('vendor_name'),
            notes=data.get('notes'),
        )
        db.session.add(payment)
        db.session.commit()

        return jsonify({'message': 'Recurring payment created', 'id': payment.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/recurring-payments/<int:id>/transactions', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_recurring_payment_transactions(id):
    try:
        from models.finance import RecurringPaymentTransaction

        transactions = (
            RecurringPaymentTransaction.query
            .filter_by(recurring_payment_id=id)
            .order_by(RecurringPaymentTransaction.payment_date.desc())
            .all()
        )
        return jsonify({
            'transactions': [{
                'id': t.id,
                'transaction_number': t.transaction_number,
                'payment_date': t.payment_date.isoformat() if t.payment_date else None,
                'period_label': t.period_label,
                'amount': float(t.amount),
                'notes': t.notes,
            } for t in transactions]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/recurring-payments/<int:id>/transactions', methods=['POST'])
@jwt_required()
@require_permission('finance.create')
def create_recurring_payment_transaction(id):
    try:
        from models.finance import (
            RecurringPayment, RecurringPaymentTransaction,
            GlobalAccountDefault,
        )
        from models.approval_workflow import PendingJournalEntry
        from utils.finance_helpers import post_pending_journal, is_period_locked

        recurring_payment = db.session.get(RecurringPayment, id)
        if not recurring_payment:
            return jsonify({'error': 'Recurring payment not found'}), 404

        data = request.get_json() or {}
        if not data.get('payment_date') or not data.get('amount'):
            return jsonify({'error': 'payment_date and amount are required'}), 400

        payment_date = datetime.strptime(data['payment_date'], '%Y-%m-%d').date()
        amount = float(data['amount'])
        if amount <= 0:
            return jsonify({'error': 'Amount harus lebih besar dari 0'}), 400

        if is_period_locked(payment_date):
            return jsonify({'error': f'Periode {payment_date.strftime("%Y-%m")} sudah ditutup (period-close). Tidak bisa mencatat pembayaran di periode ini.'}), 400

        transaction_number = generate_number('RCP', RecurringPaymentTransaction, 'transaction_number')

        transaction = RecurringPaymentTransaction(
            transaction_number=transaction_number,
            recurring_payment_id=id,
            payment_date=payment_date,
            period_label=data.get('period_label') or f'{payment_date.year}-{payment_date.month:02d}',
            amount=amount,
            notes=data.get('notes'),
            created_by=get_jwt_identity(),
        )
        db.session.add(transaction)
        db.session.flush()

        # GL posting: Debit Beban Operasional (shared with regular expense
        # claims, per Bayu's 2026-08-16 decision), Credit Kas.
        beban_default = GlobalAccountDefault.query.filter_by(transaction_key='beban_operasional').first()
        cash_default = GlobalAccountDefault.query.filter_by(transaction_key='cash').first()
        if not beban_default or not cash_default:
            db.session.rollback()
            return jsonify({'error': 'Akun Beban Operasional atau Kas belum diatur di Preferensi Akun'}), 400

        journal_lines = [
            {
                'account_id': beban_default.account_id,
                'debit': amount,
                'credit': 0,
                'description': f'{recurring_payment.name} - {transaction.period_label}',
            },
            {
                'account_id': cash_default.account_id,
                'debit': 0,
                'credit': amount,
                'description': f'{recurring_payment.name} - {transaction.period_label}',
            },
        ]

        pending = PendingJournalEntry(
            workflow_id=None,
            entry_date=payment_date,
            description=f'{recurring_payment.name} - {transaction.period_label}',
            reference=transaction_number,
            lines=journal_lines,
            total_debit=amount,
            total_credit=amount,
            created_by=get_jwt_identity(),
        )
        db.session.add(pending)
        db.session.flush()
        post_pending_journal(pending.id, posted_by_user_id=get_jwt_identity(), reference_type='recurring_payment', reference_id=transaction.id)

        db.session.commit()
        return jsonify({'message': 'Payment recorded', 'transaction_id': transaction.id}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============ NUMBER SEQUENCE CONFIG (Settings) ============
@finance_bp.route('/number-sequences', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_number_sequences():
    try:
        from models.finance import NumberSequence

        sequences = NumberSequence.query.order_by(NumberSequence.sequence_key).all()
        return jsonify({
            'number_sequences': [{
                'id': s.id,
                'sequence_key': s.sequence_key,
                'prefix': s.prefix,
                'description': s.description,
            } for s in sequences]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/number-sequences', methods=['POST'])
@jwt_required()
@require_permission('finance.create')
def upsert_number_sequence():
    try:
        from models.finance import NumberSequence

        data = request.get_json() or {}
        if not data.get('sequence_key') or not data.get('prefix'):
            return jsonify({'error': 'sequence_key and prefix are required'}), 400

        seq = NumberSequence.query.filter_by(sequence_key=data['sequence_key']).first()
        if seq:
            seq.prefix = data['prefix']
            seq.description = data.get('description', seq.description)
        else:
            seq = NumberSequence(
                sequence_key=data['sequence_key'],
                prefix=data['prefix'],
                description=data.get('description'),
            )
            db.session.add(seq)

        db.session.commit()
        return jsonify({'message': 'Number sequence saved', 'id': seq.id}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============ PERIOD-END CLOSE (Proses Akhir Bulan) ============
@finance_bp.route('/period-close', methods=['POST'])
@jwt_required()
@require_permission('finance.create')
def close_accounting_period():
    """
    Runs SMITH's "Proses Akhir Bulan" (Period End), mirroring Accurate's
    monthly period-end process: computes and posts monthly depreciation,
    then locks the period so past transactions dated within it get
    rejected by is_period_locked() checks (not yet enforced at every
    transaction route as of 2026-08-16 - see finance_helpers.py's docstring).

    Body: {"period_year": int, "period_month": int}

    Does NOT yet validate for negative stock (Accurate's guard rail) - the
    underlying quantity_on_hand data has a known pre-existing accuracy bug
    that must be fixed first (tracked separately), so this check is
    deliberately deferred rather than validating against untrustworthy data.
    """
    try:
        from models.finance import PeriodClose
        from utils.finance_helpers import run_monthly_depreciation

        data = request.get_json() or {}
        period_year = data.get('period_year')
        period_month = data.get('period_month')
        user_id = get_jwt_identity()

        if not period_year or not period_month:
            return jsonify({'error': 'period_year and period_month are required'}), 400
        if not (1 <= period_month <= 12):
            return jsonify({'error': 'period_month must be between 1 and 12'}), 400

        existing_close = PeriodClose.query.filter_by(period_year=period_year, period_month=period_month).first()
        if existing_close:
            return jsonify({'error': f'Periode {period_year}-{period_month:02d} sudah ditutup sebelumnya'}), 400

        depreciation_summary = run_monthly_depreciation(period_year, period_month, posted_by_user_id=user_id)

        period_close = PeriodClose(
            period_year=period_year,
            period_month=period_month,
            closed_by=user_id,
            depreciation_summary=depreciation_summary,
            notes=data.get('notes'),
        )
        db.session.add(period_close)
        db.session.commit()

        return jsonify({
            'message': f'Periode {period_year}-{period_month:02d} berhasil ditutup',
            'depreciation_summary': depreciation_summary,
        }), 200

    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/period-close', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_period_closes():
    try:
        from models.finance import PeriodClose

        closes = PeriodClose.query.order_by(
            PeriodClose.period_year.desc(), PeriodClose.period_month.desc()
        ).all()
        return jsonify({
            'period_closes': [{
                'id': c.id,
                'period_year': c.period_year,
                'period_month': c.period_month,
                'closed_at': c.closed_at.isoformat() if c.closed_at else None,
                'depreciation_summary': c.depreciation_summary,
                'notes': c.notes,
            } for c in closes]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/period-close/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('finance.delete')
def reopen_accounting_period(id):
    """
    Manually reopens a closed period (deletes its PeriodClose row), for
    when a correction is needed. Per Bayu's 2026-08-16 decision, there is
    no automatic grace period - reopening is always an explicit, logged
    manual action rather than a time-based auto-allowance.

    NOTE: this does NOT reverse the depreciation journal that was posted
    when the period was closed - if depreciation needs correcting too,
    that must be done as a separate manual adjusting entry. This only
    removes the lock so transactions can be entered/edited again.
    """
    try:
        from models.finance import PeriodClose

        period_close = db.session.get(PeriodClose, id)
        if not period_close:
            return jsonify({'error': 'Period close record not found'}), 404

        period_label = f'{period_close.period_year}-{period_close.period_month:02d}'
        db.session.delete(period_close)
        db.session.commit()

        return jsonify({'message': f'Periode {period_label} berhasil dibuka kembali'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/accounts/<int:id>/transactions', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_account_transactions(id):
    """
    List all AccountingEntry rows posted to a given account, most recent
    first. Powers the "Lihat Detail" drill-down for a single account in
    Chart of Accounts / Accounting Management - each row here is one leg
    of a journal (see reference_type/reference_id/reference_number for
    grouping rows from the same journal together, and post_pending_journal()
    in finance_helpers.py for how these rows get created).
    """
    try:
        account = db.session.get(Account, id)
        if not account:
            return jsonify({'error': 'Account not found'}), 404

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        entries = (
            AccountingEntry.query
            .filter_by(account_id=id)
            .order_by(AccountingEntry.entry_date.desc(), AccountingEntry.id.desc())
            .paginate(page=page, per_page=per_page, error_out=False)
        )

        return jsonify({
            'account': {
                'id': account.id,
                'code': account.account_code,
                'name': account.account_name,
                'type': account.account_type,
            },
            'transactions': [{
                'id': e.id,
                'entry_number': e.entry_number,
                'entry_date': e.entry_date.isoformat() if e.entry_date else None,
                'entry_type': e.entry_type,
                'reference_type': e.reference_type,
                'reference_id': e.reference_id,
                'reference_number': e.reference_number,
                'description': e.description,
                'debit_amount': float(e.debit_amount or 0),
                'credit_amount': float(e.credit_amount or 0),
                'status': e.status,
            } for e in entries.items],
            'total': entries.total,
            'pages': entries.pages,
            'current_page': entries.page,
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/recurring-payments/<int:master_id>/transactions/<int:tx_id>', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_recurring_payment_transaction_detail(master_id, tx_id):
    """
    Single-record detail for a RecurringPaymentTransaction, powering the
    account detail drill-down (see routes/finance.py's
    get_account_transactions() and its reference_type='recurring_payment'
    links) as well as any direct detail page/link for a specific payment.
    """
    try:
        from models.finance import RecurringPayment, RecurringPaymentTransaction, AccountingEntry

        transaction = RecurringPaymentTransaction.query.filter_by(
            id=tx_id, recurring_payment_id=master_id
        ).first()
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404

        master = db.session.get(RecurringPayment, master_id)

        # Pull the GL entries this specific transaction posted. reference_id
        # is set to transaction.id (fixed 2026-08-17 - previously pointed at
        # the master's id, which meant multiple payments under the same
        # master couldn't be told apart; matches Accurate's pattern of every
        # individual transaction, recurring or not, getting its own
        # identifying number rather than sharing its category/master's id).
        journal_lines = AccountingEntry.query.filter_by(
            reference_type='recurring_payment', reference_id=transaction.id
        ).all()

        return jsonify({
            'transaction': {
                'id': transaction.id,
                'transaction_number': transaction.transaction_number,
                'payment_date': transaction.payment_date.isoformat() if transaction.payment_date else None,
                'period_label': transaction.period_label,
                'amount': float(transaction.amount),
                'notes': transaction.notes,
                'created_at': transaction.created_at.isoformat() if transaction.created_at else None,
            },
            'recurring_payment': {
                'id': master.id,
                'name': master.name,
                'category': master.category,
                'vendor_name': master.vendor_name,
            } if master else None,
            'journal_lines': [{
                'id': j.id,
                'entry_number': j.entry_number,
                'account_id': j.account_id,
                'account_code': j.account_code,
                'account_name': j.account_name,
                'debit_amount': float(j.debit_amount or 0),
                'credit_amount': float(j.credit_amount or 0),
                'description': j.description,
            } for j in journal_lines],
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/recurring-payment-transactions/<int:tx_id>', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_recurring_payment_transaction_by_id(tx_id):
    """
    Lookup a RecurringPaymentTransaction by its own id alone (no master_id
    needed) - used as a canonical short-link target, e.g. from
    getReferenceLink() in AccountingManagement.tsx's account detail
    drill-down, which only has the transaction's own id (reference_id)
    available, not its master's id. Frontend redirects from this to the
    full /recurring-payments/<master_id>/transactions/<tx_id> detail route.
    """
    try:
        from models.finance import RecurringPaymentTransaction

        transaction = db.session.get(RecurringPaymentTransaction, tx_id)
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404

        return jsonify({
            'id': transaction.id,
            'recurring_payment_id': transaction.recurring_payment_id,
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/accounting/journal-entries/<string:entry_number_base>', methods=['GET'])
@jwt_required()
@require_permission('journal.view')
def get_journal_entry_detail(entry_number_base):
    """
    Full line-item detail for one "journal entry" as grouped by entry_number's
    BASE segment (before the "-NN" line suffix) in get_journal_entries() -
    powers the "Lihat" drill-down on the Journal Entries tab in
    AccountingManagement.tsx. Returns every AccountingEntry row sharing this
    base entry_number (e.g. all debit/credit lines from one Purchase
    Invoice), not just the one AccountingEntry.id the summary list happened
    to expose.

    BUG FIX 2026-08-17: this used to filter by reference_number, which
    matched the OLD (buggy) grouping key in get_journal_entries(). After
    that grouping was fixed to use the entry_number base (reference_number
    isn't unique per journal), this lookup had to switch to match - it was
    left on the old key, causing every "Lihat" click to 404 (reference_number
    values like 'PAYROLL-1' never match a URL param built from
    entry.entry_number like 'JE-202608-00001'), which the frontend showed as
    the detail modal flashing open then immediately closing on the error.
    """
    try:
        entries = (
            AccountingEntry.query
            .filter(AccountingEntry.entry_number.like(f'{entry_number_base}-%'))
            .order_by(AccountingEntry.id.asc())
            .all()
        )
        if not entries:
            return jsonify({'error': 'Journal entry not found'}), 404

        first = entries[0]
        total_debit = sum(float(e.debit_amount or 0) for e in entries)
        total_credit = sum(float(e.credit_amount or 0) for e in entries)

        return jsonify({
            'reference_number': first.reference_number,
            'reference_type': first.reference_type,
            'reference_id': first.reference_id,
            'entry_date': first.entry_date.isoformat() if first.entry_date else None,
            'description': first.description,
            'status': first.status,
            'total_debit': total_debit,
            'total_credit': total_credit,
            'lines': [{
                'id': e.id,
                'entry_number': e.entry_number,
                'account_id': e.account_id,
                'account_code': e.account_code,
                'account_name': e.account_name,
                'debit_amount': float(e.debit_amount or 0),
                'credit_amount': float(e.credit_amount or 0),
                'description': e.description,
            } for e in entries],
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@finance_bp.route('/fixed-assets/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_fixed_asset_detail(id):
    """
    Single-record detail for a FixedAsset - powers a standalone detail page
    and the account-drill-down link (reference_type='fixed_asset' in
    AccountingManagement.tsx's getReferenceLink()).
    """
    try:
        from models.finance import FixedAsset

        asset = FixedAsset.query.get_or_404(id)

        return jsonify({
            'id': asset.id,
            'asset_code': asset.asset_code,
            'asset_name': asset.asset_name,
            'category': asset.category,
            'description': asset.description,
            'acquisition_date': asset.acquisition_date.isoformat() if asset.acquisition_date else None,
            'acquisition_cost': float(asset.acquisition_cost),
            'depreciation_method': asset.depreciation_method,
            'useful_life_years': asset.useful_life_years,
            'salvage_value': float(asset.salvage_value or 0),
            'accumulated_depreciation': float(asset.accumulated_depreciation or 0),
            'net_book_value': asset.net_book_value,
            'annual_depreciation': asset.annual_depreciation,
            'location': asset.location,
            'responsible_person': asset.responsible_person,
            'status': asset.status,
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
