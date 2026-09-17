"""
Tests for budget commitment/encumbrance accounting (2026-09-17) -
reserve_po_budget_commitment()/release_po_budget_commitment() in
utils/finance_helpers.py, wired into PO approval/cancellation/invoicing.
"""
from datetime import date, timedelta


def _setup_budget_and_po(db_session, po_amount=1_000_000):
    from models.finance import Account, Budget, BudgetLine, GlobalAccountDefault
    from models.purchasing import PurchaseOrder, PurchaseOrderItem
    from models.purchasing import Supplier

    expense_account = Account(
        account_code='TEST-EXP-01', account_name='Test Expense', account_type='expense',
        normal_balance='debit',
    )
    db_session.add(expense_account)
    db_session.commit()

    db_session.add(GlobalAccountDefault(transaction_key='akun_beban_id', account_id=expense_account.id))

    supplier = Supplier(code='SUP-TEST-01', company_name='Test Supplier', is_active=True)
    db_session.add(supplier)
    db_session.commit()

    today = date.today()
    budget = Budget(
        budget_name='Test Budget', budget_year=today.year, budget_period='annual',
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

    po = PurchaseOrder(
        po_number='PO-COMMIT-TEST-001', supplier_id=supplier.id, order_date=today,
        status='draft', total_amount=po_amount,
    )
    db_session.add(po)
    db_session.commit()

    po_item = PurchaseOrderItem(
        po_id=po.id, line_number=1, quantity=1, uom='PCS',
        unit_price=po_amount, total_price=po_amount,
    )
    db_session.add(po_item)
    db_session.commit()

    return budget_line, po, po_item


class TestBudgetCommitment:
    def test_reserve_increments_committed_amount(self, db_session):
        from utils.finance_helpers import reserve_po_budget_commitment
        budget_line, po, po_item = _setup_budget_and_po(db_session, po_amount=1_000_000)

        reserved = reserve_po_budget_commitment(po)

        assert reserved == 1_000_000
        assert float(budget_line.committed_amount) == 1_000_000
        assert budget_line.available_amount == 9_000_000

    def test_full_release_on_cancel_zeroes_commitment(self, db_session):
        from utils.finance_helpers import reserve_po_budget_commitment, release_po_budget_commitment
        budget_line, po, po_item = _setup_budget_and_po(db_session, po_amount=500_000)

        reserve_po_budget_commitment(po)
        assert float(budget_line.committed_amount) == 500_000

        released = release_po_budget_commitment(po)

        assert released == 500_000
        assert float(budget_line.committed_amount) == 0

    def test_partial_release_on_invoice_matches_invoiced_amount(self, db_session):
        from utils.finance_helpers import reserve_po_budget_commitment, release_po_budget_commitment
        budget_line, po, po_item = _setup_budget_and_po(db_session, po_amount=1_000_000)

        reserve_po_budget_commitment(po)
        assert float(budget_line.committed_amount) == 1_000_000

        # Simulate invoicing 40% of the PO line - the rest should stay committed.
        released = release_po_budget_commitment(po, items=[{
            'product_id': None, 'material_id': None, 'amount': 400_000,
        }])

        assert released == 400_000
        assert float(budget_line.committed_amount) == 600_000

    def test_release_never_goes_negative(self, db_session):
        """Defensive: releasing more than what's committed (e.g. drift) clamps at 0
        rather than producing a negative committed_amount."""
        from utils.finance_helpers import reserve_po_budget_commitment, release_po_budget_commitment
        budget_line, po, po_item = _setup_budget_and_po(db_session, po_amount=100_000)

        reserve_po_budget_commitment(po)
        released = release_po_budget_commitment(po, items=[{
            'product_id': None, 'material_id': None, 'amount': 999_999_999,
        }])

        assert released == 100_000  # clamped to what was actually committed
        assert float(budget_line.committed_amount) == 0

    def test_no_matching_budget_line_is_silently_skipped(self, db_session):
        """A PO whose account has no active budget configured should not error -
        just reserves nothing, since there's no budget control for that account."""
        from utils.finance_helpers import reserve_po_budget_commitment
        from models.purchasing import PurchaseOrder, PurchaseOrderItem
        from models.purchasing import Supplier
        from models.finance import Account, GlobalAccountDefault

        expense_account = Account(
            account_code='TEST-EXP-02', account_name='Test Expense No Budget',
            account_type='expense', normal_balance='debit',
        )
        db_session.add(expense_account)
        db_session.commit()
        db_session.add(GlobalAccountDefault(transaction_key='akun_beban_id', account_id=expense_account.id))

        supplier = Supplier(code='SUP-TEST-02', company_name='Test Supplier 2', is_active=True)
        db_session.add(supplier)
        db_session.commit()

        po = PurchaseOrder(
            po_number='PO-COMMIT-TEST-002', supplier_id=supplier.id, order_date=date.today(),
            status='draft', total_amount=200_000,
        )
        db_session.add(po)
        db_session.commit()
        db_session.add(PurchaseOrderItem(
            po_id=po.id, line_number=1, quantity=1, uom='PCS',
            unit_price=200_000, total_price=200_000,
        ))
        db_session.commit()

        reserved = reserve_po_budget_commitment(po)  # no Budget exists at all - must not raise
        assert reserved == 0
