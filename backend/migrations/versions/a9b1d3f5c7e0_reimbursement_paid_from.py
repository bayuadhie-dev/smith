"""reimbursements.paid_from_account_id / paid_date

Revision ID: a9b1d3f5c7e0
Revises: f8a0c2e4b6d9
"""
from alembic import op
import sqlalchemy as sa

revision = 'a9b1d3f5c7e0'
down_revision = 'f8a0c2e4b6d9'
branch_labels = None
depends_on = None


def upgrade():
    cols = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('reimbursements')]
    if 'paid_from_account_id' not in cols:
        op.add_column('reimbursements', sa.Column('paid_from_account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=True))
    if 'paid_date' not in cols:
        op.add_column('reimbursements', sa.Column('paid_date', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('reimbursements', 'paid_date')
    op.drop_column('reimbursements', 'paid_from_account_id')
