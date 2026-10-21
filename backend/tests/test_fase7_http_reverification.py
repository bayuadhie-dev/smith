"""
Fase 7 (audit 29 Sept 2026): dua hal yang sebelumnya cuma terbukti benar
lewat panggilan fungsi langsung, diverifikasi ulang di sini lewat endpoint
HTTP asli - sesuai "PELAJARAN PENTING" prompt perbaikan: di sistem ini
pernah ada fungsi yang benar saat dipanggil langsung tetapi gagal lewat
jalur HTTP asli.

a) Penyusutan aset: run_monthly_depreciation() terbukti memposting jurnal
   saat dipanggil langsung. Dibuktikan di sini lewat
   POST /api/finance/period-close bahwa jurnal penyusutan benar-benar
   terbentuk dan seimbang.

b) Budget commitment: reserve_po_budget_commitment() mengisi
   BudgetLine.committed_amount saat dipanggil langsung (lihat
   tests/test_budget_commitment.py, 5 tes, semua panggil fungsi langsung).
   Prompt mencatat "Sebelumnya di produksi angka committed tetap 0 lewat
   jalur HTTP asli" - jadi di sini diuji lewat KETIGA jalur HTTP asli:
   manual approval, generic ApprovalWorkflow, dan auto-approve threshold.
"""
from datetime import date, timedelta


# ---------------------------------------------------------------------------
# 7a - Penyusutan aset lewat endpoint period-close
# ---------------------------------------------------------------------------

def test_depreciation_posted_via_period_close_endpoint(client, auth_headers, db_session):
    from models.finance import Account, GlobalAccountDefault
    from models.asset_management import Asset

    expense_account = Account(
        account_code='TEST-DEPR-EXP', account_name='Beban Penyusutan',
        account_type='expense', normal_balance='debit',
    )
    accum_account = Account(
        account_code='TEST-DEPR-ACCUM', account_name='Akumulasi Penyusutan',
        account_type='asset', normal_balance='credit',
    )
    db_session.add_all([expense_account, accum_account])
    db_session.commit()

    db_session.add(GlobalAccountDefault(transaction_key='depreciation_expense', account_id=expense_account.id))
    db_session.add(GlobalAccountDefault(transaction_key='accumulated_depreciation', account_id=accum_account.id))
    db_session.commit()

    asset = Asset(
        asset_code='AST-TEST-001', asset_name='Test Machine', asset_type='machinery',
        status='active', purchase_date=date(2020, 1, 1), purchase_cost=12_000_000,
        depreciation_method='straight_line', useful_life_years=10, salvage_value=0,
        accumulated_depreciation=0,
    )
    db_session.add(asset)
    db_session.commit()

    # Pick a future-enough period that's guaranteed not already closed, and
    # avoid the sequential-close guard by using whatever period is next
    # given no PeriodClose rows exist yet in this fresh test DB (bootstrap
    # exception applies - table is empty).
    today = date.today()
    resp = client.post('/api/finance/period-close', json={
        'period_year': today.year,
        'period_month': today.month,
    }, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    depreciation_summary = resp.get_json()['depreciation_summary']
    assert depreciation_summary['assets_processed'] == 1
    assert depreciation_summary['total_depreciation'] > 0

    from models.finance import AccountingEntry
    entries = AccountingEntry.query.filter(
        AccountingEntry.account_id.in_([expense_account.id, accum_account.id])
    ).all()
    assert len(entries) > 0, "Jurnal penyusutan tidak terbentuk lewat endpoint period-close"

    total_debit = sum(float(e.debit_amount or 0) for e in entries)
    total_credit = sum(float(e.credit_amount or 0) for e in entries)
    assert round(total_debit, 2) == round(total_credit, 2)

    db_session.refresh(asset)
    assert float(asset.accumulated_depreciation) > 0


# ---------------------------------------------------------------------------
# 7b - Budget commitment lewat 3 jalur approval HTTP asli
# ---------------------------------------------------------------------------

def _setup_material_budget_and_po(db_session, po_amount=1_000_000, threshold=None):
    from models.finance import Account, Budget, BudgetLine, GlobalAccountDefault
    from models.purchasing import PurchaseOrder, PurchaseOrderItem, Supplier
    from models.product import Material

    persediaan_account = Account(
        account_code='TEST-FASE7-INV', account_name='Persediaan Bahan Baku',
        account_type='asset', normal_balance='debit',
    )
    db_session.add(persediaan_account)
    db_session.commit()
    db_session.add(GlobalAccountDefault(transaction_key='akun_persediaan_id', account_id=persediaan_account.id))
    db_session.commit()

    material = Material(
        code=f'MAT-FASE7-{po_amount}', name='Test Material Fase 7', material_type='raw_materials',
        category='Raw Material', primary_uom='KG', cost_per_unit=1000, is_active=True,
    )
    db_session.add(material)
    db_session.commit()

    supplier = Supplier(code=f'SUP-FASE7-{po_amount}', company_name='Test Supplier Fase 7', is_active=True)
    db_session.add(supplier)
    db_session.commit()

    today = date.today()
    budget = Budget(
        budget_name='Test Budget Fase 7', budget_year=today.year, budget_period='annual',
        start_date=today - timedelta(days=30), end_date=today + timedelta(days=30),
        status='active', total_budget=100_000_000,
    )
    db_session.add(budget)
    db_session.commit()

    budget_line = BudgetLine(
        budget_id=budget.id, account_id=persediaan_account.id, category='general',
        budget_amount=100_000_000, actual_amount=0, committed_amount=0,
    )
    db_session.add(budget_line)
    db_session.commit()

    po = PurchaseOrder(
        po_number=f'PO-FASE7-{po_amount}', supplier_id=supplier.id, order_date=today,
        status='draft', total_amount=po_amount,
    )
    db_session.add(po)
    db_session.commit()

    po_item = PurchaseOrderItem(
        po_id=po.id, line_number=1, material_id=material.id, quantity=1, uom='KG',
        unit_price=po_amount, total_price=po_amount,
    )
    db_session.add(po_item)
    db_session.commit()

    return budget_line, po


def test_budget_commitment_via_manual_po_approval_endpoint(client, auth_headers, db_session, test_user):
    from models.purchasing import PurchaseApproval

    budget_line, po = _setup_material_budget_and_po(db_session, po_amount=1_000_000)

    approval = PurchaseApproval(
        po_id=po.id, approval_level=1, approver_id=test_user.id, status='pending',
    )
    db_session.add(approval)
    db_session.commit()

    assert float(budget_line.committed_amount) == 0

    resp = client.post(f'/api/purchasing/purchase-orders/{po.id}/approve', json={
        'status': 'approved',
    }, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    db_session.refresh(budget_line)
    assert float(budget_line.committed_amount) == 1_000_000, (
        "committed_amount tidak terisi lewat jalur manual PO approval endpoint"
    )


def test_budget_commitment_via_generic_workflow_approve_endpoint(client, auth_headers, db_session):
    from models.approval_workflow import ApprovalWorkflow

    budget_line, po = _setup_material_budget_and_po(db_session, po_amount=2_000_000)
    po.status = 'draft'
    db_session.commit()

    # Submit via the real submit-approval endpoint (no ApprovalConfiguration
    # threshold configured, so this routes into the generic ApprovalWorkflow
    # review->approve path, not the auto-approve shortcut).
    resp_submit = client.post(f'/api/purchasing/purchase-orders/{po.id}/submit-approval', headers=auth_headers)
    assert resp_submit.status_code == 200, resp_submit.get_json()
    workflow_id = resp_submit.get_json()['data']['workflow_id']

    resp_review = client.post(f'/api/approval/workflows/{workflow_id}/review', json={}, headers=auth_headers)
    assert resp_review.status_code == 200, resp_review.get_json()

    assert float(budget_line.committed_amount) == 0

    resp_approve = client.post(f'/api/approval/workflows/{workflow_id}/approve', json={}, headers=auth_headers)
    assert resp_approve.status_code == 200, resp_approve.get_json()

    db_session.refresh(budget_line)
    assert float(budget_line.committed_amount) == 2_000_000, (
        "committed_amount tidak terisi lewat jalur generic ApprovalWorkflow endpoint"
    )


def test_budget_commitment_via_auto_approve_threshold_endpoint(client, auth_headers, db_session):
    from models.approval_workflow import ApprovalConfiguration

    budget_line, po = _setup_material_budget_and_po(db_session, po_amount=300_000)
    po.status = 'draft'
    db_session.commit()

    config = ApprovalConfiguration(
        transaction_type='purchase_order', amount_threshold=500_000, is_active=True,
    )
    db_session.add(config)
    db_session.commit()

    assert float(budget_line.committed_amount) == 0

    resp = client.post(f'/api/purchasing/purchase-orders/{po.id}/submit-approval', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()['data']['auto_approved'] is True

    db_session.refresh(budget_line)
    assert float(budget_line.committed_amount) == 300_000, (
        "committed_amount tidak terisi lewat jalur auto-approve threshold endpoint"
    )
