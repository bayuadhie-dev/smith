"""invoices.grn_id (faktur pembelian dari GRN tanpa PO)

Revision ID: a3b5d7f9c1e4
Revises: f2a4c6e8b0d3
"""
from alembic import op
import sqlalchemy as sa

revision = 'a3b5d7f9c1e4'
down_revision = 'f2a4c6e8b0d3'
branch_labels = None
depends_on = None


def upgrade():
    cols = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('invoices')]
    if 'grn_id' not in cols:
        op.add_column('invoices', sa.Column('grn_id', sa.Integer(), sa.ForeignKey('goods_received_notes.id'), nullable=True))


def downgrade():
    op.drop_column('invoices', 'grn_id')
