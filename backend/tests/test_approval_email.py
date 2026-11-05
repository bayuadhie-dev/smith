import pytest
from datetime import datetime, timedelta


@pytest.fixture
def po_wf(db_session, test_user, test_material):
    from models.purchasing import Supplier, PurchaseOrder, PurchaseOrderItem
    from models.approval_workflow import ApprovalWorkflow, ApprovalConfiguration
    from models.user import Role, UserRole
    sup = Supplier(code='SUP-AP', company_name='PT AP'); db_session.add(sup); db_session.commit()
    po = PurchaseOrder(po_number='PO-AP-1', supplier_id=sup.id, order_date=datetime(2026, 11, 5), status='pending_approval',
                       subtotal=1000, tax_amount=110, total_amount=1110, currency='IDR', created_by=test_user.id)
    db_session.add(po); db_session.commit()
    db_session.add(PurchaseOrderItem(po_id=po.id, line_number=1, material_id=test_material.id, quantity=10, uom='KG',
                                     unit_price=100, total_price=1000, description='Nama PO', notes='ket item'))
    role = Role(name='Mgr Test', is_active=True); db_session.add(role); db_session.commit()
    db_session.add(ApprovalConfiguration(transaction_type='purchase_order', reviewer_roles=['Mgr Test'], approver_roles=['Mgr Test'], is_active=True))
    db_session.add(UserRole(user_id=test_user.id, role_id=role.id))
    wf = ApprovalWorkflow(transaction_type='purchase_order', transaction_id=po.id, transaction_number=po.po_number,
                          status='pending_approval', current_step='approval', submitted_by=test_user.id)
    db_session.add(wf); db_session.commit()
    return wf, po


def _token(db_session, wf, user, step='approval'):
    from utils import approval_email as ae
    raw = ae.issue_token(wf, user, step); db_session.commit()
    return raw


def test_get_does_not_change_anything(client, db_session, test_user, po_wf):
    wf, po = po_wf
    raw = _token(db_session, wf, test_user)
    r = client.get(f'/api/approval-email/{raw}')
    assert r.status_code == 200
    d = r.get_json()['details']
    assert d['number'] == 'PO-AP-1' and d['items'][0]['nama'] == 'Nama PO' and d['items'][0]['keterangan'] == 'ket item'
    db_session.refresh(wf); assert wf.status == 'pending_approval'


def test_approve_once_then_token_dead(client, db_session, test_user, po_wf):
    wf, po = po_wf
    raw = _token(db_session, wf, test_user)
    r = client.post(f'/api/approval-email/{raw}', json={'action': 'approve'})
    assert r.status_code == 200, r.get_json()
    db_session.refresh(wf); db_session.refresh(po)
    assert wf.status == 'approved' and po.status == 'approved'
    assert client.post(f'/api/approval-email/{raw}', json={'action': 'approve'}).status_code == 400
    assert client.get(f'/api/approval-email/{raw}').status_code == 400


def test_reject_needs_reason(client, db_session, test_user, po_wf):
    wf, po = po_wf
    raw = _token(db_session, wf, test_user)
    assert client.post(f'/api/approval-email/{raw}', json={'action': 'reject'}).status_code == 400
    r = client.post(f'/api/approval-email/{raw}', json={'action': 'reject', 'notes': 'harga mahal'})
    assert r.status_code == 200
    db_session.refresh(wf); assert wf.status == 'rejected' and 'harga mahal' in wf.rejection_reason


def test_expired_unknown_and_stale_step(client, db_session, test_user, po_wf):
    from models.approval_workflow import ApprovalEmailToken
    wf, po = po_wf
    raw = _token(db_session, wf, test_user)
    ApprovalEmailToken.query.update({'expires_at': datetime.utcnow() - timedelta(minutes=1)}); db_session.commit()
    assert client.get(f'/api/approval-email/{raw}').status_code == 400
    assert client.get('/api/approval-email/abc').status_code == 400
    raw2 = _token(db_session, wf, test_user, step='review')
    assert client.get(f'/api/approval-email/{raw2}').status_code == 400  # workflow sudah di tahap approval


def test_role_revoked_blocks(client, db_session, test_user, po_wf):
    from models.user import User
    wf, po = po_wf
    other = User(username='u2', email='u2@x.com', full_name='U2', password_hash='x', is_active=True)
    db_session.add(other); db_session.commit()
    raw = _token(db_session, wf, other)
    assert client.post(f'/api/approval-email/{raw}', json={'action': 'approve'}).status_code == 403
    db_session.refresh(wf); assert wf.status == 'pending_approval'


def test_approvers_lookup_and_email_body(app, db_session, test_user, po_wf):
    from utils import approval_email as ae
    from utils.email_service import EmailService
    wf, po = po_wf
    assert test_user.id in [u.id for u in ae.approvers_for(wf, 'approval')]
    sent = {}
    e = EmailService(); e.send_email = lambda **k: sent.update(k) or {'success': True}
    e.send_approval_email('a@b.c', 'Budi', 'approval', ae.workflow_details(wf), 'https://x/approval-email/T', 'https://x/app')
    assert 'Nama PO' in sent['html'] and 'Setujui' in sent['html'] and 'aksi=tolak' in sent['html'] and 'ket item' in sent['html']
