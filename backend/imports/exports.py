"""Ekspor data Pusat Impor & Ekspor. Tiap fungsi mengembalikan baris-baris dengan urutan kolom yang SAMA dengan template impor
jenis itu, jadi file hasil ekspor bisa diedit lalu diimpor kembali. Fungsi menerima (date_from, date_to) dalam `datetime.date`
(boleh None); jenis master tidak memakai rentang tanggal."""
from datetime import date

from sqlalchemy.orm import joinedload, selectinload

from models import Inventory, db
from models.finance import Account, AccountingEntry, Invoice, Payment
from utils.tax_helpers import PPN_RATE_MAP

EXPORTERS = {}      # key -> (fungsi, memakai_rentang_tanggal)
MAX_EXPORT_ROWS = 50000


def exporter(key, by_date=True):
    def deco(fn):
        EXPORTERS[key] = (fn, by_date)
        return fn
    return deco


def _d(v):
    return v.isoformat() if v else ''


def _f(v):
    return float(v) if v is not None else ''


def _tax_code(percent):
    if not percent:
        return ''
    for code, rate in PPN_RATE_MAP.items():
        if abs(float(percent) - rate) < 0.01:
            return code
    return ''


def _discount(item):
    tiers = getattr(item, 'discount_tiers', None)
    if tiers:
        return tiers
    return _f(item.discount_percent) if item.discount_percent else ''


def _between(col, date_from, date_to, query):
    # func.date: kolom bertipe DateTime (pembayaran, faktur) berisi jam, jadi transaksi di hari terakhir rentang tidak boleh terlewat
    if date_from:
        query = query.filter(db.func.date(col) >= date_from.isoformat())
    if date_to:
        query = query.filter(db.func.date(col) <= date_to.isoformat())
    return query


def _item_code(item):
    if getattr(item, 'product', None):
        return item.product.code
    if getattr(item, 'material', None):
        return item.material.code
    return ''


def _acc_codes():
    return {a.id: a.account_code for a in Account.query.all()}


# ---------------------------------------------------------------- penjualan / pembelian / pengiriman
@exporter('sales_order')
def sales_orders(date_from, date_to):
    from models.sales import SalesOrder
    q = SalesOrder.query.options(joinedload(SalesOrder.customer), selectinload(SalesOrder.items)).filter(SalesOrder.status != 'cancelled')
    rows = []
    for o in _between(SalesOrder.order_date, date_from, date_to, q).order_by(SalesOrder.order_date, SalesOrder.order_number):
        for i in o.items:
            rows.append([o.order_number, _d(o.order_date), o.customer.code if o.customer else '', _d(o.required_date),
                         o.customer_po_number or '', i.product.code if i.product else '', _f(i.quantity), i.uom or '',
                         _f(i.unit_price), _discount(i), _tax_code(i.tax_percent), i.description or '', o.delivery_address or ''])
    return rows


@exporter('purchase_order')
def purchase_orders(date_from, date_to):
    from models.purchasing import PurchaseOrder
    q = PurchaseOrder.query.options(joinedload(PurchaseOrder.supplier), selectinload(PurchaseOrder.items)).filter(PurchaseOrder.status != 'cancelled')
    rows = []
    for o in _between(PurchaseOrder.order_date, date_from, date_to, q).order_by(PurchaseOrder.order_date, PurchaseOrder.po_number):
        for i in o.items:
            sched = ';'.join(f'{s.expected_date.isoformat()}:{float(s.quantity):g}' for s in (i.schedules or []))
            rows.append([o.po_number, _d(o.order_date), o.supplier.code if o.supplier else '', _d(o.required_date), o.currency or 'IDR',
                         _item_code(i), _f(i.quantity), i.uom or '', _f(i.unit_price), sched, i.description or ''])
    return rows


@exporter('purchase_requisition')
def purchase_requisitions(date_from, date_to):
    from models.purchasing import PurchaseRequisition, Supplier
    q = PurchaseRequisition.query.options(selectinload(PurchaseRequisition.items)).filter(PurchaseRequisition.status != 'cancelled')
    suppliers = {s_.id: s_.code for s_ in Supplier.query.with_entities(Supplier.id, Supplier.code)}
    rows = []
    for pr in _between(PurchaseRequisition.request_date, date_from, date_to, q).order_by(PurchaseRequisition.request_date, PurchaseRequisition.pr_number):
        for i in pr.items:
            rows.append([pr.pr_number, _d(pr.request_date), _d(pr.required_date), pr.department or '', pr.priority or '', pr.purpose or '',
                         i.item_code or _item_code(i), _f(i.quantity), i.uom or '', _f(i.estimated_unit_price) if i.estimated_unit_price else '',
                         suppliers.get(i.preferred_supplier_id, ''), i.notes or ''])
    return rows


@exporter('shipping_order')
def shipping_orders(date_from, date_to):
    from models.shipping import ShippingOrder
    q = ShippingOrder.query.options(selectinload(ShippingOrder.items)).filter(ShippingOrder.status != 'cancelled')
    rows = []
    for s in _between(ShippingOrder.shipping_date, date_from, date_to, q).order_by(ShippingOrder.shipping_date, ShippingOrder.shipping_number):
        per_product = {}
        for it in s.items:
            g = per_product.setdefault(it.product_id, [it, 0.0])
            g[1] += float(it.quantity)
        for it, qty in per_product.values():
            rows.append([s.shipping_number, s.sales_order.order_number if s.sales_order else '', _d(s.shipping_date),
                         it.product.code if it.product else '', qty, it.uom or '', s.driver_name or '', s.vehicle_number or '',
                         s.shipping_address or '', s.notes or ''])
    return rows


# ---------------------------------------------------------------- faktur
@exporter('sales_invoice')
def sales_invoices(date_from, date_to):
    from models.finance import InvoiceItem  # noqa: F401
    q = Invoice.query.options(selectinload(Invoice.items)).filter(Invoice.invoice_type == 'sales', Invoice.status != 'cancelled')
    from models.sales import Customer, SalesOrder
    customers = {c.id: c.code for c in Customer.query.with_entities(Customer.id, Customer.code)}
    orders = {o.id: o.order_number for o in SalesOrder.query.with_entities(SalesOrder.id, SalesOrder.order_number)}
    rows = []
    for inv in _between(Invoice.invoice_date, date_from, date_to, q).order_by(Invoice.invoice_date, Invoice.invoice_number):
        for i in inv.items:
            rows.append([inv.invoice_number, _d(inv.invoice_date), customers.get(inv.customer_id, ''), _d(inv.due_date), _item_code(i),
                         i.description or '', _f(i.quantity), i.uom or '', _f(i.unit_price), _discount(i), _tax_code(i.tax_percent),
                         i.notes or inv.notes or '', orders.get(inv.sales_order_id, '')])
    return rows


@exporter('purchase_invoice')
def purchase_invoices(date_from, date_to):
    from models.purchasing import PurchaseOrder
    q = Invoice.query.options(selectinload(Invoice.items)).filter(Invoice.invoice_type == 'purchase', Invoice.status != 'cancelled')
    pos = {o.id: o.po_number for o in PurchaseOrder.query.with_entities(PurchaseOrder.id, PurchaseOrder.po_number)}
    rows = []
    for inv in _between(Invoice.invoice_date, date_from, date_to, q).order_by(Invoice.invoice_date, Invoice.invoice_number):
        for i in inv.items:
            rows.append([inv.supplier_invoice_number or inv.invoice_number, _d(inv.invoice_date), _d(inv.supplier_invoice_date),
                         pos.get(inv.purchase_order_id, ''), _d(inv.due_date), _item_code(i), _f(i.quantity), _f(i.unit_price),
                         _tax_code(i.tax_percent), i.notes or inv.notes or ''])
    return rows


# ---------------------------------------------------------------- kas & bank
def _payment_rows(ptype, source, date_from, date_to):
    codes = _acc_codes()
    q = Payment.query.options(selectinload(Payment.allocations), selectinload(Payment.lines)).filter(
        Payment.payment_type == ptype, Payment.status != 'cancelled')
    rows = []
    for p in _between(Payment.payment_date, date_from, date_to, q).order_by(Payment.payment_date, Payment.payment_number):
        bank = codes.get(p.bank_account_id, '')
        d = p.payment_date.date() if hasattr(p.payment_date, 'date') else p.payment_date
        party = ''
        if p.customer_id or p.supplier_id:
            party = (p.customer.company_name if getattr(p, 'customer', None) else '') or (p.supplier.company_name if getattr(p, 'supplier', None) else '')
        if source == 'invoice':
            allocs = list(p.allocations)
            if not allocs and p.invoice:
                rows.append([_d(d), p.payment_number, bank, p.invoice.invoice_number, _f(p.amount), p.notes or '', p.reference_number or ''])
            for a in allocs:
                rows.append([_d(d), p.payment_number, bank, a.invoice.invoice_number if a.invoice else '', _f(a.amount), p.notes or '',
                             p.reference_number or ''])
        else:
            if p.allocations or (p.invoice_id and not p.lines):
                continue
            lines = list(p.lines)
            if not lines and p.contra_account_id:
                rows.append([_d(d), p.payment_number, bank, codes.get(p.contra_account_id, ''), _f(p.amount), p.paid_to or party,
                             p.notes or '', p.reference_number or ''])
            for l in lines:
                rows.append([_d(d), p.payment_number, bank, codes.get(l.account_id, ''), _f(l.amount), p.paid_to or party,
                             l.description or p.notes or '', p.reference_number or ''])
    return rows


for _t in ('receipt', 'payment'):
    for _s in ('kas', 'invoice'):
        exporter(f'{_t}_{_s}')(lambda a, b, _t=_t, _s=_s: _payment_rows(_t, _s, a, b))


# ---------------------------------------------------------------- jurnal & stok
@exporter('manual_journal')
def journal(date_from, date_to):
    q = AccountingEntry.query.filter(AccountingEntry.status == 'posted')
    rows = []
    for e in _between(AccountingEntry.entry_date, date_from, date_to, q).order_by(AccountingEntry.entry_date, AccountingEntry.entry_number):
        number = e.entry_number.rsplit('-', 1)[0] if e.entry_number else ''
        rows.append([number, _d(e.entry_date), e.account_code or '', _f(e.debit_amount) if e.debit_amount else '',
                     _f(e.credit_amount) if e.credit_amount else '', e.description or '', e.reference_number or ''])
    return rows


@exporter('opening_balance')
def opening_balance(date_from, date_to):
    q = AccountingEntry.query.filter(AccountingEntry.reference_type == 'opening_balance', AccountingEntry.status == 'posted')
    rows = []
    for e in _between(AccountingEntry.entry_date, date_from, date_to, q).order_by(AccountingEntry.entry_date, AccountingEntry.account_code):
        rows.append([_d(e.entry_date), e.account_code or '', _f(e.debit_amount) if e.debit_amount else '',
                     _f(e.credit_amount) if e.credit_amount else '', e.description or ''])
    return rows


@exporter('opening_stock')
def stock(date_from, date_to):
    q = Inventory.query.options(joinedload(Inventory.product), joinedload(Inventory.material), joinedload(Inventory.location)).filter(
        Inventory.is_active.is_(True), Inventory.quantity_on_hand != 0)
    if date_from:
        q = q.filter(db.func.date(Inventory.created_at) >= date_from)
    if date_to:
        q = q.filter(db.func.date(Inventory.created_at) <= date_to)
    rows = []
    for inv in q.order_by(Inventory.created_at, Inventory.id):
        cost = (inv.product.cost if inv.product else (inv.material.cost_per_unit if inv.material else None))
        code = inv.product.code if inv.product else (inv.material.code if inv.material else '')
        rows.append([_d(inv.created_at.date() if inv.created_at else None), code, inv.location.location_code if inv.location else '',
                     inv.batch_number or '', _f(inv.quantity_on_hand), _f(cost) if cost else '', ''])
    return rows


# ---------------------------------------------------------------- master (tanpa rentang tanggal)
@exporter('supplier', by_date=False)
def suppliers(_a, _b):
    from models.purchasing import Supplier
    codes = _acc_codes()
    return [[s.code, s.company_name, s.supplier_type or '', s.contact_person or '', s.phone or '', s.mobile or '', s.email or '',
             s.fax or '', s.website or '', 'IDR', f'Net {s.payment_terms_days}' if s.payment_terms_days else '', s.address or '',
             s.city or '', s.state or '', s.country or '', s.postal_code or '', s.notes or '', codes.get(s.akun_hutang_usaha_id, ''),
             s.tax_id or ''] for s in Supplier.query.order_by(Supplier.code)]


@exporter('customer', by_date=False)
def customers(_a, _b):
    from models.sales import Customer
    codes = _acc_codes()
    return [[c.code, c.company_name, c.customer_type or '', c.contact_person or '', c.phone or '', c.mobile or '', c.email or '',
             c.fax or '', c.website or '', 'IDR', f'Net {c.payment_terms_days}' if c.payment_terms_days else '', c.billing_address or '',
             c.shipping_address or '', c.billing_city or '', c.billing_state or '', c.billing_country or '', c.billing_postal_code or '',
             c.notes or '', codes.get(c.akun_piutang_id, ''), c.tax_id or '', _f(c.credit_limit) if c.credit_limit else '']
            for c in Customer.query.order_by(Customer.code)]


@exporter('asset', by_date=False)
def assets(_a, _b):
    import json
    from models.asset_management import Asset
    rows = []
    for a in Asset.query.order_by(Asset.asset_code):
        try:
            sp = json.loads(a.specifications) if a.specifications else {}
        except (TypeError, ValueError):
            sp = {}
        years = a.useful_life_years or 0
        rows.append([a.asset_code, a.asset_name, (a.category or '').upper(), _d(a.purchase_date), _d(a.commissioning_date),
                     _f(a.salvage_value) if a.salvage_value else '', 'STRAIGHTLINE', sp.get('kuantitas', 1), years or '', 0 if years else '',
                     a.location or '', '', a.description or '', sp.get('kategori_pajak', ''), sp.get('akun_aset', ''),
                     sp.get('akun_akumulasi_penyusutan', ''), sp.get('akun_beban_penyusutan', ''), sp.get('kode_accurate', ''),
                     _f(a.purchase_cost), sp.get('aset_tidak_berwujud', '')])
    return rows


_TYPE_BACK = {}


def _account_type_code(acc):
    if not _TYPE_BACK:
        from utils.master_import_helpers import TYPE_MAP
        for code, (atype, _normal) in TYPE_MAP.items():
            _TYPE_BACK.setdefault(atype, code)
    return 'BANK' if acc.is_cash_bank else _TYPE_BACK.get(acc.account_type, acc.account_type or '')


@exporter('chart_of_accounts', by_date=False)
def accounts(_a, _b):
    codes = _acc_codes()
    return [[_account_type_code(a), a.account_code, a.account_name, codes.get(a.parent_id, ''), 'IDR', a.description or '']
            for a in Account.query.order_by(Account.account_code)]


def _extras(o, catatan, isi, pemasok=''):
    n = lambda v: float(v) if v is not None else ''
    return [o.barcode or '', o.brand or '', catatan or '', pemasok, n(o.min_stock_level) if o.min_stock_level else '',
            'YA' if o.require_batch else '', 'YA' if o.require_expiry else '', n(o.item_length_m), n(o.item_width_m), n(o.item_height_m),
            n(o.item_weight_kg), isi if isi else '']


@exporter('item', by_date=False)
def items(_a, _b):
    from models.product import Material, Product
    from routes.master_data_import import CATEGORY_MAP
    back = {v[1]: k for k, v in reversed(list(CATEGORY_MAP.items()))}
    codes = _acc_codes()
    gl = lambda o: [codes.get(getattr(o, f), '') for f in (  # noqa: E731
        'akun_persediaan_id', 'akun_hpp_id', 'akun_barang_terkirim_id', 'akun_pembelian_belum_tertagih_id', 'akun_penjualan_id',
        'akun_diskon_penjualan_id', 'akun_retur_penjualan_id', 'akun_retur_pembelian_id')]
    rows = []
    for p in Product.query.order_by(Product.code):
        rows.append([back.get(p.material_type, (p.material_type or '').upper()), p.code, p.name, 'INV', p.primary_uom or '',
                     p.secondary_uom or '', '', '', '', _f(p.cost) if p.cost else '', _f(p.min_order_qty) if p.min_order_qty else '',
                     p.ppn_code or '', *gl(p), p.kelompok or '', p.erp_approval or '', p.lead_time_days or '', p.self_life_days or '',
                     '' if p.is_active else 'Ya', *_extras(p, p.notes, p.packaging.packs_per_karton if p.packaging else None)])
    for m in Material.query.order_by(Material.code):
        rows.append([back.get(m.material_type, (m.material_type or '').upper()), m.code, m.name, 'INV', m.primary_uom or '',
                     m.secondary_uom or '', '', '', '', _f(m.cost_per_unit) if m.cost_per_unit else '',
                     _f(m.min_order_qty) if m.min_order_qty else '', m.ppn_code or '', *gl(m), m.kelompok or '', m.erp_approval or '',
                     m.lead_time_days or '', '', '' if m.is_active else 'Ya', *_extras(m, m.description, None, m.supplier.company_name if m.supplier else '')])
    return rows


def run_export(kind, date_from, date_to):
    fn, _by_date = EXPORTERS[kind.key]
    rows = fn(date_from, date_to)
    if len(rows) > MAX_EXPORT_ROWS:
        raise ValueError(f'Terlalu banyak data ({len(rows)} baris). Persempit rentang tanggal (maksimal {MAX_EXPORT_ROWS} baris).')
    return rows


def uses_date(key):
    return key in EXPORTERS and EXPORTERS[key][1]

