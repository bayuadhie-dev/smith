"""invoice_items: account_id (baris tambahan) + quantity 4 desimal

Revision ID: d2e4a6b8c0f3
Revises: c1d3f5a7b9e2
"""
from alembic import op
import sqlalchemy as sa

revision = 'd2e4a6b8c0f3'
down_revision = 'c1d3f5a7b9e2'
branch_labels = None
depends_on = None


def upgrade():
    cols = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('invoice_items')]
    if 'account_id' not in cols:
        op.add_column('invoice_items', sa.Column('account_id', sa.Integer(), sa.ForeignKey('accounts.id'), nullable=True))
    op.alter_column('invoice_items', 'quantity', type_=sa.Numeric(15, 4), existing_type=sa.Numeric(15, 2), existing_nullable=False)


def downgrade():
    op.alter_column('invoice_items', 'quantity', type_=sa.Numeric(15, 2), existing_type=sa.Numeric(15, 4), existing_nullable=False)
    op.drop_column('invoice_items', 'account_id')
