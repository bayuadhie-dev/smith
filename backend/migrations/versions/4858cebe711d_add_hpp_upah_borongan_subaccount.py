"""add HPP - Upah Borongan (5-1210) and Tunjangan Karyawan Langsung (5-1220) sub-accounts

Revision ID: 4858cebe711d
Revises: 04c060c2beeb
Create Date: 2026-10-22

Adds two child accounts of 5-1200 (HPP - Tenaga Kerja) so direct-labor
payroll (piecework/daily-rate employees) posts as Cost of Sales,
split into base wage (5-1210) and allowances (5-1220) as two separate
lines per user request - instead of lumping both into one line, and
instead of posting ALL payroll (including factory supervisors/admin
who are salaried) to the single administrative 7-1000 Beban Gaji
account it used to share with office staff. See
utils/finance_helpers.py's post_payroll_journal() for where these are
used.
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = '4858cebe711d'
down_revision = '04c060c2beeb'
branch_labels = None
depends_on = None

accounts_table = sa.table(
    'accounts',
    sa.column('account_code', sa.String),
    sa.column('account_name', sa.String),
    sa.column('account_type', sa.String),
    sa.column('parent_id', sa.Integer),
    sa.column('level', sa.Integer),
    sa.column('is_header', sa.Boolean),
    sa.column('is_active', sa.Boolean),
    sa.column('normal_balance', sa.String),
    sa.column('created_at', sa.DateTime),
    sa.column('updated_at', sa.DateTime),
)


def upgrade():
    conn = op.get_bind()
    parent = conn.execute(
        sa.text("SELECT id FROM accounts WHERE account_code = '5-1200'")
    ).fetchone()
    parent_id = parent[0] if parent else None
    now = datetime.utcnow()

    for code, name in [
        ('5-1210', 'HPP - Upah Borongan'),
        ('5-1220', 'HPP - Tunjangan Karyawan Langsung'),
    ]:
        existing = conn.execute(
            sa.text("SELECT id FROM accounts WHERE account_code = :code"), {'code': code}
        ).fetchone()
        if existing:
            conn.execute(
                sa.text("UPDATE accounts SET account_name = :name WHERE account_code = :code"),
                {'name': name, 'code': code},
            )
            continue
        op.bulk_insert(accounts_table, [{
            'account_code': code,
            'account_name': name,
            'account_type': 'expense',
            'parent_id': parent_id,
            'level': 2,
            'is_header': False,
            'is_active': True,
            'normal_balance': 'debit',
            'created_at': now,
            'updated_at': now,
        }])


def downgrade():
    op.execute(sa.text("DELETE FROM accounts WHERE account_code IN ('5-1210', '5-1220')"))
