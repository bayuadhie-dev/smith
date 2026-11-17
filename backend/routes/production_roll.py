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


# ---- Roll masuk stok -------------------------------------------------------
# Roll yang sudah ditimbang langsung jadi stok kain, dengan nomor batch = nomor
# rollnya. Dengan begitu saldo kain kelihatan di laporan persediaan dan nomor
# rollnya bisa dipilih langsung saat dijual lewat Surat Jalan.

def _lokasi_gudang_kain():
    """Lokasi penyimpanan kain: zona Gudang Kain, kalau tidak ada pakai zona WIP.

    Mengembalikan None kalau gudangnya memang belum disiapkan - roll tetap boleh
    dicatat, hanya belum menambah stok, dan halamannya memberi tahu.
    """
    from models.warehouse import WarehouseLocation, WarehouseZone
    zona = (WarehouseZone.query.filter(WarehouseZone.code == 'WH-KAIN').first()
            or WarehouseZone.query.filter(WarehouseZone.name.ilike('%kain%')).first()
            or WarehouseZone.query.filter(WarehouseZone.material_type == 'wip').first())
    if not zona:
        return None
    return WarehouseLocation.query.filter_by(zone_id=zona.id, is_active=True).order_by(WarehouseLocation.id).first()


def _nomor_batch(roll_number, cycle, repeat_number=None):
    nomor = f'{roll_number}-{repeat_number}' if repeat_number else str(roll_number)
    return nomor if (cycle or 1) <= 1 else f'{nomor}/P{cycle}'


def _baris_stok(roll, buat=False):
    from models.warehouse import Inventory
    lokasi = _lokasi_gudang_kain()
    if not lokasi:
        return None
    inv = Inventory.query.filter_by(product_id=roll.product_id, location_id=lokasi.id,
                                    batch_number=roll.batch_number).first()
    if not inv and buat:
        inv = Inventory(product_id=roll.product_id, location_id=lokasi.id, batch_number=roll.batch_number,
                        quantity_on_hand=0, quantity_available=0, stock_status='available', is_active=True)
        db.session.add(inv)
        db.session.flush()
    return inv


def _harga_satuan(roll):
    """Biaya per kg untuk roll ini: dari BOM SPK kalau ada, kalau tidak dari master produk."""
    if roll.work_order_id:
        try:
            from models.production import WorkOrderBOMItem
            total = db.session.query(db.func.sum(WorkOrderBOMItem.total_cost_planned)).filter(
                WorkOrderBOMItem.work_order_id == roll.work_order_id).scalar()
            wo = roll.work_order
            if total and wo and float(wo.quantity or 0) > 0:
                return round(float(total) / float(wo.quantity), 2)
        except Exception:
            pass
    biaya = getattr(roll.product, 'cost', None)
    return float(biaya) if biaya else None


def _masukkan_stok(roll, user_id):
    """Tambahkan roll ke stok kain. Kalau gudang kainnya belum ada, roll tetap
    tercatat tanpa stok (dikembalikan False) supaya pencatatan lapangan jalan terus."""
    from utils.inventory_helpers import record_inventory_transaction
    inv = _baris_stok(roll, buat=True)
    if not inv:
        return False
    qty = float(roll.net_weight_kg)
    inv.quantity_on_hand = float(inv.quantity_on_hand or 0) + qty
    inv.quantity_available = float(inv.quantity_available or 0) + qty
    inv.updated_at = datetime.utcnow()
    harga = _harga_satuan(roll)
    record_inventory_transaction(
        transaction_type='stock_in', direction='in', quantity=qty,
        product_id=roll.product_id, to_location_id=inv.location_id,
        batch_number=roll.batch_number, reference_type='production_roll', reference_id=roll.id,
        reference_number=roll.batch_number, work_order_id=roll.work_order_id, machine_id=roll.machine_id,
        shift=roll.shift, unit_cost=harga, total_cost=round(harga * qty, 2) if harga else None,
        notes=f'Roll spunlace {roll.batch_number} - {roll.product.name if roll.product else ""}',
        created_by=user_id,
    )
    return True


def _keluarkan_stok(roll, user_id, alasan):
    """Tarik kembali stok roll (saat dibatalkan atau beratnya dikoreksi)."""
    from utils.inventory_helpers import record_inventory_transaction
    inv = _baris_stok(roll)
    if not inv:
        return False          # memang belum pernah masuk stok
    qty = float(roll.net_weight_kg)
    if float(inv.quantity_available or 0) < qty - 0.001:
        raise RollError('Stok roll ini sudah dipakai atau dikirim sebagian, jadi tidak bisa ditarik lagi', 409)
    inv.quantity_on_hand = float(inv.quantity_on_hand) - qty
    inv.quantity_available = float(inv.quantity_available) - qty
    inv.updated_at = datetime.utcnow()
    record_inventory_transaction(
        transaction_type='stock_out', direction='out', quantity=qty,
        product_id=roll.product_id, from_location_id=inv.location_id,
        batch_number=roll.batch_number, reference_type='production_roll_cancel', reference_id=roll.id,
        reference_number=roll.batch_number, notes=alasan, created_by=user_id,
    )
    return True


def _sisa_stok(rolls):
    """Sisa kg per roll, dibaca dari stok - roll yang sudah terkirim tinggal 0."""
    from models.warehouse import Inventory
    batches = [r.batch_number for r in rolls if r.batch_number]
    if not batches:
        return {}
    rows = db.session.query(Inventory.product_id, Inventory.batch_number,
                            db.func.sum(Inventory.quantity_on_hand)).filter(
        Inventory.batch_number.in_(batches), Inventory.is_active.is_(True)).group_by(
        Inventory.product_id, Inventory.batch_number).all()
    return {(pid, b): float(q or 0) for pid, b, q in rows}


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
    sisa = _sisa_stok(rows.items)
    out = []
    for r in rows.items:
        d = r.to_dict()
        d['stock_remaining_kg'] = round(sisa.get((r.product_id, r.batch_number), 0.0), 2)
        out.append(d)
    return jsonify({'rolls': out, 'total': rows.total, 'page': page, 'pages': rows.pages})


@production_roll_bp.route('/<int:rid>', methods=['GET'])
@jwt_required()
@require_permission('production.view')
def get_roll(rid):
    r = db.session.get(ProductionRoll, rid)
    if not r:
        raise RollError('Roll tidak ditemukan', 404)
    data = r.to_dict()
    data['children'] = [c.to_dict() for c in r.children]
    data['stock_remaining_kg'] = round(_sisa_stok([r]).get((r.product_id, r.batch_number), 0.0), 2)
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
    roll.batch_number = _nomor_batch(roll.roll_number, roll.cycle)
    db.session.add(roll)
    db.session.flush()
    _masukkan_stok(roll, int(get_jwt_identity()))
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

    # Kalau nomor, kain, atau berat bersihnya berubah, stok yang sudah terlanjur
    # masuk ikut dikoreksi: baris lama ditarik lalu dimasukkan ulang dengan nilai
    # baru. Kalau stoknya sudah dipakai, perubahan ditolak - bukan diam-diam beda.
    user_id = int(get_jwt_identity())
    stok_berubah = (v['roll_number'] != roll.roll_number or v['product'].id != roll.product_id
                    or abs(float(v['net']) - float(roll.net_weight_kg)) > 0.001)
    if stok_berubah:
        _keluarkan_stok(roll, user_id, f'Koreksi roll {roll.batch_number}')

    roll.roll_number = v['roll_number']
    roll.product_id = v['product'].id
    roll.produced_at = v['tanggal']
    roll.gross_weight_kg = v['gross']
    roll.net_weight_kg = v['net']
    roll.grade = v['grade']
    if stok_berubah:
        roll.batch_number = _nomor_batch(roll.roll_number, roll.cycle)
        db.session.flush()
        _masukkan_stok(roll, user_id)
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
    alasan = (request.get_json(silent=True) or {}).get('reason')
    _keluarkan_stok(roll, int(get_jwt_identity()), f'Roll {roll.batch_number} dibatalkan' + (f': {alasan}' if alasan else ''))
    roll.status = 'cancelled'
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


@production_roll_bp.route('/<int:rid>/slit', methods=['POST'])
@jwt_required()
@require_permission('production.create')
def slit_roll(rid):
    """Potong satu main roll jadi beberapa jumbo roll.

    Jumbo roll memakai nomor main roll-nya ditambah nomor repeat (500-1, 500-2, ...)
    dan tetap tertaut ke induknya, jadi dari jumbo roll bisa ditelusuri balik sampai
    SPK dan shift yang membuatnya. Stok main roll berkurang sebesar yang dipotong,
    stok jumbo roll bertambah, dan sisa potongan (waste sliting) boleh dikembalikan
    ke gudang bahan baku sebagai material daur ulang.
    """
    induk = db.session.get(ProductionRoll, rid)
    if not induk:
        raise RollError('Roll tidak ditemukan', 404)
    if induk.roll_type != 'main':
        raise RollError('Yang dipotong harus main roll', 409)
    if induk.status != 'available':
        raise RollError(f'Main roll ini berstatus {induk.status}, tidak bisa dipotong', 409)

    data = request.get_json() or {}
    baris = data.get('rolls') or []
    if not baris:
        raise RollError('Isi minimal satu jumbo roll hasil potongan')

    waste = _f(data.get('waste_kg')) if data.get('waste_kg') else 0.0
    if waste < 0:
        raise RollError('Waste sliting tidak boleh minus')

    user_id = int(get_jwt_identity())
    tersedia = _sisa_stok([induk]).get((induk.product_id, induk.batch_number), 0.0)
    if tersedia <= 0:
        tersedia = float(induk.net_weight_kg)    # belum masuk stok (gudang kain belum ada)

    anak_data = []
    total = 0.0
    dipakai = {int(c.repeat_number) for c in induk.children if c.repeat_number}
    urut = 1
    for i, b in enumerate(baris, 1):
        neto = _f(b.get('net_weight_kg'))
        bruto = _f(b.get('gross_weight_kg')) if b.get('gross_weight_kg') else neto
        if neto <= 0:
            raise RollError(f'Baris {i}: isi berat bersih jumbo roll')
        if neto > bruto:
            raise RollError(f'Baris {i}: berat bersih tidak boleh lebih besar dari berat kotor')
        grade = (b.get('grade') or induk.grade or 'A').upper()
        if grade not in GRADES:
            raise RollError(f'Baris {i}: grade hanya A, B, atau C')
        repeat = b.get('repeat_number')
        if repeat:
            repeat = int(repeat)
        else:
            while urut in dipakai:
                urut += 1
            repeat = urut
        if repeat in dipakai:
            raise RollError(f'Nomor repeat {repeat} sudah dipakai pada main roll ini')
        dipakai.add(repeat)
        total += neto
        anak_data.append({'repeat': repeat, 'neto': neto, 'bruto': bruto, 'grade': grade,
                          'length_m': _f(b.get('length_m')) if b.get('length_m') else None,
                          'width_cm': _f(b.get('width_cm')) if b.get('width_cm') else None,
                          'notes': (b.get('notes') or '').strip() or None})

    if total + waste > tersedia + 0.001:
        raise RollError(f'Jumlah potongan ({total + waste:,.2f} kg) melebihi sisa main roll '
                        f'({tersedia:,.2f} kg)'.replace(',', '#').replace('.', ',').replace('#', '.'))

    # Stok main roll berkurang sebanyak yang dipotong, termasuk waste-nya.
    terpakai = round(total + waste, 2)
    inv_induk = _baris_stok(induk)
    if inv_induk:
        if float(inv_induk.quantity_available or 0) < terpakai - 0.001:
            raise RollError('Sisa stok main roll tidak cukup untuk potongan sebanyak ini', 409)
        inv_induk.quantity_on_hand = float(inv_induk.quantity_on_hand) - terpakai
        inv_induk.quantity_available = float(inv_induk.quantity_available) - terpakai
        inv_induk.updated_at = datetime.utcnow()
        from utils.inventory_helpers import record_inventory_transaction
        record_inventory_transaction(
            transaction_type='stock_out', direction='out', quantity=terpakai,
            product_id=induk.product_id, from_location_id=inv_induk.location_id,
            batch_number=induk.batch_number, reference_type='roll_slitting', reference_id=induk.id,
            reference_number=induk.batch_number, notes=f'Sliting main roll {induk.batch_number}',
            created_by=user_id)

    anak_keluar = []
    for a in anak_data:
        anak = ProductionRoll(
            roll_number=induk.roll_number, cycle=induk.cycle, repeat_number=a['repeat'],
            roll_type='jumbo', parent_roll_id=induk.id, product_id=induk.product_id,
            work_order_id=induk.work_order_id, machine_id=induk.machine_id,
            produced_at=_tanggal_sliting(data, induk), shift=induk.shift,
            gross_weight_kg=a['bruto'], net_weight_kg=a['neto'], grade=a['grade'],
            length_m=a['length_m'], width_cm=a['width_cm'], notes=a['notes'],
            created_by=user_id,
        )
        anak.batch_number = _nomor_batch(anak.roll_number, anak.cycle, anak.repeat_number)
        db.session.add(anak)
        db.session.flush()
        _masukkan_stok(anak, user_id)
        anak_keluar.append(anak)

    if waste > 0:
        _catat_waste_sliting(induk, waste, data.get('waste_material_id'), user_id)

    sisa = tersedia - terpakai
    if sisa <= 0.001:
        induk.status = 'consumed'
    db.session.commit()
    return jsonify({'parent': induk.to_dict(), 'children': [a.to_dict() for a in anak_keluar],
                    'waste_kg': waste, 'remaining_kg': round(max(sisa, 0), 2)}), 201


def _tanggal_sliting(data, induk):
    try:
        return datetime.fromisoformat(str(data['slit_date'])).date() if data.get('slit_date') else induk.produced_at
    except (TypeError, ValueError):
        raise RollError('Tanggal sliting tidak valid')


def _catat_waste_sliting(induk, qty, material_id, user_id):
    """Waste sliting kembali ke gudang bahan baku kalau materialnya ditunjuk -
    di Fengsheng waste warna campur dipakai lagi sebagai campuran bantal."""
    from models.warehouse import Inventory, WarehouseLocation, WarehouseZone
    from utils.inventory_helpers import record_inventory_transaction

    if not material_id:
        record_inventory_transaction(
            transaction_type='waste', direction='out', quantity=qty,
            product_id=induk.product_id, batch_number=induk.batch_number,
            reference_type='roll_slitting_waste', reference_id=induk.id,
            notes=f'Waste sliting main roll {induk.batch_number}', created_by=user_id)
        return

    zona = WarehouseZone.query.filter(WarehouseZone.material_type == 'raw_materials').first()
    lokasi = WarehouseLocation.query.filter_by(zone_id=zona.id, is_active=True).first() if zona else None
    if not lokasi:
        raise RollError('Gudang bahan baku belum punya lokasi penyimpanan untuk menampung waste sliting', 409)

    inv = Inventory.query.filter_by(material_id=int(material_id), location_id=lokasi.id,
                                    batch_number=induk.batch_number).first()
    if not inv:
        inv = Inventory(material_id=int(material_id), location_id=lokasi.id, batch_number=induk.batch_number,
                        quantity_on_hand=0, quantity_available=0, stock_status='available', is_active=True)
        db.session.add(inv)
        db.session.flush()
    inv.quantity_on_hand = float(inv.quantity_on_hand or 0) + qty
    inv.quantity_available = float(inv.quantity_available or 0) + qty
    inv.updated_at = datetime.utcnow()
    record_inventory_transaction(
        transaction_type='stock_in', direction='in', quantity=qty,
        material_id=int(material_id), to_location_id=lokasi.id, batch_number=induk.batch_number,
        reference_type='roll_slitting_waste', reference_id=induk.id,
        notes=f'Waste sliting main roll {induk.batch_number} masuk gudang bahan baku', created_by=user_id)
