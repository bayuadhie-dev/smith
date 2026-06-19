-- Manual SQL for WMS Advanced Migration
-- Run this directly on your database server via SSH
-- psql -U your_user -d your_database -f wms_advanced.sql

-- 1. Material Consumptions - Track material usage per Work Order
CREATE TABLE IF NOT EXISTS material_consumptions (
    id SERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
    material_id INTEGER NOT NULL REFERENCES materials(id),
    bom_item_id INTEGER REFERENCES bom_items(id),
    quantity_planned NUMERIC(15,3) NOT NULL DEFAULT 0,
    uom VARCHAR(20),
    quantity_actual NUMERIC(15,3) NOT NULL DEFAULT 0,
    variance NUMERIC(15,3) NOT NULL DEFAULT 0,
    variance_percentage NUMERIC(8,2) NOT NULL DEFAULT 0,
    from_inventory_id INTEGER REFERENCES inventory(id),
    from_location_id INTEGER REFERENCES warehouse_locations(id),
    from_batch_number VARCHAR(100),
    issued_by INTEGER REFERENCES users(id),
    issued_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'planned',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mc_wo_material ON material_consumptions(work_order_id, material_id);

-- 2. Inventory Transactions - Unified transaction log
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    transaction_number VARCHAR(50) NOT NULL UNIQUE,
    transaction_type VARCHAR(30) NOT NULL,
    transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    product_id INTEGER REFERENCES products(id),
    material_id INTEGER REFERENCES materials(id),
    quantity NUMERIC(15,3) NOT NULL,
    uom VARCHAR(20),
    direction VARCHAR(3) NOT NULL,
    from_location_id INTEGER REFERENCES warehouse_locations(id),
    to_location_id INTEGER REFERENCES warehouse_locations(id),
    batch_number VARCHAR(100),
    lot_number VARCHAR(100),
    reference_type VARCHAR(50),
    reference_id INTEGER,
    reference_number VARCHAR(100),
    work_order_id INTEGER REFERENCES work_orders(id),
    machine_id INTEGER REFERENCES machines(id),
    shift VARCHAR(20),
    production_record_id INTEGER REFERENCES production_records(id),
    unit_cost NUMERIC(15,4),
    total_cost NUMERIC(15,2),
    balance_before NUMERIC(15,3),
    balance_after NUMERIC(15,3),
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_it_txn_number ON inventory_transactions(transaction_number);
CREATE INDEX IF NOT EXISTS idx_it_type_date ON inventory_transactions(transaction_type, transaction_date);
CREATE INDEX IF NOT EXISTS idx_it_reference ON inventory_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_it_wo ON inventory_transactions(work_order_id);
CREATE INDEX IF NOT EXISTS idx_it_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_it_material ON inventory_transactions(material_id);

-- 3. Pick Lists
CREATE TABLE IF NOT EXISTS pick_lists (
    id SERIAL PRIMARY KEY,
    pick_number VARCHAR(50) NOT NULL UNIQUE,
    pick_type VARCHAR(30) NOT NULL,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    reference_number VARCHAR(100),
    assigned_to INTEGER REFERENCES users(id),
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    pick_date TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    total_items INTEGER DEFAULT 0,
    picked_items INTEGER DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pick_number ON pick_lists(pick_number);

-- 4. Pick List Items
CREATE TABLE IF NOT EXISTS pick_list_items (
    id SERIAL PRIMARY KEY,
    pick_list_id INTEGER NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    material_id INTEGER REFERENCES materials(id),
    quantity_requested NUMERIC(15,3) NOT NULL,
    quantity_picked NUMERIC(15,3) NOT NULL DEFAULT 0,
    uom VARCHAR(20),
    location_id INTEGER REFERENCES warehouse_locations(id),
    inventory_id INTEGER REFERENCES inventory(id),
    batch_number VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sequence INTEGER,
    picked_by INTEGER REFERENCES users(id),
    picked_at TIMESTAMP,
    notes TEXT
);

-- 5. Stock Transfer Orders
CREATE TABLE IF NOT EXISTS stock_transfer_orders (
    id SERIAL PRIMARY KEY,
    transfer_number VARCHAR(50) NOT NULL UNIQUE,
    from_zone_id INTEGER NOT NULL REFERENCES warehouse_zones(id),
    to_zone_id INTEGER NOT NULL REFERENCES warehouse_zones(id),
    from_location_id INTEGER REFERENCES warehouse_locations(id),
    to_location_id INTEGER REFERENCES warehouse_locations(id),
    reason VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    requested_by INTEGER NOT NULL REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    transferred_by INTEGER REFERENCES users(id),
    transferred_at TIMESTAMP,
    total_items INTEGER DEFAULT 0,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfer_number ON stock_transfer_orders(transfer_number);

-- 6. Stock Transfer Items
CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id SERIAL PRIMARY KEY,
    transfer_order_id INTEGER NOT NULL REFERENCES stock_transfer_orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    material_id INTEGER REFERENCES materials(id),
    quantity NUMERIC(15,3) NOT NULL,
    quantity_transferred NUMERIC(15,3) NOT NULL DEFAULT 0,
    uom VARCHAR(20),
    batch_number VARCHAR(100),
    from_inventory_id INTEGER REFERENCES inventory(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    notes TEXT
);

-- 7. Cycle Count Schedules
CREATE TABLE IF NOT EXISTS cycle_count_schedules (
    id SERIAL PRIMARY KEY,
    schedule_number VARCHAR(50) NOT NULL UNIQUE,
    zone_id INTEGER REFERENCES warehouse_zones(id),
    location_id INTEGER REFERENCES warehouse_locations(id),
    abc_category CHAR(1),
    frequency VARCHAR(20) NOT NULL,
    next_count_date DATE NOT NULL,
    last_count_date DATE,
    assigned_to INTEGER REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    total_items_counted INTEGER DEFAULT 0,
    discrepancies_found INTEGER DEFAULT 0,
    accuracy_percentage NUMERIC(5,2) DEFAULT 100,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cc_schedule_number ON cycle_count_schedules(schedule_number);

-- 8. Add additional columns to existing inventory table for production tracking
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS machine_id INTEGER REFERENCES machines(id);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS shift VARCHAR(20);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS production_record_id INTEGER REFERENCES production_records(id);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS fifo_date TIMESTAMP;

-- 9. Add aisle column to warehouse_locations for multi-level structure
ALTER TABLE warehouse_locations ADD COLUMN IF NOT EXISTS aisle VARCHAR(10);
ALTER TABLE warehouse_locations ADD COLUMN IF NOT EXISTS bin_code VARCHAR(10);
ALTER TABLE warehouse_locations ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE warehouse_locations ADD COLUMN IF NOT EXISTS fifo_enabled BOOLEAN DEFAULT true;

-- 10. Record migration in alembic_version (if using PostgreSQL)
-- Uncomment and adjust if you want to track this migration in alembic
-- INSERT INTO alembic_version (version_num) VALUES ('wms_advanced_001')
-- ON CONFLICT (version_num) DO NOTHING;

COMMIT;
