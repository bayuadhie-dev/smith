"""suppliers.supplier_subtype (jenis rinci pemasok di dalam kategori)

Revision ID: d8a2c4e6f0b1
Revises: a626cf16274a
Create Date: 2026-11-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'd8a2c4e6f0b1'
down_revision = 'a626cf16274a'
branch_labels = None
depends_on = None


def upgrade():
    cols = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('suppliers')}
    if 'supplier_subtype' not in cols:
        op.add_column('suppliers', sa.Column('supplier_subtype', sa.String(100), nullable=True))


def downgrade():
    op.drop_column('suppliers', 'supplier_subtype')
