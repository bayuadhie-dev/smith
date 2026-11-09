"""grn supplier_invoice_number

Revision ID: e1f3a5c7b9d2
Revises: d8a2c4e6f0b1
"""
from alembic import op
import sqlalchemy as sa

revision = 'e1f3a5c7b9d2'
down_revision = 'd8a2c4e6f0b1'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    cols = [c['name'] for c in sa.inspect(bind).get_columns('goods_received_notes')]
    if 'supplier_invoice_number' not in cols:
        op.add_column('goods_received_notes', sa.Column('supplier_invoice_number', sa.String(100), nullable=True))


def downgrade():
    op.drop_column('goods_received_notes', 'supplier_invoice_number')
