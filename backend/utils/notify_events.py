"""Notifikasi in-app (ikon lonceng) untuk kejadian transaksi: approval, penerimaan barang, faktur jatuh tempo."""
from datetime import datetime, timedelta

from models import db

# event_key -> (label, deskripsi, lonceng wajib?, izin yang boleh melihat/menerima; None = semua user)
# Kejadian keuangan hanya untuk yang punya izin keuangan, dst: user tidak melihat atau menerima kejadian departemen lain.
EVENTS = {
    'approval_request': ('Permintaan persetujuan', 'Dokumen menunggu peninjauan atau persetujuan Anda', True, None),
    'approval_result': ('Hasil persetujuan', 'Dokumen yang Anda ajukan disetujui atau ditolak', False, None),
    'grn_received': ('Barang diterima', 'Penerimaan barang baru dicatat', False, ('purchasing.view', 'warehouse.view', 'finance.view')),
    'invoice_due': ('Faktur pembelian jatuh tempo', 'Faktur pembelian jatuh tempo besok atau sudah lewat', False, ('finance.view',)),
    'ar_overdue': ('Piutang lewat jatuh tempo', 'Faktur penjualan belum dibayar setelah jatuh tempo', False, ('finance.view',)),
    'wo_completed': ('SPK selesai', 'Surat perintah kerja produksi selesai', False, ('production.view',)),
    'qc_failed': ('Pemeriksaan QC gagal', 'Hasil pemeriksaan kualitas tidak lolos', False, ('quality.view', 'production.view')),
    'shipment_delivered': ('Pengiriman sampai', 'Pengiriman ke pelanggan berstatus terkirim', False, ('shipping.view', 'sales.view')),
    'low_stock': ('Stok di bawah minimum', 'Persediaan di bawah batas minimum (dicek harian)', False, ('warehouse.view', 'purchasing.view')),
    'batch_expiring': ('Batch hampir kedaluwarsa', 'Batch stok kedaluwarsa dalam 30 hari (dicek harian)', False, ('warehouse.view', 'quality.view')),
    'machine_breakdown': ('Mesin rusak', 'Perawatan darurat (breakdown) dimulai pada sebuah mesin', False, ('maintenance.view', 'production.view')),
    'leave_request': ('Pengajuan cuti', 'Karyawan mengajukan cuti baru', False, ('hr.view',)),
}


def user_can_see_event(user, event_key):
    from utils.auth_decorators import _get_user_permissions
    cfg = EVENTS.get(event_key)
    if not cfg:
        return False
    if cfg[3] is None or getattr(user, 'is_super_admin', False):
        return True
    return bool(set(cfg[3]) & _get_user_permissions(user))


def pref_enabled(user_id, event_key, channel):
    """channel: 'in_app' atau 'email'. Tanpa baris preferensi = aktif. Lonceng permintaan persetujuan selalu aktif."""
    if channel == 'in_app' and EVENTS.get(event_key, ('', '', False, None))[2]:
        return True
    from models import NotificationPreference
    row = NotificationPreference.query.filter_by(user_id=user_id, event_key=event_key).first()
    return True if row is None else bool(getattr(row, channel))


def notify_event(event_key, title, message, url=None, ref_type=None, ref_id=None, kind='info', priority='normal',
                 category='system', extra_users=None, dedupe_day=False):
    """Kirim ke user yang berhak melihat kejadian ini (izin departemen) ditambah penerima langsung, sesuai preferensinya."""
    try:
        from models import User
        cfg = EVENTS[event_key]
        ids = [u.id for u in users_with_permission(*cfg[3])] if cfg[3] else []
        for uid in (extra_users or []):
            u = db.session.get(User, uid) if uid else None
            if u and u.is_active and user_can_see_event(u, event_key):
                ids.append(uid)
        _notify(ids, title, message, url=url, ref_type=ref_type, ref_id=ref_id, kind=kind, priority=priority,
                category=category, dedupe_day=dedupe_day, event_key=event_key)
    except Exception:
        db.session.rollback()


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


def _notify(user_ids, title, message, url=None, ref_type=None, ref_id=None, kind='info', priority='normal', category='purchasing', dedupe_day=False, event_key=None):
    from utils.send_notification import send_notification
    from models import Notification
    seen = set()
    for uid in user_ids:
        if uid in seen or not uid:
            continue
        seen.add(uid)
        if event_key:
            from models import User
            u = db.session.get(User, uid)
            if not u or not user_can_see_event(u, event_key) or not pref_enabled(uid, event_key, 'in_app'):
                continue
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
                kind='warning', priority='high', event_key='approval_request')
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
                    url=_doc_url(wf.transaction_type, wf.transaction_id), ref_type=wf.transaction_type, ref_id=wf.transaction_id, kind='success', event_key='approval_result')
        else:
            _notify([wf.submitted_by], f'{label} {num} ditolak', f'{label} {num} ditolak. Alasan: {wf.rejection_reason or "-"}',
                    url=_doc_url(wf.transaction_type, wf.transaction_id), ref_type=wf.transaction_type, ref_id=wf.transaction_id, kind='error', priority='high', event_key='approval_result')
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
                url=DOC_URL['grn'].format(id=grn.id), ref_type='grn', ref_id=grn.id, kind='info', event_key='grn_received')
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
                    kind='error' if overdue else 'warning', priority='high' if overdue else 'normal', category='finance', dedupe_day=True, event_key='invoice_due')
            count += 1
        return count


# ---------------------------------------------------------------- kejadian modul lain
def notify_wo_completed(wo):
    notify_event('wo_completed', f'SPK selesai: {wo.wo_number}', f'SPK {wo.wo_number} sudah diselesaikan.',
                 url=f'/app/production/work-orders/{wo.id}', ref_type='work_order', ref_id=wo.id, kind='success', category='production')


def notify_qc_failed(test):
    notify_event('qc_failed', f'QC gagal: {test.test_number}', f'Pemeriksaan {test.test_number}' + (f' (batch {test.batch_number})' if test.batch_number else '') + ' tidak lolos.',
                 url='/app/quality', ref_type='quality_test', ref_id=test.id, kind='error', priority='high', category='quality')


def notify_shipment_delivered(order):
    notify_event('shipment_delivered', f'Pengiriman sampai: {order.tracking_number or order.id}', f'Pengiriman {order.tracking_number or ""} sudah berstatus terkirim.',
                 url=f'/app/shipping/orders/{order.id}', ref_type='shipping_order', ref_id=order.id, kind='success', category='shipping')


def notify_machine_breakdown(record):
    name = record.machine.name if getattr(record, 'machine', None) else 'mesin'
    notify_event('machine_breakdown', f'Mesin rusak: {name}', f'Perawatan {record.maintenance_type} dimulai pada {name} ({record.record_number}).',
                 url='/app/maintenance', ref_type='maintenance_record', ref_id=record.id, kind='error', priority='high', category='maintenance')


def notify_leave_request(leave):
    try:
        from models.hr import Employee
        emp = db.session.get(Employee, leave.employee_id)
        who = f'{emp.first_name} {emp.last_name}'.strip() if emp else 'Karyawan'
    except Exception:
        who = 'Karyawan'
    notify_event('leave_request', f'Pengajuan cuti: {who}', f'{who} mengajukan cuti {leave.leave_type} ({leave.total_days} hari).',
                 url='/app/hr', ref_type='leave', ref_id=leave.id, kind='info', category='hr')


# ---------------------------------------------------------------- pengecekan harian
def check_low_stock(app):
    with app.app_context():
        from models import Inventory
        from models.product import Material
        rows = (db.session.query(Material, db.func.coalesce(db.func.sum(Inventory.quantity_available), 0))
                .outerjoin(Inventory, Inventory.material_id == Material.id)
                .filter(Material.is_active.is_(True), Material.min_stock_level > 0).group_by(Material.id).all())
        low = [(m, float(q)) for m, q in rows if float(q) < float(m.min_stock_level or 0)]
        if not low:
            return 0
        top = ', '.join(f'{m.name} ({q:g}/{float(m.min_stock_level):g})' for m, q in low[:3])
        more = f' dan {len(low) - 3} lainnya' if len(low) > 3 else ''
        notify_event('low_stock', f'{len(low)} barang di bawah stok minimum', f'{top}{more}.', url='/app/warehouse', ref_type='low_stock', ref_id=0,
                     kind='warning', category='inventory', dedupe_day=True)
        return len(low)


def check_batch_expiring(app):
    with app.app_context():
        from models import Inventory
        from utils.timezone import get_local_today
        today = get_local_today()
        rows = Inventory.query.filter(Inventory.is_active.is_(True), Inventory.quantity_on_hand > 0, Inventory.expiry_date.isnot(None),
                                      Inventory.expiry_date >= today, Inventory.expiry_date <= today + timedelta(days=30)).all()
        if not rows:
            return 0
        notify_event('batch_expiring', f'{len(rows)} batch hampir kedaluwarsa', 'Ada batch stok yang kedaluwarsa dalam 30 hari. Cek di modul Gudang.',
                     url='/app/warehouse', ref_type='batch_expiring', ref_id=0, kind='warning', category='inventory', dedupe_day=True)
        return len(rows)


def check_ar_overdue(app):
    with app.app_context():
        from models import Invoice
        from utils.timezone import get_local_today
        today = get_local_today()
        rows = Invoice.query.filter(Invoice.invoice_type == 'sales', Invoice.status.notin_(['paid', 'cancelled', 'draft']),
                                    Invoice.balance_due > 0, Invoice.due_date.isnot(None), Invoice.due_date < today).all()
        if not rows:
            return 0
        notify_event('ar_overdue', f'{len(rows)} faktur penjualan lewat jatuh tempo', 'Ada piutang yang belum dibayar setelah jatuh tempo. Buka Piutang Usaha untuk rinciannya.',
                     url='/app/accounting/receivable', ref_type='ar_overdue', ref_id=0, kind='warning', priority='high', category='finance', dedupe_day=True)
        return len(rows)


def notify_pending_async(workflow_id):
    """Lonceng penyetuju untuk dokumen non-PO (PO memakai send_workflow_emails_async yang sudah memanggil ini)."""
    import threading
    from flask import current_app
    app = current_app._get_current_object()
    if app.config.get('TESTING'):
        return

    def run():
        with app.app_context():
            notify_workflow_pending(workflow_id)
    threading.Thread(target=run, daemon=True).start()
