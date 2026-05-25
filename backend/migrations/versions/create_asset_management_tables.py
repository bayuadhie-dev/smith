"""Create Asset Management tables

Revision ID: asset_management_001
Revises: 
Create Date: 2026-05-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'asset_management_001'
down_revision = None  # Update this to point to your latest migration
branch_labels = None
depends_on = None


def upgrade():
    # Create assets table
    op.create_table('assets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('asset_code', sa.String(length=100), nullable=False),
        sa.Column('asset_name', sa.String(length=200), nullable=False),
        sa.Column('asset_type', sa.String(length=50), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('subcategory', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        
        # Procurement
        sa.Column('purchase_order_id', sa.Integer(), nullable=True),
        sa.Column('supplier_id', sa.Integer(), nullable=True),
        sa.Column('purchase_date', sa.Date(), nullable=True),
        sa.Column('purchase_cost', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('invoice_number', sa.String(length=100), nullable=True),
        sa.Column('warranty_start_date', sa.Date(), nullable=True),
        sa.Column('warranty_end_date', sa.Date(), nullable=True),
        sa.Column('warranty_terms', sa.Text(), nullable=True),
        
        # Installation
        sa.Column('installation_date', sa.Date(), nullable=True),
        sa.Column('commissioning_date', sa.Date(), nullable=True),
        sa.Column('location', sa.String(length=200), nullable=True),
        sa.Column('department_id', sa.Integer(), nullable=True),
        sa.Column('responsible_person_id', sa.Integer(), nullable=True),
        
        # Financial
        sa.Column('depreciation_method', sa.String(length=50), nullable=True),
        sa.Column('useful_life_years', sa.Integer(), nullable=True),
        sa.Column('useful_life_units', sa.Integer(), nullable=True),
        sa.Column('salvage_value', sa.Numeric(precision=15, scale=2), server_default='0'),
        sa.Column('accumulated_depreciation', sa.Numeric(precision=15, scale=2), server_default='0'),
        sa.Column('last_depreciation_date', sa.Date(), nullable=True),
        
        # Production Machine
        sa.Column('is_production_machine', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('machine_code', sa.String(length=50), nullable=True),
        sa.Column('capacity', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('speed', sa.Integer(), nullable=True),
        sa.Column('capacity_uom', sa.String(length=20), nullable=True),
        sa.Column('specifications', sa.Text(), nullable=True),
        
        # Maintenance
        sa.Column('last_maintenance_date', sa.Date(), nullable=True),
        sa.Column('next_maintenance_date', sa.Date(), nullable=True),
        sa.Column('maintenance_frequency_days', sa.Integer(), nullable=True),
        sa.Column('total_maintenance_cost', sa.Numeric(precision=15, scale=2), server_default='0'),
        sa.Column('total_downtime_hours', sa.Numeric(precision=10, scale=2), server_default='0'),
        
        # Disposal
        sa.Column('disposal_date', sa.Date(), nullable=True),
        sa.Column('disposal_method', sa.String(length=50), nullable=True),
        sa.Column('disposal_value', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('disposal_notes', sa.Text(), nullable=True),
        
        # Audit
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('asset_code'),
        sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id'], ),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ),
        sa.ForeignKeyConstraint(['responsible_person_id'], ['employees.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], )
    )
    op.create_index('ix_assets_asset_code', 'assets', ['asset_code'])
    op.create_index('ix_assets_machine_code', 'assets', ['machine_code'])

    # Create depreciation_schedules table
    op.create_table('depreciation_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('period_date', sa.Date(), nullable=False),
        sa.Column('depreciation_amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('accumulated_depreciation', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('net_book_value', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('is_posted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('posted_date', sa.DateTime(), nullable=True),
        sa.Column('accounting_entry_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['accounting_entry_id'], ['accounting_entries.id'], ),
        sa.UniqueConstraint('asset_id', 'period_date', name='unique_asset_period')
    )
    op.create_index('ix_depreciation_period', 'depreciation_schedules', ['period_date'])

    # Create asset_transfers table
    op.create_table('asset_transfers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transfer_number', sa.String(length=100), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('transfer_date', sa.Date(), nullable=False),
        sa.Column('from_location', sa.String(length=200), nullable=True),
        sa.Column('from_department_id', sa.Integer(), nullable=True),
        sa.Column('from_responsible_id', sa.Integer(), nullable=True),
        sa.Column('to_location', sa.String(length=200), nullable=False),
        sa.Column('to_department_id', sa.Integer(), nullable=True),
        sa.Column('to_responsible_id', sa.Integer(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('transfer_number'),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['from_department_id'], ['departments.id'], ),
        sa.ForeignKeyConstraint(['to_department_id'], ['departments.id'], ),
        sa.ForeignKeyConstraint(['from_responsible_id'], ['employees.id'], ),
        sa.ForeignKeyConstraint(['to_responsible_id'], ['employees.id'], ),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], )
    )
    op.create_index('ix_asset_transfers_transfer_number', 'asset_transfers', ['transfer_number'])
    op.create_index('ix_asset_transfers_transfer_date', 'asset_transfers', ['transfer_date'])

    # Create asset_valuations table
    op.create_table('asset_valuations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('valuation_number', sa.String(length=100), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('valuation_date', sa.Date(), nullable=False),
        sa.Column('valuation_type', sa.String(length=50), nullable=False),
        sa.Column('old_value', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('new_value', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('adjustment_amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('valuer_name', sa.String(length=200), nullable=True),
        sa.Column('valuation_report', sa.String(length=500), nullable=True),
        sa.Column('approved_by', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('accounting_entry_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('valuation_number'),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['accounting_entry_id'], ['accounting_entries.id'], )
    )
    op.create_index('ix_asset_valuations_valuation_number', 'asset_valuations', ['valuation_number'])
    op.create_index('ix_asset_valuations_valuation_date', 'asset_valuations', ['valuation_date'])

    # Create spare_parts table
    op.create_table('spare_parts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('part_number', sa.String(length=100), nullable=False),
        sa.Column('part_name', sa.String(length=200), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('uom', sa.String(length=20), nullable=False),
        sa.Column('current_stock', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0'),
        sa.Column('min_stock', sa.Numeric(precision=15, scale=2), server_default='0'),
        sa.Column('reorder_point', sa.Numeric(precision=15, scale=2), server_default='0'),
        sa.Column('max_stock', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('unit_cost', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('last_purchase_cost', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('primary_supplier_id', sa.Integer(), nullable=True),
        sa.Column('lead_time_days', sa.Integer(), nullable=True),
        sa.Column('compatible_assets', sa.Text(), nullable=True),
        sa.Column('warehouse_location', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('part_number'),
        sa.ForeignKeyConstraint(['primary_supplier_id'], ['suppliers.id'], )
    )
    op.create_index('ix_spare_parts_part_number', 'spare_parts', ['part_number'])

    # Create spare_part_movements table
    op.create_table('spare_part_movements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('movement_number', sa.String(length=100), nullable=False),
        sa.Column('spare_part_id', sa.Integer(), nullable=False),
        sa.Column('movement_date', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('movement_type', sa.String(length=50), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('unit_cost', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('total_cost', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('maintenance_record_id', sa.Integer(), nullable=True),
        sa.Column('asset_id', sa.Integer(), nullable=True),
        sa.Column('purchase_order_id', sa.Integer(), nullable=True),
        sa.Column('stock_before', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('stock_after', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('performed_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('movement_number'),
        sa.ForeignKeyConstraint(['spare_part_id'], ['spare_parts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['maintenance_record_id'], ['maintenance_records.id'], ),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ),
        sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id'], ),
        sa.ForeignKeyConstraint(['performed_by'], ['users.id'], )
    )
    op.create_index('ix_spare_part_movements_movement_number', 'spare_part_movements', ['movement_number'])
    op.create_index('ix_spare_part_movements_movement_date', 'spare_part_movements', ['movement_date'])

    # Add asset_id to maintenance_records (nullable for backward compatibility)
    op.add_column('maintenance_records', sa.Column('asset_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_maintenance_records_asset_id', 'maintenance_records', 'assets', ['asset_id'], ['id'])
    
    # Make machine_id nullable in maintenance_records for migration
    op.alter_column('maintenance_records', 'machine_id', nullable=True)


def downgrade():
    # Drop foreign key and column from maintenance_records
    op.drop_constraint('fk_maintenance_records_asset_id', 'maintenance_records', type_='foreignkey')
    op.drop_column('maintenance_records', 'asset_id')
    op.alter_column('maintenance_records', 'machine_id', nullable=False)
    
    # Drop tables in reverse order
    op.drop_index('ix_spare_part_movements_movement_date', 'spare_part_movements')
    op.drop_index('ix_spare_part_movements_movement_number', 'spare_part_movements')
    op.drop_table('spare_part_movements')
    
    op.drop_index('ix_spare_parts_part_number', 'spare_parts')
    op.drop_table('spare_parts')
    
    op.drop_index('ix_asset_valuations_valuation_date', 'asset_valuations')
    op.drop_index('ix_asset_valuations_valuation_number', 'asset_valuations')
    op.drop_table('asset_valuations')
    
    op.drop_index('ix_asset_transfers_transfer_date', 'asset_transfers')
    op.drop_index('ix_asset_transfers_transfer_number', 'asset_transfers')
    op.drop_table('asset_transfers')
    
    op.drop_index('ix_depreciation_period', 'depreciation_schedules')
    op.drop_table('depreciation_schedules')
    
    op.drop_index('ix_assets_machine_code', 'assets')
    op.drop_index('ix_assets_asset_code', 'assets')
    op.drop_table('assets')
