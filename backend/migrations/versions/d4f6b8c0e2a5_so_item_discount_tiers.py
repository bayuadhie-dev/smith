"""sales_order_items.discount_tiers (diskon bertingkat, mis. 10+5)

Revision ID: d4f6b8c0e2a5
Revises: c3e5a7b9d1f4
Create Date: 2026-10-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4f6b8c0e2a5'
down_revision = 'c3e5a7b9d1f4'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('sales_order_items', sa.Column('discount_tiers', sa.String(60), nullable=True))


def downgrade():
    op.drop_column('sales_order_items', 'discount_tiers')
