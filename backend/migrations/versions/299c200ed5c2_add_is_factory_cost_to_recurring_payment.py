"""add is_factory_cost to recurring_payments

Revision ID: 299c200ed5c2
Revises: 4858cebe711d
Create Date: 2026-10-22

Lets a recurring payment template (Tagihan Rutin, e.g. "Listrik
Pabrik") be flagged as a factory/manufacturing cost so its monthly
transactions post to 5-1300 HPP - Overhead (Cost of Sales) instead of
the shared Beban Operasional account every other recurring bill uses.
See routes/finance.py's create_recurring_payment_transaction().
"""
from alembic import op
import sqlalchemy as sa

revision = '299c200ed5c2'
down_revision = '4858cebe711d'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'recurring_payments',
        sa.Column('is_factory_cost', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade():
    op.drop_column('recurring_payments', 'is_factory_cost')
