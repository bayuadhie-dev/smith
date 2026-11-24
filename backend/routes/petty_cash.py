"""Kas kecil (petty cash) HR: dana tetap, permintaan pengeluaran bernota, pengisian kembali, laporan."""
from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from models import db, User
from models.hr import Employee
from models.petty_cash import PettyCashFund, PettyCashReplenishment, PettyCashTransaction
from utils.auth_decorators import require_permission
from utils.helpers import generate_number
from utils.send_notification import send_notification

petty_cash_bp = Blueprint('petty_cash', __name__)

CATEGORIES = ['Konsumsi', 'ATK dan fotokopi', 'Transport dan ongkos kirim kecil', 'Perawatan dan kebersihan',
              'Kebutuhan karyawan', 'Kesehatan dan P3K', 'Administrasi (materai, legalisir)', 'Lainnya']
TX_STATUS = ['submitted', 'approved', 'paid', 'rejected', 'cancelled']
OPEN_REPLENISH = ('requested', 'approved')


class PCError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


@petty_cash_bp.errorhandler(PCError)
def _handle(e):
    db.session.rollback()
    return jsonify({'error': str(e)}), e.status


def _me():
    return db.session.get(User, int(get_jwt_identity()))


def _fund():
    q = PettyCashFund.query.filter_by(is_active=True)
    fid = request.args.get('fund_id', type=int)
    f = q.filter(PettyCashFund.id == fid).first() if fid else q.order_by(PettyCashFund.id).first()
    if not f:
        raise PCError('Kas kecil belum disiapkan' if not fid else 'Kas kecil tidak ditemukan', 404)
    return f


def _f(v):
    return float(v) if v is not None else 0.0


def _is_super(u):
    return bool(getattr(u, 'is_super_admin', False))


def _require_custodian(fund):
    u = _me()
    if _is_super(u) or (fund.custodian_user_id and u.id == fund.custodian_user_id):
        return u
    raise PCError('Hanya pemegang kas kecil yang boleh melakukan ini', 403)


def _require_approver(fund):
    u = _me()
    if not fund.approver_user_id and not _is_super(u):
        raise PCError('Penyetuju (Plant Manager) belum diatur di pengaturan kas kecil', 409)
    if _is_super(u) or u.id == fund.approver_user_id:
        return u
    raise PCError('Hanya penyetuju yang ditunjuk (Plant Manager) yang boleh menyetujui atau menolak', 403)


def _sum(q):
    return Decimal(str(q.scalar() or 0))


def transfers_in(fund):
    """Uang masuk ke kas kecil = Transfer Kas/Bank yang mendarat di akun kas dana ini.
    Dibuat Finance; HR hanya melihatnya."""
    from models.bank_transfer import BankTransfer
    if not fund.cash_account_id:
        return []
    return BankTransfer.query.filter(BankTransfer.to_account_id == fund.cash_account_id,
                                     BankTransfer.status == 'posted').order_by(BankTransfer.transfer_date, BankTransfer.id).all()


def _transfer_in_amount(t):
    """Nilai yang benar-benar masuk; biaya transfer yang dibebankan ke penerima mengurangi."""
    masuk = Decimal(str(t.amount_received if t.amount_received is not None else t.amount))
    if t.fee_charged_to == 'to':
        masuk -= Decimal(str(t.fee_amount or 0))
    return masuk


JENIS_MUTASI = {
    'bank_transfer': 'transfer',
    'petty_cash': 'expense',
    'payment': 'payment',
    'petty_cash_cancel': 'expense',
}


def buku_akun(fund):
    """Mutasi akun kas dana ini apa adanya dari buku besar.

    Dulu halaman ini hanya menjumlahkan transfer masuk dan nota kas kecil, jadi
    uang yang keluar lewat jalan lain tidak terlihat sama sekali. Di Fengsheng
    pemakaian 13-21 Nov 2026 dicatat Finance sebagai satu Pembayaran Kas/Bank
    (PAY-202611-00019, Rp 878.600) - buku besarnya benar, tapi halaman kas kecil
    tetap menampilkan saldo 1.878.600 padahal akuntansinya 1.000.000.

    Buku besar adalah satu-satunya tempat yang melihat semua jalan masuk-keluar,
    jadi dari situlah angkanya diambil sekarang.
    """
    from models.finance import AccountingEntry

    if not fund.cash_account_id:
        return []
    return (AccountingEntry.query
            .filter(AccountingEntry.account_id == fund.cash_account_id,
                    AccountingEntry.status == 'posted')
            .order_by(AccountingEntry.entry_date, AccountingEntry.id)
            .all())


def nota_belum_terjurnal(fund):
    """Nota yang uangnya sudah keluar tapi belum menyentuh buku besar.

    Terjadi kalau akun beban kategorinya belum disetel - notanya tetap dicatat
    (uangnya memang sudah keluar), hanya jurnalnya tertunda. Kalau baris ini
    tidak ikut dihitung, saldo kas kecil terlihat lebih besar dari yang ada.
    """
    return (PettyCashTransaction.query
            .filter(PettyCashTransaction.fund_id == fund.id,
                    PettyCashTransaction.status == 'paid',
                    PettyCashTransaction.journal_number.is_(None))
            .order_by(PettyCashTransaction.request_date, PettyCashTransaction.id)
            .all())


def _mutasi_dari_buku(fund):
    """Baris mutasi + saldo berjalan untuk tab Buku kas kecil."""
    rows = []
    if fund.opening_balance and float(fund.opening_balance) != 0:
        rows.append(((), {'date': None, 'kind': 'opening', 'number': '-', 'description': 'Saldo awal',
                          'in_amount': _f(fund.opening_balance), 'out_amount': 0.0, 'url': None}))
    for n, e in enumerate(buku_akun(fund)):
        tanggal = e.entry_date.isoformat() if e.entry_date else ''
        rows.append(((tanggal, 0, n), {
            'date': tanggal or None,
            'kind': JENIS_MUTASI.get(e.reference_type or '', 'journal'),
            'number': e.reference_number or e.entry_number,
            'description': e.description or '-',
            'in_amount': round(float(e.debit_amount or 0), 2),
            'out_amount': round(float(e.credit_amount or 0), 2),
            'url': _tautan_mutasi(e.reference_type),
        }))
    for n, t in enumerate(nota_belum_terjurnal(fund)):
        tanggal = t.request_date.isoformat()
        rows.append(((tanggal, 1, n), {
            'date': tanggal, 'kind': 'expense', 'number': t.number,
            'description': f'{t.category}: {t.purpose} ({t.requester_name}) - belum terjurnal',
            'in_amount': 0.0, 'out_amount': _f(t.amount), 'url': None, 'unposted': True,
        }))
    rows.sort(key=lambda x: x[0])
    keluar = [r for _, r in rows]
    saldo = 0.0
    for r in keluar:
        saldo += r['in_amount'] - r['out_amount']
        r['balance'] = round(saldo, 2)
    return keluar


def _tautan_mutasi(reference_type):
    return {'bank_transfer': '/app/finance/bank-transfers',
            'payment': '/app/finance/payments'}.get(reference_type or '')


def saldo_buku(fund):
    """Saldo kas kecil menurut buku besar, ditambah saldo awal dana."""
    total = Decimal(str(fund.opening_balance or 0))
    for e in buku_akun(fund):
        total += Decimal(str(e.debit_amount or 0)) - Decimal(str(e.credit_amount or 0))
    return total


def summary(fund):
    from models.bank_transfer import BankTransfer

    # Uang masuk sekarang datang dari Transfer Kas/Bank yang mendarat di akun kas
    # dana ini. Pengisian kembali lama yang ditandai "diterima" tanpa transfer
    # tetap dihitung, supaya data sebelum penyambungan tidak hilang.
    masuk_transfer = sum((_transfer_in_amount(t) for t in transfers_in(fund)), Decimal(0))
    terpaut = [r for (r,) in db.session.query(BankTransfer.petty_cash_replenishment_id).filter(
        BankTransfer.petty_cash_replenishment_id.isnot(None)).all()]
    manual_q = db.session.query(func.coalesce(func.sum(PettyCashReplenishment.amount_received), 0)).filter(
        PettyCashReplenishment.fund_id == fund.id, PettyCashReplenishment.status == 'received')
    if terpaut:
        manual_q = manual_q.filter(PettyCashReplenishment.id.notin_(terpaut))
    received = _sum(manual_q)

    paid = _sum(db.session.query(func.coalesce(func.sum(PettyCashTransaction.amount), 0)).filter(
        PettyCashTransaction.fund_id == fund.id, PettyCashTransaction.status == 'paid'))
    waiting_pm = _sum(db.session.query(func.coalesce(func.sum(PettyCashTransaction.amount), 0)).filter(
        PettyCashTransaction.fund_id == fund.id, PettyCashTransaction.status == 'submitted'))
    waiting_pay = _sum(db.session.query(func.coalesce(func.sum(PettyCashTransaction.amount), 0)).filter(
        PettyCashTransaction.fund_id == fund.id, PettyCashTransaction.status == 'approved'))
    open_req = _sum(db.session.query(func.coalesce(func.sum(PettyCashReplenishment.amount_requested), 0)).filter(
        PettyCashReplenishment.fund_id == fund.id, PettyCashReplenishment.status.in_(OPEN_REPLENISH)))
    open_rep = PettyCashReplenishment.query.filter(PettyCashReplenishment.fund_id == fund.id,
                                                   PettyCashReplenishment.status.in_(OPEN_REPLENISH)).first()
    unreplenished = _sum(db.session.query(func.coalesce(func.sum(PettyCashTransaction.amount), 0)).filter(
        PettyCashTransaction.fund_id == fund.id, PettyCashTransaction.status == 'paid',
        PettyCashTransaction.replenishment_id.is_(None)))

    # Akun kas sudah dipilih -> buku besarnya yang dipegang, karena di situlah
    # semua jalan masuk dan keluar bertemu. Belum dipilih -> hitungan lama, supaya
    # dana yang belum disambungkan ke akun tetap jalan.
    pakai_buku = bool(fund.cash_account_id)
    if pakai_buku:
        belum = sum((Decimal(str(t.amount)) for t in nota_belum_terjurnal(fund)), Decimal(0))
        balance = saldo_buku(fund) - belum
        masuk_buku = sum((Decimal(str(e.debit_amount or 0)) for e in buku_akun(fund)), Decimal(0))
        keluar_buku = sum((Decimal(str(e.credit_amount or 0)) for e in buku_akun(fund)), Decimal(0)) + belum
    else:
        balance = Decimal(str(fund.opening_balance or 0)) + masuk_transfer + received - paid
        masuk_buku, keluar_buku = masuk_transfer + received, paid
    today = date.today()
    month_end = today.day >= monthrange(today.year, today.month)[1] - 2
    reason = None
    if balance <= Decimal(fund.min_balance):
        reason = 'min_balance'
    elif month_end and unreplenished > 0:
        reason = 'month_end'
    suggested = max(Decimal(0), Decimal(fund.fixed_amount) - balance - open_req)
    return {
        'balance': _f(balance), 'fixed_amount': _f(fund.fixed_amount), 'per_txn_limit': _f(fund.per_txn_limit),
        'min_balance': _f(fund.min_balance), 'opening_balance': _f(fund.opening_balance),
        'total_paid': _f(keluar_buku), 'total_received': _f(masuk_buku), 'total_transfer_in': _f(masuk_transfer),
        'paid_from_notes': _f(paid), 'from_ledger': pakai_buku,
        'waiting_approval': _f(waiting_pm), 'waiting_payment': _f(waiting_pay), 'open_replenishment_amount': _f(open_req),
        'open_replenishment_id': open_rep.id if open_rep else None,
        'unreplenished_paid': _f(unreplenished), 'suggested_replenishment': _f(suggested),
        'needs_replenishment': bool(reason and not open_rep and suggested > 0), 'replenishment_reason': reason,
        # Saldo minus biasanya berarti transfer pengisiannya belum dicatat Finance,
        # bukan uangnya yang kurang - ditandai supaya ketahuan, bukan menolak catatan.
        'negative_balance': bool(balance < 0),
    }


def _acc_label(acc):
    return f'{acc.account_code} {acc.account_name}' if acc else None


def fund_dict(fund):
    mapped = {c.category: c.account_id for c in fund.category_accounts}
    return {
        'id': fund.id, 'code': fund.code, 'name': fund.name,
        'custodian_user_id': fund.custodian_user_id, 'custodian_name': fund.custodian.full_name if fund.custodian else None,
        'approver_user_id': fund.approver_user_id, 'approver_name': fund.approver.full_name if fund.approver else None,
        'cash_account_id': fund.cash_account_id, 'cash_account_name': _acc_label(fund.cash_account),
        'expense_account_id': fund.expense_account_id, 'expense_account_name': _acc_label(fund.expense_account),
        'approval_mode': fund.approval_mode or 'paper',
        'category_accounts': mapped,
        # Jurnal baru bisa dibuat kalau akun kas sudah ada DAN tiap kategori punya
        # akun beban (sendiri atau lewat akun bawaan).
        'gl_ready': bool(fund.cash_account_id and (fund.expense_account_id or all(c in mapped for c in CATEGORIES))),
        **summary(fund),
    }


def _name(u):
    return (getattr(u, 'full_name', None) or getattr(u, 'username', None)) if u else None


def tx_dict(t):
    return {
        'id': t.id, 'number': t.number, 'request_date': t.request_date.isoformat(), 'requester_employee_id': t.requester_employee_id,
        'requester_name': t.requester_name, 'department': t.department, 'purpose': t.purpose, 'category': t.category,
        'amount': _f(t.amount), 'receipt_number': t.receipt_number, 'status': t.status,
        'created_by': t.created_by, 'created_by_name': _name(t.creator),
        'approved_by_name': _name(t.approver), 'approved_at': t.approved_at.isoformat() if t.approved_at else None, 'approval_note': t.approval_note,
        'paid_by_name': _name(t.payer), 'paid_at': t.paid_at.isoformat() if t.paid_at else None,
        'rejected_by_name': _name(t.rejecter), 'rejected_at': t.rejected_at.isoformat() if t.rejected_at else None, 'rejection_reason': t.rejection_reason,
        'replenishment_id': t.replenishment_id, 'replenishment_number': t.replenishment.number if t.replenishment else None,
        'over_limit': bool(t.over_limit), 'journal_number': t.journal_number,
        'expense_account_name': _acc_label(t.expense_account),
        'created_at': t.created_at.isoformat() if t.created_at else None,
    }


def rep_dict(r):
    return {
        'id': r.id, 'number': r.number, 'request_date': r.request_date.isoformat(), 'reason': r.reason,
        'balance_at_request': _f(r.balance_at_request), 'amount_requested': _f(r.amount_requested), 'status': r.status, 'note': r.note,
        'created_by_name': _name(r.creator), 'approved_by_name': _name(r.approver),
        'approved_at': r.approved_at.isoformat() if r.approved_at else None,
        'received_at': r.received_at.isoformat() if r.received_at else None, 'amount_received': _f(r.amount_received) if r.amount_received is not None else None,
        'transaction_numbers': [t.number for t in r.transactions],
    }


def _parse_date(v, field):
    try:
        return datetime.fromisoformat(str(v)[:10]).date()
    except Exception:
        raise PCError(f'{field} tidak valid')


def _filtered(fund):
    q = PettyCashTransaction.query.filter(PettyCashTransaction.fund_id == fund.id)
    a = request.args
    if a.get('status'):
        q = q.filter(PettyCashTransaction.status == a['status'])
    if a.get('category'):
        q = q.filter(PettyCashTransaction.category == a['category'])
    if a.get('date_from'):
        q = q.filter(PettyCashTransaction.request_date >= _parse_date(a['date_from'], 'Tanggal awal'))
    if a.get('date_to'):
        q = q.filter(PettyCashTransaction.request_date <= _parse_date(a['date_to'], 'Tanggal akhir'))
    if a.get('q'):
        like = f"%{a['q'].strip()}%"
        q = q.filter(db.or_(PettyCashTransaction.requester_name.ilike(like), PettyCashTransaction.purpose.ilike(like),
                            PettyCashTransaction.receipt_number.ilike(like), PettyCashTransaction.number.ilike(like)))
    return q


@petty_cash_bp.route('/meta', methods=['GET'])
@jwt_required()
@require_permission('petty_cash.view')
def meta():
    return jsonify({'categories': CATEGORIES, 'statuses': TX_STATUS})


@petty_cash_bp.route('/fund', methods=['GET'])
@jwt_required()
@require_permission('petty_cash.view')
def get_fund():
    f = _fund()
    u = _me()
    d = fund_dict(f)
    d['can_approve'] = bool(_is_super(u) or (f.approver_user_id and u.id == f.approver_user_id))
    d['can_pay'] = bool(_is_super(u) or (f.custodian_user_id and u.id == f.custodian_user_id))
    return jsonify(d)


def _set_cash_account(fund, value):
    from models.finance import Account
    if not value:
        fund.cash_account_id = None
        return
    acc = db.session.get(Account, int(value))
    if not acc or not acc.is_cash_bank:
        raise PCError('Pilih akun kas/bank yang valid')
    fund.cash_account_id = acc.id


@petty_cash_bp.route('/funds', methods=['GET'])
@jwt_required()
@require_permission('petty_cash.view')
def list_funds():
    rows = PettyCashFund.query.filter_by(is_active=True).order_by(PettyCashFund.id).all()
    return jsonify({'funds': [{'id': f.id, 'code': f.code, 'name': f.name, 'balance': summary(f)['balance']} for f in rows]})


@petty_cash_bp.route('/funds', methods=['POST'])
@jwt_required()
@require_permission('petty_cash.manage')
def create_fund():
    data = request.get_json() or {}
    code = (data.get('code') or '').strip().upper()
    name = (data.get('name') or '').strip()
    if not code or not name:
        raise PCError('Kode dan nama kas kecil wajib diisi')
    if PettyCashFund.query.filter(func.upper(PettyCashFund.code) == code).first():
        raise PCError('Kode kas kecil sudah dipakai')
    f = PettyCashFund(code=code[:30], name=name[:150], fixed_amount=Decimal(str(data.get('fixed_amount') or 1000000)),
                      per_txn_limit=Decimal(str(data.get('per_txn_limit') or 500000)), min_balance=Decimal(str(data.get('min_balance') or 100000)))
    if f.min_balance >= f.fixed_amount or f.per_txn_limit > f.fixed_amount:
        raise PCError('Batas saldo minimum dan batas per transaksi harus lebih kecil dari dana tetap')
    for k in ('custodian_user_id', 'approver_user_id'):
        uid = data.get(k)
        if uid:
            if not db.session.get(User, int(uid)):
                raise PCError('Pengguna tidak ditemukan')
            setattr(f, k, int(uid))
    _set_cash_account(f, data.get('cash_account_id'))
    db.session.add(f)
    db.session.commit()
    return jsonify(fund_dict(f)), 201


@petty_cash_bp.route('/accounts', methods=['GET'])
@jwt_required()
@require_permission('petty_cash.manage')
def list_cash_accounts():
    from models.finance import Account
    rows = Account.query.filter(Account.is_cash_bank.is_(True)).order_by(Account.account_code).all()
    return jsonify({'accounts': [{'id': a.id, 'code': a.account_code, 'name': a.account_name} for a in rows]})


@petty_cash_bp.route('/fund', methods=['PUT'])
@jwt_required()
@require_permission('petty_cash.manage')
def update_fund():
    f = _fund()
    data = request.get_json() or {}
    for k in ('fixed_amount', 'per_txn_limit', 'min_balance'):
        if k in data:
            v = Decimal(str(data[k] or 0))
            if v <= 0:
                raise PCError('Nilai harus lebih dari 0')
            setattr(f, k, v)
    if Decimal(f.min_balance) >= Decimal(f.fixed_amount):
        raise PCError('Batas saldo minimum harus lebih kecil dari dana tetap')
    if Decimal(f.per_txn_limit) > Decimal(f.fixed_amount):
        raise PCError('Batas per transaksi tidak boleh lebih besar dari dana tetap')
    if 'cash_account_id' in data:
        _set_cash_account(f, data['cash_account_id'])
    if 'expense_account_id' in data:
        from models.finance import Account
        val = data['expense_account_id']
        if not val:
            f.expense_account_id = None
        else:
            acc = db.session.get(Account, int(val))
            if not acc or acc.account_type != 'expense' or acc.is_header:
                raise PCError('Akun beban bawaan harus akun beban rinci')
            f.expense_account_id = acc.id
    if 'approval_mode' in data:
        mode = (data['approval_mode'] or 'paper').lower()
        if mode not in ('paper', 'app'):
            raise PCError("Mode persetujuan hanya 'paper' (bon kertas) atau 'app' (lewat sistem)")
        f.approval_mode = mode
    if 'opening_balance' in data:
        f.opening_balance = Decimal(str(data['opening_balance'] or 0))
    for k in ('custodian_user_id', 'approver_user_id'):
        if k in data:
            uid = data[k] or None
            if uid and not db.session.get(User, int(uid)):
                raise PCError('Pengguna tidak ditemukan')
            setattr(f, k, int(uid) if uid else None)
    if data.get('name'):
        f.name = str(data['name'])[:150]
    db.session.commit()
    return jsonify(fund_dict(f))


@petty_cash_bp.route('/users', methods=['GET'])
@jwt_required()
@require_permission('petty_cash.manage')
def list_users():
    rows = User.query.filter(User.is_active.is_(True)).order_by(User.full_name).all()
    return jsonify({'users': [{'id': u.id, 'name': _name(u), 'username': u.username} for u in rows]})


@petty_cash_bp.route('/employees', methods=['GET'])
@jwt_required()
@require_permission('petty_cash.create')
def search_employees():
    q = Employee.query.filter(Employee.status == 'active')
    s = (request.args.get('q') or '').strip()
    if s:
        q = q.filter(Employee.full_name.ilike(f'%{s}%'))
    rows = q.order_by(Employee.full_name).limit(30).all()
    out = []
    for e in rows:
        dep = getattr(e, 'department', None)
        out.append({'id': e.id, 'name': e.full_name, 'department': getattr(dep, 'name', None) if dep else None})
    return jsonify({'employees': out})


@petty_cash_bp.route('/transactions', methods=['GET'])
@jwt_required()
@require_permission('petty_cash.view')
def list_transactions():
    f = _fund()
    q = _filtered(f)
    page = max(1, int(request.args.get('page', 1)))
    per = min(200, max(1, int(request.args.get('per_page', 50))))
    total = q.count()
    rows = q.order_by(PettyCashTransaction.request_date.desc(), PettyCashTransaction.id.desc()).offset((page - 1) * per).limit(per).all()
    return jsonify({'transactions': [tx_dict(t) for t in rows], 'total': total, 'page': page, 'per_page': per})


def _validate_tx(fund, data, exclude_id=None):
    purpose = (data.get('purpose') or '').strip()
    category = (data.get('category') or '').strip()
    receipt = (data.get('receipt_number') or '').strip()
    name = (data.get('requester_name') or '').strip()
    if not name and not data.get('requester_employee_id'):
        raise PCError('Isi siapa yang meminta')
    if not purpose:
        raise PCError('Isi untuk apa pengeluaran ini')
    if category not in CATEGORIES:
        raise PCError('Pilih kategori pengeluaran')
    if not receipt:
        raise PCError('Nomor nota wajib diisi')
    try:
        amount = Decimal(str(data.get('amount') or 0))
    except Exception:
        raise PCError('Jumlah tidak valid')
    if amount <= 0:
        raise PCError('Jumlah harus lebih dari 0')
    over_limit = amount > Decimal(fund.per_txn_limit)   # uangnya sudah terlanjur keluar, jadi tetap dicatat lalu ditandai
    dup = PettyCashTransaction.query.filter(PettyCashTransaction.fund_id == fund.id, func.lower(PettyCashTransaction.receipt_number) == receipt.lower(),
                                            PettyCashTransaction.status.notin_(['rejected', 'cancelled']))
    if exclude_id:
        dup = dup.filter(PettyCashTransaction.id != exclude_id)
    if dup.first():
        raise PCError(f'Nomor nota {receipt} sudah dipakai pada permintaan {dup.first().number}')
    emp = None
    if data.get('requester_employee_id'):
        emp = db.session.get(Employee, int(data['requester_employee_id']))
        if not emp:
            raise PCError('Karyawan tidak ditemukan')
        name = emp.full_name
    dept = (data.get('department') or '').strip() or None
    if emp is not None and not dept:
        d = getattr(emp, 'department', None)
        dept = getattr(d, 'name', None) if d else None
    return {'purpose': purpose, 'category': category, 'receipt_number': receipt, 'amount': amount, 'requester_name': name,
            'requester_employee_id': emp.id if emp else None, 'department': dept, 'over_limit': bool(over_limit)}


def _expense_account(fund, category):
    """Akun beban untuk satu kategori: pemetaan kategori dulu, lalu akun bawaan dana."""
    from models.petty_cash import PettyCashCategoryAccount
    row = PettyCashCategoryAccount.query.filter_by(fund_id=fund.id, category=category).first()
    if row:
        return row.account
    return fund.expense_account


def _post_expense_journal(t, user_id):
    """Dr beban kategori / Cr akun kas kecil. Kalau akunnya belum disetel, nota tetap
    tercatat tapi belum menyentuh buku besar (ditandai di halaman)."""
    fund = t.fund
    acc = _expense_account(fund, t.category)
    if not acc or not fund.cash_account_id:
        return None
    from models.approval_workflow import PendingJournalEntry
    from utils.finance_helpers import is_period_locked, post_pending_journal
    if is_period_locked(t.request_date, transaction_type='journal_entry'):
        raise PCError(f'Periode {t.request_date:%Y-%m} sudah ditutup, pengeluaran ini tidak bisa dijurnal', 409)
    nilai = float(t.amount)
    note = f'Kas kecil {t.number} - {t.category}: {t.purpose}'[:255]
    pending = PendingJournalEntry(
        workflow_id=None, entry_date=t.request_date, description=f'{fund.name} - {t.number}', reference=t.number,
        lines=[{'account_id': acc.id, 'debit': nilai, 'credit': 0, 'description': note},
               {'account_id': fund.cash_account_id, 'debit': 0, 'credit': nilai, 'description': note}],
        total_debit=nilai, total_credit=nilai, created_by=user_id,
    )
    db.session.add(pending)
    db.session.flush()
    entries = post_pending_journal(pending.id, posted_by_user_id=user_id, reference_type='petty_cash', reference_id=t.id)
    t.expense_account_id = acc.id
    if entries:
        t.journal_number = entries[0].entry_number.rsplit('-', 1)[0]
    return entries


@petty_cash_bp.route('/transactions', methods=['POST'])
@jwt_required()
@require_permission('petty_cash.create')
def create_transaction():
    fund = _fund()
    data = request.get_json() or {}
    v = _validate_tx(fund, data)
    req_date = _parse_date(data.get('request_date') or date.today().isoformat(), 'Tanggal')
    u = _me()
    paper = (fund.approval_mode or 'paper') == 'paper'
    t = PettyCashTransaction(number=generate_number('KK', PettyCashTransaction, 'number', style='slash'), fund_id=fund.id,
                             request_date=req_date, created_by=u.id, status='paid' if paper else 'submitted', **v)
    if paper:
        # Persetujuan memakai bon kertas bertanda tangan; sistem hanya membukukan
        # uang yang memang sudah keluar, jadi langsung tercatat.
        t.paid_by, t.paid_at = u.id, datetime.utcnow()
    db.session.add(t)
    db.session.flush()
    if paper:
        _post_expense_journal(t, u.id)
    db.session.commit()
    if not paper and fund.approver_user_id:
        send_notification(fund.approver_user_id, 'Kas kecil menunggu persetujuan',
                          f'{t.number}: {t.requester_name}, Rp {int(t.amount):,} untuk {t.purpose}'.replace(',', '.'),
                          category='finance', action_url='/app/hr/petty-cash?tab=transaksi', reference_type='petty_cash', reference_id=t.id)
    return jsonify(tx_dict(t)), 201


@petty_cash_bp.route('/transactions/<int:tid>', methods=['PUT'])
@jwt_required()
@require_permission('petty_cash.create')
def update_transaction(tid):
    t = db.session.get(PettyCashTransaction, tid) or PCError('Tidak ditemukan', 404)
    if isinstance(t, PCError):
        raise t
    if t.status != 'submitted':
        raise PCError('Hanya permintaan yang masih menunggu persetujuan yang bisa diubah', 409)
    u = _me()
    if t.created_by != u.id and not _is_super(u) and not (t.fund.custodian_user_id == u.id):
        raise PCError('Hanya pembuat atau pemegang kas yang boleh mengubah', 403)
    data = request.get_json() or {}
    v = _validate_tx(t.fund, {**tx_dict(t), **data}, exclude_id=t.id)
    for k, val in v.items():
        setattr(t, k, val)
    if data.get('request_date'):
        t.request_date = _parse_date(data['request_date'], 'Tanggal')
    db.session.commit()
    return jsonify(tx_dict(t))


def _get_tx(tid):
    t = db.session.get(PettyCashTransaction, tid)
    if not t:
        raise PCError('Tidak ditemukan', 404)
    return t


@petty_cash_bp.route('/transactions/<int:tid>/approve', methods=['POST'])
@jwt_required()
@require_permission('petty_cash.approve')
def approve_transaction(tid):
    t = _get_tx(tid)
    u = _require_approver(t.fund)
    if t.status != 'submitted':
        raise PCError('Permintaan ini sudah diproses', 409)
    t.status = 'approved'
    t.approved_by, t.approved_at = u.id, datetime.utcnow()
    t.approval_note = ((request.get_json(silent=True) or {}).get('note') or '').strip() or None
    db.session.commit()
    if t.fund.custodian_user_id:
        send_notification(t.fund.custodian_user_id, 'Kas kecil siap dicairkan', f'{t.number} sudah disetujui Plant Manager',
                          category='finance', action_url='/app/hr/petty-cash?tab=transaksi', reference_type='petty_cash', reference_id=t.id)
    return jsonify(tx_dict(t))


@petty_cash_bp.route('/transactions/<int:tid>/reject', methods=['POST'])
@jwt_required()
@require_permission('petty_cash.approve')
def reject_transaction(tid):
    t = _get_tx(tid)
    u = _require_approver(t.fund)
    if t.status not in ('submitted', 'approved'):
        raise PCError('Permintaan ini sudah diproses', 409)
    reason = ((request.get_json(silent=True) or {}).get('reason') or '').strip()
    if not reason:
        raise PCError('Alasan penolakan wajib diisi')
    t.status = 'rejected'
    t.rejected_by, t.rejected_at, t.rejection_reason = u.id, datetime.utcnow(), reason
    db.session.commit()
    send_notification(t.created_by, 'Kas kecil ditolak', f'{t.number}: {reason}', category='finance', action_url='/app/hr/petty-cash?tab=transaksi',
                      reference_type='petty_cash', reference_id=t.id)
    return jsonify(tx_dict(t))


@petty_cash_bp.route('/transactions/<int:tid>/pay', methods=['POST'])
@jwt_required()
@require_permission('petty_cash.pay')
def pay_transaction(tid):
    t = _get_tx(tid)
    u = _require_custodian(t.fund)
    if t.status != 'approved':
        raise PCError('Hanya permintaan yang sudah disetujui Plant Manager yang bisa dicairkan', 409)
    if not (t.receipt_number or '').strip():
        raise PCError('Nomor nota wajib ada sebelum dicairkan')
    if Decimal(str(t.amount)) > Decimal(str(summary(t.fund)['balance'])):
        raise PCError('Saldo kas kecil tidak cukup. Ajukan pengisian kembali dulu', 409)
    t.status = 'paid'
    t.paid_by, t.paid_at = u.id, datetime.utcnow()
    _post_expense_journal(t, u.id)
    db.session.commit()
    return jsonify(tx_dict(t))


@petty_cash_bp.route('/transactions/<int:tid>/cancel', methods=['POST'])
@jwt_required()
@require_permission('petty_cash.create')
def cancel_transaction(tid):
    """Batalkan nota. Yang sudah tercatat (dan sudah dijurnal) dibalik jurnalnya,
    bukan dihapus, supaya riwayat salah-catat tetap terlihat."""
    t = _get_tx(tid)
    u = _me()
    if t.status not in ('submitted', 'approved', 'paid'):
        raise PCError('Permintaan ini tidak bisa dibatalkan', 409)
    if t.created_by != u.id and not _is_super(u) and t.fund.custodian_user_id != u.id:
        raise PCError('Hanya pembuat atau pemegang kas yang boleh membatalkan', 403)
    if t.status == 'paid' and t.replenishment_id:
        raise PCError('Nota ini sudah masuk pertanggungjawaban pengisian kembali, tidak bisa dibatalkan', 409)
    if t.status == 'paid' and t.journal_number:
        from utils.finance_helpers import is_period_locked, reverse_accounting_entries
        today = date.today()
        if is_period_locked(today, transaction_type='journal_entry'):
            raise PCError('Periode berjalan sudah ditutup, pembatalan tidak bisa dijurnal', 409)
        reverse_accounting_entries('petty_cash', t.id, today, u.id, description=f'Pembatalan kas kecil {t.number}')
    t.status = 'cancelled'
    db.session.commit()
    return jsonify(tx_dict(t))


@petty_cash_bp.route('/replenishments', methods=['GET'])
@jwt_required()
@require_permission('petty_cash.view')
def list_replenishments():
    f = _fund()
    rows = PettyCashReplenishment.query.filter_by(fund_id=f.id).order_by(PettyCashReplenishment.id.desc()).limit(200).all()
    return jsonify({'replenishments': [rep_dict(r) for r in rows]})


@petty_cash_bp.route('/replenishments', methods=['POST'])
@jwt_required()
@require_permission('petty_cash.replenish')
def create_replenishment():
    f = _fund()
    u = _require_custodian(f)
    s = summary(f)
    if s['open_replenishment_id']:
        raise PCError('Masih ada pengajuan pengisian kembali yang belum selesai', 409)
    data = request.get_json(silent=True) or {}
    amount = Decimal(str(data.get('amount') or s['suggested_replenishment']))
    if amount <= 0 or amount > Decimal(str(s['suggested_replenishment'])):
        raise PCError('Jumlah harus lebih dari 0 dan tidak melebihi kekurangan dana tetap')
    r = PettyCashReplenishment(number=generate_number('KKR', PettyCashReplenishment, 'number', style='slash'), fund_id=f.id, request_date=date.today(),
                               reason=s['replenishment_reason'] or 'manual', balance_at_request=Decimal(str(s['balance'])), amount_requested=amount,
                               note=(data.get('note') or '').strip() or None, created_by=u.id, status='requested')
    db.session.add(r)
    db.session.flush()
    for t in PettyCashTransaction.query.filter(PettyCashTransaction.fund_id == f.id, PettyCashTransaction.status == 'paid',
                                               PettyCashTransaction.replenishment_id.is_(None)).all():
        t.replenishment_id = r.id
    db.session.commit()
    return jsonify(rep_dict(r)), 201


def _get_rep(rid):
    r = db.session.get(PettyCashReplenishment, rid)
    if not r:
        raise PCError('Tidak ditemukan', 404)
    return r


@petty_cash_bp.route('/replenishments/<int:rid>/approve', methods=['POST'])
@jwt_required()
@require_permission('petty_cash.replenish_approve')
def approve_replenishment(rid):
    r = _get_rep(rid)
    if r.status != 'requested':
        raise PCError('Pengajuan ini sudah diproses', 409)
    r.status, r.approved_by, r.approved_at = 'approved', _me().id, datetime.utcnow()
    db.session.commit()
    return jsonify(rep_dict(r))


@petty_cash_bp.route('/replenishments/<int:rid>/reject', methods=['POST'])
@jwt_required()
@require_permission('petty_cash.replenish_approve')
def reject_replenishment(rid):
    r = _get_rep(rid)
    if r.status != 'requested':
        raise PCError('Pengajuan ini sudah diproses', 409)
    r.status, r.approved_by, r.approved_at = 'rejected', _me().id, datetime.utcnow()
    r.note = ((request.get_json(silent=True) or {}).get('reason') or r.note or '').strip() or r.note
    for t in r.transactions:
        t.replenishment_id = None
    db.session.commit()
    return jsonify(rep_dict(r))


@petty_cash_bp.route('/replenishments/<int:rid>/receive', methods=['POST'])
@jwt_required()
@require_permission('petty_cash.replenish')
def receive_replenishment(rid):
    r = _get_rep(rid)
    _require_custodian(r.fund)
    if r.status != 'approved':
        raise PCError('Dana baru bisa diterima setelah disetujui Finance', 409)
    amount = Decimal(str((request.get_json(silent=True) or {}).get('amount') or r.amount_requested))
    if amount <= 0 or amount > Decimal(r.amount_requested):
        raise PCError('Jumlah diterima tidak valid')
    r.status, r.received_at, r.amount_received = 'received', datetime.utcnow(), amount
    db.session.commit()
    return jsonify(rep_dict(r))


@petty_cash_bp.route('/report', methods=['GET'])
@jwt_required()
@require_permission('petty_cash.report', 'petty_cash.view')
def report():
    f = _fund()
    q = _filtered(f).filter(PettyCashTransaction.status != 'cancelled') if not request.args.get('status') else _filtered(f)
    rows = q.order_by(PettyCashTransaction.request_date, PettyCashTransaction.id).limit(5000).all()
    by_cat, by_req = {}, {}
    total = 0.0
    for t in rows:
        if t.status in ('rejected', 'cancelled'):
            continue
        total += _f(t.amount)
        by_cat[t.category] = by_cat.get(t.category, 0.0) + _f(t.amount)
        by_req[t.requester_name] = by_req.get(t.requester_name, 0.0) + _f(t.amount)
    return jsonify({
        'fund': {'code': f.code, 'name': f.name},
        'transactions': [tx_dict(t) for t in rows], 'count': len(rows), 'total_counted': total,
        'by_category': [{'name': k, 'amount': v} for k, v in sorted(by_cat.items(), key=lambda x: -x[1])],
        'by_requester': [{'name': k, 'amount': v} for k, v in sorted(by_req.items(), key=lambda x: -x[1])],
        'summary': summary(f),
    })


@petty_cash_bp.route('/expense-accounts', methods=['GET'])
@jwt_required()
@require_permission('petty_cash.manage')
def list_expense_accounts():
    """Akun beban untuk dipetakan ke kategori kas kecil."""
    from models.finance import Account
    rows = Account.query.filter(Account.account_type == 'expense', Account.is_active.is_(True),
                                Account.is_header.is_(False)).order_by(Account.account_code).all()
    return jsonify({'accounts': [{'id': a.id, 'code': a.account_code, 'name': a.account_name} for a in rows]})


@petty_cash_bp.route('/category-accounts', methods=['PUT'])
@jwt_required()
@require_permission('petty_cash.manage')
def set_category_accounts():
    """Pemetaan kategori -> akun beban. Kategori yang dikosongkan memakai akun bawaan dana."""
    from models.finance import Account
    from models.petty_cash import PettyCashCategoryAccount
    fund = _fund()
    data = (request.get_json() or {}).get('category_accounts') or {}
    if not isinstance(data, dict):
        raise PCError('Format pemetaan tidak dikenali')
    for category, account_id in data.items():
        if category not in CATEGORIES:
            raise PCError(f'Kategori {category} tidak dikenal')
        row = PettyCashCategoryAccount.query.filter_by(fund_id=fund.id, category=category).first()
        if not account_id:
            if row:
                db.session.delete(row)
            continue
        acc = db.session.get(Account, int(account_id))
        if not acc or acc.account_type != 'expense' or acc.is_header:
            raise PCError(f'Akun untuk kategori {category} harus akun beban rinci')
        if row:
            row.account_id = acc.id
        else:
            db.session.add(PettyCashCategoryAccount(fund_id=fund.id, category=category, account_id=acc.id))
    db.session.commit()
    return jsonify(fund_dict(fund))


@petty_cash_bp.route('/mutations', methods=['GET'])
@jwt_required()
@require_permission('petty_cash.view')
def list_mutations():
    """Buku kas kecil: seluruh mutasi akun kasnya menurut buku besar, dengan saldo
    berjalan. Hanya untuk dilihat.

    Dana yang akun kasnya belum dipilih memakai hitungan lama (transfer masuk +
    nota keluar) supaya tetap ada yang bisa dilihat.
    """
    fund = _fund()
    if fund.cash_account_id:
        return jsonify({'mutations': _mutasi_dari_buku(fund), 'summary': summary(fund)})

    rows = []
    if fund.opening_balance and float(fund.opening_balance) != 0:
        rows.append({'date': None, 'kind': 'opening', 'number': '-', 'description': 'Saldo awal',
                     'in_amount': _f(fund.opening_balance), 'out_amount': 0.0, 'url': None})
    for t in transfers_in(fund):
        rows.append({'date': t.transfer_date.isoformat(), 'kind': 'transfer', 'number': t.number,
                     'description': f'Transfer dari {t.from_account.account_name}' if t.from_account else 'Transfer masuk',
                     'in_amount': _f(_transfer_in_amount(t)), 'out_amount': 0.0,
                     'url': '/app/finance/bank-transfers'})
    for t in PettyCashTransaction.query.filter(PettyCashTransaction.fund_id == fund.id,
                                               PettyCashTransaction.status == 'paid').all():
        rows.append({'date': t.request_date.isoformat(), 'kind': 'expense', 'number': t.number,
                     'description': f'{t.category}: {t.purpose} ({t.requester_name})',
                     'in_amount': 0.0, 'out_amount': _f(t.amount), 'url': None})
    # Di tanggal yang sama, uang masuk dulu baru uang keluar, supaya saldo
    # berjalannya masuk akal (bukan minus sesaat padahal dananya sudah datang).
    urut = {'opening': 0, 'transfer': 1, 'expense': 2}
    rows.sort(key=lambda r: (r['date'] or '', urut.get(r['kind'], 9), r['number']))
    saldo = 0.0
    for r in rows:
        saldo += r['in_amount'] - r['out_amount']
        r['balance'] = round(saldo, 2)
    return jsonify({'mutations': rows, 'summary': summary(fund)})
