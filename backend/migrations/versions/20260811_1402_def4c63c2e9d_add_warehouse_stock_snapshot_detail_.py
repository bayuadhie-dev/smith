"""add warehouse stock snapshot detail table

Revision ID: def4c63c2e9d
Revises: 2708f332ab93
Create Date: 2026-08-11

Context: sync_warehouse_stock_from_item_detail() reads Accurate's
item/detail.do detailWarehouseData (per-warehouse stock breakdown with
warehouse name, PIC, and per-unit quantities) for PM/EPD/FG. Previously
only the aggregated quantity_on_hand was kept on Inventory; this table
persists the full per-item-per-warehouse detail (warehouse name, PIC,
unit1/2/3 quantities) so users can click through to it without a live
Accurate re-fetch.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'def4c63c2e9d'
down_revision = '2708f332ab93'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'warehouse_stock_snapshot_detail',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), nullable=False, index=True),
        sa.Column('smith_location_id', sa.Integer(), nullable=False, index=True),
        sa.Column('accurate_warehouse_id', sa.Integer(), nullable=True),
        sa.Column('accurate_warehouse_name', sa.String(100), nullable=True),
        sa.Column('pic', sa.String(100), nullable=True),
        sa.Column('unit1_quantity', sa.Float(), nullable=True),
        sa.Column('unit1_name', sa.String(50), nullable=True),
        sa.Column('unit2_quantity', sa.Float(), nullable=True),
        sa.Column('unit2_name', sa.String(50), nullable=True),
        sa.Column('unit3_quantity', sa.Float(), nullable=True),
        sa.Column('unit3_name', sa.String(50), nullable=True),
        sa.Column('synced_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('product_id', 'smith_location_id', name='uq_product_location_snapshot'),
    )


def downgrade():
    op.drop_table('warehouse_stock_snapshot_detail')
