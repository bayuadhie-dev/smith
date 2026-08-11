"""add ejo warehouse unmatched products table

Revision ID: 2708f332ab93
Revises: af6aa6aba3e0
Create Date: 2026-08-11

Context: sync_ejo_warehouse_stock() skips EJOs whose Accurate output item
name has no exact match in SMITH products (frequently ~85% of scanned
EJOs, due to naming differences between the two systems). This table
persists those unmatched item names so they're visible in the UI with a
warning, rather than silently disappearing - helps identify which product
names need to be reconciled between Accurate and SMITH.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2708f332ab93'
down_revision = 'af6aa6aba3e0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ejo_warehouse_unmatched_products',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('accurate_item_name', sa.String(255), nullable=False, unique=True, index=True),
        sa.Column('occurrence_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('last_ejo_number', sa.String(100), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('ejo_warehouse_unmatched_products')
