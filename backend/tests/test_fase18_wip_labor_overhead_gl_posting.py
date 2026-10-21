"""
Fase 18 (fix_report_3.md, 2026-10-02): labor/overhead cost absorbed into
WIPBatch via create_work_order_production_record()'s per-shift job
costing never posted to GL anywhere - found right after fixing the
raw-material GL gap (Fase 14), this is the same shape of gap for the
other half of manufacturing cost. Owner-confirmed design: post per shift
(not lump-sum at WO completion) - Dr Persediaan Barang Dalam Proses (WIP)
/ Cr payroll_expense (labor) or beban_operasional (overhead).
"""
from models.production import Machine, WorkOrder


def _setup_wo_and_accounts(db_session, test_product):
    from models.finance import Account, GlobalAccountDefault

    machine = Machine(code='MC-F18', name='Test Machine F18', machine_type='test', status='active')
    db_session.add(machine)
    db_session.commit()
    wo = WorkOrder(wo_number='WO-F18-001', product_id=test_product.id, quantity=100, uom='PCS', status='in_progress', machine_id=machine.id)
    db_session.add(wo)
    db_session.commit()

    wip = Account(account_code='TEST-F18-WIP', account_name='WIP Test F18', account_type='asset', normal_balance='debit')
    payroll = Account(account_code='TEST-F18-PAYROLL', account_name='Beban Gaji Test F18', account_type='expense', normal_balance='debit')
    overhead = Account(account_code='TEST-F18-OH', account_name='Beban Operasional Test F18', account_type='expense', normal_balance='debit')
    db_session.add_all([wip, payroll, overhead])
    db_session.commit()
    db_session.add(GlobalAccountDefault(transaction_key='wip_persediaan', account_id=wip.id))
    db_session.add(GlobalAccountDefault(transaction_key='payroll_expense', account_id=payroll.id))
    db_session.add(GlobalAccountDefault(transaction_key='beban_operasional', account_id=overhead.id))
    db_session.commit()

    return wo, wip, payroll, overhead


def test_production_record_posts_labor_and_overhead_gl(client, auth_headers, db_session, test_product):
    wo, wip, payroll, overhead = _setup_wo_and_accounts(db_session, test_product)

    resp = client.post(f'/api/production/work-orders/{wo.id}/production-records', json={
        'quantity_produced': 10, 'quantity_good': 10, 'quantity_reject': 0, 'shift': '1',
        'runtime': 60, 'labor_rate': 25000, 'overhead_rate': 50000,
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    from models.finance import AccountingEntry
    entries = AccountingEntry.query.filter_by(reference_type='wip_cost_absorption', reference_id=wo.id).all()

    def total_for(account_id, field):
        return sum(float(getattr(e, field) or 0) for e in entries if e.account_id == account_id)

    # 1 jam runtime: labor = 1 * 25000 = 25000, overhead = 1 * 50000 = 50000.
    # WIP didebit 2x (1 jurnal per jenis biaya) - jumlahkan, bukan ambil 1 baris.
    assert total_for(wip.id, 'debit_amount') == 75000.0
    assert total_for(payroll.id, 'credit_amount') == 25000.0
    assert total_for(overhead.id, 'credit_amount') == 50000.0

    total_debit = sum(float(e.debit_amount or 0) for e in entries)
    total_credit = sum(float(e.credit_amount or 0) for e in entries)
    assert total_debit == total_credit == 75000.0


def test_production_record_skips_gl_when_accounts_not_configured(client, auth_headers, db_session, test_product):
    """Tidak boleh error kalau GlobalAccountDefault belum diatur - fire-and-forget."""
    machine = Machine(code='MC-F18B', name='Test Machine F18B', machine_type='test', status='active')
    db_session.add(machine)
    db_session.commit()
    wo = WorkOrder(wo_number='WO-F18-002', product_id=test_product.id, quantity=100, uom='PCS', status='in_progress', machine_id=machine.id)
    db_session.add(wo)
    db_session.commit()

    resp = client.post(f'/api/production/work-orders/{wo.id}/production-records', json={
        'quantity_produced': 10, 'quantity_good': 10, 'quantity_reject': 0, 'shift': '1',
        'actual_runtime': 60,
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    from models.finance import AccountingEntry
    entries = AccountingEntry.query.filter_by(reference_type='wip_cost_absorption', reference_id=wo.id).all()
    assert len(entries) == 0
