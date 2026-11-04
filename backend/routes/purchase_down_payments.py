from datetime import date as _date
from decimal import Decimal

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func

from models import db, Invoice, Account, PurchaseOrder, PurchaseDownPayment, PurchaseDownPaymentAllocation
from models.approval_workflow import PendingJournalEntry
from models.purchasing import Supplier
from utils import generate_number
from utils.auth_decorators import require_permission
from utils.timezone import get_local_now

purchase_down_payments_bp = Blueprint('purchase_down_payments', __name__)

DP_ACCOUNT_CODE = 'UM-PMB'


def resolve_dp_account():
    """Akun Uang Muka Pembelian (aset): pengaturan sistem 'akun_uang_muka_pemasok_id' -> akun bernama 'Uang Muka ...' (pembelian/pemasok)
    -> dibuat otomatis (kode UM-PMB) bila belum ada."""
    from models.settings import SystemSetting
    s = SystemSetting.query.filter_by(setting_key='akun_uang_muka_pemasok_id').first()
    if s and (s.setting_value or '').isdigit():
        a = db.session.get(Account, int(s.setting_value))
        if a and not a.is_header and a.is_active:
            return a.id
    q = Account.query.filter(Account.is_header.is_(False), Account.is_active.is_(True), Account.account_type == 'asset',
                             Account.account_name.ilike('%uang muka%'))
    for a in q.order_by(Account.account_code).all():
        if any(w in a.account_name.lower() for w in ('pembelian', 'pemasok', 'supplier', 'vendor')):
            return a.id
    a = Account.query.filter_by(account_code=DP_ACCOUNT_CODE).first()
    if not a:
        a = Account(account_code=DP_ACCOUNT_CODE, account_name='Uang Muka Pembelian', account_type='asset', normal_balance='debit',
                    level=2, is_active=True, is_header=False, is_cash_bank=False,
                    description='Uang muka yang dibayar ke pemasok (dibuat otomatis oleh modul Uang Muka Pembelian)')
        db.session.add(a)
        db.session.flush()
    return a.id


def _f(v):
    return float(v or 0)


def _alloc_dict(a):
    return {'id': a.id, 'invoice_id': a.invoice_id, 'invoice_number': a.invoice.invoice_number if a.invoice else None,
            'amount': _f(a.amount), 'status': a.status, 'allocated_at': a.allocated_at.isoformat() if a.allocated_at else None}


def _dp_dict(d, detail=False):
    out = {
        'id': d.id, 'dp_number': d.dp_number, 'po_id': d.po_id, 'po_number': d.purchase_order.po_number if d.purchase_order else None,
        'supplier_id': d.supplier_id, 'supplier_name': d.supplier.company_name if d.supplier else None,
        'dp_date': d.dp_date.isoformat(), 'amount': _f(d.amount), 'allocated_amount': _f(d.allocated_amount), 'remaining': d.remaining,
        'bank_account_id': d.bank_account_id, 'payment_method': d.payment_method, 'reference_number': d.reference_number,
        'notes': d.notes, 'status': d.status,
    }
    if detail:
        from models import AccountingEntry
        out['allocations'] = [_alloc_dict(a) for a in d.allocations]
        rows = AccountingEntry.query.filter(AccountingEntry.reference_type.in_(['purchase_down_payment', 'void_purchase_down_payment']),
                                            AccountingEntry.reference_id == d.id).order_by(AccountingEntry.id).all()
        aids = [a.id for a in d.allocations]
        if aids:
            rows += AccountingEntry.query.filter(AccountingEntry.reference_type.in_(['purchase_dp_allocation', 'void_purchase_dp_allocation']),
                                                 AccountingEntry.reference_id.in_(aids)).order_by(AccountingEntry.id).all()
        out['journal'] = [{'entry_number': e.entry_number, 'date': e.entry_date.isoformat(), 'account': f'{e.account.account_code} - {e.account.account_name}' if e.account else None,
                           'debit': _f(e.debit_amount), 'credit': _f(e.credit_amount), 'description': e.description, 'status': e.status} for e in rows]
    return out


def _post(lines, desc, reference, entry_date, ref_type, ref_id, user_id):
    from utils.finance_helpers import post_pending_journal
    total = round(sum(l['debit'] for l in lines), 2)
    pj = PendingJournalEntry(workflow_id=None, entry_date=entry_date, description=desc, reference=reference, lines=lines,
                             total_debit=total, total_credit=total, created_by=user_id)
    db.session.add(pj)
    db.session.flush()
    post_pending_journal(pj.id, posted_by_user_id=user_id, reference_type=ref_type, reference_id=ref_id)


def _locked(day):
    from utils.finance_helpers import is_period_locked
    return is_period_locked(day, transaction_type='payment', sap_bucket='K')


@purchase_down_payments_bp.route('', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def list_dp():
    q = PurchaseDownPayment.query
    if request.args.get('status'):
        q = q.filter(PurchaseDownPayment.status == request.args['status'])
    if request.args.get('po_id'):
        q = q.filter(PurchaseDownPayment.po_id == int(request.args['po_id']))
    if request.args.get('supplier_id'):
        q = q.filter(PurchaseDownPayment.supplier_id == int(request.args['supplier_id']))
    if request.args.get('open') in ('1', 'true'):
        q = q.filter(PurchaseDownPayment.status == 'posted', PurchaseDownPayment.amount > PurchaseDownPayment.allocated_amount)
    s = (request.args.get('search') or '').strip()
    if s:
        q = q.join(Supplier, Supplier.id == PurchaseDownPayment.supplier_id).filter(
            db.or_(PurchaseDownPayment.dp_number.ilike(f'%{s}%'), Supplier.company_name.ilike(f'%{s}%')))
    page = request.args.get('page', 1, type=int)
    pag = q.order_by(PurchaseDownPayment.dp_date.desc(), PurchaseDownPayment.id.desc()).paginate(
        page=page, per_page=min(request.args.get('per_page', 50, type=int), 200), error_out=False)
    live = PurchaseDownPayment.query.filter(PurchaseDownPayment.status == 'posted')
    tot = db.session.query(func.coalesce(func.sum(PurchaseDownPayment.amount), 0), func.coalesce(func.sum(PurchaseDownPayment.allocated_amount), 0)).filter(
        PurchaseDownPayment.status == 'posted').one()
    return jsonify({'down_payments': [_dp_dict(d) for d in pag.items], 'total': pag.total, 'pages': pag.pages,
                    'summary': {'count': live.count(), 'paid': float(tot[0]), 'allocated': float(tot[1]), 'remaining': float(tot[0]) - float(tot[1])}}), 200


@purchase_down_payments_bp.route('/<int:did>', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def get_dp(did):
    d = db.session.get(PurchaseDownPayment, did)
    if not d:
        return jsonify({'error': 'Uang muka tidak ditemukan'}), 404
    return jsonify(_dp_dict(d, detail=True)), 200


@purchase_down_payments_bp.route('/by-po/<int:po_id>', methods=['GET'])
@jwt_required()
@require_permission('purchasing.view')
def by_po(po_id):
    rows = PurchaseDownPayment.query.filter_by(po_id=po_id).filter(PurchaseDownPayment.status == 'posted').all()
    paid = sum(_f(r.amount) for r in rows)
    alloc = sum(_f(r.allocated_amount) for r in rows)
    return jsonify({'down_payments': [_dp_dict(r) for r in rows], 'paid': paid, 'allocated': alloc, 'remaining': paid - alloc}), 200


@purchase_down_payments_bp.route('', methods=['POST'])
@jwt_required()
@require_permission('purchasing.create')
def create_dp():
    d = request.get_json() or {}
    uid = int(get_jwt_identity())
    try:
        amount = Decimal(str(d.get('amount') or 0))
        if amount <= 0:
            return jsonify({'error': 'Jumlah uang muka harus lebih dari 0'}), 400
        po = db.session.get(PurchaseOrder, d['po_id']) if d.get('po_id') else None
        if d.get('po_id') and not po:
            return jsonify({'error': 'PO tidak ditemukan'}), 404
        if po and po.status in ('draft', 'rejected', 'cancelled'):
            return jsonify({'error': f'PO {po.po_number} berstatus {po.status}; uang muka hanya untuk PO yang sudah diajukan/disetujui'}), 400
        supplier_id = po.supplier_id if po else d.get('supplier_id')
        if not supplier_id or not db.session.get(Supplier, supplier_id):
            return jsonify({'error': 'Pemasok wajib dipilih'}), 400
        if po and d.get('supplier_id') and int(d['supplier_id']) != po.supplier_id:
            return jsonify({'error': 'Pemasok tidak sama dengan pemasok di PO'}), 400
        bank = db.session.get(Account, d.get('bank_account_id') or 0)
        if not bank or not bank.is_cash_bank or bank.is_header:
            return jsonify({'error': 'Pilih akun Kas/Bank sumber pembayaran'}), 400
        day = _date.fromisoformat(str(d.get('dp_date') or get_local_now().date())[:10])
        if _locked(day):
            return jsonify({'error': f'Periode {day.strftime("%Y-%m")} sudah ditutup (period-close)'}), 400
        dp = PurchaseDownPayment(dp_number=generate_number('DPP', PurchaseDownPayment, 'dp_number'), po_id=po.id if po else None,
                                 supplier_id=supplier_id, dp_date=day, amount=amount, allocated_amount=0, bank_account_id=bank.id,
                                 payment_method=d.get('payment_method') or 'bank_transfer', reference_number=d.get('reference_number'),
                                 notes=d.get('notes'), status='posted', created_by=uid)
        dp.dp_account_id = resolve_dp_account()
        db.session.add(dp)
        db.session.flush()
        amt = float(amount)
        memo = f'Uang muka pembelian {dp.dp_number}' + (f' - PO {po.po_number}' if po else '')
        _post([{'account_id': dp.dp_account_id, 'debit': amt, 'credit': 0, 'description': memo},
               {'account_id': bank.id, 'debit': 0, 'credit': amt, 'description': memo}],
              memo, dp.dp_number, day, 'purchase_down_payment', dp.id, uid)
        db.session.commit()
        return jsonify({'message': 'Uang muka dicatat', 'id': dp.id, 'dp_number': dp.dp_number}), 201
    except (ValueError, KeyError) as e:
        db.session.rollback()
        return jsonify({'error': f'Data tidak valid: {e}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchase_down_payments_bp.route('/<int:did>/allocate', methods=['POST'])
@jwt_required()
@require_permission('purchasing.create')
def allocate(did):
    """Alokasikan uang muka ke faktur pembelian terbuka milik pemasok yang sama.
    Aturan PO: bila uang muka terkait PO dan faktur juga terkait PO, keduanya harus PO yang sama; faktur tanpa PO tetap boleh
    (uang muka dipakai melunasi tagihan pemasok itu). Hanya Rupiah."""
    uid = int(get_jwt_identity())
    d = request.get_json() or {}
    dp = db.session.query(PurchaseDownPayment).filter_by(id=did).with_for_update().first()
    if not dp:
        return jsonify({'error': 'Uang muka tidak ditemukan'}), 404
    try:
        if dp.status != 'posted':
            return jsonify({'error': f'Uang muka berstatus {dp.status}, tidak bisa dialokasikan'}), 400
        inv = db.session.query(Invoice).filter_by(id=d.get('invoice_id') or 0).with_for_update().first()
        if not inv or inv.invoice_type != 'purchase':
            return jsonify({'error': 'Faktur pembelian tidak ditemukan'}), 404
        if inv.status in ('draft', 'cancelled'):
            return jsonify({'error': f'Faktur {inv.invoice_number} berstatus {inv.status}'}), 400
        if inv.supplier_id != dp.supplier_id:
            return jsonify({'error': 'Faktur milik pemasok lain'}), 400
        if dp.po_id and inv.purchase_order_id and inv.purchase_order_id != dp.po_id:
            return jsonify({'error': 'Faktur terkait PO yang berbeda dari PO uang muka ini'}), 400
        if (inv.currency or 'IDR') != 'IDR':
            return jsonify({'error': 'Uang muka hanya bisa dialokasikan ke faktur Rupiah'}), 400
        amount = Decimal(str(d.get('amount') or 0))
        if amount <= 0:
            return jsonify({'error': 'Jumlah alokasi harus lebih dari 0'}), 400
        if float(amount) > dp.remaining + 0.005:
            return jsonify({'error': f'Jumlah melebihi sisa uang muka (Rp{dp.remaining:,.2f})'}), 400
        if float(amount) > _f(inv.balance_due) + 0.005:
            return jsonify({'error': f'Jumlah melebihi saldo faktur (Rp{_f(inv.balance_due):,.2f})'}), 400
        day = get_local_now().date()
        if _locked(day):
            return jsonify({'error': 'Periode berjalan sudah ditutup'}), 400
        from utils.finance_helpers import resolve_accounts_payable
        ap = resolve_accounts_payable(dp.supplier_id)
        al = PurchaseDownPaymentAllocation(down_payment_id=dp.id, invoice_id=inv.id, amount=amount, status='active', allocated_by=uid)
        db.session.add(al)
        db.session.flush()
        amt = float(amount)
        memo = f'Pemakaian uang muka {dp.dp_number} untuk faktur {inv.invoice_number}'
        _post([{'account_id': ap, 'debit': amt, 'credit': 0, 'description': memo},
               {'account_id': dp.dp_account_id, 'debit': 0, 'credit': amt, 'description': memo}],
              memo, dp.dp_number, day, 'purchase_dp_allocation', al.id, uid)
        dp.allocated_amount = Decimal(str(dp.allocated_amount or 0)) + amount
        inv.credit_applied = Decimal(str(inv.credit_applied or 0)) + amount
        inv.balance_due = max(Decimal('0'), Decimal(str(inv.total_amount or 0)) - Decimal(str(inv.paid_amount or 0)) - inv.credit_applied)
        inv.status = 'paid' if inv.balance_due <= Decimal('0.005') else 'partial'
        db.session.commit()
        return jsonify({'message': 'Uang muka dialokasikan', 'allocation_id': al.id, 'remaining': dp.remaining, 'invoice_balance_due': _f(inv.balance_due)}), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def _reverse_allocation(al, uid, day):
    from utils.finance_helpers import reverse_accounting_entries
    reverse_accounting_entries(reference_type='purchase_dp_allocation', reference_id=al.id, entry_date=day, user_id=uid,
                               description=f'Batal alokasi uang muka {al.down_payment.dp_number}', new_reference_type='void_purchase_dp_allocation')
    inv = al.invoice
    amt = Decimal(str(al.amount))
    inv.credit_applied = max(Decimal('0'), Decimal(str(inv.credit_applied or 0)) - amt)
    inv.balance_due = max(Decimal('0'), Decimal(str(inv.total_amount or 0)) - Decimal(str(inv.paid_amount or 0)) - inv.credit_applied)
    if inv.status != 'cancelled':
        inv.status = 'draft' if (Decimal(str(inv.paid_amount or 0)) <= 0 and inv.credit_applied <= 0) else ('partial' if inv.balance_due > 0 else 'paid')
    al.down_payment.allocated_amount = max(Decimal('0'), Decimal(str(al.down_payment.allocated_amount or 0)) - amt)
    al.status = 'reversed'


@purchase_down_payments_bp.route('/allocations/<int:aid>/reverse', methods=['POST'])
@jwt_required()
@require_permission('purchasing.approve')
def reverse_allocation(aid):
    uid = int(get_jwt_identity())
    al = db.session.get(PurchaseDownPaymentAllocation, aid)
    if not al:
        return jsonify({'error': 'Alokasi tidak ditemukan'}), 404
    if al.status != 'active':
        return jsonify({'error': 'Alokasi sudah dibatalkan'}), 400
    day = get_local_now().date()
    if _locked(day):
        return jsonify({'error': 'Periode berjalan sudah ditutup'}), 400
    try:
        _reverse_allocation(al, uid, day)
        db.session.commit()
        return jsonify({'message': 'Alokasi dibatalkan'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@purchase_down_payments_bp.route('/<int:did>/cancel', methods=['POST'])
@jwt_required()
@require_permission('purchasing.approve')
def cancel_dp(did):
    uid = int(get_jwt_identity())
    dp = db.session.query(PurchaseDownPayment).filter_by(id=did).with_for_update().first()
    if not dp:
        return jsonify({'error': 'Uang muka tidak ditemukan'}), 404
    if dp.status != 'posted':
        return jsonify({'error': f'Uang muka sudah berstatus {dp.status}'}), 400
    if any(a.status == 'active' for a in dp.allocations):
        return jsonify({'error': 'Uang muka sudah dialokasikan ke faktur. Batalkan alokasinya dulu.'}), 400
    day = get_local_now().date()
    if _locked(dp.dp_date) or _locked(day):
        return jsonify({'error': 'Periode sudah ditutup; uang muka tidak bisa dibatalkan'}), 400
    try:
        from utils.finance_helpers import reverse_accounting_entries
        reverse_accounting_entries(reference_type='purchase_down_payment', reference_id=dp.id, entry_date=day, user_id=uid,
                                   description=f'Batal uang muka {dp.dp_number}', new_reference_type='void_purchase_down_payment')
        dp.status = 'cancelled'
        db.session.commit()
        return jsonify({'message': 'Uang muka dibatalkan'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
