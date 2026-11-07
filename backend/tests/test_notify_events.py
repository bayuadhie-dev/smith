from datetime import datetime, timedelta


def _wf(db_session, test_user, test_material, status='pending_approval'):
    from models.purchasing import Supplier, PurchaseOrder
    from models.approval_workflow import ApprovalWorkflow, ApprovalConfiguration
    from models.user import Role, UserRole
    sup = Supplier(code='SUP-N', company_name='PT N'); db_session.add(sup); db_session.commit()
    po = PurchaseOrder(po_number='PO-N-1', supplier_id=sup.id, order_date=datetime(2026, 11, 5), status=status, total_amount=1000, currency='IDR', created_by=test_user.id)
    db_session.add(po); db_session.commit()
    role = Role(name='Mgr N', is_active=True); db_session.add(role); db_session.commit()
    db_session.add(ApprovalConfiguration(transaction_type='purchase_order', reviewer_roles=['Mgr N'], approver_roles=['Mgr N'], is_active=True))
    db_session.add(UserRole(user_id=test_user.id, role_id=role.id))
    wf = ApprovalWorkflow(transaction_type='purchase_order', transaction_id=po.id, transaction_number=po.po_number, status='pending_approval',
                          current_step='approval', submitted_by=test_user.id)
    db_session.add(wf); db_session.commit()
    return wf, po


def test_pending_and_result_notifications(app, db_session, test_user, test_material):
    from models import Notification
    from utils.notify_events import notify_workflow_pending, notify_workflow_result
    wf, po = _wf(db_session, test_user, test_material)
    notify_workflow_pending(wf.id)
    n = Notification.query.filter_by(user_id=test_user.id).all()
    assert any('Perlu persetujuan' in x.title and x.action_url.endswith(f'/purchase-orders/{po.id}') for x in n)
    wf.rejection_reason = 'harga'
    notify_workflow_result(wf.id, 'reject')
    assert Notification.query.filter(Notification.title.like('%ditolak')).count() == 1
    notify_workflow_result(wf.id, 'approve')
    assert Notification.query.filter(Notification.title.like('%disetujui')).count() == 1


def test_due_invoice_once_per_day(app, db_session, test_user):
    from models import Invoice, Notification
    from models.user import Role, UserRole, RolePermission, Permission
    from utils.notify_events import notify_due_invoices
    from utils.timezone import get_local_today
    perm = Permission.query.filter_by(name='finance.create').first() or Permission(name='finance.create', resource='finance', module='finance', action='create', is_active=True)
    db_session.add(perm); db_session.commit()
    role = Role(name='Fin N', is_active=True); db_session.add(role); db_session.commit()
    db_session.add(RolePermission(role_id=role.id, permission_id=perm.id)); db_session.add(UserRole(user_id=test_user.id, role_id=role.id)); db_session.commit()
    inv = Invoice(invoice_number='PI-N-1', invoice_type='purchase', invoice_date=get_local_today(), due_date=get_local_today() - timedelta(days=2),
                  status='sent', total_amount=500, balance_due=500, paid_amount=0)
    db_session.add(inv); db_session.commit()
    assert notify_due_invoices(app) == 1
    notify_due_invoices(app)
    assert Notification.query.filter(Notification.title.like('Faktur PI-N-1 lewat%')).count() == 1


def test_preferences_api_and_respected(client, auth_headers, db_session, test_user, test_material):
    from models import Notification
    from utils.notify_events import notify_workflow_result
    wf, po = _wf(db_session, test_user, test_material)
    r = client.put('/api/notifications/preferences', headers=auth_headers, json={'preferences': [
        {'key': 'approval_result', 'in_app': False, 'email': False}, {'key': 'approval_request', 'in_app': False}]})
    assert r.status_code == 200
    prefs = {p['key']: p for p in r.get_json()['preferences']}
    assert prefs['approval_result']['in_app'] is False and prefs['approval_request']['in_app'] is True  # wajib
    notify_workflow_result(wf.id, 'approve')
    assert Notification.query.filter(Notification.title.like('%disetujui')).count() == 0


def test_department_visibility(app, db_session, test_user):
    """Kejadian keuangan tidak terlihat dan tidak diterima user tanpa izin keuangan."""
    from models import User, Notification
    from models.user import Role, UserRole, RolePermission, Permission
    from utils.notify_events import notify_event, user_can_see_event
    from werkzeug.security import generate_password_hash
    def mk(name, perm):
        u = User(username=name, email=f'{name}@x.com', full_name=name, password_hash='x', is_active=True)
        db_session.add(u); db_session.commit()
        pm = Permission.query.filter_by(name=perm).first() or Permission(name=perm, resource=perm.split('.')[0], module=perm.split('.')[0], action='view', is_active=True)
        db_session.add(pm); db_session.commit()
        r = Role(name='R-' + name, is_active=True); db_session.add(r); db_session.commit()
        db_session.add(RolePermission(role_id=r.id, permission_id=pm.id)); db_session.add(UserRole(user_id=u.id, role_id=r.id)); db_session.commit()
        return u
    fin, wh = mk('fin', 'finance.view'), mk('wh', 'warehouse.view')
    assert user_can_see_event(fin, 'invoice_due') and not user_can_see_event(wh, 'invoice_due')
    assert user_can_see_event(wh, 'low_stock') and not user_can_see_event(fin, 'low_stock')
    notify_event('invoice_due', 'Faktur X jatuh tempo', 'x', ref_type='purchase_invoice', ref_id=1, extra_users=[wh.id])
    assert Notification.query.filter_by(user_id=fin.id).count() == 1 and Notification.query.filter_by(user_id=wh.id).count() == 0
