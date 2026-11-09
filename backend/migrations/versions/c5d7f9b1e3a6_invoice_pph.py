"""invoices.pph_type / pph_rate / pph_amount

Revision ID: c5d7f9b1e3a6
Revises: b4c6e8a0d2f5
"""
from alembic import op
import sqlalchemy as sa

revision = 'c5d7f9b1e3a6'
down_revision = 'b4c6e8a0d2f5'
branch_labels = None
depends_on = None


def upgrade():
    cols = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('invoices')]
    if 'pph_type' not in cols:
        op.add_column('invoices', sa.Column('pph_type', sa.String(30), nullable=True))
    if 'pph_rate' not in cols:
        op.add_column('invoices', sa.Column('pph_rate', sa.Numeric(6, 3), nullable=True))
    if 'pph_amount' not in cols:
        op.add_column('invoices', sa.Column('pph_amount', sa.Numeric(15, 2), nullable=True, server_default='0'))


def downgrade():
    op.drop_column('invoices', 'pph_amount')
    op.drop_column('invoices', 'pph_rate')
    op.drop_column('invoices', 'pph_type')
