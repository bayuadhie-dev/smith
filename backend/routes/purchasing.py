from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import redis
import os
import json
from models import db, Supplier, PurchaseOrder, PurchaseOrderItem, GoodsReceivedNote, GRNItem, Notification, Invoice
from utils.i18n import success_response, error_response, get_message
from utils.auth_decorators import require_permission
from models.purchasing import (
    PurchaseOrderItemSchedule,
    PurchaseApproval, SupplierQuote, PurchaseRFQ, RFQItem, SupplierQuoteItem,
    SupplierContract, ContractItem, PriceHistory
)
from models.user import User
from models.product import Product, Material
from utils import generate_number, generate_number_v2
from utils.business_rules import BusinessRules, ValidationError, PURCHASE_ORDER_TRANSITIONS
from datetime import datetime, date, timedelta
from sqlalchemy import and_, or_, desc, asc, func
from utils.timezone import get_local_now, get_local_today

purchasing_bp = Blueprint('purchasing', __name__)


def _sync_po_received(po_id):
    """Hitung ulang PurchaseOrderItem.quantity_received dari jumlah DITERIMA (accepted) di semua GRN PO ini
    (GRN yang ditolak tidak dihitung). Sumber kebenaran tetap baris GRN; kolom ini hanya salinan untuk tampilan."""
    for it in PurchaseOrderItem.query.filter_by(po_id=po_id).all():
        total = db.session.query(db.func.coalesce(db.func.sum(GRNItem.quantity_accepted), 0)) \
            .join(GoodsReceivedNote, GoodsReceivedNote.id == GRNItem.grn_id) \
            .filter(GRNItem.po_item_id == it.id, GoodsReceivedNote.status != 'rejected').scalar() or 0
        it.quantity_received = float(total)


def _apply_po_tax(po):
    """Hitung pajak PO dari dua centang: Kena Pajak (is_taxable) dan Total termasuk pajak (tax_inclusive).
    - tidak kena pajak: tanpa PPN
    - kena pajak: PPN sesuai kode (Y/A/B/L) ditambahkan di atas harga
    - kena pajak + termasuk pajak: harga sudah memuat PPN; PPN dipisahkan (DPP = harga - PPN), total tetap
    Mengisi tax_percent/tax_amount tiap baris, po.subtotal (DPP), po.tax_amount dan po.total_amount."""
    from utils.tax_helpers import ppn_rate_for_code
    items = PurchaseOrderItem.query.filter_by(po_id=po.id).all()
    rate = 0.0
    if po.is_taxable:
        if not po.ppn_code:
            sup = db.session.get(Supplier, po.supplier_id)
            po.ppn_code = (sup.ppn_code if sup and sup.ppn_code else 'Y')
        rate = ppn_rate_for_code(po.ppn_code) or 0.0
    inclusive = bool(po.is_taxable and po.tax_inclusive and rate)
    gross = tax_total = 0.0
    for it in items:
        base = float(it.total_price or 0)
        if not rate:
            tax = 0.0
        elif inclusive:
            tax = round(base - base / (1 + rate / 100), 2)
        else:
            tax = round(base * rate / 100, 2)
        it.tax_percent = rate
        it.tax_amount = tax
        gross += base
        tax_total += tax
    po.tax_amount = round(tax_total, 2)
    po.subtotal = round(gross - tax_total, 2) if inclusive else round(gross, 2)
    po.total_amount = _calculate_po_total(po, float(po.subtotal))


def _calculate_po_total(po, subtotal):
    """Single source of truth for PurchaseOrder.total_amount - create and
    update used to compute this two different ways (create ignored tax/
    discount/shipping entirely, update included them), so a PO approved
    without ever being edited kept a permanently wrong total whenever those
    fields applied."""
    return subtotal + float(po.shipping_cost or 0) + float(po.tax_amount or 0) - float(po.discount_amount or 0)


# Multi-currency PO (2026-10-19, po_multicurrency_plan.md). Only currencies
# that utils/exchange_rates.py actually tracks rates for.
PO_ALLOWED_CURRENCIES = ('IDR', 'USD', 'CNY')


def _validate_po_currency(value):
    """Return the normalized currency code, or raise ValueError."""
    currency = (value or 'IDR').strip().upper()
    if currency not in PO_ALLOWED_CURRENCIES:
        raise ValueError(f"Mata uang '{currency}' tidak didukung. Pilihan: {', '.join(PO_ALLOWED_CURRENCIES)}")
    return currency


def _parse_manual_rate(value):
    """Kurs manual dari form: kosong -> None; angka > 0 -> float; selain itu ValueError."""
    if value in (None, ''):
        return None
    try:
        rate = float(value)
    except (TypeError, ValueError):
        raise ValueError('Kurs manual harus berupa angka')
    if rate <= 0:
        raise ValueError('Kurs manual harus lebih dari 0')
    return rate


def _po_amount_idr(po, amount):
    return float(amount or 0) * float(po.exchange_rate or 1)

@purchasing_bp.route('/suppliers', methods=['GET'])
@jwt_required()
@require_permission('suppliers.view')
def get_suppliers():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        search = request.args.get('search', '')
        supplier_type = request.args.get('supplier_type', '')
        is_active_raw = request.args.get('is_active', '')

        # Try cache
        cache_key = f'purchasing_suppliers_page{page}_per{per_page}_search{search}_type{supplier_type}_active{is_active_raw}'
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            cached_data = r.get(cache_key)
            if cached_data:
                return jsonify(json.loads(cached_data)), 200
        except Exception as cache_error:
            print(f"Redis cache error (using fallback): {cache_error}")

        query = Supplier.query

        if search:
            query = query.filter(
                db.or_(
                    Supplier.company_name.ilike(f'%{search}%'),
                    Supplier.code.ilike(f'%{search}%'),
                    Supplier.contact_person.ilike(f'%{search}%')
                )
            )

        if supplier_type:
            query = query.filter(Supplier.supplier_type == supplier_type)

        if is_active_raw == 'true':
            query = query.filter(Supplier.is_active == True)
        elif is_active_raw == 'false':
            query = query.filter(Supplier.is_active == False)
        else:
            query = query.filter(Supplier.is_active == True)

        suppliers = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        response_data = {
            'suppliers': [{
                'id': s.id,
                'code': s.code,
                'name': s.company_name,  # Frontend expects 'name'
                'company_name': s.company_name,
                'contact_person': s.contact_person,
                'email': s.email,
                'phone': s.phone,
                'address': s.address,
                'city': s.city,
                'country': s.country,
                'supplier_type': s.supplier_type,
                'payment_terms': str(s.payment_terms_days) if s.payment_terms_days is not None else '30',
                'credit_limit': float(s.credit_limit) if s.credit_limit else 0.0,
                'rating': s.rating,
                'ppn_code': s.ppn_code,
                'is_active': s.is_active,
                'created_at': s.created_at.isoformat() if s.created_at else None
            } for s in suppliers.items],
            'total': suppliers.total,
            'pages': suppliers.pages,
            'current_page': suppliers.page
        }
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            r.setex(cache_key, 300, json.dumps(response_data))
        except Exception as cache_error:
            print(f"Redis cache set error (continuing without cache): {cache_error}")
            
        return jsonify(response_data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/suppliers/types', methods=['GET'])
@jwt_required()
@require_permission('suppliers.view')
def get_supplier_types():
    """Distinct supplier_type values actually in use - the filter dropdown
    used to hardcode manufacturer/distributor/trader/service, which never
    matched the real category values imported from Accurate's vendor export."""
    rows = db.session.query(Supplier.supplier_type).filter(
        Supplier.supplier_type.isnot(None), Supplier.supplier_type != ''
    ).distinct().order_by(Supplier.supplier_type).all()
    return jsonify({'types': [r[0] for r in rows]}), 200


@purchasing_bp.route('/suppliers', methods=['POST'])
@jwt_required()
@require_permission('suppliers.create')
def create_supplier():
    try:
        data = request.get_json()
        
        # Generate supplier code if not provided
        supplier_code = data.get('code')
        if not supplier_code:
            # Generate code like SUP-001, SUP-002, etc.
            last_supplier = Supplier.query.order_by(Supplier.id.desc()).first()
            next_num = (last_supplier.id + 1) if last_supplier else 1
            supplier_code = f"SUP-{next_num:03d}"
        
        supplier = Supplier(
            code=supplier_code,
            company_name=data.get('name') or data.get('company_name'),  # Frontend sends 'name'
            contact_person=data.get('contact_person'),
            email=data.get('email'),
            phone=data.get('phone'),
            address=data.get('address'),
            city=data.get('city'),
            postal_code=data.get('postal_code'),
            country=data.get('country', 'Indonesia'),
            tax_id=data.get('tax_id'),
            payment_terms_days=int(data.get('payment_terms', 30)) if data.get('payment_terms') else 30,
            credit_limit=float(data.get('credit_limit', 0)) if data.get('credit_limit') else 0.0,
            supplier_type=data.get('supplier_type'),
            ppn_code=(str(data.get('ppn_code')).strip().upper()[:1] or None) if data.get('ppn_code') else None,
            is_active=data.get('is_active', True),
            notes=data.get('notes'),
            created_at=get_local_now()
        )
        db.session.add(supplier)
        db.session.commit()
        
        # Invalidate cache
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            keys = r.keys('purchasing_suppliers_*')
            if keys:
                r.delete(*keys)
        except Exception as cache_error:
            print(f"Redis cache invalidation error (continuing): {cache_error}")
            
        return jsonify({'message': 'Supplier created', 'supplier_id': supplier.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/suppliers/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('suppliers.view')
def get_supplier(id):
    try:
        supplier = db.session.get(Supplier, id)
        if not supplier:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        return jsonify({
            'id': supplier.id,
            'code': supplier.code,
            'name': supplier.company_name,  # Frontend expects 'name'
            'company_name': supplier.company_name,
            'contact_person': supplier.contact_person,
            'email': supplier.email,
            'phone': supplier.phone,
            'address': supplier.address,
            'city': supplier.city,
            'postal_code': supplier.postal_code,
            'country': supplier.country,
            'tax_id': supplier.tax_id,
            'payment_terms': str(supplier.payment_terms_days) if supplier.payment_terms_days is not None else '30',
            'credit_limit': float(supplier.credit_limit) if supplier.credit_limit else 0.0,
            'supplier_type': supplier.supplier_type,
            'rating': supplier.rating,
            'ppn_code': supplier.ppn_code,
            'is_active': supplier.is_active,
            'notes': supplier.notes,
            'created_at': supplier.created_at.isoformat() if supplier.created_at else None
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/suppliers/<int:id>/scorecard', methods=['GET'])
@jwt_required()
@require_permission('suppliers.view')
def get_supplier_scorecard(id):
    """Vendor Scorecard (SAP MM concept) - real score computed from this supplier's
    actual PO/GRN/Invoice history, not the manual/unused-elsewhere A/B/C `rating`
    field. See utils/vendor_scorecard.py for the calculation."""
    try:
        supplier = db.session.get(Supplier, id)
        if not supplier:
            return jsonify(error_response('api.error', error_code=404)), 404
        from utils.vendor_scorecard import compute_vendor_scorecard
        return jsonify(compute_vendor_scorecard(id)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/suppliers/scorecards', methods=['GET'])
@jwt_required()
@require_permission('suppliers.view')
def get_all_supplier_scorecards():
    """Bulk vendor scorecards for every active supplier - powers a list/dashboard view
    without N+1 requests from the frontend."""
    try:
        from utils.vendor_scorecard import compute_vendor_scorecard
        suppliers = Supplier.query.filter_by(is_active=True).all()
        return jsonify({
            'scorecards': [compute_vendor_scorecard(s.id) for s in suppliers]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/suppliers/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('suppliers.edit')
def update_supplier(id):
    try:
        supplier = db.session.get(Supplier, id)
        if not supplier:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        data = request.get_json()
        
        # Update supplier fields
        if 'name' in data:
            supplier.company_name = data['name']
        if 'company_name' in data:
            supplier.company_name = data['company_name']
        if 'contact_person' in data:
            supplier.contact_person = data['contact_person']
        if 'email' in data:
            supplier.email = data['email']
        if 'phone' in data:
            supplier.phone = data['phone']
        if 'address' in data:
            supplier.address = data['address']
        if 'city' in data:
            supplier.city = data['city']
        if 'postal_code' in data:
            supplier.postal_code = data['postal_code']
        if 'country' in data:
            supplier.country = data['country']
        if 'tax_id' in data:
            supplier.tax_id = data['tax_id']
        if 'payment_terms' in data:
            supplier.payment_terms_days = int(data['payment_terms']) if data['payment_terms'] else 30
        if 'credit_limit' in data:
            supplier.credit_limit = float(data['credit_limit']) if data['credit_limit'] else 0.0
        if 'supplier_type' in data:
            supplier.supplier_type = data['supplier_type']
        if 'ppn_code' in data:
            supplier.ppn_code = (str(data['ppn_code']).strip().upper()[:1] or None) if data['ppn_code'] else None
        if 'is_active' in data:
            supplier.is_active = bool(data['is_active'])
        if 'notes' in data:
            supplier.notes = data['notes']
        
        supplier.updated_at = get_local_now()
        
        db.session.commit()
        
        # Invalidate cache
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            keys = r.keys('purchasing_suppliers_*')
            if keys:
                r.delete(*keys)
        except Exception as cache_error:
            print(f"Redis cache invalidation error (continuing): {cache_error}")
            
        return jsonify(success_response('api.success')), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/suppliers/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('suppliers.delete')
def delete_supplier(id):
    try:
        supplier = db.session.get(Supplier, id)
        if not supplier:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        # Check if supplier has any purchase orders
        if supplier.purchase_orders:
            return jsonify(error_response('api.error', error_code=400)), 400
        
        # Soft delete by setting is_active to False
        supplier.is_active = False
        supplier.updated_at = get_local_now()
        
        db.session.commit()
        
        # Invalidate cache
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            keys = r.keys('purchasing_suppliers_*')
            if keys:
                r.delete(*keys)
        except Exception as cache_error:
            print(f"Redis cache invalidation error (continuing): {cache_error}")
            
        return jsonify(success_response('api.success')), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/purchase-orders', methods=['GET'])
@jwt_required()
@require_permission('purchase_orders.view')
def get_purchase_orders():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        search = request.args.get('search', '').strip()
        status = request.args.get('status', '').strip()
        priority = request.args.get('priority', '').strip()
        supplier_filter = request.args.get('supplier_id', type=int)

        query = PurchaseOrder.query
        if supplier_filter:
            query = query.filter(PurchaseOrder.supplier_id == supplier_filter)
        if search:
            query = query.filter(PurchaseOrder.po_number.ilike(f'%{search}%'))
        if status:
            statuses = [s.strip() for s in status.split(',') if s.strip()]
            query = query.filter(PurchaseOrder.status.in_(statuses))
        if priority:
            query = query.filter(PurchaseOrder.priority == priority)

        pos = query.order_by(PurchaseOrder.order_date.desc()).paginate(page=page, per_page=per_page)

        return jsonify({
            'purchase_orders': [{
                'id': po.id,
                'po_number': po.po_number,
                'supplier_id': po.supplier_id,
                'supplier_name': po.supplier.company_name,
                'order_date': po.order_date.isoformat(),
                'status': po.status,
                'priority': po.priority,
                'total_amount': float(po.total_amount),
                'currency': po.currency,
                'exchange_rate': float(po.exchange_rate or 1),
                'exchange_rate_source': po.exchange_rate_source,
                'total_amount_idr': _po_amount_idr(po, po.total_amount)
            } for po in pos.items],
            'total': pos.total
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _apply_item_schedules(item, schedules):
    """Replace the planned deliveries of a PO line. Raises ValueError when invalid."""
    rows = []
    total = 0.0
    for sc in schedules or []:
        if not sc.get('expected_date') and not sc.get('quantity'):
            continue
        try:
            qty = float(sc.get('quantity') or 0)
            when = datetime.fromisoformat(str(sc['expected_date'])[:10]).date()
        except (KeyError, ValueError, TypeError):
            raise ValueError(f'Jadwal baris {item.line_number}: tanggal atau jumlah tidak valid')
        if qty <= 0:
            raise ValueError(f'Jadwal baris {item.line_number}: jumlah harus lebih dari 0')
        total += qty
        rows.append((when, qty, (sc.get('notes') or '')[:255] or None))
    if total > float(item.quantity) + 0.0001:
        raise ValueError(f'Jadwal baris {item.line_number}: total jadwal ({total:g}) melebihi jumlah pesanan ({float(item.quantity):g})')
    item.schedules[:] = [PurchaseOrderItemSchedule(expected_date=w, quantity=q, notes=n) for w, q, n in rows]


def _po_source_list_errors(data, supplier_id):
    """Pelanggaran source list (material dengan ApprovedVendor aktif hanya boleh dibeli dari supplier terdaftar)."""
    from models.purchasing import ApprovedVendor
    source_list_errors = []
    for item_data in data.get('items', []):
        material_id = item_data.get('material_id')
        if not material_id:
            continue
        has_source_list = ApprovedVendor.query.filter_by(material_id=material_id, is_active=True).first()
        if has_source_list:
            approved = ApprovedVendor.query.filter_by(
                material_id=material_id, supplier_id=supplier_id, is_active=True
            ).first()
            if not approved:
                material = db.session.get(Material, material_id)
                source_list_errors.append(
                    f"{material.name if material else f'Material #{material_id}'} tidak ada di source list supplier ini"
                )
    return source_list_errors


def create_purchase_order_core(data, user_id, po_number=None):
    """Buat PurchaseOrder draft + item (+ jadwal kedatangan) + total, TANPA commit (dipakai endpoint dan Pusat Impor). ValueError bila mata uang tidak valid."""
    custom_number = (str(data.get('po_number')).strip() if data.get('po_number') else '')
    if not po_number and custom_number:
        if len(custom_number) > 100:
            raise ValueError('Nomor PO maksimal 100 karakter')
        if PurchaseOrder.query.filter(db.func.lower(PurchaseOrder.po_number) == custom_number.lower()).first():
            raise ValueError(f'Nomor PO {custom_number} sudah dipakai')
        po_number = custom_number
    po_number = po_number or generate_number_v2('purchase_order', 'PO', PurchaseOrder, 'po_number')

    currency = _validate_po_currency(data.get('currency'))
    manual_rate = _parse_manual_rate(data.get('manual_exchange_rate')) if currency != 'IDR' else None

    po = PurchaseOrder(
        po_number=po_number,
        supplier_id=data['supplier_id'],
        order_date=datetime.fromisoformat(data['order_date']),
        required_date=datetime.fromisoformat(data['required_date']) if data.get('required_date') else None,
        expected_date=datetime.fromisoformat(data['expected_date']).date() if data.get('expected_date') else None,
        status='draft',
        payment_terms=data.get('payment_terms'),
        delivery_address=data.get('delivery_address'),
        notes=data.get('notes'),
        # exchange_rate is never taken from the client; it stays 1 until
        # submit_for_approval locks the real rate.
        currency=currency,
        exchange_rate=1,
        manual_exchange_rate=manual_rate,
        is_taxable=bool(data.get('is_taxable')),
        tax_inclusive=bool(data.get('is_taxable') and data.get('tax_inclusive')),
        ppn_code=(str(data.get('ppn_code')).strip().upper()[:1] or None) if data.get('ppn_code') else None,
        created_by=user_id
    )
    
    db.session.add(po)
    db.session.flush()
    
    subtotal = 0
    for idx, item_data in enumerate(data.get('items', []), 1):
        item_total = item_data['quantity'] * item_data['unit_price']
        
        item = PurchaseOrderItem(
            po_id=po.id,
            line_number=idx,
            product_id=item_data.get('product_id'),
            material_id=item_data.get('material_id'),
            quantity=item_data['quantity'],
            uom=item_data.get('uom', 'PCS'),  # Default to PCS if not provided
            unit_price=item_data['unit_price'],
            total_price=item_total
        )
        db.session.add(item)
        if item_data.get('schedules'):
            _apply_item_schedules(item, item_data['schedules'])
        subtotal += item_total
    
    po.subtotal = subtotal
    po.total_amount = _calculate_po_total(po, subtotal)
    db.session.flush()
    _apply_po_tax(po)
    return po


@purchasing_bp.route('/purchase-orders', methods=['POST'])
@jwt_required()
@require_permission('purchase_orders.create')
def create_purchase_order():
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # BUSINESS RULE: Validate supplier status
        supplier_id = data.get('supplier_id')
        if supplier_id:
            try:
                supplier = db.session.get(Supplier, supplier_id)
                if not supplier:
                    return jsonify({'error': 'Supplier not found'}), 404
                if not supplier.is_active:
                    return jsonify({'error': 'Supplier is inactive'}), 400
            except Exception as supplier_error:
                print(f"Supplier validation warning: {supplier_error}")
        
        # Source List enforcement (2026-09-14, readiness build - see
        # project_accurate_vs_custom_erp_scope memory) - a material with ANY
        # active ApprovedVendor row restricts which supplier a PO for it can
        # use; a material with none is unrestricted (opt-in, never
        # retroactively blocks materials nobody has configured yet).
        source_list_errors = _po_source_list_errors(data, supplier_id)
        if source_list_errors:
            return jsonify({'error': 'Source list violation', 'details': source_list_errors}), 400

        po = create_purchase_order_core(data, user_id)
        po_number = po.po_number

        db.session.commit()

        # CREATE NOTIFICATION: Purchase Order Created
        try:
            notification = Notification(
                user_id=user_id,
                notification_type='success',
                category='purchasing',
                title='Purchase Order Created',
                message=f'Purchase Order {po_number} created successfully for {po.supplier.company_name if po.supplier else "supplier"}',
                reference_type='purchase_order',
                reference_id=po.id,
                priority='normal',
                action_url=f'/app/purchasing/purchase-orders/{po.id}'
            )
            db.session.add(notification)
            db.session.commit()
        except Exception as notif_error:
            print(f"Notification creation failed: {notif_error}")
        
        return jsonify({'message': 'PO created', 'po_id': po.id, 'po_number': po_number}), 201
    except ValueError as ve:
        db.session.rollback()
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/purchase-orders/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('purchase_orders.view')
def get_purchase_order(id):
    try:
        po = db.session.get(PurchaseOrder, id)
        if not po:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        return jsonify({
            'id': po.id,
            'po_number': po.po_number,
            'supplier_id': po.supplier_id,
            'supplier': {
                'id': po.supplier.id,
                'company_name': po.supplier.company_name
            },
            'order_date': po.order_date.isoformat(),
            'required_date': po.required_date.isoformat() if po.required_date else None,
            'expected_date': po.expected_date.isoformat() if po.expected_date else None,
            'delivery_date': po.delivery_date.isoformat() if po.delivery_date else None,
            'status': po.status,
            'priority': po.priority,
            'payment_terms': po.payment_terms,
            'payment_method': po.payment_method,
            'is_taxable': bool(po.is_taxable),
            'tax_inclusive': bool(po.tax_inclusive),
            'ppn_code': po.ppn_code,
            'delivery_address': po.delivery_address,
            'shipping_method': po.shipping_method,
            'shipping_cost': float(po.shipping_cost or 0),
            'notes': po.notes,
            'internal_notes': po.internal_notes,
            'subtotal': float(po.subtotal or 0),
            'tax_amount': float(po.tax_amount or 0),
            'discount_amount': float(po.discount_amount or 0),
            'total_amount': float(po.total_amount),
            'currency': po.currency,
            'exchange_rate': float(po.exchange_rate or 1),
            'exchange_rate_source': po.exchange_rate_source,
            'manual_exchange_rate': float(po.manual_exchange_rate) if po.manual_exchange_rate else None,
            'total_amount_idr': _po_amount_idr(po, po.total_amount),
            'has_grn': len(po.grn_records) > 0,
            'items': [{
                'id': i.id,
                'product_id': i.product_id,
                'product_code': i.product.code if i.product else None,
                'product_name': i.product.name if i.product else None,
                'material_id': i.material_id,
                'material_code': i.material.code if i.material else None,
                'material_name': i.material.name if i.material else None,
                'description': i.description,
                'quantity': float(i.quantity),
                'uom': i.uom,
                'unit_price': float(i.unit_price),
                'total_price': float(i.total_price),
                'quantity_received': float(i.quantity_received or 0),
                'quantity_invoiced': float(i.quantity_invoiced or 0),
                'schedules': [sc.to_dict() for sc in i.schedules],
            } for i in po.items]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/purchase-orders/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('purchase_orders.edit')
def update_purchase_order(id):
    """Update a Purchase Order. Accurate Online links Penerimaan Barang
    (goods receipt) directly to a PO, auto-filling the receipt from the
    PO's items/quantities (help.accurate.id, "Cara Menerima Barang dari
    Pesanan Pembelian yang Sudah Dibuat") - once a receipt exists against a
    PO, the PO's committed quantities/prices are the values already used to
    post that receipt, so we lock item-level (product/quantity/price)
    changes once any GoodsReceivedNote exists for this PO. Header fields
    that don't affect what was already received (notes, delivery date,
    priority, payment terms, shipping) remain editable at any time."""
    try:
        po = db.session.get(PurchaseOrder, id)
        if not po:
            return jsonify(error_response('api.error', error_code=404)), 404

        if po.status == 'cancelled':
            return jsonify({'error': 'Purchase Order sudah dibatalkan, tidak bisa diubah'}), 400

        data = request.get_json() or {}
        has_grn = len(po.grn_records) > 0

        # Setting status='cancelled' through this endpoint used to skip the
        # same GRN/Invoice checks delete_purchase_order already enforces -
        # a PO with real receipts/invoices against it could be cancelled
        # here with no guard at all. Apply the identical check.
        if data.get('status') == 'cancelled' and po.status != 'cancelled':
            if has_grn:
                return jsonify({'error': 'Purchase Order tidak bisa dibatalkan karena sudah memiliki Penerimaan Barang (GRN)'}), 400
            invoiced = Invoice.query.filter(
                Invoice.purchase_order_id == po.id,
                Invoice.invoice_type == 'purchase',
                Invoice.status != 'cancelled'
            ).first()
            if invoiced:
                return jsonify({'error': 'Purchase Order tidak bisa dibatalkan karena sudah memiliki Faktur Pembelian'}), 400

            # No GRN/Invoice exists yet (checked above), so any budget
            # commitment reserved at approval is still fully outstanding -
            # release it all now that the PO itself is being cancelled.
            if po.status == 'approved':
                from utils.finance_helpers import release_po_budget_commitment
                release_po_budget_commitment(po)

        if 'currency' in data:
            try:
                new_currency = _validate_po_currency(data['currency'])
            except ValueError as ve:
                return jsonify({'error': str(ve)}), 400
            if new_currency != po.currency:
                if po.status != 'draft':
                    return jsonify({'error': 'Mata uang hanya bisa diubah saat PO masih draft'}), 400
                po.currency = new_currency

        header_fields = ['priority', 'payment_terms', 'payment_method', 'delivery_address',
                          'shipping_method', 'notes', 'internal_notes', 'status']
        for field in header_fields:
            if field in data:
                setattr(po, field, data[field])

        if 'manual_exchange_rate' in data:
            if po.status != 'draft':
                return jsonify({'error': 'Kurs manual hanya bisa diubah saat PO masih draft'}), 400
            po.manual_exchange_rate = _parse_manual_rate(data['manual_exchange_rate']) if po.currency != 'IDR' else None
        if po.currency == 'IDR':
            po.manual_exchange_rate = None
        tax_changed = False
        if not has_grn and ('is_taxable' in data or 'tax_inclusive' in data or 'ppn_code' in data):
            po.is_taxable = bool(data.get('is_taxable', po.is_taxable))
            po.tax_inclusive = bool(po.is_taxable and data.get('tax_inclusive', po.tax_inclusive))
            if 'ppn_code' in data:
                po.ppn_code = (str(data['ppn_code']).strip().upper()[:1] or None) if data['ppn_code'] else None
            tax_changed = True

        for date_field in ['required_date', 'expected_date', 'delivery_date']:
            if date_field in data and data[date_field]:
                setattr(po, date_field, datetime.fromisoformat(data[date_field]))

        if 'items' in data or 'supplier_id' in data:
            if has_grn:
                return jsonify({'error': 'Purchase Order sudah memiliki Penerimaan Barang (GRN), item dan supplier tidak bisa diubah'}), 400

            if 'supplier_id' in data:
                po.supplier_id = data['supplier_id']

            if 'items' in data:
                PurchaseOrderItem.query.filter_by(po_id=po.id).delete()
                subtotal = 0
                for idx, item_data in enumerate(data.get('items', []), 1):
                    item_total = item_data['quantity'] * item_data['unit_price']
                    item = PurchaseOrderItem(
                        po_id=po.id,
                        line_number=idx,
                        product_id=item_data.get('product_id'),
                        material_id=item_data.get('material_id'),
                        quantity=item_data['quantity'],
                        uom=item_data.get('uom', 'PCS'),
                        unit_price=item_data['unit_price'],
                        total_price=item_total
                    )
                    db.session.add(item)
                    if item_data.get('schedules'):
                        _apply_item_schedules(item, item_data['schedules'])
                    subtotal += item_total
                po.subtotal = subtotal
                po.total_amount = _calculate_po_total(po, subtotal)

        if not has_grn and ('items' in data or tax_changed or 'supplier_id' in data):
            db.session.flush()
            _apply_po_tax(po)

        db.session.commit()
        return jsonify({'message': 'PO updated', 'po_id': po.id}), 200
    except ValueError as ve:
        db.session.rollback()
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/purchase-orders/<int:id>/schedules', methods=['PUT'])
@jwt_required()
@require_permission('purchase_orders.edit')
def update_po_schedules(id):
    """Update planned delivery dates/qty per line; allowed even after GRN exists."""
    try:
        po = db.session.get(PurchaseOrder, id)
        if not po:
            return jsonify({'error': 'PO tidak ditemukan'}), 404
        if po.status in ('cancelled', 'closed', 'received'):
            return jsonify({'error': 'PO sudah selesai/dibatalkan, jadwal tidak bisa diubah'}), 400
        by_id = {i.id: i for i in po.items}
        for row in (request.get_json() or {}).get('items', []):
            item = by_id.get(row.get('item_id'))
            if item:
                _apply_item_schedules(item, row.get('schedules'))
        db.session.commit()
        return jsonify({'message': 'Jadwal kedatangan disimpan'}), 200
    except ValueError as ve:
        db.session.rollback()
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/purchase-orders/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('purchase_orders.delete')
def delete_purchase_order(id):
    """Delete a Purchase Order. Blocked once a Penerimaan Barang (GRN) has
    been recorded against it, mirroring Accurate's linkage between PO and
    goods receipt - deleting the PO at that point would orphan real
    inventory-receipt history."""
    try:
        po = db.session.get(PurchaseOrder, id)
        if not po:
            return jsonify(error_response('api.error', error_code=404)), 404

        if len(po.grn_records) > 0:
            return jsonify({'error': 'Purchase Order tidak bisa dihapus karena sudah memiliki Penerimaan Barang (GRN)'}), 400

        invoiced = Invoice.query.filter(
            Invoice.purchase_order_id == po.id,
            Invoice.invoice_type == 'purchase',
            Invoice.status != 'cancelled'
        ).first()
        if invoiced:
            return jsonify({'error': 'Purchase Order tidak bisa dihapus karena sudah memiliki Faktur Pembelian'}), 400

        if po.status == 'approved':
            from utils.finance_helpers import release_po_budget_commitment
            release_po_budget_commitment(po)

        db.session.delete(po)
        db.session.commit()
        return jsonify({'message': 'Purchase Order deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/grn', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def get_grns():
    try:
        grns = GoodsReceivedNote.query.order_by(GoodsReceivedNote.receipt_date.desc()).all()
        return jsonify({
            'grns': [{
                'id': g.id,
                'grn_number': g.grn_number,
                'po_number': g.purchase_order.po_number,
                'supplier_name': g.supplier.company_name,
                'receipt_date': g.receipt_date.isoformat(),
                'status': g.status
            } for g in grns]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/grn', methods=['POST'])
@jwt_required()
@require_permission('purchasing.create')
def create_grn():
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        grn_number = generate_number_v2('grn', 'GRN', GoodsReceivedNote, 'grn_number')

        # Multi-currency (2026-10-19): PO prices are in po.currency; stock
        # cost and the GR/IR journal must be IDR, using the rate locked at
        # submit_for_approval. A foreign-currency PO still in draft has no
        # locked rate yet, so it can't be received.
        grn_po = db.session.get(PurchaseOrder, data['po_id'])
        if not grn_po:
            return jsonify({'error': 'Purchase Order tidak ditemukan'}), 404
        if grn_po.status in ('draft', 'pending_approval', 'rejected', 'cancelled'):
            reason = {
                'draft': 'masih draft (belum di-submit untuk approval)',
                'pending_approval': 'masih menunggu approval',
                'rejected': 'ditolak',
                'cancelled': 'dibatalkan',
            }[grn_po.status]
            return jsonify({'error': f'PO {grn_po.po_number} {reason}. Barang baru bisa diterima setelah PO disetujui.'}), 400
        po_rate = float(grn_po.exchange_rate or 1)
        
        grn = GoodsReceivedNote(
            grn_number=grn_number,
            po_id=data['po_id'],
            supplier_id=data['supplier_id'],
            receipt_date=get_local_now(),
            delivery_note_number=data.get('delivery_note_number'),
            vehicle_number=data.get('vehicle_number'),
            driver_name=data.get('driver_name'),
            status='pending',
            received_by=user_id
        )
        
        db.session.add(grn)
        db.session.flush()
        
        from models import Inventory
        from utils.inventory_helpers import record_inventory_transaction
        from utils.finance_helpers import resolve_account
        from models.finance import GlobalAccountDefault

        stock_txns = []
        journal_lines = []
        total_gr_ir_amount = 0.0

        for item_data in data.get('items', []):
            product_id = item_data.get('product_id')
            material_id = item_data.get('material_id')
            location_id = item_data.get('location_id')
            quantity_received = float(item_data['quantity_received'])
            quantity_accepted = float(item_data.get('quantity_accepted', quantity_received))
            uom = item_data['uom']
            batch_number = item_data.get('batch_number')

            grn_item = GRNItem(
                grn_id=grn.id,
                po_item_id=item_data['po_item_id'],
                product_id=product_id,
                material_id=material_id,
                quantity_ordered=item_data['quantity_ordered'],
                quantity_received=quantity_received,
                quantity_accepted=quantity_accepted,
                uom=uom,
                batch_number=batch_number,
                lot_number=(item_data.get('lot_number') or None),
                production_date=datetime.strptime(item_data['production_date'][:10], '%Y-%m-%d').date() if item_data.get('production_date') else None,
                expiry_date=datetime.strptime(item_data['expiry_date'][:10], '%Y-%m-%d').date() if item_data.get('expiry_date') else None,
                notes=(item_data.get('notes') or None),
                location_id=location_id
            )
            db.session.add(grn_item)

            if location_id and (product_id or material_id):
                # Process inventory update
                inv_query = Inventory.query.filter_by(location_id=location_id)
                if product_id:
                    inv_query = inv_query.filter_by(product_id=product_id)
                else:
                    inv_query = inv_query.filter_by(material_id=material_id)
                
                if batch_number:
                    inv_query = inv_query.filter_by(batch_number=batch_number)
                
                inventory = inv_query.first()
                
                if not inventory:
                    from utils.inventory_helpers import resolve_initial_stock_status
                    inventory = Inventory(
                        product_id=product_id,
                        material_id=material_id,
                        location_id=location_id,
                        quantity_on_hand=0,
                        quantity_available=0,
                        batch_number=batch_number,
                        stock_status=resolve_initial_stock_status(
                            'available',
                            product=db.session.get(Product, product_id) if product_id else None,
                            material=db.session.get(Material, material_id) if material_id else None,
                        ),
                        grn_id=grn.id
                    )
                    db.session.add(inventory)
                
                # Update quantity
                inventory.quantity_on_hand = float(inventory.quantity_on_hand) + quantity_accepted
                inventory.quantity_available = float(inventory.quantity_available) + quantity_accepted
                inventory.updated_at = get_local_now()
                
                # Ensure the inventory record is saved so we can get its ID for movement
                db.session.flush()

                # 2026-09-21: look up the PO item's price up front so it can
                # be stamped onto the movement as unit_cost - fifo_helper.py's
                # _get_inventory_unit_cost() reads this back later (via the
                # most recent 'in' InventoryTransaction for the same batch)
                # as the primary cost source for FIFO deduction/COGS, so a
                # receipt with no unit_cost here silently falls through to a
                # less accurate material/product-level fallback cost.
                po_item = db.session.get(PurchaseOrderItem, item_data['po_item_id'])
                receipt_unit_cost = (float(po_item.unit_price) * po_rate) if po_item and po_item.unit_price else None

                # Record movement
                movement = record_inventory_transaction(
                    transaction_type='stock_in',
                    direction='in',
                    quantity=quantity_accepted,
                    product_id=product_id,
                    material_id=material_id,
                    to_location_id=location_id,
                    reference_number=grn_number,
                    reference_type='purchase_order',
                    reference_id=grn.id,
                    batch_number=batch_number,
                    unit_cost=receipt_unit_cost,
                    total_cost=(receipt_unit_cost * quantity_accepted) if receipt_unit_cost else None,
                    notes=f"Receipt from GRN {grn_number}",
                    created_by=user_id
                )
                stock_txns.append(movement)

                # Fase 3 (2026-09-21): GR/IR clearing - post a provisional
                # journal for the goods just received, valued at the PO
                # price (the invoice hasn't arrived yet). Purchase Invoice's
                # own journal construction (routes/purchase_invoice.py) is
                # the counterpart that reverses this clearing balance when
                # the real invoice posts - see plan.md section 7. Only
                # stocked items go through GR/IR (service/expense lines on
                # an invoice never receive goods via GRN in the first
                # place), so this reuses the same "is it inventory" gate as
                # the stock movement above (product_id/material_id present).
                if po_item and quantity_accepted > 0:
                    line_amount = quantity_accepted * float(po_item.unit_price or 0) * po_rate
                    if line_amount > 0:
                        debit_slot = 'akun_persediaan_id'
                        try:
                            debit_account_id = resolve_account(debit_slot, product_id=product_id, category_id=None)
                            journal_lines.append({
                                'account_id': debit_account_id,
                                'debit': line_amount,
                                'credit': 0,
                                'description': f'Penerimaan barang GRN {grn_number} - {batch_number or ""}',
                            })
                            total_gr_ir_amount += line_amount
                        except ValueError:
                            # Persediaan default not configured - stock/GRN
                            # effect above still applies, GR/IR posting is
                            # skipped for this line rather than failing the
                            # whole GRN (same fallback pattern used
                            # elsewhere - see purchase_return.py).
                            pass

        # Fase 3: post the GR/IR clearing journal for this GRN as a whole
        # (one journal, credit side once) - only if at least one debit line
        # resolved above.
        if journal_lines and total_gr_ir_amount > 0:
            gr_ir_default = GlobalAccountDefault.query.filter_by(transaction_key='gr_ir_clearing').first()
            if gr_ir_default:
                from models.approval_workflow import PendingJournalEntry
                from utils.finance_helpers import post_pending_journal

                journal_lines.append({
                    'account_id': gr_ir_default.account_id,
                    'debit': 0,
                    'credit': total_gr_ir_amount,
                    'description': f'GR/IR Clearing - GRN {grn_number}',
                })
                pending = PendingJournalEntry(
                    workflow_id=None,
                    entry_date=get_local_now().date(),
                    description=f'Penerimaan Barang (GRN) {grn_number}',
                    reference=grn_number,
                    lines=journal_lines,
                    total_debit=total_gr_ir_amount,
                    total_credit=total_gr_ir_amount,
                    created_by=user_id,
                )
                db.session.add(pending)
                db.session.flush()
                posted_entries = post_pending_journal(pending.id, posted_by_user_id=user_id, reference_type='goods_receipt', reference_id=grn.id)
                if posted_entries:
                    base_number = posted_entries[0].entry_number.rsplit('-', 1)[0]
                    for txn in stock_txns:
                        txn.accounting_entry_number = base_number
                        txn.accounting_entry_status = 'posted'
            # If gr_ir_clearing isn't configured yet, the stock/GRN effect
            # above still applies - GR/IR posting is skipped rather than
            # failing the whole receipt, same fallback pattern as elsewhere.

        # Advance PO status based on total received-vs-ordered across ALL
        # GRNs for this PO (not just this one) - previously create_grn()
        # never touched po.status at all, so it stayed stuck at 'approved'
        # forever after the first receipt, and the GRN form's PO picker
        # (filtered by status=confirmed,partial) could never find anything.
        # Fixed 2026-09-11.
        po = db.session.get(PurchaseOrder, data['po_id'])
        if po and po.status in ('approved', 'partial'):
            po_items = PurchaseOrderItem.query.filter_by(po_id=po.id).all()
            total_ordered = sum(float(i.quantity) for i in po_items)
            po_item_ids = [i.id for i in po_items]
            total_accepted = db.session.query(
                db.func.coalesce(db.func.sum(GRNItem.quantity_accepted), 0)
            ).filter(GRNItem.po_item_id.in_(po_item_ids)).scalar() or 0
            if total_ordered > 0:
                if float(total_accepted) >= total_ordered:
                    po.status = 'received'
                else:
                    po.status = 'partial'

        db.session.flush()
        _sync_po_received(data['po_id'])
        db.session.commit()

        try:
            from utils.auto_reserve import requeue_insufficient_items
            requeue_insufficient_items()
        except Exception:
            pass  # requeue is best-effort, never blocks GRN creation

        return jsonify({'message': 'GRN created', 'grn_id': grn.id, 'grn_number': grn_number}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/grn/<int:grn_id>', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def get_grn(grn_id):
    try:
        grn = db.session.get(GoodsReceivedNote, grn_id)
        if not grn:
            return jsonify({'error': 'GRN not found'}), 404
        po = grn.purchase_order
        return jsonify({
            'id': grn.id,
            'grn_number': grn.grn_number,
            'po_id': grn.po_id,
            'po_number': po.po_number if po else None,
            'supplier_id': grn.supplier_id,
            'supplier_name': grn.supplier.company_name if grn.supplier else None,
            'receipt_date': grn.receipt_date.isoformat() if grn.receipt_date else None,
            'delivery_note_number': grn.delivery_note_number,
            'vehicle_number': grn.vehicle_number,
            'driver_name': grn.driver_name,
            'status': grn.status,
            'quality_status': grn.quality_status,
            'notes': grn.notes,
            'received_by': grn.received_by,
            'received_by_name': grn.received_by_user.full_name if grn.received_by_user else None,
            'inspected_by': grn.inspected_by,
            'inspected_by_name': grn.inspected_by_user.full_name if grn.inspected_by_user else None,
            'approved_by': grn.approved_by,
            'approved_by_name': grn.approved_by_user.full_name if grn.approved_by_user else None,
            'approved_at': grn.approved_at.isoformat() if grn.approved_at else None,
            'created_at': grn.created_at.isoformat() if grn.created_at else None,
            'items': [{
                'id': item.id,
                'po_item_id': item.po_item_id,
                'product_id': item.product_id,
                'material_id': item.material_id,
                'item_name': (
                    item.product.name if item.product else
                    (item.material.name if item.material else
                     (item.po_item.description if item.po_item and item.po_item.description else f'Item #{item.id}'))
                ),
                'quantity_ordered': float(item.quantity_ordered),
                'quantity_received': float(item.quantity_received),
                'quantity_accepted': float(item.quantity_accepted or 0),
                'quantity_rejected': float(item.quantity_rejected or 0),
                'uom': item.uom,
                'batch_number': item.batch_number,
                'lot_number': item.lot_number,
                'production_date': item.production_date.isoformat() if item.production_date else None,
                'expiry_date': item.expiry_date.isoformat() if item.expiry_date else None,
                'location_id': item.location_id,
                'notes': item.notes,
            } for item in grn.items],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _resolve_grn_quarantine_location():
    """Cari lokasi karantina untuk barang reject GRN (Fase 4 audit fix,
    2026-09-30). Keputusan pemilik: pakai zona 'Gudang Reject' yang sudah
    ada (dibuat saat warehouse restructure, bukan zona baru khusus GRN),
    dicari lewat zone_type='quarantine' ATAU nama zona mengandung 'reject'
    (case-insensitive) supaya tidak bergantung pada satu ejaan nama pasti.

    Raises ValueError kalau zona/lokasi belum ada - sengaja tidak
    auto-create WarehouseZone di sini (keputusan lokasi karantina adalah
    keputusan pemilik, bukan sesuatu yang harus ditebak/dibuat otomatis).
    """
    from models.warehouse import WarehouseZone, WarehouseLocation

    zone = WarehouseZone.query.filter(
        db.or_(
            WarehouseZone.zone_type == 'quarantine',
            WarehouseZone.name.ilike('%reject%'),
        )
    ).first()
    if not zone:
        raise ValueError(
            "Zona karantina/reject belum ada di sistem ini (dicari lewat "
            "zone_type='quarantine' atau nama mengandung 'reject'). GRN "
            "reject tidak bisa diproses sampai zona ini dibuat."
        )

    location = WarehouseLocation.query.filter_by(zone_id=zone.id, is_active=True).first()
    if not location:
        raise ValueError(
            f"Zona karantina '{zone.name}' ditemukan tapi belum punya "
            "lokasi (WarehouseLocation) aktif di dalamnya."
        )
    return location


@purchasing_bp.route('/quarantine/<int:inventory_id>/destroy', methods=['POST'])
@jwt_required()
@require_permission('purchasing.create')
def destroy_quarantine_inventory(inventory_id):
    """Musnahkan barang di karantina (Fase 5 bagian B, fix_report_2.md,
    2026-10-01, disetujui pemilik via AskUserQuestion). Sebelumnya barang
    reject GRN yang masuk karantina (Fase 4 fix_report.md) tidak punya
    alur lanjutan sama sekali - endpoint ini melengkapi satu dari dua
    alur yang disetujui (yang lain: retur ke supplier, lihat
    create_purchase_return_from_quarantine()).

    Membuat WasteRecord (pola sama dengan
    routes/returns.py::_process_disposition() untuk retur penjualan: cari
    WasteCategory lewat kode/nama, buat kalau belum ada), mengurangi
    Inventory.quantity_on_hand di lokasi karantina, DAN memposting jurnal
    Dr Beban Kerugian Persediaan (slot akun_beban_id, akun beban generik
    yang sudah ada - BUKAN akun baru khusus "kerugian", supaya tidak
    butuh konfigurasi tambahan sebelum fitur ini bisa dipakai) /
    Cr Persediaan (akun_persediaan_id) sebesar cost barang - yang
    SEBELUMNYA tidak pernah ada sama sekali untuk WasteRecord manapun.

    Hanya berlaku untuk Inventory dengan stock_status 'quarantine',
    'reject', atau 'rejected' - inventory yang stoknya 'available'/
    'released' TIDAK BOLEH dimusnahkan lewat endpoint ini (barang itu
    belum tentu benar-benar rusak/ditolak).
    """
    try:
        from models import Inventory, WasteRecord
        from models.waste import WasteCategory
        from utils.inventory_helpers import record_inventory_transaction
        from utils.finance_helpers import post_pending_journal, resolve_account, is_period_locked
        from models.approval_workflow import PendingJournalEntry

        user_id = get_jwt_identity()
        data = request.get_json(silent=True) or {}

        inv = db.session.get(Inventory, inventory_id)
        if not inv:
            return jsonify({'error': 'Inventory tidak ditemukan'}), 404

        if inv.stock_status not in ('quarantine', 'reject', 'rejected'):
            return jsonify({
                'error': f"Inventory ini berstatus '{inv.stock_status}', hanya stok "
                         "quarantine/reject/rejected yang bisa dimusnahkan lewat endpoint ini."
            }), 400

        quantity = float(data.get('quantity', 0))
        if quantity <= 0:
            return jsonify({'error': 'quantity harus > 0'}), 400
        if quantity > float(inv.quantity_on_hand or 0):
            return jsonify({
                'error': f'quantity ({quantity}) melebihi stok karantina yang tersedia '
                         f'({float(inv.quantity_on_hand or 0)})'
            }), 400

        reason = data.get('reason')
        if not reason:
            return jsonify({'error': 'reason wajib diisi'}), 400

        today = get_local_now().date()
        if is_period_locked(today, transaction_type='inventory_destruction'):
            return jsonify({
                'error': f'Periode {today.strftime("%Y-%m")} sudah ditutup, tidak bisa '
                         'memposting pemusnahan persediaan.'
            }), 400

        category_name = data.get('waste_category') or 'GRN Reject - Dimusnahkan'
        category = WasteCategory.query.filter(
            db.or_(WasteCategory.code == category_name, WasteCategory.name == category_name)
        ).first()
        if not category:
            category = WasteCategory(
                code=category_name[:50], name=category_name, waste_type='general_waste',
            )
            db.session.add(category)
            db.session.flush()

        item_name = None
        cost = 0.0
        uom = 'PCS'
        if inv.material_id:
            material = db.session.get(Material, inv.material_id)
            item_name = material.name if material else None
            cost = float(material.cost_per_unit or 0) if material else 0.0
            uom = material.primary_uom if material else uom
        elif inv.product_id:
            product = db.session.get(Product, inv.product_id)
            item_name = product.name if product else None
            cost = float(product.cost or 0) if product else 0.0
            uom = product.primary_uom if product else uom

        waste_record = WasteRecord(
            record_number=generate_number('WR', WasteRecord, 'record_number'),
            category_id=category.id,
            waste_date=today,
            product_id=inv.product_id,
            material_id=inv.material_id,
            quantity=quantity,
            uom=uom,
            estimated_value=cost * quantity,
            reason=reason,
            recorded_by=user_id,
        )
        db.session.add(waste_record)

        inv.quantity_on_hand = float(inv.quantity_on_hand or 0) - quantity
        inv.quantity_available = max(0, float(inv.quantity_available or 0) - quantity)
        inv.updated_at = get_local_now()

        record_inventory_transaction(
            transaction_type='adjustment',
            direction='out',
            quantity=quantity,
            product_id=inv.product_id,
            material_id=inv.material_id,
            from_location_id=inv.location_id,
            reference_number=waste_record.record_number,
            reference_type='inventory_destruction',
            reference_id=waste_record.id,
            batch_number=inv.batch_number,
            notes=f"Pemusnahan stok karantina - {reason}",
            created_by=user_id,
        )

        cost_value = cost * quantity
        if cost_value > 0:
            beban_account_id = resolve_account('akun_beban_id', product_id=inv.product_id)
            persediaan_account_id = resolve_account('akun_persediaan_id', product_id=inv.product_id)

            pending = PendingJournalEntry(
                workflow_id=None,
                entry_date=today,
                description=f'Pemusnahan persediaan karantina - {waste_record.record_number}',
                reference=waste_record.record_number,
                lines=[
                    {'account_id': beban_account_id, 'debit': cost_value, 'credit': 0,
                     'description': f'Beban Kerugian Persediaan - {waste_record.record_number} ({reason})'},
                    {'account_id': persediaan_account_id, 'debit': 0, 'credit': cost_value,
                     'description': f'Pengurangan Persediaan - {waste_record.record_number}'},
                ],
                total_debit=cost_value,
                total_credit=cost_value,
                created_by=user_id,
            )
            db.session.add(pending)
            db.session.flush()
            post_pending_journal(
                pending.id, posted_by_user_id=user_id,
                reference_type='inventory_destruction', reference_id=waste_record.id,
            )

        db.session.commit()
        return jsonify({
            'message': f'{quantity} {uom} {item_name or ""} berhasil dimusnahkan',
            'waste_record_id': waste_record.id,
            'record_number': waste_record.record_number,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/grn/<int:grn_id>/inspect', methods=['POST'])
@jwt_required()
@require_permission('purchasing.create')
def inspect_grn(grn_id):
    """QC Inspection: record accepted/rejected qty per item and adjust inventory"""
    try:
        user_id = int(get_jwt_identity())
        grn = db.session.get(GoodsReceivedNote, grn_id)
        if not grn:
            return jsonify({'error': 'GRN not found'}), 404
        if grn.status == 'approved':
            return jsonify({'error': 'GRN sudah final, tidak bisa diubah'}), 400

        data = request.get_json()
        items_data = data.get('items', [])
        overall_notes = data.get('notes', '')

        from models import Inventory
        from utils.inventory_helpers import record_inventory_transaction

        total_accepted = 0
        total_rejected = 0

        for item_data in items_data:
            item = GRNItem.query.filter_by(id=item_data['id'], grn_id=grn_id).first()
            if not item:
                continue

            new_accepted = float(item_data.get('quantity_accepted', float(item.quantity_received)))
            new_rejected = float(item_data.get('quantity_rejected', 0))
            rejection_reason = item_data.get('rejection_reason', '')

            # Clamp: accepted + rejected <= received
            qty_received = float(item.quantity_received)
            if new_accepted + new_rejected > qty_received:
                new_rejected = qty_received - new_accepted

            old_accepted = float(item.quantity_accepted or 0)
            old_rejected = float(item.quantity_rejected or 0)
            delta = new_accepted - old_accepted  # positive = more accepted, negative = reversed
            reject_delta = new_rejected - old_rejected  # positive = more rejected, negative = reversed

            item.quantity_accepted = new_accepted
            item.quantity_rejected = new_rejected
            if rejection_reason:
                item.notes = f"[QC] {rejection_reason}" + (f"\n{item.notes}" if item.notes else "")

            # Adjust inventory if item has location and delta != 0
            if delta != 0 and item.location_id and (item.product_id or item.material_id):
                inv_query = Inventory.query.filter_by(location_id=item.location_id)
                if item.product_id:
                    inv_query = inv_query.filter_by(product_id=item.product_id)
                else:
                    inv_query = inv_query.filter_by(material_id=item.material_id)
                if item.batch_number:
                    inv_query = inv_query.filter_by(batch_number=item.batch_number)
                inventory = inv_query.first()
                if inventory:
                    inventory.quantity_available = max(0, float(inventory.quantity_available) + delta)
                    inventory.quantity_on_hand = max(0, float(inventory.quantity_on_hand) + delta)
                    inventory.updated_at = get_local_now()
                    mv_direction = 'in' if delta > 0 else 'out'
                    movement = record_inventory_transaction(
                        transaction_type='adjustment',
                        direction=mv_direction,
                        quantity=abs(delta),
                        product_id=item.product_id,
                        material_id=item.material_id,
                        to_location_id=item.location_id if mv_direction == 'in' else None,
                        from_location_id=item.location_id if mv_direction == 'out' else None,
                        reference_number=grn.grn_number,
                        reference_type='grn_inspection',
                        reference_id=grn.id,
                        batch_number=item.batch_number,
                        notes=f"QC Inspection adjustment for GRN {grn.grn_number}",
                        created_by=user_id
                    )

            # Fase 4 audit fix (2026-09-30): barang yang ditolak (quantity_rejected)
            # sebelumnya hanya angka di GRNItem, tidak pernah masuk Inventory -
            # stok fisik yang ditolak "hilang" dari sistem, tidak terlacak sama
            # sekali. Sekarang dicatat sebagai baris Inventory di lokasi
            # karantina (stock_status quarantine/reject/rejected), batch yang
            # sama, supaya tidak ikut FIFO picking (FIFO hanya mengambil
            # stock_status available/released) dan tetap kelihatan di stok
            # fisik. Idempoten lewat reject_delta (pola sama seperti delta
            # accepted di atas) - inspeksi ulang tidak menggandakan stok.
            if reject_delta != 0 and (item.product_id or item.material_id):
                quarantine_location = _resolve_grn_quarantine_location()
                q_query = Inventory.query.filter_by(location_id=quarantine_location.id)
                if item.product_id:
                    q_query = q_query.filter_by(product_id=item.product_id)
                    reject_status = 'reject'
                else:
                    q_query = q_query.filter_by(material_id=item.material_id)
                    reject_status = 'rejected'
                q_query = q_query.filter_by(batch_number=item.batch_number)
                quarantine_inventory = q_query.first()

                if quarantine_inventory:
                    quarantine_inventory.quantity_on_hand = max(0, float(quarantine_inventory.quantity_on_hand) + reject_delta)
                    quarantine_inventory.quantity_available = max(0, float(quarantine_inventory.quantity_available) + reject_delta)
                    quarantine_inventory.updated_at = get_local_now()
                else:
                    quarantine_inventory = Inventory(
                        product_id=item.product_id,
                        material_id=item.material_id,
                        location_id=quarantine_location.id,
                        quantity_on_hand=max(0, reject_delta),
                        quantity_available=max(0, reject_delta),
                        batch_number=item.batch_number,
                        stock_status=reject_status,
                        grn_id=grn.id,
                    )
                    db.session.add(quarantine_inventory)

                record_inventory_transaction(
                    transaction_type='adjustment',
                    direction='in' if reject_delta > 0 else 'out',
                    quantity=abs(reject_delta),
                    product_id=item.product_id,
                    material_id=item.material_id,
                    to_location_id=quarantine_location.id if reject_delta > 0 else None,
                    from_location_id=quarantine_location.id if reject_delta < 0 else None,
                    reference_number=grn.grn_number,
                    reference_type='grn_inspection_reject',
                    reference_id=grn.id,
                    batch_number=item.batch_number,
                    notes=f"GRN {grn.grn_number} - barang ditolak QC masuk karantina",
                    created_by=user_id
                )

            total_accepted += new_accepted
            total_rejected += new_rejected

        # Update GRN header
        grn.inspected_by = user_id
        grn.status = 'inspected'
        if overall_notes:
            grn.notes = (grn.notes or '') + f'\n[QC] {overall_notes}'

        if total_rejected == 0:
            grn.quality_status = 'passed'
        elif total_accepted == 0:
            grn.quality_status = 'failed'
        else:
            grn.quality_status = 'partial'

        db.session.flush()
        _sync_po_received(grn.po_id)
        db.session.commit()
        return jsonify({
            'message': f'Inspeksi selesai — diterima: {total_accepted}, ditolak: {total_rejected}',
            'quality_status': grn.quality_status,
            'grn_id': grn.id,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/grn/<int:grn_id>/approve', methods=['POST'])
@jwt_required()
@require_permission('purchasing.approve')
def approve_grn(grn_id):
    """Final approval of GRN after inspection"""
    try:
        user_id = int(get_jwt_identity())
        grn = db.session.get(GoodsReceivedNote, grn_id)
        if not grn:
            return jsonify({'error': 'GRN not found'}), 404
        if grn.status == 'approved':
            return jsonify({'error': 'GRN sudah di-approve sebelumnya'}), 400

        grn.status = 'approved'
        grn.approved_by = user_id
        grn.approved_at = get_local_now()
        db.session.commit()
        return jsonify({'message': 'GRN disetujui', 'grn_id': grn.id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/grn/<int:grn_id>', methods=['PUT'])
@jwt_required()
@require_permission('purchasing.edit')
def update_grn(grn_id):
    """Update a GRN. Mirrors Accurate Online's Penerimaan Barang rule: once a
    Purchase Invoice has been created from a receipt, Accurate keeps the two
    documents' cost values consistent and rejects re-costing a receipt that
    has already been invoiced (help.accurate.id, faktur-pembelian /
    penerimaan-barang docs). We enforce the same rule here: a GRN can no
    longer be edited once a purchase Invoice referencing its PO exists, or
    once the GRN itself has been through final QC approval (existing
    'approved' lock used by inspect/approve endpoints)."""
    try:
        grn = db.session.get(GoodsReceivedNote, grn_id)
        if not grn:
            return jsonify({'error': 'GRN not found'}), 404

        if grn.status == 'approved':
            return jsonify({'error': 'GRN sudah final (approved), tidak bisa diubah'}), 400

        invoiced = Invoice.query.filter(
            Invoice.purchase_order_id == grn.po_id,
            Invoice.invoice_type == 'purchase',
            Invoice.status != 'cancelled'
        ).first()
        if invoiced:
            return jsonify({'error': 'GRN tidak bisa diubah karena sudah ada Faktur Pembelian terkait PO ini'}), 400

        data = request.get_json() or {}

        header_fields = ['receipt_date', 'delivery_note_number', 'vehicle_number', 'driver_name', 'notes']
        for field in header_fields:
            if field in data:
                if field == 'receipt_date' and data[field]:
                    grn.receipt_date = datetime.strptime(data[field].split('T')[0], '%Y-%m-%d')
                else:
                    setattr(grn, field, data[field])

        items_data = data.get('items')
        if items_data:
            items_by_po_item = {item.po_item_id: item for item in grn.items}
            for item_data in items_data:
                po_item_id = item_data.get('po_item_id')
                grn_item = items_by_po_item.get(po_item_id)
                if not grn_item:
                    continue
                for f in ['quantity_received', 'quantity_accepted', 'quantity_rejected',
                          'batch_number', 'lot_number', 'location_id', 'notes']:
                    if f in item_data:
                        setattr(grn_item, f, item_data[f])
                if 'production_date' in item_data and item_data['production_date']:
                    grn_item.production_date = datetime.strptime(item_data['production_date'], '%Y-%m-%d').date()
                if 'expiry_date' in item_data and item_data['expiry_date']:
                    grn_item.expiry_date = datetime.strptime(item_data['expiry_date'], '%Y-%m-%d').date()

        db.session.flush()
        _sync_po_received(grn.po_id)
        db.session.commit()
        return jsonify({'message': 'GRN updated', 'grn_id': grn.id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ===============================
# APPROVAL WORKFLOW ENDPOINTS
# ===============================
#
# NOTE (2026-08-18, punch-list item 4): PO approval was migrated from the
# module-local PurchaseApproval model to the generic ApprovalWorkflow system
# (models/approval_workflow.py, routes/approval_workflow.py — same system
# already used by Sales Orders, see routes/sales.py create_order()).
#
# get_po_approvals() and approve_purchase_order() below are kept as-is for
# backward compatibility but are DEAD CODE from the frontend's perspective —
# PurchaseOrderList.tsx no longer calls them. The PurchaseApproval model/table
# is also no longer written to by the PO flow. Left in place intentionally
# per user decision; not deleted. See PURCHASING_GAP_FIXES_REPORT.md.

@purchasing_bp.route('/purchase-orders/<int:po_id>/approvals', methods=['GET'])
@jwt_required()
@require_permission('purchase_orders.view')
def get_po_approvals(po_id):
    try:
        approvals = PurchaseApproval.query.filter_by(po_id=po_id).order_by(PurchaseApproval.approval_level).all()

        return jsonify({
            'approvals': [{
                'id': a.id,
                'approval_level': a.approval_level,
                'approver': {
                    'id': a.approver.id,
                    'name': a.approver.full_name if a.approver else None,
                    'email': a.approver.email
                },
                'status': a.status,
                'comments': a.comments,
                'approved_at': a.approved_at.isoformat() if a.approved_at else None,
                'created_at': a.created_at.isoformat()
            } for a in approvals]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/purchase-orders/<int:po_id>/approve', methods=['POST'])
@jwt_required()
@require_permission('purchase_orders.approve')
def approve_purchase_order(po_id):
    try:
        data = request.get_json()
        user_id = get_jwt_identity()

        # Find pending approval for this user
        approval = PurchaseApproval.query.filter_by(
            po_id=po_id,
            approver_id=user_id,
            status='pending'
        ).first()

        if not approval:
            return jsonify(error_response('api.error', error_code=404)), 404

        # Fase 2 audit fix (fix_report_2.md, 2026-10-01): status dari body
        # request sebelumnya dipakai langsung tanpa validasi apapun - nilai
        # sembarangan (typo, client lama yang kirim format berbeda) akan
        # tersimpan apa adanya ke PurchaseApproval.status (field yang
        # menurut modelnya cuma boleh 'pending'/'approved'/'rejected') DAN
        # otomatis jatuh ke cabang `else: po.status = 'rejected'` di bawah
        # - PO ikut berubah status akibat input yang seharusnya ditolak
        # validasi, bukan akibat keputusan approve/reject yang sebenarnya.
        requested_status = data.get('status', 'approved')
        if requested_status not in ('approved', 'rejected'):
            return jsonify({'error': f"status harus 'approved' atau 'rejected', diterima: '{requested_status}'"}), 400

        approval.status = requested_status
        approval.comments = data.get('comments')
        approval.approved_at = get_local_now()

        # Update PO status if all approvals are complete
        po = db.session.get(PurchaseOrder, po_id)
        if approval.status == 'approved':
            # Fase 7 audit fix (2026-09-30): this query runs AFTER
            # approval.status was set to 'approved' above (line ~1303), and
            # SQLAlchemy autoflushes that change before this SELECT touches
            # the same table - so pending_approvals here already EXCLUDES
            # the approval just granted, it counts only OTHER approvals
            # still pending. The old check `== 1` treated that count as if
            # it still included the current row, so with exactly one
            # approval level configured (the common case) this condition
            # was NEVER true: pending_approvals was 0, not 1. PO status
            # never flipped to 'approved' and reserve_po_budget_commitment()
            # never ran - found via Fase 7 HTTP re-verification
            # (tests/test_fase7_http_reverification.py), matching the
            # exact "works when called directly, silently fails through
            # the real endpoint" pattern the audit prompt warned about.
            pending_approvals = PurchaseApproval.query.filter_by(
                po_id=po_id,
                status='pending'
            ).count()

            if pending_approvals == 0:  # no other approval levels left pending
                po.status = 'approved'
                po.approved_by = user_id
                po.approved_at = get_local_now()
                from utils.finance_helpers import reserve_po_budget_commitment
                reserve_po_budget_commitment(po)
        else:
            po.status = 'rejected'

        db.session.commit()

        return jsonify({'message': f'Purchase order {approval.status} successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/purchase-orders/<int:po_id>/submit-approval', methods=['POST'])
@jwt_required()
@require_permission('purchase_orders.create')
def submit_for_approval(po_id):
    """Submit a PO for approval via the generic ApprovalWorkflow system.

    Migrated from the module-local PurchaseApproval flow (which required the
    caller to pass a hardcoded approver_ids array — bug found in
    PurchaseOrderList.tsx). Role-based reviewer/approver assignment is now
    handled by routes/approval_workflow.py (review_workflow/approve_workflow),
    matching the pattern already used for Sales Orders in routes/sales.py.
    No approver_ids needed anymore; the request body is ignored/optional.
    """
    try:
        user_id = get_jwt_identity()

        po = db.session.get(PurchaseOrder, po_id)
        if not po:
            return jsonify(error_response('api.error', error_code=404)), 404

        if po.status != 'draft':
            return jsonify(error_response('api.error', error_code=400)), 400

        from models.approval_workflow import ApprovalWorkflow, ApprovalHistory, ApprovalConfiguration

        # Multi-currency (2026-10-19): lock the PO's exchange rate here, at
        # submit, so the release-strategy threshold and budget commitment
        # below (both in IDR) see the IDR value, and every later approval
        # path (generic ApprovalWorkflow, legacy PurchaseApproval) inherits
        # an already-locked rate. Single source: the automatic rate when it
        # exists; a user-entered rate is accepted ONLY when it doesn't.
        body = request.get_json(silent=True) or {}
        manual_rate = body.get('manual_exchange_rate')
        if po.currency == 'IDR':
            po.exchange_rate = 1
            po.exchange_rate_source = 'auto'
        elif po.manual_exchange_rate and manual_rate is None:
            # Kurs manual yang sengaja diisi user di form PO: dipakai menggantikan kurs otomatis.
            po.exchange_rate = float(po.manual_exchange_rate)
            po.exchange_rate_source = 'manual'
        else:
            from utils.exchange_rates import get_current_rate
            auto_rate = get_current_rate(f'{po.currency}_IDR')
            if auto_rate:
                if manual_rate is not None:
                    return jsonify({'error': 'Kurs otomatis tersedia, kurs manual tidak diterima', 'auto_rate': auto_rate}), 400
                po.exchange_rate = auto_rate
                po.exchange_rate_source = 'auto'
            else:
                if manual_rate is None:
                    return jsonify({
                        'error': f'Kurs otomatis {po.currency}/IDR tidak tersedia. Masukkan kurs manual setelah mengecek kurs riil.',
                        'error_code': 'EXCHANGE_RATE_UNAVAILABLE',
                        'currency': po.currency,
                    }), 400
                try:
                    manual_rate = float(manual_rate)
                except (TypeError, ValueError):
                    return jsonify({'error': 'manual_exchange_rate harus berupa angka'}), 400
                if manual_rate <= 0:
                    return jsonify({'error': 'manual_exchange_rate harus lebih dari 0'}), 400
                if body.get('manual_rate_confirmed') is not True:
                    return jsonify({'error': 'Konfirmasi bahwa kurs riil sudah dicek (manual_rate_confirmed) wajib diisi'}), 400
                po.exchange_rate = manual_rate
                po.exchange_rate_source = 'manual'
        total_idr = _po_amount_idr(po, po.total_amount)

        # Release strategy by value (SAP MM concept, 2026-09-14) - uses the
        # ApprovalConfiguration.amount_threshold field, which existed but was never
        # actually enforced anywhere (found during the MM gap audit). A PO at or
        # below the configured threshold for 'purchase_order' auto-approves with no
        # review/approval step at all - a real, single-tier release strategy. Above
        # threshold (or when no threshold is configured, preserving old behavior)
        # still goes through the full review->approve ApprovalWorkflow as before.
        config = ApprovalConfiguration.query.filter_by(transaction_type='purchase_order', is_active=True).first()
        if config and config.amount_threshold is not None and total_idr <= float(config.amount_threshold):
            po.status = 'approved'
            po.approved_by = user_id
            po.approved_at = get_local_now()
            from utils.finance_helpers import reserve_po_budget_commitment
            reserve_po_budget_commitment(po)
            db.session.commit()
            return jsonify(success_response('api.success', data={
                'auto_approved': True,
                'reason': f'Total PO Rp{total_idr:,.0f} di bawah batas release strategy Rp{float(config.amount_threshold):,.0f}, disetujui otomatis.',
            })), 200

        workflow = ApprovalWorkflow(
            transaction_type='purchase_order',
            transaction_id=po.id,
            transaction_number=po.po_number,
            status='pending_review',
            current_step='review',
            submitted_by=user_id,
            submitted_at=get_local_now()
        )
        db.session.add(workflow)
        db.session.flush()

        history = ApprovalHistory(
            workflow_id=workflow.id,
            action='submit',
            action_by=user_id,
            old_status='draft',
            new_status='pending_review',
            notes=f'Purchase Order {po.po_number} submitted for review'
        )
        db.session.add(history)

        po.status = 'pending_approval'
        db.session.commit()

        return jsonify(success_response('api.success', data={'workflow_id': workflow.id})), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/exchange-rate', methods=['GET'])
@jwt_required()
@require_permission('purchase_orders.view')
def get_po_exchange_rate():
    """Read-only estimate of <currency> -> IDR for the PO form. The rate
    actually used is locked at submit_for_approval, not this value."""
    try:
        currency = _validate_po_currency(request.args.get('currency'))
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    if currency == 'IDR':
        return jsonify({'currency': 'IDR', 'rate': 1.0, 'available': True}), 200
    from utils.exchange_rates import get_current_rate
    rate = get_current_rate(f'{currency}_IDR')
    return jsonify({'currency': currency, 'rate': rate, 'available': rate is not None}), 200

# ===============================
# RFQ (REQUEST FOR QUOTATION) ENDPOINTS
# ===============================

@purchasing_bp.route('/rfqs', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def get_rfqs():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        status = request.args.get('status')
        
        query = PurchaseRFQ.query
        if status:
            query = query.filter_by(status=status)
        
        rfqs = query.order_by(PurchaseRFQ.issue_date.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'rfqs': [{
                'id': r.id,
                'rfq_number': r.rfq_number,
                'title': r.title,
                'issue_date': r.issue_date.isoformat(),
                'closing_date': r.closing_date.isoformat(),
                'status': r.status,
                'created_by': r.created_by_user.full_name if r.created_by_user else None,
                'quotes_count': len(r.quotes)
            } for r in rfqs.items],
            'total': rfqs.total,
            'pages': rfqs.pages,
            'current_page': rfqs.page
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/rfqs', methods=['POST'])
@jwt_required()
@require_permission('purchasing.create')
def create_rfq():
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        rfq_number = generate_number('RFQ', PurchaseRFQ, 'rfq_number')
        
        rfq = PurchaseRFQ(
            rfq_number=rfq_number,
            title=data['title'],
            description=data.get('description'),
            issue_date=datetime.strptime(data['issue_date'], '%Y-%m-%d').date(),
            closing_date=datetime.strptime(data['closing_date'], '%Y-%m-%d').date(),
            status='draft',
            created_by=user_id
        )
        
        db.session.add(rfq)
        db.session.flush()
        
        # Add RFQ items
        for idx, item_data in enumerate(data.get('items', []), 1):
            rfq_item = RFQItem(
                rfq_id=rfq.id,
                line_number=idx,
                product_id=item_data.get('product_id'),
                material_id=item_data.get('material_id'),
                description=item_data['description'],
                quantity=item_data['quantity'],
                uom=item_data['uom'],
                required_date=datetime.strptime(item_data['required_date'], '%Y-%m-%d').date() if item_data.get('required_date') else None,
                specifications=item_data.get('specifications')
            )
            db.session.add(rfq_item)
        
        db.session.commit()
        
        return jsonify({'message': 'RFQ created', 'rfq_id': rfq.id, 'rfq_number': rfq_number}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/rfqs/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def get_rfq(id):
    try:
        rfq = db.session.get(PurchaseRFQ, id)
        if not rfq:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        return jsonify({
            'id': rfq.id,
            'rfq_number': rfq.rfq_number,
            'title': rfq.title,
            'description': rfq.description,
            'issue_date': rfq.issue_date.isoformat(),
            'closing_date': rfq.closing_date.isoformat(),
            'status': rfq.status,
            'created_by': rfq.created_by_user.full_name if rfq.created_by_user else None,
            'items': [{
                'id': i.id,
                'line_number': i.line_number,
                'product_id': i.product_id,
                'product_name': i.product.name if i.product else None,
                'description': i.description,
                'quantity': float(i.quantity),
                'uom': i.uom,
                'required_date': i.required_date.isoformat() if i.required_date else None,
                'specifications': i.specifications
            } for i in rfq.items],
            'quotes': [{
                'id': q.id,
                'quote_number': q.quote_number,
                'supplier_name': q.supplier.company_name,
                'quote_date': q.quote_date.isoformat(),
                'status': q.status,
                'total_amount': float(q.total_amount)
            } for q in rfq.quotes]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/rfqs/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('purchasing.edit')
def update_rfq(id):
    """Update an RFQ. Accurate Online doesn't model RFQ as a native document
    (RFQ/Permintaan Penawaran here is a SMITH-built feature, no Accurate
    parity to mirror), but the natural guard mirrors how Accurate locks
    header data once a downstream document exists: once at least one
    SupplierQuote has been submitted against this RFQ, its scope
    (items/closing_date) should not silently change under suppliers who
    already quoted, so item-level and closing_date edits are blocked once
    quotes exist; title/description and status transitions remain editable."""
    try:
        rfq = db.session.get(PurchaseRFQ, id)
        if not rfq:
            return jsonify(error_response('api.error', error_code=404)), 404

        data = request.get_json() or {}
        has_quotes = len(rfq.quotes) > 0

        if 'title' in data:
            rfq.title = data['title']
        if 'description' in data:
            rfq.description = data['description']
        if 'status' in data:
            rfq.status = data['status']

        if not has_quotes:
            if 'issue_date' in data and data['issue_date']:
                rfq.issue_date = datetime.strptime(data['issue_date'], '%Y-%m-%d').date()
            if 'closing_date' in data and data['closing_date']:
                rfq.closing_date = datetime.strptime(data['closing_date'], '%Y-%m-%d').date()

            if 'items' in data:
                RFQItem.query.filter_by(rfq_id=rfq.id).delete()
                for idx, item_data in enumerate(data.get('items', []), 1):
                    rfq_item = RFQItem(
                        rfq_id=rfq.id,
                        line_number=idx,
                        product_id=item_data.get('product_id'),
                        material_id=item_data.get('material_id'),
                        description=item_data['description'],
                        quantity=item_data['quantity'],
                        uom=item_data['uom'],
                        required_date=datetime.strptime(item_data['required_date'], '%Y-%m-%d').date() if item_data.get('required_date') else None,
                        specifications=item_data.get('specifications')
                    )
                    db.session.add(rfq_item)
        elif 'closing_date' in data or 'items' in data:
            return jsonify({'error': 'RFQ sudah memiliki penawaran supplier, item dan closing date tidak bisa diubah'}), 400

        db.session.commit()
        return jsonify({'message': 'RFQ updated', 'rfq_id': rfq.id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ===============================
# SUPPLIER QUOTES ENDPOINTS
# ===============================

@purchasing_bp.route('/quotes', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def get_quotes():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        supplier_id = request.args.get('supplier_id', type=int)
        status = request.args.get('status')
        
        query = SupplierQuote.query
        if supplier_id:
            query = query.filter_by(supplier_id=supplier_id)
        if status:
            query = query.filter_by(status=status)
        
        quotes = query.order_by(SupplierQuote.quote_date.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'quotes': [{
                'id': q.id,
                'quote_number': q.quote_number,
                'supplier_name': q.supplier.company_name,
                'quote_date': q.quote_date.isoformat(),
                'valid_until': q.valid_until.isoformat() if q.valid_until else None,
                'status': q.status,
                'currency': q.currency,
                'total_amount': float(q.total_amount),
                'rfq_number': q.rfq.rfq_number if q.rfq else None
            } for q in quotes.items],
            'total': quotes.total,
            'pages': quotes.pages,
            'current_page': quotes.page
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/quotes', methods=['POST'])
@jwt_required()
@require_permission('purchasing.create')
def create_quote():
    try:
        data = request.get_json()
        
        quote_number = generate_number_v2('supplier_quote', 'QUO', SupplierQuote, 'quote_number')
        
        quote = SupplierQuote(
            quote_number=quote_number,
            supplier_id=data['supplier_id'],
            rfq_id=data.get('rfq_id'),
            quote_date=datetime.strptime(data['quote_date'], '%Y-%m-%d').date(),
            valid_until=datetime.strptime(data['valid_until'], '%Y-%m-%d').date() if data.get('valid_until') else None,
            status='draft',
            currency=data.get('currency', 'USD'),
            payment_terms=data.get('payment_terms'),
            delivery_terms=data.get('delivery_terms'),
            lead_time_days=data.get('lead_time_days'),
            notes=data.get('notes')
        )
        
        db.session.add(quote)
        db.session.flush()
        
        # Add quote items
        subtotal = 0
        for idx, item_data in enumerate(data.get('items', []), 1):
            total_price = item_data['quantity'] * item_data['unit_price']
            
            quote_item = SupplierQuoteItem(
                quote_id=quote.id,
                rfq_item_id=item_data.get('rfq_item_id'),
                line_number=idx,
                product_id=item_data.get('product_id'),
                material_id=item_data.get('material_id'),
                description=item_data['description'],
                quantity=item_data['quantity'],
                uom=item_data['uom'],
                unit_price=item_data['unit_price'],
                total_price=total_price,
                lead_time_days=item_data.get('lead_time_days'),
                notes=item_data.get('notes')
            )
            db.session.add(quote_item)
            subtotal += total_price
        
        quote.subtotal = subtotal
        quote.total_amount = subtotal
        
        db.session.commit()
        
        return jsonify({'message': 'Quote created', 'quote_id': quote.id, 'quote_number': quote_number}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/quotes/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def get_quote(id):
    try:
        quote = db.session.get(SupplierQuote, id)
        if not quote:
            return jsonify(error_response('api.error', error_code=404)), 404

        return jsonify({
            'id': quote.id,
            'quote_number': quote.quote_number,
            'supplier_id': quote.supplier_id,
            'supplier_name': quote.supplier.company_name if quote.supplier else None,
            'rfq_id': quote.rfq_id,
            'quote_date': quote.quote_date.isoformat(),
            'valid_until': quote.valid_until.isoformat() if quote.valid_until else None,
            'status': quote.status,
            'currency': quote.currency,
            'payment_terms': quote.payment_terms,
            'delivery_terms': quote.delivery_terms,
            'lead_time_days': quote.lead_time_days,
            'subtotal': float(quote.subtotal or 0),
            'tax_amount': float(quote.tax_amount or 0),
            'total_amount': float(quote.total_amount or 0),
            'notes': quote.notes,
            'items': [{
                'id': i.id,
                'rfq_item_id': i.rfq_item_id,
                'line_number': i.line_number,
                'product_id': i.product_id,
                'material_id': i.material_id,
                'description': i.description,
                'quantity': float(i.quantity),
                'uom': i.uom,
                'unit_price': float(i.unit_price),
                'discount_percent': float(i.discount_percent or 0),
                'tax_percent': float(i.tax_percent or 0),
                'total_price': float(i.total_price),
                'lead_time_days': i.lead_time_days,
                'notes': i.notes
            } for i in quote.items]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/quotes/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('purchasing.edit')
def update_quote(id):
    """Update a Supplier Quote. Accurate Online has no native Penawaran
    Supplier document either (this is a SMITH-built feature layered on top
    of Accurate's PO/GRN/Invoice flow), so we apply the same "locked after
    it's been acted on downstream" principle Accurate uses elsewhere: once a
    quote has been accepted (status='accepted'), it has effectively been
    used to inform a real PO decision, so pricing/items should no longer be
    silently changed - only re-submitting a new quote or explicitly marking
    it rejected/expired remains possible."""
    try:
        quote = db.session.get(SupplierQuote, id)
        if not quote:
            return jsonify(error_response('api.error', error_code=404)), 404

        data = request.get_json() or {}

        if quote.status == 'accepted' and any(k in data for k in ('items', 'currency')):
            return jsonify({'error': 'Quote sudah diterima (accepted), item dan currency tidak bisa diubah'}), 400

        header_fields = ['payment_terms', 'delivery_terms', 'lead_time_days', 'notes', 'status', 'currency']
        for field in header_fields:
            if field in data:
                setattr(quote, field, data[field])

        if 'quote_date' in data and data['quote_date']:
            quote.quote_date = datetime.strptime(data['quote_date'], '%Y-%m-%d').date()
        if 'valid_until' in data and data['valid_until']:
            quote.valid_until = datetime.strptime(data['valid_until'], '%Y-%m-%d').date()

        if 'items' in data:
            SupplierQuoteItem.query.filter_by(quote_id=quote.id).delete()
            subtotal = 0
            for idx, item_data in enumerate(data.get('items', []), 1):
                total_price = item_data['quantity'] * item_data['unit_price']
                quote_item = SupplierQuoteItem(
                    quote_id=quote.id,
                    rfq_item_id=item_data.get('rfq_item_id'),
                    line_number=idx,
                    product_id=item_data.get('product_id'),
                    material_id=item_data.get('material_id'),
                    description=item_data['description'],
                    quantity=item_data['quantity'],
                    uom=item_data['uom'],
                    unit_price=item_data['unit_price'],
                    total_price=total_price,
                    lead_time_days=item_data.get('lead_time_days'),
                    notes=item_data.get('notes')
                )
                db.session.add(quote_item)
                subtotal += total_price
            quote.subtotal = subtotal
            quote.total_amount = subtotal

        db.session.commit()
        return jsonify({'message': 'Quote updated', 'quote_id': quote.id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ===============================
# PRICE COMPARISON ENDPOINTS
# ===============================

@purchasing_bp.route('/price-comparison', methods=['POST'])
@jwt_required()
@require_permission('purchasing.create')
def compare_prices():
    try:
        data = request.get_json()
        product_id = data.get('product_id')
        material_id = data.get('material_id')
        quantity = data.get('quantity', 1)
        
        # Get recent quotes for the product/material
        query = SupplierQuoteItem.query.join(SupplierQuote)
        
        if product_id:
            query = query.filter(SupplierQuoteItem.product_id == product_id)
        elif material_id:
            query = query.filter(SupplierQuoteItem.material_id == material_id)
        else:
            return jsonify(error_response('api.error', error_code=400)), 400
        
        # Get quotes from last 6 months
        six_months_ago = get_local_now() - timedelta(days=180)
        quote_items = query.filter(
            SupplierQuote.quote_date >= six_months_ago,
            SupplierQuote.status.in_(['submitted', 'accepted'])
        ).order_by(SupplierQuote.quote_date.desc()).limit(20).all()
        
        # Get price history
        price_history_query = PriceHistory.query
        if product_id:
            price_history_query = price_history_query.filter_by(product_id=product_id)
        elif material_id:
            price_history_query = price_history_query.filter_by(material_id=material_id)
        
        price_history = price_history_query.filter(
            PriceHistory.price_date >= six_months_ago
        ).order_by(PriceHistory.price_date.desc()).limit(50).all()
        
        # Format response
        comparison_data = {
            'recent_quotes': [{
                'supplier_name': qi.quote.supplier.company_name,
                'quote_number': qi.quote.quote_number,
                'quote_date': qi.quote.quote_date.isoformat(),
                'unit_price': float(qi.unit_price),
                'currency': qi.quote.currency,
                'quantity': float(qi.quantity),
                'total_price': float(qi.total_price),
                'lead_time_days': qi.lead_time_days,
                'status': qi.quote.status
            } for qi in quote_items],
            'price_history': [{
                'supplier_name': ph.supplier.company_name,
                'price_date': ph.price_date.isoformat(),
                'unit_price': float(ph.unit_price),
                'currency': ph.currency,
                'quantity': float(ph.quantity) if ph.quantity else None,
                'source_type': ph.source_type
            } for ph in price_history],
            'analysis': {
                'lowest_price': min([float(qi.unit_price) for qi in quote_items]) if quote_items else None,
                'highest_price': max([float(qi.unit_price) for qi in quote_items]) if quote_items else None,
                'average_price': sum([float(qi.unit_price) for qi in quote_items]) / len(quote_items) if quote_items else None,
                'suppliers_count': len(set([qi.quote.supplier_id for qi in quote_items]))
            }
        }
        
        return jsonify(comparison_data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===============================
# CONTRACT MANAGEMENT ENDPOINTS
# ===============================

@purchasing_bp.route('/contracts', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def get_contracts():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        supplier_id = request.args.get('supplier_id', type=int)
        status = request.args.get('status')
        contract_type = request.args.get('contract_type')
        
        query = SupplierContract.query
        if supplier_id:
            query = query.filter_by(supplier_id=supplier_id)
        if status:
            query = query.filter_by(status=status)
        if contract_type:
            query = query.filter_by(contract_type=contract_type)
        
        contracts = query.order_by(SupplierContract.start_date.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'contracts': [{
                'id': c.id,
                'contract_number': c.contract_number,
                'supplier_name': c.supplier.company_name,
                'title': c.title,
                'contract_type': c.contract_type,
                'start_date': c.start_date.isoformat(),
                'end_date': c.end_date.isoformat(),
                'status': c.status,
                'currency': c.currency,
                'total_value': float(c.total_value) if c.total_value else None,
                'created_by': c.created_by_user.full_name if c.created_by_user else None,
                'approved_by': c.approved_by_user.full_name if c.approved_by_user else None
            } for c in contracts.items],
            'total': contracts.total,
            'pages': contracts.pages,
            'current_page': contracts.page
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/contracts', methods=['POST'])
@jwt_required()
@require_permission('purchasing.create')
def create_contract():
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        contract_number = generate_number('CON', SupplierContract, 'contract_number')
        
        contract = SupplierContract(
            contract_number=contract_number,
            supplier_id=data['supplier_id'],
            title=data['title'],
            contract_type=data['contract_type'],
            start_date=datetime.strptime(data['start_date'], '%Y-%m-%d').date(),
            end_date=datetime.strptime(data['end_date'], '%Y-%m-%d').date(),
            status='draft',
            currency=data.get('currency', 'USD'),
            total_value=data.get('total_value'),
            payment_terms=data.get('payment_terms'),
            delivery_terms=data.get('delivery_terms'),
            penalty_clause=data.get('penalty_clause'),
            terms_conditions=data.get('terms_conditions'),
            auto_renewal=data.get('auto_renewal', False),
            renewal_period_months=data.get('renewal_period_months'),
            created_by=user_id
        )
        
        db.session.add(contract)
        db.session.flush()
        
        # Add contract items
        for idx, item_data in enumerate(data.get('items', []), 1):
            contract_item = ContractItem(
                contract_id=contract.id,
                line_number=idx,
                product_id=item_data.get('product_id'),
                material_id=item_data.get('material_id'),
                description=item_data['description'],
                quantity=item_data.get('quantity'),
                uom=item_data['uom'],
                unit_price=item_data['unit_price'],
                min_order_qty=item_data.get('min_order_qty'),
                max_order_qty=item_data.get('max_order_qty'),
                lead_time_days=item_data.get('lead_time_days'),
                price_valid_from=datetime.strptime(item_data['price_valid_from'], '%Y-%m-%d').date() if item_data.get('price_valid_from') else None,
                price_valid_to=datetime.strptime(item_data['price_valid_to'], '%Y-%m-%d').date() if item_data.get('price_valid_to') else None
            )
            db.session.add(contract_item)
        
        db.session.commit()
        
        return jsonify({'message': 'Contract created', 'contract_id': contract.id, 'contract_number': contract_number}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/contracts/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def get_contract(id):
    try:
        contract = db.session.get(SupplierContract, id)
        if not contract:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        return jsonify({
            'id': contract.id,
            'contract_number': contract.contract_number,
            'supplier': {
                'id': contract.supplier.id,
                'company_name': contract.supplier.company_name
            },
            'title': contract.title,
            'contract_type': contract.contract_type,
            'start_date': contract.start_date.isoformat(),
            'end_date': contract.end_date.isoformat(),
            'status': contract.status,
            'currency': contract.currency,
            'total_value': float(contract.total_value) if contract.total_value else None,
            'payment_terms': contract.payment_terms,
            'delivery_terms': contract.delivery_terms,
            'penalty_clause': contract.penalty_clause,
            'terms_conditions': contract.terms_conditions,
            'auto_renewal': contract.auto_renewal,
            'renewal_period_months': contract.renewal_period_months,
            'created_by': contract.created_by_user.full_name if contract.created_by_user else None,
            'approved_by': contract.approved_by_user.full_name if contract.approved_by_user else None,
            'items': [{
                'id': i.id,
                'line_number': i.line_number,
                'product_name': i.product.name if i.product else None,
                'description': i.description,
                'quantity': float(i.quantity) if i.quantity else None,
                'uom': i.uom,
                'unit_price': float(i.unit_price),
                'min_order_qty': float(i.min_order_qty) if i.min_order_qty else None,
                'max_order_qty': float(i.max_order_qty) if i.max_order_qty else None,
                'lead_time_days': i.lead_time_days,
                'price_valid_from': i.price_valid_from.isoformat() if i.price_valid_from else None,
                'price_valid_to': i.price_valid_to.isoformat() if i.price_valid_to else None
            } for i in contract.items]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/contracts/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('purchasing.edit')
def update_contract(id):
    try:
        contract = db.session.get(SupplierContract, id)
        if not contract:
            return jsonify(error_response('api.error', error_code=404)), 404

        data = request.get_json()

        # Header fields editable any time before termination/expiry, per
        # Accurate's pattern for supplier agreements (only cancelled/expired
        # contracts are locked - active/draft ones can still be amended).
        if contract.status in ('expired', 'terminated'):
            return jsonify({'error': 'Kontrak yang sudah expired/terminated tidak bisa diedit'}), 400

        if 'title' in data:
            contract.title = data['title']
        if 'contract_type' in data:
            contract.contract_type = data['contract_type']
        if 'start_date' in data:
            contract.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        if 'end_date' in data:
            contract.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        if 'currency' in data:
            contract.currency = data['currency']
        if 'total_value' in data:
            contract.total_value = data['total_value']
        if 'payment_terms' in data:
            contract.payment_terms = data['payment_terms']
        if 'delivery_terms' in data:
            contract.delivery_terms = data['delivery_terms']
        if 'penalty_clause' in data:
            contract.penalty_clause = data['penalty_clause']
        if 'terms_conditions' in data:
            contract.terms_conditions = data['terms_conditions']
        if 'auto_renewal' in data:
            contract.auto_renewal = data['auto_renewal']
        if 'renewal_period_months' in data:
            contract.renewal_period_months = data['renewal_period_months']
        if 'status' in data and data['status'] in ('draft', 'cancelled'):
            contract.status = data['status']
        contract.updated_at = get_local_now()

        if 'items' in data:
            ContractItem.query.filter_by(contract_id=id).delete()
            for idx, item_data in enumerate(data['items'], 1):
                contract_item = ContractItem(
                    contract_id=contract.id,
                    line_number=idx,
                    product_id=item_data.get('product_id'),
                    material_id=item_data.get('material_id'),
                    description=item_data['description'],
                    quantity=item_data.get('quantity'),
                    uom=item_data['uom'],
                    unit_price=item_data['unit_price'],
                    min_order_qty=item_data.get('min_order_qty'),
                    max_order_qty=item_data.get('max_order_qty'),
                    lead_time_days=item_data.get('lead_time_days'),
                    price_valid_from=datetime.strptime(item_data['price_valid_from'], '%Y-%m-%d').date() if item_data.get('price_valid_from') else None,
                    price_valid_to=datetime.strptime(item_data['price_valid_to'], '%Y-%m-%d').date() if item_data.get('price_valid_to') else None
                )
                db.session.add(contract_item)

        db.session.commit()
        return jsonify({'message': 'Contract updated'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@purchasing_bp.route('/contracts/<int:id>/activate', methods=['POST'])
@jwt_required()
@require_permission('purchasing.create')
def activate_contract(id):
    try:
        contract = db.session.get(SupplierContract, id)
        if not contract:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        user_id = get_jwt_identity()
        contract.status = 'active'
        contract.approved_by = user_id
        contract.approved_at = get_local_now()
        
        db.session.commit()
        
        return jsonify(success_response('api.success')), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================================
# SOURCE LIST (Approved Vendor per Material) - 2026-09-14
# Readiness build ahead of Purchasing's eventual migration off
# Accurate - see project_accurate_vs_custom_erp_scope memory.
# Drill-down both ways: filter by material_id (from a material's
# detail page - "which vendors can supply this") or supplier_id
# (from a vendor's detail page - "what can this vendor supply").
# ============================================================

@purchasing_bp.route('/approved-vendors', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def get_approved_vendors():
    try:
        from models.purchasing import ApprovedVendor
        material_id = request.args.get('material_id', type=int)
        supplier_id = request.args.get('supplier_id', type=int)

        query = ApprovedVendor.query
        if material_id:
            query = query.filter_by(material_id=material_id)
        if supplier_id:
            query = query.filter_by(supplier_id=supplier_id)

        rows = query.order_by(ApprovedVendor.is_preferred.desc(), ApprovedVendor.id).all()
        return jsonify({
            'approved_vendors': [{
                'id': r.id,
                'material_id': r.material_id,
                'material_code': r.material.code if r.material else None,
                'material_name': r.material.name if r.material else None,
                'supplier_id': r.supplier_id,
                'supplier_name': r.supplier.company_name if r.supplier else None,
                'is_preferred': r.is_preferred,
                'is_active': r.is_active,
                'notes': r.notes,
                'created_at': r.created_at.isoformat() if r.created_at else None,
            } for r in rows]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/approved-vendors', methods=['POST'])
@jwt_required()
@require_permission('purchasing.create')
def create_approved_vendor():
    try:
        from models.purchasing import ApprovedVendor
        data = request.get_json() or {}
        material_id = data.get('material_id')
        supplier_id = data.get('supplier_id')
        if not material_id or not supplier_id:
            return jsonify({'error': 'material_id dan supplier_id wajib diisi'}), 400

        existing = ApprovedVendor.query.filter_by(material_id=material_id, supplier_id=supplier_id).first()
        if existing:
            existing.is_active = True
            existing.is_preferred = data.get('is_preferred', existing.is_preferred)
            existing.notes = data.get('notes', existing.notes)
            db.session.commit()
            return jsonify({'message': 'Approved vendor diaktifkan kembali', 'id': existing.id}), 200

        user_id = get_jwt_identity()
        row = ApprovedVendor(
            material_id=material_id,
            supplier_id=supplier_id,
            is_preferred=bool(data.get('is_preferred', False)),
            notes=data.get('notes'),
            created_by=user_id,
        )
        db.session.add(row)
        db.session.commit()
        return jsonify({'message': 'Approved vendor ditambahkan', 'id': row.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/approved-vendors/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('purchasing.create')
def update_approved_vendor(id):
    try:
        from models.purchasing import ApprovedVendor
        row = db.session.get(ApprovedVendor, id)
        if not row:
            return jsonify({'error': 'Not found'}), 404
        data = request.get_json() or {}
        if 'is_preferred' in data:
            row.is_preferred = bool(data['is_preferred'])
        if 'is_active' in data:
            row.is_active = bool(data['is_active'])
        if 'notes' in data:
            row.notes = data['notes']
        db.session.commit()
        return jsonify({'message': 'Approved vendor diupdate'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchasing_bp.route('/approved-vendors/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('purchasing.create')
def delete_approved_vendor(id):
    try:
        from models.purchasing import ApprovedVendor
        row = db.session.get(ApprovedVendor, id)
        if not row:
            return jsonify({'error': 'Not found'}), 404
        db.session.delete(row)
        db.session.commit()
        return jsonify({'message': 'Approved vendor dihapus'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
