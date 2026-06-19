-- Manual SQL for Asset Management Migration (SQLite)
-- Run this directly on your database server via SSH
-- sqlite3 /path/to/your/database.db < asset_management_sqlite.sql

-- 1. Create assets table
CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_code TEXT NOT NULL UNIQUE,
    asset_name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    category TEXT,
    subcategory TEXT,
    description TEXT,
    status TEXT NOT NULL,
    
    -- Procurement
    purchase_order_id INTEGER,
    supplier_id INTEGER,
    purchase_date TEXT,
    purchase_cost REAL,
    invoice_number TEXT,
    warranty_start_date TEXT,
    warranty_end_date TEXT,
    warranty_terms TEXT,
    
    -- Installation
    installation_date TEXT,
    commissioning_date TEXT,
    location TEXT,
    department_id INTEGER,
    responsible_person_id INTEGER,
    
    -- Financial
    depreciation_method TEXT,
    useful_life_years INTEGER,
    useful_life_units INTEGER,
    salvage_value REAL DEFAULT 0,
    accumulated_depreciation REAL DEFAULT 0,
    last_depreciation_date TEXT,
    
    -- Production Machine
    is_production_machine INTEGER NOT NULL DEFAULT 0,
    machine_code TEXT,
    capacity REAL,
    speed INTEGER,
    capacity_uom TEXT,
    specifications TEXT,
    
    -- Maintenance
    last_maintenance_date TEXT,
    next_maintenance_date TEXT,
    maintenance_frequency_days INTEGER,
    total_maintenance_cost REAL DEFAULT 0,
    total_downtime_hours REAL DEFAULT 0,
    
    -- Disposal
    disposal_date TEXT,
    disposal_method TEXT,
    disposal_value REAL,
    disposal_notes TEXT,
    
    -- Audit
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    updated_by INTEGER
);

CREATE INDEX IF NOT EXISTS ix_assets_asset_code ON assets(asset_code);
CREATE INDEX IF NOT EXISTS ix_assets_machine_code ON assets(machine_code);

-- 2. Create depreciation_schedules table
CREATE TABLE IF NOT EXISTS depreciation_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    period_date TEXT NOT NULL,
    depreciation_amount REAL NOT NULL,
    accumulated_depreciation REAL NOT NULL,
    net_book_value REAL NOT NULL,
    is_posted INTEGER NOT NULL DEFAULT 0,
    posted_date TEXT,
    accounting_entry_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_id, period_date)
);

CREATE INDEX IF NOT EXISTS ix_depreciation_period ON depreciation_schedules(period_date);

-- 3. Create asset_transfers table
CREATE TABLE IF NOT EXISTS asset_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_number TEXT NOT NULL UNIQUE,
    asset_id INTEGER NOT NULL,
    transfer_date TEXT NOT NULL,
    from_location TEXT,
    from_department_id INTEGER,
    from_responsible_id INTEGER,
    to_location TEXT NOT NULL,
    to_department_id INTEGER,
    to_responsible_id INTEGER NOT NULL,
    reason TEXT,
    status TEXT NOT NULL,
    approved_by INTEGER,
    approved_at TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_asset_transfers_transfer_number ON asset_transfers(transfer_number);
CREATE INDEX IF NOT EXISTS ix_asset_transfers_transfer_date ON asset_transfers(transfer_date);

-- 4. Create asset_valuations table
CREATE TABLE IF NOT EXISTS asset_valuations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    valuation_number TEXT NOT NULL UNIQUE,
    asset_id INTEGER NOT NULL,
    valuation_date TEXT NOT NULL,
    valuation_type TEXT NOT NULL,
    old_value REAL NOT NULL,
    new_value REAL NOT NULL,
    adjustment_amount REAL NOT NULL,
    reason TEXT NOT NULL,
    valuer_name TEXT,
    valuation_report TEXT,
    approved_by INTEGER,
    approved_at TEXT,
    accounting_entry_id INTEGER,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_asset_valuations_valuation_number ON asset_valuations(valuation_number);
CREATE INDEX IF NOT EXISTS ix_asset_valuations_valuation_date ON asset_valuations(valuation_date);

-- 5. Create spare_parts table
CREATE TABLE IF NOT EXISTS spare_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_number TEXT NOT NULL UNIQUE,
    part_name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    uom TEXT NOT NULL,
    current_stock REAL NOT NULL DEFAULT 0,
    min_stock REAL DEFAULT 0,
    reorder_point REAL DEFAULT 0,
    max_stock REAL,
    unit_cost REAL,
    last_purchase_cost REAL,
    primary_supplier_id INTEGER,
    lead_time_days INTEGER,
    compatible_assets TEXT,
    warehouse_location TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS ix_spare_parts_part_number ON spare_parts(part_number);

-- 6. Create spare_part_movements table
CREATE TABLE IF NOT EXISTS spare_part_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_number TEXT NOT NULL UNIQUE,
    spare_part_id INTEGER NOT NULL,
    movement_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_cost REAL,
    total_cost REAL,
    maintenance_record_id INTEGER,
    asset_id INTEGER,
    purchase_order_id INTEGER,
    stock_before REAL,
    stock_after REAL,
    notes TEXT,
    performed_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_spare_part_movements_movement_number ON spare_part_movements(movement_number);
CREATE INDEX IF NOT EXISTS ix_spare_part_movements_movement_date ON spare_part_movements(movement_date);

-- 7. Add asset_id to maintenance_records (nullable for backward compatibility)
-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so check first
PRAGMA table_info(maintenance_records);

-- If asset_id doesn't exist, add it
-- ALTER TABLE maintenance_records ADD COLUMN asset_id INTEGER;

-- 8. Make machine_id nullable in maintenance_records for migration
-- SQLite doesn't support ALTER COLUMN directly, need to recreate table
-- This is handled by the migration script in Alembic

-- Note: Foreign key constraints in SQLite are not enforced by default
-- They are created for documentation purposes but require PRAGMA foreign_keys=ON to enforce
