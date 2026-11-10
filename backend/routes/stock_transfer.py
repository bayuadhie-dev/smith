"""Pemindahan Barang (IT/MM/NNNN) dan Terima Barang (IT/MM/NNNN-n)."""
from datetime import datetime
from decimal import Decimal
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_
from models import db
from models.stock_transfer import StockTransfer, StockTransferLine, StockTransferReceipt, StockTransferReceiptLine
from models.warehouse import WarehouseLocation, Inventory
from models.material_issue import MaterialIssue, MaterialIssueItem
from models.product import Material, Product
from utils.auth_decorators import require_permission
from utils.inventory_helpers import record_inventory_transaction
from utils.opname_lock import check_opname_lock
from utils.timezone import get_local_now

stock_transfer_bp = Blueprint('stock_transfer', __name__)

Q = Decimal('0.0001')


def _d(v):
    return Decimal(str(v or 0))


def _next_number(now):
    prefix = f'IT/{now.month:02d}/'
    rows = db.session.query(StockTransfer.transfer_number).filter(StockTransfer.transfer_number.like(f'{prefix}%')).all()
    top = 0
    for (n,) in rows:
        tail = n[len(prefix):]
        if tail.isdigit():
            top = max(top, int(tail))
    return f'{prefix}{top + 1:04d}'


def _loc_label(loc):
    if not loc:
        return None
    zone = loc.zone.name if getattr(loc, 'zone', None) else None
    return f'{zone} / {loc.location_code}' if zone else loc.location_code


def _line_dict(l):
    return {'id': l.id, 'material_id': l.material_id, 'product_id': l.product_id, 'item_code': l.item_code, 'item_name': l.item_name,
            'uom': l.uom, 'quantity': float(l.quantity), 'received_quantity': float(l.received_quantity or 0),
            'outstanding': float(_d(l.quantity) - _d(l.received_quantity)), 'batch_number': l.batch_number}


def _dict(t, full=False):
    d = {'id': t.id, 'transfer_number': t.transfer_number, 'source_type': t.source_type, 'source_id': t.source_id,
         'source_number': t.source_number, 'from_location_id': t.from_location_id, 'to_location_id': t.to_location_id,
         'from_label': _loc_label(t.from_location), 'to_label': _loc_label(t.to_location), 'status': t.status, 'notes': t.notes,
         'shipped_at': t.shipped_at.isoformat() if t.shipped_at else None, 'created_at': t.created_at.isoformat() if t.created_at else None,
         'line_count': len(t.lines), 'receipt_count': len(t.receipts)}
    if full:
        d['lines'] = [_line_dict(l) for l in t.lines]
        d['receipts'] = [{'id': r.id, 'receipt_number': r.receipt_number, 'received_at': r.received_at.isoformat(), 'to_label': _loc_label(r.to_location),
                          'notes': r.notes, 'lines': [{'line_id': rl.line_id, 'quantity': float(rl.quantity)} for rl in r.lines]} for r in t.receipts]
    return d


def _already_transferred(source_type, source_id, material_id, product_id):
    q = db.session.query(db.func.coalesce(db.func.sum(StockTransferLine.quantity), 0)).join(StockTransfer).filter(
        StockTransfer.source_type == source_type, StockTransfer.source_id == source_id, StockTransfer.status != 'cancelled')
    q = q.filter(StockTransferLine.material_id == material_id) if material_id else q.filter(StockTransferLine.product_id == product_id)
    return _d(q.scalar())


@stock_transfer_bp.route('/sources', methods=['GET'])
@jwt_required()
@require_permission('warehouse.view')
def sources():
    """Permintaan Barang dan Penerimaan Barang (GRN) yang masih punya qty belum dipindahkan."""
    from models.purchasing import GoodsReceivedNote
    out = []
    for mi in MaterialIssue.query.filter(MaterialIssue.status.in_(['pending', 'approved', 'issued'])).order_by(MaterialIssue.id.desc()).limit(200).all():
        lines = []
        for it in mi.items:
            rem = _d(it.required_quantity) - _already_transferred('material_issue', mi.id, it.material_id, it.product_id)
            if rem > 0 and (it.material_id or it.product_id):
                item = db.session.get(Material, it.material_id) if it.material_id else db.session.get(Product, it.product_id)
                lines.append({'material_id': it.material_id, 'product_id': it.product_id, 'item_code': getattr(item, 'code', None),
                              'item_name': it.description, 'uom': it.uom, 'quantity': float(rem), 'batch_number': it.batch_number})
        if lines:
            out.append({'source_type': 'material_issue', 'source_id': mi.id, 'source_number': mi.issue_number, 'from_location_id': None, 'lines': lines})
    for g in GoodsReceivedNote.query.filter(GoodsReceivedNote.status == 'approved').order_by(GoodsReceivedNote.id.desc()).limit(200).all():
        lines, loc = [], None
        for it in g.items:
            if not it.location_id or not (it.material_id or it.product_id):
                continue
            rem = _d(it.quantity_accepted) - _already_transferred('grn', g.id, it.material_id, it.product_id)
            if rem > 0:
                loc = loc or it.location_id
                lines.append({'material_id': it.material_id, 'product_id': it.product_id, 'item_code': it.item_code, 'item_name': it.item_name,
                              'uom': it.uom, 'quantity': float(rem), 'batch_number': it.batch_number})
        if lines:
            out.append({'source_type': 'grn', 'source_id': g.id, 'source_number': g.grn_number, 'from_location_id': loc, 'lines': lines})
    return jsonify({'sources': out}), 200


@stock_transfer_bp.route('', methods=['GET'])
@jwt_required()
@require_permission('warehouse.view')
def list_transfers():
    q = StockTransfer.query
    if request.args.get('status'):
        q = q.filter(StockTransfer.status == request.args['status'])
    if request.args.get('pending_receipt'):
        q = q.filter(StockTransfer.status.in_(['shipped', 'partial']))
    s = (request.args.get('search') or '').strip()
    if s:
        like = f'%{s}%'
        q = q.filter(or_(StockTransfer.transfer_number.ilike(like), StockTransfer.source_number.ilike(like)))
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 30, type=int)
    res = q.order_by(StockTransfer.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({'transfers': [_dict(t) for t in res.items], 'total': res.total, 'pages': res.pages, 'current_page': res.page}), 200


@stock_transfer_bp.route('/<int:tid>', methods=['GET'])
@jwt_required()
@require_permission('warehouse.view')
def get_transfer(tid):
    t = db.session.get(StockTransfer, tid)
    if not t:
        return jsonify({'error': 'Pemindahan tidak ditemukan'}), 404
    return jsonify(_dict(t, full=True)), 200


@stock_transfer_bp.route('', methods=['POST'])
@jwt_required()
@require_permission('warehouse.create')
def create_transfer():
    try:
        d = request.get_json() or {}
        user_id = int(get_jwt_identity())
        frm, to = d.get('from_location_id'), d.get('to_location_id')
        if not frm or not to:
            return jsonify({'error': 'Pilih gudang/lokasi asal dan tujuan'}), 400
        if int(frm) == int(to):
            return jsonify({'error': 'Lokasi asal dan tujuan tidak boleh sama'}), 400
        lines_in = d.get('lines') or []
        if not lines_in:
            return jsonify({'error': 'Minimal satu barang'}), 400
        stype, sid = d.get('source_type') or 'manual', d.get('source_id')
        src_no = None
        if stype == 'material_issue':
            mi = db.session.get(MaterialIssue, sid)
            if not mi:
                return jsonify({'error': 'Permintaan Barang tidak ditemukan'}), 404
            src_no = mi.issue_number
        elif stype == 'grn':
            from models.purchasing import GoodsReceivedNote
            g = db.session.get(GoodsReceivedNote, sid)
            if not g:
                return jsonify({'error': 'Penerimaan Barang tidak ditemukan'}), 404
            src_no = g.grn_number
        elif stype != 'manual':
            return jsonify({'error': 'Sumber tidak dikenal'}), 400
        t = StockTransfer(transfer_number=_next_number(get_local_now()), source_type=stype, source_id=sid if stype != 'manual' else None,
                          source_number=src_no, from_location_id=int(frm), to_location_id=int(to), status='draft',
                          notes=d.get('notes'), created_by=user_id)
        for l in lines_in:
            qty = _d(l.get('quantity'))
            if qty <= 0 or not (l.get('material_id') or l.get('product_id')):
                return jsonify({'error': 'Setiap baris butuh barang dan qty lebih dari 0'}), 400
            t.lines.append(StockTransferLine(material_id=l.get('material_id'), product_id=l.get('product_id'), item_code=l.get('item_code'),
                                             item_name=l.get('item_name') or '-', uom=l.get('uom'), quantity=qty, batch_number=l.get('batch_number') or None))
        db.session.add(t)
        db.session.commit()
        return jsonify({'message': f'Pemindahan {t.transfer_number} dibuat', **_dict(t, full=True)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@stock_transfer_bp.route('/<int:tid>/ship', methods=['POST'])
@jwt_required()
@require_permission('warehouse.create')
def ship_transfer(tid):
    """Barang keluar dari lokasi asal (FIFO per batch). Setelah ini menunggu Terima Barang di tujuan."""
    try:
        user_id = int(get_jwt_identity())
        t = db.session.get(StockTransfer, tid)
        if not t:
            return jsonify({'error': 'Pemindahan tidak ditemukan'}), 404
        if t.status != 'draft':
            return jsonify({'error': 'Hanya pemindahan berstatus draft yang bisa dikirim'}), 400
        for loc in (t.from_location_id, t.to_location_id):
            lock = check_opname_lock(location_id=loc)
            if lock['locked']:
                return jsonify({'error': lock['message']}), 423
        new_lines = []
        for l in list(t.lines):
            need = _d(l.quantity)
            q = Inventory.query.filter(Inventory.location_id == t.from_location_id, Inventory.material_id == l.material_id,
                                       Inventory.product_id == l.product_id, Inventory.quantity_available > 0)
            if l.batch_number:
                q = q.filter(Inventory.batch_number == l.batch_number)
            rows = q.order_by(Inventory.expiry_date.asc().nullslast(), Inventory.id.asc()).with_for_update().all()
            if sum((_d(r.quantity_available) for r in rows), Decimal('0')) < need:
                return jsonify({'error': f'Stok {l.item_name} di lokasi asal tidak cukup'}), 400
            first = True
            for r in rows:
                if need <= 0:
                    break
                take = min(need, _d(r.quantity_available))
                r.quantity_on_hand = _d(r.quantity_on_hand) - take
                r.quantity_available = _d(r.quantity_available) - take
                loc = db.session.get(WarehouseLocation, t.from_location_id)
                if loc:
                    loc.occupied = float(loc.occupied or 0) - float(take)
                record_inventory_transaction(transaction_type='transfer_out', direction='out', quantity=float(take), material_id=l.material_id,
                                             product_id=l.product_id, from_location_id=t.from_location_id, to_location_id=t.to_location_id,
                                             batch_number=r.batch_number, lot_number=r.lot_number, reference_type='stock_transfer',
                                             reference_id=t.id, reference_number=t.transfer_number, created_by=user_id,
                                             notes=f'Pemindahan {t.transfer_number}')
                if first:
                    l.quantity, l.batch_number, first = take, r.batch_number, False
                else:
                    new_lines.append(StockTransferLine(transfer_id=t.id, material_id=l.material_id, product_id=l.product_id, item_code=l.item_code,
                                                       item_name=l.item_name, uom=l.uom, quantity=take, batch_number=r.batch_number))
                need -= take
        for nl in new_lines:
            t.lines.append(nl)
        t.status, t.shipped_by, t.shipped_at = 'shipped', user_id, datetime.utcnow()
        db.session.commit()
        return jsonify({'message': f'{t.transfer_number} dikirim, menunggu Terima Barang', **_dict(t, full=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@stock_transfer_bp.route('/<int:tid>/receive', methods=['POST'])
@jwt_required()
@require_permission('warehouse.create')
def receive_transfer(tid):
    """Terima Barang: nomor IT/MM/NNNN-n. Boleh sebagian; sisanya diterima di penerimaan berikutnya."""
    try:
        user_id = int(get_jwt_identity())
        d = request.get_json() or {}
        t = db.session.get(StockTransfer, tid)
        if not t:
            return jsonify({'error': 'Pemindahan tidak ditemukan'}), 404
        if t.status not in ('shipped', 'partial'):
            return jsonify({'error': 'Pemindahan ini belum dikirim atau sudah diterima semua'}), 400
        to_loc = int(d.get('to_location_id') or t.to_location_id)
        lock = check_opname_lock(location_id=to_loc)
        if lock['locked']:
            return jsonify({'error': lock['message']}), 423
        by_id = {l.id: l for l in t.lines}
        picks = [(by_id.get(int(x.get('line_id'))), _d(x.get('quantity'))) for x in (d.get('lines') or []) if _d(x.get('quantity')) > 0]
        if not picks or any(l is None for l, _ in picks):
            return jsonify({'error': 'Isi qty yang diterima'}), 400
        for l, qty in picks:
            if qty > _d(l.quantity) - _d(l.received_quantity) + Q:
                return jsonify({'error': f'Qty {l.item_name} melebihi sisa yang belum diterima'}), 400
        receipt = StockTransferReceipt(transfer_id=t.id, receipt_number=f'{t.transfer_number}-{len(t.receipts) + 1}', to_location_id=to_loc,
                                       notes=d.get('notes'), received_by=user_id)
        db.session.add(receipt)
        db.session.flush()
        dest = db.session.get(WarehouseLocation, to_loc)
        for l, qty in picks:
            src = Inventory.query.filter_by(location_id=t.from_location_id, material_id=l.material_id, product_id=l.product_id,
                                            batch_number=l.batch_number).first()
            inv = Inventory.query.filter_by(location_id=to_loc, material_id=l.material_id, product_id=l.product_id,
                                            batch_number=l.batch_number).with_for_update().first()
            if inv:
                inv.quantity_on_hand = _d(inv.quantity_on_hand) + qty
                inv.quantity_available = _d(inv.quantity_available) + qty
            else:
                db.session.add(Inventory(material_id=l.material_id, product_id=l.product_id, location_id=to_loc, quantity_on_hand=qty,
                                         quantity_available=qty, batch_number=l.batch_number, lot_number=src.lot_number if src else None,
                                         production_date=src.production_date if src else None, expiry_date=src.expiry_date if src else None,
                                         stock_status=src.stock_status if src else 'available', is_active=True, created_by=user_id))
            if dest:
                dest.occupied = float(dest.occupied or 0) + float(qty)
            l.received_quantity = _d(l.received_quantity) + qty
            db.session.add(StockTransferReceiptLine(receipt_id=receipt.id, line_id=l.id, quantity=qty))
            record_inventory_transaction(transaction_type='transfer_in', direction='in', quantity=float(qty), material_id=l.material_id,
                                         product_id=l.product_id, from_location_id=t.from_location_id, to_location_id=to_loc,
                                         batch_number=l.batch_number, reference_type='stock_transfer', reference_id=t.id,
                                         reference_number=receipt.receipt_number, created_by=user_id, notes=f'Terima Barang {receipt.receipt_number}')
        db.session.flush()
        t.status = 'received' if all(_d(x.received_quantity) >= _d(x.quantity) - Q for x in t.lines) else 'partial'
        db.session.commit()
        return jsonify({'message': f'Terima Barang {receipt.receipt_number} tersimpan', **_dict(t, full=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@stock_transfer_bp.route('/<int:tid>/cancel', methods=['POST'])
@jwt_required()
@require_permission('warehouse.create')
def cancel_transfer(tid):
    t = db.session.get(StockTransfer, tid)
    if not t:
        return jsonify({'error': 'Pemindahan tidak ditemukan'}), 404
    if t.status != 'draft':
        return jsonify({'error': 'Hanya draft yang bisa dibatalkan (barang sudah keluar dari gudang asal)'}), 400
    t.status = 'cancelled'
    db.session.commit()
    return jsonify({'message': 'Dibatalkan', **_dict(t)}), 200


@stock_transfer_bp.route('/item-stock', methods=['GET'])
@jwt_required()
@require_permission('warehouse.view')
def item_stock():
    """Per barang: stok di tiap gudang/lokasi/batch, plus mutasinya."""
    from models.wms_advanced import InventoryTransaction
    mid, pid = request.args.get('material_id', type=int), request.args.get('product_id', type=int)
    if not mid and not pid:
        return jsonify({'error': 'material_id atau product_id wajib'}), 400
    iq = Inventory.query.filter(Inventory.quantity_on_hand != 0)
    iq = iq.filter(Inventory.material_id == mid) if mid else iq.filter(Inventory.product_id == pid)
    stock = [{'zone': r.location.zone.name if r.location and r.location.zone else None, 'location': r.location.location_code if r.location else None,
              'batch_number': r.batch_number, 'on_hand': float(r.quantity_on_hand), 'available': float(r.quantity_available), 'stock_status': r.stock_status}
             for r in iq.order_by(Inventory.location_id, Inventory.id).all()]
    tq = InventoryTransaction.query
    tq = tq.filter(InventoryTransaction.material_id == mid) if mid else tq.filter(InventoryTransaction.product_id == pid)
    moves = [{'date': m.transaction_date.isoformat() if m.transaction_date else None, 'type': m.transaction_type, 'direction': m.direction,
              'quantity': float(m.quantity), 'batch_number': m.batch_number, 'reference_number': m.reference_number,
              'from_location_id': m.from_location_id, 'to_location_id': m.to_location_id}
             for m in tq.order_by(InventoryTransaction.id.desc()).limit(200).all()]
    locs = {l.id: _loc_label(l) for l in WarehouseLocation.query.all()}
    for m in moves:
        m['from_label'], m['to_label'] = locs.get(m['from_location_id']), locs.get(m['to_location_id'])
    return jsonify({'stock': stock, 'total_on_hand': sum(s['on_hand'] for s in stock), 'movements': moves}), 200


@stock_transfer_bp.route('/zone-stock/<int:zone_id>', methods=['GET'])
@jwt_required()
@require_permission('warehouse.view')
def zone_stock(zone_id):
    """Master gudang: lokasi, stok per barang, dan mutasi satu gudang."""
    from models.warehouse import WarehouseZone
    from models.wms_advanced import InventoryTransaction
    zone = db.session.get(WarehouseZone, zone_id)
    if not zone:
        return jsonify({'error': 'Gudang tidak ditemukan'}), 404
    locs = WarehouseLocation.query.filter_by(zone_id=zone_id).all()
    loc_ids = [l.id for l in locs]
    rows = Inventory.query.filter(Inventory.location_id.in_(loc_ids or [0]), Inventory.quantity_on_hand != 0).all()
    items, per_loc = {}, {}
    for r in rows:
        key = ('m', r.material_id) if r.material_id else ('p', r.product_id)
        it = items.setdefault(key, {'kind': 'material' if r.material_id else 'product', 'item_id': key[1], 'on_hand': 0.0, 'available': 0.0})
        it['on_hand'] += float(r.quantity_on_hand)
        it['available'] += float(r.quantity_available)
        per_loc[r.location_id] = per_loc.get(r.location_id, 0.0) + float(r.quantity_on_hand)
    for it in items.values():
        obj = db.session.get(Material, it['item_id']) if it['kind'] == 'material' else db.session.get(Product, it['item_id'])
        it['code'], it['name'] = getattr(obj, 'code', None), getattr(obj, 'name', None)
        it['uom'] = getattr(obj, 'primary_uom', None) or getattr(obj, 'unit_of_measure', None)
    mq = InventoryTransaction.query.filter(or_(InventoryTransaction.to_location_id.in_(loc_ids or [0]), InventoryTransaction.from_location_id.in_(loc_ids or [0])))
    names = {l.id: l.location_code for l in locs}
    moves = []
    for m in mq.order_by(InventoryTransaction.id.desc()).limit(200).all():
        obj = db.session.get(Material, m.material_id) if m.material_id else (db.session.get(Product, m.product_id) if m.product_id else None)
        moves.append({'date': m.transaction_date.isoformat() if m.transaction_date else None, 'type': m.transaction_type, 'direction': m.direction,
                      'quantity': float(m.quantity), 'item': getattr(obj, 'name', None), 'batch_number': m.batch_number, 'reference_number': m.reference_number,
                      'location': names.get(m.to_location_id) or names.get(m.from_location_id)})
    return jsonify({'zone': {'id': zone.id, 'code': zone.code, 'name': zone.name, 'zone_type': zone.zone_type, 'is_active': zone.is_active},
                    'locations': [{'id': l.id, 'location_code': l.location_code, 'on_hand': per_loc.get(l.id, 0.0), 'is_active': l.is_active} for l in locs],
                    'items': sorted(items.values(), key=lambda x: -x['on_hand']), 'movements': moves}), 200
