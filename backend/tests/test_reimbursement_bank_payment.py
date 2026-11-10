from datetime import date


def _setup(db_session, test_user):
    from models.expense import Expense, Reimbursement
    from models.finance import GlobalAccountDefault
    from models.hr import Employee
    from tests.test_finance_sync_regressions import _acc, _bank
    bank = _bank(db_session)
    hut = _acc(db_session, '9-1000')
    db_session.add(GlobalAccountDefault(transaction_key='hutang_karyawan', account_id=hut.id)); db_session.commit()
    emp = Employee(employee_number='E-RB', first_name='A', last_name='B', full_name='A B', status='active'); db_session.add(emp); db_session.commit()
    r = Reimbursement(employee_id=emp.id, employee_name='A B', total_amount=50000, status='approved', reimbursement_number='RB-1', created_by=test_user.id); db_session.add(r); db_session.commit()
    return r, bank, hut


def test_pay_requires_bank_and_posts_to_chosen_account(client, auth_headers, db_session, test_user):
    from models.finance import AccountingEntry
    r, bank, hut = _setup(db_session, test_user)
    bad = client.post(f'/api/expenses/reimbursements/{r.id}/pay', json={}, headers=auth_headers)
    assert bad.status_code == 400 and 'Kas/Bank' in bad.get_json()['error']
    ok = client.post(f'/api/expenses/reimbursements/{r.id}/pay', json={'bank_account_id': bank.id, 'payment_date': '2026-11-05', 'payment_reference': 'TRF-1'}, headers=auth_headers)
    assert ok.status_code == 200, ok.get_json()
    db_session.refresh(r)
    assert r.status == 'paid' and r.paid_from_account_id == bank.id and str(r.paid_date) == '2026-11-05'
    es = AccountingEntry.query.filter_by(reference_type='reimbursement', reference_id=r.id).all()
    assert any(e.account_id == bank.id and float(e.credit_amount) == 50000 for e in es)
    assert any(e.account_id == hut.id and float(e.debit_amount) == 50000 for e in es)
    d = client.get(f'/api/expenses/reimbursements/{r.id}', headers=auth_headers).get_json()
    assert 'Kas' in (d['paid_from_account'] or '') or d['paid_from_account']
