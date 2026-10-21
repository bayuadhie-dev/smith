"""Multi-currency PO, step 1 (2026-10-19): add currency + exchange_rate to
purchase_orders. Existing rows become IDR / 1, so their behaviour is
unchanged.

Revision ID: c7d1e9a3b5f2
Revises: b4e8f2a7c1d9
Create Date: 2026-10-19
"""
from alembic import op
import sqlalchemy as sa

revision = 'c7d1e9a3b5f2'
down_revision = 'b4e8f2a7c1d9'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    cols = {c['name'] for c in sa.inspect(bind).get_columns('purchase_orders')}
    if 'currency' not in cols:
        op.add_column('purchase_orders', sa.Column(
            'currency', sa.String(length=10), nullable=False, server_default='IDR'))
    if 'exchange_rate' not in cols:
        op.add_column('purchase_orders', sa.Column(
            'exchange_rate', sa.Numeric(15, 6), nullable=False, server_default='1'))


def downgrade():
    op.drop_column('purchase_orders', 'exchange_rate')
    op.drop_column('purchase_orders', 'currency')
