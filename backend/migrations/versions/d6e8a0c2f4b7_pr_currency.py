"""purchase_requisitions.currency / exchange_rate

Revision ID: d6e8a0c2f4b7
Revises: c5d7f9b1e3a6
"""
from alembic import op
import sqlalchemy as sa

revision = 'd6e8a0c2f4b7'
down_revision = 'c5d7f9b1e3a6'
branch_labels = None
depends_on = None


def upgrade():
    cols = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('purchase_requisitions')]
    if 'currency' not in cols:
        op.add_column('purchase_requisitions', sa.Column('currency', sa.String(10), nullable=False, server_default='IDR'))
    if 'exchange_rate' not in cols:
        op.add_column('purchase_requisitions', sa.Column('exchange_rate', sa.Numeric(15, 6), nullable=True))


def downgrade():
    op.drop_column('purchase_requisitions', 'exchange_rate')
    op.drop_column('purchase_requisitions', 'currency')
