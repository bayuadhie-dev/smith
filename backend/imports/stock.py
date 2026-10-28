"""Impor Saldo Awal / Penyesuaian Stok. Memakai add_stock_core (jalur yang sama dengan Input Stok manual): lot dibuat bila belum ada,
buku besar stok tercatat, dan jurnal persediaan (Dr Persediaan / Cr Saldo Awal Persediaan) diposting bila harga pokok diketahui."""
from datetime import datetime

from models import WarehouseLocation, db
from models.product import Material, Product
from utils.import_center import Col, ImportKind, parse_amount, parse_date, register, text


def _reg(cls):
    register(cls())
    return cls



@_reg
class OpeningStockImport(ImportKind):
    key = 'opening_stock'
    label = 'Saldo Awal / Tambah Stok'
    group = 'Transaksi'
    description = 'Menambah stok per barang, lokasi, dan batch. Bersifat menambah, bukan mengganti stok yang sudah ada.'
    view_permission = 'inventory.view'
    create_permission = 'inventory.create'
    group_field = None
    summary_columns = [('date', 'Tanggal', 'text'), ('item', 'Barang', 'text'), ('qty', 'Qty', 'text'), ('total', 'Nilai', 'money')]
    columns = [Col('tanggal', 'Tanggal', required=True), Col('kode_barang', 'Kode Barang', required=True, aliases=['kode', 'item']),
               Col('lokasi', 'Lokasi', required=True, aliases=['gudang', 'gudang/lokasi', 'kode lokasi']),
               Col('batch', 'Batch/Lot', aliases=['batch', 'lot', 'no. batch']), Col('qty', 'Qty', required=True, aliases=['jumlah', 'kuantitas']),
               Col('harga_pokok', 'Harga Pokok', aliases=['harga pokok per satuan', 'hpp', 'harga']), Col('keterangan', 'Keterangan')]
    guide = ['Kode Barang: kode produk atau bahan. Lokasi: kode lokasi gudang (persis seperti di Master Gudang).',
             'Impor ini MENAMBAH stok. Jangan mengimpor file yang sama dua kali, stok akan bertambah dua kali.',
             'Harga Pokok per satuan dipakai untuk jurnal persediaan; kosong = harga pokok di master barang. Qty harus lebih dari 0.',
             'Lot yang sudah ada (barang + lokasi + batch sama) ditambah, lot baru dibuat otomatis.']
    sample_rows = [['2026-01-01', '2011600005', 'GUDANG-A-01', 'BATCH-001', 120, 25000, 'Saldo awal stok'],
                   ['2026-01-01', '4022301001', 'GUDANG-A-02', '', 500, '', '']]

    def build(self, key, rows):
        n, r = rows[0]
        date = parse_date(r.get('tanggal'))
        code = text(r.get('kode_barang'))
        loc_code = text(r.get('lokasi'))
        if not code or not loc_code:
            raise ValueError('Kode Barang dan Lokasi wajib diisi')
        qty = parse_amount(r.get('qty'), allow_negative=False)
        if qty <= 0:
            raise ValueError('Qty harus lebih dari 0')
        cost = None if r.get('harga_pokok') in (None, '') else parse_amount(r.get('harga_pokok'), allow_negative=False)
        product = Product.query.filter_by(code=code).first()
        material = None if product else Material.query.filter_by(code=code).first()
        if not product and not material:
            raise ValueError(f'Barang {code} tidak ditemukan')
        loc = WarehouseLocation.query.filter_by(location_code=loc_code).first()
        if not loc:
            raise ValueError(f'Lokasi {loc_code} tidak ditemukan')
        data = {'product_id': product.id if product else None, 'material_id': material.id if material else None, 'location_id': loc.id,
                'quantity': qty, 'batch_number': text(r.get('batch'), 100), 'unit_cost': cost, 'entry_date': date,
                'notes': text(r.get('keterangan')) or 'Saldo awal stok (impor)', 'reference_type': 'manual_input',
                'reference_number': f'IMP-STOK-{date.isoformat()}'}
        unit = cost if cost is not None else float((product.cost if product else material.cost_per_unit) or 0)
        return data, {'date': date.isoformat(), 'item': code, 'qty': f'{qty:g}', 'total': round(qty * unit, 2)}

    def save(self, data, user_id):
        from routes.warehouse import add_stock_core
        inventory, movement = add_stock_core(data, user_id)
        d = data['entry_date']
        movement.transaction_date = datetime(d.year, d.month, d.day)
        return {'number': data['reference_number']}
