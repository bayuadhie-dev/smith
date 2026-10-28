"""Impor Pesanan Penjualan (SO) dan Pesanan Pembelian (PO) dari Excel/CSV.

Memakai fungsi inti yang sama dengan form biasa (create_sales_order_core / create_purchase_order_core), jadi penomoran,
perhitungan total/PPN/diskon, validasi, dan status awal (draft) identik dengan input manual. Pesanan tidak otomatis disetujui.
"""
from datetime import datetime

from models import db
from models.product import Material, Product
from models.purchasing import PurchaseOrder, Supplier
from models.sales import Customer, SalesOrder
from utils.import_center import Col, ImportKind, parse_amount, parse_date, register, text
from utils.tax_helpers import ppn_rate_for_code


def _find_party(model, value, label):
    key = str(value or '').strip()
    if not key:
        raise ValueError(f'{label} wajib diisi')
    low = key.lower()
    by_code = [p for p in model.query.filter(db.func.lower(model.code) == low).all()]
    if len(by_code) == 1:
        return by_code[0]
    by_name = model.query.filter(db.func.lower(model.company_name) == low).all()
    if len(by_name) == 1:
        return by_name[0]
    if len(by_name) > 1:
        raise ValueError(f'{label} "{key}" ambigu: ada {len(by_name)} dengan nama itu, pakai kodenya')
    raise ValueError(f'{label} "{key}" tidak ditemukan')


def _qty(v):
    q = parse_amount(v)
    if q <= 0:
        raise ValueError(f'Qty {q:g} harus lebih dari 0')
    return q


def _iso(v, label):
    if v in (None, ''):
        return None
    try:
        return parse_date(v).isoformat()
    except ValueError as e:
        raise ValueError(f'{label}: {e}')


def _same_header(rows, field, label):
    first = str(rows[0][1].get(field) or '').strip().lower()
    for n, r in rows[1:]:
        cur = str(r.get(field) or '').strip().lower()
        if cur and cur != first:
            raise ValueError(f'Baris {n}: {label} berbeda dari baris pertama pesanan yang sama')


class SalesOrderImport(ImportKind):
    key = 'sales_order'
    label = 'Pesanan Penjualan (SO)'
    description = 'Impor SO draft beserta item. Banyak baris dengan No. Pesanan sama menjadi satu SO.'
    view_permission = 'sales_orders.view'
    create_permission = 'sales_orders.create'
    group_field = 'no_pesanan'
    columns = [
        Col('no_pesanan', 'No. Pesanan', example='SO-IMP-001'),
        Col('tanggal', 'Tanggal', required=True),
        Col('pelanggan', 'Pelanggan', required=True, aliases=('customer',)),
        Col('tanggal_kirim', 'Tanggal Kirim', aliases=('tanggal dibutuhkan', 'required date')),
        Col('no_po_pelanggan', 'No. PO Pelanggan'),
        Col('kode_barang', 'Kode Barang', required=True, aliases=('kode produk',)),
        Col('qty', 'Qty', required=True, aliases=('jumlah', 'kuantitas')),
        Col('satuan', 'Satuan'),
        Col('harga', 'Harga Satuan', required=True, aliases=('harga',)),
        Col('diskon', 'Diskon %', aliases=('diskon', 'diskon bertingkat')),
        Col('kode_pajak', 'Kode Pajak', aliases=('ppn',)),
        Col('keterangan', 'Keterangan'),
        Col('alamat_kirim', 'Alamat Kirim'),
    ]
    sample_rows = [
        ['SO-IMP-001', '2026-11-02', 'CUST-001', '2026-11-20', 'PO-123', 'FG-0001', 100, 'PCS', 25000, 0, 'Y', 'Item pertama', 'Jl. Contoh No. 1'],
        ['SO-IMP-001', '2026-11-02', 'CUST-001', '', '', 'FG-0002', 50, '', 40000, '10+5', '', 'Item kedua', ''],
        ['', '2026-11-03', 'CUST-002', '', '', 'FG-0001', 10, '', 25000, 0, '', 'No. kosong = nomor otomatis', ''],
    ]
    guide = [
        'Pelanggan: kode atau nama persis seperti di master pelanggan.',
        'Kode Barang: kode produk (barang jual). Satuan kosong = satuan utama produk.',
        'Kode Pajak: Y/A/B/L. Kosong = otomatis dari data barang. Diskon dalam persen; bertingkat ditulis 10+5 (dihitung berantai).',
        'Kolom Nilai di hasil pemeriksaan = jumlah setelah diskon, sebelum PPN. Total SO yang tersimpan sudah termasuk PPN.',
        'SO yang diimpor berstatus draft, tidak otomatis dikonfirmasi.',
    ]

    def build(self, key, rows):
        number = None if key.startswith('__row') else key
        if number and SalesOrder.query.filter_by(order_number=number).first():
            raise ValueError(f'No. Pesanan {number} sudah ada')
        _same_header(rows, 'pelanggan', 'Pelanggan')
        _same_header(rows, 'tanggal', 'Tanggal')
        first = rows[0][1]
        customer = _find_party(Customer, first.get('pelanggan'), 'Pelanggan')
        order_date = parse_date(first.get('tanggal'))
        items, net = [], 0.0
        for n, r in rows:
            try:
                code = str(r.get('kode_barang') or '').strip()
                product = Product.query.filter(db.func.lower(Product.code) == code.lower()).first() if code else None
                if not product:
                    raise ValueError(f'Barang "{code}" tidak ditemukan di master produk')
                qty, price = _qty(r.get('qty')), parse_amount(r.get('harga'), allow_negative=False)
                tiers, disc = None, 0.0
                if r.get('diskon') not in (None, ''):
                    from routes.sales import _parse_discount_tiers
                    raw = str(r.get('diskon')).strip()
                    if '+' in raw:
                        disc, tiers = _parse_discount_tiers(raw)
                    else:
                        disc = parse_amount(raw)
                        if not 0 <= disc <= 100:
                            raise ValueError(f'Diskon {disc:g}% harus antara 0 dan 100')
                tax = 0
                if r.get('kode_pajak') not in (None, ''):
                    tax = ppn_rate_for_code(r.get('kode_pajak'))
                    if tax is None:
                        raise ValueError(f'Kode pajak "{r.get("kode_pajak")}" tidak dikenal (Y/A/B/L)')
                items.append({'product_id': product.id, 'quantity': qty, 'unit_price': price, 'discount_percent': disc, 'discount_tiers': tiers,
                              'tax_percent': tax, 'uom': text(r.get('satuan'), 20) or product.primary_uom,
                              'description': text(r.get('keterangan'))})
                net += qty * price * (1 - disc / 100)
            except ValueError as e:
                raise ValueError(f'item di baris {n}: {e}' if len(rows) > 1 else str(e))
        header = {}
        for _, r in rows:
            for src, dst in (('tanggal_kirim', 'required_date'), ('no_po_pelanggan', 'customer_po_number'), ('alamat_kirim', 'delivery_address')):
                if not header.get(dst) and r.get(src) not in (None, ''):
                    header[dst] = _iso(r[src], 'Tanggal Kirim') if dst == 'required_date' else str(r[src]).strip()
        data = {'customer_id': customer.id, 'order_date': order_date.isoformat(), 'items': items, **header}
        return {'number': number, 'data': data}, {'date': order_date.isoformat(), 'party': customer.company_name, 'total': round(net, 2)}

    def save(self, data, user_id):
        from routes.sales import create_sales_order_core
        from utils.business_rules import BusinessRules, ValidationError
        d = data['data']
        total = sum(i['quantity'] * i['unit_price'] for i in d['items'])
        try:
            credit = BusinessRules.validate_credit_limit(d['customer_id'], total)
            if not credit['approved']:
                raise ValueError('Batas kredit pelanggan terlampaui: limit Rp{:,.0f}, piutang berjalan Rp{:,.0f}, tersedia Rp{:,.0f}, pesanan ini Rp{:,.0f}. Isi batas kredit di master pelanggan.'.format(
                    credit['credit_limit'], credit['current_balance'], credit['available_credit'], credit['order_amount']).replace(',', '.'))
            terms = BusinessRules.validate_payment_terms(d['customer_id'])
            if not terms['valid']:
                raise ValueError(f'Syarat pembayaran pelanggan tidak valid ({terms})')
        except ValidationError as ve:
            print(f'Validation warning: {ve}')
        order = create_sales_order_core(d, user_id, order_number=data['number'])
        return {'number': order.order_number}


class PurchaseOrderImport(ImportKind):
    key = 'purchase_order'
    label = 'Pesanan Pembelian (PO)'
    description = 'Impor PO draft beserta item dan jadwal kedatangan. Banyak baris dengan No. Pesanan sama menjadi satu PO.'
    view_permission = 'purchase_orders.view'
    create_permission = 'purchase_orders.create'
    group_field = 'no_pesanan'
    columns = [
        Col('no_pesanan', 'No. Pesanan', example='PO-IMP-001'),
        Col('tanggal', 'Tanggal', required=True),
        Col('pemasok', 'Pemasok', required=True, aliases=('supplier', 'vendor')),
        Col('tanggal_dibutuhkan', 'Tanggal Dibutuhkan', aliases=('required date',)),
        Col('mata_uang', 'Mata Uang', aliases=('currency',)),
        Col('kode_barang', 'Kode Barang', required=True, aliases=('kode material',)),
        Col('qty', 'Qty', required=True, aliases=('jumlah', 'kuantitas')),
        Col('satuan', 'Satuan'),
        Col('harga', 'Harga Satuan', required=True),
        Col('jadwal', 'Jadwal Kedatangan', aliases=('jadwal',)),
        Col('keterangan', 'Keterangan'),
    ]
    sample_rows = [
        ['PO-IMP-001', '2026-11-02', 'SUP-001', '2026-11-30', 'IDR', 'MAT-0001', 1000, 'KG', 15000, '2026-11-10:400;2026-11-25:600', 'Dikirim bertahap'],
        ['PO-IMP-001', '2026-11-02', 'SUP-001', '', '', 'MAT-0002', 200, '', 8000, '', ''],
        ['', '2026-11-03', 'SUP-002', '', 'USD', 'MAT-0003', 50, '', 12.5, '', 'No. kosong = nomor otomatis'],
    ]
    guide = [
        'Pemasok: kode atau nama persis seperti di master pemasok.',
        'Kode Barang: kode produk atau material (dicari di keduanya). Satuan kosong = satuan utama barang.',
        'Mata Uang kosong = IDR. Kurs dikunci saat PO diajukan untuk persetujuan, bukan saat impor.',
        'Jadwal Kedatangan (opsional): TANGGAL:QTY dipisah titik koma, contoh 2026-11-10:400;2026-11-25:600. Total jadwal tidak boleh melebihi Qty.',
        'PO yang diimpor berstatus draft, tidak otomatis disetujui.',
    ]

    def build(self, key, rows):
        number = None if key.startswith('__row') else key
        if number and PurchaseOrder.query.filter_by(po_number=number).first():
            raise ValueError(f'No. Pesanan {number} sudah ada')
        _same_header(rows, 'pemasok', 'Pemasok')
        _same_header(rows, 'tanggal', 'Tanggal')
        _same_header(rows, 'mata_uang', 'Mata Uang')
        first = rows[0][1]
        supplier = _find_party(Supplier, first.get('pemasok'), 'Pemasok')
        if not supplier.is_active:
            raise ValueError(f'Pemasok {supplier.code} tidak aktif')
        order_date = parse_date(first.get('tanggal'))
        items, total = [], 0.0
        for n, r in rows:
            try:
                code = str(r.get('kode_barang') or '').strip()
                low = code.lower()
                prod = Product.query.filter(db.func.lower(Product.code) == low).all() if code else []
                mat = Material.query.filter(db.func.lower(Material.code) == low).all() if code else []
                if len(prod) + len(mat) == 0:
                    raise ValueError(f'Barang "{code}" tidak ditemukan di produk maupun material')
                if len(prod) + len(mat) > 1:
                    raise ValueError(f'Kode "{code}" ambigu: ada di produk dan material sekaligus, minta admin merapikan kodenya')
                obj = prod[0] if prod else mat[0]
                qty, price = _qty(r.get('qty')), parse_amount(r.get('harga'), allow_negative=False)
                item = {'quantity': qty, 'unit_price': price, 'uom': text(r.get('satuan'), 20) or obj.primary_uom}
                item['product_id' if prod else 'material_id'] = obj.id
                sched = []
                for part in [p.strip() for p in str(r.get('jadwal') or '').split(';') if p.strip()]:
                    d, sep, q = part.partition(':')
                    if not sep:
                        raise ValueError(f'Jadwal "{part}" salah format, pakai TANGGAL:QTY')
                    sched.append({'expected_date': parse_date(d).isoformat(), 'quantity': _qty(q)})
                if sched:
                    item['schedules'] = sched
                items.append(item)
                total += qty * price
            except ValueError as e:
                raise ValueError(f'item di baris {n}: {e}' if len(rows) > 1 else str(e))
        header = {'required_date': None, 'notes': None}
        for _, r in rows:
            if not header['required_date'] and r.get('tanggal_dibutuhkan') not in (None, ''):
                header['required_date'] = _iso(r['tanggal_dibutuhkan'], 'Tanggal Dibutuhkan')
            if not header['notes'] and r.get('keterangan') not in (None, ''):
                header['notes'] = str(r['keterangan']).strip()
        data = {'supplier_id': supplier.id, 'order_date': order_date.isoformat(), 'items': items,
                'currency': text(first.get('mata_uang')) or 'IDR', **header}
        return {'number': number, 'data': data}, {'date': order_date.isoformat(), 'party': supplier.company_name, 'total': round(total, 2)}

    def save(self, data, user_id):
        from routes.purchasing import _po_source_list_errors, create_purchase_order_core
        d = data['data']
        errs = _po_source_list_errors(d, d['supplier_id'])
        if errs:
            raise ValueError('Source list: ' + '; '.join(errs))
        po = create_purchase_order_core(d, user_id, po_number=data['number'])
        return {'number': po.po_number}


class ShippingOrderImport(ImportKind):
    key = 'shipping_order'
    label = 'Surat Jalan (Pengiriman)'
    description = ('Impor Surat Jalan dari Sales Order yang sudah ada. Stok terpotong otomatis (FIFO) dan jurnal HPP dibuat, '
                   'sama seperti input manual. Baris dengan No. Pengiriman sama menjadi satu surat jalan.')
    view_permission = 'shipping.view'
    create_permission = 'shipping.create'
    group_field = 'no_pengiriman'
    columns = [
        Col('no_pengiriman', 'No. Pengiriman', example='KIRIM-1'),
        Col('no_so', 'No. Sales Order', required=True, aliases=('no so', 'sales order', 'no pesanan')),
        Col('tanggal', 'Tanggal', required=True),
        Col('kode_barang', 'Kode Barang', required=True, aliases=('kode produk',)),
        Col('qty', 'Qty Kirim', required=True, aliases=('qty', 'jumlah')),
        Col('satuan', 'Satuan'),
        Col('sopir', 'Sopir', aliases=('driver',)),
        Col('no_kendaraan', 'No. Kendaraan', aliases=('nopol', 'plat')),
        Col('alamat_kirim', 'Alamat Kirim'),
        Col('keterangan', 'Catatan'),
    ]
    sample_rows = [
        ['KIRIM-1', 'SO-IMP-001', '2026-11-05', 'FG-0001', 60, 'PCS', 'Pak Budi', 'B 1234 XY', 'Jl. Contoh No. 1', 'Kirim tahap 1'],
        ['KIRIM-1', 'SO-IMP-001', '2026-11-05', 'FG-0002', 20, '', 'Pak Budi', 'B 1234 XY', '', ''],
    ]
    guide = [
        'No. Sales Order harus sudah ada. Kode Barang harus termasuk dalam SO itu.',
        'Qty Kirim tidak boleh melebihi sisa yang belum dikirim. Satuan kosong = satuan di SO.',
        'Stok finished goods dipotong otomatis berdasarkan batch tertua (FIFO). Jika stok kurang, baris ditolak.',
        'Satu surat jalan hanya untuk satu Sales Order; baris dengan No. Pengiriman sama harus punya No. SO dan Tanggal yang sama.',
    ]

    def build(self, key, rows):
        _same_header(rows, 'no_so', 'No. Sales Order')
        _same_header(rows, 'tanggal', 'Tanggal')
        first = rows[0][1]
        so_no = str(first.get('no_so') or '').strip()
        order = SalesOrder.query.filter(db.func.lower(SalesOrder.order_number) == so_no.lower()).first() if so_no else None
        if not order:
            raise ValueError(f'Sales Order "{so_no}" tidak ditemukan')
        if str(order.status or '').lower() in ('draft', 'cancelled'):
            raise ValueError(f'Sales Order {order.order_number} berstatus {order.status}, belum bisa dikirim')
        ship_date = parse_date(first.get('tanggal'))
        items, total = [], 0.0
        for n, r in rows:
            try:
                code = str(r.get('kode_barang') or '').strip()
                product = Product.query.filter(db.func.lower(Product.code) == code.lower()).first() if code else None
                so_item = next((i for i in order.items if product and i.product_id == product.id), None)
                if not so_item:
                    raise ValueError(f'Barang "{code}" tidak ada di {order.order_number}')
                qty = _qty(r.get('qty'))
                items.append({'product_id': product.id, 'quantity': qty, 'uom': text(r.get('satuan'), 20) or so_item.uom})
                total += qty
            except ValueError as e:
                raise ValueError(f'item di baris {n}: {e}' if len(rows) > 1 else str(e))
        header = {}
        for _, r in rows:
            for src, dst in (('sopir', 'driver_name'), ('no_kendaraan', 'vehicle_number'), ('alamat_kirim', 'shipping_address'), ('keterangan', 'notes')):
                if not header.get(dst) and r.get(src) not in (None, ''):
                    header[dst] = str(r[src]).strip()
        data = {'sales_order_id': order.id, 'customer_id': order.customer_id, 'shipping_date': ship_date.isoformat(),
                'items': items, **header}
        return {'number': None, 'data': data}, {'date': ship_date.isoformat(), 'party': order.customer.company_name if order.customer else '', 'total': round(total, 2)}

    def save(self, data, user_id):
        from routes.shipping import create_shipping_order_core, ShippingInputError
        try:
            order = create_shipping_order_core(data['data'], user_id, commit=False)
        except ShippingInputError as e:
            raise ValueError(str(e))
        return {'number': order.shipping_number}


register(ShippingOrderImport())
register(SalesOrderImport())
register(PurchaseOrderImport())
