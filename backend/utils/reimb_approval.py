"""Persetujuan reimbursement: rantai per orang (sama seperti PR), aksi satu langkah, email Setuju/Tolak, dan pemberitahuan hasil."""
import json
import threading
from datetime import datetime

from models import db
from utils.pr_approval import KIND_LABEL


def get_chain():
    """Rantai reimbursement dari pengaturan 'reimbursement_approval_chain'; kalau belum ada, ikut rantai PR."""
    from models.settings import SystemSetting
    from utils.pr_approval import get_chain as pr_chain
    row = SystemSetting.query.filter_by(setting_key='reimbursement_approval_chain').first()
    if row and row.setting_value:
        try:
            chain = [c for c in json.loads(row.setting_value) if isinstance(c, dict) and c.get('user_id') and c.get('kind') in KIND_LABEL]
            if chain:
                return chain
        except (ValueError, TypeError):
            pass
    return pr_chain()


def create_steps(reimb):
    """Buat langkah persetujuan sesuai rantai. Mengembalikan jumlah langkah (0 = pakai persetujuan super admin lama)."""
    from models.expense import ReimbursementApproval
    chain = get_chain()
    for n, link in enumerate(chain, start=1):
        db.session.add(ReimbursementApproval(reimbursement_id=reimb.id, approval_level=n, assigned_user_id=int(link['user_id']), kind=link['kind'], status='pending'))
    return len(chain)


def details(reimb):
    from utils.approval_email import _money
    d = lambda x: x.strftime('%d/%m/%Y') if x else '-'
    rows = []
    for e in reimb.expenses:
        rows.append({'nama': e.description or e.expense_category or '-', 'master': None,
                     'keterangan': f'{d(e.expense_date)} · {e.expense_category or ""}'.strip(' ·'), 'qty': 1.0, 'uom': '',
                     'harga': _money(e.amount), 'total': _money(e.amount)})
    info = [('No. Reimbursement', reimb.reimbursement_number), ('Karyawan', reimb.employee_name or '-'),
            ('Jumlah pengeluaran', str(len(rows))), ('Metode pembayaran', reimb.payment_method or '-'),
            ('Bank tujuan', ' '.join(x for x in [reimb.bank_name, reimb.bank_account_number, reimb.bank_account_name] if x) or '-')]
    return {'title': 'Reimbursement', 'number': reimb.reimbursement_number, 'info': info, 'items': rows,
            'totals': [('Total', _money(reimb.total_amount))], 'notes': reimb.notes or '', 'amount': _money(reimb.total_amount)}


def step_action(reimb_id, level, user_id, action, comments=None):
    from models.expense import Reimbursement, ReimbursementApproval
    from models.user import User
    r = db.session.get(Reimbursement, reimb_id, with_for_update=True)
    if not r:
        return {'error': 'Reimbursement tidak ditemukan'}, 404
    if r.status != 'pending':
        return {'error': 'Reimbursement ini sudah diproses'}, 400
    step = ReimbursementApproval.query.filter_by(reimbursement_id=reimb_id, approval_level=level).with_for_update().first()
    if not step:
        return {'error': f'Langkah {level} tidak ditemukan'}, 404
    if step.status != 'pending':
        return {'error': f'Langkah {level} sudah berstatus {step.status}'}, 400
    prior = ReimbursementApproval.query.filter(ReimbursementApproval.reimbursement_id == reimb_id, ReimbursementApproval.approval_level < level,
                                               ReimbursementApproval.status != 'approved').first()
    if prior:
        return {'error': f'Langkah {prior.approval_level} harus disetujui dulu'}, 400
    user = db.session.get(User, user_id)
    if not user.is_super_admin and user_id != step.assigned_user_id:
        who = db.session.get(User, step.assigned_user_id)
        return {'error': f'Langkah ini khusus untuk {(who.full_name or who.username) if who else "penyetuju yang ditetapkan"}.'}, 403
    step.approver_id = user_id
    step.approved_at = datetime.utcnow()
    step.comments = comments
    if action == 'approve':
        step.status = 'approved'
        remaining = ReimbursementApproval.query.filter(ReimbursementApproval.reimbursement_id == reimb_id, ReimbursementApproval.status != 'approved').count()
        if remaining == 0:
            r.status = 'approved'
            r.approved_by = user_id
            r.approved_at = datetime.utcnow()
        return {'message': f'{KIND_LABEL.get(step.kind, step.kind)} disetujui' + (' - reimbursement disetujui penuh' if remaining == 0 else '')}, 200
    step.status = 'rejected'
    r.status = 'rejected'
    r.notes = ((r.notes + '\n') if r.notes else '') + f'Ditolak: {comments or "-"}'
    return {'message': f'Reimbursement ditolak pada langkah {KIND_LABEL.get(step.kind, step.kind)}'}, 200


def _send_step_email(step_id):
    from models.expense import ReimbursementApproval
    from models.user import User
    from utils.approval_email import base_url, _hash
    from utils.email_service import get_email_service
    import secrets
    from datetime import timedelta
    from models.approval_workflow import ApprovalEmailToken
    step = db.session.get(ReimbursementApproval, step_id)
    if not step or step.status != 'pending':
        return 0
    user = db.session.get(User, step.assigned_user_id)
    svc = get_email_service()
    if not user or not user.email or not svc.is_configured():
        return 0
    raw = secrets.token_urlsafe(32)
    db.session.add(ApprovalEmailToken(token_hash=_hash(raw), workflow_id=None, reimbursement_approval_id=step.id, user_id=user.id,
                                      step='review' if step.kind == 'mengetahui' else 'approval', expires_at=datetime.utcnow() + timedelta(days=3)))
    db.session.commit()
    r = svc.send_approval_email(user.email, user.full_name or user.username, 'review' if step.kind == 'mengetahui' else 'approval', details(step.reimbursement),
                                f'{base_url()}/approval-email/{raw}', f'{base_url()}/app/finance/reimbursements/{step.reimbursement_id}')
    return 1 if r.get('success') else 0


def _notify_result(reimb_id):
    from models.expense import Reimbursement
    from models.user import User
    from utils.approval_email import base_url
    from utils.email_service import get_email_service
    r = db.session.get(Reimbursement, reimb_id)
    svc = get_email_service()
    u = db.session.get(User, r.created_by) if r else None
    if not r or not u or not u.email or not svc.is_configured():
        return 0
    ok = r.status == 'approved'
    msg = (f'Reimbursement {r.reimbursement_number} sudah disetujui dan menunggu pembayaran.' if ok else f'Reimbursement {r.reimbursement_number} ditolak.')
    svc.send_custom_notification(u.email, f'{"Disetujui" if ok else "Ditolak"}: Reimbursement {r.reimbursement_number}', f'Reimbursement {"disetujui" if ok else "ditolak"}', msg,
                                 'Buka reimbursement', f'{base_url()}/app/finance/reimbursements/{r.id}', 'success' if ok else 'warning')
    return 1


def after_change(reimb_id):
    try:
        from models.expense import Reimbursement, ReimbursementApproval
        r = db.session.get(Reimbursement, reimb_id)
        if not r:
            return
        if r.status == 'pending':
            nxt = ReimbursementApproval.query.filter_by(reimbursement_id=reimb_id, status='pending').order_by(ReimbursementApproval.approval_level).first()
            if nxt:
                _send_step_email(nxt.id)
        elif r.status in ('approved', 'rejected'):
            _notify_result(reimb_id)
    except Exception:
        db.session.rollback()


def after_change_async(reimb_id):
    from flask import current_app
    app = current_app._get_current_object()
    if app.config.get('TESTING'):
        return

    def run():
        with app.app_context():
            after_change(reimb_id)
    threading.Thread(target=run, daemon=True).start()
