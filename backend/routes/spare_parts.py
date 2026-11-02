from datetime import datetime
from decimal import Decimal, InvalidOperation

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, or_

from models import db, SparePart, SparePartMovement, MachineSparePart, SparePartRequest, SparePartRequestItem, User
from models.production import Machine
from utils import generate_number
from utils.auth_decorators import require_permission

spare_parts_bp = Blueprint('spare_parts', __name__)


def _dec(v, default=None):
    if v is None or v == '':
        return default
    try:
        return Decimal(str(v))
    except InvalidOperation:
        raise ValueError(f'Angka tidak valid: {v}')


def _f(v):
    return float(v) if v is not None else None


def _part_dict(p, machines_count=None):
    stock, mn = float(p.current_stock or 0), float(p.min_stock or 0)
    d = {
        'id': p.id, 'part_number': p.part_number, 'part_name': p.part_name, 'category': p.category,
        'description': p.description, 'uom': p.uom, 'current_stock': stock, 'min_stock': mn,
        'max_stock': _f(p.max_stock), 'unit_cost': _f(p.unit_cost), 'last_purchase_cost': _f(p.last_purchase_cost),
        'primary_supplier_id': p.primary_supplier_id,
        'supplier_name': p.supplier.company_name if p.supplier else None,
        'lead_time_days': p.lead_time_days, 'warehouse_location': p.warehouse_location, 'is_active': p.is_active,
        'needs_reorder': mn > 0 and stock <= mn, 'out_of_stock': stock <= 0,
        'stock_value': round(stock * float(p.unit_cost or 0), 2),
    }
    if machines_count is not None:
        d['machines_count'] = machines_count
    return d


def _apply_part_fields(p, data):
    for f in ('part_number', 'part_name', 'category', 'description', 'uom', 'warehouse_location'):
        if f in data:
            val = (data[f] or '').strip() if isinstance(data[f], str) else data[f]
            setattr(p, f, val or None if f not in ('part_number', 'part_name', 'uom') else val)
    for f in ('min_stock', 'max_stock', 'unit_cost', 'last_purchase_cost'):
        if f in data:
            setattr(p, f, _dec(data[f]))
    if 'min_stock' in data and p.min_stock is None:
        p.min_stock = Decimal('0')
    for f in ('primary_supplier_id', 'lead_time_days'):
        if f in data:
            setattr(p, f, int(data[f]) if data[f] not in (None, '') else None)
    if 'is_active' in data:
        p.is_active = bool(data['is_active'])


def _move(part, mtype, qty, user_id, notes=None, unit_cost=None, maintenance_record_id=None, purchase_order_id=None):
    """Satu-satunya jalan mengubah stok sparepart; stok mengikuti mutasi. part harus sudah di-lock."""
    before = Decimal(str(part.current_stock or 0))
    if mtype in ('in', 'return'):
        delta = qty
    elif mtype == 'out':
        delta = -qty
        if before + delta < 0:
            raise ValueError(f'Stok {part.part_number} tidak cukup (tersedia {before}, diminta {qty})')
    else:  # adjustment: qty = hasil hitung fisik
        delta = qty - before
    after = before + delta
    part.current_stock = after
    cost = unit_cost if unit_cost is not None else part.unit_cost
    if mtype == 'in' and unit_cost is not None:
        part.last_purchase_cost = unit_cost
    mv = SparePartMovement(
        movement_number=generate_number('SPM', SparePartMovement, 'movement_number'),
        spare_part_id=part.id, movement_date=datetime.utcnow(), movement_type=mtype,
        quantity=delta, unit_cost=cost, total_cost=(abs(delta) * cost) if cost is not None else None,
        maintenance_record_id=maintenance_record_id, purchase_order_id=purchase_order_id,
        stock_before=before, stock_after=after, notes=notes, performed_by=user_id,
    )
    db.session.add(mv)
    db.session.flush()
    return mv


def _movement_dict(m):
    return {
        'id': m.id, 'movement_number': m.movement_number, 'movement_date': m.movement_date.isoformat(),
        'movement_type': m.movement_type, 'quantity': float(m.quantity), 'unit_cost': _f(m.unit_cost),
        'total_cost': _f(m.total_cost), 'stock_before': _f(m.stock_before), 'stock_after': _f(m.stock_after),
        'notes': m.notes, 'maintenance_record_id': m.maintenance_record_id,
        'performed_by': m.performed_by_user.username if m.performed_by_user else None,
    }


# ---------------------------------------------------------------- gudang sparepart
@spare_parts_bp.route('', methods=['GET'])
@jwt_required()
@require_permission('maintenance.view')
def list_parts():
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 200)
    q = SparePart.query
    if request.args.get('include_inactive') != '1':
        q = q.filter(SparePart.is_active.is_(True))
    s = (request.args.get('search') or '').strip()
    if s:
        like = f'%{s}%'
        q = q.filter(or_(SparePart.part_number.ilike(like), SparePart.part_name.ilike(like)))
    if request.args.get('category'):
        q = q.filter(SparePart.category == request.args['category'])
    if request.args.get('low_stock') in ('1', 'true'):
        q = q.filter(SparePart.min_stock > 0, SparePart.current_stock <= SparePart.min_stock)
    if request.args.get('machine_id'):
        q = q.join(MachineSparePart, MachineSparePart.spare_part_id == SparePart.id).filter(
            MachineSparePart.machine_id == int(request.args['machine_id']))
    pag = q.order_by(SparePart.part_number).paginate(page=page, per_page=per_page, error_out=False)
    counts = dict(db.session.query(MachineSparePart.spare_part_id, func.count(MachineSparePart.id)).group_by(
        MachineSparePart.spare_part_id).all())
    active = SparePart.query.filter(SparePart.is_active.is_(True))
    summary = {
        'total': active.count(),
        'low_stock': active.filter(SparePart.min_stock > 0, SparePart.current_stock <= SparePart.min_stock).count(),
        'out_of_stock': active.filter(SparePart.current_stock <= 0).count(),
        'stock_value': float(db.session.query(func.coalesce(func.sum(SparePart.current_stock * func.coalesce(SparePart.unit_cost, 0)), 0))
                             .filter(SparePart.is_active.is_(True)).scalar() or 0),
    }
    cats = [c for (c,) in db.session.query(SparePart.category).filter(SparePart.category.isnot(None)).distinct().order_by(SparePart.category)]
    return jsonify({'spare_parts': [_part_dict(p, counts.get(p.id, 0)) for p in pag.items], 'total': pag.total,
                    'pages': pag.pages, 'summary': summary, 'categories': cats}), 200


@spare_parts_bp.route('', methods=['POST'])
@jwt_required()
@require_permission('maintenance.create')
def create_part():
    data = request.get_json() or {}
    try:
        if not (data.get('part_number') or '').strip() or not (data.get('part_name') or '').strip():
            return jsonify({'error': 'Kode dan nama sparepart wajib diisi'}), 400
        if not (data.get('uom') or '').strip():
            return jsonify({'error': 'Satuan wajib diisi'}), 400
        if SparePart.query.filter_by(part_number=data['part_number'].strip()).first():
            return jsonify({'error': f"Kode {data['part_number']} sudah dipakai"}), 400
        p = SparePart(part_number='', part_name='', uom='', current_stock=0, min_stock=0)
        _apply_part_fields(p, data)
        db.session.add(p)
        db.session.flush()
        opening = _dec(data.get('opening_stock'), Decimal('0'))
        if opening and opening > 0:
            _move(p, 'in', opening, int(get_jwt_identity()), notes='Stok awal')
        db.session.commit()
        return jsonify({'message': 'Sparepart dibuat', 'id': p.id}), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@spare_parts_bp.route('/<int:pid>', methods=['GET'])
@jwt_required()
@require_permission('maintenance.view')
def get_part(pid):
    p = db.session.get(SparePart, pid)
    if not p:
        return jsonify({'error': 'Sparepart tidak ditemukan'}), 404
    moves = SparePartMovement.query.filter_by(spare_part_id=pid).order_by(SparePartMovement.movement_date.desc(), SparePartMovement.id.desc()).limit(100).all()
    links = MachineSparePart.query.filter_by(spare_part_id=pid).all()
    return jsonify({
        'spare_part': _part_dict(p, len(links)),
        'movements': [_movement_dict(m) for m in moves],
        'machines': [{'link_id': l.id, 'machine_id': l.machine_id, 'machine_code': l.machine.code, 'machine_name': l.machine.name,
                      'qty_installed': float(l.qty_installed), 'replace_interval_days': l.replace_interval_days,
                      'last_replaced_date': l.last_replaced_date.isoformat() if l.last_replaced_date else None} for l in links],
    }), 200


@spare_parts_bp.route('/<int:pid>', methods=['PUT'])
@jwt_required()
@require_permission('maintenance.edit')
def update_part(pid):
    p = db.session.get(SparePart, pid)
    if not p:
        return jsonify({'error': 'Sparepart tidak ditemukan'}), 404
    data = request.get_json() or {}
    data.pop('current_stock', None)  # stok hanya berubah lewat mutasi
    try:
        if 'part_number' in data and data['part_number'].strip() != p.part_number and SparePart.query.filter_by(part_number=data['part_number'].strip()).first():
            return jsonify({'error': f"Kode {data['part_number']} sudah dipakai"}), 400
        _apply_part_fields(p, data)
        db.session.commit()
        return jsonify({'message': 'Sparepart diperbarui'}), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@spare_parts_bp.route('/<int:pid>', methods=['DELETE'])
@jwt_required()
@require_permission('maintenance.delete')
def delete_part(pid):
    p = db.session.get(SparePart, pid)
    if not p:
        return jsonify({'error': 'Sparepart tidak ditemukan'}), 404
    p.is_active = False
    db.session.commit()
    return jsonify({'message': 'Sparepart dinonaktifkan'}), 200


@spare_parts_bp.route('/<int:pid>/movements', methods=['POST'])
@jwt_required()
@require_permission('maintenance.edit')
def add_movement(pid):
    data = request.get_json() or {}
    mtype = data.get('movement_type')
    try:
        if mtype not in ('in', 'out', 'adjustment', 'return'):
            return jsonify({'error': 'Jenis mutasi tidak valid'}), 400
        qty = _dec(data.get('quantity'))
        if qty is None or qty < 0 or (qty == 0 and mtype != 'adjustment'):
            return jsonify({'error': 'Jumlah harus lebih dari 0'}), 400
        p = db.session.query(SparePart).filter_by(id=pid).with_for_update().first()
        if not p:
            return jsonify({'error': 'Sparepart tidak ditemukan'}), 404
        mv = _move(p, mtype, qty, int(get_jwt_identity()), notes=data.get('notes'), unit_cost=_dec(data.get('unit_cost')),
                   maintenance_record_id=data.get('maintenance_record_id'))
        db.session.commit()
        return jsonify({'message': 'Mutasi dicatat', 'movement': _movement_dict(mv), 'current_stock': float(p.current_stock)}), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------- sparepart per mesin
@spare_parts_bp.route('/machines/<int:mid>', methods=['GET'])
@jwt_required()
@require_permission('maintenance.view')
def machine_parts(mid):
    m = db.session.get(Machine, mid)
    if not m:
        return jsonify({'error': 'Mesin tidak ditemukan'}), 404
    rows = MachineSparePart.query.filter_by(machine_id=mid).join(SparePart).order_by(SparePart.part_number).all()
    return jsonify({
        'machine': {'id': m.id, 'code': m.code, 'name': m.name},
        'parts': [{
            'link_id': l.id, 'spare_part_id': l.spare_part_id, 'part_number': l.spare_part.part_number,
            'part_name': l.spare_part.part_name, 'uom': l.spare_part.uom, 'qty_installed': float(l.qty_installed),
            'replace_interval_days': l.replace_interval_days,
            'last_replaced_date': l.last_replaced_date.isoformat() if l.last_replaced_date else None,
            'notes': l.notes, 'current_stock': float(l.spare_part.current_stock or 0),
            'needs_reorder': float(l.spare_part.min_stock or 0) > 0 and float(l.spare_part.current_stock or 0) <= float(l.spare_part.min_stock or 0),
        } for l in rows],
    }), 200


@spare_parts_bp.route('/machines/<int:mid>', methods=['POST'])
@jwt_required()
@require_permission('maintenance.edit')
def add_machine_part(mid):
    data = request.get_json() or {}
    if not db.session.get(Machine, mid):
        return jsonify({'error': 'Mesin tidak ditemukan'}), 404
    sp = db.session.get(SparePart, data.get('spare_part_id') or 0)
    if not sp:
        return jsonify({'error': 'Sparepart tidak ditemukan'}), 404
    if MachineSparePart.query.filter_by(machine_id=mid, spare_part_id=sp.id).first():
        return jsonify({'error': 'Sparepart ini sudah ada di daftar mesin'}), 400
    try:
        link = MachineSparePart(machine_id=mid, spare_part_id=sp.id, qty_installed=_dec(data.get('qty_installed'), Decimal('1')),
                                replace_interval_days=int(data['replace_interval_days']) if data.get('replace_interval_days') else None,
                                notes=data.get('notes'))
        db.session.add(link)
        db.session.commit()
        return jsonify({'message': 'Sparepart ditambahkan ke mesin', 'link_id': link.id}), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@spare_parts_bp.route('/machine-links/<int:lid>', methods=['PUT'])
@jwt_required()
@require_permission('maintenance.edit')
def update_machine_part(lid):
    link = db.session.get(MachineSparePart, lid)
    if not link:
        return jsonify({'error': 'Data tidak ditemukan'}), 404
    data = request.get_json() or {}
    try:
        if 'qty_installed' in data:
            link.qty_installed = _dec(data['qty_installed'], Decimal('1'))
        if 'replace_interval_days' in data:
            link.replace_interval_days = int(data['replace_interval_days']) if data['replace_interval_days'] else None
        if 'last_replaced_date' in data:
            link.last_replaced_date = datetime.fromisoformat(data['last_replaced_date']).date() if data['last_replaced_date'] else None
        if 'notes' in data:
            link.notes = data['notes']
        db.session.commit()
        return jsonify({'message': 'Diperbarui'}), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@spare_parts_bp.route('/machine-links/<int:lid>', methods=['DELETE'])
@jwt_required()
@require_permission('maintenance.edit')
def delete_machine_part(lid):
    link = db.session.get(MachineSparePart, lid)
    if not link:
        return jsonify({'error': 'Data tidak ditemukan'}), 404
    db.session.delete(link)
    db.session.commit()
    return jsonify({'message': 'Dihapus dari daftar mesin'}), 200


# ---------------------------------------------------------------- permintaan sparepart
def _req_dict(r, with_items=True):
    users = {u.id: u.username for u in User.query.filter(User.id.in_([x for x in (r.requested_by, r.decided_by) if x])).all()} if (r.requested_by or r.decided_by) else {}
    d = {
        'id': r.id, 'request_number': r.request_number, 'status': r.status, 'notes': r.notes,
        'machine_id': r.machine_id, 'machine_name': r.machine.name if r.machine else None,
        'requested_by': users.get(r.requested_by), 'requested_at': r.requested_at.isoformat() if r.requested_at else None,
        'decided_by': users.get(r.decided_by), 'decided_at': r.decided_at.isoformat() if r.decided_at else None,
        'decision_note': r.decision_note, 'items_count': len(r.items),
    }
    if with_items:
        d['items'] = [{'id': i.id, 'spare_part_id': i.spare_part_id, 'part_number': i.spare_part.part_number,
                       'part_name': i.spare_part.part_name, 'uom': i.spare_part.uom,
                       'qty_requested': float(i.qty_requested), 'qty_issued': float(i.qty_issued or 0),
                       'current_stock': float(i.spare_part.current_stock or 0), 'notes': i.notes} for i in r.items]
    return d


@spare_parts_bp.route('/requests', methods=['GET'])
@jwt_required()
@require_permission('maintenance.view')
def list_requests():
    q = SparePartRequest.query
    if request.args.get('status'):
        q = q.filter(SparePartRequest.status == request.args['status'])
    page = request.args.get('page', 1, type=int)
    pag = q.order_by(SparePartRequest.requested_at.desc()).paginate(page=page, per_page=min(request.args.get('per_page', 50, type=int), 200), error_out=False)
    pending = SparePartRequest.query.filter_by(status='pending').count()
    return jsonify({'requests': [_req_dict(r, False) for r in pag.items], 'total': pag.total, 'pages': pag.pages, 'pending': pending}), 200


@spare_parts_bp.route('/requests/<int:rid>', methods=['GET'])
@jwt_required()
@require_permission('maintenance.view')
def get_request_(rid):
    r = db.session.get(SparePartRequest, rid)
    if not r:
        return jsonify({'error': 'Permintaan tidak ditemukan'}), 404
    return jsonify(_req_dict(r)), 200


@spare_parts_bp.route('/requests', methods=['POST'])
@jwt_required()
@require_permission('maintenance.create')
def create_request():
    data = request.get_json() or {}
    items = data.get('items') or []
    if not items:
        return jsonify({'error': 'Pilih minimal satu sparepart'}), 400
    try:
        r = SparePartRequest(request_number=generate_number('SPR', SparePartRequest, 'request_number'),
                             machine_id=data.get('machine_id') or None, maintenance_record_id=data.get('maintenance_record_id') or None,
                             notes=data.get('notes'), requested_by=int(get_jwt_identity()), status='pending')
        seen = set()
        for it in items:
            sp = db.session.get(SparePart, it.get('spare_part_id') or 0)
            qty = _dec(it.get('qty_requested'))
            if not sp or not sp.is_active:
                return jsonify({'error': 'Sparepart tidak ditemukan'}), 400
            if qty is None or qty <= 0:
                return jsonify({'error': f'Jumlah {sp.part_number} harus lebih dari 0'}), 400
            if sp.id in seen:
                return jsonify({'error': f'{sp.part_number} dipilih dua kali'}), 400
            seen.add(sp.id)
            r.items.append(SparePartRequestItem(spare_part_id=sp.id, qty_requested=qty, notes=it.get('notes')))
        db.session.add(r)
        db.session.commit()
        return jsonify({'message': 'Permintaan dibuat', 'request_id': r.id, 'request_number': r.request_number}), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def _load_pending(rid):
    r = db.session.query(SparePartRequest).filter_by(id=rid).with_for_update().first()
    if not r:
        return None, (jsonify({'error': 'Permintaan tidak ditemukan'}), 404)
    if r.status != 'pending':
        return None, (jsonify({'error': f'Permintaan sudah berstatus {r.status}'}), 400)
    return r, None


@spare_parts_bp.route('/requests/<int:rid>/approve', methods=['POST'])
@jwt_required()
@require_permission('maintenance.approve')
def approve_request(rid):
    uid = int(get_jwt_identity())
    r, err = _load_pending(rid)
    if err:
        return err
    user = db.session.get(User, uid)
    if r.requested_by == uid and not getattr(user, 'is_super_admin', False):
        return jsonify({'error': 'Permintaan tidak boleh disetujui oleh pembuatnya sendiri'}), 403
    try:
        for it in r.items:
            part = db.session.query(SparePart).filter_by(id=it.spare_part_id).with_for_update().first()
            _move(part, 'out', Decimal(str(it.qty_requested)), uid, notes=f'Permintaan {r.request_number}',
                  maintenance_record_id=r.maintenance_record_id)
            it.qty_issued = it.qty_requested
        r.status, r.decided_by, r.decided_at = 'approved', uid, datetime.utcnow()
        r.decision_note = (request.get_json(silent=True) or {}).get('note')
        db.session.commit()
        return jsonify({'message': 'Disetujui, stok sparepart sudah dikurangi'}), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@spare_parts_bp.route('/requests/<int:rid>/reject', methods=['POST'])
@jwt_required()
@require_permission('maintenance.approve')
def reject_request(rid):
    r, err = _load_pending(rid)
    if err:
        return err
    note = ((request.get_json(silent=True) or {}).get('note') or '').strip()
    if not note:
        return jsonify({'error': 'Alasan penolakan wajib diisi'}), 400
    r.status, r.decided_by, r.decided_at, r.decision_note = 'rejected', int(get_jwt_identity()), datetime.utcnow(), note
    db.session.commit()
    return jsonify({'message': 'Permintaan ditolak'}), 200


@spare_parts_bp.route('/requests/<int:rid>/cancel', methods=['POST'])
@jwt_required()
@require_permission('maintenance.create')
def cancel_request(rid):
    uid = int(get_jwt_identity())
    r, err = _load_pending(rid)
    if err:
        return err
    user = db.session.get(User, uid)
    if r.requested_by != uid and not getattr(user, 'is_super_admin', False):
        return jsonify({'error': 'Hanya pembuat permintaan yang bisa membatalkan'}), 403
    r.status, r.decided_by, r.decided_at = 'cancelled', uid, datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Permintaan dibatalkan'}), 200
