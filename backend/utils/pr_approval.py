"""Persetujuan Purchase Request: rantai penyetuju per orang (Mengetahui lalu Menyetujui), aksi satu langkah, dan email."""
import json
import threading
from datetime import datetime

from models import db

KIND_LABEL = {'mengetahui': 'Mengetahui', 'menyetujui': 'Menyetujui'}


def get_chain():
    """Rantai penyetuju dari pengaturan 'pr_approval_chain': [{"kind": "mengetahui", "user_id": 6}, ...]. Kosong = pakai aturan berjenjang bawaan."""
    from models.settings import SystemSetting
    row = SystemSetting.query.filter_by(setting_key='pr_approval_chain').first()
    if not row or not row.setting_value:
        return []
    try:
        chain = json.loads(row.setting_value)
    except (ValueError, TypeError):
        return []
    return [c for c in chain if isinstance(c, dict) and c.get('user_id') and c.get('kind') in KIND_LABEL]


def set_chain(chain):
    from models.settings import SystemSetting
    row = SystemSetting.query.filter_by(setting_key='pr_approval_chain').first()
    if not row:
        row = SystemSetting(setting_key='pr_approval_chain', setting_category='general', setting_name='Rantai persetujuan PR',
                            data_type='json', description='Penyetuju Purchase Request per orang: mengetahui lalu menyetujui')
        db.session.add(row)
    row.setting_value = json.dumps(chain)
    db.session.commit()


def pr_details(pr):
    from utils.approval_email import _money
    ccy = pr.currency or 'IDR'
    d = lambda x: x.strftime('%d/%m/%Y') if x else '-'
    rows, total = [], 0.0
    for i in pr.items:
        master = (i.material.name if i.material else None) or (i.product.name if i.product else None)
        total += float(i.estimated_total or 0)
        rows.append({'nama': i.item_name or master or '-', 'master': master if master and master != i.item_name else None,
                     'keterangan': i.notes or '', 'qty': float(i.quantity), 'uom': i.uom,
                     'harga': _money(i.estimated_unit_price, ccy) if i.estimated_unit_price else '-',
                     'total': _money(i.estimated_total, ccy) if i.estimated_total else '-'})
    pri = {'low': 'Rendah', 'normal': 'Normal', 'high': 'Tinggi', 'urgent': 'Mendesak'}.get(pr.priority, pr.priority or '-')
    info = [('No. PR', pr.pr_number), ('Pemohon', (pr.requester.full_name or pr.requester.username) if pr.requester else '-'),
            ('Departemen', pr.department or '-'), ('Tanggal permintaan', d(pr.request_date)), ('Dibutuhkan', d(pr.required_date)),
            ('Prioritas', pri), ('Tujuan', pr.purpose or '-'), ('Mata uang', ccy)]
    totals = [('Total estimasi', _money(total, ccy))]
    if ccy != 'IDR' and pr.exchange_rate:
        totals.append(('Setara (kurs saat dibuat)', _money(total * float(pr.exchange_rate), 'IDR')))
    return {'title': 'Permintaan Pembelian', 'number': pr.pr_number, 'info': info, 'items': rows, 'totals': totals,
            'notes': pr.notes or '', 'amount': _money(total, ccy) if total else '-'}


def step_action(pr_id, level, user_id, action, comments=None, rejection_reason=None):
    """Setujui/tolak SATU langkah PR. Mengembalikan (dict, status_http). Tidak mengirim email (pemanggil yang kirim)."""
    from models.purchasing import PurchaseRequisition, PRApproval
    from models.user import User
    pr = db.session.get(PurchaseRequisition, pr_id, with_for_update=True)
    if not pr:
        return {'error': 'Purchase Requisition not found'}, 404
    step = PRApproval.query.filter_by(pr_id=pr_id, approval_level=level).with_for_update().first()
    if not step:
        return {'error': f'Approval level {level} tidak ditemukan untuk PR ini'}, 404
    if step.status != 'pending':
        return {'error': f'Approval level {level} sudah berstatus {step.status}'}, 400
    prior = PRApproval.query.filter(PRApproval.pr_id == pr_id, PRApproval.approval_level < level, PRApproval.status != 'approved').first()
    if prior:
        return {'error': f'Level {prior.approval_level} harus di-approve dulu sebelum level {level}.'}, 400
    user = db.session.get(User, user_id)
    if step.assigned_user_id:
        if not user.is_super_admin and user_id != step.assigned_user_id:
            who = db.session.get(User, step.assigned_user_id)
            return {'error': f'Langkah ini khusus untuk {who.full_name or who.username if who else "penyetuju yang ditetapkan"}.'}, 403
        label = KIND_LABEL.get(step.kind, step.kind or 'Penyetuju')
    else:
        names = {ur.role.name for ur in user.roles if ur.role}
        if not user.is_super_admin and (not step.required_role or step.required_role.name not in names):
            return {'error': f'Approval level {level} butuh role "{step.required_role.name if step.required_role else "-"}" - akun Anda tidak punya role ini.'}, 403
        label = step.required_role.name if step.required_role else 'Penyetuju'

    step.approver_id = user_id
    step.approved_at = datetime.utcnow()
    step.comments = comments
    if action == 'approve':
        step.status = 'approved'
        remaining = PRApproval.query.filter(PRApproval.pr_id == pr_id, PRApproval.status != 'approved').count()
        if remaining == 0:
            pr.status = 'approved'
            pr.approved_by = user_id
            pr.approved_at = datetime.utcnow()
            pr.rejection_reason = None
        msg = f'Level {level} ({label}) disetujui' + (' - PR fully approved' if remaining == 0 else '')
    else:
        step.status = 'rejected'
        pr.status = 'rejected'
        pr.approved_by = user_id
        pr.approved_at = datetime.utcnow()
        pr.rejection_reason = rejection_reason or comments or ''
        msg = f'PR ditolak pada level {level} ({label})'
    return {'message': msg, 'pr_id': pr.id}, 200


def _send_step_email(step_id):
    from models.purchasing import PRApproval
    from models.user import User
    from models.approval_workflow import ApprovalEmailToken
    from utils.approval_email import issue_token_for_pr, base_url
    from utils.email_service import get_email_service
    step = db.session.get(PRApproval, step_id)
    if not step or step.status != 'pending' or not step.assigned_user_id:
        return 0
    user = db.session.get(User, step.assigned_user_id)
    svc = get_email_service()
    if not user or not user.email or not svc.is_configured():
        return 0
    raw = issue_token_for_pr(step, user)
    db.session.commit()
    kind_step = 'review' if step.kind == 'mengetahui' else 'approval'
    r = svc.send_approval_email(user.email, user.full_name or user.username, kind_step, pr_details(step.purchase_requisition), f'{base_url()}/approval-email/{raw}', f'{base_url()}/app/purchasing/requisitions/{step.pr_id}/edit')
    return 1 if r.get('success') else 0


def _notify_requester(pr_id):
    from models.purchasing import PurchaseRequisition
    from utils.email_service import get_email_service
    pr = db.session.get(PurchaseRequisition, pr_id)
    svc = get_email_service()
    if not pr or not pr.requester or not pr.requester.email or not svc.is_configured():
        return 0
    ok = pr.status == 'approved'
    msg = (f'Permintaan pembelian {pr.pr_number} sudah disetujui dan siap dijadikan PO.' if ok
           else f'Permintaan pembelian {pr.pr_number} ditolak.' + (f' Alasan: {pr.rejection_reason}' if pr.rejection_reason else ''))
    svc.send_custom_notification(pr.requester.email, f'{"Disetujui" if ok else "Ditolak"}: PR {pr.pr_number}', f'PR {pr.pr_number} {"disetujui" if ok else "ditolak"}', msg,
                                 'Buka PR', f'{__import__("utils.approval_email", fromlist=["base_url"]).base_url()}/app/purchasing/requisitions/{pr.id}', 'success' if ok else 'warning')
    return 1


def after_change(pr_id):
    """Dipanggil setelah pengajuan atau satu langkah selesai: email ke penyetuju langkah berikutnya, atau kabari pemohon di hasil akhir."""
    try:
        from models.purchasing import PurchaseRequisition, PRApproval
        pr = db.session.get(PurchaseRequisition, pr_id)
        if not pr:
            return
        if pr.status == 'submitted':
            nxt = PRApproval.query.filter_by(pr_id=pr_id, status='pending').order_by(PRApproval.approval_level).first()
            if nxt:
                _send_step_email(nxt.id)
        elif pr.status in ('approved', 'rejected'):
            _notify_requester(pr_id)
    except Exception:
        db.session.rollback()


def after_change_async(pr_id):
    from flask import current_app
    app = current_app._get_current_object()
    if app.config.get('TESTING'):
        return

    def run():
        with app.app_context():
            after_change(pr_id)
    threading.Thread(target=run, daemon=True).start()
