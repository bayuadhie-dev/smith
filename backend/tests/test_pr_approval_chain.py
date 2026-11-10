from datetime import date

import pytest


@pytest.fixture
def chain(db_session, test_user):
    from models.user import User
    from utils.pr_approval import set_chain
    fin = User(username='fin', email='finance@x.id', full_name='Finance', password_hash='x', is_active=True)
    boss = User(username='hizkia', email='hizkia@x.id', full_name='Hizkia Wijaya', password_hash='x', is_active=True)
    other = User(username='other', email='o@x.id', full_name='Orang Lain', password_hash='x', is_active=True)
    db_session.add_all([fin, boss, other]); db_session.commit()
    set_chain([{'kind': 'mengetahui', 'user_id': fin.id}, {'kind': 'menyetujui', 'user_id': boss.id}])
    return fin, boss, other


def _pr(client, headers):
    r = client.post('/api/purchasing/purchase-requisitions', headers=headers, json={'department': 'IT', 'items': [
        {'item_name': 'Langganan', 'quantity': 1, 'uom': 'bln', 'estimated_unit_price': 10}]})
    pid = r.get_json()['id']
    s = client.post(f'/api/purchasing/purchase-requisitions/{pid}/submit', headers=headers)
    assert s.status_code == 200, s.get_json()
    return pid, s.get_json()['pr']


def test_chain_creates_two_assigned_steps_and_never_auto_approves(client, auth_headers, db_session, chain):
    fin, boss, _ = chain
    pid, pr = _pr(client, auth_headers)
    assert pr['status'] == 'submitted'
    steps = pr['approval_steps']
    assert [(s['kind'], s['assigned_user_id']) for s in steps] == [('mengetahui', fin.id), ('menyetujui', boss.id)]


def test_only_assigned_user_can_act_in_order_via_email_links(client, auth_headers, db_session, chain):
    from models.purchasing import PRApproval, PurchaseRequisition
    from utils import approval_email as ae
    fin, boss, other = chain
    pid, _ = _pr(client, auth_headers)
    s1 = PRApproval.query.filter_by(pr_id=pid, approval_level=1).first()
    s2 = PRApproval.query.filter_by(pr_id=pid, approval_level=2).first()
    t_boss = ae.issue_token_for_pr(s2, boss); t_fin = ae.issue_token_for_pr(s1, fin); db_session.commit()
    # tahap Hizkia belum sampai
    assert client.get(f'/api/approval-email/{t_boss}').status_code == 400
    d = client.get(f'/api/approval-email/{t_fin}')
    assert d.status_code == 200 and d.get_json()['details']['number'] == PurchaseRequisition.query.get(pid).pr_number
    assert d.get_json()['step'] == 'review'
    assert client.post(f'/api/approval-email/{t_fin}', json={'action': 'approve'}).status_code == 200
    assert client.post(f'/api/approval-email/{t_fin}', json={'action': 'approve'}).status_code == 400      # sekali pakai
    assert PurchaseRequisition.query.get(pid).status == 'submitted'
    t_boss = ae.issue_token_for_pr(PRApproval.query.filter_by(pr_id=pid, approval_level=2).first(), boss); db_session.commit()
    assert client.post(f'/api/approval-email/{t_boss}', json={'action': 'reject'}).status_code == 400     # tolak wajib alasan
    assert client.post(f'/api/approval-email/{t_boss}', json={'action': 'approve'}).status_code == 200
    db_session.expire_all()
    assert PurchaseRequisition.query.get(pid).status == 'approved'


def test_stranger_blocked_and_reject_via_email_rejects_pr(client, auth_headers, db_session, chain):
    from models.purchasing import PRApproval, PurchaseRequisition
    from utils import approval_email as ae
    from utils import pr_approval as pra
    fin, boss, other = chain
    pid, _ = _pr(client, auth_headers)
    resp, status = pra.step_action(pid, 1, other.id, 'approve')
    assert status == 403
    db_session.rollback()
    t = ae.issue_token_for_pr(PRApproval.query.filter_by(pr_id=pid, approval_level=1).first(), fin); db_session.commit()
    assert client.post(f'/api/approval-email/{t}', json={'action': 'reject', 'notes': 'tidak perlu'}).status_code == 200
    db_session.expire_all()
    pr = PurchaseRequisition.query.get(pid)
    assert pr.status == 'rejected' and 'tidak perlu' in (pr.rejection_reason or '')


def test_print_shows_requester_and_chain_names(client, auth_headers, db_session, chain):
    from models.document_management import Document
    pid, _ = _pr(client, auth_headers)
    d = db_session.get(Document, client.post(f'/api/documents/generate-from-purchase-requisition/{pid}', headers=auth_headers).get_json()['document_id'])
    assert d.document_data['mengetahui_name'] == 'Finance' and d.document_data['menyetujui_name'] == 'Hizkia Wijaya'
    assert 'Hizkia Wijaya' in d.html_content
