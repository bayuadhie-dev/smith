"""Create WMS Advanced tables

Revision ID: wms_advanced_001
Revises: asset_management_001
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa

revision = 'wms_advanced_001'
down_revision = 'asset_management_001'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Material Consumptions - Track material usage per Work Order
    op.create_table('material_consumptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('work_order_id', sa.Integer(), nullable=False),
        sa.Column('material_id', sa.Integer(), nullable=False),
        sa.Column('bom_item_id', sa.Integer(), nullable=True),
        sa.Column('quantity_planned', sa.Numeric(15, 3), nullable=False, server_default='0'),
        sa.Column('uom', sa.String(20), nullable=True),
        sa.Column('quantity_actual', sa.Numeric(15, 3), nullable=False, server_default='0'),
        sa.Column('variance', sa.Numeric(15, 3), nullable=False, server_default='0'),
        sa.Column('variance_percentage', sa.Numeric(8, 2), nullable=False, server_default='0'),
        sa.Column('from_inventory_id', sa.Integer(), nullable=True),
        sa.Column('from_location_id', sa.Integer(), nullable=True),
        sa.Column('from_batch_number', sa.String(100), nullable=True),
        sa.Column('issued_by', sa.Integer(), nullable=True),
        sa.Column('issued_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='planned'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id']),
        sa.ForeignKeyConstraint(['material_id'], ['materials.id']),
        sa.ForeignKeyConstraint(['bom_item_id'], ['bom_items.id']),
        sa.ForeignKeyConstraint(['from_inventory_id'], ['inventory.id']),
        sa.ForeignKeyConstraint(['from_location_id'], ['warehouse_locations.id']),
        sa.ForeignKeyConstraint(['issued_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_mc_wo_material', 'material_consumptions', ['work_order_id', 'material_id'])

    # 2. Inventory Transactions - Unified transaction log
    op.create_table('inventory_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transaction_number', sa.String(50), nullable=False),
        sa.Column('transaction_type', sa.String(30), nullable=False),
        sa.Column('transaction_date', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('material_id', sa.Integer(), nullable=True),
        sa.Column('quantity', sa.Numeric(15, 3), nullable=False),
        sa.Column('uom', sa.String(20), nullable=True),
        sa.Column('direction', sa.String(3), nullable=False),
        sa.Column('from_location_id', sa.Integer(), nullable=True),
        sa.Column('to_location_id', sa.Integer(), nullable=True),
        sa.Column('batch_number', sa.String(100), nullable=True),
        sa.Column('lot_number', sa.String(100), nullable=True),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('reference_id', sa.Integer(), nullable=True),
        sa.Column('reference_number', sa.String(100), nullable=True),
        sa.Column('work_order_id', sa.Integer(), nullable=True),
        sa.Column('machine_id', sa.Integer(), nullable=True),
        sa.Column('shift', sa.String(20), nullable=True),
        sa.Column('production_record_id', sa.Integer(), nullable=True),
        sa.Column('unit_cost', sa.Numeric(15, 4), nullable=True),
        sa.Column('total_cost', sa.Numeric(15, 2), nullable=True),
        sa.Column('balance_before', sa.Numeric(15, 3), nullable=True),
        sa.Column('balance_after', sa.Numeric(15, 3), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='completed'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['material_id'], ['materials.id']),
        sa.ForeignKeyConstraint(['from_location_id'], ['warehouse_locations.id']),
        sa.ForeignKeyConstraint(['to_location_id'], ['warehouse_locations.id']),
        sa.ForeignKeyConstraint(['work_order_id'], ['work_orders.id']),
        sa.ForeignKeyConstraint(['machine_id'], ['machines.id']),
        sa.ForeignKeyConstraint(['production_record_id'], ['production_records.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_it_txn_number', 'inventory_transactions', ['transaction_number'], unique=True)
    op.create_index('idx_it_type_date', 'inventory_transactions', ['transaction_type', 'transaction_date'])
    op.create_index('idx_it_reference', 'inventory_transactions', ['reference_type', 'reference_id'])
    op.create_index('idx_it_wo', 'inventory_transactions', ['work_order_id'])
    op.create_index('idx_it_product', 'inventory_transactions', ['product_id'])
    op.create_index('idx_it_material', 'inventory_transactions', ['material_id'])

    # 3. Pick Lists
    op.create_table('pick_lists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('pick_number', sa.String(50), nullable=False),
        sa.Column('pick_type', sa.String(30), nullable=False),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('reference_id', sa.Integer(), nullable=True),
        sa.Column('reference_number', sa.String(100), nullable=True),
        sa.Column('assigned_to', sa.Integer(), nullable=True),
        sa.Column('priority', sa.String(20), nullable=False, server_default='normal'),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('pick_date', sa.DateTime(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('total_items', sa.Integer(), server_default='0'),
        sa.Column('picked_items', sa.Integer(), server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_pick_number', 'pick_lists', ['pick_number'], unique=True)

    # 4. Pick List Items
    op.create_table('pick_list_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('pick_list_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('material_id', sa.Integer(), nullable=True),
        sa.Column('quantity_requested', sa.Numeric(15, 3), nullable=False),
        sa.Column('quantity_picked', sa.Numeric(15, 3), nullable=False, server_default='0'),
        sa.Column('uom', sa.String(20), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('inventory_id', sa.Integer(), nullable=True),
        sa.Column('batch_number', sa.String(100), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('sequence', sa.Integer(), nullable=True),
        sa.Column('picked_by', sa.Integer(), nullable=True),
        sa.Column('picked_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['pick_list_id'], ['pick_lists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['material_id'], ['materials.id']),
        sa.ForeignKeyConstraint(['location_id'], ['warehouse_locations.id']),
        sa.ForeignKeyConstraint(['inventory_id'], ['inventory.id']),
        sa.ForeignKeyConstraint(['picked_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # 5. Stock Transfer Orders
    op.create_table('stock_transfer_orders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transfer_number', sa.String(50), nullable=False),
        sa.Column('from_zone_id', sa.Integer(), nullable=False),
        sa.Column('to_zone_id', sa.Integer(), nullable=False),
        sa.Column('from_location_id', sa.Integer(), nullable=True),
        sa.Column('to_location_id', sa.Integer(), nullable=True),
        sa.Column('reason', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('requested_by', sa.Integer(), nullable=False),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('transferred_by', sa.Integer(), nullable=True),
        sa.Column('transferred_at', sa.DateTime(), nullable=True),
        sa.Column('total_items', sa.Integer(), server_default='0'),
        sa.Column('priority', sa.String(20), nullable=False, server_default='normal'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['from_zone_id'], ['warehouse_zones.id']),
        sa.ForeignKeyConstraint(['to_zone_id'], ['warehouse_zones.id']),
        sa.ForeignKeyConstraint(['from_location_id'], ['warehouse_locations.id']),
        sa.ForeignKeyConstraint(['to_location_id'], ['warehouse_locations.id']),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id']),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id']),
        sa.ForeignKeyConstraint(['transferred_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_transfer_number', 'stock_transfer_orders', ['transfer_number'], unique=True)

    # 6. Stock Transfer Items
    op.create_table('stock_transfer_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transfer_order_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('material_id', sa.Integer(), nullable=True),
        sa.Column('quantity', sa.Numeric(15, 3), nullable=False),
        sa.Column('quantity_transferred', sa.Numeric(15, 3), nullable=False, server_default='0'),
        sa.Column('uom', sa.String(20), nullable=True),
        sa.Column('batch_number', sa.String(100), nullable=True),
        sa.Column('from_inventory_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['transfer_order_id'], ['stock_transfer_orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['material_id'], ['materials.id']),
        sa.ForeignKeyConstraint(['from_inventory_id'], ['inventory.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # 7. Cycle Count Schedules
    op.create_table('cycle_count_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('schedule_number', sa.String(50), nullable=False),
        sa.Column('zone_id', sa.Integer(), nullable=True),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('abc_category', sa.String(1), nullable=True),
        sa.Column('frequency', sa.String(20), nullable=False),
        sa.Column('next_count_date', sa.Date(), nullable=False),
        sa.Column('last_count_date', sa.Date(), nullable=True),
        sa.Column('assigned_to', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('total_items_counted', sa.Integer(), server_default='0'),
        sa.Column('discrepancies_found', sa.Integer(), server_default='0'),
        sa.Column('accuracy_percentage', sa.Numeric(5, 2), server_default='100'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['zone_id'], ['warehouse_zones.id']),
        sa.ForeignKeyConstraint(['location_id'], ['warehouse_locations.id']),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_cc_schedule_number', 'cycle_count_schedules', ['schedule_number'], unique=True)

    # 8. Add additional columns to existing inventory table for production tracking
    with op.batch_alter_table('inventory') as batch_op:
        batch_op.add_column(sa.Column('machine_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('shift', sa.String(20), nullable=True))
        batch_op.add_column(sa.Column('production_record_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('fifo_date', sa.DateTime(), nullable=True))
        batch_op.create_foreign_key('fk_inventory_machine', 'machines', ['machine_id'], ['id'])
        batch_op.create_foreign_key('fk_inventory_production_record', 'production_records', ['production_record_id'], ['id'])

    # 9. Add aisle column to warehouse_locations for multi-level structure
    with op.batch_alter_table('warehouse_locations') as batch_op:
        batch_op.add_column(sa.Column('aisle', sa.String(10), nullable=True))
        batch_op.add_column(sa.Column('bin_code', sa.String(10), nullable=True))
        batch_op.add_column(sa.Column('is_default', sa.Boolean(), nullable=True, server_default='false'))
        batch_op.add_column(sa.Column('fifo_enabled', sa.Boolean(), nullable=True, server_default='true'))


def downgrade():
    # Remove added columns
    with op.batch_alter_table('warehouse_locations') as batch_op:
        batch_op.drop_column('fifo_enabled')
        batch_op.drop_column('is_default')
        batch_op.drop_column('bin_code')
        batch_op.drop_column('aisle')

    with op.batch_alter_table('inventory') as batch_op:
        batch_op.drop_constraint('fk_inventory_production_record', type_='foreignkey')
        batch_op.drop_constraint('fk_inventory_machine', type_='foreignkey')
        batch_op.drop_column('fifo_date')
        batch_op.drop_column('production_record_id')
        batch_op.drop_column('shift')
        batch_op.drop_column('machine_id')

    # Drop tables in reverse order
    op.drop_table('cycle_count_schedules')
    op.drop_table('stock_transfer_items')
    op.drop_table('stock_transfer_orders')
    op.drop_table('pick_list_items')
    op.drop_table('pick_lists')
    op.drop_table('inventory_transactions')
    op.drop_table('material_consumptions')
