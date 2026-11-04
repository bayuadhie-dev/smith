"""grn without PO: goods_received_notes.po_id and grn_items.po_item_id nullable

Revision ID: e2f4b6d8a0c3
Revises: d1e3a5c7b9f2
Create Date: 2026-11-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'e2f4b6d8a0c3'
down_revision = 'd1e3a5c7b9f2'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('goods_received_notes', 'po_id', existing_type=sa.Integer(), nullable=True)
    op.alter_column('grn_items', 'po_item_id', existing_type=sa.Integer(), nullable=True)


def downgrade():
    op.alter_column('grn_items', 'po_item_id', existing_type=sa.Integer(), nullable=False)
    op.alter_column('goods_received_notes', 'po_id', existing_type=sa.Integer(), nullable=False)
