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
from utils.timezone import get_local_now

production_roll_bp = Blueprint('production_roll', __name__)

GRADES = ('A', 'B', 'C')
GRADE_LABEL = {'A': 'A - bagus', 'B': 'B - perlu sortir', 'C': 'C - reject'}
NOMOR_MAKS = 10000
AKTIF = ('available',)


SPK_AKTIF = ('planned', 'released', 'in_progress')


def _spk_spunlace(wo):
    """SPK yang keluarannya roll: mesinnya mesin spunlace, atau memang sudah punya roll.

    Produksi menegaskan NJO dan RPS itu dokumen yang sama, jadi satu SPK spunlace
    mewakili keduanya.
    """
    if wo is None:
        return False
    m = wo.machine
    if m is not None and ((m.machine_type or '').lower() == 'spunlace' or (m.department or '').lower() == 'spunlace'):
        return True
    return db.session.query(ProductionRoll.id).filter(ProductionRoll.work_order_id == wo.id).first() is not None


def _sinkron_realisasi(wo_id):
    """Realisasi SPK spunlace = jumlah berat bersih roll utamanya.

    Grade A dan B dihitung sebagai hasil baik (B masih bisa disortir dan dijual),
    grade C masuk waste. Jumbo roll hasil sliting sengaja tidak ikut dijumlah -
    isinya berasal dari main roll yang sudah dihitung, jadi akan ganda.
    """
    from models.production import WorkOrder

    wo = db.session.get(WorkOrder, wo_id) if wo_id else None
    if wo is None:
        return
    rolls = ProductionRoll.query.filter(ProductionRoll.work_order_id == wo.id,
                                        ProductionRoll.parent_roll_id.is_(None),
                                        ProductionRoll.status != 'cancelled').all()
    baik = sum(float(r.net_weight_kg or 0) for r in rolls if r.grade in ('A', 'B'))
    reject = sum(float(r.net_weight_kg or 0) for r in rolls if r.grade == 'C')
    wo.quantity_produced = round(baik + reject, 2)
    wo.quantity_good = round(baik, 2)
    wo.quantity_scrap = round(reject, 2)


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


def _alasan_habis(roll):
    """Stok roll habis karena apa: dikirim ke pelanggan atau dipakai produksi."""
    from models.wms_advanced import InventoryTransaction
    terakhir = InventoryTransaction.query.filter(
        InventoryTransaction.product_id == roll.product_id,
        InventoryTransaction.batch_number == roll.batch_number,
        InventoryTransaction.direction == 'out',
    ).order_by(InventoryTransaction.id.desc()).first()
    rujukan = (terakhir.reference_type if terakhir else '') or ''
    return 'shipped' if rujukan in ('sales_order', 'shipping', 'shipping_order') else 'consumed'


def _sinkron_status(rolls):
    """Samakan status roll dengan sisa stoknya.

    Stok roll berkurang lewat Surat Jalan, permintaan bahan, atau sliting - semuanya
    memotong stok langsung tanpa tahu-menahu soal tabel roll. Daripada menyisipkan
    pengait di tiap jalur itu (mudah terlewat saat jalur baru ditambah), status roll
    diselaraskan di sini: begitu stoknya habis, rollnya ditandai terkirim atau
    terpakai sesuai mutasi keluar terakhirnya.
    """
    sisa = _sisa_stok(rolls)
    berubah = False
    for r in rolls:
        if r.status != 'available' or not r.batch_number:
            continue
        qty = sisa.get((r.product_id, r.batch_number))
        if qty is None or qty > 0.001:
            # None = roll ini memang belum pernah masuk stok (gudang kain belum
            # disiapkan), jadi bukan berarti habis.
            continue
        r.status = _alasan_habis(r)
        berubah = True
    if berubah:
        db.session.commit()
    return sisa


@production_roll_bp.route('/meta', methods=['GET'])
@jwt_required()
@require_permission('production.view')
def meta():
    from models.production import Machine
    mesin = Machine.query.filter(Machine.is_active.is_(True),
                                 or_(Machine.machine_type == 'spunlace', Machine.department == 'Spunlace')).all()
    from models.production import WorkOrder

    spk_q = WorkOrder.query.filter(WorkOrder.status.in_(SPK_AKTIF))
    if mesin:
        spk_q = spk_q.filter(or_(WorkOrder.machine_id.in_([m.id for m in mesin]), WorkOrder.machine_id.is_(None)))
    spk = spk_q.order_by(WorkOrder.id.desc()).limit(200).all()
    return jsonify({
        'grades': [{'value': g, 'label': GRADE_LABEL[g]} for g in GRADES],
        'machines': [{'id': m.id, 'code': m.code, 'name': m.name} for m in mesin],
        'work_orders': [{'id': w.id, 'wo_number': w.wo_number,
                         'product_name': w.product.name if w.product else '',
                         'quantity': float(w.quantity or 0), 'uom': w.uom or ''} for w in spk],
        'max_number': NOMOR_MAKS,
        # Untuk isian Pemakaian Bahan. Bahan baku = fiber yang keluar; waste =
        # yang dikembalikan ke gudang karena masih dipakai lagi.
        'materials': _pilihan_material(('raw_materials',)),
        'waste_materials': _pilihan_material(('waste',)),
    })


def _pilihan_material(jenis):
    from models.product import Material

    rows = Material.query.filter(Material.is_active.is_(True),
                                 db.func.lower(Material.material_type).in_(jenis)
                                 ).order_by(Material.name).limit(500).all()
    return [{'id': m.id, 'code': m.code, 'name': m.name, 'uom': m.primary_uom or 'KG'} for m in rows]


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
    sisa = _sinkron_status(rows.items)
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
    sisa = _sinkron_status([r] + list(r.children))
    data = r.to_dict()
    data['children'] = [c.to_dict() for c in r.children]
    data['stock_remaining_kg'] = round(sisa.get((r.product_id, r.batch_number), 0.0), 2)
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

    return {'roll_number': nomor, 'product': product, 'gross': gross, 'net': net, 'grade': grade,
            'tanggal': tanggal, 'wo': _validate_spk(data.get('work_order_id'))}


def _validate_spk(wo_id):
    """Setiap roll harus menunjuk SPK spunlace (NJO/RPS) - keputusan produksi
    2026-11-18: wajib mutlak, tidak ada roll tanpa job order."""
    from models.production import WorkOrder

    if not wo_id:
        raise RollError('Pilih SPK (NJO) produksinya - setiap roll harus menunjuk job order')
    wo = db.session.get(WorkOrder, wo_id)
    if not wo:
        raise RollError('SPK tidak ditemukan')
    if wo.status in ('completed', 'cancelled'):
        raise RollError(f'SPK {wo.wo_number} sudah {wo.status}, tidak bisa menerima roll baru')
    return wo


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
        work_order_id=v['wo'].id,
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
    _sinkron_realisasi(roll.work_order_id)
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
    spk_lama = roll.work_order_id
    roll.work_order_id = v['wo'].id
    if 'machine_id' in data:
        roll.machine_id = data['machine_id'] or None
    for k in ('length_m', 'width_cm'):
        if k in data:
            setattr(roll, k, _f(data[k]) if data[k] else None)
    if 'shift' in data:
        roll.shift = (data['shift'] or '').strip()[:20] or None
    if 'notes' in data:
        roll.notes = (data['notes'] or '').strip() or None
    _sinkron_realisasi(spk_lama)
    if roll.work_order_id != spk_lama:
        _sinkron_realisasi(roll.work_order_id)
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
    _sinkron_realisasi(roll.work_order_id)
    db.session.commit()
    return jsonify(roll.to_dict())


SUSUT_MIN_DEFAULT = 5.0
SUSUT_MAKS_DEFAULT = 10.0


def _batas_susut():
    """Rentang susut wajar spunlace, dari produksi 2026-11-18: 5-10%.

    Bisa diubah di Pengaturan > Konfigurasi Sistem Lanjutan tanpa menyentuh kode.
    """
    from models.settings import SystemSetting

    nilai = {r.setting_key: (r.setting_value or '').strip()
             for r in SystemSetting.query.filter(SystemSetting.setting_key.in_(
                 ['production.spunlace_susut_min_pct', 'production.spunlace_susut_max_pct'])).all()}

    def angka(key, bawaan):
        try:
            return float(nilai.get(key) or bawaan)
        except (TypeError, ValueError):
            return bawaan

    return (angka('production.spunlace_susut_min_pct', SUSUT_MIN_DEFAULT),
            angka('production.spunlace_susut_max_pct', SUSUT_MAKS_DEFAULT))


def _berat_roll_per_spk(tanggal_set):
    """Berat bersih roll per (tanggal, SPK) untuk tanggal-tanggal yang diminta."""
    if not tanggal_set:
        return {}
    rolls = ProductionRoll.query.filter(ProductionRoll.produced_at.in_(list(tanggal_set)),
                                        ProductionRoll.parent_roll_id.is_(None),
                                        ProductionRoll.status != 'cancelled',
                                        ProductionRoll.work_order_id.isnot(None)).all()
    out = {}
    for r in rolls:
        out.setdefault(r.produced_at, {}).setdefault(r.work_order_id, 0.0)
        out[r.produced_at][r.work_order_id] += float(r.net_weight_kg or 0)
    return out


JENIS_UJI = 'trial'          # MaterialIssue.issue_type untuk uji jalan mesin


def _waste_kembali(mi_ids):
    """Waste yang masuk lagi ke stok dari dokumen-dokumen pemakaian ini (kg).

    Bahan yang dipakai tidak lenyap seluruhnya: sebagiannya jadi waste yang
    dikembalikan ke gudang dan dipakai lagi. Yang kembali bukan susut.
    """
    from models.wms_advanced import InventoryTransaction

    if not mi_ids:
        return 0.0
    total = db.session.query(db.func.coalesce(db.func.sum(InventoryTransaction.quantity), 0)).filter(
        InventoryTransaction.reference_type == 'spunlace_waste',
        InventoryTransaction.reference_id.in_(list(mi_ids))).scalar()
    return round(float(total or 0), 2)


def _bahan_uji(wo):
    """Bahan yang keluar untuk uji jalan mesin pada SPK ini.

    Tidak pernah menjadi roll, jadi tidak boleh masuk hitungan susut - tapi
    tetap harus kelihatan, karena jumlahnya tidak sedikit.
    """
    from models.material_issue import MaterialIssue, MaterialIssueItem

    rows = (db.session.query(MaterialIssueItem, MaterialIssue)
            .join(MaterialIssue, MaterialIssueItem.material_issue_id == MaterialIssue.id)
            .filter(MaterialIssue.status.in_(('issued', 'completed')),
                    MaterialIssue.issue_type == JENIS_UJI,
                    MaterialIssue.work_order_id == wo.id).all())
    bahan, dokumen = {}, set()
    for item, issue in rows:
        dokumen.add(issue.id)
        qty = float(item.issued_quantity or 0) - float(item.returned_quantity or 0)
        if abs(qty) < 0.0001:
            continue
        b = bahan.setdefault((item.material_id, item.product_id, item.uom),
                             {'name': item.description, 'uom': item.uom, 'qty': 0.0})
        b['qty'] = round(b['qty'] + qty, 2)
    daftar = sorted(bahan.values(), key=lambda x: x['name'] or '')
    return (daftar,
            round(sum(b['qty'] for b in daftar if (b['uom'] or '').upper() == 'KG'), 2),
            _waste_kembali(dokumen))


def _bahan_spk_spunlace(wo):
    """Bahan yang keluar gudang untuk SPK ini, dengan pembagian antar NJO.

    Keputusan produksi 2026-11-18 (pilihan b): kalau satu shift menjalankan dua
    NJO, bahan dari BON Permintaan Bahan hari itu dibagi menurut proporsi berat
    roll tiap NJO - bukan ditimpakan semua ke satu NJO yang kebetulan tertulis
    di BON. BON pada tanggal yang tidak punya roll sama sekali tetap utuh milik
    SPK yang tertulis di BON itu.

    Mengembalikan (daftar bahan, fiber_kg, catatan pembagian).
    """
    from models.material_issue import MaterialIssue, MaterialIssueItem

    # Tanggal produksi SPK ini menentukan hari mana saja yang mungkin dipakai
    # bersama NJO lain; BON yang diperiksa dibatasi ke SPK-SPK itu saja supaya
    # tidak memindai seluruh permintaan bahan pabrik.
    tanggal = {r.produced_at for r in ProductionRoll.query.filter(
        ProductionRoll.work_order_id == wo.id, ProductionRoll.parent_roll_id.is_(None),
        ProductionRoll.status != 'cancelled').all() if r.produced_at}
    berat = _berat_roll_per_spk(tanggal)
    spk_terkait = {wo.id} | {i for hari in berat.values() for i in hari}

    rows = (db.session.query(MaterialIssueItem, MaterialIssue)
            .join(MaterialIssue, MaterialIssueItem.material_issue_id == MaterialIssue.id)
            .filter(MaterialIssue.status.in_(('issued', 'completed')),
                    # Bahan untuk uji jalan mesin memang tidak menjadi roll dan
                    # jumlahnya tidak sedikit. Kalau ikut dihitung, susutnya
                    # melonjak dan statusnya berteriak "tinggi" tanpa ada yang
                    # salah di produksi. Dilaporkan terpisah, lihat _bahan_uji().
                    db.func.coalesce(MaterialIssue.issue_type, '') != JENIS_UJI,
                    MaterialIssue.work_order_id.in_(spk_terkait)).all())

    bahan, pembagian = {}, {}
    for item, issue in rows:
        tgl = issue.issue_date.date() if hasattr(issue.issue_date, 'date') else issue.issue_date
        per_spk = berat.get(tgl) or {}
        milik_sendiri = issue.work_order_id == wo.id
        if per_spk and wo.id in per_spk:
            total = sum(per_spk.values())
            bagian = (per_spk[wo.id] / total) if total else 0.0
        elif milik_sendiri:
            # Hari itu SPK ini belum menghasilkan roll (bahan ditarik lebih dulu,
            # rollnya jadi besok): biarkan utuh di SPK yang tertulis di BON.
            bagian = 1.0
        else:
            continue              # BON milik SPK lain dan SPK ini tidak produksi hari itu

        qty = (float(item.issued_quantity or 0) - float(item.returned_quantity or 0)) * bagian
        if abs(qty) < 0.0001:
            continue
        key = (item.material_id, item.product_id, item.uom)
        b = bahan.setdefault(key, {'name': item.description, 'uom': item.uom, 'qty': 0.0})
        b['qty'] = round(b['qty'] + qty, 2)
        if bagian < 0.9999 and tgl:
            lain = [i for i in per_spk if i != wo.id]
            pembagian[tgl] = {'tanggal': tgl.isoformat(), 'bagian_pct': round(bagian * 100, 1),
                              'spk_lain': len(lain)}

    fiber = round(sum(b['qty'] for b in bahan.values() if (b['uom'] or '').upper() == 'KG'), 2)
    return (sorted(bahan.values(), key=lambda x: x['name'] or ''), fiber,
            sorted(pembagian.values(), key=lambda x: x['tanggal']),
            _waste_kembali({i.id for _it, i in rows}))


@production_roll_bp.route('/spk/<int:wo_id>/summary', methods=['GET'])
@jwt_required()
@require_permission('production.view')
def spk_summary(wo_id):
    """Neraca SPK spunlace: bahan yang keluar gudang lawan berat roll.

    Dipakai halaman Tutup SPK. Selisihnya susut proses (trim, serat terbuang,
    air). Rentang wajarnya 5-10% menurut produksi; di luar itu diberi peringatan,
    tapi tetap bukan gerbang yang memblokir penutupan SPK.
    """
    from models.production import WorkOrder

    wo = db.session.get(WorkOrder, wo_id)
    if not wo:
        raise RollError('SPK tidak ditemukan', 404)

    rolls = ProductionRoll.query.filter(ProductionRoll.work_order_id == wo.id,
                                        ProductionRoll.parent_roll_id.is_(None),
                                        ProductionRoll.status != 'cancelled').all()
    per_grade = {}
    for r in rolls:
        g = per_grade.setdefault(r.grade, {'grade': r.grade, 'label': GRADE_LABEL.get(r.grade, r.grade),
                                           'rolls': 0, 'net_kg': 0.0})
        g['rolls'] += 1
        g['net_kg'] = round(g['net_kg'] + float(r.net_weight_kg or 0), 2)
    net_total = round(sum(float(r.net_weight_kg or 0) for r in rolls), 2)
    net_baik = round(sum(float(r.net_weight_kg or 0) for r in rolls if r.grade in ('A', 'B')), 2)

    bahan, fiber_kg, pembagian, waste_produksi_kg = _bahan_spk_spunlace(wo)
    bahan_uji, fiber_uji_kg, waste_uji_kg = _bahan_uji(wo)
    # Waste yang dikembalikan ke gudang bukan susut - barangnya masih ada.
    susut_kg = round(fiber_kg - net_total - waste_produksi_kg, 2) if fiber_kg else 0.0
    susut_pct = round(susut_kg / fiber_kg * 100, 2) if fiber_kg else 0.0
    batas_min, batas_maks = _batas_susut()
    if not fiber_kg:
        status = 'belum'
    elif susut_kg < 0:
        status = 'negatif'
    elif susut_pct > batas_maks:
        status = 'tinggi'
    elif susut_pct < batas_min:
        status = 'rendah'
    else:
        status = 'wajar'

    return jsonify({
        'work_order_id': wo.id,
        'wo_number': wo.wo_number,
        'is_spunlace': _spk_spunlace(wo),
        'rolls': len(rolls),
        'net_kg': net_total,
        'net_good_kg': net_baik,
        'net_reject_kg': round(net_total - net_baik, 2),
        'per_grade': sorted(per_grade.values(), key=lambda x: x['grade']),
        'materials': bahan,
        'fiber_kg': fiber_kg,
        'susut_kg': susut_kg,
        'susut_pct': susut_pct,
        'susut_status': status,
        'susut_min_pct': batas_min,
        'susut_max_pct': batas_maks,
        'pembagian': pembagian,
        'materials_uji': bahan_uji,
        'fiber_uji_kg': fiber_uji_kg,
        'waste_uji_kg': waste_uji_kg,
        'uji_terbuang_kg': round(fiber_uji_kg - waste_uji_kg, 2),
        'waste_kembali_kg': waste_produksi_kg,
    })


def _waste_masuk_stok(mi, baris, user_id):
    """Waste hasil pemakaian bahan kembali ke stok sebagai material.

    Bahan baku yang dipakai tidak lenyap: sebagiannya jadi waste yang di
    Fengsheng dipakai lagi (campuran bantal). Kalau tidak dicatat masuk lagi,
    neraca uji mesin tidak akan pernah seimbang dan barangnya hilang dari
    sistem padahal fisiknya ada di gudang.

    Mengikuti jalur yang sama dengan waste sliting: ditaruh di gudang bahan
    baku, nomor batch = nomor dokumen pemakaiannya.
    """
    from models.product import Material
    from models.warehouse import Inventory, WarehouseLocation, WarehouseZone
    from utils.inventory_helpers import record_inventory_transaction

    if not baris:
        return []

    zona = WarehouseZone.query.filter(db.func.lower(WarehouseZone.material_type) == 'raw_materials').first()
    lokasi = WarehouseLocation.query.filter_by(zone_id=zona.id, is_active=True).first() if zona else None
    if not lokasi:
        raise RollError('Gudang bahan baku belum punya lokasi penyimpanan untuk menampung waste', 409)

    keluar = []
    for n, b in enumerate(baris, start=1):
        bahan = db.session.get(Material, b.get('material_id')) if b.get('material_id') else None
        if not bahan:
            raise RollError(f'Bahan waste baris {n} tidak ditemukan', 404)
        qty = float(b.get('quantity') or 0)
        if qty <= 0:
            raise RollError(f'Jumlah waste {bahan.name} harus lebih dari 0')

        inv = Inventory.query.filter_by(material_id=bahan.id, location_id=lokasi.id,
                                        batch_number=mi.issue_number).first()
        if not inv:
            inv = Inventory(material_id=bahan.id, location_id=lokasi.id, batch_number=mi.issue_number,
                            quantity_on_hand=0, quantity_available=0, stock_status='available', is_active=True)
            db.session.add(inv)
            db.session.flush()
        inv.quantity_on_hand = float(inv.quantity_on_hand or 0) + qty
        inv.quantity_available = float(inv.quantity_available or 0) + qty
        inv.updated_at = datetime.utcnow()
        record_inventory_transaction(
            transaction_type='stock_in', direction='in', quantity=qty,
            material_id=bahan.id, to_location_id=lokasi.id, batch_number=mi.issue_number,
            reference_type='spunlace_waste', reference_id=mi.id,
            notes=f'Waste hasil pemakaian bahan spunlace {mi.issue_number}', created_by=user_id)
        keluar.append({'material_id': bahan.id, 'name': bahan.name,
                       'uom': bahan.primary_uom or 'KG', 'qty': round(qty, 2)})
    return keluar


@production_roll_bp.route('/material-usage', methods=['POST'])
@jwt_required()
@require_permission('production.create')
def catat_pemakaian_bahan():
    """Catat pemakaian bahan baku spunlace dari halaman Roll Spunlace.

    Dulu satu-satunya jalan adalah BON Permintaan Bahan di modul Gudang, jadi
    operator spunlace harus pindah modul - padahal di lembar harian mereka
    pemakaian fiber dan daftar roll ada di kertas yang sama.

    Yang dibuat tetap MaterialIssue, bukan jalur stok baru: stok berkurang FIFO
    dan jurnalnya tercatat persis seperti BON biasa. Bedanya hanya pintu
    masuknya, dan satu isian "keperluan":

    - `produksi` : menjadi roll, ikut hitungan susut di Tutup SPK.
    - `uji`      : uji jalan mesin, TIDAK menjadi roll. Jumlahnya tidak sedikit,
                   jadi kalau ikut dihitung susutnya melonjak tanpa ada yang
                   salah. Dicatat terpisah dan dikecualikan dari susut.
    """
    from models.material_issue import MaterialIssue, MaterialIssueItem
    from models.product import Material
    from models.production import WorkOrder
    from utils.helpers import generate_number
    from utils.material_issue_helper import StokKurang, keluarkan_bahan, pesan_bahan

    data = request.get_json() or {}
    user_id = int(get_jwt_identity())

    keperluan = (data.get('keperluan') or 'produksi').strip().lower()
    if keperluan not in ('produksi', 'uji'):
        raise RollError('Keperluan harus "produksi" atau "uji"')

    baris = [b for b in (data.get('items') or []) if b.get('material_id')]
    if not baris:
        raise RollError('Belum ada bahan yang diisi')

    wo = None
    if data.get('work_order_id'):
        wo = db.session.get(WorkOrder, data['work_order_id'])
        if not wo:
            raise RollError('SPK tidak ditemukan', 404)
    elif keperluan == 'produksi':
        # Uji mesin boleh tanpa SPK - memang belum ada job order yang jalan.
        raise RollError('Pemakaian untuk produksi harus menyebut SPK / NJO')

    try:
        tanggal = (datetime.fromisoformat(str(data['used_at'])).date()
                   if data.get('used_at') else get_local_now().date())
    except ValueError:
        raise RollError('Tanggal pemakaian tidak valid')

    mi = MaterialIssue(
        issue_number=generate_number('MI', MaterialIssue, 'issue_number'),
        work_order_id=wo.id if wo else None,
        trigger_source='manual',
        issue_type='production' if keperluan == 'produksi' else JENIS_UJI,
        issue_date=datetime.combine(tanggal, datetime.min.time()),
        requested_by=user_id,
        status='pending',
        department='Spunlace',
        notes=(data.get('notes') or
               ('Uji jalan mesin spunlace' if keperluan == 'uji' else 'Pemakaian bahan spunlace')),
    )
    db.session.add(mi)
    db.session.flush()

    for n, b in enumerate(baris, start=1):
        bahan = db.session.get(Material, b['material_id'])
        if not bahan:
            raise RollError(f'Bahan baris {n} tidak ditemukan', 404)
        qty = float(b.get('quantity') or 0)
        if qty <= 0:
            raise RollError(f'Jumlah {bahan.name} harus lebih dari 0')
        db.session.add(MaterialIssueItem(
            material_issue_id=mi.id, line_number=n, material_id=bahan.id,
            description=bahan.name, uom=bahan.primary_uom or 'KG',
            required_quantity=qty, status='pending'))
    db.session.flush()

    try:
        pesan_bahan(mi)
    except StokKurang as e:
        db.session.rollback()
        raise RollError(str(e))
    mi.status = 'approved'
    mi.approved_by = user_id
    mi.approved_date = get_local_now()

    keluar, rincian = keluarkan_bahan(mi, user_id)
    if not keluar:
        db.session.rollback()
        raise RollError('Bahan tidak jadi keluar - periksa stok yang tersedia')

    waste = _waste_masuk_stok(mi, data.get('waste') or [], user_id)
    db.session.commit()

    return jsonify({'id': mi.id, 'issue_number': mi.issue_number, 'keperluan': keperluan,
                    'items': keluar, 'detail': rincian, 'waste': waste}), 201


def _waste_dokumen(mi_id):
    """Waste yang masuk lagi dari satu dokumen pemakaian."""
    from models.product import Material
    from models.wms_advanced import InventoryTransaction

    keluar = []
    for t in InventoryTransaction.query.filter_by(reference_type='spunlace_waste', reference_id=mi_id).all():
        m = db.session.get(Material, t.material_id) if t.material_id else None
        keluar.append({'name': m.name if m else None, 'uom': t.uom,
                       'qty': round(float(t.quantity or 0), 2)})
    return keluar


@production_roll_bp.route('/material-usage', methods=['GET'])
@jwt_required()
@require_permission('production.view')
def daftar_pemakaian_bahan():
    """Pemakaian bahan spunlace yang sudah dicatat, terbaru dulu."""
    from models.material_issue import MaterialIssue

    a = request.args
    q = MaterialIssue.query.filter(MaterialIssue.department == 'Spunlace',
                                   MaterialIssue.status.in_(('issued', 'completed', 'partial')))
    if a.get('date_from'):
        q = q.filter(MaterialIssue.issue_date >= a['date_from'])
    if a.get('date_to'):
        q = q.filter(MaterialIssue.issue_date <= f"{a['date_to']} 23:59:59")
    if a.get('work_order_id'):
        q = q.filter(MaterialIssue.work_order_id == a['work_order_id'])

    keluar = []
    for mi in q.order_by(MaterialIssue.issue_date.desc(), MaterialIssue.id.desc()).limit(200).all():
        keluar.append({
            'id': mi.id, 'issue_number': mi.issue_number,
            'used_at': mi.issue_date.date().isoformat() if mi.issue_date else None,
            'keperluan': 'uji' if mi.issue_type == JENIS_UJI else 'produksi',
            'work_order_id': mi.work_order_id,
            'wo_number': mi.work_order.wo_number if mi.work_order else None,
            'notes': mi.notes,
            'items': [{'name': i.description, 'uom': i.uom,
                       'qty': round(float(i.issued_quantity or 0) - float(i.returned_quantity or 0), 2)}
                      for i in mi.items],
            'waste': _waste_dokumen(mi.id),
        })
    return jsonify({'usages': keluar})


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
