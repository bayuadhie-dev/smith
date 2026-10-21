"""SAP-equivalence plan item #2 (2026-10-06): adds PeriodAccountTypeLock,
a coarser SAP-style posting-period lock keyed by Account Type bucket
(D=Debitur/AR, K=Kreditur/AP, M=Material/Inventory, S=GL langsung,
A=Aset Tetap) - sits ALONGSIDE the existing PeriodTransactionTypeLock
(per-transaction_type), not a replacement. See PeriodAccountTypeLock's
model docstring (models/finance.py) and
utils.finance_helpers.TRANSACTION_TYPE_TO_SAP_BUCKET for the mapping
from existing transaction_type strings to these 5 buckets.

Revision ID: e3a9c7d5f1b2
Revises: d2f6b8c1e3a7
Create Date: 2026-10-06
"""
from alembic import op
import sqlalchemy as sa

revision = 'e3a9c7d5f1b2'
down_revision = 'd2f6b8c1e3a7'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'period_account_type_locks' in inspector.get_table_names():
        return

    op.create_table(
        'period_account_type_locks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('period_year', sa.Integer(), nullable=False),
        sa.Column('period_month', sa.Integer(), nullable=False),
        sa.Column('account_type_bucket', sa.String(length=1), nullable=False),
        sa.Column('locked_at', sa.DateTime(), nullable=False),
        sa.Column('locked_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.UniqueConstraint('period_year', 'period_month', 'account_type_bucket', name='uq_period_acct_type_lock'),
    )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'period_account_type_locks' in inspector.get_table_names():
        op.drop_table('period_account_type_locks')
