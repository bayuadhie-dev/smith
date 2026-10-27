"""Pencarian transaksi Finance (gaya Accurate Online).

- Kata kunci dipisah `%`: handmade%skirt menampilkan data yang memuat SEMUA kata, urutan bebas, tidak peka huruf besar-kecil.
- Filter: jenis dokumen, rentang tanggal, status, rentang nilai.
"""
from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import and_, func, or_

from models import db
from models.finance import Account, AccountingEntry, CreditMemo, Invoice, Payment
from utils.auth_decorators import require_permission

finance_search_bp = Blueprint('finance_search', __name__)

TYPE_LABELS = {
    'sales_invoice': 'Faktur Penjualan',
    'purchase_invoice': 'Faktur Pembelian',
    'receipt': 'Penerimaan',
    'disbursement': 'Pembayaran',
    'credit_memo': 'Nota Kredit',
    'journal': 'Jurnal',
    'account': 'Akun Perkiraan',
}


def split_terms(q):
    """'a%b c' -> ['a', 'b c']. Spasi tetap bagian dari kata kunci; % memisahkan kata kunci."""
    return [t.strip() for t in (q or '').split('%') if t.strip()]


def _like(term):
    esc = term.replace('\\', '\\\\').replace('_', '\\_')
    return f'%{esc}%'


def _text_filter(columns, terms):
    """Semua kata kunci harus ditemukan; tiap kata kunci boleh ada di kolom mana pun."""
    return and_(*[or_(*[func.lower(func.coalesce(c, '')).like(_like(t.lower()), escape='\\') for c in columns]) for t in terms]) if terms else None


def _parse_date(v):
    try:
        return date.fromisoformat(v) if v else None
    except ValueError:
        raise ValueError('Format tanggal harus YYYY-MM-DD')


def _num(v):
    try:
        return float(v) if v not in (None, '') else None
    except ValueError:
        raise ValueError('Nilai harus berupa angka')


def _d(v):
    return v.isoformat() if v else None


@finance_search_bp.route('', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def search():
    try:
        terms = split_terms(request.args.get('q'))
        df, dt = _parse_date(request.args.get('date_from')), _parse_date(request.args.get('date_to'))
        amin, amax = _num(request.args.get('amount_min')), _num(request.args.get('amount_max'))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    status = (request.args.get('status') or '').strip().lower()
    try:
        limit = max(1, min(int(request.args.get('limit', 25)), 100))
    except ValueError:
        limit = 25
    wanted = [t for t in (request.args.get('types') or '').split(',') if t in TYPE_LABELS] or list(TYPE_LABELS)
    if not terms and not (df or dt or status or amin is not None or amax is not None):
        return jsonify({'error': 'Isi kata kunci atau minimal satu filter'}), 400

    from models.purchasing import Supplier
    from models.sales import Customer
    results, counts = [], {}

    def amount_filter(col, q):
        if amin is not None:
            q = q.filter(func.abs(col) >= amin)
        if amax is not None:
            q = q.filter(func.abs(col) <= amax)
        return q

    def take(key, q, order_col, build):
        counts[key] = q.count()
        for row in q.order_by(order_col.desc()).limit(limit).all():
            results.append({'type': key, 'type_label': TYPE_LABELS[key], **build(row)})

    for key, inv_type in (('sales_invoice', 'sales'), ('purchase_invoice', 'purchase')):
        if key not in wanted:
            continue
        q = (db.session.query(Invoice, Customer.company_name, Supplier.company_name)
             .outerjoin(Customer, Invoice.customer_id == Customer.id)
             .outerjoin(Supplier, Invoice.supplier_id == Supplier.id)
             .filter(Invoice.invoice_type == inv_type))
        f = _text_filter([Invoice.invoice_number, Invoice.supplier_invoice_number, Invoice.notes, Invoice.internal_notes,
                          Customer.company_name, Supplier.company_name], terms)
        if f is not None:
            q = q.filter(f)
        if df: q = q.filter(Invoice.invoice_date >= df)
        if dt: q = q.filter(Invoice.invoice_date <= dt)
        if status: q = q.filter(func.lower(Invoice.status) == status)
        q = amount_filter(Invoice.total_amount, q)
        base = '/app/finance/invoices/' if inv_type == 'sales' else '/app/purchasing/invoices/'
        take(key, q, Invoice.invoice_date, lambda r, base=base: {
            'id': r[0].id, 'number': r[0].invoice_number, 'date': _d(r[0].invoice_date), 'party': r[1] or r[2],
            'description': r[0].notes or r[0].supplier_invoice_number or '', 'amount': float(r[0].total_amount or 0),
            'status': r[0].status, 'url': f'{base}{r[0].id}'})

    for key, ptype in (('receipt', 'receipt'), ('disbursement', 'payment')):
        if key not in wanted:
            continue
        q = (db.session.query(Payment, Customer.company_name, Supplier.company_name)
             .outerjoin(Customer, Payment.customer_id == Customer.id)
             .outerjoin(Supplier, Payment.supplier_id == Supplier.id)
             .filter(Payment.payment_type == ptype))
        f = _text_filter([Payment.payment_number, Payment.reference_number, Payment.paid_to, Payment.notes,
                          Customer.company_name, Supplier.company_name], terms)
        if f is not None:
            q = q.filter(f)
        if df: q = q.filter(Payment.payment_date >= df)
        if dt: q = q.filter(Payment.payment_date <= dt)
        if status: q = q.filter(func.lower(Payment.status) == status)
        q = amount_filter(Payment.amount, q)
        take(key, q, Payment.payment_date, lambda r: {
            'id': r[0].id, 'number': r[0].payment_number, 'date': _d(r[0].payment_date), 'party': r[1] or r[2] or r[0].paid_to,
            'description': r[0].notes or r[0].reference_number or '', 'amount': float(r[0].amount or 0),
            'status': r[0].status, 'url': f'/app/finance/payments/{r[0].id}'})

    if 'credit_memo' in wanted:
        q = db.session.query(CreditMemo, Customer.company_name).outerjoin(Customer, CreditMemo.customer_id == Customer.id)
        f = _text_filter([CreditMemo.memo_number, CreditMemo.notes, Customer.company_name], terms)
        if f is not None:
            q = q.filter(f)
        if df: q = q.filter(CreditMemo.memo_date >= df)
        if dt: q = q.filter(CreditMemo.memo_date <= dt)
        if status:
            q = q.filter(false_if(status))
        q = amount_filter(CreditMemo.amount, q)
        take('credit_memo', q, CreditMemo.memo_date, lambda r: {
            'id': r[0].id, 'number': r[0].memo_number, 'date': _d(r[0].memo_date), 'party': r[1],
            'description': r[0].notes or '', 'amount': float(r[0].amount or 0), 'status': None,
            'url': '/app/finance/credit-memos'})

    if 'journal' in wanted:
        q = AccountingEntry.query.filter(AccountingEntry.status == 'posted')
        f = _text_filter([AccountingEntry.entry_number, AccountingEntry.reference_number, AccountingEntry.description,
                          AccountingEntry.account_code, AccountingEntry.account_name], terms)
        if f is not None:
            q = q.filter(f)
        if df: q = q.filter(AccountingEntry.entry_date >= df)
        if dt: q = q.filter(AccountingEntry.entry_date <= dt)
        if amin is not None: q = q.filter(func.abs(AccountingEntry.debit_amount + AccountingEntry.credit_amount) >= amin)
        if amax is not None: q = q.filter(func.abs(AccountingEntry.debit_amount + AccountingEntry.credit_amount) <= amax)
        if not status or status == 'posted':
            counts['journal'] = q.count()
            for e in q.order_by(AccountingEntry.entry_date.desc(), AccountingEntry.id.desc()).limit(limit).all():
                results.append({'type': 'journal', 'type_label': TYPE_LABELS['journal'], 'id': e.id, 'number': e.entry_number,
                                'date': _d(e.entry_date), 'party': f'{e.account_code} {e.account_name}',
                                'description': e.description or '', 'amount': float((e.debit_amount or 0) or (e.credit_amount or 0)),
                                'side': 'D' if (e.debit_amount or 0) else 'K', 'status': e.status,
                                'url': f'/app/finance/reports/ledger/{e.account_id}'})

    if 'account' in wanted and not (df or dt or status or amin is not None or amax is not None):
        q = Account.query
        f = _text_filter([Account.account_code, Account.account_name, Account.description], terms)
        if f is not None:
            q = q.filter(f)
        take('account', q, Account.account_code, lambda a: {
            'id': a.id, 'number': a.account_code, 'date': None, 'party': a.account_name, 'description': a.description or '',
            'amount': None, 'status': 'aktif' if a.is_active else 'nonaktif', 'url': f'/app/finance/reports/ledger/{a.id}'})

    results.sort(key=lambda r: (r['date'] or ''), reverse=True)
    return jsonify({'results': results, 'counts': counts, 'total': sum(counts.values()), 'limit': limit, 'terms': terms}), 200


def false_if(_status):
    return db.literal(False)
