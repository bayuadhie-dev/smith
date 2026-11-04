"""suppliers.tax_address (alamat pajak, terpisah dari alamat perusahaan)

Revision ID: c6d8f0b2e4a7
Revises: b5c7e9a1d3f6
Create Date: 2026-11-04
"""
from alembic import op
import sqlalchemy as sa

revision = 'c6d8f0b2e4a7'
down_revision = 'b5c7e9a1d3f6'
branch_labels = None
depends_on = None


def upgrade():
    cols = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('suppliers')}
    if 'tax_address' not in cols:
        op.add_column('suppliers', sa.Column('tax_address', sa.Text, nullable=True))


def downgrade():
    op.drop_column('suppliers', 'tax_address')
