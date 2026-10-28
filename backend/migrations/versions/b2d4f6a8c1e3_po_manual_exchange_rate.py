"""purchase_orders.manual_exchange_rate (kurs manual yang diisi di form PO, dikunci saat submit approval)

Revision ID: b2d4f6a8c1e3
Revises: a1c3e5b7d9f2
Create Date: 2026-10-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2d4f6a8c1e3'
down_revision = 'a1c3e5b7d9f2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('purchase_orders', sa.Column('manual_exchange_rate', sa.Numeric(15, 6), nullable=True))


def downgrade():
    op.drop_column('purchase_orders', 'manual_exchange_rate')
