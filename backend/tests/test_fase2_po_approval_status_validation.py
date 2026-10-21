"""
Fase 2 (fix_report_2.md, lanjutan audit): approve_purchase_order()
(routes/purchasing.py) menerima `status` dari body request tanpa validasi
(`data.get('status', 'approved')`), lalu memakainya langsung sebagai nilai
PurchaseApproval.status DAN sebagai pemicu percabangan
`if approval.status == 'approved': ... else: po.status = 'rejected'`.

Skenario 1 diverifikasi: kirim status='rejected' yang sah - harus benar-
benar menolak PO, TIDAK memanggil reserve_po_budget_commitment(), dan
TIDAK mengubah po.status jadi 'approved'. (Ini sudah diperiksa dan memang
BENAR di kode saat ini - percabangan if/else sudah correctly exclusive.
Tes ini tetap ditulis sebagai regression-guard eksplisit karena prompt
audit secara eksplisit meminta ini dibuktikan, bukan diasumsikan.)

Skenario 2 (BUG NYATA): kirim status dengan nilai SEMBARANGAN yang bukan
'approved' ATAU 'rejected' (mis. typo, salah kirim dari client lama) -
sebelum fix, nilai itu disimpan apa adanya ke PurchaseApproval.status
(field yang menurut modelnya cuma boleh 'pending'/'approved'/'rejected')
DAN PO ikut di-set 'rejected' padahal approval-nya sendiri tidak benar-
benar bilang 'rejected' - state yang salah/tidak konsisten, terbentuk
dari input yang seharusnya ditolak validasi.

Diverifikasi lewat endpoint HTTP asli (POST /api/purchasing/purchase-orders/<id>/approve).
"""
from datetime import date, timedelta


def _setup_po_with_pending_approval(db_session, test_user, po_amount=1_000_000):
    from models.purchasing import PurchaseOrder, PurchaseOrderItem, Supplier, PurchaseApproval

    supplier = Supplier(code=f'SUP-FASE2-{po_amount}', company_name='Test Supplier Fase 2', is_active=True)
    db_session.add(supplier)
    db_session.commit()

    po = PurchaseOrder(
        po_number=f'PO-FASE2-{po_amount}', supplier_id=supplier.id, order_date=date.today(),
        status='pending_approval', total_amount=po_amount,
    )
    db_session.add(po)
    db_session.commit()

    po_item = PurchaseOrderItem(
        po_id=po.id, line_number=1, quantity=1, uom='PCS',
        unit_price=po_amount, total_price=po_amount,
    )
    db_session.add(po_item)
    db_session.commit()

    approval = PurchaseApproval(
        po_id=po.id, approval_level=1, approver_id=test_user.id, status='pending',
    )
    db_session.add(approval)
    db_session.commit()

    return po, approval


def test_reject_status_never_approves_po_or_reserves_budget(client, auth_headers, db_session, test_user):
    """Regression-guard eksplisit: status='rejected' yang sah harus benar-benar
    menolak, tidak pernah ikut membuat po.status='approved' atau memanggil
    reserve_po_budget_commitment()."""
    from models.finance import Account, Budget, BudgetLine, GlobalAccountDefault

    expense_account = Account(
        account_code='TEST-FASE2-EXP', account_name='Test Expense', account_type='expense',
        normal_balance='debit',
    )
    db_session.add(expense_account)
    db_session.commit()
    db_session.add(GlobalAccountDefault(transaction_key='akun_beban_id', account_id=expense_account.id))
    db_session.commit()

    today = date.today()
    budget = Budget(
        budget_name='Test Budget Fase 2', budget_year=today.year, budget_period='annual',
        start_date=today - timedelta(days=30), end_date=today + timedelta(days=30),
        status='active', total_budget=10_000_000,
    )
    db_session.add(budget)
    db_session.commit()
    budget_line = BudgetLine(
        budget_id=budget.id, account_id=expense_account.id, category='general',
        budget_amount=10_000_000, actual_amount=0, committed_amount=0,
    )
    db_session.add(budget_line)
    db_session.commit()

    po, approval = _setup_po_with_pending_approval(db_session, test_user, po_amount=500_000)

    resp = client.post(f'/api/purchasing/purchase-orders/{po.id}/approve', json={
        'status': 'rejected',
        'comments': 'Harga tidak sesuai',
    }, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    db_session.refresh(po)
    db_session.refresh(budget_line)
    assert po.status == 'rejected'
    assert float(budget_line.committed_amount) == 0, "Budget tidak boleh tereservasi saat PO ditolak"


def test_invalid_status_value_is_rejected_not_silently_applied(client, auth_headers, db_session, test_user):
    po, approval = _setup_po_with_pending_approval(db_session, test_user, po_amount=700_000)

    resp = client.post(f'/api/purchasing/purchase-orders/{po.id}/approve', json={
        'status': 'not_a_real_status',
    }, headers=auth_headers)

    assert resp.status_code == 400, (
        f"Status tidak valid seharusnya ditolak dengan 400, dapat {resp.status_code}: {resp.get_json()}"
    )

    from models.purchasing import PurchaseOrder, PurchaseApproval
    from models import db
    db_session.refresh(po)
    db_session.refresh(approval)
    assert po.status == 'pending_approval', "PO tidak boleh berubah status akibat input tidak valid"
    assert approval.status == 'pending', "Approval tidak boleh tercemar nilai status yang tidak valid"
