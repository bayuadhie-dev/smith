"""purchase_order_items: ppn_code per baris (kosong = ikut PO, N = tanpa PPN)

Revision ID: b3d5f7a9c1e8
Revises: f0a2b4c6d8e1
"""
from alembic import op
import sqlalchemy as sa

revision = 'b3d5f7a9c1e8'
down_revision = 'f0a2b4c6d8e1'
branch_labels = None
depends_on = None


def upgrade():
    have = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('purchase_order_items')]
    if 'ppn_code' not in have:
        op.add_column('purchase_order_items', sa.Column('ppn_code', sa.String(1), nullable=True))


def downgrade():
    op.drop_column('purchase_order_items', 'ppn_code')
