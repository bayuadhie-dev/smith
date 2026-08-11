"""add warehouse transfer log tables

Revision ID: 2b581ecbc742
Revises: ebc6833df1f5
Create Date: 2026-08-11 15:21:14.799179

Context: Accurate's item-transfer.do records official PM<->EPD<->FG
warehouse movement transactions (paired TRANSFER_OUT/TRANSFER_IN rows,
prefixed IT- for PM<->EPD and PL- for EPD<->FG, the latter generated
automatically from Packing List creation). This gives SMITH a real
movement audit trail, not just point-in-time stock snapshots -
confirmed with real data: PM->EPD (IT-*) and EPD->FG (PL-*) pairs.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2b581ecbc742'
down_revision = 'ebc6833df1f5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'accurate_warehouse_transfer_log',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('accurate_transfer_id', sa.Integer(), nullable=False, unique=True, index=True),
        sa.Column('number', sa.String(100), nullable=False, index=True),
        sa.Column('transfer_type', sa.String(20), nullable=False),  # TRANSFER_IN or TRANSFER_OUT
        sa.Column('doc_prefix', sa.String(10), nullable=True),  # PL or IT, parsed from number
        sa.Column('trans_date', sa.String(30), nullable=True),
        sa.Column('from_warehouse_id', sa.Integer(), nullable=True),
        sa.Column('from_warehouse_name', sa.String(100), nullable=True),
        sa.Column('to_warehouse_id', sa.Integer(), nullable=True),
        sa.Column('to_warehouse_name', sa.String(100), nullable=True),
        sa.Column('paired_transfer_id', sa.Integer(), nullable=True),  # fromItemTransferId
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        'accurate_warehouse_transfer_item',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('transfer_log_id', sa.Integer(), sa.ForeignKey('accurate_warehouse_transfer_log.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('accurate_item_id', sa.Integer(), nullable=True),
        sa.Column('item_name', sa.String(255), nullable=True),
        sa.Column('smith_product_id', sa.Integer(), nullable=True, index=True),
        sa.Column('smith_material_id', sa.Integer(), nullable=True, index=True),
        sa.Column('quantity', sa.Float(), nullable=True),
        sa.Column('serial_number', sa.String(100), nullable=True),
        sa.Column('batch_expired_date', sa.String(30), nullable=True),
    )


def downgrade():
    op.drop_table('accurate_warehouse_transfer_item')
    op.drop_table('accurate_warehouse_transfer_log')
