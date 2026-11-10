"""stock_transfers: Pemindahan Barang (IT/MM/NNNN) + Terima Barang (-n)

Revision ID: e3f5a7b9c1d4
Revises: d2e4a6b8c0f3
"""
from alembic import op
import sqlalchemy as sa

revision = 'e3f5a7b9c1d4'
down_revision = 'd2e4a6b8c0f3'
branch_labels = None
depends_on = None


def upgrade():
    tables = sa.inspect(op.get_bind()).get_table_names()
    if 'stock_transfers' not in tables:
        op.create_table(
            'stock_transfers',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('transfer_number', sa.String(50), nullable=False, unique=True, index=True),
            sa.Column('source_type', sa.String(30), nullable=False, server_default='manual'),
            sa.Column('source_id', sa.Integer(), nullable=True),
            sa.Column('source_number', sa.String(100), nullable=True),
            sa.Column('from_location_id', sa.Integer(), sa.ForeignKey('warehouse_locations.id'), nullable=False),
            sa.Column('to_location_id', sa.Integer(), sa.ForeignKey('warehouse_locations.id'), nullable=False),
            sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('shipped_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('shipped_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
    if 'stock_transfer_lines' not in tables:
        op.create_table(
            'stock_transfer_lines',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('transfer_id', sa.Integer(), sa.ForeignKey('stock_transfers.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('material_id', sa.Integer(), sa.ForeignKey('materials.id'), nullable=True),
            sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id'), nullable=True),
            sa.Column('item_code', sa.String(100), nullable=True),
            sa.Column('item_name', sa.String(255), nullable=False),
            sa.Column('uom', sa.String(20), nullable=True),
            sa.Column('quantity', sa.Numeric(15, 4), nullable=False),
            sa.Column('received_quantity', sa.Numeric(15, 4), nullable=False, server_default='0'),
            sa.Column('batch_number', sa.String(100), nullable=True),
        )
    if 'stock_transfer_receipts' not in tables:
        op.create_table(
            'stock_transfer_receipts',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('transfer_id', sa.Integer(), sa.ForeignKey('stock_transfers.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('receipt_number', sa.String(60), nullable=False, unique=True, index=True),
            sa.Column('to_location_id', sa.Integer(), sa.ForeignKey('warehouse_locations.id'), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('received_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('received_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    if 'stock_transfer_receipt_lines' not in tables:
        op.create_table(
            'stock_transfer_receipt_lines',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('receipt_id', sa.Integer(), sa.ForeignKey('stock_transfer_receipts.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('line_id', sa.Integer(), sa.ForeignKey('stock_transfer_lines.id'), nullable=False),
            sa.Column('quantity', sa.Numeric(15, 4), nullable=False),
        )


def downgrade():
    for t in ('stock_transfer_receipt_lines', 'stock_transfer_receipts', 'stock_transfer_lines', 'stock_transfers'):
        op.drop_table(t)
