"""sales_orders.expired_date

Revision ID: c1d3f5a7b9e2
Revises: b0c2e4a6d8f1
"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d3f5a7b9e2'
down_revision = 'b0c2e4a6d8f1'
branch_labels = None
depends_on = None


def upgrade():
    cols = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('sales_orders')]
    if 'expired_date' not in cols:
        op.add_column('sales_orders', sa.Column('expired_date', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('sales_orders', 'expired_date')
