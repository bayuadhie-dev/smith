import json
from datetime import date
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db
from models.warehouse import Inventory
from models.product import Product, Material
from models.settings_extended import AuditLog

qc_batch_status_bp = Blueprint('qc_batch_status', __name__)

PRODUCT_STATUSES = ('released', 'quarantine', 'reject')
MATERIAL_STATUSES = ('available', 'quarantine', 'reject')


def _self_life_days(item):
    """Product uses self_life_days (or retest_period_days for WIP); Material reuses expiry_days."""
    if isinstance(item, Product):
        return item.retest_period_days if item.material_type == 'wip' else item.self_life_days
    if isinstance(item, Material):
        return item.expiry_days
    return None


def _is_overdue(inv, item):
    days = _self_life_days(item)
    if not days or not inv.production_date:
        return False
    return (date.today() - inv.production_date).days > days


@qc_batch_status_bp.route('/batches', methods=['GET'])
@jwt_required()
@require_permission('quality.view')
def list_batches():
    """Browse batches for the MSC2N-style status change page - not a QC-on-arrival
    queue (that's routes/quality.py), this lists batches ALREADY in the warehouse."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    stock_status = request.args.get('stock_status')
    search = request.args.get('search', '')

    query = Inventory.query.filter(Inventory.is_active == True)
    if stock_status:
        query = query.filter(Inventory.stock_status == stock_status)
    if search:
        query = query.outerjoin(Product, Inventory.product_id == Product.id) \
            .outerjoin(Material, Inventory.material_id == Material.id) \
            .filter(db.or_(
                Inventory.batch_number.ilike(f'%{search}%'),
                Product.code.ilike(f'%{search}%'),
                Product.name.ilike(f'%{search}%'),
                Material.code.ilike(f'%{search}%'),
                Material.name.ilike(f'%{search}%'),
            ))

    paginated = query.order_by(Inventory.id.desc()).paginate(page=page, per_page=per_page, error_out=False)

    results = []
    for inv in paginated.items:
        item = inv.product or inv.material
        results.append({
            'id': inv.id,
            'item_type': 'product' if inv.product_id else 'material',
            'item_code': item.code if item else None,
            'item_name': item.name if item else None,
            'batch_number': inv.batch_number,
            'quantity_on_hand': float(inv.quantity_on_hand) if inv.quantity_on_hand is not None else 0,
            'stock_status': inv.stock_status,
            'production_date': inv.production_date.isoformat() if inv.production_date else None,
            'is_overdue': _is_overdue(inv, item) if item else False,
            'valid_statuses': PRODUCT_STATUSES if inv.product_id else MATERIAL_STATUSES,
        })

    return jsonify({
        'batches': results,
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': paginated.page,
    }), 200


@qc_batch_status_bp.route('/batches/<int:inventory_id>/status', methods=['PUT'])
@jwt_required()
@require_permission('quality.edit')
def update_batch_status(inventory_id):
    """Free-direction batch status change (MSC2N-style) - release/quarantine/reject
    in any order, with a mandatory reason logged to the generic AuditLog."""
    inv = db.session.get(Inventory, inventory_id)
    if not inv:
        return jsonify({'error': 'Batch not found'}), 404

    data = request.get_json() or {}
    new_status = data.get('new_status')
    reason = (data.get('reason') or '').strip()

    if not new_status:
        return jsonify({'error': 'new_status wajib diisi'}), 400
    if not reason:
        return jsonify({'error': 'Alasan (reason) wajib diisi'}), 400

    valid_statuses = PRODUCT_STATUSES if inv.product_id else MATERIAL_STATUSES
    if new_status not in valid_statuses:
        return jsonify({'error': f"Status tidak valid untuk tipe item ini. Pilihan: {', '.join(valid_statuses)}"}), 400

    old_status = inv.stock_status
    if old_status == new_status:
        return jsonify({'error': 'Status baru sama dengan status saat ini'}), 400

    user_id = get_jwt_identity()
    inv.stock_status = new_status
    inv.qc_notes = reason
    inv.qc_date = db.func.now()

    db.session.add(AuditLog(
        user_id=int(user_id) if str(user_id).isdigit() else None,
        action='update',
        resource_type='inventory_batch',
        resource_id=str(inv.id),
        resource_name=inv.batch_number or f'Inventory #{inv.id}',
        old_values=json.dumps({'stock_status': old_status}),
        new_values=json.dumps({'stock_status': new_status, 'reason': reason}),
        request_method=request.method,
        request_url=request.url,
    ))

    db.session.commit()

    return jsonify({
        'message': 'Status batch berhasil diubah',
        'inventory_id': inv.id,
        'old_status': old_status,
        'new_status': new_status,
    }), 200
