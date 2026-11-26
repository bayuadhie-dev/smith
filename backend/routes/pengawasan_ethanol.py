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
# Yang diawasi Bea Cukai adalah BESARNYA CUKAI YANG DIBEBASKAN atas ethanol
# yang diterima pabrik (keputusan user 2026-11-26, menggantikan pembacaan awal
# "cukai dibayar"). Kalimatnya di setelan, bukan ditulis mati di kode.
CUKAI_BAWAAN = 'Pembebasan cukai'
KUNCI_TARIF = 'pengawasan.ethanol_tarif_cukai'
# Tarif cukai etil alkohol, rupiah per liter. Dipakai untuk batch yang tarifnya
# belum diisi sendiri. Nilai yang tampil di kartu adalah NILAI CUKAI YANG
# DIBEBASKAN - bukan harga beli; harga tetap tidak pernah ikut.
TARIF_BAWAAN = '20000'


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


def _tarif_bawaan():
    row = _setelan(KUNCI_TARIF, TARIF_BAWAAN, nama='Tarif cukai per satuan',
                   keterangan='Rupiah per satuan dasar barang yang diawasi. Dipakai kalau batch belum punya tarif sendiri.')
    try:
        return float((row.setting_value or TARIF_BAWAAN).replace('.', '').replace(',', '.'))
    except (AttributeError, ValueError):
        return float(TARIF_BAWAAN)


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


def _cukai_per_batch(material_id):
    """Status cukai tiap batch, diambil dari baris penerimaannya.

    Statusnya melekat pada batch - satu batch bisa masuk dengan cukai dibayar
    dan batch berikutnya memakai pembebasan. Baris yang belum diisi memakai
    bawaan di setelan, supaya tidak ada batch yang tampil tanpa keterangan.
    """
    from models.purchasing import GRNItem
    bawaan = _status_cukai()
    tarif_bawaan = _tarif_bawaan()
    peta = {}
    for it in (GRNItem.query.filter(GRNItem.material_id == material_id)
               .order_by(GRNItem.id).all()):
        kunci = (it.batch_number or '').strip()
        tarif = float(it.cukai_tarif) if it.cukai_tarif is not None else tarif_bawaan
        peta[kunci] = {'status': (it.cukai_status or '').strip() or bawaan,
                       'dokumen': (it.cukai_dokumen or '').strip() or None,
                       'tarif': round(tarif, 2)}
    return peta, {'status': bawaan, 'dokumen': None, 'tarif': round(tarif_bawaan, 2)}


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

    cukai, cukai_bawaan = _cukai_per_batch(bahan.id)

    def cukai_batch(batch):
        return cukai.get((batch or '').strip()) or dict(cukai_bawaan)

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
            'cukai': cukai_batch(t.batch_number) if jenis == 'penerimaan' else None,
            # Yang dilaporkan ke Bea Cukai: cukai yang DIBEBASKAN atas barang
            # yang diterima - jumlah diterima x tarif per liter. Pemakaian tidak
            # punya nilai sendiri; pembebasannya sudah dihitung saat masuk.
            'nilai_dibebaskan': round(masuk * cukai_batch(t.batch_number)['tarif'], 2) if masuk else 0.0,
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
        'cukai': cukai_batch(i.batch_number),
    } for i in Inventory.query.filter_by(material_id=bahan.id).all()
        if float(i.quantity_on_hand or 0) != 0]

    return {
        'barang': {'kode': bahan.code, 'nama': bahan.name, 'satuan': bahan.primary_uom},
        'periode': {'dari': dari.isoformat() if dari else None,
                    'sampai': sampai.isoformat() if sampai else None},
        'ringkasan': {
            'saldo_awal': saldo_awal,
            'masuk': round(sum(m['masuk'] for m in mutasi), 2),
            'keluar': round(sum(m['keluar'] for m in mutasi), 2),
            'saldo_akhir': round(saldo, 2),
        },
        'cukai': {
            'tarif_bawaan': cukai_bawaan['tarif'],
            'dibebaskan': round(sum(m['nilai_dibebaskan'] for m in mutasi), 2),
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


# ---- cetak PDF -------------------------------------------------------------

def _pdf_kartu(data):
    """Kartu pengawasan dalam bentuk PDF.

    Bea Cukai perlu salinan yang bisa diarsipkan, bukan hanya layar. Isinya
    persis sama dengan halaman: kuantitas, status cukai per batch, dan rincian
    dokumen asal tiap mutasi - tanpa harga.
    """
    import io
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from xml.sax.saxutils import escape

    from routes.finance_reports import _company_name, _date_idn, _idn

    page = landscape(A4)
    margin = 12 * mm
    avail = page[0] - 2 * margin
    sel = ParagraphStyle('sel', fontName='Helvetica', fontSize=8, leading=10)
    sel_b = ParagraphStyle('selb', parent=sel, fontName='Helvetica-Bold')
    kanan = ParagraphStyle('kn', parent=sel, alignment=2)
    kanan_b = ParagraphStyle('knb', parent=kanan, fontName='Helvetica-Bold')
    judul_kolom = ParagraphStyle('jk', parent=sel, fontName='Helvetica-Bold', textColor=colors.white)
    judul_kanan = ParagraphStyle('jkn', parent=judul_kolom, alignment=2)
    kecil = ParagraphStyle('kc', fontName='Helvetica', fontSize=7.5, leading=9.5,
                           textColor=colors.HexColor('#4B5563'))

    def tgl(v):
        return _date_idn(v) if v else ''

    def tabel(isi, lebar, kolom_kanan=(), baris_kepala=(0,)):
        """baris_kepala: baris mana saja yang jadi kepala berpita hijau. Tabel
        ringkasan punya dua kepala (kuantitas lalu cukai) - tanpa ini tulisannya
        putih di atas putih, alias hilang."""
        t = Table(isi, colWidths=lebar, repeatRows=1)
        # Pita kepala dipasang TERAKHIR: ROWBACKGROUNDS menimpa apa pun yang
        # dideklarasikan sebelumnya, jadi kepala kedua ikut terhapus kalau urutannya dibalik.
        t.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#D1D5DB')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
            ('LEFTPADDING', (0, 0), (-1, -1), 3), ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ] + [('ALIGN', (j, 0), (j, -1), 'RIGHT') for j in kolom_kanan]
          + [('BACKGROUND', (0, k), (-1, k), colors.HexColor('#047857')) for k in baris_kepala]))
        return t

    brg = data['barang']
    r = data['ringkasan']
    sat = brg['satuan'] or ''
    per = data['periode']
    rentang = ('Semua periode' if not (per['dari'] or per['sampai'])
               else f"Periode {tgl(per['dari']) or 'awal'} s/d {tgl(per['sampai']) or 'sekarang'}")

    cerita = [
        Paragraph(escape(_company_name()), ParagraphStyle('co', fontName='Helvetica-Bold', fontSize=10,
                                                          textColor=colors.HexColor('#065F46'))),
        Paragraph('Kartu Pengawasan Ethanol', ParagraphStyle('ti', fontName='Helvetica-Bold', fontSize=15, leading=19)),
        Paragraph(escape(f"{brg['kode']} - {brg['nama']} | satuan {sat} | {rentang}"),
                  ParagraphStyle('su', fontName='Helvetica', fontSize=9, textColor=colors.HexColor('#4B5563'))),
        Spacer(1, 4 * mm),
    ]

    ck = data.get('cukai') or {}
    ringkas = [[Paragraph(h, judul_kolom) for h in ('Saldo awal', 'Masuk', 'Dipakai', 'Saldo akhir')],
               [Paragraph(f"{_idn(r[k])} {sat}", kanan_b)
                for k in ('saldo_awal', 'masuk', 'keluar', 'saldo_akhir')],
               [Paragraph(h, judul_kolom) for h in ('Tarif cukai', 'Jumlah diterima',
                                                    'Nilai cukai dibebaskan', '')],
               [Paragraph(f"Rp {_idn(ck.get('tarif_bawaan') or 0, 0)} / {sat}", kanan_b),
                Paragraph(f"{_idn(r['masuk'])} {sat}", kanan_b),
                Paragraph(f"Rp {_idn(ck.get('dibebaskan') or 0, 0)}", kanan_b),
                Paragraph('', kanan_b)]]
    cerita += [tabel(ringkas, [avail / 4] * 4, kolom_kanan=(0, 1, 2, 3), baris_kepala=(0, 2)), Spacer(1, 5 * mm),
               Paragraph('Mutasi', ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=11)), Spacer(1, 2 * mm)]

    kepala = ('Tanggal', 'Jenis', 'No. Dokumen', 'Batch', 'Status cukai', 'Asal / tujuan',
              'Masuk', 'Keluar', 'Saldo', 'Cukai dibebaskan')
    baris = [[Paragraph(h, judul_kanan if h in ('Masuk', 'Keluar', 'Saldo', 'Cukai dibebaskan') else judul_kolom)
              for h in kepala]]
    for m in data['mutasi']:
        d = m.get('rincian') or {}
        if m['jenis'] == 'penerimaan':
            asal = ' | '.join(x for x in [d.get('pemasok'), f"PO {d['no_po']}" if d.get('no_po') else None,
                                          f"SJ {d['no_surat_jalan']}" if d.get('no_surat_jalan') else None,
                                          f"mutu {d['mutu']}" if d.get('mutu') else None] if x)
        else:
            asal = ' | '.join(x for x in [f"SPK {d['no_spk']}" if d.get('no_spk') else None, d.get('produk'),
                                          f"bets {d['no_catatan_bets']}" if d.get('no_catatan_bets') else None,
                                          (f"hasil {_idn(d['hasil_baik'])} {d.get('satuan_produksi') or ''}".strip()
                                           if d.get('hasil_baik') else None)] if x)
        ck = m.get('cukai') or {}
        ck_teks = ' - '.join(x for x in [ck.get('status'), ck.get('dokumen')] if x)
        baris.append([
            Paragraph(tgl(m['tanggal']), sel), Paragraph(m['jenis'].capitalize(), sel),
            Paragraph(escape(m['no_dokumen'] or ''), sel_b), Paragraph(escape(m['batch'] or '-'), sel),
            Paragraph(escape(ck_teks), sel), Paragraph(escape(asal or m.get('keterangan') or ''), sel),
            Paragraph(_idn(m['masuk']) if m['masuk'] else '-', kanan),
            Paragraph(_idn(m['keluar']) if m['keluar'] else '-', kanan),
            Paragraph(_idn(m['saldo']), kanan_b),
            Paragraph(f"Rp {_idn(m['nilai_dibebaskan'], 0)}" if m.get('nilai_dibebaskan') else '-', kanan),
        ])
    bobot = [8, 7, 12, 11, 15, 19, 7, 7, 8, 10]
    skala = avail / sum(bobot)
    cerita.append(tabel(baris, [b * skala for b in bobot], kolom_kanan=(6, 7, 8, 9)))

    cerita += [Spacer(1, 5 * mm),
               Paragraph('Stok saat ini', ParagraphStyle('h3', fontName='Helvetica-Bold', fontSize=11)),
               Spacer(1, 2 * mm)]
    kepala2 = ('Batch', 'Gudang', 'Kedaluwarsa', 'Status', 'Status cukai', 'Jumlah')
    baris2 = [[Paragraph(h, judul_kanan if h == 'Jumlah' else judul_kolom) for h in kepala2]]
    for i in data['stok_sekarang']:
        ck = i.get('cukai') or {}
        baris2.append([
            Paragraph(escape(i['batch'] or '-'), sel_b), Paragraph(escape(i['gudang'] or '-'), sel),
            Paragraph(tgl(i['kedaluwarsa']), sel), Paragraph(escape(i['status'] or ''), sel),
            Paragraph(escape(' - '.join(x for x in [ck.get('status'), ck.get('dokumen')] if x)), sel),
            Paragraph(f"{_idn(i['jumlah'])} {sat}", kanan_b),
        ])
    bobot2 = [14, 16, 12, 12, 32, 14]
    skala2 = avail / sum(bobot2)
    cerita += [tabel(baris2, [b * skala2 for b in bobot2], kolom_kanan=(5,)), Spacer(1, 4 * mm),
               Paragraph('Data langsung dari sistem ERP ' + escape(_company_name()) + '.', kecil)]

    dicetak = datetime.now().strftime('%d/%m/%Y %H:%M')

    def kaki(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColor(colors.HexColor('#6B7280'))
        canvas.drawString(margin, 8 * mm, f'{_company_name()} - Kartu Pengawasan Ethanol')
        canvas.drawRightString(page[0] - margin, 8 * mm, f'Dicetak {dicetak}  |  Halaman {doc.page}')
        canvas.restoreState()

    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=page, leftMargin=margin, rightMargin=margin, topMargin=margin,
                      bottomMargin=14 * mm, title='Kartu Pengawasan Ethanol',
                      author=_company_name()).build(cerita, onFirstPage=kaki, onLaterPages=kaki)
    buf.seek(0)
    return buf


@pengawasan_bp.route('/ethanol/<token>/pdf', methods=['GET'])
def unduh_ethanol_pdf(token):
    """Salinan kartu untuk arsip Bea Cukai. Tautan dan pencatatannya sama
    dengan halamannya - yang mengunduh juga tercatat."""
    from flask import send_file
    if not _token_sah(token):
        _catat_akses(token, 'ditolak')
        return jsonify({'error': 'Tautan tidak berlaku. Hubungi PT Fengsheng Nonwoven Indonesia '
                                 'untuk tautan yang baru.'}), 403
    data = susun_data(_tanggal(request.args.get('dari')), _tanggal(request.args.get('sampai')))
    if data is None:
        return jsonify({'error': 'Barang yang diawasi belum disetel di sistem'}), 404
    _catat_akses(token, 'success')
    nama = f"kartu-pengawasan-ethanol-{datetime.now().strftime('%Y%m%d')}.pdf"
    return send_file(_pdf_kartu(data), mimetype='application/pdf', as_attachment=True, download_name=nama)
