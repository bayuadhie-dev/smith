import pytest


@pytest.fixture
def setup(db_session, test_user):
    from models.expense import Expense
    from models.finance import GlobalAccountDefault
    from models.hr import Employee
    from models.user import User
    from tests.test_finance_sync_regressions import _acc, _bank
    from utils.pr_approval import set_chain
    bank = _bank(db_session)
    db_session.add(GlobalAccountDefault(transaction_key='hutang_karyawan', account_id=_acc(db_session, '9-1000').id))
    fin = User(username='fin', email='f@x.id', full_name='Jessica', password_hash='x', is_active=True)
    boss = User(username='boss', email='b@x.id', full_name='Hizkia Wijaya', password_hash='x', is_active=True)
    emp = Employee(employee_number='E-RC', first_name='Budi', last_name='S', full_name='Budi S', status='active')
    db_session.add_all([fin, boss, emp]); db_session.commit()
    set_chain([{'kind': 'mengetahui', 'user_id': fin.id}, {'kind': 'menyetujui', 'user_id': boss.id}])
    from datetime import date
    e = Expense(expense_number='EXP-RC-1', employee_id=emp.id, expense_date=date.today(), expense_category='Transport', expense_type='reimbursement', description='Taksi', amount=75000, amount_base=75000,
                currency='IDR', status='approved', created_by=test_user.id)
    db_session.add(e); db_session.commit()
    return fin, boss, emp, e, bank


def _create(client, headers, e):
    r = client.post('/api/expenses/reimbursements', json={'expense_ids': [e.id]}, headers=headers)
    assert r.status_code == 201, r.get_json()
    return r.get_json()['reimbursement']['id']


def test_chain_steps_email_links_pay_by_finance_and_print(client, auth_headers, db_session, setup):
    from models.expense import Reimbursement, ReimbursementApproval
    from models.document_management import Document
    from utils import reimb_approval as ra
    from utils.approval_email import _hash
    import secrets
    fin, boss, emp, e, bank = setup
    rid = _create(client, auth_headers, e)
    steps = ReimbursementApproval.query.filter_by(reimbursement_id=rid).order_by(ReimbursementApproval.approval_level).all()
    assert [(s.kind, s.assigned_user_id) for s in steps] == [('mengetahui', fin.id), ('menyetujui', boss.id)]
    assert client.post(f'/api/expenses/reimbursements/{rid}/approve', json={}, headers=auth_headers).status_code == 400   # approve lama diblokir

    def token(step, user):
        from models.approval_workflow import ApprovalEmailToken
        from datetime import datetime, timedelta
        raw = secrets.token_urlsafe(16)
        db_session.add(ApprovalEmailToken(token_hash=_hash(raw), workflow_id=None, reimbursement_approval_id=step.id, user_id=user.id,
                                          step='review' if step.kind == 'mengetahui' else 'approval', expires_at=datetime.utcnow() + timedelta(days=1)))
        db_session.commit()
        return raw
    assert client.post(f'/api/documents/generate-from-reimbursement/{rid}', headers=auth_headers).status_code == 400   # belum dibayar: tidak bisa dicetak
    t_boss = token(steps[1], boss); t_fin = token(steps[0], fin)
    assert client.get(f'/api/approval-email/{t_boss}').status_code == 400          # belum giliran
    g = client.get(f'/api/approval-email/{t_fin}')
    assert g.status_code == 200 and g.get_json()['details']['number'] == Reimbursement.query.get(rid).reimbursement_number
    assert client.post(f'/api/approval-email/{t_fin}', json={'action': 'approve'}).status_code == 200
    assert client.post(f'/api/approval-email/{t_boss}', json={'action': 'approve'}).status_code == 200
    db_session.expire_all()
    r = Reimbursement.query.get(rid)
    assert r.status == 'approved'
    # Finance (pihak Mengetahui) boleh membayar, orang lain tidak
    from flask_jwt_extended import create_access_token
    with client.application.app_context():
        hdr = {'Authorization': f'Bearer {create_access_token(identity=str(fin.id))}'}
    from models.user import User
    stranger = User(username='str', email='s@x.id', full_name='Orang Lain', password_hash='x', is_active=True); db_session.add(stranger); db_session.commit()
    with client.application.app_context():
        hdr2 = {'Authorization': f'Bearer {create_access_token(identity=str(stranger.id))}'}
    assert client.post(f'/api/expenses/reimbursements/{rid}/pay', json={'bank_account_id': bank.id}, headers=hdr2).status_code == 403
    pay = client.post(f'/api/expenses/reimbursements/{rid}/pay', json={'bank_account_id': bank.id}, headers=hdr)
    assert pay.status_code == 200, pay.get_json()
    db_session.expire_all()
    assert Reimbursement.query.get(rid).status == 'paid'
    d = db_session.get(Document, client.post(f'/api/documents/generate-from-reimbursement/{rid}', headers=auth_headers).get_json()['document_id'])   # sudah dibayar di atas
    dd = d.document_data
    assert dd['employee_name'] == 'Budi S' and dd['mengetahui_name'] == 'Jessica' and dd['menyetujui_name'] == 'Hizkia Wijaya'
    assert dd['lines'][0]['uraian'] == 'Taksi' and dd['terbilang'].startswith('Tujuh puluh lima ribu') and 'Hizkia Wijaya' in d.html_content


def test_reject_requires_reason_and_rejects(client, auth_headers, db_session, setup):
    from models.expense import Reimbursement
    from utils import reimb_approval as ra
    fin, boss, emp, e, bank = setup
    rid = _create(client, auth_headers, e)
    resp, status = ra.step_action(rid, 1, fin.id, 'reject', 'bukan biaya kantor')
    assert status == 200
    db_session.commit()
    assert Reimbursement.query.get(rid).status == 'rejected'

