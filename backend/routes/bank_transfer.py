"""Transfer Kas/Bank - pindah dana antar akun kas/bank sendiri.

Pola Accurate Online (Kas & Bank > Transfer Bank): pilih akun asal, akun tujuan,
nilai transfer, dan - kalau ada - biaya transfer beserta akun bebannya dan pihak
yang menanggung. Jurnalnya dibuat otomatis, jadi Finance tidak perlu lagi
mengetik jurnal umum manual untuk pemindahan dana sendiri.
"""
from datetime import datetime
from decimal import Decimal

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import or_

from models import db
from models.bank_transfer import BankTransfer
from models.finance import Account
from utils.auth_decorators import require_permission
from utils.helpers import generate_number_v2

bank_transfer_bp = Blueprint('bank_transfer', __name__)


class TransferError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


@bank_transfer_bp.errorhandler(TransferError)
def _handle(e):
    return jsonify({'error': e.message}), e.status


def _f(v):
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _account(account_id, label):
    acc = db.session.get(Account, account_id) if account_id else None
    if not acc:
        raise TransferError(f'{label} belum dipilih')
    if not acc.is_active:
        raise TransferError(f'{label} ({acc.account_code}) sudah tidak aktif')
    if acc.is_header:
        raise TransferError(f'{label} ({acc.account_code}) adalah akun induk, pilih akun rinciannya')
    return acc


def _cash_account(account_id, label):
    acc = _account(account_id, label)
    if not acc.is_cash_bank:
        raise TransferError(f'{label} ({acc.account_code} {acc.account_name}) bukan akun kas/bank')
    return acc


def _ccy(acc):
    return (acc.currency or 'IDR').upper()


def _rate(value, acc, label):
    """Kurs akun ke rupiah. Akun rupiah selalu 1."""
    if _ccy(acc) == 'IDR':
        return 1.0
    rate = _f(value)
    if not rate:
        from utils.exchange_rates import get_current_rate
        rate = _f(get_current_rate(f'{_ccy(acc)}_IDR'))
    if rate <= 0:
        raise TransferError(f'Kurs {_ccy(acc)} ke IDR untuk {label} belum ada. Isi kursnya di transaksi.')
    return rate


@bank_transfer_bp.route('/accounts', methods=['GET'])
@jwt_required()
@require_permission('finance.view', 'finance.create')
def list_cash_accounts():
    """Akun kas/bank yang bisa dipilih sebagai asal atau tujuan."""
    rows = Account.query.filter(Account.is_cash_bank.is_(True), Account.is_active.is_(True),
                                Account.is_header.is_(False)).order_by(Account.account_code).all()
    return jsonify({'accounts': [{'id': a.id, 'code': a.account_code, 'name': a.account_name,
                                  'currency': a.currency or 'IDR', 'balance': float(a.balance or 0)} for a in rows]})


@bank_transfer_bp.route('/expense-accounts', methods=['GET'])
@jwt_required()
@require_permission('finance.view', 'finance.create')
def list_expense_accounts():
    """Akun beban untuk biaya transfer (mis. Biaya Administrasi Bank)."""
    rows = Account.query.filter(Account.account_type == 'expense', Account.is_active.is_(True),
                                Account.is_header.is_(False)).order_by(Account.account_code).all()
    return jsonify({'accounts': [{'id': a.id, 'code': a.account_code, 'name': a.account_name} for a in rows]})


@bank_transfer_bp.route('', methods=['GET'])
@bank_transfer_bp.route('/', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def list_transfers():
    a = request.args
    q = BankTransfer.query
    if a.get('status'):
        q = q.filter(BankTransfer.status == a['status'])
    if a.get('date_from'):
        q = q.filter(BankTransfer.transfer_date >= a['date_from'])
    if a.get('date_to'):
        q = q.filter(BankTransfer.transfer_date <= a['date_to'])
    if a.get('account_id', type=int):
        aid = a.get('account_id', type=int)
        q = q.filter(or_(BankTransfer.from_account_id == aid, BankTransfer.to_account_id == aid))
    if a.get('q'):
        like = f"%{a['q'].strip()}%"
        q = q.filter(or_(BankTransfer.number.ilike(like), BankTransfer.notes.ilike(like),
                         BankTransfer.reference_number.ilike(like)))
    page = a.get('page', 1, type=int)
    per_page = min(a.get('per_page', 50, type=int), 500)
    rows = q.order_by(BankTransfer.transfer_date.desc(), BankTransfer.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({'transfers': [t.to_dict() for t in rows.items], 'total': rows.total,
                    'page': page, 'pages': rows.pages})


@bank_transfer_bp.route('/<int:tid>', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_transfer(tid):
    t = db.session.get(BankTransfer, tid)
    if not t:
        raise TransferError('Transfer tidak ditemukan', 404)
    data = t.to_dict()
    from models.finance import AccountingEntry
    # Jurnal aslinya DAN jurnal pembaliknya kalau transfer sudah dibatalkan,
    # supaya Finance melihat gambaran utuh tanpa pindah ke Buku Besar.
    rows = AccountingEntry.query.filter(
        AccountingEntry.reference_id == t.id,
        AccountingEntry.reference_type.in_(('bank_transfer', 'void_bank_transfer')),
    ).order_by(AccountingEntry.entry_number).all()
    data['journal'] = [{'entry_number': e.entry_number, 'account_code': e.account_code,
                        'account_name': e.account_name, 'debit': float(e.debit_amount or 0),
                        'credit': float(e.credit_amount or 0), 'description': e.description,
                        'is_reversal': e.reference_type == 'void_bank_transfer'} for e in rows]
    return jsonify(data)


def _build_lines(t, from_acc, to_acc, fee_acc):
    """Jurnal transfer: dana pindah dari akun asal ke akun tujuan, biaya transfer
    membebani saldo pihak yang ditunjuk."""
    from utils.finance_helpers import fx_difference_line

    out_idr = round(_f(t.amount) * _f(t.exchange_rate or 1), 2)
    in_idr = round(_f(t.amount_received if t.amount_received is not None else t.amount) * _f(t.exchange_rate_to or 1), 2)
    note = f'Transfer {t.number}: {from_acc.account_name} -> {to_acc.account_name}'
    lines = [
        {'account_id': to_acc.id, 'debit': in_idr, 'credit': 0, 'description': note},
        {'account_id': from_acc.id, 'debit': 0, 'credit': out_idr, 'description': note},
    ]
    diff = fx_difference_line(out_idr, in_idr, f'Selisih kurs {t.number}')
    if diff:
        lines.append(diff)

    fee = round(_f(t.fee_amount), 2)
    if fee > 0:
        bearer = from_acc if t.fee_charged_to == 'from' else to_acc
        rate = _f(t.exchange_rate if t.fee_charged_to == 'from' else t.exchange_rate_to) or 1
        fee_idr = round(fee * rate, 2)
        lines.append({'account_id': fee_acc.id, 'debit': fee_idr, 'credit': 0,
                      'description': f'Biaya transfer {t.number}'})
        lines.append({'account_id': bearer.id, 'debit': 0, 'credit': fee_idr,
                      'description': f'Biaya transfer {t.number} dibebankan ke {bearer.account_name}'})
    return lines


def _post_journal(t, lines, user_id):
    from models.approval_workflow import PendingJournalEntry
    from utils.finance_helpers import post_pending_journal

    total = round(sum(_f(l['debit']) for l in lines), 2)
    pending = PendingJournalEntry(
        workflow_id=None, entry_date=t.transfer_date,
        description=f'Transfer Kas/Bank {t.number}', reference=t.number,
        lines=lines, total_debit=total, total_credit=round(sum(_f(l['credit']) for l in lines), 2),
        created_by=user_id,
    )
    db.session.add(pending)
    db.session.flush()
    entries = post_pending_journal(pending.id, posted_by_user_id=user_id,
                                   reference_type='bank_transfer', reference_id=t.id)
    if entries:
        t.journal_number = entries[0].entry_number.rsplit('-', 1)[0]
    return entries


@bank_transfer_bp.route('', methods=['POST'])
@bank_transfer_bp.route('/', methods=['POST'])
@jwt_required()
@require_permission('finance.create')
def create_transfer():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    from_acc = _cash_account(data.get('from_account_id'), 'Akun asal')
    to_acc = _cash_account(data.get('to_account_id'), 'Akun tujuan')
    if from_acc.id == to_acc.id:
        raise TransferError('Akun asal dan akun tujuan tidak boleh sama')

    amount = round(_f(data.get('amount')), 2)
    if amount <= 0:
        raise TransferError('Nilai transfer harus lebih dari 0')

    try:
        transfer_date = datetime.fromisoformat(str(data.get('transfer_date'))).date()
    except (TypeError, ValueError):
        raise TransferError('Tanggal transfer tidak valid')

    from utils.finance_helpers import is_period_locked
    if is_period_locked(transfer_date, transaction_type='journal_entry'):
        raise TransferError(f'Periode {transfer_date:%Y-%m} sudah ditutup, tidak bisa mencatat transfer di tanggal itu', 409)

    fee = round(_f(data.get('fee_amount')), 2)
    if fee < 0:
        raise TransferError('Biaya transfer tidak boleh minus')
    fee_acc = None
    if fee > 0:
        fee_acc = _account(data.get('fee_account_id'), 'Akun biaya transfer')
        if fee_acc.account_type != 'expense':
            raise TransferError(f'{fee_acc.account_code} {fee_acc.account_name} bukan akun beban')
    charged_to = (data.get('fee_charged_to') or 'from').lower()
    if charged_to not in ('from', 'to'):
        raise TransferError("Biaya transfer harus dibebankan ke 'from' (pengirim) atau 'to' (penerima)")

    beda_mata_uang = _ccy(from_acc) != _ccy(to_acc)
    amount_received = round(_f(data.get('amount_received')), 2) if beda_mata_uang else None
    if beda_mata_uang and amount_received <= 0:
        raise TransferError(f'Akun asal bermata uang {_ccy(from_acc)} dan akun tujuan {_ccy(to_acc)}. '
                            'Isi juga nilai yang diterima di akun tujuan.')

    t = BankTransfer(
        number=generate_number_v2('bank_transfer', 'TRF', BankTransfer, 'number'),
        transfer_date=transfer_date,
        from_account_id=from_acc.id, to_account_id=to_acc.id,
        amount=Decimal(str(amount)),
        amount_received=Decimal(str(amount_received)) if amount_received else None,
        fee_amount=Decimal(str(fee)), fee_account_id=fee_acc.id if fee_acc else None,
        fee_charged_to=charged_to,
        exchange_rate=Decimal(str(_rate(data.get('exchange_rate'), from_acc, 'akun asal'))),
        exchange_rate_to=Decimal(str(_rate(data.get('exchange_rate_to'), to_acc, 'akun tujuan'))),
        reference_number=(data.get('reference_number') or '').strip()[:100] or None,
        notes=(data.get('notes') or '').strip() or None,
        created_by=user_id,
    )
    db.session.add(t)
    db.session.flush()

    _post_journal(t, _build_lines(t, from_acc, to_acc, fee_acc), user_id)
    db.session.commit()
    return jsonify(t.to_dict()), 201


@bank_transfer_bp.route('/<int:tid>/cancel', methods=['POST'])
@jwt_required()
@require_permission('finance.create')
def cancel_transfer(tid):
    user_id = int(get_jwt_identity())
    t = db.session.get(BankTransfer, tid)
    if not t:
        raise TransferError('Transfer tidak ditemukan', 404)
    if t.status == 'cancelled':
        raise TransferError('Transfer ini sudah dibatalkan', 409)

    from utils.finance_helpers import is_period_locked, reverse_accounting_entries
    today = datetime.utcnow().date()
    if is_period_locked(today, transaction_type='journal_entry'):
        raise TransferError('Periode berjalan sudah ditutup, pembatalan tidak bisa dijurnal', 409)

    reason = ((request.get_json(silent=True) or {}).get('reason') or '').strip()
    reverse_accounting_entries('bank_transfer', t.id, today, user_id,
                               description=f'Pembatalan Transfer Kas/Bank {t.number}')
    t.status = 'cancelled'
    t.cancelled_by = user_id
    t.cancelled_at = datetime.utcnow()
    t.cancel_reason = reason or None
    db.session.commit()
    return jsonify(t.to_dict())
