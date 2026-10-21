"""Multi-currency PO: purchase_orders.exchange_rate_source ('auto'/'manual').

Revision ID: d8e2f0b4c6a1
Revises: c7d1e9a3b5f2
Create Date: 2026-10-19
"""
from alembic import op
import sqlalchemy as sa

revision = 'd8e2f0b4c6a1'
down_revision = 'c7d1e9a3b5f2'
branch_labels = None
depends_on = None


def upgrade():
    cols = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('purchase_orders')}
    if 'exchange_rate_source' not in cols:
        op.add_column('purchase_orders', sa.Column('exchange_rate_source', sa.String(length=10), nullable=True))


def downgrade():
    op.drop_column('purchase_orders', 'exchange_rate_source')
