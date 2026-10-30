"""Jenis impor MASTER (judul kolom = ekspor Accurate Online, file ekspor bisa langsung diunggah).
Satu baris = satu data. Idempoten: data yang sudah ada dilewati (galat ringan di baris itu), tidak pernah menimpa."""
import re

from flask import request

from models import db
from models.finance import Account
from utils.import_center import Col, ImportKind, register
from utils.master_import_helpers import TYPE_MAP, asset_fields, clean, customer_fields, norm_code, supplier_fields


def _norm_name(s):
    return re.sub(r'[^a-z0-9]', '', str(s or '').lower())


def _seen(bucket):
    store = request.environ.setdefault('master_import_seen', {})
    return store.setdefault(bucket, set())


def _db_item_names():
    """{nama ternormalisasi: (kode, 'produk'|'material')} dari kedua tabel, dimuat sekali per permintaan."""
    cache = request.environ.setdefault('master_import_cache', {})
    if 'item_names' not in cache:
        from models.product import Material, Product
        out = {}
        for model, label in ((Product, 'produk'), (Material, 'material')):
            for c_, n_ in model.query.with_entities(model.code, model.name).all():
                out.setdefault(_norm_name(n_), (c_, label))
        cache['item_names'] = out
    return cache['item_names']


def _accounts():
    return {a.account_code: a.id for a in Account.query.all()}


def _make_get(kind, rec):
    label_to_field = {c.label: c.field for c in kind.columns}
    return lambda label: rec.get(label_to_field.get(label))


def _cols(*pairs):
    """pairs: (label, required) -> Col dengan field = label (judul Accurate apa adanya)."""
    return [Col(label, label, required=req) for label, req in pairs]


# ---------------------------------------------------------------- Pemasok
class SupplierKind(ImportKind):
    key, label, group = 'supplier', 'Pemasok (ekspor Accurate)', 'Master'
    description = 'Daftar Pemasok. Kode yang sudah ada dilewati.'
    view_permission = create_permission = 'suppliers.create'
    summary_columns = [('code', 'ID Pemasok', 'text'), ('name', 'Nama', 'text')]
    columns = _cols(('ID Pemasok', True), ('Nama', True), ('Kategori', False), ('Kontak', False), ('No. Telp. Bisnis', False),
                    ('Handphone', False), ('Email', False), ('Faximili', False), ('Website', False), ('Mata Uang Utama', False),
                    ('Syarat Pembayaran', False), ('Alamat Pembayaran', False), ('Kota', False), ('Provinsi', False),
                    ('Negara', False), ('Kode Pos', False), ('Catatan', False), ('Akun Utang', False), ('NPWP', False))
    sample_rows = [['SUP-001', 'PT Contoh Pemasok', 'BAHAN BAKU', 'Budi', '021123456', '', 'a@contoh.com', '', '', 'IDR', 'Net 30',
                    'Jl. Contoh No. 1', 'Jakarta', 'DKI Jakarta', 'Indonesia', '10110', '', '', '']]
    guide = ['Judul kolom sama dengan ekspor Daftar Pemasok Accurate, jadi file ekspor bisa diunggah langsung.',
             'Syarat Pembayaran: "Net 30" atau "C.O.D". Pemasok bermata uang asing tetap dibuat, mata uangnya dicatat di Catatan.']

    def build(self, key, rows):
        n, rec = rows[0]
        fields, _ = supplier_fields(_make_get(self, rec), _accounts())
        if not fields['code'] or not fields['company_name']:
            raise ValueError('ID Pemasok dan Nama wajib diisi')
        if fields['code'] in _seen('supplier'):
            raise ValueError(f'ID Pemasok {fields["code"]} ganda di file')
        _seen('supplier').add(fields['code'])
        from models.purchasing import Supplier
        if Supplier.query.filter_by(code=fields['code']).first():
            raise ValueError(f'Pemasok {fields["code"]} sudah ada, dilewati')
        return fields, {'code': fields['code'], 'name': fields['company_name']}

    def save(self, data, user_id):
        from models.purchasing import Supplier
        db.session.add(Supplier(**data))
        db.session.flush()
        return {'number': data['code']}


# ---------------------------------------------------------------- Pelanggan
class CustomerKind(ImportKind):
    key, label, group = 'customer', 'Pelanggan (ekspor Accurate)', 'Master'
    description = 'Daftar Pelanggan. Kode yang sudah ada dilewati.'
    view_permission = create_permission = 'customers.create'
    summary_columns = [('code', 'ID Pelanggan', 'text'), ('name', 'Nama', 'text')]
    columns = _cols(('ID Pelanggan', True), ('Nama', True), ('Kategori', False), ('Kontak', False), ('No. Telp. Bisnis', False),
                    ('Handphone', False), ('Email', False), ('Faximili', False), ('Website', False), ('Mata Uang Utama', False),
                    ('Syarat Pembayaran', False), ('Alamat Penagihan', False), ('Alamat Pengiriman', False), ('Kota', False),
                    ('Provinsi', False), ('Negara', False), ('Kode Pos', False), ('Catatan', False), ('Akun Piutang', False),
                    ('Nomor Wajib Pajak', False), ('Jumlah Limit Piutang', False))
    sample_rows = [['CUS-001', 'PT Contoh Pelanggan', 'DISTRIBUTOR', 'Sari', '021765432', '', 'b@contoh.com', '', '', 'IDR', 'Net 45',
                    'Jl. Contoh No. 2', 'Jl. Gudang No. 3', 'Bekasi', 'Jawa Barat', 'Indonesia', '17111', '', '', '', 0]]
    guide = ['Judul kolom sama dengan ekspor Daftar Pelanggan Accurate, jadi file ekspor bisa diunggah langsung.']

    def build(self, key, rows):
        n, rec = rows[0]
        fields, _ = customer_fields(_make_get(self, rec), _accounts())
        if not fields['code'] or not fields['company_name']:
            raise ValueError('ID Pelanggan dan Nama wajib diisi')
        if fields['code'] in _seen('customer'):
            raise ValueError(f'ID Pelanggan {fields["code"]} ganda di file')
        _seen('customer').add(fields['code'])
        from models.sales import Customer
        if Customer.query.filter_by(code=fields['code']).first():
            raise ValueError(f'Pelanggan {fields["code"]} sudah ada, dilewati')
        return fields, {'code': fields['code'], 'name': fields['company_name']}

    def save(self, data, user_id):
        from models.sales import Customer
        db.session.add(Customer(**data))
        db.session.flush()
        return {'number': data['code']}


# ---------------------------------------------------------------- Aset tetap
class AssetKind(ImportKind):
    key, label, group = 'asset', 'Aset Tetap (ekspor Accurate)', 'Master'
    description = 'Daftar Aset Tetap. Akumulasi penyusutan awal = 0 (file Accurate tidak memuatnya).'
    view_permission = create_permission = 'maintenance.create'
    summary_columns = [('code', 'Kode Aset', 'text'), ('name', 'Nama', 'text'), ('total', 'Nilai Perolehan', 'money')]
    columns = _cols(('Kode Aset', True), ('Nama', True), ('Kategori Aset', False), ('Tanggal Beli', False), ('Tanggal Pakai', False),
                    ('Nilai Sisa', False), ('Metode Penyusutan', False), ('Kuantitas', False), ('Umur Aset Tahun', False),
                    ('Umur Aset Bulan', False), ('Lokasi Aset', False), ('Departemen', False), ('Catatan', False),
                    ('Kategori Pajak', False), ('Akun Aset', False), ('Akun Akumulasi Penyusutan', False),
                    ('Akun Beban Penyusutan', False), ('Kode #', False), ('Jumlah', False), ('Aset Tidak Berwujud', False))
    sample_rows = [['AST-001', 'Mesin Contoh', 'MESIN & PERALATAN', '01/01/2024', '01/01/2024', 0, 'STRAIGHTLINE', 1, 8, 0, 'PRODUKSI',
                    '', '', '', '', '', '', '', 100000000, '']]

    def build(self, key, rows):
        n, rec = rows[0]
        fields = asset_fields(_make_get(self, rec))
        if not fields['asset_code'] or not fields['asset_name']:
            raise ValueError('Kode Aset dan Nama wajib diisi')
        if fields['asset_code'] in _seen('asset'):
            raise ValueError(f'Kode Aset {fields["asset_code"]} ganda di file')
        _seen('asset').add(fields['asset_code'])
        from models.asset_management import Asset
        if Asset.query.filter_by(asset_code=fields['asset_code']).first():
            raise ValueError(f'Aset {fields["asset_code"]} sudah ada, dilewati')
        return fields, {'code': fields['asset_code'], 'name': fields['asset_name'], 'total': fields['purchase_cost']}

    def save(self, data, user_id):
        from models.asset_management import Asset
        db.session.add(Asset(**data))
        db.session.flush()
        return {'number': data['asset_code']}


# ---------------------------------------------------------------- Akun perkiraan
class AccountKind(ImportKind):
    key, label, group = 'chart_of_accounts', 'Akun Perkiraan (ekspor Accurate)', 'Master'
    description = 'Daftar Akun Perkiraan. Akun induk harus ada di baris sebelumnya atau sudah ada di sistem.'
    view_permission = create_permission = 'accounting.create'
    summary_columns = [('code', 'Kode', 'text'), ('name', 'Nama', 'text')]
    columns = _cols(('Tipe Akun', True), ('Kode Perkiraan', True), ('Nama', True), ('Akun Induk', False), ('Mata Uang', False),
                    ('Catatan', False))
    sample_rows = [['EXPS', '600101', 'Biaya Contoh', '600000', 'IDR', '']]
    guide = ['Tipe Akun memakai kode Accurate: ' + ', '.join(sorted(TYPE_MAP)) + '.',
             'Urutan baris: akun induk harus tampil lebih dulu daripada anak-anaknya.']

    def build(self, key, rows):
        n, rec = rows[0]
        get = _make_get(self, rec)
        code = norm_code(get('Kode Perkiraan'))
        name = clean(get('Nama'))
        typ = clean(get('Tipe Akun'))
        if not code or not name:
            raise ValueError('Kode Perkiraan dan Nama wajib diisi')
        if typ not in TYPE_MAP:
            raise ValueError(f'Tipe Akun "{typ}" tidak dikenal (pakai: {", ".join(sorted(TYPE_MAP))})')
        if code in _seen('account'):
            raise ValueError(f'Kode {code} ganda di file')
        _seen('account').add(code)
        if Account.query.filter_by(account_code=code).first():
            raise ValueError(f'Akun {code} sudah ada, dilewati')
        parent = norm_code(get('Akun Induk'))
        if parent and not Account.query.filter_by(account_code=parent).first():
            raise ValueError(f'Akun induk {parent} belum ada. Letakkan baris induk lebih dulu atau buat dulu di sistem')
        return {'code': code, 'name': name[:200], 'typ': typ, 'parent': parent, 'note': clean(get('Catatan'))}, \
            {'code': code, 'name': name}

    def save(self, data, user_id):
        acc_type, normal = TYPE_MAP[data['typ']]
        parent = Account.query.filter_by(account_code=data['parent']).first() if data['parent'] else None
        acc = Account(account_code=data['code'], account_name=data['name'], account_type=acc_type, normal_balance=normal,
                      is_header=False, is_cash_bank=(data['typ'] == 'BANK'), is_active=True, description=data['note'],
                      level=(parent.level or 1) + 1 if parent else 1, parent_id=parent.id if parent else None)
        db.session.add(acc)
        if parent and not parent.is_header:
            parent.is_header = True
            parent.is_cash_bank = False
        db.session.flush()
        return {'number': data['code']}


# ---------------------------------------------------------------- Barang & Jasa
ITEM_COLS = [  # (field di import_item_rows.COL, judul Accurate, wajib)
    ('kategori', 'Kategori Barang', True), ('kode', 'Kode Barang', True), ('nama', 'Nama Barang', True),
    ('jenis', 'Jenis Barang', False), ('satuan', 'Satuan', False), ('satuan_2', 'Satuan #2', False),
    ('rasio_satuan_2', 'Rasio Satuan #2', False), ('satuan_3', 'Satuan #3', False), ('rasio_satuan_3', 'Rasio Satuan #3', False),
    ('harga_beli', 'Harga Beli', False), ('min_beli', 'Minimum Beli', False), ('ppn', 'PPN', False),
    ('gl_persediaan', 'Persediaan', False), ('gl_hpp', 'Beban Pokok Penjualan', False), ('gl_barang_terkirim', 'Barang Terkirim', False),
    ('gl_pembelian_belum_tertagih', 'Pembelian Belum Tertagih', False), ('gl_penjualan', 'Penjualan', False),
    ('gl_diskon_penjualan', 'Diskon Penjualan', False), ('gl_retur_penjualan', 'Retur Penjualan', False),
    ('gl_retur_pembelian', 'Retur Pembelian', False), ('kelompok', 'Karakter 1', False), ('erp_approval', 'Karakter 2', False),
    ('lead_time', 'Angka 6', False), ('self_life_retest', 'Angka 7', False), ('non_aktif', 'Non Aktif', False)]


class ItemKind(ImportKind):
    key, label, group = 'item', 'Barang & Jasa (ekspor Accurate)', 'Master'
    description = ('Barang jadi, WIP, premix, waste (produk) dan bahan baku/kimia/pembantu (material). Barang dengan kode atau '
                   'nama yang sudah ada di produk maupun material dilewati, jadi tidak ada duplikat.')
    view_permission = create_permission = 'products.create'
    summary_columns = [('code', 'Kode Barang', 'text'), ('name', 'Nama Barang', 'text'), ('kind', 'Jenis', 'text')]
    columns = [Col(field, label, required=req) for field, label, req in ITEM_COLS]
    sample_rows = [['BAHAN PEMBANTU', '2019900001', 'LAKBAN CONTOH 2"', 'INV', 'ROL'] + [''] * 20]
    guide = ['Judul kolom sama dengan ekspor Barang & Jasa Accurate. Kategori yang diimpor: BARANG JADI, PREMIX, '
             'BARANG DALAM PENYELESAIAN, WASTE, BAHAN BAKU, BAHAN KIMIA, BAHAN PEMBANTU. LAIN-LAIN dan Umum masuk sebagai barang non persediaan (jasa/biaya), hanya yang berjenis NON, SVC, atau PDC; akun bebannya dari kolom Persediaan.',
             'Satuan #2/#3 dan rasionya dibuat sebagai konversi satuan barang.']

    def build(self, key, rows):
        from models.product import Material, Product
        from routes.master_data_import import CATEGORY_MAP, COL, NON_INVENTORY_JENIS
        n, rec = rows[0]
        code = clean(rec.get('kode'))
        name = clean(rec.get('nama'))
        kategori = (clean(rec.get('kategori')) or '')
        if not code or not name:
            raise ValueError('Kode Barang dan Nama Barang wajib diisi')
        if kategori not in CATEGORY_MAP:
            raise ValueError(f'Kategori "{kategori}" tidak diimpor (hanya: {", ".join(CATEGORY_MAP)})')
        if CATEGORY_MAP[kategori][1] == 'non_inventory' and (clean(rec.get('jenis')) or '').upper() not in NON_INVENTORY_JENIS:
            raise ValueError(f'Jenis "{clean(rec.get("jenis")) or ""}" pada kategori {kategori} bukan item biaya/jasa (NON/SVC/PDC), dilewati')
        if code in _seen('item_code'):
            raise ValueError(f'Kode {code} ganda di file')
        _seen('item_code').add(code)
        if Product.query.filter_by(code=code).first() or Material.query.filter_by(code=code).first():
            raise ValueError(f'Barang {code} sudah ada (produk/material), dilewati')
        nn = _norm_name(name)
        if nn in _seen('item_name'):
            raise ValueError(f'Nama "{name}" ganda di file')
        _seen('item_name').add(nn)
        existing = _db_item_names().get(nn)
        if existing:
            raise ValueError(f'Nama sama dengan {existing[1]} yang sudah ada ({existing[0]}), dilewati agar tidak ganda')
        row = [None] * (max(COL.values()) + 1)
        for field, idx in COL.items():
            row[idx] = rec.get(field)
        return row, {'code': code, 'name': name, 'kind': CATEGORY_MAP[kategori][0]}

    def save(self, data, user_id):
        from routes.master_data_import import import_item_rows
        res = import_item_rows([data], commit=False)
        if res['error_count']:
            raise ValueError(res['errors'][0])
        if not (res['created_product'] or res['created_material']):
            raise ValueError('Barang tidak dibuat (sudah ada atau kategori tidak diimpor)')
        return {'number': str(data[2]).strip()}


for _k in (SupplierKind, CustomerKind, AssetKind, AccountKind, ItemKind):
    register(_k())
