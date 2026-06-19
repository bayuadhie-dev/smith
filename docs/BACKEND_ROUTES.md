# DOKUMENTASI BACKEND ROUTES (API Endpoints)

## Daftar Isi
1. [Authentication](#authentication)
2. [Products](#products)
3. [Production](#production)
4. [Warehouse](#warehouse)
5. [Sales](#sales)
6. [Purchasing](#purchasing)
7. [Finance](#finance)
8. [HR](#hr)
9. [Quality](#quality)
10. [Maintenance](#maintenance)
11. [Reports & Analytics](#reports--analytics)
12. [Settings](#settings)

---

## Authentication

### Blueprint: `auth_bp` (`routes/auth.py`)
**Base URL**: `/api/auth`

#### Endpoints:

##### POST `/register`
- **Deskripsi**: Register user baru
- **Body**: 
  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string",
    "full_name": "string",
    "department": "string",
    "position": "string"
  }
  ```
- **Response**: User object + JWT tokens
- **Auth**: Public

##### POST `/login`
- **Deskripsi**: Login user
- **Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**: 
  ```json
  {
    "access_token": "string",
    "refresh_token": "string",
    "user": { ... }
  }
  ```
- **Auth**: Public

##### POST `/refresh`
- **Deskripsi**: Refresh access token
- **Headers**: `Authorization: Bearer <refresh_token>`
- **Response**: New access_token
- **Auth**: Refresh Token

##### GET `/me`
- **Deskripsi**: Get current user info
- **Response**: User object dengan roles dan permissions
- **Auth**: JWT Required

##### POST `/forgot-password`
- **Deskripsi**: Request reset password (kirim email)
- **Body**: `{ "email": "string" }`
- **Response**: Success message
- **Auth**: Public

##### POST `/reset-password`
- **Deskripsi**: Reset password dengan token
- **Body**:
  ```json
  {
    "token": "string",
    "new_password": "string"
  }
  ```
- **Auth**: Public (with valid token)

##### POST `/change-password`
- **Deskripsi**: Change password (logged in user)
- **Body**:
  ```json
  {
    "old_password": "string",
    "new_password": "string"
  }
  ```
- **Auth**: JWT Required

---

## Products

### Blueprint: `products_bp` (`routes/products.py`)
**Base URL**: `/api/products`

#### Endpoints:

##### GET `/`
- **Deskripsi**: List all products dengan pagination
- **Query Params**:
  - `page` (int, default: 1)
  - `per_page` (int, default: 50)
  - `search` (string) - Search by code or name
  - `category_id` (int) - Filter by category
  - `is_active` (boolean) - Filter aktif/non-aktif
- **Response**: 
  ```json
  {
    "products": [...],
    "total": 100,
    "page": 1,
    "per_page": 50,
    "total_pages": 2
  }
  ```
- **Auth**: JWT Required

##### GET `/:id`
- **Deskripsi**: Get product detail by ID
- **Response**: Product object dengan specification, packaging, BOM
- **Auth**: JWT Required

##### POST `/`
- **Deskripsi**: Create new product
- **Body**: Product object
- **Response**: Created product
- **Auth**: JWT Required + Permission `products:create`

##### PUT `/:id`
- **Deskripsi**: Update product
- **Body**: Product fields to update
- **Response**: Updated product
- **Auth**: JWT Required + Permission `products:update`

##### DELETE `/:id`
- **Deskripsi**: Delete product (soft delete - set is_active=false)
- **Response**: Success message
- **Auth**: JWT Required + Permission `products:delete`

##### GET `/categories`
- **Deskripsi**: List all product categories
- **Response**: Array of categories (hierarchical)
- **Auth**: JWT Required

##### POST `/import-excel`
- **Deskripsi**: Import products dari Excel file
- **Body**: FormData dengan file
- **Response**: Import summary (success/error count)
- **Auth**: JWT Required + Permission `products:create`

##### GET `/export-excel`
- **Deskripsi**: Export products ke Excel
- **Query Params**: Filter params (category, search, dll)
- **Response**: Excel file download
- **Auth**: JWT Required

---

### Blueprint: `products_new_bp` (`routes/products_new.py`)
**Base URL**: `/api/products-new`

Enhanced product management dengan fields extended:

##### GET `/`
- List products dengan all extended fields (gramasi, cd, md, dll)

##### POST `/`
- Create product dengan extended specs

##### PUT `/:id`
- Update dengan field validation

##### POST `/calculate-requirements`
- **Deskripsi**: Calculate material requirements berdasarkan BOM
- **Body**:
  ```json
  {
    "product_id": 1,
    "quantity": 1000,
    "uom": "karton"
  }
  ```
- **Response**:
  ```json
  {
    "requirements": [
      {
        "material_name": "Rayon",
        "quantity": 150.5,
        "uom": "kg"
      }
    ]
  }
  ```

---

## Production

### Blueprint: `production_bp` (`routes/production.py`)
**Base URL**: `/api/production`

#### Work Orders

##### GET `/work-orders`
- **Deskripsi**: List work orders
- **Query Params**:
  - `status` - Filter by status
  - `machine_id` - Filter by machine
  - `date_from`, `date_to` - Date range
- **Response**: Array of work orders
- **Auth**: JWT Required

##### GET `/work-orders/:id`
- **Deskripsi**: Get work order detail
- **Response**: WO dengan production records, materials, status history
- **Auth**: JWT Required

##### POST `/work-orders`
- **Deskripsi**: Create work order
- **Body**:
  ```json
  {
    "product_id": 1,
    "quantity": 1000,
    "uom": "karton",
    "machine_id": 1,
    "required_date": "2026-06-20",
    "priority": "normal"
  }
  ```
- **Response**: Created work order
- **Auth**: JWT Required + Permission `production:create_wo`

##### PUT `/work-orders/:id`
- **Deskripsi**: Update work order
- **Body**: Fields to update
- **Auth**: JWT Required + Permission `production:update_wo`

##### POST `/work-orders/:id/release`
- **Deskripsi**: Release WO untuk produksi (status: planned → released)
- **Response**: Updated WO
- **Auth**: JWT Required + Permission `production:release_wo`

##### POST `/work-orders/:id/start`
- **Deskripsi**: Start production (status: released → in_progress)
- **Response**: Updated WO dengan actual_start_date
- **Auth**: JWT Required

##### POST `/work-orders/:id/complete`
- **Deskripsi**: Complete WO (status: in_progress → completed)
- **Body**:
  ```json
  {
    "quantity_produced": 950,
    "quantity_good": 920,
    "quantity_scrap": 30
  }
  ```
- **Response**: Updated WO
- **Auth**: JWT Required + Permission `production:complete_wo`

##### POST `/work-orders/:id/cancel`
- **Deskripsi**: Cancel WO
- **Body**: `{ "reason": "string" }`
- **Auth**: JWT Required + Permission `production:cancel_wo`

#### Shift Production

##### GET `/shift-production`
- **Deskripsi**: List shift productions
- **Query Params**:
  - `date_from`, `date_to` - Date range
  - `machine_id` - Filter by machine
  - `shift` - Filter by shift (shift_1, shift_2, shift_3)
  - `product_id` - Filter by product
- **Response**: Array of shift productions dengan OEE metrics
- **Auth**: JWT Required

##### GET `/shift-production/:id`
- **Deskripsi**: Get shift production detail
- **Response**: Shift production dengan downtime records
- **Auth**: JWT Required

##### POST `/shift-production`
- **Deskripsi**: Create shift production record
- **Body**:
  ```json
  {
    "production_date": "2026-06-17",
    "shift": "shift_1",
    "sub_shift": "a",
    "machine_id": 1,
    "product_id": 10,
    "work_order_id": 5,
    "target_quantity": 1000,
    "actual_quantity": 950,
    "good_quantity": 920,
    "reject_quantity": 30,
    "planned_runtime": 480,
    "actual_runtime": 450,
    "downtime_mesin": 20,
    "downtime_operator": 10
  }
  ```
- **Response**: Created shift production dengan calculated OEE
- **Auth**: JWT Required + Permission `production:input_shift`

##### PUT `/shift-production/:id`
- **Deskripsi**: Update shift production
- **Body**: Fields to update
- **Note**: OEE akan recalculated
- **Auth**: JWT Required + Permission `production:update_shift`

#### Downtime

##### GET `/downtime`
- **Deskripsi**: List downtime records
- **Query Params**:
  - `date_from`, `date_to`
  - `machine_id`
  - `category` - Filter by downtime_category
  - `status` - Filter by status
- **Response**: Array of downtime records
- **Auth**: JWT Required

##### POST `/downtime`
- **Deskripsi**: Record downtime
- **Body**:
  ```json
  {
    "shift_production_id": 1,
    "machine_id": 1,
    "downtime_date": "2026-06-17",
    "start_time": "2026-06-17T10:30:00",
    "end_time": "2026-06-17T11:00:00",
    "downtime_type": "unplanned",
    "downtime_category": "breakdown",
    "downtime_reason": "Motor rusak",
    "root_cause": "Bearing aus"
  }
  ```
- **Response**: Created downtime record
- **Auth**: JWT Required

##### PUT `/downtime/:id/resolve`
- **Deskripsi**: Resolve downtime
- **Body**:
  ```json
  {
    "action_taken": "Ganti bearing baru",
    "prevention_action": "Scheduled maintenance setiap 6 bulan"
  }
  ```
- **Auth**: JWT Required

#### BOM (Bill of Materials)

##### GET `/bom`
- **Deskripsi**: List all BOMs
- **Query Params**:
  - `product_id` - Filter by product
  - `is_active` - Only active BOMs
- **Response**: Array of BOMs
- **Auth**: JWT Required

##### GET `/bom/:id`
- **Deskripsi**: Get BOM detail dengan items
- **Response**: BOM dengan array of BOMItems
- **Auth**: JWT Required

##### POST `/bom`
- **Deskripsi**: Create new BOM
- **Body**:
  ```json
  {
    "product_id": 1,
    "version": "1.0",
    "batch_size": 1,
    "batch_uom": "karton",
    "pack_per_carton": 24,
    "items": [
      {
        "line_number": 1,
        "material_id": 5,
        "quantity": 2.5,
        "uom": "kg",
        "scrap_percent": 5,
        "is_critical": true
      }
    ]
  }
  ```
- **Response**: Created BOM dengan calculated costs
- **Auth**: JWT Required + Permission `production:create_bom`

##### PUT `/bom/:id`
- **Deskripsi**: Update BOM (creates new version if is_active)
- **Body**: BOM fields + items
- **Auth**: JWT Required + Permission `production:update_bom`

##### POST `/bom/:id/activate`
- **Deskripsi**: Activate BOM (deactivate others for same product)
- **Auth**: JWT Required + Permission `production:approve_bom`

---

### Blueprint: `production_input_bp` (`routes/production_input.py`)
**Base URL**: `/api/production-input`

Simplified production input untuk operator:

##### GET `/daily/:date`
- **Deskripsi**: Get production input untuk tanggal tertentu
- **Response**: All shift productions untuk date
- **Auth**: JWT Required

##### POST `/quick-input`
- **Deskripsi**: Quick input produksi (simplified)
- **Body**:
  ```json
  {
    "machine_id": 1,
    "product_id": 10,
    "shift": "shift_1",
    "good_quantity": 920,
    "reject_quantity": 30,
    "downtime_minutes": 30
  }
  ```
- **Response**: Created shift production
- **Auth**: JWT Required

---

### Blueprint: `production_planning_bp` (`routes/production_planning.py`)
**Base URL**: `/api/production-planning`

Master Production Schedule (MPS):

##### GET `/plans`
- **Deskripsi**: List production plans
- **Query Params**:
  - `plan_type` - daily, weekly, monthly
  - `status` - Filter by status
  - `period_start`, `period_end` - Date range
- **Response**: Array of production plans
- **Auth**: JWT Required

##### POST `/plans`
- **Deskripsi**: Create production plan (MPS)
- **Body**:
  ```json
  {
    "plan_name": "Week 25 - 2026",
    "plan_type": "weekly",
    "period_start": "2026-06-17",
    "period_end": "2026-06-23",
    "product_id": 10,
    "planned_quantity": 5000,
    "uom": "karton",
    "machine_id": 1
  }
  ```
- **Response**: Created plan
- **Auth**: JWT Required + Permission `production:create_plan`

##### POST `/plans/:id/generate-wo`
- **Deskripsi**: Generate work orders dari production plan
- **Response**: Array of created work orders
- **Auth**: JWT Required + Permission `production:create_wo`

---

### Blueprint: `weekly_production_plan_bp` (`routes/weekly_production_plan.py`)
**Base URL**: `/api/production/weekly-plan`

Weekly production planning specific:

##### GET `/`
- **Deskripsi**: List weekly plans
- **Query Params**:
  - `week_number` - ISO week number
  - `year` - Year
  - `month` - Month (1-12)
- **Response**: Weekly plans dengan items
- **Auth**: JWT Required

##### GET `/:id/details`
- **Deskripsi**: Get weekly plan detail dengan breakdown per day
- **Response**: Plan dengan daily targets
- **Auth**: JWT Required

##### POST `/`
- **Deskripsi**: Create weekly plan
- **Body**:
  ```json
  {
    "week_number": 25,
    "year": 2026,
    "start_date": "2026-06-17",
    "end_date": "2026-06-23",
    "items": [
      {
        "product_id": 10,
        "target_quantity": 5000,
        "machine_id": 1
      }
    ]
  }
  ```
- **Response**: Created weekly plan
- **Auth**: JWT Required

---

### Blueprint: `schedule_grid_bp` (`routes/schedule_grid.py`)
**Base URL**: `/api/production/schedule-grid`

Visual scheduling (Gantt-like):

##### GET `/`
- **Deskripsi**: Get schedule grid untuk periode tertentu
- **Query Params**:
  - `date_from`, `date_to` - Date range
  - `machine_id` - Optional filter
- **Response**:
  ```json
  {
    "machines": [...],
    "schedules": [
      {
        "machine_id": 1,
        "schedules": [
          {
            "start": "2026-06-17T08:00:00",
            "end": "2026-06-17T16:00:00",
            "work_order_id": 5,
            "product_name": "Wetkins Pink"
          }
        ]
      }
    ]
  }
  ```
- **Auth**: JWT Required

##### POST `/schedule`
- **Deskripsi**: Add schedule ke grid (drag & drop)
- **Body**:
  ```json
  {
    "work_order_id": 5,
    "machine_id": 1,
    "scheduled_start": "2026-06-17T08:00:00",
    "scheduled_end": "2026-06-17T16:00:00",
    "shift": "shift_1"
  }
  ```
- **Response**: Created schedule
- **Auth**: JWT Required + Permission `production:schedule`

---

## Warehouse

### Blueprint: `warehouse_bp` (`routes/warehouse.py`)
**Base URL**: `/api/warehouse`

#### Inventory

##### GET `/inventory`
- **Deskripsi**: List inventory dengan stock levels
- **Query Params**:
  - `warehouse_id` - Filter by warehouse
  - `product_id` - Filter by product
  - `material_id` - Filter by material
  - `low_stock` (boolean) - Only low stock items
- **Response**: Array of inventory items
- **Auth**: JWT Required

##### GET `/inventory/:id`
- **Deskripsi**: Get inventory detail dengan transaction history
- **Response**: Inventory object dengan transactions
- **Auth**: JWT Required

##### POST `/inventory/adjust`
- **Deskripsi**: Adjust inventory (stock opname)
- **Body**:
  ```json
  {
    "inventory_id": 1,
    "adjusted_quantity": 100,
    "reason": "Physical count correction",
    "notes": "..."
  }
  ```
- **Response**: Stock adjustment record
- **Auth**: JWT Required + Permission `warehouse:adjust_stock`

#### Transactions

##### GET `/transactions`
- **Deskripsi**: List inventory transactions
- **Query Params**:
  - `transaction_type` - receipt, issue, adjustment, transfer, return
  - `date_from`, `date_to`
  - `warehouse_id`
- **Response**: Array of transactions
- **Auth**: JWT Required

##### POST `/transactions/receipt`
- **Deskripsi**: Receipt material/product (from PO)
- **Body**:
  ```json
  {
    "purchase_order_id": 10,
    "warehouse_id": 1,
    "items": [
      {
        "material_id": 5,
        "quantity": 100,
        "uom": "kg"
      }
    ]
  }
  ```
- **Response**: Receipt transaction
- **Auth**: JWT Required + Permission `warehouse:receive`

##### POST `/transactions/issue`
- **Deskripsi**: Issue material untuk produksi (from WO)
- **Body**:
  ```json
  {
    "work_order_id": 5,
    "warehouse_id": 1,
    "items": [
      {
        "material_id": 5,
        "quantity": 50,
        "uom": "kg"
      }
    ]
  }
  ```
- **Response**: Issue transaction
- **Auth**: JWT Required + Permission `warehouse:issue`

##### POST `/transactions/transfer`
- **Deskripsi**: Transfer stock antar warehouse
- **Body**:
  ```json
  {
    "from_warehouse_id": 1,
    "to_warehouse_id": 2,
    "items": [
      {
        "product_id": 10,
        "quantity": 100
      }
    ]
  }
  ```
- **Response**: Transfer transaction
- **Auth**: JWT Required + Permission `warehouse:transfer`

---

### Blueprint: `stock_opname_bp` (`routes/stock_opname.py`)
**Base URL**: `/api/stock-opname`

Stock opname (physical inventory count):

##### GET `/`
- **Deskripsi**: List stock opname sessions
- **Query Params**:
  - `status` - draft, in_progress, completed, approved
  - `warehouse_id`
- **Response**: Array of stock opname sessions
- **Auth**: JWT Required

##### POST `/start`
- **Deskripsi**: Start new stock opname session
- **Body**:
  ```json
  {
    "warehouse_id": 1,
    "opname_date": "2026-06-17",
    "opname_type": "full" atau "partial",
    "notes": "..."
  }
  ```
- **Response**: Created stock opname session
- **Auth**: JWT Required + Permission `warehouse:start_opname`

##### PUT `/:id/record-count`
- **Deskripsi**: Record physical count
- **Body**:
  ```json
  {
    "items": [
      {
        "inventory_id": 1,
        "physical_count": 95,
        "notes": "..."
      }
    ]
  }
  ```
- **Response**: Updated opname
- **Auth**: JWT Required

##### POST `/:id/complete`
- **Deskripsi**: Complete stock opname (create adjustments)
- **Response**: Opname summary dengan variance analysis
- **Auth**: JWT Required + Permission `warehouse:complete_opname`

---

## Sales

### Blueprint: `sales_bp` (`routes/sales.py`)
**Base URL**: `/api/sales`

##### GET `/customers`
- List customers
- Query: `search`, `customer_type`

##### POST `/customers`
- Create customer

##### GET `/orders`
- List sales orders
- Query: `status`, `customer_id`, `date_from`, `date_to`

##### GET `/orders/:id`
- Get sales order detail

##### POST `/orders`
- Create sales order
- **Body**:
  ```json
  {
    "customer_id": 1,
    "order_date": "2026-06-17",
    "required_date": "2026-06-30",
    "items": [
      {
        "product_id": 10,
        "quantity": 1000,
        "unit_price": 50000
      }
    ]
  }
  ```

##### POST `/orders/:id/confirm`
- Confirm sales order (status: draft → confirmed)

##### POST `/orders/:id/generate-wo`
- Generate work orders dari sales order

---

## Purchasing

### Blueprint: `purchasing_bp` (`routes/purchasing.py`)
**Base URL**: `/api/purchasing`

##### GET `/suppliers`
- List suppliers

##### POST `/suppliers`
- Create supplier

##### GET `/purchase-orders`
- List purchase orders
- Query: `status`, `supplier_id`, `date_from`, `date_to`

##### POST `/purchase-orders`
- Create purchase order

##### POST `/purchase-orders/:id/send`
- Send PO to supplier (email/print)

##### POST `/purchase-orders/:id/receive`
- Receive PO (create warehouse receipt)

---

## Finance

### Blueprint: `finance_bp` (`routes/finance.py`)
**Base URL**: `/api/finance`

##### GET `/accounts`
- Get chart of accounts

##### POST `/journal-entries`
- Create journal entry

##### GET `/invoices`
- List invoices (AR/AP)

##### POST `/invoices/:id/record-payment`
- Record payment untuk invoice

---

## HR

### Blueprint: `hr_bp` (`routes/hr.py`)
**Base URL**: `/api/hr`

##### GET `/employees`
- List employees

##### POST `/employees`
- Create employee

##### GET `/attendance`
- List attendance records

##### POST `/attendance/check-in`
- Check-in attendance

##### POST `/attendance/check-out`
- Check-out attendance

---

## Quality

### Blueprint: `quality_bp` (`routes/quality.py`)
**Base URL**: `/api/quality`

##### GET `/inspections`
- List quality inspections

##### POST `/inspections`
- Create inspection

##### POST `/inspections/:id/record-defects`
- Record defects found

---

## Maintenance

### Blueprint: `maintenance_bp` (`routes/maintenance.py`)
**Base URL**: `/api/maintenance`

##### GET `/schedules`
- List maintenance schedules

##### POST `/schedules`
- Create maintenance schedule

##### POST `/records`
- Record maintenance performed

---

## Reports & Analytics

### Blueprint: `reports_bp` (`routes/reports.py`)
**Base URL**: `/api/reports`

##### GET `/production-summary`
- Production summary report
- Query: `date_from`, `date_to`, `machine_id`, `product_id`

##### GET `/oee-report`
- OEE report per machine/shift

##### GET `/inventory-valuation`
- Inventory valuation report

##### GET `/sales-analysis`
- Sales analysis report

---

## Settings

### Blueprint: `settings_bp` (`routes/settings.py`)
**Base URL**: `/api/settings`

##### GET `/company-profile`
- Get company profile

##### PUT `/company-profile`
- Update company profile

##### GET `/backup/list`
- List database backups

##### POST `/backup/create`
- Create database backup

##### POST `/backup/restore/:filename`
- Restore dari backup

---

## WebSocket Events (Socket.IO)

### Namespace: `/` (default)

#### Events:

##### Client → Server:

###### `join_room`
```json
{ "room": "production_monitor" }
```

###### `leave_room`
```json
{ "room": "production_monitor" }
```

###### `send_message`
```json
{
  "room": "chat_room_1",
  "message": "Hello",
  "user_id": 1
}
```

##### Server → Client:

###### `production_update`
```json
{
  "shift_production_id": 1,
  "machine_id": 1,
  "current_quantity": 500,
  "oee_score": 75.5
}
```

###### `downtime_alert`
```json
{
  "machine_id": 1,
  "downtime_category": "breakdown",
  "start_time": "2026-06-17T10:30:00"
}
```

###### `new_message`
```json
{
  "room": "chat_room_1",
  "message": "...",
  "user": { ... },
  "timestamp": "..."
}
```

---

## Rate Limiting

- Default: 5000 requests per hour per IP
- Notifications endpoint: Exempt (untuk polling)
- Auth endpoints: 10 requests per minute

---

## Error Responses

Semua error response menggunakan format:
```json
{
  "error": "Error message",
  "details": { ... },  // Optional
  "code": "ERROR_CODE"  // Optional
}
```

HTTP Status Codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 422: Validation Error
- 500: Internal Server Error

---

