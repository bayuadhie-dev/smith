"""purchase_order_item_schedules (planned delivery date + qty per PO line)

Revision ID: e7a9c1d3f5b8
Revises: d6f8b1c3e5a7
Create Date: 2026-10-27
"""
from alembic import op
import sqlalchemy as sa

revision = 'e7a9c1d3f5b8'
down_revision = 'd6f8b1c3e5a7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'purchase_order_item_schedules',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('po_item_id', sa.Integer, sa.ForeignKey('purchase_order_items.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('expected_date', sa.Date, nullable=False),
        sa.Column('quantity', sa.Numeric(15, 2), nullable=False),
        sa.Column('notes', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('purchase_order_item_schedules')
