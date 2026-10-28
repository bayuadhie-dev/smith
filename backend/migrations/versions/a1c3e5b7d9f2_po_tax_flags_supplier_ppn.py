"""PO tax flags (kena pajak / termasuk pajak / jenis PPN) and supplier default PPN code

Revision ID: a1c3e5b7d9f2
Revises: f8b0d2e4a6c9
Create Date: 2026-10-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1c3e5b7d9f2'
down_revision = 'f8b0d2e4a6c9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('suppliers', sa.Column('ppn_code', sa.String(1), nullable=True))
    op.add_column('purchase_orders', sa.Column('is_taxable', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('purchase_orders', sa.Column('tax_inclusive', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('purchase_orders', sa.Column('ppn_code', sa.String(1), nullable=True))


def downgrade():
    op.drop_column('purchase_orders', 'ppn_code')
    op.drop_column('purchase_orders', 'tax_inclusive')
    op.drop_column('purchase_orders', 'is_taxable')
    op.drop_column('suppliers', 'ppn_code')
