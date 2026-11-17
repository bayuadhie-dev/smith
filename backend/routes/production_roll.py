"""Pencatatan roll spunlace.

Nomor roll ditulis operator dengan satu deret 1-10000 yang berulang. Karena itu
nomor saja tidak unik: sistem menyimpan putaran deret (`cycle`) di belakang layar
dan memperingatkan kalau nomor yang sama masih ada di stok untuk kain yang sama.
"""
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import or_

from models import db
from models.product import Product
from models.production_roll import ProductionRoll
from utils.auth_decorators import require_permission

production_roll_bp = Blueprint('production_roll', __name__)

GRADES = ('A', 'B', 'C')
GRADE_LABEL = {'A': 'A - bagus', 'B': 'B - perlu sortir', 'C': 'C - reject'}
NOMOR_MAKS = 10000
AKTIF = ('available',)


class RollError(Exception):
    def __init__(self, message, status=400, extra=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.extra = extra or {}


@production_roll_bp.errorhandler(RollError)
def _handle(e):
    db.session.rollback()
    return jsonify({'error': e.message, **e.extra}), e.status


def _f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        raise RollError('Isian angka tidak valid')


def _bentrok(product_id, roll_number, exclude_id=None):
    """Roll bernomor sama untuk kain yang sama dan masih ada di stok."""
    q = ProductionRoll.query.filter(ProductionRoll.product_id == product_id,
                                    ProductionRoll.roll_number == roll_number,
                                    ProductionRoll.status.in_(AKTIF))
    if exclude_id:
        q = q.filter(ProductionRoll.id != exclude_id)
    return q.order_by(ProductionRoll.id.desc()).first()


@production_roll_bp.route('/meta', methods=['GET'])
@jwt_required()
@require_permission('production.view')
def meta():
    from models.production import Machine
    mesin = Machine.query.filter(Machine.is_active.is_(True),
                                 or_(Machine.machine_type == 'spunlace', Machine.department == 'Spunlace')).all()
    return jsonify({
        'grades': [{'value': g, 'label': GRADE_LABEL[g]} for g in GRADES],
        'machines': [{'id': m.id, 'code': m.code, 'name': m.name} for m in mesin],
        'max_number': NOMOR_MAKS,
    })


@production_roll_bp.route('', methods=['GET'])
@production_roll_bp.route('/', methods=['GET'])
@jwt_required()
@require_permission('production.view')
def list_rolls():
    a = request.args
    q = ProductionRoll.query
    if a.get('status'):
        q = q.filter(ProductionRoll.status == a['status'])
    if a.get('grade'):
        q = q.filter(ProductionRoll.grade == a['grade'])
    if a.get('product_id', type=int):
        q = q.filter(ProductionRoll.product_id == a.get('product_id', type=int))
    if a.get('roll_type'):
        q = q.filter(ProductionRoll.roll_type == a['roll_type'])
    if a.get('date_from'):
        q = q.filter(ProductionRoll.produced_at >= a['date_from'])
    if a.get('date_to'):
        q = q.filter(ProductionRoll.produced_at <= a['date_to'])
    if a.get('q'):
        s = a['q'].strip()
        like = f'%{s}%'
        cond = [ProductionRoll.notes.ilike(like), ProductionRoll.shift.ilike(like)]
        if s.isdigit():
            cond.append(ProductionRoll.roll_number == int(s))
        q = q.join(Product).filter(or_(*cond, Product.code.ilike(like), Product.name.ilike(like)))
    page = a.get('page', 1, type=int)
    per_page = min(a.get('per_page', 200, type=int), 1000)
    rows = q.order_by(ProductionRoll.produced_at.desc(), ProductionRoll.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({'rolls': [r.to_dict() for r in rows.items], 'total': rows.total, 'page': page, 'pages': rows.pages})


@production_roll_bp.route('/<int:rid>', methods=['GET'])
@jwt_required()
@require_permission('production.view')
def get_roll(rid):
    r = db.session.get(ProductionRoll, rid)
    if not r:
        raise RollError('Roll tidak ditemukan', 404)
    data = r.to_dict()
    data['children'] = [c.to_dict() for c in r.children]
    return jsonify(data)


def _validate(data, exclude_id=None):
    nomor = data.get('roll_number')
    try:
        nomor = int(nomor)
    except (TypeError, ValueError):
        raise RollError('Nomor roll harus angka')
    if not 1 <= nomor <= NOMOR_MAKS:
        raise RollError(f'Nomor roll di luar deret 1 sampai {NOMOR_MAKS}')

    product = db.session.get(Product, data.get('product_id')) if data.get('product_id') else None
    if not product:
        raise RollError('Pilih jenis kain atau produknya')

    gross = _f(data.get('gross_weight_kg'))
    net = _f(data.get('net_weight_kg'))
    if gross <= 0 or net <= 0:
        raise RollError('Berat kotor dan berat bersih harus lebih dari 0')
    if net > gross:
        raise RollError('Berat bersih tidak boleh lebih besar dari berat kotor')

    grade = (data.get('grade') or 'A').upper()
    if grade not in GRADES:
        raise RollError('Grade hanya A, B, atau C')

    try:
        tanggal = datetime.fromisoformat(str(data.get('produced_at'))).date()
    except (TypeError, ValueError):
        raise RollError('Tanggal produksi tidak valid')

    return {'roll_number': nomor, 'product': product, 'gross': gross, 'net': net, 'grade': grade, 'tanggal': tanggal}


@production_roll_bp.route('', methods=['POST'])
@production_roll_bp.route('/', methods=['POST'])
@jwt_required()
@require_permission('production.create')
def create_roll():
    data = request.get_json() or {}
    v = _validate(data)

    kembar = _bentrok(v['product'].id, v['roll_number'])
    if kembar and not data.get('confirm_duplicate'):
        # Nomor berulang itu wajar karena deretnya kembali ke 1; yang perlu dipastikan
        # adalah operator memang sadar roll lama bernomor sama masih ada di stok.
        raise RollError(
            f"Roll nomor {v['roll_number']} untuk {v['product'].name} masih ada di stok "
            f"(dicatat {kembar.produced_at:%d %b %Y}, {float(kembar.net_weight_kg):,.0f} kg). "
            'Pastikan ini roll baru dari putaran berikutnya.',
            409, {'duplicate_of': kembar.to_dict(), 'needs_confirmation': True})

    roll = ProductionRoll(
        roll_number=v['roll_number'],
        cycle=(kembar.cycle + 1) if kembar else 1,
        roll_type='main',
        product_id=v['product'].id,
        work_order_id=data.get('work_order_id') or None,
        machine_id=data.get('machine_id') or None,
        produced_at=v['tanggal'],
        shift=(data.get('shift') or '').strip()[:20] or None,
        gross_weight_kg=v['gross'],
        net_weight_kg=v['net'],
        length_m=_f(data['length_m']) if data.get('length_m') else None,
        width_cm=_f(data['width_cm']) if data.get('width_cm') else None,
        grade=v['grade'],
        notes=(data.get('notes') or '').strip() or None,
        created_by=int(get_jwt_identity()),
    )
    db.session.add(roll)
    db.session.commit()
    return jsonify(roll.to_dict()), 201


@production_roll_bp.route('/<int:rid>', methods=['PUT'])
@jwt_required()
@require_permission('production.create')
def update_roll(rid):
    roll = db.session.get(ProductionRoll, rid)
    if not roll:
        raise RollError('Roll tidak ditemukan', 404)
    if roll.status != 'available':
        raise RollError(f'Roll ini berstatus {roll.status}, tidak bisa diubah lagi', 409)

    data = request.get_json() or {}
    v = _validate({**roll.to_dict(), **data}, exclude_id=roll.id)
    kembar = _bentrok(v['product'].id, v['roll_number'], exclude_id=roll.id)
    if kembar and not data.get('confirm_duplicate'):
        raise RollError(f"Roll nomor {v['roll_number']} untuk {v['product'].name} masih ada di stok.",
                        409, {'duplicate_of': kembar.to_dict(), 'needs_confirmation': True})

    roll.roll_number = v['roll_number']
    roll.product_id = v['product'].id
    roll.produced_at = v['tanggal']
    roll.gross_weight_kg = v['gross']
    roll.net_weight_kg = v['net']
    roll.grade = v['grade']
    for k in ('work_order_id', 'machine_id'):
        if k in data:
            setattr(roll, k, data[k] or None)
    for k in ('length_m', 'width_cm'):
        if k in data:
            setattr(roll, k, _f(data[k]) if data[k] else None)
    if 'shift' in data:
        roll.shift = (data['shift'] or '').strip()[:20] or None
    if 'notes' in data:
        roll.notes = (data['notes'] or '').strip() or None
    db.session.commit()
    return jsonify(roll.to_dict())


@production_roll_bp.route('/<int:rid>/cancel', methods=['POST'])
@jwt_required()
@require_permission('production.create')
def cancel_roll(rid):
    roll = db.session.get(ProductionRoll, rid)
    if not roll:
        raise RollError('Roll tidak ditemukan', 404)
    if roll.status != 'available':
        raise RollError(f'Roll berstatus {roll.status} tidak bisa dibatalkan', 409)
    if roll.children:
        raise RollError('Roll ini sudah dipotong jadi jumbo roll, batalkan jumbo roll-nya dulu', 409)
    roll.status = 'cancelled'
    alasan = (request.get_json(silent=True) or {}).get('reason')
    if alasan:
        roll.notes = f'Dibatalkan: {alasan}' + (f'\n{roll.notes}' if roll.notes else '')
    db.session.commit()
    return jsonify(roll.to_dict())


@production_roll_bp.route('/summary', methods=['GET'])
@jwt_required()
@require_permission('production.view')
def summary():
    """Ringkasan produksi roll untuk periode yang dipilih."""
    a = request.args
    q = ProductionRoll.query.filter(ProductionRoll.status != 'cancelled')
    if a.get('date_from'):
        q = q.filter(ProductionRoll.produced_at >= a['date_from'])
    if a.get('date_to'):
        q = q.filter(ProductionRoll.produced_at <= a['date_to'])
    rows = q.all()
    per_grade = {}
    for r in rows:
        g = per_grade.setdefault(r.grade, {'grade': r.grade, 'label': GRADE_LABEL.get(r.grade, r.grade), 'rolls': 0, 'net_kg': 0.0})
        g['rolls'] += 1
        g['net_kg'] += float(r.net_weight_kg or 0)
    return jsonify({
        'rolls': len(rows),
        'net_kg': round(sum(float(r.net_weight_kg or 0) for r in rows), 2),
        'gross_kg': round(sum(float(r.gross_weight_kg or 0) for r in rows), 2),
        'by_grade': sorted(per_grade.values(), key=lambda g: g['grade']),
    })
