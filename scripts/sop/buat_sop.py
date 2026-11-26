#!/usr/bin/env python3
"""Menyusun berkas SOP Penginputan Data per modul (.docx).

Permintaan Presiden Direktur 2026-11-26: SOP penginputan data untuk seluruh
modul. Keputusan pemilik sistem: berkas Word/PDF terpisah per modul, isinya
ditarik dari kode lalu diperiksa pemilik modul.

Yang OTOMATIS dari kode (lihat kumpulkan_fakta.py): kolom wajib, status yang
dikenal sistem, izin tiap tindakan, awalan nomor dokumen, dan peran mana saja
yang memegang izin itu (ditarik dari basis data produksi, izin_peran.json).

Yang MASIH HARUS DIISI ORANG: kebijakan - kapan harus diinput, siapa yang
bertanggung jawab kalau telat, dan apa yang dilakukan kalau salah input.
Bagian itu ditandai "[PERLU DIPASTIKAN]" supaya tidak lolos sebagai fakta.

Butuh python-docx (`pip install python-docx` di venv; sengaja TIDAK dimasukkan
ke requirements.txt - ini alat penulis dokumen, bukan bagian aplikasi).

Pakai:
    python3 scripts/sop/kumpulkan_fakta.py > scripts/sop/fakta.json
    python3 scripts/sop/buat_sop.py [nama modul...]      # kosong = semua modul
"""
import json
import pathlib
import re
import sys
from datetime import date

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor

AKAR = pathlib.Path(__file__).resolve().parents[2]
SUMBER = pathlib.Path(__file__).parent
KELUARAN = AKAR / 'docs' / 'sop'
PERUSAHAAN = 'PT FENGSHENG NONWOVEN INDONESIA'
HIJAU = RGBColor(0x1F, 0x4D, 0x3A)
ABU = RGBColor(0x6B, 0x72, 0x80)

# Satu modul bisa punya banyak tabel; yang tampil di SOP hanya dokumen yang
# memang diinput orang. Tabel baris/detail, log, dan tabel pengaturan dilewati.
LEWATI_TABEL = re.compile(r'(_items?|_lines?|_logs?|_history|_audit|_settings|_config|_mapping'
                          r'|_cache|_queue|_sessions?|_tokens?|_notifications?|_approvals?'
                          r'|_schedules|_steps?|_revisions?|_attachments?|_comments?)$')

# Nama tabel bukan bahasa orang gudang. Yang sering muncul diterjemahkan ke nama
# yang mereka lihat di layar; sisanya jatuh ke Title Case apa adanya.
NAMA_TAMPIL = {
    'purchase_requisitions': 'Permintaan Pembelian (PR)',
    'purchase_orders': 'Pesanan Pembelian (PO)',
    'goods_received_notes': 'Penerimaan Barang (BPB)',
    'purchase_returns': 'Retur Pembelian',
    'purchase_rfqs': 'Permintaan Penawaran (RFQ)',
    'supplier_quotes': 'Penawaran Pemasok',
    'supplier_contracts': 'Kontrak Pemasok',
    'suppliers': 'Data Pemasok',
    'invoices': 'Faktur',
    'payments': 'Pembayaran',
    'journal_entries': 'Jurnal',
    'accounting_entries': 'Jurnal Akuntansi',
    'accounts': 'Akun (COA)',
    'expenses': 'Pengajuan Biaya',
    'reimbursements': 'Penggantian Biaya',
    'sales_orders': 'Pesanan Penjualan (SO)',
    'quotations': 'Penawaran Penjualan',
    'customers': 'Data Pelanggan',
    'shipments': 'Pengiriman',
    'shipping_orders': 'Surat Jalan',
    'work_orders': 'Perintah Kerja (SPK)',
    'production_records': 'Catatan Produksi',
    'production_batches': 'Bets Produksi',
    'material_issues': 'Pengeluaran Bahan (Bon)',
    'material_returns': 'Retur Bahan',
    'inventory': 'Stok Gudang',
    'inventory_transactions': 'Mutasi Stok',
    'stock_transfers': 'Pemindahan Stok',
    'stock_opname_orders': 'Stok Opname',
    'warehouse_zones': 'Gudang / Zona',
    'warehouse_locations': 'Lokasi Rak',
    'materials': 'Data Bahan',
    'products': 'Data Produk',
    'boms': 'Bill of Material (BOM)',
    'quality_inspections': 'Inspeksi Mutu',
    'quality_standards': 'Standar Mutu',
    'employees': 'Data Karyawan',
    'attendances': 'Absensi',
    'payrolls': 'Penggajian',
    'leaves': 'Cuti',
    'machines': 'Mesin',
    'maintenance_records': 'Catatan Perawatan',
    'maintenance_schedules': 'Jadwal Perawatan',
    'assets': 'Aset',
    'dcc_documents': 'Dokumen Terkendali',
}

# Nama kolom juga bukan bahasa orang yang mengisinya. Pemetaan kata, lalu
# aturan akhiran untuk sisanya (_date -> Tanggal ..., _id -> nama acuannya).
KATA_KOLOM = {
    'supplier': 'pemasok', 'customer': 'pelanggan', 'material': 'bahan', 'product': 'produk',
    'employee': 'karyawan', 'machine': 'mesin', 'warehouse': 'gudang', 'location': 'lokasi',
    'account': 'akun', 'invoice': 'faktur', 'payment': 'pembayaran', 'order': 'pesanan',
    'quantity': 'jumlah', 'qty': 'jumlah', 'price': 'harga', 'amount': 'nilai', 'total': 'total',
    'date': 'tanggal', 'number': 'nomor', 'name': 'nama', 'code': 'kode', 'title': 'judul',
    'description': 'keterangan', 'notes': 'catatan', 'status': 'status', 'type': 'jenis',
    'batch': 'batch', 'uom': 'satuan', 'unit': 'satuan', 'reason': 'alasan', 'company': 'perusahaan',
    'requested': 'diminta', 'by': 'oleh', 'issue': 'terbit', 'closing': 'penutupan',
    'expiry': 'kedaluwarsa', 'start': 'mulai', 'end': 'selesai', 'return': 'retur',
    'receipt': 'penerimaan', 'contract': 'kontrak', 'quote': 'penawaran', 'request': 'permintaan',
    'work': 'kerja', 'production': 'produksi', 'shift': 'shift', 'line': 'line', 'level': 'tingkat',
    'period': 'periode', 'due': 'jatuh tempo', 'currency': 'mata uang', 'rate': 'kurs',
    # Singkatan tetap huruf besar - "Nomor grn" terbaca aneh, yang dikenal orang "Nomor BPB".
    'grn': 'BPB', 'po': 'PO', 'pr': 'PR', 'rfq': 'RFQ', 'so': 'SO', 'wo': 'SPK', 'spk': 'SPK',
    'bom': 'BOM', 'coa': 'COA', 'qc': 'QC', 'ppn': 'PPN', 'pph': 'PPh', 'sj': 'surat jalan',
}


def nama_kolom(kolom: str) -> str:
    """po_number -> Nomor pesanan; supplier_id -> Pemasok; order_date -> Tanggal pesanan."""
    bagian = [b for b in kolom.split('_') if b != 'id']
    kata = [KATA_KOLOM.get(b, b) for b in bagian]
    # "nomor pesanan" lebih enak dibaca daripada "pesanan nomor"
    for penanda in ('nomor', 'tanggal', 'jumlah', 'nilai', 'harga', 'nama', 'kode', 'jenis', 'alasan'):
        if penanda in kata and kata[-1] == penanda:
            kata = [penanda] + [k for k in kata if k != penanda]
            break
    teks = ' '.join(kata).strip()
    return teks[:1].upper() + teks[1:] if teks else kolom


# Dipakai mengurutkan tindakan di tabel izin.
URUT_AKSI = {'create': 0, 'update': 1, 'approve': 2, 'delete': 3, 'view': 4}


def fakta_modul():
    return json.loads((SUMBER / 'fakta.json').read_text())


def peta_izin():
    return json.loads((SUMBER / 'izin_peran.json').read_text())


def jumlah_data():
    """Berapa baris tiap tabel di produksi. Dipakai menandai modul yang belum
    dipakai sama sekali - lembar SOP untuk modul kosong tetap dibuat (permintaan
    pemilik: seluruh modul), tapi harus jujur menyebut keadaannya."""
    berkas = SUMBER / 'jumlah_data.json'
    return json.loads(berkas.read_text()) if berkas.exists() else {}


def rapikan(nama: str) -> str:
    """nama_tabel -> nama yang dikenal orang yang mengisinya."""
    return NAMA_TAMPIL.get(nama) or nama.replace('_', ' ').strip().title()


AKSI_INDONESIA = {'create': 'Membuat / menginput', 'update': 'Mengubah', 'approve': 'Menyetujui / menolak',
                  'delete': 'Menghapus', 'view': 'Melihat'}


def izin_per_aksi(modul, izin_peran):
    """Tindakan -> peran yang boleh melakukannya.

    Tindakannya diambil dari AKHIRAN izinnya (`purchasing.create` -> membuat),
    bukan ditebak dari nama fungsi route. Tebakan nama fungsi sempat membuat
    `purchase_orders.approve` tercatat sebagai "Create" di lembar percobaan.
    """
    per_aksi = {}
    for j in modul['jalur']:
        for nama_izin in j['izin']:
            aksi = nama_izin.rsplit('.', 1)[-1]
            if aksi not in URUT_AKSI:
                aksi = 'view' if 'view' in aksi or 'read' in aksi else 'update'
            per_aksi.setdefault(aksi, {}).setdefault(izin_peran.get(nama_izin) or '(belum ada peran yang memegang)', set()).add(nama_izin)
    hasil = []
    for aksi in sorted(per_aksi, key=lambda a: URUT_AKSI.get(a, 9)):
        for peran, izin_set in sorted(per_aksi[aksi].items()):
            hasil.append((AKSI_INDONESIA.get(aksi, aksi.title()), ', '.join(sorted(izin_set)), peran))
    return hasil


def dokumen_utama(modul):
    """Tabel yang benar-benar diisi orang, bukan tabel pendukung."""
    keluar = {}
    for tabel, isi in modul['entitas'].items():
        if LEWATI_TABEL.search(tabel):
            continue
        if not isi['wajib'] and not isi['status']:
            continue
        # Tabel penghubung: seluruh isian wajibnya cuma penunjuk ke tabel lain
        # (mis. material_id + supplier_id). Bukan sesuatu yang diisi orang.
        if isi['wajib'] and all(k.endswith(('_id', '_level')) for k in isi['wajib']) and not isi['status']:
            continue
        keluar[tabel] = isi
    return keluar


# ---------------------------------------------------------------- penulisan docx

def _judul(doc, teks, ukuran=14):
    p = doc.add_paragraph()
    r = p.add_run(teks)
    r.bold = True
    r.font.size = Pt(ukuran)
    r.font.color.rgb = HIJAU
    p.space_after = Pt(4)
    return p


def _label(doc, teks):
    p = doc.add_paragraph()
    r = p.add_run(teks.upper())
    r.bold = True
    r.font.size = Pt(9)
    r.font.color.rgb = ABU
    p.space_before = Pt(10)
    p.space_after = Pt(2)
    return p


def _isi(doc, teks, miring=False):
    p = doc.add_paragraph()
    r = p.add_run(teks)
    r.font.size = Pt(10)
    r.italic = miring
    p.space_after = Pt(2)
    return p


def _tabel(doc, kepala, baris):
    t = doc.add_table(rows=1, cols=len(kepala))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    for i, h in enumerate(kepala):
        sel = t.rows[0].cells[i]
        sel.text = ''
        r = sel.paragraphs[0].add_run(h)
        r.bold = True
        r.font.size = Pt(9)
    for b in baris:
        sel = t.add_row().cells
        for i, nilai in enumerate(b):
            sel[i].text = ''
            r = sel[i].paragraphs[0].add_run(str(nilai))
            r.font.size = Pt(9)
    return t


def kop(doc, nomor, judul, revisi='00'):
    bagian = doc.sections[0]
    bagian.top_margin = bagian.bottom_margin = Cm(1.6)
    bagian.left_margin = bagian.right_margin = Cm(1.8)

    t = doc.add_table(rows=2, cols=2)
    t.style = 'Table Grid'
    kiri = t.rows[0].cells[0]
    kiri.text = ''
    r = kiri.paragraphs[0].add_run(PERUSAHAAN)
    r.bold = True
    r.font.size = Pt(11)
    r.font.color.rgb = HIJAU
    kanan = t.rows[0].cells[1]
    kanan.text = ''
    r = kanan.paragraphs[0].add_run(f'No. Dokumen: {nomor}\nRevisi: {revisi}\nBerlaku: {date.today():%d/%m/%Y}')
    r.font.size = Pt(9)
    bawah = t.rows[1].cells[0].merge(t.rows[1].cells[1])
    bawah.text = ''
    p = bawah.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(judul)
    r.bold = True
    r.font.size = Pt(13)
    doc.add_paragraph()


def tanda_tangan(doc):
    _label(doc, 'Pengesahan')
    t = _tabel(doc, ['Disusun oleh', 'Diperiksa oleh', 'Disetujui oleh'],
               [['\n\n\n(.........................)\nIT / Sistem',
                 '\n\n\n(.........................)\nKepala Bagian terkait',
                 '\n\n\n(.........................)\nPresiden Direktur']])
    return t


def kaki_catatan(doc, modul_nama, dari_kode=True):
    p = doc.add_paragraph()
    inti = (f'Kolom wajib, status, dan izin di atas dibaca langsung dari perilaku sistem, bukan disalin dari '
            f'dokumen lain. ' if dari_kode else '')
    r = p.add_run(
        f'Dokumen ini dibangkitkan dari kode sistem SMITH ERP pada {date.today():%d %B %Y}. {inti}'
        f'Kalau alur {modul_nama} berubah, jalankan ulang pembangkitnya dan terbitkan revisi berikutnya - '
        f'jangan menyunting hasil cetakannya saja.')
    r.font.size = Pt(8)
    r.font.color.rgb = ABU
    r.italic = True


_urut_singkat = {}
_nomor_terakhir = ['']


def nomor_dokumen(_indeks: int, nama: str) -> str:
    """WI = Work Instruction (Level III di modul DCC). Nomornya urut per
    singkatan modul, bukan nomor urut global - lembar Purchasing pertama harus
    WI-PUR-01, bukan WI-PUR-31 sesuai posisinya di daftar."""
    singkat = re.sub(r'[^A-Z]', '', nama.upper())[:3] or 'MOD'
    _urut_singkat[singkat] = _urut_singkat.get(singkat, 0) + 1
    _nomor_terakhir[0] = f'WI-{singkat}-{_urut_singkat[singkat]:02d}'
    return _nomor_terakhir[0]


def lembar_modul(modul, indeks, izin_peran, data_terisi=None):
    doc = Document()
    nama = modul['nama']
    kop(doc, nomor_dokumen(indeks, nama), f'SOP Penginputan Data - {nama}')

    _label(doc, '1. Ruang lingkup')
    _isi(doc, modul['ringkas'] or f'Penginputan data pada modul {nama}.')

    data_terisi = data_terisi or {}
    dok = dokumen_utama(modul)
    terisi = {t: data_terisi.get(t) or 0 for t in dok}
    total = sum(terisi.values())
    if dok and total == 0:
        _isi(doc, 'Catatan: sampai lembar ini dibuat, belum ada satu pun data pada modul ini di sistem. '
                  'Prosedurnya disiapkan lebih dulu supaya penginputan pertama sudah mengikuti aturan yang sama.',
             miring=True)
    elif total:
        isi_ringkas = ', '.join(f'{rapikan(t)} {j:,}'.replace(',', '.') for t, j in sorted(terisi.items(), key=lambda x: -x[1]) if j)
        _isi(doc, f'Pemakaian sampai sekarang: {isi_ringkas}.', miring=True)

    _label(doc, '2. Siapa yang berhak')
    baris = [(a.title(), i, p) for a, i, p in izin_per_aksi(modul, izin_peran)]
    if baris:
        _tabel(doc, ['Tindakan', 'Izin sistem', 'Peran yang memegang'], baris)
    else:
        _isi(doc, 'Modul ini tidak memakai penjagaan izin per tindakan. [PERLU DIPASTIKAN]', miring=True)

    dokumen = dok
    _label(doc, '3. Isian wajib')
    if dokumen:
        baris = []
        for tabel, isi in sorted(dokumen.items()):
            wajib = ', '.join(nama_kolom(k) for k in isi['wajib']) or '-'
            baris.append([rapikan(tabel), wajib])
        _tabel(doc, ['Dokumen / data', 'Kolom yang wajib diisi'], baris)
        _isi(doc, 'Kolom di atas ditolak sistem kalau dikosongkan. Kolom lain boleh kosong secara teknis, '
                  'tetapi kebijakan pengisiannya ditentukan kepala bagian. [PERLU DIPASTIKAN]', miring=True)
    else:
        _isi(doc, 'Modul ini tidak menyimpan dokumen yang diisi manual.', miring=True)

    status = [(rapikan(t), s['kolom'], s['nilai']) for t, isi in sorted(dokumen.items()) for s in isi['status']]
    if status:
        _label(doc, '4. Status dan alur persetujuan')
        _tabel(doc, ['Dokumen', 'Kolom status', 'Nilai yang dikenal sistem'], status)

    if modul['awalan_nomor']:
        _label(doc, '5. Penomoran dokumen')
        _isi(doc, 'Nomor dibuat sistem, tidak diketik manual. Awalan yang dipakai modul ini: '
                  + ', '.join(modul['awalan_nomor']) + '.')

    _label(doc, '6. Waktu penginputan')
    _isi(doc, 'Diinput pada hari yang sama dengan kejadiannya, sebelum pergantian shift. [PERLU DIPASTIKAN - '
              'batas waktu untuk modul ini ditetapkan kepala bagian]', miring=True)

    _label(doc, '7. Kalau salah input')
    _isi(doc, 'Dokumen yang sudah disetujui atau sudah menimbulkan jurnal TIDAK dihapus, melainkan dibatalkan '
              'atau dibalik melalui sistem supaya jejaknya tetap ada. Dokumen yang masih draf boleh diperbaiki '
              'oleh pembuatnya. Penghapusan di luar itu hanya oleh pihak yang memegang izin hapus di tabel '
              'bagian 2.')

    tanda_tangan(doc)
    kaki_catatan(doc, nama)
    return doc


ATURAN_UMUM = [
    ('Satu kejadian, satu dokumen',
     'Setiap kejadian fisik dicatat tepat satu kali. Kalau dokumen yang sama terlanjur dibuat dua kali, '
     'yang kedua dibatalkan - bukan dibiarkan, dan bukan pula dihapus diam-diam.'),
    ('Nomor dokumen dibuat sistem',
     'Nomor PO, BPB, faktur, SPK, dan surat jalan diterbitkan sistem secara berurutan. Nomor tidak diketik '
     'manual dan tidak boleh dilompati. Kalau sebuah nomor batal dipakai, dokumennya tetap ada dengan status '
     'dibatalkan supaya urutannya tidak berlubang.'),
    ('Diinput oleh yang mengerjakan',
     'Yang menginput adalah petugas yang mengerjakan atau menyaksikan kejadiannya, bukan diwakilkan ke bagian '
     'lain. Akun tidak boleh dipakai bergantian - jejak audit mencatat nama pemilik akun, bukan nama pemakainya.'),
    ('Batch dan satuan',
     'Barang yang punya batch/lot wajib diisi nomor batchnya pada saat diterima maupun dipakai. Satuan mengikuti '
     'satuan master barang; konversi dilakukan sistem, bukan dihitung manual lalu diketik.'),
    ('Bukti dilampirkan',
     'Dokumen yang berasal dari pihak luar (surat jalan pemasok, nota, faktur pajak) dilampirkan berkas atau '
     'fotonya pada dokumen sistemnya di hari yang sama.'),
    ('Angka rupiah tidak untuk semua orang',
     'Nilai rupiah hanya tampil bagi pemegang izin keuangan (keputusan 26 November 2026). Jangan menyalin angka '
     'rupiah dari sistem ke pesan, grup, atau berkas yang dibaca orang di luar daftar itu.'),
]

LANGKAH_KOREKSI = [
    ('Masih draf', 'Diperbaiki sendiri oleh pembuatnya.'),
    ('Sudah diajukan, belum disetujui', 'Minta penyetuju mengembalikan/menolak, lalu perbaiki dan ajukan ulang.'),
    ('Sudah disetujui atau sudah berjurnal',
     'TIDAK dihapus. Dibatalkan atau dibalik lewat sistem supaya jejak dan jurnalnya tetap lengkap. '
     'Dokumen pengganti dibuat baru dengan nomor baru.'),
    ('Sudah menggerakkan stok fisik',
     'Koreksi lewat dokumen lawannya (retur, penyesuaian stok, atau pembatalan penerimaan), bukan dengan '
     'mengubah angka stok langsung.'),
]


def prosedur_induk(jumlah_modul):
    """Aturan umum yang berlaku di semua modul. Bagian kebijakan ditulis orang,
    bukan ditarik dari kode - karena itu yang masih perlu diputuskan ditandai."""
    doc = Document()
    kop(doc, 'QP-ALL-01', 'Prosedur Penginputan Data - Umum')

    _label(doc, '1. Tujuan')
    _isi(doc, 'Menetapkan aturan dasar penginputan data di seluruh modul SMITH ERP agar catatan sistem sama '
              'dengan keadaan sebenarnya di lapangan, dapat ditelusuri, dan dapat dipertanggungjawabkan kepada '
              'pemeriksa internal maupun eksternal.')

    _label(doc, '2. Ruang lingkup')
    _isi(doc, f'Berlaku untuk seluruh pengguna sistem pada {jumlah_modul} modul yang aktif. Tata cara rinci tiap '
              f'modul ada pada lembar Instruksi Kerja (WI) masing-masing; daftar lengkapnya pada Daftar Induk '
              f'SOP Penginputan Data.')

    _label(doc, '3. Aturan umum')
    _tabel(doc, ['Aturan', 'Penjelasan'], [[a, b] for a, b in ATURAN_UMUM])

    _label(doc, '4. Waktu penginputan')
    _isi(doc, 'Data diinput pada hari kejadian, sebelum pergantian shift. Keterlambatan di luar itu dilaporkan '
              'ke kepala bagian pada hari yang sama. [PERLU DIPASTIKAN - batas waktu dan siapa yang melapor '
              'ditetapkan Direksi]', miring=True)

    _label(doc, '5. Persetujuan')
    _isi(doc, 'Dokumen yang menggerakkan stok atau uang melewati persetujuan sesuai izin pada lembar WI modulnya. '
              'Yang menyetujui bukan orang yang membuat dokumennya. Persetujuan dilakukan dengan akun sendiri, '
              'tidak dititipkan.')

    _label(doc, '6. Kalau salah input')
    _tabel(doc, ['Keadaan dokumen', 'Yang harus dilakukan'], [[a, b] for a, b in LANGKAH_KOREKSI])

    _label(doc, '7. Jejak audit')
    _isi(doc, 'Seluruh pembuatan, perubahan, persetujuan, dan pembatalan tercatat lengkap dengan nama pengguna, '
              'waktu, serta nilai sebelum dan sesudahnya. Catatan ini tidak bisa dihapus dari dalam aplikasi.')

    _label(doc, '8. Penyimpangan')
    _isi(doc, '[PERLU DIPASTIKAN - akibat bagi penginputan yang tidak sesuai prosedur ditetapkan Direksi '
              'bersama HRD]', miring=True)

    tanda_tangan(doc)
    kaki_catatan(doc, 'penginputan data', dari_kode=False)
    return doc


def daftar_induk(daftar):
    """Daftar Induk - dipakai waktu lembar-lembar ini didaftarkan di modul DCC."""
    doc = Document()
    kop(doc, 'FRM-ALL-01', 'Daftar Induk SOP Penginputan Data')
    _label(doc, 'Daftar dokumen')
    _isi(doc, f'{len(daftar)} lembar Instruksi Kerja, satu per modul aktif, ditambah satu prosedur umum '
              f'(QP-ALL-01). Semua pada revisi 00.')
    _tabel(doc, ['No. Dokumen', 'Judul', 'Berkas'],
           [[nomor, f'SOP Penginputan Data - {nama}', berkas] for nomor, nama, berkas in daftar])
    kaki_catatan(doc, 'daftar induk', dari_kode=False)
    return doc


def main():
    KELUARAN.mkdir(parents=True, exist_ok=True)
    semua = fakta_modul()
    izin = peta_izin()
    terisi = jumlah_data()
    pilih = [a.lower() for a in sys.argv[1:]]
    daftar = []
    for i, modul in enumerate(semua, start=1):
        if pilih and modul['nama'].lower() not in pilih:
            continue
        berkas = KELUARAN / f"SOP-{re.sub(r'[^A-Za-z0-9]+', '-', modul['nama']).strip('-')}.docx"
        doc = lembar_modul(modul, i, izin, terisi)
        doc.save(berkas)
        daftar.append((_nomor_terakhir[0], modul['nama'], berkas.name))
        print(f'  {berkas.relative_to(AKAR)}')
    if not pilih:
        prosedur_induk(len(daftar)).save(KELUARAN / '00-Prosedur-Penginputan-Data-Umum.docx')
        daftar_induk(daftar).save(KELUARAN / '00-Daftar-Induk-SOP.docx')
        print('  docs/sop/00-Prosedur-Penginputan-Data-Umum.docx')
        print('  docs/sop/00-Daftar-Induk-SOP.docx')
    print(f'{len(daftar)} lembar modul + 2 dokumen induk di {KELUARAN.relative_to(AKAR)}')


if __name__ == '__main__':
    main()
