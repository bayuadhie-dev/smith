"""Notifikasi in-app (ikon lonceng) untuk kejadian transaksi: approval, penerimaan barang, faktur jatuh tempo."""
from datetime import datetime, timedelta

from models import db

DOC_URL = {
    'purchase_order': '/app/purchasing/purchase-orders/{id}',
    'grn': '/app/purchasing/grn/{id}',
    'purchase_invoice': '/app/purchasing/invoices/{id}',
}
TYPE_LABEL = {'purchase_order': 'Purchase Order', 'sales_order': 'Sales Order', 'stock_transfer': 'Transfer Stok',
              'stock_opname': 'Stok Opname', 'inventory_adjustment': 'Penyesuaian Stok'}


def users_with_permission(*perms):
    """User aktif yang punya salah satu izin lewat rolenya (super admin tidak ikut, kecuali punya role)."""
    from models.user import User, UserRole, Role, RolePermission, Permission
    return (User.query.join(UserRole, UserRole.user_id == User.id).join(Role, Role.id == UserRole.role_id)
            .join(RolePermission, RolePermission.role_id == Role.id).join(Permission, Permission.id == RolePermission.permission_id)
            .filter(Permission.name.in_(perms), User.is_active.is_(True), Role.is_active.is_(True)).distinct().all())


def _notify(user_ids, title, message, url=None, ref_type=None, ref_id=None, kind='info', priority='normal', category='purchasing', dedupe_day=False):
    from utils.send_notification import send_notification
    from models import Notification
    seen = set()
    for uid in user_ids:
        if uid in seen or not uid:
            continue
        seen.add(uid)
        if dedupe_day:
            start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            if Notification.query.filter(Notification.user_id == uid, Notification.title == title, Notification.reference_type == ref_type,
                                         Notification.reference_id == ref_id, Notification.created_at >= start).first():
                continue
        send_notification(uid, title, message, category=category, notification_type=kind, priority=priority,
                          action_url=url, reference_type=ref_type, reference_id=ref_id)


def _doc_url(transaction_type, transaction_id):
    tpl = DOC_URL.get(transaction_type)
    return tpl.format(id=transaction_id) if tpl else '/app/approvals'


def notify_workflow_pending(workflow_id):
    """Penyetuju/peninjau tahap saat ini diberi tahu ada dokumen menunggu."""
    try:
        from models.approval_workflow import ApprovalWorkflow
        from utils.approval_email import STEP_OF_STATUS, approvers_for
        wf = db.session.get(ApprovalWorkflow, workflow_id)
        if not wf or wf.status not in STEP_OF_STATUS:
            return
        step = STEP_OF_STATUS[wf.status]
        label = TYPE_LABEL.get(wf.transaction_type, wf.transaction_type)
        users = [u.id for u in approvers_for(wf, step)]
        _notify(users, f'{"Perlu ditinjau" if step == "review" else "Perlu persetujuan"}: {label} {wf.transaction_number or wf.transaction_id}',
                f'{label} {wf.transaction_number or ""} menunggu {"peninjauan" if step == "review" else "persetujuan"} Anda.',
                url=_doc_url(wf.transaction_type, wf.transaction_id), ref_type=wf.transaction_type, ref_id=wf.transaction_id,
                kind='warning', priority='high')
    except Exception:
        db.session.rollback()


def notify_workflow_result(workflow_id, action):
    """Pengaju diberi tahu hasil approve atau tolak."""
    try:
        from models.approval_workflow import ApprovalWorkflow
        wf = db.session.get(ApprovalWorkflow, workflow_id)
        if not wf or not wf.submitted_by:
            return
        label = TYPE_LABEL.get(wf.transaction_type, wf.transaction_type)
        num = wf.transaction_number or wf.transaction_id
        if action == 'approve':
            _notify([wf.submitted_by], f'{label} {num} disetujui', f'{label} {num} sudah disetujui dan bisa diproses.',
                    url=_doc_url(wf.transaction_type, wf.transaction_id), ref_type=wf.transaction_type, ref_id=wf.transaction_id, kind='success')
        else:
            _notify([wf.submitted_by], f'{label} {num} ditolak', f'{label} {num} ditolak. Alasan: {wf.rejection_reason or "-"}',
                    url=_doc_url(wf.transaction_type, wf.transaction_id), ref_type=wf.transaction_type, ref_id=wf.transaction_id, kind='error', priority='high')
    except Exception:
        db.session.rollback()


def notify_grn_received(grn):
    """Pembuat PO dan tim finance tahu barang sudah diterima (siap difakturkan)."""
    try:
        users = [grn.purchase_order.created_by] if grn.purchase_order and grn.purchase_order.created_by else []
        users += [u.id for u in users_with_permission('finance.create')]
        users = [u for u in users if u != getattr(grn, 'received_by', None)]
        _notify(users, f'Barang diterima: {grn.grn_number}',
                f'Penerimaan {grn.grn_number}' + (f' untuk PO {grn.purchase_order.po_number}' if grn.purchase_order else '') + ' sudah dicatat.',
                url=DOC_URL['grn'].format(id=grn.id), ref_type='grn', ref_id=grn.id, kind='info')
    except Exception:
        db.session.rollback()


def notify_due_invoices(app):
    """Harian: faktur pembelian yang jatuh tempo besok atau sudah lewat, ke tim finance (sekali per hari per faktur)."""
    with app.app_context():
        from models import Invoice
        from utils.timezone import get_local_today
        today = get_local_today()
        finance = [u.id for u in users_with_permission('finance.create')]
        if not finance:
            return 0
        rows = Invoice.query.filter(Invoice.invoice_type == 'purchase', Invoice.status.notin_(['paid', 'cancelled', 'draft']),
                                    Invoice.balance_due > 0, Invoice.due_date.isnot(None), Invoice.due_date <= today + timedelta(days=1)).all()
        count = 0
        for inv in rows:
            overdue = inv.due_date < today
            title = f'Faktur {inv.invoice_number} ' + ('lewat jatuh tempo' if overdue else 'jatuh tempo besok')
            _notify(finance, title, f'Sisa tagihan Rp {float(inv.balance_due or 0):,.0f}'.replace(',', '.') + f', jatuh tempo {inv.due_date.strftime("%d/%m/%Y")}.',
                    url=DOC_URL['purchase_invoice'].format(id=inv.id), ref_type='purchase_invoice', ref_id=inv.id,
                    kind='error' if overdue else 'warning', priority='high' if overdue else 'normal', category='finance', dedupe_day=True)
            count += 1
        return count
