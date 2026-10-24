"""add credit_applied to invoices

Revision ID: a9b3d5e7c2f1
Revises: f7c2d9a41e83
Create Date: 2026-10-24

Sales returns (and customer-deposit usage) reduce what a customer still owes
on an invoice without being a cash payment. credit_applied records that so the
invoice balance (balance_due = total - paid - credit_applied) stays in step
with the AR control account in the GL.
"""
from alembic import op
import sqlalchemy as sa

revision = 'a9b3d5e7c2f1'
down_revision = 'f7c2d9a41e83'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('invoices', sa.Column('credit_applied', sa.Numeric(15, 2), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('invoices', 'credit_applied')
