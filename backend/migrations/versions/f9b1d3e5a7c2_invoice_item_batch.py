"""invoice_items: nomor batch per baris (wajib di faktur tanpa SO/SJ)

Revision ID: f9b1d3e5a7c2
Revises: e8a0c2d4f6b9
"""
from alembic import op
import sqlalchemy as sa

revision = 'f9b1d3e5a7c2'
down_revision = 'e8a0c2d4f6b9'
branch_labels = None
depends_on = None


def upgrade():
    have = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('invoice_items')]
    if 'batch_number' not in have:
        op.add_column('invoice_items', sa.Column('batch_number', sa.String(100), nullable=True))


def downgrade():
    op.drop_column('invoice_items', 'batch_number')
