# DOKUMENTASI BACKEND MODELS

## Daftar Isi
1. [User & Authentication](#user--authentication)
2. [Product & Material](#product--material)
3. [Production](#production)
4. [Warehouse & Inventory](#warehouse--inventory)
5. [Sales & Purchasing](#sales--purchasing)
6. [Finance](#finance)
7. [HR](#hr)
8. [Quality](#quality)
9. [Maintenance](#maintenance)
10. [Analytics & Reports](#analytics--reports)

---

## User & Authentication

### Models di `models/user.py`:
- **User** - User account dengan role-based access
- **Role** - Role untuk RBAC
- **Permission** - Granular permissions
- **UserRole** - Junction table User-Role
- **RolePermission** - Junction table Role-Permission

---

## Product & Material

### Models di `models/product.py`:
- **Material** - Raw materials, packaging, chemicals
- **Product** - Finished goods / products
- **ProductCategory** - Hierarchical product categories
- **ProductSpecification** - Technical specs (GSM, width, etc)
- **ProductPackaging** - Packaging info (sheets/pack, packs/carton)

---

## Production

### Models di `models/production.py`:

#### Machine
```python
class Machine(db.Model):
    """Mesin produksi (Nonwoven, Cutting, Packing)"""
```
**Fields**:
- code, name, machine_type
- status: idle, running, maintenance, breakdown, offline
- capacity_per_hour, default_speed
- efficiency, availability, target_efficiency

#### BillOfMaterials (BOM)
```python
class BillOfMaterials(db.Model):
    """Bill of Materials untuk produk"""
```
**Fields**:
- bom_number, product_id, version
- batch_size, batch_uom, pack_per_carton
- is_active, effective_date, expiry_date

**Properties**:
- `total_cost` - Total cost semua BOM items
- `total_materials` - Jumlah materials dalam BOM
- `critical_materials` - Jumlah critical materials

#### BOMItem
```python
class BOMItem(db.Model):
    """Item dalam BOM (material atau product)"""
```
**Fields**:
- bom_id, line_number
- product_id, material_id (salah satu)
- quantity, uom, scrap_percent
- unit_cost, percentage, is_critical

**Properties**:
- `item_name`, `item_code`, `item_type`
- `effective_quantity` - Quantity + scrap
- `total_cost` - Cost untuk item ini
- `current_stock` - Stock saat ini dari warehouse
- `shortage_quantity` - Kekurangan stock
- `is_shortage` - Boolean shortage check

#### WorkOrder
```python
class WorkOrder(db.Model):
    """Work Order untuk produksi"""
```
**Fields**:
- wo_number, product_id, bom_id
- quantity, uom, pack_per_carton
- status: planned, released, in_progress, completed, cancelled
- priority: low, normal, high, urgent
- source_type: manual, from_bom, from_schedule
- machine_id, batch_number
- scheduled_start_date, scheduled_end_date
- actual_start_date, actual_end_date
- quantity_produced, quantity_good, quantity_scrap

#### ShiftProduction
```python
class ShiftProduction(db.Model):
    """Produksi per shift (shift 1, 2, 3)"""
```
**Fields**:
- production_date, shift (shift_1, shift_2, shift_3)
- sub_shift (a, b, c - untuk multi-product)
- machine_id, product_id, work_order_id
- batch_number
- target_quantity, actual_quantity, good_quantity
- reject_quantity, rework_quantity
- setting_sticker, setting_packaging
- planned_runtime, actual_runtime, downtime_minutes

**Downtime by Category** (minutes):
- downtime_mesin (max 15%)
- downtime_operator (max 7%)
- downtime_material (0%)
- downtime_design (max 8%)
- downtime_others (max 10%)
- idle_time, waktu_tidak_tercatat

**Efficiency Loss** (percentage):
- loss_mesin, loss_operator, loss_material
- loss_design, loss_others

**OEE Metrics**:
- quality_rate (%)
- efficiency_rate (%)
- base_efficiency (%)
- oee_score (%)

**Early Stop**:
- early_stop (Boolean)
- early_stop_time, early_stop_reason
- early_stop_notes

**Operator Reassignment**:
- operator_reassigned (Boolean)
- reassignment_task, reassignment_notes

#### DowntimeRecord
```python
class DowntimeRecord(db.Model):
    """Record downtime mesin dengan kategori"""
```
**Fields**:
- shift_production_id, machine_id
- downtime_date, start_time, end_time
- duration_minutes
- downtime_type: planned, unplanned
- downtime_category: breakdown, maintenance, setup, material_shortage, quality_issue, operator_break
- downtime_reason, root_cause
- production_loss, cost_impact
- action_taken, prevention_action
- status: open, investigating, resolved, closed
- priority: low, medium, high, critical

#### ProductionPlan (MPS)
```python
class ProductionPlan(db.Model):
    """Master Production Schedule"""
```
**Fields**:
- plan_number, plan_name
- plan_type: daily, weekly, monthly
- period_start, period_end
- based_on: forecast, sales_order, both, manual
- product_id, planned_quantity
- machine_id, estimated_duration_hours
- status: draft, approved, released, completed, cancelled
- priority: low, normal, high, urgent

#### ProductionRecord
```python
class ProductionRecord(db.Model):
    """Record produksi detail"""
```
**Fields**:
- work_order_id, product_id, machine_id
- operator_id, production_date, shift
- quantity_produced, quantity_good, quantity_scrap
- quantity_rework, setting_sticker, setting_packaging
- downtime_minutes, notes

---

## Warehouse & Inventory

### Models di `models/warehouse.py`:

#### Warehouse
```python
class Warehouse(db.Model):
    """Gudang penyimpanan"""
```
**Fields**:
- code, name, warehouse_type
- location, capacity, current_utilization
- manager_id, is_active

#### Inventory
```python
class Inventory(db.Model):
    """Stock inventory per warehouse"""
```
**Fields**:
- warehouse_id, product_id, material_id
- quantity_on_hand, quantity_reserved
- quantity_available, min_stock_level
- last_restock_date, bin_location

**Properties**:
- `is_low_stock` - Check if below min level
- `stock_value` - Total value of stock

#### InventoryTransaction
```python
class InventoryTransaction(db.Model):
    """Transaksi inventory (in/out)"""
```
**Fields**:
- transaction_type: receipt, issue, adjustment, transfer, return
- inventory_id, quantity, uom
- reference_type, reference_id
- performed_by, notes

#### StockAdjustment
```python
class StockAdjustment(db.Model):
    """Adjustment stock (stock opname)"""
```
**Fields**:
- adjustment_number, adjustment_type
- warehouse_id, product_id, material_id
- current_quantity, adjusted_quantity
- variance_quantity, reason
- status: draft, pending_approval, approved, rejected

---

## Sales & Purchasing

### Models di `models/sales.py`:

#### Customer
```python
class Customer(db.Model):
    """Pelanggan"""
```
**Fields**:
- customer_code, customer_name
- contact_person, phone, email
- address, city, postal_code
- payment_terms, credit_limit
- customer_type, tax_id

#### SalesOrder
```python
class SalesOrder(db.Model):
    """Sales Order dari customer"""
```
**Fields**:
- so_number, customer_id, order_date
- required_date, delivery_date
- status: draft, confirmed, in_production, ready_to_ship, shipped, delivered, cancelled
- total_amount, tax_amount, discount_amount
- payment_status, payment_method

#### SalesOrderItem
```python
class SalesOrderItem(db.Model):
    """Item dalam Sales Order"""
```
**Fields**:
- sales_order_id, product_id
- quantity, uom, unit_price
- discount_percent, tax_percent
- total_price

### Models di `models/purchasing.py`:

#### Supplier
```python
class Supplier(db.Model):
    """Supplier bahan baku"""
```
**Fields**:
- supplier_code, supplier_name
- contact_person, phone, email
- address, payment_terms
- supplier_type, rating

#### PurchaseOrder
```python
class PurchaseOrder(db.Model):
    """Purchase Order ke supplier"""
```
**Fields**:
- po_number, supplier_id, order_date
- required_date, expected_delivery_date
- status: draft, sent, confirmed, partially_received, received, cancelled
- total_amount, tax_amount, discount_amount
- payment_status, payment_terms

#### PurchaseOrderItem
```python
class PurchaseOrderItem(db.Model):
    """Item dalam Purchase Order"""
```
**Fields**:
- purchase_order_id, product_id, material_id
- quantity, uom, unit_price
- quantity_received, tax_percent
- total_price

---

## Finance

### Models di `models/finance.py`:

#### Account
```python
class Account(db.Model):
    """Chart of Accounts"""
```
**Fields**:
- account_code, account_name
- account_type: asset, liability, equity, revenue, expense
- account_category, parent_account_id
- is_active, balance

#### JournalEntry
```python
class JournalEntry(db.Model):
    """Journal entry untuk transaksi"""
```
**Fields**:
- entry_number, entry_date
- entry_type: sales, purchase, production, adjustment
- description, reference_type, reference_id
- status: draft, posted, void
- total_debit, total_credit

#### JournalEntryLine
```python
class JournalEntryLine(db.Model):
    """Line item dalam journal entry"""
```
**Fields**:
- journal_entry_id, account_id
- line_type: debit, credit
- amount, description

#### Invoice
```python
class Invoice(db.Model):
    """Invoice (AR/AP)"""
```
**Fields**:
- invoice_number, invoice_date, due_date
- invoice_type: sales_invoice, purchase_invoice
- customer_id, supplier_id
- total_amount, tax_amount, paid_amount
- status: draft, sent, partially_paid, paid, overdue, cancelled

---

## HR

### Models di `models/hr.py`:

#### Department
```python
class Department(db.Model):
    """Departemen perusahaan"""
```
**Fields**:
- dept_code, dept_name
- parent_dept_id, manager_id
- is_active

#### Employee
```python
class Employee(db.Model):
    """Karyawan"""
```
**Fields**:
- employee_code, full_name
- email, phone, address
- department_id, position, job_title
- hire_date, termination_date
- employment_status: permanent, contract, probation, terminated
- user_id (link ke User untuk login)

#### Attendance
```python
class Attendance(db.Model):
    """Presensi karyawan"""
```
**Fields**:
- employee_id, attendance_date
- check_in_time, check_out_time
- attendance_type: present, absent, leave, sick, holiday
- work_hours, overtime_hours
- notes

#### EmployeeRoster
```python
class EmployeeRoster(db.Model):
    """Roster kerja karyawan per shift"""
```
**Fields**:
- employee_id, shift_date, shift_time
- machine_id, role (operator, supervisor, qc)
- status: scheduled, confirmed, completed, cancelled

---

## Quality

### Models di `models/quality.py`:

#### QualityInspection
```python
class QualityInspection(db.Model):
    """Inspeksi kualitas"""
```
**Fields**:
- inspection_number, inspection_date
- inspection_type: incoming, in_process, final, audit
- product_id, material_id, work_order_id
- batch_number, quantity_inspected
- quantity_passed, quantity_failed
- status: pending, in_progress, completed, approved

#### QualityDefect
```python
class QualityDefect(db.Model):
    """Defect yang ditemukan"""
```
**Fields**:
- inspection_id, defect_type
- defect_category: minor, major, critical
- quantity_affected, defect_description
- root_cause, corrective_action

---

## Maintenance

### Models di `models/maintenance.py`:

#### MaintenanceSchedule
```python
class MaintenanceSchedule(db.Model):
    """Jadwal maintenance mesin"""
```
**Fields**:
- schedule_number, machine_id
- maintenance_type: preventive, predictive, corrective
- frequency: daily, weekly, monthly, yearly
- next_maintenance_date, last_maintenance_date

#### MaintenanceRecord
```python
class MaintenanceRecord(db.Model):
    """Record maintenance yang dilakukan"""
```
**Fields**:
- record_number, machine_id
- maintenance_date, maintenance_type
- technician_id, duration_hours
- cost, parts_replaced
- status: scheduled, in_progress, completed
- notes

---

## Analytics & Reports

### Models di `models/oee.py`:

#### OEERecord
```python
class OEERecord(db.Model):
    """OEE (Overall Equipment Effectiveness) record"""
```
**Fields**:
- machine_id, record_date, shift
- availability_rate, performance_rate, quality_rate
- oee_score
- planned_production_time, actual_runtime
- downtime_minutes, ideal_cycle_time
- total_units, good_units, defect_units

### Models di `models/analytics.py`:

#### ProductionAnalytics
```python
class ProductionAnalytics(db.Model):
    """Analytics agregat produksi"""
```
**Fields**:
- analysis_date, analysis_type
- total_production, total_good, total_scrap
- average_oee, average_efficiency
- total_downtime_minutes, cost_per_unit

---

## Relationships Overview

### Key Relationships:

1. **User → Role → Permission** (RBAC)
2. **Product → BOM → BOMItem → Material**
3. **SalesOrder → WorkOrder → ShiftProduction**
4. **WorkOrder → Machine → DowntimeRecord**
5. **Product → Inventory → Warehouse**
6. **Customer → SalesOrder → SalesOrderItem**
7. **Supplier → PurchaseOrder → PurchaseOrderItem**
8. **Employee → Attendance / Roster**
9. **Machine → MaintenanceRecord**
10. **ShiftProduction → QualityInspection**

---

## Cascade Delete Rules

Models dengan `cascade='all, delete-orphan'`:
- User → UserRole, Notification
- Role → RolePermission
- BOM → BOMItem
- WorkOrder → ProductionRecord, StatusHistory
- ShiftProduction → DowntimeRecord
- Product → Specification, Packaging, BOM
- SalesOrder → SalesOrderItem
- PurchaseOrder → PurchaseOrderItem

---

## Indexes

Primary indexes:
- Unique constraints: code, number fields
- Foreign keys: automatic indexes
- Date fields: production_date, order_date
- Status fields: for filtering

---

