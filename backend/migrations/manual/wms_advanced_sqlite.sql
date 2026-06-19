-- Manual SQL for WMS Advanced Migration (SQLite)
-- Run this directly on your database server via SSH
-- sqlite3 /path/to/your/database.db < wms_advanced_sqlite.sql

-- 1. Material Consumptions - Track material usage per Work Order
CREATE TABLE IF NOT EXISTS material_consumptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_order_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    bom_item_id INTEGER,
    quantity_planned REAL NOT NULL DEFAULT 0,
    uom TEXT,
    quantity_actual REAL NOT NULL DEFAULT 0,
    variance REAL NOT NULL DEFAULT 0,
    variance_percentage REAL NOT NULL DEFAULT 0,
    from_inventory_id INTEGER,
    from_location_id INTEGER,
    from_batch_number TEXT,
    issued_by INTEGER,
    issued_at TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_mc_wo_material ON material_consumptions(work_order_id, material_id);

-- 2. Inventory Transactions - Unified transaction log
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_number TEXT NOT NULL UNIQUE,
    transaction_type TEXT NOT NULL,
    transaction_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    product_id INTEGER,
    material_id INTEGER,
    quantity REAL NOT NULL,
    uom TEXT,
    direction TEXT NOT NULL,
    from_location_id INTEGER,
    to_location_id INTEGER,
    batch_number TEXT,
    lot_number TEXT,
    reference_type TEXT,
    reference_id INTEGER,
    reference_number TEXT,
    work_order_id INTEGER,
    machine_id INTEGER,
    shift TEXT,
    production_record_id INTEGER,
    unit_cost REAL,
    total_cost REAL,
    balance_before REAL,
    balance_after REAL,
    status TEXT NOT NULL DEFAULT 'completed',
    notes TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_it_txn_number ON inventory_transactions(transaction_number);
CREATE INDEX IF NOT EXISTS idx_it_type_date ON inventory_transactions(transaction_type, transaction_date);
CREATE INDEX IF NOT EXISTS idx_it_reference ON inventory_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_it_wo ON inventory_transactions(work_order_id);
CREATE INDEX IF NOT EXISTS idx_it_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_it_material ON inventory_transactions(material_id);

-- 3. Pick Lists
CREATE TABLE IF NOT EXISTS pick_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pick_number TEXT NOT NULL UNIQUE,
    pick_type TEXT NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    reference_number TEXT,
    assigned_to INTEGER,
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'draft',
    pick_date TEXT,
    started_at TEXT,
    completed_at TEXT,
    total_items INTEGER DEFAULT 0,
    picked_items INTEGER DEFAULT 0,
    notes TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pick_number ON pick_lists(pick_number);

-- 4. Pick List Items
CREATE TABLE IF NOT EXISTS pick_list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pick_list_id INTEGER NOT NULL,
    product_id INTEGER,
    material_id INTEGER,
    quantity_requested REAL NOT NULL,
    quantity_picked REAL NOT NULL DEFAULT 0,
    uom TEXT,
    location_id INTEGER,
    inventory_id INTEGER,
    batch_number TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    sequence INTEGER,
    picked_by INTEGER,
    picked_at TEXT,
    notes TEXT
);

-- 5. Stock Transfer Orders
CREATE TABLE IF NOT EXISTS stock_transfer_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_number TEXT NOT NULL UNIQUE,
    from_zone_id INTEGER NOT NULL,
    to_zone_id INTEGER NOT NULL,
    from_location_id INTEGER,
    to_location_id INTEGER,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    requested_by INTEGER NOT NULL,
    approved_by INTEGER,
    approved_at TEXT,
    transferred_by INTEGER,
    transferred_at TEXT,
    total_items INTEGER DEFAULT 0,
    priority TEXT NOT NULL DEFAULT 'normal',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_transfer_number ON stock_transfer_orders(transfer_number);

-- 6. Stock Transfer Items
CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_order_id INTEGER NOT NULL,
    product_id INTEGER,
    material_id INTEGER,
    quantity REAL NOT NULL,
    quantity_transferred REAL NOT NULL DEFAULT 0,
    uom TEXT,
    batch_number TEXT,
    from_inventory_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT
);

-- 7. Cycle Count Schedules
CREATE TABLE IF NOT EXISTS cycle_count_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_number TEXT NOT NULL UNIQUE,
    zone_id INTEGER,
    location_id INTEGER,
    abc_category TEXT,
    frequency TEXT NOT NULL,
    next_count_date TEXT NOT NULL,
    last_count_date TEXT,
    assigned_to INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    total_items_counted INTEGER DEFAULT 0,
    discrepancies_found INTEGER DEFAULT 0,
    accuracy_percentage REAL DEFAULT 100,
    notes TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cc_schedule_number ON cycle_count_schedules(schedule_number);

-- 8. Add additional columns to existing inventory table for production tracking
-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, check first
PRAGMA table_info(inventory);

-- Add columns if they don't exist
-- ALTER TABLE inventory ADD COLUMN machine_id INTEGER;
-- ALTER TABLE inventory ADD COLUMN shift TEXT;
-- ALTER TABLE inventory ADD COLUMN production_record_id INTEGER;
-- ALTER TABLE inventory ADD COLUMN fifo_date TEXT;

-- 9. Add aisle column to warehouse_locations for multi-level structure
-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, check first
PRAGMA table_info(warehouse_locations);

-- Add columns if they don't exist
-- ALTER TABLE warehouse_locations ADD COLUMN aisle TEXT;
-- ALTER TABLE warehouse_locations ADD COLUMN bin_code TEXT;
-- ALTER TABLE warehouse_locations ADD COLUMN is_default INTEGER DEFAULT 0;
-- ALTER TABLE warehouse_locations ADD COLUMN fifo_enabled INTEGER DEFAULT 1;

-- Note: For SQLite, you need to manually check if columns exist before adding them
-- Use the following Python script or check via sqlite3 command:
-- PRAGMA table_info(table_name);
-- Then run ALTER TABLE only if column doesn't exist

-- Note: Foreign key constraints in SQLite are not enforced by default
-- They are created for documentation purposes but require PRAGMA foreign_keys=ON to enforce
