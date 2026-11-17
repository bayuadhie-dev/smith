"""purchase_orders: status ditutup (tutup PO yang diterima sebagian)

Revision ID: a1c3e5f7b9d4
Revises: f9b1d3e5a7c2
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1c3e5f7b9d4'
down_revision = 'f9b1d3e5a7c2'
branch_labels = None
depends_on = None


def upgrade():
    have = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('purchase_orders')]
    if 'closed_at' not in have:
        op.add_column('purchase_orders', sa.Column('closed_at', sa.DateTime(), nullable=True))
    if 'closed_by' not in have:
        op.add_column('purchase_orders', sa.Column('closed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    if 'close_reason' not in have:
        op.add_column('purchase_orders', sa.Column('close_reason', sa.String(500), nullable=True))


def downgrade():
    for c in ('close_reason', 'closed_by', 'closed_at'):
        op.drop_column('purchase_orders', c)
