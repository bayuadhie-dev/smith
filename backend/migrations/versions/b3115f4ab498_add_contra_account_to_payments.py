"""add contra_account_id to payments

Revision ID: b3115f4ab498
Revises: 299c200ed5c2
Create Date: 2026-10-22

Lets a Payment be recorded WITHOUT an invoice (standalone Kas/Bank
transaction - bank fee, interest income, owner capital, etc.) by
naming the counterpart account directly instead of deriving it from
an invoice's Piutang/Hutang Usaha. See routes/finance.py's
create_payment() for where this is used.
"""
from alembic import op
import sqlalchemy as sa

revision = 'b3115f4ab498'
down_revision = '299c200ed5c2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('payments', sa.Column('contra_account_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_payments_contra_account_id', 'payments', 'accounts',
        ['contra_account_id'], ['id'],
    )


def downgrade():
    op.drop_constraint('fk_payments_contra_account_id', 'payments', type_='foreignkey')
    op.drop_column('payments', 'contra_account_id')
