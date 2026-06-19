-- Manual SQL for Asset Management Migration
-- Run this directly on your database server via SSH
-- psql -U your_user -d your_database -f asset_management.sql

-- 1. Create assets table
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    asset_code VARCHAR(100) NOT NULL UNIQUE,
    asset_name VARCHAR(200) NOT NULL,
    asset_type VARCHAR(50) NOT NULL,
    category VARCHAR(100),
    subcategory VARCHAR(100),
    description TEXT,
    status VARCHAR(50) NOT NULL,
    
    -- Procurement
    purchase_order_id INTEGER REFERENCES purchase_orders(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    purchase_date DATE,
    purchase_cost NUMERIC(15,2),
    invoice_number VARCHAR(100),
    warranty_start_date DATE,
    warranty_end_date DATE,
    warranty_terms TEXT,
    
    -- Installation
    installation_date DATE,
    commissioning_date DATE,
    location VARCHAR(200),
    department_id INTEGER REFERENCES departments(id),
    responsible_person_id INTEGER REFERENCES employees(id),
    
    -- Financial
    depreciation_method VARCHAR(50),
    useful_life_years INTEGER,
    useful_life_units INTEGER,
    salvage_value NUMERIC(15,2) DEFAULT 0,
    accumulated_depreciation NUMERIC(15,2) DEFAULT 0,
    last_depreciation_date DATE,
    
    -- Production Machine
    is_production_machine BOOLEAN NOT NULL DEFAULT false,
    machine_code VARCHAR(50),
    capacity NUMERIC(15,2),
    speed INTEGER,
    capacity_uom VARCHAR(20),
    specifications TEXT,
    
    -- Maintenance
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    maintenance_frequency_days INTEGER,
    total_maintenance_cost NUMERIC(15,2) DEFAULT 0,
    total_downtime_hours NUMERIC(10,2) DEFAULT 0,
    
    -- Disposal
    disposal_date DATE,
    disposal_method VARCHAR(50),
    disposal_value NUMERIC(15,2),
    disposal_notes TEXT,
    
    -- Audit
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS ix_assets_asset_code ON assets(asset_code);
CREATE INDEX IF NOT EXISTS ix_assets_machine_code ON assets(machine_code);

-- 2. Create depreciation_schedules table
CREATE TABLE IF NOT EXISTS depreciation_schedules (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    period_date DATE NOT NULL,
    depreciation_amount NUMERIC(15,2) NOT NULL,
    accumulated_depreciation NUMERIC(15,2) NOT NULL,
    net_book_value NUMERIC(15,2) NOT NULL,
    is_posted BOOLEAN NOT NULL DEFAULT false,
    posted_date TIMESTAMP,
    accounting_entry_id INTEGER REFERENCES accounting_entries(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_id, period_date)
);

CREATE INDEX IF NOT EXISTS ix_depreciation_period ON depreciation_schedules(period_date);

-- 3. Create asset_transfers table
CREATE TABLE IF NOT EXISTS asset_transfers (
    id SERIAL PRIMARY KEY,
    transfer_number VARCHAR(100) NOT NULL UNIQUE,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    transfer_date DATE NOT NULL,
    from_location VARCHAR(200),
    from_department_id INTEGER REFERENCES departments(id),
    from_responsible_id INTEGER REFERENCES employees(id),
    to_location VARCHAR(200) NOT NULL,
    to_department_id INTEGER REFERENCES departments(id),
    to_responsible_id INTEGER NOT NULL REFERENCES employees(id),
    reason TEXT,
    status VARCHAR(50) NOT NULL,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_asset_transfers_transfer_number ON asset_transfers(transfer_number);
CREATE INDEX IF NOT EXISTS ix_asset_transfers_transfer_date ON asset_transfers(transfer_date);

-- 4. Create asset_valuations table
CREATE TABLE IF NOT EXISTS asset_valuations (
    id SERIAL PRIMARY KEY,
    valuation_number VARCHAR(100) NOT NULL UNIQUE,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    valuation_date DATE NOT NULL,
    valuation_type VARCHAR(50) NOT NULL,
    old_value NUMERIC(15,2) NOT NULL,
    new_value NUMERIC(15,2) NOT NULL,
    adjustment_amount NUMERIC(15,2) NOT NULL,
    reason TEXT NOT NULL,
    valuer_name VARCHAR(200),
    valuation_report VARCHAR(500),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    accounting_entry_id INTEGER REFERENCES accounting_entries(id),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_asset_valuations_valuation_number ON asset_valuations(valuation_number);
CREATE INDEX IF NOT EXISTS ix_asset_valuations_valuation_date ON asset_valuations(valuation_date);

-- 5. Create spare_parts table
CREATE TABLE IF NOT EXISTS spare_parts (
    id SERIAL PRIMARY KEY,
    part_number VARCHAR(100) NOT NULL UNIQUE,
    part_name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    uom VARCHAR(20) NOT NULL,
    current_stock NUMERIC(15,2) NOT NULL DEFAULT 0,
    min_stock NUMERIC(15,2) DEFAULT 0,
    reorder_point NUMERIC(15,2) DEFAULT 0,
    max_stock NUMERIC(15,2),
    unit_cost NUMERIC(15,2),
    last_purchase_cost NUMERIC(15,2),
    primary_supplier_id INTEGER REFERENCES suppliers(id),
    lead_time_days INTEGER,
    compatible_assets TEXT,
    warehouse_location VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_spare_parts_part_number ON spare_parts(part_number);

-- 6. Create spare_part_movements table
CREATE TABLE IF NOT EXISTS spare_part_movements (
    id SERIAL PRIMARY KEY,
    movement_number VARCHAR(100) NOT NULL UNIQUE,
    spare_part_id INTEGER NOT NULL REFERENCES spare_parts(id) ON DELETE CASCADE,
    movement_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    movement_type VARCHAR(50) NOT NULL,
    quantity NUMERIC(15,2) NOT NULL,
    unit_cost NUMERIC(15,2),
    total_cost NUMERIC(15,2),
    maintenance_record_id INTEGER REFERENCES maintenance_records(id),
    asset_id INTEGER REFERENCES assets(id),
    purchase_order_id INTEGER REFERENCES purchase_orders(id),
    stock_before NUMERIC(15,2),
    stock_after NUMERIC(15,2),
    notes TEXT,
    performed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_spare_part_movements_movement_number ON spare_part_movements(movement_number);
CREATE INDEX IF NOT EXISTS ix_spare_part_movements_movement_date ON spare_part_movements(movement_date);

-- 7. Add asset_id to maintenance_records (nullable for backward compatibility)
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS asset_id INTEGER REFERENCES assets(id);

-- 8. Make machine_id nullable in maintenance_records for migration
ALTER TABLE maintenance_records ALTER COLUMN machine_id DROP NOT NULL;

-- 9. Record migration in alembic_version (if using PostgreSQL)
-- Uncomment and adjust if you want to track this migration in alembic
-- INSERT INTO alembic_version (version_num) VALUES ('asset_management_001')
-- ON CONFLICT (version_num) DO NOTHING;

COMMIT;
