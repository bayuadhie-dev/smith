# WIP to FG Conversion System Design

## 1. DATABASE SCHEMA

### Table: `fg_conversions`
Header untuk setiap konversi WIP → FG

```sql
CREATE TABLE fg_conversions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversion_number VARCHAR(50) UNIQUE NOT NULL,  -- FGC-2026-0001
    conversion_date DATE NOT NULL,
    batch_number VARCHAR(100),  -- Link to production batch
    
    -- WIP Source
    wip_stock_id INTEGER,  -- FK to wip_stocks
    wip_quantity_pcs DECIMAL(15,2),  -- Input dari WIP
    
    -- FG Output
    fg_quantity_pcs DECIMAL(15,2),  -- Output ke FG (after QC)
    fg_quantity_carton DECIMAL(15,2),
    
    -- Loss/Reject Tracking
    reject_quantity_pcs DECIMAL(15,2) DEFAULT 0,
    rework_quantity_pcs DECIMAL(15,2) DEFAULT 0,
    loss_quantity_pcs DECIMAL(15,2) DEFAULT 0,
    
    -- QC Integration
    qc_inspection_id INTEGER,  -- FK to qc_inspections
    qc_status VARCHAR(20),  -- 'pending', 'passed', 'failed', 'partial'
    qc_notes TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft',  -- draft, processing, completed, cancelled
    
    -- Costing
    total_material_cost DECIMAL(15,2) DEFAULT 0,
    total_labor_cost DECIMAL(15,2) DEFAULT 0,
    total_overhead_cost DECIMAL(15,2) DEFAULT 0,
    
    -- Audit
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    
    FOREIGN KEY (wip_stock_id) REFERENCES wip_stocks(id),
    FOREIGN KEY (qc_inspection_id) REFERENCES qc_inspections(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### Table: `fg_conversion_items`
Detail produk yang dikonversi (jika ada multiple products dalam 1 conversion)

```sql
CREATE TABLE fg_conversion_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversion_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    
    -- Quantities
    wip_quantity_pcs DECIMAL(15,2),
    fg_quantity_pcs DECIMAL(15,2),
    reject_quantity_pcs DECIMAL(15,2) DEFAULT 0,
    rework_quantity_pcs DECIMAL(15,2) DEFAULT 0,
    
    -- Batch & Expiry
    batch_number VARCHAR(100),
    production_date DATE,
    expired_date DATE,
    
    -- Inventory Location
    fg_inventory_id INTEGER,  -- FK to inventory (FG location)
    
    -- Reject/Loss Details
    reject_reason TEXT,
    reject_category VARCHAR(50),  -- 'quality', 'damage', 'contamination', etc
    
    notes TEXT,
    
    FOREIGN KEY (conversion_id) REFERENCES fg_conversions(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (fg_inventory_id) REFERENCES inventory(id)
);
```

### Table: `fg_conversion_materials`
Material yang dikonsumsi dalam proses WIP → FG (packaging, label, dll)

```sql
CREATE TABLE fg_conversion_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversion_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,  -- FK to products (material)
    
    -- Consumption
    quantity_required DECIMAL(15,2),  -- Dari BOM
    quantity_used DECIMAL(15,2),  -- Actual usage
    quantity_variance DECIMAL(15,2),  -- Variance (used - required)
    
    uom VARCHAR(20),
    unit_cost DECIMAL(15,2),
    total_cost DECIMAL(15,2),
    
    -- Inventory Deduction
    inventory_movement_id INTEGER,  -- FK to inventory_movements
    
    notes TEXT,
    
    FOREIGN KEY (conversion_id) REFERENCES fg_conversions(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES products(id),
    FOREIGN KEY (inventory_movement_id) REFERENCES inventory_movements(id)
);
```

### Table: `fg_conversion_loss_details`
Detail tracking untuk loss/reject dengan kategori dan alasan

```sql
CREATE TABLE fg_conversion_loss_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversion_id INTEGER NOT NULL,
    conversion_item_id INTEGER,
    
    loss_type VARCHAR(20),  -- 'reject', 'rework', 'loss', 'damage'
    quantity_pcs DECIMAL(15,2),
    
    -- Categorization
    category VARCHAR(50),  -- 'quality_defect', 'process_damage', 'contamination', etc
    reason TEXT,
    
    -- QC Reference
    qc_defect_id INTEGER,  -- FK to qc_defects if applicable
    
    -- Cost Impact
    cost_impact DECIMAL(15,2),  -- Estimated cost of loss
    
    -- Disposition
    disposition VARCHAR(50),  -- 'scrap', 'rework', 'downgrade', 'return_to_wip'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    
    FOREIGN KEY (conversion_id) REFERENCES fg_conversions(id) ON DELETE CASCADE,
    FOREIGN KEY (conversion_item_id) REFERENCES fg_conversion_items(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

## 2. BUSINESS LOGIC

### A. Batch Validation (Ingredient → Output Mesin)
```python
def validate_batch_output(batch_number, ingredient_qty, output_qty):
    """
    Validate output mesin vs ingredient (±10% tolerance)
    """
    tolerance = 0.10  # 10%
    min_expected = ingredient_qty * (1 - tolerance)
    max_expected = ingredient_qty * (1 + tolerance)
    
    if output_qty < min_expected:
        return False, f"Output terlalu rendah: {output_qty} < {min_expected}"
    elif output_qty > max_expected:
        return False, f"Output terlalu tinggi: {output_qty} > {max_expected}"
    else:
        return True, "Output dalam toleransi"
```

### B. Auto FG Conversion (Triggered after QC)
```python
def auto_create_fg_conversion(wip_stock_id, qc_inspection_id):
    """
    Automatically create FG conversion after QC inspection
    """
    # 1. Get WIP Stock
    wip = WIPStock.query.get(wip_stock_id)
    
    # 2. Get QC Results
    qc = QCInspection.query.get(qc_inspection_id)
    
    # 3. Calculate quantities based on QC
    fg_qty = qc.quantity_passed
    reject_qty = qc.quantity_rejected
    rework_qty = qc.quantity_rework
    
    # 4. Create FG Conversion
    conversion = FGConversion(
        wip_stock_id=wip_stock_id,
        wip_quantity_pcs=wip.quantity_pcs,
        fg_quantity_pcs=fg_qty,
        reject_quantity_pcs=reject_qty,
        rework_quantity_pcs=rework_qty,
        qc_inspection_id=qc_inspection_id,
        qc_status=qc.status,
        batch_number=wip.batch_number
    )
    
    # 5. Get BOM for material consumption
    bom_items = get_packaging_materials_from_bom(wip.product_id)
    
    # 6. Deduct materials from inventory
    for bom_item in bom_items:
        deduct_material(conversion.id, bom_item)
    
    # 7. Update WIP Stock (deduct)
    wip.quantity_pcs -= (fg_qty + reject_qty + rework_qty)
    
    # 8. Add to FG Inventory
    add_to_fg_inventory(conversion)
    
    return conversion
```

### C. Material Consumption (Packaging, Label, etc)
```python
def deduct_material(conversion_id, bom_item):
    """
    Deduct packaging materials based on BOM
    """
    conversion = FGConversion.query.get(conversion_id)
    
    # Calculate required quantity based on FG output
    qty_required = (conversion.fg_quantity_pcs / bom_item.output_quantity) * bom_item.material_quantity
    
    # FIFO deduction from inventory
    success, movements = fifo_deduct_material(
        material_id=bom_item.material_id,
        quantity=qty_required,
        reference_type='fg_conversion',
        reference_id=conversion_id
    )
    
    # Record material consumption
    material_record = FGConversionMaterial(
        conversion_id=conversion_id,
        material_id=bom_item.material_id,
        quantity_required=qty_required,
        quantity_used=qty_required,  # Actual usage (could be different)
        unit_cost=bom_item.unit_cost,
        total_cost=qty_required * bom_item.unit_cost
    )
    
    return material_record
```

## 3. API ENDPOINTS

### POST `/api/fg-conversion/create`
Create FG conversion (manual or auto-triggered)

### GET `/api/fg-conversion/list`
List all FG conversions with filters

### GET `/api/fg-conversion/<id>`
Get conversion details

### PUT `/api/fg-conversion/<id>/complete`
Complete conversion and finalize inventory movements

### GET `/api/fg-conversion/batch/<batch_number>`
Get all conversions for a specific batch

### GET `/api/fg-conversion/loss-report`
Report of all losses/rejects with reasons

## 4. DASHBOARD REQUIREMENTS

### A. WIP Stock Dashboard
- Current WIP inventory by product
- WIP aging (how long in WIP)
- WIP by batch number
- Pending QC items
- WIP value (costing)

### B. FG Stock Dashboard
- Current FG inventory by product
- FG by batch number
- FG aging & expiry tracking
- FIFO queue visualization
- FG value (costing)

### C. Conversion Tracking Dashboard
- Daily conversion rate (WIP → FG)
- Loss/Reject analysis
- Material consumption variance
- Conversion efficiency (FG output / WIP input)
- Cost per conversion

### D. Loss/Reject Analysis
- Top reject reasons
- Reject trend over time
- Cost impact of rejects
- Reject by product
- Reject by batch

## 5. INTEGRATION POINTS

### A. QC Module Integration
- QC inspection triggers FG conversion
- QC results determine FG/Reject/Rework quantities
- QC defects linked to loss details

### B. BOM Integration
- Get packaging materials from BOM
- Calculate material requirements
- Track material consumption variance

### C. Costing Integration
- Material cost (from BOM)
- Labor cost (from production)
- Overhead allocation
- Total FG cost calculation

### D. Inventory Integration
- WIP deduction
- FG addition
- Material consumption (FIFO)
- Inventory movements tracking

## 6. REPORTS NEEDED

1. **WIP to FG Conversion Report**
   - Period-based conversion summary
   - Conversion efficiency
   - Loss analysis

2. **Batch Traceability Report**
   - Track batch from ingredient → output → WIP → FG
   - Batch yield analysis
   - Batch quality metrics

3. **Material Consumption Report**
   - Packaging material usage
   - Variance analysis (actual vs BOM)
   - Material cost tracking

4. **Loss & Reject Report**
   - Reject by reason
   - Reject by product
   - Cost impact
   - Trend analysis

5. **FG Inventory Report**
   - Current stock by batch
   - Expiry tracking
   - FIFO queue status
   - Stock aging

## 7. VALIDATION RULES

1. **Batch Validation**: Output mesin ±10% dari ingredient
2. **Quantity Validation**: WIP input = FG output + Reject + Rework + Loss
3. **Material Validation**: Sufficient material in inventory for conversion
4. **QC Validation**: QC must be completed before FG conversion
5. **Expiry Validation**: Expired date must be > production date
6. **FIFO Validation**: Oldest batch must be used first for shipment

## 8. NEXT STEPS

1. ✅ Design database schema
2. ⏳ Create migration scripts
3. ⏳ Create models (FGConversion, FGConversionItem, etc)
4. ⏳ Create API endpoints
5. ⏳ Create frontend UI for FG conversion
6. ⏳ Create dashboards
7. ⏳ Create reports
8. ⏳ Integration testing
9. ⏳ User acceptance testing

---

**Apakah design ini sudah sesuai dengan requirement Anda?**
**Ada yang perlu ditambahkan atau diubah?**
