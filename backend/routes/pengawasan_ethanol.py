"""Halaman pengawasan ethanol untuk Bea dan Cukai.

Diminta Bea Cukai 2026-11-25 sesudah paparan proses bisnis: mereka ingin bisa
melihat sendiri perjalanan ethanol, tidak cukup laporan yang dikirim. Yang
ditampilkan satu rantai utuh - **penerimaan -> stok -> pemakaian -> barang jadi** -
dalam KUANTITAS saja. Harga beli sengaja tidak ikut: yang diawasi jumlah dan
kelengkapan dokumennya, bukan nilai belanjanya.

Dibuka lewat tautan panjang tanpa login (keputusan user 2026-11-25). Karena itu
beberapa hal dijaga ketat di sini:
- tokennya acak 32 byte, dibandingkan dengan `compare_digest` supaya tidak bisa
  ditebak lewat selisih waktu;
- tiap pembukaan dicatat (kapan, dari alamat IP mana);
- tidak ada satu pun jalur yang mengubah data - semuanya baca saja;
- tokennya bisa dicabut dan diganti kapan saja oleh pemilik sistem.

Dokumen yang masih berstatus pending IKUT ditampilkan beserta tandanya. Kalau
yang pending disembunyikan, akan ada barang fisik di gudang yang tidak muncul di
halaman pengawasan - itu lebih buruk daripada terlihat belum rapi.
"""
import secrets
from datetime import datetime
from hmac import compare_digest

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from models import db
from utils.auth_decorators import require_permission

pengawasan_bp = Blueprint('pengawasan', __name__)

KUNCI_TOKEN = 'pengawasan.ethanol_token'
KUNCI_BARANG = 'pengawasan.ethanol_material_code'
BARANG_BAWAAN = '1050100013'
KUNCI_CUKAI = 'pengawasan.ethanol_status_cukai'
# Ethanolnya dibeli dengan cukai dibayar; pabrik belum punya fasilitas
# pembebasan (ditegaskan user 2026-11-26). Ditaruh di setelan, bukan ditulis
# mati di kode, supaya kalau fasilitasnya nanti turun cukup diganti di sini.
CUKAI_BAWAAN = 'Cukai dibayar, belum memakai fasilitas pembebasan'


# ---- token -----------------------------------------------------------------

def _setelan(kunci, bawaan=None, nama=None, keterangan=None):
    from models.settings import SystemSetting
    row = SystemSetting.query.filter_by(setting_key=kunci).first()
    if not row and bawaan is not None:
        row = SystemSetting(setting_key=kunci, setting_category='purchasing',
                            setting_name=nama or kunci, setting_value=bawaan,
                            data_type='string', description=keterangan, is_editable=False)
        db.session.add(row)
        db.session.commit()
    return row


def token_pengawasan(buat=True):
    row = _setelan(KUNCI_TOKEN, secrets.token_urlsafe(32) if buat else None,
                   nama='Token halaman pengawasan ethanol',
                   keterangan='Dipakai di tautan pengawasan Bea Cukai. Diganti lewat tombol di halaman, bukan diketik.')
    return row.setting_value if row else None


def _kode_barang():
    row = _setelan(KUNCI_BARANG, BARANG_BAWAAN, nama='Kode barang yang diawasi Bea Cukai',
                   keterangan='Kode bahan yang tampil di halaman pengawasan. Bawaannya ethanol.')
    return (row.setting_value or BARANG_BAWAAN).strip()


def _status_cukai():
    row = _setelan(KUNCI_CUKAI, CUKAI_BAWAAN, nama='Status cukai bahan yang diawasi',
                   keterangan='Tampil di kartu pengawasan. Ganti kalau fasilitas pembebasan sudah terbit.')
    return (row.setting_value or CUKAI_BAWAAN).strip()


def _token_sah(diberikan):
    asli = token_pengawasan(buat=False)
    return bool(asli) and bool(diberikan) and compare_digest(str(asli), str(diberikan))


def _catat_akses(token_dipakai, hasil):
    """Siapa membuka apa, kapan. Tautan tanpa login hanya bisa dipertanggungjawabkan
    kalau pembukaannya tercatat."""
    from models.settings_extended import AuditLog
    try:
        db.session.add(AuditLog(
            user_id=None, action='view', resource_type='pengawasan_ethanol',
            resource_name=f'tautan {str(token_dipakai)[:8]}...',
            ip_address=request.headers.get('X-Forwarded-For', request.remote_addr),
            user_agent=(request.headers.get('User-Agent') or '')[:255],
            request_method=request.method, request_url=request.path, status=hasil,
            timestamp=datetime.utcnow()))
        db.session.commit()
    except Exception:
        db.session.rollback()


# ---- penyusunan data -------------------------------------------------------

def _tanggal(v, bawaan=None):
    try:
        return datetime.fromisoformat(str(v)).date() if v else bawaan
    except ValueError:
        return bawaan


def _rincian_penerimaan(nomor):
    """Dari nomor BPB ke dokumen aslinya: PO, pemasok, mutu, kedaluwarsa."""
    from models.purchasing import GoodsReceivedNote
    g = GoodsReceivedNote.query.filter_by(grn_number=nomor).first()
    if not g:
        return None
    item = next((i for i in g.items), None)
    return {
        'no_penerimaan': g.grn_number,
        'tanggal': g.receipt_date.date().isoformat() if g.receipt_date else None,
        'no_po': g.purchase_order.po_number if g.purchase_order else None,
        'pemasok': g.supplier.company_name if g.supplier else None,
        'no_surat_jalan': g.delivery_note_number,
        'status': g.status,
        'mutu': g.quality_status or 'belum inspeksi',
        'kedaluwarsa': item.expiry_date.isoformat() if item and item.expiry_date else None,
    }


def _rincian_pemakaian(nomor):
    """Dari nomor bon ke SPK-nya, lalu ke barang jadi yang dihasilkan SPK itu."""
    from models.batch_scheduling import ProductionBatch
    from models.material_issue import MaterialIssue
    mi = MaterialIssue.query.filter_by(issue_number=nomor).first()
    if not mi:
        return None
    wo = mi.work_order
    batch = ProductionBatch.query.filter_by(work_order_id=wo.id).first() if wo else None
    return {
        'no_bon': mi.issue_number,
        'tanggal': mi.issue_date.date().isoformat() if mi.issue_date else None,
        'keperluan': mi.notes,
        'no_spk': wo.wo_number if wo else None,
        'produk': (wo.product.name if wo and wo.product else None),
        'kode_produk': (wo.product.code if wo and wo.product else None),
        'rencana_produksi': float(wo.quantity or 0) if wo else None,
        'satuan_produksi': (wo.uom if wo else None),
        'hasil_baik': float(wo.quantity_good or 0) if wo else None,
        'hasil_total': float(wo.quantity_produced or 0) if wo else None,
        'no_catatan_bets': batch.batch_number if batch else None,
        'status_spk': wo.status if wo else None,
    }


JENIS = {
    'purchase_order': 'penerimaan',
    'goods_receipt': 'penerimaan',
    'material_issue': 'pemakaian',
    'production_roll': 'pemakaian',
}


def susun_data(dari, sampai):
    from models.product import Material
    from models.warehouse import Inventory
    from models.wms_advanced import InventoryTransaction

    kode = _kode_barang()
    bahan = Material.query.filter_by(code=kode).first()
    if not bahan:
        return None

    semua = (InventoryTransaction.query
             .filter(InventoryTransaction.material_id == bahan.id)
             .order_by(InventoryTransaction.transaction_date, InventoryTransaction.id).all())

    def nilai(t):
        q = float(t.quantity or 0)
        return (q, 0.0) if t.direction == 'in' else (0.0, q)

    saldo = 0.0
    mutasi = []
    for t in semua:
        masuk, keluar = nilai(t)
        tgl = t.transaction_date.date() if t.transaction_date else None
        if dari and tgl and tgl < dari:
            saldo += masuk - keluar
            continue
        if sampai and tgl and tgl > sampai:
            continue
        saldo += masuk - keluar
        jenis = JENIS.get(t.reference_type or '', 'penyesuaian')
        baris = {
            'tanggal': tgl.isoformat() if tgl else None,
            'jenis': jenis,
            'no_dokumen': t.reference_number or t.transaction_number,
            'batch': t.batch_number,
            'masuk': round(masuk, 2),
            'keluar': round(keluar, 2),
            'saldo': round(saldo, 2),
            'keterangan': t.notes,
        }
        baris['rincian'] = (_rincian_penerimaan(t.reference_number) if jenis == 'penerimaan'
                            else _rincian_pemakaian(t.reference_number) if jenis == 'pemakaian'
                            else None)
        mutasi.append(baris)

    saldo_awal = round(saldo - sum(m['masuk'] - m['keluar'] for m in mutasi), 2)
    stok = [{
        'batch': i.batch_number,
        'jumlah': round(float(i.quantity_on_hand or 0), 2),
        'tersedia': round(float(i.quantity_available or 0), 2),
        'status': i.stock_status,
        'kedaluwarsa': i.expiry_date.isoformat() if i.expiry_date else None,
        'gudang': (i.location.zone.name if i.location and i.location.zone else None),
    } for i in Inventory.query.filter_by(material_id=bahan.id).all()
        if float(i.quantity_on_hand or 0) != 0]

    return {
        'barang': {'kode': bahan.code, 'nama': bahan.name, 'satuan': bahan.primary_uom,
                   'status_cukai': _status_cukai()},
        'periode': {'dari': dari.isoformat() if dari else None,
                    'sampai': sampai.isoformat() if sampai else None},
        'ringkasan': {
            'saldo_awal': saldo_awal,
            'masuk': round(sum(m['masuk'] for m in mutasi), 2),
            'keluar': round(sum(m['keluar'] for m in mutasi), 2),
            'saldo_akhir': round(saldo, 2),
        },
        'mutasi': mutasi,
        'stok_sekarang': stok,
        'data_per': datetime.now().isoformat(timespec='seconds'),
    }


# ---- jalur publik ----------------------------------------------------------

@pengawasan_bp.route('/ethanol/<token>', methods=['GET'])
def lihat_ethanol(token):
    """Dibuka Bea Cukai lewat tautan. Tanpa login, hanya bisa membaca."""
    if not _token_sah(token):
        _catat_akses(token, 'ditolak')
        return jsonify({'error': 'Tautan tidak berlaku. Hubungi PT Fengsheng Nonwoven Indonesia '
                                 'untuk tautan yang baru.'}), 403
    data = susun_data(_tanggal(request.args.get('dari')), _tanggal(request.args.get('sampai')))
    if data is None:
        return jsonify({'error': 'Barang yang diawasi belum disetel di sistem'}), 404
    _catat_akses(token, 'success')
    return jsonify(data), 200


# ---- pengelolaan tautan (butuh login) --------------------------------------

@pengawasan_bp.route('/ethanol/tautan', methods=['GET'])
@jwt_required()
@require_permission('settings.manage', 'purchasing.approve')
def lihat_tautan():
    from models.settings_extended import AuditLog
    riwayat = (AuditLog.query.filter_by(resource_type='pengawasan_ethanol')
               .order_by(AuditLog.id.desc()).limit(20).all())
    return jsonify({
        'token': token_pengawasan(),
        'kode_barang': _kode_barang(),
        'riwayat_akses': [{'waktu': a.timestamp.isoformat() if a.timestamp else None,
                           'ip': a.ip_address, 'hasil': a.status} for a in riwayat],
    }), 200


@pengawasan_bp.route('/ethanol/tautan/ganti', methods=['POST'])
@jwt_required()
@require_permission('settings.manage', 'purchasing.approve')
def ganti_tautan():
    """Cabut tautan lama, terbitkan yang baru. Yang lama langsung tidak berlaku."""
    row = _setelan(KUNCI_TOKEN, secrets.token_urlsafe(32))
    row.setting_value = secrets.token_urlsafe(32)
    row.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'token': row.setting_value,
                    'pesan': 'Tautan lama dicabut. Kirim tautan baru ini ke Bea Cukai.'}), 200
