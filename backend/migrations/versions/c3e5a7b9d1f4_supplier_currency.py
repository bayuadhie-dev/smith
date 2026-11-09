"""suppliers.currency (mata uang utama pemasok; PO baru mengikuti)

Revision ID: c3e5a7b9d1f4
Revises: b2d4f6a8c0e1
Create Date: 2026-11-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3e5a7b9d1f4'
down_revision = 'b2d4f6a8c0e1'
branch_labels = None
depends_on = None


def upgrade():
    cols = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('suppliers')}
    if 'currency' not in cols:
        op.add_column('suppliers', sa.Column('currency', sa.String(10), nullable=False, server_default='IDR'))


def downgrade():
    op.drop_column('suppliers', 'currency')
