"""
Recreate `expenses` and `reimbursements` tables to match current SQLAlchemy models.

Background:
    These tables were originally created by a manual SQL script with an older
    schema (missing columns such as `employee_name`, `amount_base`,
    `bank_account_number`, etc.). This caused runtime errors like:
        (sqlite3.OperationalError) no such column: expenses.employee_name

Because both tables are expected to be empty (new feature), this script drops
and recreates them from the models so the schema is correct.

SAFETY:
    By default the script REFUSES to run if either table contains rows.
    Pass --force to drop non-empty tables anyway (data WILL be lost).

Usage (run from the backend root, on the machine that owns the live DB):
    python scripts/migration_manual/recreate_expense_tables.py
    python scripts/migration_manual/recreate_expense_tables.py --force
"""
import sys
import os

# Ensure the backend root is importable regardless of CWD
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, BACKEND_ROOT)

from sqlalchemy import inspect, text

from app import create_app
from models import db
# Importing the package above already registers all models (including Employee,
# User, Account, etc.), which the Expense/Reimbursement relationships depend on.
from models.expense import Expense, Reimbursement


def _row_count(table_name):
    try:
        return db.session.execute(text(f'SELECT COUNT(*) FROM {table_name}')).scalar()
    except Exception:
        # Table does not exist yet
        return 0


def recreate_expense_tables(force=False):
    app = create_app()
    with app.app_context():
        inspector = inspect(db.engine)
        existing = set(inspector.get_table_names())

        exp_rows = _row_count('expenses') if 'expenses' in existing else 0
        reimb_rows = _row_count('reimbursements') if 'reimbursements' in existing else 0

        print(f"Current rows -> expenses: {exp_rows}, reimbursements: {reimb_rows}")

        if (exp_rows or reimb_rows) and not force:
            print("\n[ABORTED] One or both tables contain data.")
            print("Re-run with --force to drop them anyway (data will be lost).")
            return

        # Drop child table first (expenses references reimbursements via FK)
        print("\nDropping old tables (if they exist)...")
        db.session.execute(text('DROP TABLE IF EXISTS expenses'))
        db.session.execute(text('DROP TABLE IF EXISTS reimbursements'))
        db.session.commit()
        print("  - dropped: expenses, reimbursements")

        # Recreate from models (create_all only creates missing tables)
        print("\nRecreating tables from models...")
        db.create_all()

        # Verify the previously-missing column now exists
        inspector = inspect(db.engine)
        tables = set(inspector.get_table_names())
        ok = True
        for tbl, required_col in (('expenses', 'employee_name'),
                                  ('reimbursements', 'bank_account_number')):
            if tbl not in tables:
                print(f"  [FAIL] table '{tbl}' was not created")
                ok = False
                continue
            cols = {c['name'] for c in inspector.get_columns(tbl)}
            if required_col in cols:
                print(f"  [OK] '{tbl}' created with {len(cols)} columns (has '{required_col}')")
            else:
                print(f"  [FAIL] '{tbl}' missing column '{required_col}'")
                ok = False

        print("\nDone." if ok else "\nDone WITH ERRORS - check output above.")


if __name__ == '__main__':
    recreate_expense_tables(force='--force' in sys.argv)
