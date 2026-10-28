"""Impor Faktur Penjualan dan Faktur Pembelian (Pusat Impor).

Memakai fungsi inti yang sama dengan form faktur (create_invoice_core / create_purchase_invoice_core), jadi penomoran,
PPN, jurnal GL, kunci periode, dan status awal sama persis dengan input manual.
"""
from datetime import timedelta

from models import db
from models.product import Material, Product
from models.purchasing import PurchaseOrder, PurchaseOrderItem, Supplier
from models.sales import Customer, SalesOrder
from utils.import_center import Col, ImportKind, parse_amount, parse_date, register, text
from utils.invoice_errors import InvoiceInputError
from utils.tax_helpers import ppn_rate_for_code, resolve_item_tax_percent

NO_TAX = {'tidak', 'tanpa', 'n', 'no', '-', '0'}


def _find_party(model, value, label):
    v = text(value)
    if not v:
        raise ValueError(f'{label} wajib diisi')
    rows = model.query.filter(db.func.lower(model.code) == v.lower()).all()
    if not rows:
        rows = model.query.filter(db.func.lower(model.company_name) == v.lower()).all()
    if not rows:
        raise ValueError(f'{label} "{v}" tidak ditemukan (isi dengan kode atau nama persis)')
    if len(rows) > 1:
        raise ValueError(f'{label} "{v}" ambigu ({len(rows)} data cocok), pakai kode')
    return rows[0]


def _same(rows, field, label):
    vals = {str(r.get(field)).strip() for _, r in rows if r.get(field) not in (None, '')}
    if len(vals) > 1:
        raise ValueError(f'{label} berbeda-beda di baris dengan No. Faktur yang sama: {", ".join(sorted(vals))}')
    return next((r.get(field) for _, r in rows if r.get(field) not in (None, '')), None)


def _discount(rec):
    raw = rec.get('diskon')
    if raw in (None, ''):
        return 0.0
    if '+' in str(raw):
        from routes.sales import _parse_discount_tiers
        return _parse_discount_tiers(raw)[0]
    d = parse_amount(raw, allow_negative=False)
    if d > 100:
        raise ValueError('Diskon % tidak boleh lebih dari 100')
    return d


def _due(rec_due, invoice_date, days):
    if rec_due not in (None, ''):
        return parse_date(rec_due)
    return invoice_date + timedelta(days=int(days)) if days else None


def _terms(days):
    return f'Net {int(days)}' if days else 'C.O.D'


def _prefix_notes(key, notes):
    parts = []
    if key and not key.startswith('__row'):
        parts.append(f'No. asal: {key}')
    if notes:
        parts.append(notes)
    return ' | '.join(parts) or None


class SalesInvoiceImport(ImportKind):
    key = 'sales_invoice'
    label = 'Faktur Penjualan'
    description = 'Faktur penjualan ke pelanggan beserta jurnal piutang dan penjualan, sama seperti input manual.'
    view_permission = 'finance.view'
    create_permission = 'finance.create'
    group_field = 'no_faktur'
    columns = [
        Col('no_faktur', 'No. Faktur', aliases=['no faktur', 'nomor faktur']),
        Col('tanggal', 'Tanggal', required=True, aliases=['tgl']),
        Col('pelanggan', 'Pelanggan', required=True, aliases=['customer', 'kode pelanggan']),
        Col('jatuh_tempo', 'Jatuh Tempo', aliases=['jatuh tempo', 'due date']),
        Col('kode_barang', 'Kode Barang', aliases=['kode', 'sku']),
        Col('deskripsi', 'Deskripsi', aliases=['nama barang', 'keterangan barang']),
        Col('qty', 'Qty', required=True, aliases=['kuantitas', 'jumlah']),
        Col('satuan', 'Satuan'),
        Col('harga', 'Harga Satuan', required=True, aliases=['harga']),
        Col('diskon', 'Diskon %', aliases=['diskon', 'diskon bertingkat']),
        Col('kode_pajak', 'Kode Pajak', aliases=['pajak', 'ppn']),
        Col('keterangan', 'Keterangan', aliases=['catatan']),
        Col('no_so', 'No. Pesanan', aliases=['no. so', 'no so', 'no. pesanan penjualan']),
    ]
    sample_rows = [
        ['INV-A1', '2026-10-01', 'CUST-001', '', '4021802002', '', 100, 'PCK', 25000, 0, '', 'Contoh dua barang satu faktur', ''],
        ['INV-A1', '2026-10-01', 'CUST-001', '', '4021301002', '', 20, 'ROL', 300000, 5, 'Y', '', ''],
        ['', '2026-10-02', 'PT Contoh Pelanggan', '2026-11-01', '', 'Jasa pengiriman', 1, '', 750000, '', '', 'Baris tanpa No. Faktur = faktur sendiri', ''],
    ]
    guide = [
        'Pelanggan: kode atau nama persis dari master pelanggan.',
        'Kode Barang: kode di master produk. Kosongkan dan isi Deskripsi untuk jasa/biaya tanpa barang.',
        'Jatuh Tempo: kosong = tanggal faktur + syarat bayar pelanggan.',
        'Kode Pajak: Y/A/B/L (PPN 11% / 1,1% / 1,2% / 12%). Kosong = ikut pajak di master barang. Faktur tanpa barang dan tanpa kode pajak tidak kena PPN.',
        'Nomor faktur sistem dibuat otomatis (INV-...). No. Faktur di file hanya untuk menggabungkan baris dan dicatat di Keterangan faktur.',
        'No. Pesanan: nomor Sales Order (opsional), harus milik pelanggan yang sama.',
        'Periode yang sudah ditutup (period-close) akan menolak faktur tersebut.',
    ]

    def build(self, key, rows):
        first = rows[0][1]
        customer = _find_party(Customer, _same(rows, 'pelanggan', 'Pelanggan'), 'Pelanggan')
        inv_date = parse_date(_same(rows, 'tanggal', 'Tanggal'))
        so_id = None
        no_so = text(_same(rows, 'no_so', 'No. Pesanan'))
        if no_so:
            so = SalesOrder.query.filter_by(order_number=no_so).first()
            if not so:
                raise ValueError(f'Sales Order "{no_so}" tidak ditemukan')
            if so.customer_id != customer.id:
                raise ValueError(f'Sales Order {no_so} bukan milik pelanggan {customer.company_name}')
            so_id = so.id
        items, total = [], 0.0
        for n, rec in rows:
            try:
                qty = parse_amount(rec.get('qty'), allow_negative=False)
                if qty <= 0:
                    raise ValueError('Qty harus lebih dari 0')
                price = parse_amount(rec.get('harga'), allow_negative=False)
                disc = _discount(rec)
                code = text(rec.get('kode_barang'))
                product = None
                if code:
                    product = Product.query.filter(db.func.lower(Product.code) == code.lower()).first()
                    if not product:
                        raise ValueError(f'Kode barang "{code}" tidak ditemukan di master produk')
                desc = text(rec.get('deskripsi')) or (product.name if product else None)
                if not desc:
                    raise ValueError('Isi Kode Barang atau Deskripsi')
                item = {'description': desc, 'quantity': qty, 'unit_price': price, 'discount_percent': disc,
                        'uom': text(rec.get('satuan'), 20) or (product.primary_uom if product else None)}
                if product:
                    item['product_id'] = product.id
                net = qty * price * (1 - disc / 100)
                pc = text(rec.get('kode_pajak'))
                if pc and pc.lower() not in NO_TAX:
                    rate = ppn_rate_for_code(pc)
                    if rate is None:
                        raise ValueError(f'Kode pajak "{pc}" tidak dikenal (pakai Y, A, B, atau L)')
                    item['tax_amount'] = round(net * rate / 100, 2)
                    total += net + item['tax_amount']
                else:
                    rate = resolve_item_tax_percent(0, product_id=product.id) if (product and not pc) else 0
                    total += net + (net * rate / 100 if rate else 0)
                items.append(item)
            except ValueError as e:
                raise ValueError(f'baris {n}: {e}')
        due = _due(_same(rows, 'jatuh_tempo', 'Jatuh Tempo'), inv_date, customer.payment_terms_days)
        data = {
            'invoice_type': 'sales', 'invoice_date': inv_date.isoformat(), 'customer_id': customer.id,
            'due_date': due.isoformat() if due else None,
            'payment_terms': _terms(customer.payment_terms_days), 'sales_order_id': so_id, 'items': items,
            'notes': _prefix_notes(key, text(first.get('keterangan'))),
        }
        return data, {'date': inv_date.isoformat(), 'party': customer.company_name, 'total': round(total, 2)}

    def save(self, data, user_id):
        from routes.finance import create_invoice_core
        try:
            out = create_invoice_core(data, user_id, commit=False)
        except InvoiceInputError as e:
            raise ValueError(str(e))
        return {'number': out['invoice_number']}


class PurchaseInvoiceImport(ImportKind):
    key = 'purchase_invoice'
    label = 'Faktur Pembelian'
    description = 'Faktur dari pemasok yang menagih Purchase Order, lengkap dengan jurnal hutang dan pencocokan 3 arah.'
    view_permission = 'purchasing.view'
    create_permission = 'purchasing.create'
    group_field = 'no_faktur'
    columns = [
        Col('no_faktur', 'No. Faktur Pemasok', aliases=['no faktur pemasok', 'no. faktur', 'no faktur', 'nomor faktur']),
        Col('tanggal', 'Tanggal', required=True, aliases=['tgl']),
        Col('tanggal_faktur', 'Tanggal Faktur Pemasok', aliases=['tgl faktur pemasok']),
        Col('no_po', 'No. PO', required=True, aliases=['no po', 'nomor po', 'purchase order']),
        Col('jatuh_tempo', 'Jatuh Tempo', aliases=['jatuh tempo', 'due date']),
        Col('kode_barang', 'Kode Barang', required=True, aliases=['kode', 'kode bahan']),
        Col('qty', 'Qty', required=True, aliases=['kuantitas', 'jumlah']),
        Col('harga', 'Harga Satuan', aliases=['harga']),
        Col('kode_pajak', 'Kode Pajak', aliases=['pajak', 'ppn']),
        Col('keterangan', 'Keterangan', aliases=['catatan']),
    ]
    sample_rows = [
        ['SUP-INV-001', '2026-10-05', '2026-10-04', 'PO-202610-00001', '', '2012500005', 10, 250000, 'Y', 'Contoh dua barang satu faktur'],
        ['SUP-INV-001', '2026-10-05', '2026-10-04', 'PO-202610-00001', '', '2011600005', 5, '', '', 'Harga kosong = harga di PO'],
    ]
    guide = [
        'Setiap baris harus menunjuk ke barang di sebuah Purchase Order (sama seperti form faktur pembelian). Pemasok mengikuti PO.',
        'No. PO: nomor PO yang ditagih. Satu faktur hanya boleh untuk satu PO.',
        'Kode Barang: kode produk atau bahan yang ada di baris PO. Qty tidak boleh melebihi sisa yang belum ditagih di PO.',
        'Harga Satuan: kosong = harga di PO. Selisih harga memicu pencocokan 3 arah (faktur bisa ditahan untuk ditinjau).',
        'Kode Pajak: Y/A/B/L = PPN, TIDAK = tanpa PPN, kosong = ikut master barang.',
        'Jatuh Tempo: kosong = tanggal faktur + syarat bayar pemasok. Nomor faktur sistem (PI-...) dibuat otomatis.',
        'Faktur dari PO bermata uang asing mengikuti kurs yang sudah dikunci di PO.',
    ]

    def build(self, key, rows):
        po_no = text(_same(rows, 'no_po', 'No. PO'))
        po = PurchaseOrder.query.filter_by(po_number=po_no).first() if po_no else None
        if not po:
            raise ValueError(f'PO "{po_no}" tidak ditemukan')
        if po.status in ('cancelled', 'rejected'):
            raise ValueError(f'PO {po_no} berstatus {po.status}, tidak bisa ditagih')
        inv_date = parse_date(_same(rows, 'tanggal', 'Tanggal'))
        sup_date = _same(rows, 'tanggal_faktur', 'Tanggal Faktur Pemasok')
        supplier = db.session.get(Supplier, po.supplier_id)
        po_items = list(po.items)
        used = {}
        items, total = [], 0.0
        for n, rec in rows:
            try:
                code = text(rec.get('kode_barang'))
                if not code:
                    raise ValueError('Kode Barang wajib diisi')
                qty = parse_amount(rec.get('qty'), allow_negative=False)
                if qty <= 0:
                    raise ValueError('Qty harus lebih dari 0')
                cands = []
                for pi in po_items:
                    ref = pi.material.code if pi.material else (pi.product.code if pi.product else None)
                    if ref and ref.lower() == code.lower():
                        cands.append(pi)
                if not cands:
                    raise ValueError(f'Barang "{code}" tidak ada di PO {po_no}')
                pick = next((pi for pi in cands if float(pi.quantity) - float(pi.quantity_invoiced or 0) - used.get(pi.id, 0) >= qty - 0.0001), None)
                if not pick:
                    left = max(float(pi.quantity) - float(pi.quantity_invoiced or 0) - used.get(pi.id, 0) for pi in cands)
                    raise ValueError(f'Qty {qty:g} melebihi sisa yang belum ditagih di PO ({max(left, 0):g}) untuk "{code}"')
                used[pick.id] = used.get(pick.id, 0) + qty
                price = parse_amount(rec.get('harga'), allow_negative=False) if rec.get('harga') not in (None, '') else float(pick.unit_price)
                item = {'po_item_id': pick.id, 'quantity': qty, 'unit_price': price, 'uom': pick.uom}
                pc = text(rec.get('kode_pajak'))
                if pc:
                    if pc.lower() in NO_TAX:
                        item['ppn_code'] = None
                    elif ppn_rate_for_code(pc) is None:
                        raise ValueError(f'Kode pajak "{pc}" tidak dikenal (pakai Y, A, B, L, atau TIDAK)')
                    else:
                        item['ppn_code'] = pc.upper()
                rate = (ppn_rate_for_code(item['ppn_code']) or 0) if 'ppn_code' in item else (
                    resolve_item_tax_percent(0, product_id=pick.product_id, material_id=pick.material_id) or 0)
                total += qty * price * (1 + rate / 100)
                items.append(item)
            except ValueError as e:
                raise ValueError(f'baris {n}: {e}')
        due = _due(_same(rows, 'jatuh_tempo', 'Jatuh Tempo'), inv_date, supplier.payment_terms_days if supplier else None)
        data = {
            'po_id': po.id, 'invoice_date': inv_date.isoformat(), 'due_date': due.isoformat() if due else None,
            'supplier_invoice_number': text(key, 100) if not key.startswith('__row') else None,
            'supplier_invoice_date': parse_date(sup_date).isoformat() if sup_date not in (None, '') else None,
            'payment_terms': _terms(supplier.payment_terms_days if supplier else None),
            'notes': text(rows[0][1].get('keterangan')), 'items': items,
        }
        return data, {'date': inv_date.isoformat(), 'party': supplier.company_name if supplier else '', 'total': round(total, 2)}

    def save(self, data, user_id):
        from routes.purchase_invoice import create_purchase_invoice_core
        try:
            out = create_purchase_invoice_core(data, user_id, commit=False)
        except InvoiceInputError as e:
            raise ValueError(str(e))
        return {'number': out['invoice']['invoice_number']}


register(SalesInvoiceImport())
register(PurchaseInvoiceImport())
