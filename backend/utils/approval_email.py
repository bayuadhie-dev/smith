"""Approve/reject lewat email: token sekali pakai, rincian dokumen, dan pengiriman email ke penyetuju."""
import hashlib
import os
import secrets
import threading
from datetime import datetime, timedelta

from models import db

TOKEN_TTL_DAYS = 3
STEP_OF_STATUS = {'pending_review': 'review', 'pending_approval': 'approval'}


def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def base_url():
    url = (os.getenv('APP_URL') or '').rstrip('/')
    if not url or 'localhost' in url:
        url = (os.getenv('FRONTEND_URL') or url or 'http://localhost:3000').rstrip('/')
    return url


def approvers_for(workflow, step):
    """User aktif ber-email yang punya salah satu role pada konfigurasi tahap ini (super admin tidak ikut dikirimi)."""
    from models.approval_workflow import ApprovalConfiguration
    from models.user import User, UserRole, Role
    config = ApprovalConfiguration.query.filter_by(transaction_type=workflow.transaction_type, is_active=True).first()
    if not config:
        return []
    roles = [r.lower() for r in ((config.reviewer_roles if step == 'review' else config.approver_roles) or [])]
    if not roles:
        return []
    return (User.query.join(UserRole, UserRole.user_id == User.id).join(Role, Role.id == UserRole.role_id)
            .filter(db.func.lower(Role.name).in_(roles), User.is_active.is_(True), User.email.isnot(None), User.email != '')
            .distinct().all())


def issue_token(workflow, user, step):
    from models.approval_workflow import ApprovalEmailToken
    raw = secrets.token_urlsafe(32)
    db.session.add(ApprovalEmailToken(token_hash=_hash(raw), workflow_id=workflow.id, user_id=user.id, step=step,
                                      expires_at=datetime.utcnow() + timedelta(days=TOKEN_TTL_DAYS)))
    return raw


def issue_token_for_pr(step, user):
    from models.approval_workflow import ApprovalEmailToken
    raw = secrets.token_urlsafe(32)
    db.session.add(ApprovalEmailToken(token_hash=_hash(raw), workflow_id=None, pr_approval_id=step.id, user_id=user.id,
                                      step='review' if step.kind == 'mengetahui' else 'approval',
                                      expires_at=datetime.utcnow() + timedelta(days=TOKEN_TTL_DAYS)))
    return raw


def _find_pr_token(row):
    from models.purchasing import PRApproval, PurchaseRequisition
    step = db.session.get(PRApproval, row.pr_approval_id)
    pr = db.session.get(PurchaseRequisition, step.pr_id) if step else None
    if not step or not pr or step.status != 'pending' or pr.status != 'submitted':
        return None, 'Dokumen ini sudah diproses atau tahapnya sudah berubah.'
    prior = PRApproval.query.filter(PRApproval.pr_id == step.pr_id, PRApproval.approval_level < step.approval_level, PRApproval.status != 'approved').first()
    if prior:
        return None, 'Dokumen ini belum sampai ke tahap Anda.'
    return row, None


def find_token(raw):
    """Token valid -> ApprovalEmailToken, selain itu (None, pesan)."""
    from models.approval_workflow import ApprovalEmailToken, ApprovalWorkflow
    row = ApprovalEmailToken.query.filter_by(token_hash=_hash(raw or '')).first()
    if not row:
        return None, 'Tautan tidak dikenali.'
    if row.used_at:
        return None, 'Tautan ini sudah dipakai.'
    if row.expires_at < datetime.utcnow():
        return None, 'Tautan sudah kedaluwarsa. Buka dokumennya langsung di ERP.'
    if row.pr_approval_id:
        return _find_pr_token(row)
    wf = db.session.get(ApprovalWorkflow, row.workflow_id)
    if not wf or STEP_OF_STATUS.get(wf.status) != row.step:
        return None, 'Dokumen ini sudah diproses atau tahapnya sudah berubah.'
    return row, None


def close_tokens(workflow_id, step):
    from models.approval_workflow import ApprovalEmailToken
    ApprovalEmailToken.query.filter_by(workflow_id=workflow_id, step=step, used_at=None).update({'used_at': datetime.utcnow()})
    db.session.commit()


def _money(v, ccy='IDR'):
    try:
        n = float(v or 0)
    except (TypeError, ValueError):
        n = 0
    if ccy in (None, 'IDR'):
        return 'Rp ' + f'{n:,.0f}'.replace(',', '.')
    return f'{ccy} {n:,.2f}'


def workflow_details(workflow):
    """Rincian lengkap dokumen untuk email dan halaman konfirmasi."""
    if workflow.transaction_type == 'purchase_order':
        from models.purchasing import PurchaseOrder
        po = db.session.get(PurchaseOrder, workflow.transaction_id)
        if po:
            ccy = po.currency or 'IDR'
            d = lambda x: x.strftime('%d/%m/%Y') if x else '-'
            sub = float(po.subtotal or 0)
            rows = []
            for i in po.items:
                master = (i.material.name if i.material else None) or (i.product.name if i.product else None)
                rows.append({'nama': i.description or master or '-', 'master': master if master != i.description else None,
                             'keterangan': i.notes or '', 'qty': float(i.quantity), 'uom': i.uom,
                             'harga': _money(i.unit_price, ccy), 'total': _money(i.total_price, ccy)})
            creator = po.created_by_user.full_name if getattr(po, 'created_by_user', None) else None
            info = [('No. PO', po.po_number), ('Pemasok', po.supplier.company_name if po.supplier else '-'),
                    ('Tanggal order', d(po.order_date)), ('Dibutuhkan', d(po.required_date)),
                    ('Estimasi kedatangan', d(po.expected_date)), ('Termin pembayaran', po.payment_terms or '-'),
                    ('Mata uang', ccy), ('Alamat kirim', po.delivery_address or '-'),
                    ('Dibuat oleh', creator or '-')]
            totals = [('Subtotal', _money(sub, ccy)), ('Pajak', _money(po.tax_amount, ccy)), ('Total', _money(po.total_amount, ccy))]
            return {'title': 'Purchase Order', 'number': po.po_number, 'info': info, 'items': rows, 'totals': totals,
                    'notes': po.notes or '', 'amount': _money(po.total_amount, ccy)}
    return {'title': workflow.transaction_type, 'number': workflow.transaction_number or str(workflow.transaction_id),
            'info': [], 'items': [], 'totals': [], 'notes': '', 'amount': ''}


def send_workflow_emails(workflow_id):
    """Kirim email approve/reject ke semua penyetuju tahap saat ini. Gagal kirim tidak boleh mengganggu proses utama."""
    try:
        from models.approval_workflow import ApprovalWorkflow
        from utils.email_service import get_email_service
        wf = db.session.get(ApprovalWorkflow, workflow_id)
        if not wf or wf.status not in STEP_OF_STATUS:
            return 0
        step = STEP_OF_STATUS[wf.status]
        svc = get_email_service()
        if not svc.is_configured():
            return 0
        details = workflow_details(wf)
        sent = 0
        from utils.notify_events import pref_enabled
        for user in approvers_for(wf, step):
            if not pref_enabled(user.id, 'approval_request', 'email'):
                continue
            raw = issue_token(wf, user, step)
            db.session.commit()
            r = svc.send_approval_email(user.email, user.full_name or user.username, step, details,
                                        f'{base_url()}/approval-email/{raw}', f'{base_url()}/app/approvals')
            if r.get('success'):
                sent += 1
        return sent
    except Exception:
        db.session.rollback()
        return 0


def send_workflow_emails_async(workflow_id):
    from flask import current_app
    app = current_app._get_current_object()
    if app.config.get('TESTING'):
        return

    def run():
        with app.app_context():
            try:
                from utils.notify_events import notify_workflow_pending
                notify_workflow_pending(workflow_id)
            except Exception:
                pass
            send_workflow_emails(workflow_id)
    threading.Thread(target=run, daemon=True).start()
