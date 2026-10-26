"""payments.paid_to (free-text payee/payer for standalone Kas/Bank)

Revision ID: d6f8b1c3e5a7
Revises: c5e7a9b1d3f2
Create Date: 2026-10-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'd6f8b1c3e5a7'
down_revision = 'c5e7a9b1d3f2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('payments', sa.Column('paid_to', sa.String(200), nullable=True))


def downgrade():
    op.drop_column('payments', 'paid_to')
