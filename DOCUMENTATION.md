# SMITH ERP System Documentation

**Version:** 1.0.0  
**Created:** April 21, 2026  
**Developer:** Mochammad Bayu Adhie Nugroho  
**Role:** Solo Developer  
**Development Period:** 6 months (October 2025 - March 2026)  
**Education:** SMA Graduate (2013) - Self-taught Software Developer

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Modules](#modules)
5. [API Documentation](#api-documentation)
6. [Database Schema](#database-schema)
7. [Installation & Setup](#installation--setup)
8. [Deployment](#deployment)
9. [Configuration](#configuration)
10. [Security](#security)
11. [Development Guide](#development-guide)
12. [Troubleshooting](#troubleshooting)
13. [Changelog](#changelog)

---

## System Overview

SMITH ERP is a comprehensive Enterprise Resource Planning system designed for manufacturing companies. It provides end-to-end management of production, inventory, finance, HR, quality control, and more.

### Key Features
- **18+ Integrated Modules:** Warehouse, Production, Shipping, Maintenance, Purchasing, Sales, Finance, HR, R&D, Quality, MRP, and more
- **Role-Based Access Control (RBAC):** 40+ roles with 200+ granular permissions
- **Real-time Monitoring:** Live production monitoring, OEE tracking, attendance with face recognition
- **Approval Workflows:** Multi-level approval system for critical operations
- **Audit Trail:** Complete activity logging for compliance and accountability
- **ISO 9001:2015 Compliant:** Document Control Center module implements quality standards

### Business Context
- Designed for manufacturing companies with complex production workflows
- Supports multi-stage production with Work-in-Progress (WIP) tracking
- FIFO-based inventory management
- Integrated financial accounting with automatic GL posting
- Material Requirement Planning (MRP) for optimized procurement

---

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                       │
│                  React 18 + TypeScript + Redux              │
│                    Socket.IO Client (Real-time)              │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTP/WebSocket
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                      Backend Layer                          │
│                   Flask 3.0 + SQLAlchemy 2.0                 │
│              Flask-JWT-Extended (Authentication)              │
│                  Flask-CORS (Cross-Origin)                   │
│                  Socket.IO Server (Real-time)                 │
│                  Flask-Limiter (Rate Limiting)               │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                      Data Layer                              │
│              SQLite (Development) / PostgreSQL (Production)   │
│                  Alembic (Database Migrations)              │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                   External Services                         │
│              Sentry (Error Monitoring)                       │
│              Gmail/Resend (Email Service)                    │
│              Google OAuth (Authentication)                   │
└─────────────────────────────────────────────────────────────┘
```

### Backend Structure

```
backend/
├── app.py                 # Flask application entry point
├── config.py              # Configuration management
├── requirements.txt       # Python dependencies
├── models/                # Database models (49 files)
│   ├── __init__.py
│   ├── warehouse.py       # Inventory models
│   ├── production.py      # Production models
│   ├── finance.py         # Accounting models
│   ├── hr.py              # HR & Payroll models
│   └── ...
├── routes/                # API routes (70+ files)
│   ├── __init__.py
│   ├── warehouse.py       # Warehouse endpoints
│   ├── production.py      # Production endpoints
│   ├── finance.py         # Finance endpoints
│   └── ...
├── utils/                 # Utility functions
│   ├── i18n.py           # Internationalization
│   ├── business_rules.py # Business logic
│   ├── fifo_deduct.py    # FIFO inventory deduction
│   └── ...
├── migrations/            # Database migrations (Alembic)
├── tests/                 # Test files
└── venv/                  # Python virtual environment
```

### Frontend Structure

```
frontend/
├── src/
│   ├── components/        # Reusable components
│   ├── pages/            # Page components
│   ├── store/            # Redux store
│   ├── utils/            # Utility functions
│   ├── services/          # API services
│   └── App.tsx           # Main application
├── package.json          # Node dependencies
├── vite.config.ts        # Vite configuration
└── tsconfig.json         # TypeScript configuration
```

---

## Tech Stack

### Backend
- **Language:** Python 3.12+
- **Framework:** Flask 3.0.0
- **ORM:** SQLAlchemy 2.0.23
- **Authentication:** Flask-JWT-Extended
- **CORS:** Flask-CORS
- **Migrations:** Flask-Migrate (Alembic)
- **Password Hashing:** Bcrypt
- **Testing:** Pytest
- **Error Monitoring:** Sentry SDK 1.40.6
- **Real-time:** Flask-SocketIO
- **Rate Limiting:** Flask-Limiter
- **Email:** Gmail SMTP / Resend API

### Frontend
- **Language:** TypeScript 5.2.2
- **Framework:** React 18.2.0
- **State Management:** Redux Toolkit
- **Routing:** React Router
- **Styling:** Tailwind CSS
- **HTTP Client:** Axios
- **Real-time:** Socket.IO Client
- **Build Tool:** Vite
- **Testing:** Vitest

### Database
- **Development:** SQLite
- **Production:** PostgreSQL (recommended)
- **Migrations:** Alembic

### DevOps
- **Containerization:** Docker
- **Version Control:** Git

---

## Modules

### 1. Warehouse Module

**Purpose:** Manage inventory, stock movements, and material tracking with FIFO logic

---

#### 1.1 Data Models

##### WarehouseZone
Manages warehouse zones for different material types and purposes.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `code` (String 50): Unique zone code (e.g., "ZONE-RAW", "ZONE-FG")
- `name` (String 200): Zone name (e.g., "Raw Materials Zone", "Finished Goods Zone")
- `description` (Text): Zone description
- `material_type` (String 50): Material type - `finished_goods`, `raw_materials`, `packaging_materials`, `chemical_materials`
- `zone_type` (String 50): Zone purpose - `storage`, `production`, `staging`, `quarantine`
- `capacity` (Numeric 15,2): Zone capacity
- `capacity_uom` (String 20): Capacity unit of measure
- `is_active` (Boolean): Active status
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `locations`: One-to-many with WarehouseLocation

---

##### WarehouseLocation
Specific storage locations within zones (Rack-Level-Position).

**Fields:**
- `id` (Integer, PK): Unique identifier
- `zone_id` (Integer, FK): Reference to WarehouseZone
- `location_code` (String 100): Unique location code (e.g., "RAW-A-01-01")
- `rack` (String 50): Rack identifier
- `level` (String 50): Level identifier
- `position` (String 50): Position identifier
- `capacity` (Numeric 15,2): Location capacity
- `capacity_uom` (String 20): Capacity unit of measure
- `occupied` (Numeric 15,2): Currently occupied quantity
- `is_active` (Boolean): Active status
- `is_available` (Boolean): Available for use
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `zone`: Many-to-one with WarehouseZone
- `inventory_items`: One-to-many with Inventory

---

##### Inventory
Current stock levels for materials and products.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `product_id` (Integer, FK): Reference to Product (for finished goods)
- `material_id` (Integer, FK): Reference to Material (for raw materials)
- `location_id` (Integer, FK): Reference to WarehouseLocation
- `quantity_on_hand` (Numeric 15,2): Total quantity in stock
- `quantity_reserved` (Numeric 15,2): Quantity reserved for orders
- `quantity_available` (Numeric 15,2): Available for use (on_hand - reserved)
- `min_stock_level` (Numeric 15,2): Minimum stock level for reorder
- `max_stock_level` (Numeric 15,2): Maximum stock level
- `batch_number` (String 100): Batch/lot number
- `lot_number` (String 100): Lot number
- `serial_number` (String 100): Serial number
- `production_date` (Date): Production/Manufacturing date
- `expiry_date` (Date): Expiration date
- `last_stock_check` (DateTime): Last physical count date
- `is_active` (Boolean): Active status

**Stock Status:**
- For Products: `released`, `quarantine`, `reject`
- For Materials: `available`, `on_hold`, `rejected`

- `stock_status` (String 20): Current stock status
- `qc_inspection_id` (Integer, FK): Reference to Quality Inspection
- `work_order_id` (Integer, FK): Reference to Work Order (for WIP)
- `qc_date` (DateTime): QC inspection date
- `qc_notes` (Text): QC inspection notes
- `grn_id` (Integer, FK): Reference to Goods Received Note
- `supplier_batch` (String 100): Supplier's batch number
- `created_by` (Integer, FK): User who created record
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `product`: Many-to-one with Product
- `material`: Many-to-one with Material
- `location`: Many-to-one with WarehouseLocation
- `created_by_user`: Many-to-one with User

**Constraints:**
- Must have either product_id OR material_id (not both)
- Unique index on (product_id, location_id)
- Unique index on (material_id, location_id)

---

##### InventoryMovement
History of all stock movements (IN/OUT/TRANSFER).

**Fields:**
- `id` (Integer, PK): Unique identifier
- `movement_date` (DateTime): Movement timestamp
- `movement_type` (String 50): Movement type - `IN`, `OUT`, `TRANSFER`, `ADJUSTMENT`
- `reference_type` (String 50): Reference document type - `grn`, `sales_order`, `work_order`, `stock_opname`, etc.
- `reference_id` (Integer): Reference document ID
- `reference_number` (String 100): Reference document number
- `product_id` (Integer, FK): Reference to Product
- `material_id` (Integer, FK): Reference to Material
- `from_location_id` (Integer, FK): Source location (for transfers)
- `to_location_id` (Integer, FK): Destination location
- `quantity` (Numeric 15,2): Movement quantity
- `uom` (String 20): Unit of measure
- `unit_cost` (Numeric 15,2): Unit cost for valuation
- `total_cost` (Numeric 15,2): Total cost (quantity × unit_cost)
- `notes` (Text): Movement notes
- `created_by` (Integer, FK): User who created record
- `created_at` (DateTime): Creation timestamp

**Relationships:**
- `product`: Many-to-one with Product
- `material`: Many-to-one with Material
- `from_location`: Many-to-one with WarehouseLocation
- `to_location`: Many-to-one with WarehouseLocation
- `created_by_user`: Many-to-one with User

---

##### Material
Master data for raw materials.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `code` (String 50): Unique material code
- `name` (String 200): Material name
- `description` (Text): Material description
- `material_type` (String 50): Material type - `raw_material`, `packaging`, `chemical`, etc.
- `category` (String 50): Material category
- `uom` (String 20): Base unit of measure
- `unit_cost` (Numeric 15,2): Standard unit cost
- `min_order_qty` (Numeric 15,2): Minimum order quantity
- `lead_time_days` (Integer): Procurement lead time in days
- `supplier_id` (Integer, FK): Default supplier
- `is_active` (Boolean): Active status
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `supplier`: Many-to-one with Supplier
- `inventory_items`: One-to-many with Inventory
- `movements`: One-to-many with InventoryMovement

---

#### 1.2 API Endpoints

##### GET /api/warehouse/materials
List all materials with pagination and filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `search` (String): Search in code/name
- `material_type` (String): Filter by material type
- `category` (String): Filter by category

**Response:**
```json
{
  "materials": [
    {
      "id": 1,
      "code": "MAT-001",
      "name": "Polyester 1.5DX38MM",
      "description": "Raw material for nonwoven production",
      "material_type": "raw_material",
      "category": "Fiber",
      "uom": "KG",
      "unit_cost": 15000,
      "min_order_qty": 1000,
      "lead_time_days": 7,
      "supplier_id": 1,
      "is_active": true,
      "current_stock": 5000,
      "available_stock": 4500
    }
  ],
  "total": 150,
  "pages": 3,
  "current_page": 1
}
```

---

##### POST /api/warehouse/materials
Create new material.

**Request Body:**
```json
{
  "code": "MAT-002",
  "name": "Polypropylene Granules",
  "description": "PP granules for production",
  "material_type": "raw_material",
  "category": "Polymer",
  "uom": "KG",
  "unit_cost": 18000,
  "min_order_qty": 500,
  "lead_time_days": 5,
  "supplier_id": 1
}
```

**Response:**
```json
{
  "message": "Material created successfully",
  "material": {
    "id": 2,
    "code": "MAT-002",
    "name": "Polypropylene Granules",
    ...
  }
}
```

---

##### GET /api/warehouse/inventory
Get current inventory levels with filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `location_id` (Integer): Filter by location
- `stock_status` (String): Filter by stock status
- `below_min_stock` (Boolean): Only show items below minimum stock

**Response:**
```json
{
  "inventory": [
    {
      "id": 1,
      "product_id": null,
      "material_id": 1,
      "location_code": "RAW-A-01-01",
      "quantity_on_hand": 5000,
      "quantity_reserved": 500,
      "quantity_available": 4500,
      "min_stock_level": 1000,
      "max_stock_level": 10000,
      "batch_number": "BATCH-2024-001",
      "production_date": "2024-01-15",
      "expiry_date": "2025-01-15",
      "stock_status": "available",
      "material": {
        "code": "MAT-001",
        "name": "Polyester 1.5DX38MM",
        "uom": "KG"
      }
    }
  ],
  "total": 200,
  "pages": 4
}
```

---

##### POST /api/warehouse/stock-opname
Create stock opname (physical inventory count).

**Request Body:**
```json
{
  "opname_date": "2024-04-21",
  "location_id": 1,
  "items": [
    {
      "material_id": 1,
      "system_quantity": 5000,
      "physical_quantity": 4950,
      "variance": -50,
      "variance_reason": "Damage during storage"
    }
  ],
  "notes": "Monthly stock count"
}
```

**Response:**
```json
{
  "message": "Stock opname created successfully",
  "opname": {
    "id": 1,
    "opname_number": "SO-20240421-001",
    "opname_date": "2024-04-21",
    "status": "completed",
    "total_items": 1,
    "total_variance": -50
  }
}
```

---

##### GET /api/warehouse/movements
Get stock movement history.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `movement_type` (String): Filter by movement type
- `reference_type` (String): Filter by reference type
- `from_date` (Date): Start date filter
- `to_date` (Date): End date filter

**Response:**
```json
{
  "movements": [
    {
      "id": 1,
      "movement_date": "2024-04-21T10:30:00",
      "movement_type": "IN",
      "reference_type": "grn",
      "reference_number": "GRN-2024-001",
      "material_id": 1,
      "material_code": "MAT-001",
      "material_name": "Polyester 1.5DX38MM",
      "from_location": null,
      "to_location_code": "RAW-A-01-01",
      "quantity": 1000,
      "uom": "KG",
      "unit_cost": 15000,
      "total_cost": 15000000,
      "notes": "Receipt from supplier"
    }
  ],
  "total": 500,
  "pages": 10
}
```

---

#### 1.3 Workflows

##### Material Receiving Workflow
1. **GRN Creation:** Purchasing creates Goods Received Note
2. **QC Inspection:** Quality team inspects received material
3. **Stock IN:** Material added to inventory with FIFO logic
4. **Location Assignment:** Material assigned to warehouse location
5. **Movement Record:** InventoryMovement created with type 'IN'

##### Material Issue Workflow
1. **Request:** Production requests material via Material Issue
2. **FIFO Deduction:** System deducts from oldest batch first
3. **Reservation:** Stock reserved for work order
4. **Movement Record:** InventoryMovement created with type 'OUT'
5. **Location Update:** Source location quantity decreased

##### Stock Opname Workflow
1. **Planning:** Schedule stock opname date and location
2. **Physical Count:** Count actual quantity in location
3. **Variance Calculation:** Compare system vs physical quantity
4. **Adjustment:** Create adjustment movement if variance exists
5. **Approval:** Manager approves stock opname

---

#### 1.4 Use Cases

**Use Case 1: Receive Raw Materials from Supplier**
- Purchasing receives material from supplier
- Creates GRN with material details
- Quality team inspects material
- If approved, material added to inventory
- FIFO logic ensures oldest stock used first

**Use Case 2: Issue Material to Production**
- Production requests material for work order
- System checks availability
- FIFO deduction from oldest batch
- Material reserved for work order
- Inventory movement recorded

**Use Case 3: Monthly Stock Count**
- Warehouse team schedules stock opname
- Physical count performed
- Variance calculated
- Adjustments made if needed
- Management approves results

**Use Case 4: Low Stock Alert**
- System monitors stock levels
- Alert when stock below minimum level
- Automatic purchase requisition created
- Procurement team notified

---

#### 1.5 Business Logic

**FIFO (First-In-First-Out) Deduction:**
- When material is issued, system selects oldest batch
- Deduction quantity from batch with earliest production_date
- If batch insufficient, deduct from next oldest
- Ensures material freshness and reduces waste

**Stock Availability Calculation:**
```
quantity_available = quantity_on_hand - quantity_reserved
```

**Reservation Logic:**
- Sales order reserves finished goods
- Work order reserves raw materials
- Reservation prevents double allocation
- Released when order cancelled or completed

**Variance Handling:**
- Positive variance (physical > system): Add adjustment IN
- Negative variance (physical < system): Add adjustment OUT
- Requires approval for significant variances
- Investigate root cause for repeated variances

---

### 2. Production Module

**Purpose:** Manage production workflows, work orders, and material usage with multi-stage WIP tracking

---

#### 2.1 Data Models

##### Machine
Production equipment/machines for manufacturing.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `code` (String 50): Unique machine code (e.g., "M-NW-001")
- `name` (String 200): Machine name (e.g., "Nonwoven Machine Line 1")
- `machine_type` (String 100): Machine type - `nonwoven_machine`, `cutting_machine`, `packing_machine`
- `manufacturer` (String 200): Machine manufacturer
- `model` (String 100): Machine model
- `serial_number` (String 100): Serial number
- `status` (String 50): Current status - `idle`, `running`, `maintenance`, `breakdown`, `offline`
- `location` (String 200): Machine location
- `department` (String 100): Department
- `capacity_per_hour` (Numeric 15,2): Production capacity per hour
- `capacity_uom` (String 20): Capacity unit of measure
- `default_speed` (Integer): Default speed in pcs/minut for efficiency calculation
- `target_efficiency` (Integer): Target efficiency percentage (default 60%)
- `efficiency` (Numeric 5,2): Current efficiency percentage
- `availability` (Numeric 5,2): Current availability percentage
- `last_maintenance` (Date): Last maintenance date
- `next_maintenance` (Date): Next scheduled maintenance
- `installation_date` (Date): Installation date
- `is_active` (Boolean): Active status
- `specifications` (Text): Technical specifications
- `maintenance_schedule` (String 50): Maintenance schedule
- `notes` (Text): Additional notes
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `work_orders`: One-to-many with WorkOrder
- `production_records`: One-to-many with ProductionRecord
- `maintenance_records`: One-to-many with MaintenanceRecord
- `oee_records`: One-to-many with OEERecord
- `rosters`: One-to-many with EmployeeRoster
- `shift_productions`: One-to-many with ShiftProduction
- `downtime_records`: One-to-many with DowntimeRecord

---

##### BillOfMaterials (BOM)
Bill of Materials defining material requirements for products.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `bom_number` (String 100): Unique BOM number (e.g., "BOM-PRD-001")
- `product_id` (Integer, FK): Reference to Product
- `version` (String 20): BOM version (e.g., "1.0", "2.0")
- `is_active` (Boolean): Active status
- `effective_date` (Date): Effective date
- `expiry_date` (Date): Expiry date
- `batch_size` (Numeric 15,2): Standard batch size
- `batch_uom` (String 20): Batch unit of measure
- `pack_per_carton` (Integer): Pack per carton
- `notes` (Text): Additional notes
- `created_by` (Integer, FK): User who created BOM
- `approved_by` (Integer, FK): User who approved BOM
- `approved_at` (DateTime): Approval timestamp
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Properties:**
- `total_cost`: Sum of all BOM item costs
- `total_materials`: Count of materials in BOM
- `critical_materials`: Count of critical materials

**Relationships:**
- `product`: Many-to-one with Product
- `items`: One-to-many with BOMItem
- `created_by_user`: Many-to-one with User
- `approved_by_user`: Many-to-one with User
- `work_orders`: One-to-many with WorkOrder

---

##### BOMItem
Individual material requirements within a BOM.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `bom_id` (Integer, FK): Reference to BOM
- `line_number` (Integer): Line sequence number
- `product_id` (Integer, FK): Reference to Product (for sub-assemblies)
- `material_id` (Integer, FK): Reference to Material
- `quantity` (Numeric 20,10): Required quantity (supports 10 decimal places)
- `uom` (String 20): Unit of measure
- `scrap_percent` (Numeric 5,2): Scrap percentage
- `is_critical` (Boolean): Critical material flag
- `substitute_material_id` (Integer, FK): Substitute material
- `notes` (Text): Additional notes
- `created_at` (DateTime): Creation timestamp

**Properties:**
- `total_cost`: quantity × material unit cost

**Relationships:**
- `bom`: Many-to-one with BillOfMaterials
- `product`: Many-to-one with Product
- `material`: Many-to-one with Material
- `substitute_material`: Many-to-one with Material

---

##### WorkOrder
Production work orders for manufacturing products.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `wo_number` (String 100): Unique work order number (e.g., "WO-20240421-001")
- `product_id` (Integer, FK): Reference to Product
- `bom_id` (Integer, FK): Reference to BOM
- `machine_id` (Integer, FK): Reference to Machine
- `status` (String 50): Status - `draft`, `pending`, `in_progress`, `completed`, `cancelled`
- `priority` (String 50): Priority - `low`, `medium`, `high`, `urgent`
- `planned_quantity` (Numeric 15,2): Planned production quantity
- `planned_uom` (String 20): Planned unit of measure
- `actual_quantity` (Numeric 15,2): Actual produced quantity
- `actual_uom` (String 20): Actual unit of measure
- `start_date` (DateTime): Planned start date
- `end_date` (DateTime): Planned end date
- `actual_start_date` (DateTime): Actual start date
- `actual_end_date` (DateTime): Actual end date
- `material_status` (String 50): Material availability - `not_checked`, `available`, `insufficient`
- `notes` (Text): Additional notes
- `created_by` (Integer, FK): User who created work order
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `product`: Many-to-one with Product
- `bom`: Many-to-one with BillOfMaterials
- `machine`: Many-to-one with Machine
- `production_records`: One-to-many with ProductionRecord
- `material_issues`: One-to-many with MaterialIssue
- `created_by_user`: Many-to-one with User

---

##### ProductionRecord
Actual production data recorded during manufacturing.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `work_order_id` (Integer, FK): Reference to WorkOrder
- `machine_id` (Integer, FK): Reference to Machine
- `shift_date` (Date): Shift date
- `shift_type` (String 50): Shift type - `morning`, `afternoon`, `night`
- `operator_id` (Integer, FK): Reference to Employee
- `product_id` (Integer, FK): Reference to Product
- `planned_quantity` (Numeric 15,2): Planned quantity
- `actual_quantity` (Numeric 15,2): Actual produced quantity
- `reject_quantity` (Numeric 15,2): Rejected quantity
- `good_quantity` (Numeric 15,2): Good quantity (actual - reject)
- `efficiency` (Numeric 5,2): Efficiency percentage
- `downtime_minutes` (Integer): Total downtime in minutes
- `notes` (Text): Production notes
- `created_at` (DateTime): Creation timestamp

**Relationships:**
- `work_order`: Many-to-one with WorkOrder
- `machine`: Many-to-one with Machine
- `operator`: Many-to-one with Employee
- `product`: Many-to-one with Product

---

##### MaterialIssue
Material issuance to production work orders.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `issue_number` (String 100): Unique issue number (e.g., "MI-20240421-001")
- `work_order_id` (Integer, FK): Reference to WorkOrder
- `material_id` (Integer, FK): Reference to Material
- `issued_quantity` (Numeric 15,2): Issued quantity
- `uom` (String 20): Unit of measure
- `issue_date` (DateTime): Issue date
- `issued_by` (Integer, FK): User who issued material
- `notes` (Text): Additional notes
- `created_at` (DateTime): Creation timestamp

**Relationships:**
- `work_order`: Many-to-one with WorkOrder
- `material`: Many-to-one with Material
- `issued_by_user`: Many-to-one with User

---

##### WIPStock
Work-in-Progress inventory tracking.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `work_order_id` (Integer, FK): Reference to WorkOrder
- `product_id` (Integer, FK): Reference to Product
- `material_id` (Integer, FK): Reference to Material
- `stage` (String 50): Production stage
- `quantity` (Numeric 15,2): WIP quantity
- `uom` (String 20): Unit of measure
- `location` (String 200): WIP location
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `work_order`: Many-to-one with WorkOrder
- `product`: Many-to-one with Product
- `material`: Many-to-one with Material

---

#### 2.2 API Endpoints

##### GET /api/production/work-orders
List all work orders with filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `status` (String): Filter by status
- `priority` (String): Filter by priority
- `machine_id` (Integer): Filter by machine
- `from_date` (Date): Start date filter
- `to_date` (Date): End date filter

**Response:**
```json
{
  "work_orders": [
    {
      "id": 1,
      "wo_number": "WO-20240421-001",
      "product_id": 1,
      "product_name": "Wetkins Baby Blue 5S @384",
      "bom_id": 1,
      "machine_id": 1,
      "machine_name": "Nonwoven Machine Line 1",
      "status": "in_progress",
      "priority": "high",
      "planned_quantity": 10000,
      "planned_uom": "pcs",
      "actual_quantity": 5000,
      "actual_uom": "pcs",
      "start_date": "2024-04-21T08:00:00",
      "end_date": "2024-04-21T17:00:00",
      "material_status": "available",
      "progress_percentage": 50
    }
  ],
  "total": 50,
  "pages": 1
}
```

---

##### POST /api/production/work-orders
Create new work order.

**Request Body:**
```json
{
  "product_id": 1,
  "bom_id": 1,
  "machine_id": 1,
  "priority": "high",
  "planned_quantity": 10000,
  "planned_uom": "pcs",
  "start_date": "2024-04-21T08:00:00",
  "end_date": "2024-04-21T17:00:00",
  "notes": "Urgent order for customer"
}
```

**Response:**
```json
{
  "message": "Work order created successfully",
  "work_order": {
    "id": 1,
    "wo_number": "WO-20240421-001",
    "status": "pending",
    "material_status": "not_checked",
    ...
  }
}
```

---

##### PUT /api/production/work-orders/<id>/status
Update work order status.

**Request Body:**
```json
{
  "status": "in_progress",
  "notes": "Starting production"
}
```

**Response:**
```json
{
  "message": "Work order status updated successfully",
  "work_order": {
    "id": 1,
    "status": "in_progress",
    ...
  }
}
```

---

##### POST /api/production/material-issue
Issue materials to work order.

**Request Body:**
```json
{
  "work_order_id": 1,
  "items": [
    {
      "material_id": 1,
      "quantity": 500,
      "uom": "KG"
    },
    {
      "material_id": 2,
      "quantity": 100,
      "uom": "KG"
    }
  ],
  "notes": "Material issue for WO-20240421-001"
}
```

**Response:**
```json
{
  "message": "Materials issued successfully",
  "issue": {
    "id": 1,
    "issue_number": "MI-20240421-001",
    "work_order_id": 1,
    "total_items": 2,
    "status": "completed"
  },
  "inventory_movements": [
    {
      "material_id": 1,
      "quantity": 500,
      "movement_type": "OUT"
    }
  ]
}
```

---

##### POST /api/production/material-receive
Receive finished goods from production.

**Request Body:**
```json
{
  "work_order_id": 1,
  "product_id": 1,
  "quantity": 5000,
  "uom": "pcs",
  "location_id": 5,
  "batch_number": "BATCH-20240421-001",
  "notes": "Finished goods from WO-20240421-001"
}
```

**Response:**
```json
{
  "message": "Finished goods received successfully",
  "receipt": {
    "id": 1,
    "work_order_id": 1,
    "product_id": 1,
    "quantity": 5000,
    "location_code": "FG-B-01-01"
  },
  "inventory_movement": {
    "movement_type": "IN",
    "quantity": 5000
  }
}
```

---

##### GET /api/production/live-monitoring
Get live production data.

**Response:**
```json
{
  "machines": [
    {
      "id": 1,
      "code": "M-NW-001",
      "name": "Nonwoven Machine Line 1",
      "status": "running",
      "current_work_order": {
        "wo_number": "WO-20240421-001",
        "product_name": "Wetkins Baby Blue 5S @384",
        "progress_percentage": 65
      },
      "efficiency": 85.5,
      "availability": 92.3,
      "current_speed": 120,
      "target_speed": 100
    }
  ],
  "overall_efficiency": 82.5,
  "total_active_machines": 3,
  "total_machines": 5
}
```

---

#### 2.3 Workflows

##### Work Order Creation Workflow
1. **Planning:** Production planner creates work order
2. **BOM Selection:** Select appropriate BOM for product
3. **Machine Assignment:** Assign to available machine
4. **Material Check:** Check material availability via MRP
5. **Approval:** Manager approves work order
6. **Scheduling:** Schedule on production calendar

##### Material Issue Workflow
1. **Request:** Production requests materials for work order
2. **Availability Check:** System checks inventory availability
3. **FIFO Deduction:** System selects oldest batches
4. **Reservation:** Stock reserved for work order
5. **Issue:** Material physically issued to production line
6. **Movement Record:** InventoryMovement created with type 'OUT'

##### Production Recording Workflow
1. **Start Production:** Operator starts production on machine
2. **Input Recording:** Record production inputs periodically
3. **Quality Check:** Quality team inspects output
4. **Reject Handling:** Record rejected quantity
5. **Good Quantity:** Calculate good quantity
6. **Efficiency Calculation:** Calculate production efficiency
7. **Completion:** Mark work order as completed

##### Finished Goods Receipt Workflow
1. **Production Complete:** Work order marked as completed
2. **QC Inspection:** Quality team inspects finished goods
3. **Batch Assignment:** Assign batch/lot number
4. **Location Assignment:** Assign to warehouse location
5. **Stock IN:** Add to finished goods inventory
6. **Movement Record:** InventoryMovement created with type 'IN'

---

#### 2.4 Use Cases

**Use Case 1: Create Production Work Order**
- Production planner receives customer order
- Checks material availability via MRP
- Creates work order with product, quantity, dates
- Assigns to available machine
- Manager approves work order
- Work order scheduled for production

**Use Case 2: Issue Materials to Production**
- Production team requests materials for work order
- System checks inventory availability
- FIFO deduction from oldest batches
- Material reserved for work order
- Material physically issued to production line
- Inventory movement recorded

**Use Case 3: Record Production Output**
- Operator records production input every shift
- System calculates efficiency vs target
- Quality team inspects output
- Reject quantity recorded
- Good quantity calculated
- Production record saved

**Use Case 4: Receive Finished Goods**
- Production completed for work order
- Quality team performs final inspection
- Batch number assigned
- Finished goods added to inventory
- Inventory movement recorded
- Work order marked as completed

---

#### 2.5 Business Logic

**Material Availability Check:**
```
For each material in BOM:
  Calculate required quantity = BOM quantity × planned quantity
  Check available inventory (quantity_available)
  If available < required: Mark as insufficient
  Else: Mark as available
```

**FIFO Material Deduction:**
- When material is issued, select batches by production_date (oldest first)
- Deduct from batch with earliest production_date
- If batch insufficient, deduct from next oldest
- Continue until required quantity met

**Production Efficiency Calculation:**
```
efficiency = (actual_quantity / planned_quantity) × 100
```

**OEE (Overall Equipment Effectiveness) Calculation:**
```
OEE = Availability × Performance × Quality
Availability = (Planned Production Time - Downtime) / Planned Production Time
Performance = (Actual Production / Theoretical Maximum Production)
Quality = Good Quantity / Total Quantity
```

**WIP Tracking:**
- Materials transferred from Inventory to WIPStock when issued
- WIPStock updated as production progresses through stages
- Finished goods transferred from WIPStock to Inventory when completed

---

### 3. Finance & Accounting Module

**Purpose:** Manage financial transactions, journal entries, and GL posting with approval workflows

---

#### 3.1 Data Models

##### AccountingEntry
General ledger journal entries for financial transactions.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `entry_number` (String 100): Unique entry number (e.g., "JE-20240421-001")
- `entry_date` (Date): Transaction date
- `entry_type` (String 50): Entry type - `manual`, `auto_production`, `auto_payroll`, `auto_purchase`, `auto_sales`
- `reference_type` (String 50): Reference document type - `work_order`, `payroll_period`, `purchase_invoice`, `sales_invoice`
- `reference_id` (Integer): Reference document ID
- `reference_number` (String 100): Reference document number
- `description` (Text): Entry description
- `status` (String 50): Status - `draft`, `posted`, `reversed`
- `total_debit` (Numeric 15,2): Total debit amount
- `total_credit` (Numeric 15,2): Total credit amount
- `created_by` (Integer, FK): User who created entry
- `approved_by` (Integer, FK): User who approved entry
- `approved_at` (DateTime): Approval timestamp
- `posted_at` (DateTime): Posting timestamp
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `lines`: One-to-many with AccountingEntryLine
- `created_by_user`: Many-to-one with User
- `approved_by_user`: Many-to-one with User

---

##### AccountingEntryLine
Individual debit/credit lines within a journal entry.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `entry_id` (Integer, FK): Reference to AccountingEntry
- `line_number` (Integer): Line sequence number
- `account_id` (Integer, FK): Reference to Account
- `account_code` (String 50): Account code (for reference)
- `account_name` (String 200): Account name (for reference)
- `debit_amount` (Numeric 15,2): Debit amount
- `credit_amount` (Numeric 15,2): Credit amount
- `description` (Text): Line description
- `cost_center_id` (Integer, FK): Reference to CostCenter
- `created_at` (DateTime): Creation timestamp

**Relationships:**
- `entry`: Many-to-one with AccountingEntry
- `account`: Many-to-one with Account
- `cost_center`: Many-to-one with CostCenter

**Constraints:**
- Each line must have either debit OR credit (not both)
- Sum of debits must equal sum of credits per entry

---

##### Account
Chart of accounts for financial reporting.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `account_code` (String 50): Unique account code (e.g., "1-1001")
- `account_name` (String 200): Account name
- `account_type` (String 50): Account type - `asset`, `liability`, `equity`, `revenue`, `expense`, `cost_of_goods_sold`
- `account_category` (String 50): Account category
- `parent_account_id` (Integer, FK): Parent account for hierarchy
- `is_active` (Boolean): Active status
- `is_control_account` (Boolean): Control account flag
- `normal_balance` (String 10): Normal balance - `debit`, `credit`
- `description` (Text): Account description
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `parent_account`: Many-to-one with Account (self-referencing)
- `child_accounts`: One-to-many with Account
- `entry_lines`: One-to-many with AccountingEntryLine

---

##### PendingJournalEntry
Pending journal entries for approval workflow.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `workflow_id` (Integer, FK): Reference to ApprovalWorkflow
- `document_type` (String 50): Document type - `sales_order`, `purchase_invoice`, `work_order`
- `document_id` (Integer): Reference document ID
- `journal_entries` (JSON): Serialized journal entry lines
- `status` (String 50): Status - `pending`, `approved`, `rejected`
- `created_by` (Integer, FK): User who created pending entry
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `workflow`: Many-to-one with ApprovalWorkflow
- `created_by_user`: Many-to-one with User

---

##### CostCenter
Cost centers for expense tracking and reporting.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `code` (String 50): Unique cost center code
- `name` (String 200): Cost center name
- `description` (Text): Description
- `is_active` (Boolean): Active status
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

---

#### 3.2 API Endpoints

##### GET /api/finance/journal-entries
List all journal entries with filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `entry_type` (String): Filter by entry type
- `status` (String): Filter by status
- `from_date` (Date): Start date filter
- `to_date` (Date): End date filter

**Response:**
```json
{
  "entries": [
    {
      "id": 1,
      "entry_number": "JE-20240421-001",
      "entry_date": "2024-04-21",
      "entry_type": "auto_production",
      "reference_type": "work_order",
      "reference_number": "WO-20240421-001",
      "description": "Production cost posting for WO-20240421-001",
      "status": "posted",
      "total_debit": 50000000,
      "total_credit": 50000000,
      "line_count": 5,
      "created_by": "John Doe",
      "approved_by": "Jane Smith",
      "approved_at": "2024-04-21T10:00:00",
      "posted_at": "2024-04-21T10:05:00"
    }
  ],
  "total": 500,
  "pages": 10
}
```

---

##### POST /api/finance/journal-entries
Create manual journal entry.

**Request Body:**
```json
{
  "entry_date": "2024-04-21",
  "entry_type": "manual",
  "description": "Adjustment entry for inventory variance",
  "lines": [
    {
      "account_id": 1,
      "account_code": "1-1001",
      "debit_amount": 500000,
      "credit_amount": 0,
      "description": "Inventory variance adjustment",
      "cost_center_id": 1
    },
    {
      "account_id": 2,
      "account_code": "5-1001",
      "debit_amount": 0,
      "credit_amount": 500000,
      "description": "Inventory variance adjustment",
      "cost_center_id": 1
    }
  ]
}
```

**Response:**
```json
{
  "message": "Journal entry created successfully",
  "entry": {
    "id": 1,
    "entry_number": "JE-20240421-001",
    "status": "draft",
    "total_debit": 500000,
    "total_credit": 500000,
    "line_count": 2
  }
}
```

---

##### POST /api/finance/journal-entries/<id>/post
Post journal entry to general ledger.

**Response:**
```json
{
  "message": "Journal entry posted successfully",
  "entry": {
    "id": 1,
    "entry_number": "JE-20240421-001",
    "status": "posted",
    "posted_at": "2024-04-21T10:05:00"
  }
}
```

---

##### GET /api/finance/accounts
List chart of accounts.

**Query Parameters:**
- `account_type` (String): Filter by account type
- `is_active` (Boolean): Filter by active status
- `parent_account_id` (Integer): Filter by parent account

**Response:**
```json
{
  "accounts": [
    {
      "id": 1,
      "account_code": "1-1001",
      "account_name": "Cash",
      "account_type": "asset",
      "account_category": "Current Assets",
      "normal_balance": "debit",
      "is_active": true,
      "is_control_account": false,
      "current_balance": 150000000
    },
    {
      "id": 2,
      "account_code": "1-1002",
      "account_name": "Accounts Receivable",
      "account_type": "asset",
      "account_category": "Current Assets",
      "normal_balance": "debit",
      "is_active": true,
      "is_control_account": true,
      "current_balance": 75000000
    }
  ],
  "total": 150
}
```

---

##### GET /api/finance/reports/trial-balance
Generate trial balance report.

**Query Parameters:**
- `as_of_date` (Date): Report date

**Response:**
```json
{
  "as_of_date": "2024-04-21",
  "accounts": [
    {
      "account_code": "1-1001",
      "account_name": "Cash",
      "debit_balance": 150000000,
      "credit_balance": 0
    },
    {
      "account_code": "2-1001",
      "account_name": "Accounts Payable",
      "debit_balance": 0,
      "credit_balance": 50000000
    }
  ],
  "total_debit": 200000000,
  "total_credit": 200000000,
  "is_balanced": true
}
```

---

##### GET /api/finance/reports/income-statement
Generate income statement report.

**Query Parameters:**
- `from_date` (Date): Start date
- `to_date` (Date): End date

**Response:**
```json
{
  "period": "2024-04-01 to 2024-04-21",
  "revenue": {
    "total": 500000000,
    "items": [
      {
        "account_code": "4-1001",
        "account_name": "Sales Revenue",
        "amount": 500000000
      }
    ]
  },
  "cost_of_goods_sold": {
    "total": 300000000,
    "items": [
      {
        "account_code": "5-1001",
        "account_name": "Material Cost",
        "amount": 200000000
      },
      {
        "account_code": "5-1002",
        "account_name": "Labor Cost",
        "amount": 100000000
      }
    ]
  },
  "operating_expenses": {
    "total": 50000000,
    "items": [...]
  },
  "gross_profit": 200000000,
  "operating_income": 150000000,
  "net_income": 150000000
}
```

---

#### 3.3 Workflows

##### Manual Journal Entry Workflow
1. **Creation:** Accountant creates journal entry with lines
2. **Validation:** System validates debit = credit
3. **Approval:** Manager reviews and approves
4. **Posting:** Entry posted to general ledger
5. **Reversal (if needed):** Create reversing entry

##### Auto Production Cost Posting Workflow
1. **Work Order Complete:** Production completes work order
2. **Cost Calculation:** System calculates material, labor, overhead costs
3. **Journal Entry Creation:** Automatic journal entry created
4. **Approval Workflow:** PendingJournalEntry created for approval
5. **Approval:** Manager approves via workflow
6. **Posting:** Entry posted to WIP and COGS accounts

##### Sales Invoice Posting Workflow
1. **Sales Order:** Sales creates sales order
2. **Pending Entry:** PendingJournalEntry created with revenue and receivable
3. **Approval:** Finance manager approves
4. **Posting:** Entry posted to revenue and accounts receivable

##### Purchase Invoice Posting Workflow
1. **GRN Received:** Purchasing receives goods
2. **Invoice Received:** Supplier invoice received
3. **Pending Entry:** PendingJournalEntry created with expense and payable
4. **Approval:** Finance manager approves
5. **Posting:** Entry posted to expense and accounts payable

---

#### 3.4 Use Cases

**Use Case 1: Create Manual Journal Entry**
- Accountant needs to record adjustment
- Creates journal entry with debit/credit lines
- System validates debit = credit
- Manager reviews and approves
- Entry posted to general ledger

**Use Case 2: Auto-Post Production Costs**
- Work order completed
- System calculates material, labor, overhead costs
- Automatic journal entry created
- Sent to approval workflow
- Manager approves
- Costs posted to WIP and COGS

**Use Case 3: Post Sales Invoice**
- Sales order delivered
- Pending journal entry created
- Revenue and accounts receivable
- Finance manager approves
- Entry posted to GL

**Use Case 4: Generate Financial Reports**
- Finance manager requests trial balance
- System calculates account balances
- Generates trial balance report
- Validates debits = credits
- Report generated and displayed

---

#### 3.5 Business Logic

**Debit/Credit Validation:**
```
For each journal entry:
  Sum all debit amounts
  Sum all credit amounts
  If debit_total != credit_total: Reject entry
```

**Account Normal Balance:**
- Asset accounts: Normal balance = Debit
- Liability accounts: Normal balance = Credit
- Equity accounts: Normal balance = Credit
- Revenue accounts: Normal balance = Credit
- Expense accounts: Normal balance = Debit
- COGS accounts: Normal balance = Debit

**Trial Balance Calculation:**
```
For each account:
  Calculate debit balance (sum of debits - sum of credits for debit-normal accounts)
  Calculate credit balance (sum of credits - sum of debits for credit-normal accounts)
Sum all debit balances
Sum all credit balances
If debit_total != credit_total: Trial balance out of balance
```

**Income Statement Calculation:**
```
Revenue = Sum of all revenue accounts
COGS = Sum of all COGS accounts
Gross Profit = Revenue - COGS
Operating Expenses = Sum of all expense accounts (excluding COGS)
Operating Income = Gross Profit - Operating Expenses
Net Income = Operating Income + Other Income - Other Expenses
```

**Auto Production Cost Calculation:**
```
Material Cost = Sum of material issues × unit cost
Labor Cost = Actual quantity × labor rate per unit
Overhead Cost = (Actual labor hours × overhead rate)
Total Production Cost = Material Cost + Labor Cost + Overhead Cost

Journal Entry:
  Debit WIP Inventory: Total Production Cost
  Credit Raw Materials Inventory: Material Cost
  Credit Wages Payable: Labor Cost
  Credit Manufacturing Overhead: Overhead Cost
```

---

### 4. Shipping Module
**Purpose:** Manage shipping orders and delivery tracking

**Features:**
- Shipping order creation
- Inventory deduction for shipping
- Packing list generation
- Delivery tracking
- Integration dengan Sales and Warehouse

**Key Models:**
- `ShippingOrder`: Shipping orders
- `PackingList`: Packing lists
- `DeliveryRecord`: Delivery tracking

**API Endpoints:**
- `GET /api/shipping/orders` - List shipping orders
- `POST /api/shipping/orders` - Create shipping order
- `GET /api/shipping/packing-lists` - List packing lists
- `PUT /api/shipping/orders/<id>/status` - Update shipping status

---

### 5. Maintenance Module
**Purpose:** Manage equipment maintenance and spare parts

**Features:**
- Maintenance request management
- Preventive maintenance scheduling
- Spare parts tracking
- Inventory deduction for spare parts
- Equipment lifecycle tracking

**Key Models:**
- `MaintenanceRequest`: Maintenance requests
- `MaintenanceSchedule`: Maintenance schedules
- `Equipment`: Equipment master data

**API Endpoints:**
- `GET /api/maintenance/requests` - List maintenance requests
- `POST /api/maintenance/requests` - Create maintenance request
- `GET /api/maintenance/schedules` - List maintenance schedules

---

### 6. Purchasing Module

**Purpose:** Manage procurement, supplier relationships, purchase orders, and goods receipt with finance integration

---

#### 6.1 Data Models

##### Supplier
Supplier master data for procurement.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `code` (String 50): Unique supplier code (e.g., "SUP-001")
- `company_name` (String 255): Company name
- `contact_person` (String 200): Contact person name
- `email` (String 120): Email address
- `phone` (String 50): Phone number
- `mobile` (String 50): Mobile number
- `fax` (String 50): Fax number
- `website` (String 200): Website URL
- `tax_id` (String 100): Tax ID
- `address` (Text): Address
- `city` (String 100): City
- `state` (String 100): State
- `country` (String 100): Country
- `postal_code` (String 20): Postal code
- `payment_terms_days` (Integer): Payment terms in days (default: 30)
- `credit_limit` (Numeric 15,2): Credit limit
- `is_active` (Boolean): Active status
- `supplier_type` (String 50): Supplier type - `manufacturer`, `distributor`, `trader`
- `rating` (String 20): Supplier rating - `A`, `B`, `C`
- `lead_time_days` (Integer): Lead time in days
- `notes` (Text): Notes
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `materials`: One-to-many with Material
- `purchase_orders`: One-to-many with PurchaseOrder

---

##### PurchaseOrder
Purchase orders for procurement.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `po_number` (String 100): Unique PO number (e.g., "PO-20240421-001")
- `supplier_id` (Integer, FK): Reference to Supplier
- `order_date` (Date): Order date
- `required_date` (Date): Required date
- `expected_date` (Date): Expected delivery date
- `delivery_date` (Date): Actual delivery date
- `status` (String 50): Status - `draft`, `sent`, `confirmed`, `partial`, `received`, `cancelled`
- `priority` (String 20): Priority - `low`, `normal`, `high`, `urgent`
- `supplier_quote_number` (String 100): Supplier quote number
- `payment_terms` (String 100): Payment terms
- `payment_method` (String 50): Payment method
- `delivery_address` (Text): Delivery address
- `shipping_method` (String 100): Shipping method
- `shipping_cost` (Numeric 15,2): Shipping cost
- `subtotal` (Numeric 15,2): Subtotal
- `tax_amount` (Numeric 15,2): Tax amount
- `discount_amount` (Numeric 15,2): Discount amount
- `total_amount` (Numeric 15,2): Total amount
- `notes` (Text): Notes
- `internal_notes` (Text): Internal notes
- `created_by` (Integer, FK): User who created PO
- `approved_by` (Integer, FK): User who approved PO
- `approved_at` (DateTime): Approval timestamp
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `supplier`: Many-to-one with Supplier
- `items`: One-to-many with PurchaseOrderItem
- `grn_records`: One-to-many with GoodsReceivedNote
- `created_by_user`: Many-to-one with User
- `approved_by_user`: Many-to-one with User

---

##### PurchaseOrderItem
Line items within a purchase order.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `po_id` (Integer, FK): Reference to PurchaseOrder
- `line_number` (Integer): Line sequence number
- `product_id` (Integer, FK): Reference to Product
- `material_id` (Integer, FK): Reference to Material
- `description` (Text): Description
- `quantity` (Numeric 15,2): Quantity
- `uom` (String 20): Unit of measure
- `unit_price` (Numeric 15,2): Unit price
- `discount_percent` (Numeric 5,2): Discount percentage
- `discount_amount` (Numeric 15,2): Discount amount
- `tax_percent` (Numeric 5,2): Tax percentage
- `tax_amount` (Numeric 15,2): Tax amount
- `total_price` (Numeric 15,2): Total price
- `quantity_received` (Numeric 15,2): Quantity received
- `quantity_invoiced` (Numeric 15,2): Quantity invoiced
- `required_date` (Date): Required date
- `notes` (Text): Notes
- `created_at` (DateTime): Creation timestamp

**Relationships:**
- `purchase_order`: Many-to-one with PurchaseOrder
- `product`: Many-to-one with Product
- `material`: Many-to-one with Material

**Constraints:**
- Unique constraint on (po_id, line_number)

---

##### GoodsReceivedNote (GRN)
Goods received notes for receiving materials from suppliers.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `grn_number` (String 100): Unique GRN number (e.g., "GRN-20240421-001")
- `po_id` (Integer, FK): Reference to PurchaseOrder
- `supplier_id` (Integer, FK): Reference to Supplier
- `received_date` (Date): Receipt date
- `received_by` (Integer, FK): User who received goods
- `location_id` (Integer, FK): Reference to WarehouseLocation
- `status` (String 50): Status - `draft`, `inspected`, `approved`, `rejected`
- `inspection_status` (String 50): QC inspection status - `pending`, `passed`, `failed`
- `notes` (Text): Notes
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `purchase_order`: Many-to-one with PurchaseOrder
- `supplier`: Many-to-one with Supplier
- `location`: Many-to-one with WarehouseLocation
- `received_by_user`: Many-to-one with User
- `items`: One-to-many with GRNItem

---

##### GRNItem
Line items within a GRN.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `grn_id` (Integer, FK): Reference to GoodsReceivedNote
- `po_item_id` (Integer, FK): Reference to PurchaseOrderItem
- `material_id` (Integer, FK): Reference to Material
- `description` (Text): Description
- `ordered_quantity` (Numeric 15,2): Ordered quantity from PO
- `received_quantity` (Numeric 15,2): Received quantity
- `uom` (String 20): Unit of measure
- `unit_price` (Numeric 15,2): Unit price from PO
- `total_price` (Numeric 15,2): Total price
- `batch_number` (String 100): Batch/lot number
- `supplier_batch` (String 100): Supplier's batch number
- `production_date` (Date): Production date
- `expiry_date` (Date): Expiry date
- `notes` (Text): Notes
- `created_at` (DateTime): Creation timestamp

**Relationships:**
- `grn`: Many-to-one with GoodsReceivedNote
- `po_item`: Many-to-one with PurchaseOrderItem
- `material`: Many-to-one with Material

---

##### PurchaseInvoice
Purchase invoices from suppliers.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `invoice_number` (String 100): Unique invoice number
- `po_id` (Integer, FK): Reference to PurchaseOrder
- `supplier_id` (Integer, FK): Reference to Supplier
- `invoice_date` (Date): Invoice date
- `due_date` (Date): Due date
- `status` (String 50): Status - `draft`, `received`, `approved`, `paid`, `overdue`, `cancelled`
- `subtotal` (Numeric 15,2): Subtotal
- `tax_amount` (Numeric 15,2): Tax amount
- `discount_amount` (Numeric 15,2): Discount amount
- `total_amount` (Numeric 15,2): Total amount
- `paid_amount` (Numeric 15,2): Paid amount
- `balance_due` (Numeric 15,2): Balance due
- `notes` (Text): Notes
- `created_by` (Integer, FK): User who created invoice
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `purchase_order`: Many-to-one with PurchaseOrder
- `supplier`: Many-to-one with Supplier
- `created_by_user`: Many-to-one with User
- `items`: One-to-many with PurchaseInvoiceItem

---

##### PurchaseInvoiceItem
Line items within a purchase invoice.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `invoice_id` (Integer, FK): Reference to PurchaseInvoice
- `line_number` (Integer): Line sequence number
- `material_id` (Integer, FK): Reference to Material
- `description` (Text): Description
- `quantity` (Numeric 15,2): Quantity
- `uom` (String 20): Unit of measure
- `unit_price` (Numeric 15,2): Unit price
- `discount_percent` (Numeric 5,2): Discount percentage
- `discount_amount` (Numeric 15,2): Discount amount
- `tax_percent` (Numeric 5,2): Tax percentage
- `tax_amount` (Numeric 15,2): Tax amount
- `total_amount` (Numeric 15,2): Total amount
- `created_at` (DateTime): Creation timestamp

**Relationships:**
- `invoice`: Many-to-one with PurchaseInvoice
- `material`: Many-to-one with Material

---

##### PurchaseReturn
Purchase returns for defective or excess materials.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `return_number` (String 100): Unique return number (e.g., "PR-20240421-001")
- `po_id` (Integer, FK): Reference to PurchaseOrder
- `grn_id` (Integer, FK): Reference to GoodsReceivedNote
- `supplier_id` (Integer, FK): Reference to Supplier
- `return_date` (Date): Return date
- `status` (String 50): Status - `draft`, `submitted`, `approved`, `rejected`, `completed`
- `return_type` (String 50): Return type - `defective`, `excess`, `wrong_item`
- `reason` (Text): Return reason
- `notes` (Text): Notes
- `created_by` (Integer, FK): User who created return
- `approved_by` (Integer, FK): User who approved return
- `approved_at` (DateTime): Approval timestamp
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `purchase_order`: Many-to-one with PurchaseOrder
- `grn`: Many-to-one with GoodsReceivedNote
- `supplier`: Many-to-one with Supplier
- `created_by_user`: Many-to-one with User
- `approved_by_user`: Many-to-one with User
- `items`: One-to-many with PurchaseReturnItem

---

##### PurchaseReturnItem
Line items within a purchase return.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `return_id` (Integer, FK): Reference to PurchaseReturn
- `grn_item_id` (Integer, FK): Reference to GRNItem
- `material_id` (Integer, FK): Reference to Material
- `quantity` (Numeric 15,2): Return quantity
- `uom` (String 20): Unit of measure
- `reason` (Text): Return reason
- `created_at` (DateTime): Creation timestamp

**Relationships:**
- `purchase_return`: Many-to-one with PurchaseReturn
- `grn_item`: Many-to-one with GRNItem
- `material`: Many-to-one with Material

---

#### 6.2 API Endpoints

##### GET /api/purchasing/suppliers
List all suppliers with filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `supplier_type` (String): Filter by supplier type
- `is_active` (Boolean): Filter by active status
- `rating` (String): Filter by rating
- `search` (String): Search in company name

**Response:**
```json
{
  "suppliers": [
    {
      "id": 1,
      "code": "SUP-001",
      "company_name": "PT Material Supplier",
      "contact_person": "John Doe",
      "email": "john@material.com",
      "phone": "021-12345678",
      "city": "Jakarta",
      "country": "Indonesia",
      "payment_terms_days": 30,
      "credit_limit": 500000000,
      "supplier_type": "manufacturer",
      "rating": "A",
      "lead_time_days": 7,
      "is_active": true,
      "total_po": 50,
      "total_purchased": 2000000000
    }
  ],
  "total": 30,
  "pages": 1
}
```

---

##### POST /api/purchasing/suppliers
Create new supplier.

**Request Body:**
```json
{
  "code": "SUP-002",
  "company_name": "PT Packaging Supplier",
  "contact_person": "Jane Smith",
  "email": "jane@packaging.com",
  "phone": "021-87654321",
  "address": "Jl. Industri No. 456",
  "city": "Surabaya",
  "state": "Jawa Timur",
  "country": "Indonesia",
  "postal_code": "60111",
  "payment_terms_days": 45,
  "credit_limit": 300000000,
  "supplier_type": "distributor",
  "rating": "B",
  "lead_time_days": 10,
  "notes": "New supplier for packaging materials"
}
```

**Response:**
```json
{
  "message": "Supplier created successfully",
  "supplier": {
    "id": 2,
    "code": "SUP-002",
    "is_active": true,
    ...
  }
}
```

---

##### GET /api/purchasing/orders
List all purchase orders with filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `supplier_id` (Integer): Filter by supplier
- `status` (String): Filter by status
- `priority` (String): Filter by priority
- `from_date` (Date): Start date filter
- `to_date` (Date): End date filter

**Response:**
```json
{
  "purchase_orders": [
    {
      "id": 1,
      "po_number": "PO-20240421-001",
      "supplier_id": 1,
      "supplier_name": "PT Material Supplier",
      "order_date": "2024-04-21",
      "required_date": "2024-04-30",
      "expected_date": "2024-05-05",
      "status": "confirmed",
      "priority": "high",
      "subtotal": 450000000,
      "tax_amount": 45000000,
      "discount_amount": 0,
      "total_amount": 495000000,
      "item_count": 3,
      "received_quantity": 0
    }
  ],
  "total": 100,
  "pages": 2
}
```

---

##### POST /api/purchasing/orders
Create new purchase order.

**Request Body:**
```json
{
  "supplier_id": 1,
  "required_date": "2024-04-30",
  "priority": "high",
  "payment_terms": "Net 30",
  "payment_method": "bank_transfer",
  "delivery_address": "Jl. Pabrik No. 123",
  "shipping_method": "truck",
  "shipping_cost": 5000000,
  "items": [
    {
      "material_id": 1,
      "description": "Polyester 1.5DX38MM",
      "quantity": 10000,
      "uom": "KG",
      "unit_price": 45000,
      "discount_percent": 0,
      "tax_percent": 10,
      "required_date": "2024-04-30"
    }
  ],
  "notes": "Urgent material order"
}
```

**Response:**
```json
{
  "message": "Purchase order created successfully",
  "purchase_order": {
    "id": 1,
    "po_number": "PO-20240421-001",
    "status": "draft",
    "subtotal": 450000000,
    "tax_amount": 45000000,
    "total_amount": 495000000,
    "item_count": 1
  }
}
```

---

##### PUT /api/purchasing/orders/<id>/status
Update purchase order status.

**Request Body:**
```json
{
  "status": "sent",
  "notes": "PO sent to supplier"
}
```

**Response:**
```json
{
  "message": "Purchase order status updated successfully",
  "purchase_order": {
    "id": 1,
    "po_number": "PO-20240421-001",
    "status": "sent",
    ...
  }
}
```

---

##### POST /api/purchasing/grn
Create goods received note.

**Request Body:**
```json
{
  "po_id": 1,
  "received_date": "2024-04-25",
  "location_id": 1,
  "items": [
    {
      "po_item_id": 1,
      "material_id": 1,
      "received_quantity": 10000,
      "uom": "KG",
      "batch_number": "BATCH-2024-001",
      "supplier_batch": "SUP-BATCH-001",
      "production_date": "2024-04-20",
      "expiry_date": "2025-04-20"
    }
  ],
  "notes": "Material received in good condition"
}
```

**Response:**
```json
{
  "message": "GRN created successfully",
  "grn": {
    "id": 1,
    "grn_number": "GRN-20240425-001",
    "po_id": 1,
    "po_number": "PO-20240421-001",
    "status": "draft",
    "inspection_status": "pending",
    "item_count": 1
  },
  "inventory_update": {
    "status": "pending",
    "message": "Inventory will be updated after QC approval"
  }
}
```

---

##### PUT /api/purchasing/grn/<id>/approve
Approve GRN and update inventory.

**Request Body:**
```json
{
  "status": "approved",
  "inspection_status": "passed",
  "notes": "QC inspection passed"
}
```

**Response:**
```json
{
  "message": "GRN approved successfully",
  "grn": {
    "id": 1,
    "grn_number": "GRN-20240425-001",
    "status": "approved",
    "inspection_status": "passed"
  },
  "inventory_movements": [
    {
      "material_id": 1,
      "quantity": 10000,
      "movement_type": "IN",
      "location_code": "RAW-A-01-01"
    }
  ]
}
```

---

##### GET /api/purchasing/invoices
List all purchase invoices with filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `supplier_id` (Integer): Filter by supplier
- `status` (String): Filter by status
- `from_date` (Date): Start date filter
- `to_date` (Date): End date filter

**Response:**
```json
{
  "invoices": [
    {
      "id": 1,
      "invoice_number": "PINV-20240425-001",
      "po_id": 1,
      "po_number": "PO-20240421-001",
      "supplier_id": 1,
      "supplier_name": "PT Material Supplier",
      "invoice_date": "2024-04-25",
      "due_date": "2024-05-25",
      "status": "received",
      "subtotal": 450000000,
      "tax_amount": 45000000,
      "total_amount": 495000000,
      "paid_amount": 0,
      "balance_due": 495000000
    }
  ],
  "total": 50,
  "pages": 1
}
```

---

##### POST /api/purchasing/invoices
Create purchase invoice.

**Request Body:**
```json
{
  "po_id": 1,
  "invoice_number": "PINV-20240425-001",
  "invoice_date": "2024-04-25",
  "due_date": "2024-05-25",
  "items": [
    {
      "material_id": 1,
      "description": "Polyester 1.5DX38MM",
      "quantity": 10000,
      "uom": "KG",
      "unit_price": 45000,
      "tax_percent": 10
    }
  ],
  "notes": "Invoice from supplier"
}
```

**Response:**
```json
{
  "message": "Purchase invoice created successfully",
  "invoice": {
    "id": 1,
    "invoice_number": "PINV-20240425-001",
    "status": "draft",
    "total_amount": 495000000
  }
}
```

---

##### POST /api/purchasing/returns
Create purchase return.

**Request Body:**
```json
{
  "po_id": 1,
  "grn_id": 1,
  "supplier_id": 1,
  "return_type": "defective",
  "reason": "Material quality issue",
  "items": [
    {
      "grn_item_id": 1,
      "material_id": 1,
      "quantity": 100,
      "uom": "KG",
      "reason": "Defective material"
    }
  ],
  "notes": "Return due to quality issue"
}
```

**Response:**
```json
{
  "message": "Purchase return created successfully",
  "return": {
    "id": 1,
    "return_number": "PR-20240425-001",
    "status": "draft",
    "item_count": 1
  }
}
```

---

#### 6.3 Workflows

##### Purchase Order Creation Workflow
1. **Requisition:** User creates purchase requisition
2. **Supplier Selection:** Select appropriate supplier
3. **PO Creation:** Create purchase order with items
4. **Approval:** Manager approves purchase order
5. **Send to Supplier:** PO sent to supplier
6. **Supplier Confirmation:** Supplier confirms PO
7. **PO Status Updated:** PO status updated to confirmed

##### Goods Receipt Workflow
1. **Delivery:** Supplier delivers materials
2. **GRN Creation:** Create GRN with received quantities
3. **QC Inspection:** Quality team inspects materials
4. **Inspection Result:** Pass or fail
5. **Inventory Update:** If pass, add to inventory
6. **PO Update:** Update PO with received quantities
7. **Invoice Matching:** Match with supplier invoice

##### Purchase Return Workflow
1. **Issue Identification:** Defective or excess material identified
2. **Return Request:** Create purchase return
3. **Approval:** Manager approves return
4. **Supplier Notification:** Notify supplier
5. **Material Return:** Return material to supplier
6. **Credit Note:** Supplier issues credit note
7. **Inventory Update:** Deduct from inventory

##### Purchase Invoice Processing Workflow
1. **Invoice Received:** Supplier invoice received
2. **Create Invoice:** Create purchase invoice record
3. **Match with PO:** Match invoice items with PO items
4. **Match with GRN:** Match invoice with GRN
4. **Approval:** Finance manager approves invoice
5. **Pending Journal Entry:** Create PendingJournalEntry for finance
6. **Finance Approval:** Finance manager approves journal entry
7. **Payment:** Process payment to supplier

---

#### 6.4 Use Cases

**Use Case 1: Create Purchase Order**
- Purchasing needs materials for production
- Selects supplier from approved list
- Creates purchase order with items
- Manager approves PO
- PO sent to supplier
- Supplier confirms PO

**Use Case 2: Receive Materials**
- Supplier delivers materials
- Warehouse creates GRN
- QC team inspects materials
- If pass: Materials added to inventory
- If fail: Return to supplier

**Use Case 3: Process Purchase Invoice**
- Supplier invoice received
- Match invoice with PO and GRN
- Finance approves invoice
- Pending journal entry created
- Finance approves journal entry
- Payment processed

**Use Case 4: Return Defective Materials**
- Quality issue identified
- Create purchase return
- Manager approves return
- Material returned to supplier
- Credit note received
- Inventory updated

---

#### 6.5 Business Logic

**Purchase Order Total Calculation:**
```
For each item:
  Line total = quantity × unit_price
  Discount amount = line total × (discount_percent / 100)
  Tax amount = (line total - discount) × (tax_percent / 100)
  Item total = line total - discount + tax

Subtotal = Sum of all item totals
Shipping cost = Shipping cost
Tax amount = Subtotal × tax_rate
Discount amount = Subtotal × discount_percent
Total amount = Subtotal + shipping cost + tax - discount
```

**GRN Inventory Update:**
```
When GRN approved:
  For each GRN item:
    Create Inventory record:
      material_id = item.material_id
      location_id = GRN.location_id
      quantity_on_hand = item.received_quantity
      quantity_available = item.received_quantity
      batch_number = item.batch_number
      supplier_batch = item.supplier_batch
      stock_status = 'available' (if QC passed)
    Create InventoryMovement:
      movement_type = 'IN'
      quantity = item.received_quantity
      reference_type = 'grn'
      reference_number = GRN.grn_number
```

**Supplier Credit Limit Check:**
```
For supplier:
  Calculate current outstanding balance
  Check if (outstanding + new PO) <= credit_limit
  If exceeds: Block PO or require approval
```

**Purchase Return Inventory Deduction:**
```
When purchase return approved:
  For each return item:
    Find Inventory record with batch_number
    Deduct quantity from quantity_on_hand
    Deduct quantity from quantity_available
    Create InventoryMovement:
      movement_type = 'OUT'
      quantity = return quantity
      reference_type = 'purchase_return'
      reference_number = PurchaseReturn.return_number
```

**Pending Journal Entry Creation:**
```
When purchase invoice approved:
  Create PendingJournalEntry with:
    Debit Material Inventory: Subtotal
    Debit Tax Payable: Tax amount
    Credit Accounts Payable: Total amount
  Send to approval workflow
  Finance manager approves
  Journal entry posted to GL
```

---

### 7. Sales Module

**Purpose:** Manage sales orders, customer relationships, lead management, and sales pipeline with finance integration

---

#### 7.1 Data Models

##### Lead
Potential customers in the sales pipeline.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `lead_number` (String 50): Unique lead number (e.g., "LD-20240421-001")
- `company_name` (String 255): Company name
- `contact_person` (String 200): Contact person name
- `job_title` (String 100): Job title
- `email` (String 120): Email address
- `phone` (String 50): Phone number
- `mobile` (String 50): Mobile number
- `website` (String 200): Website URL
- `address` (Text): Address
- `city` (String 100): City
- `state` (String 100): State
- `country` (String 100): Country
- `postal_code` (String 20): Postal code

**Lead Information:**
- `lead_source` (String 50): Lead source - `website`, `referral`, `cold_call`, `social_media`, `trade_show`, `advertisement`
- `lead_status` (String 50): Lead status - `new`, `contacted`, `qualified`, `converted`, `lost`
- `lead_score` (Integer): Lead score (0-100)
- `industry` (String 100): Industry
- `company_size` (String 50): Company size - `startup`, `small`, `medium`, `large`, `enterprise`
- `annual_revenue` (Numeric 15,2): Annual revenue
- `budget` (Numeric 15,2): Budget
- `decision_maker` (Boolean): Is decision maker
- `purchase_timeline` (String 50): Purchase timeline - `immediate`, `1_month`, `3_months`, `6_months`, `1_year`

**Assignment & Tracking:**
- `assigned_to` (Integer, FK): Assigned user
- `converted_to_customer_id` (Integer, FK): Converted customer
- `converted_at` (DateTime): Conversion date
- `last_contacted` (DateTime): Last contact date
- `next_followup` (DateTime): Next follow-up date
- `notes` (Text): Notes
- `created_by` (Integer, FK): User who created lead
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `assigned_user`: Many-to-one with User
- `created_by_user`: Many-to-one with User
- `converted_customer`: Many-to-one with Customer
- `opportunities`: One-to-many with Opportunity
- `activities`: One-to-many with SalesActivity

---

##### SalesPipeline
Sales pipeline for opportunity tracking.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `name` (String 100): Pipeline name
- `description` (Text): Description
- `is_default` (Boolean): Default pipeline flag
- `is_active` (Boolean): Active status
- `created_at` (DateTime): Creation timestamp

**Relationships:**
- `stages`: One-to-many with PipelineStage
- `opportunities`: One-to-many with Opportunity

---

##### PipelineStage
Stages within a sales pipeline.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `pipeline_id` (Integer, FK): Reference to SalesPipeline
- `name` (String 100): Stage name
- `description` (Text): Description
- `order` (Integer): Stage order
- `probability` (Integer): Win probability (0-100%)
- `is_closed_won` (Boolean): Closed won flag
- `is_closed_lost` (Boolean): Closed lost flag
- `color_code` (String 7): Hex color code

**Relationships:**
- `pipeline`: Many-to-one with SalesPipeline
- `opportunities`: One-to-many with Opportunity

---

##### Opportunity
Sales opportunities in the pipeline.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `opportunity_number` (String 50): Unique opportunity number
- `name` (String 255): Opportunity name
- `lead_id` (Integer, FK): Reference to Lead
- `pipeline_id` (Integer, FK): Reference to SalesPipeline
- `stage_id` (Integer, FK): Reference to PipelineStage
- `customer_id` (Integer, FK): Reference to Customer
- `opportunity_value` (Numeric 15,2): Opportunity value
- `currency` (String 10): Currency (default: IDR)
- `probability` (Integer): Win probability (%)
- `expected_close_date` (Date): Expected close date
- `actual_close_date` (Date): Actual close date
- `opportunity_status` (String 50): Status - `open`, `won`, `lost`
- `lost_reason` (String 200): Lost reason
- `notes` (Text): Notes
- `created_by` (Integer, FK): User who created opportunity
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `lead`: Many-to-one with Lead
- `pipeline`: Many-to-one with SalesPipeline
- `stage`: Many-to-one with PipelineStage
- `customer`: Many-to-one with Customer
- `created_by_user`: Many-to-one with User

---

##### Customer
Customer master data.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `customer_code` (String 50): Unique customer code (e.g., "CUST-001")
- `company_name` (String 255): Company name
- `contact_person` (String 200): Contact person name
- `email` (String 120): Email address
- `phone` (String 50): Phone number
- `mobile` (String 50): Mobile number
- `fax` (String 50): Fax number
- `website` (String 200): Website URL
- `tax_id` (String 100): Tax ID
- `address` (Text): Address
- `city` (String 100): City
- `state` (String 100): State
- `country` (String 100): Country
- `postal_code` (String 20): Postal code
- `payment_terms_days` (Integer): Payment terms in days (default: 30)
- `credit_limit` (Numeric 15,2): Credit limit
- `is_active` (Boolean): Active status
- `customer_type` (String 50): Customer type - `distributor`, `retailer`, `wholesale`, `end_user`
- `rating` (String 20): Customer rating - `A`, `B`, `C`
- `notes` (Text): Notes
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `sales_orders`: One-to-many with SalesOrder
- `invoices`: One-to-many with Invoice
- `payments`: One-to-many with Payment

---

##### SalesOrder
Sales orders for customer orders.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `so_number` (String 100): Unique sales order number (e.g., "SO-20240421-001")
- `customer_id` (Integer, FK): Reference to Customer
- `opportunity_id` (Integer, FK): Reference to Opportunity
- `order_date` (Date): Order date
- `required_date` (Date): Required delivery date
- `delivery_date` (Date): Actual delivery date
- `status` (String 50): Status - `draft`, `confirmed`, `in_production`, `shipped`, `delivered`, `cancelled`
- `priority` (String 20): Priority - `low`, `normal`, `high`, `urgent`
- `payment_terms` (String 100): Payment terms
- `payment_method` (String 50): Payment method
- `delivery_address` (Text): Delivery address
- `shipping_method` (String 100): Shipping method
- `shipping_cost` (Numeric 15,2): Shipping cost
- `subtotal` (Numeric 15,2): Subtotal
- `tax_amount` (Numeric 15,2): Tax amount
- `discount_amount` (Numeric 15,2): Discount amount
- `total_amount` (Numeric 15,2): Total amount
- `paid_amount` (Numeric 15,2): Paid amount
- `balance_due` (Numeric 15,2): Balance due
- `notes` (Text): Notes
- `internal_notes` (Text): Internal notes
- `created_by` (Integer, FK): User who created sales order
- `approved_by` (Integer, FK): User who approved sales order
- `approved_at` (DateTime): Approval timestamp
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `customer`: Many-to-one with Customer
- `opportunity`: Many-to-one with Opportunity
- `items`: One-to-many with SalesOrderItem
- `shipping_orders`: One-to-many with ShippingOrder
- `invoices`: One-to-many with Invoice
- `created_by_user`: Many-to-one with User
- `approved_by_user`: Many-to-one with User

---

##### SalesOrderItem
Line items within a sales order.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `so_id` (Integer, FK): Reference to SalesOrder
- `line_number` (Integer): Line sequence number
- `product_id` (Integer, FK): Reference to Product
- `description` (Text): Description
- `quantity` (Numeric 15,2): Quantity
- `uom` (String 20): Unit of measure
- `unit_price` (Numeric 15,2): Unit price
- `discount_percent` (Numeric 5,2): Discount percentage
- `discount_amount` (Numeric 15,2): Discount amount
- `tax_percent` (Numeric 5,2): Tax percentage
- `tax_amount` (Numeric 15,2): Tax amount
- `total_amount` (Numeric 15,2): Total amount
- `quantity_shipped` (Numeric 15,2): Quantity shipped
- `quantity_invoiced` (Numeric 15,2): Quantity invoiced
- `required_date` (Date): Required date
- `notes` (Text): Notes
- `created_at` (DateTime): Creation timestamp

**Relationships:**
- `sales_order`: Many-to-one with SalesOrder
- `product`: Many-to-one with Product

**Constraints:**
- Unique constraint on (so_id, line_number)

---

##### SalesActivity
Sales activity tracking for leads and opportunities.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `lead_id` (Integer, FK): Reference to Lead
- `opportunity_id` (Integer, FK): Reference to Opportunity
- `activity_type` (String 50): Activity type - `call`, `email`, `meeting`, `demo`, `follow_up`
- `activity_date` (DateTime): Activity date
- `duration_minutes` (Integer): Duration in minutes
- `subject` (String 255): Subject
- `notes` (Text): Notes
- `outcome` (String 200): Outcome
- `next_action` (String 200): Next action
- `next_action_date` (DateTime): Next action date
- `created_by` (Integer, FK): User who created activity
- `created_at` (DateTime): Creation timestamp

**Relationships:**
- `lead`: Many-to-one with Lead
- `opportunity`: Many-to-one with Opportunity
- `created_by_user`: Many-to-one with User

---

#### 7.2 API Endpoints

##### GET /api/sales/leads
List all leads with filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `lead_status` (String): Filter by lead status
- `lead_source` (String): Filter by lead source
- `assigned_to` (Integer): Filter by assigned user

**Response:**
```json
{
  "leads": [
    {
      "id": 1,
      "lead_number": "LD-20240421-001",
      "company_name": "PT ABC Corporation",
      "contact_person": "John Doe",
      "email": "john@abc.com",
      "phone": "021-12345678",
      "lead_source": "website",
      "lead_status": "qualified",
      "lead_score": 75,
      "industry": "Manufacturing",
      "company_size": "medium",
      "assigned_to": "Sales Rep 1",
      "last_contacted": "2024-04-20T10:00:00",
      "next_followup": "2024-04-25T10:00:00"
    }
  ],
  "total": 50,
  "pages": 1
}
```

---

##### POST /api/sales/leads
Create new lead.

**Request Body:**
```json
{
  "company_name": "PT XYZ Corporation",
  "contact_person": "Jane Smith",
  "email": "jane@xyz.com",
  "phone": "021-87654321",
  "lead_source": "referral",
  "industry": "Distribution",
  "company_size": "large",
  "budget": 500000000,
  "purchase_timeline": "3_months",
  "assigned_to": 5,
  "notes": "Potential customer from industry event"
}
```

**Response:**
```json
{
  "message": "Lead created successfully",
  "lead": {
    "id": 2,
    "lead_number": "LD-20240421-002",
    "lead_status": "new",
    "lead_score": 0,
    ...
  }
}
```

---

##### GET /api/sales/opportunities
List all opportunities with filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `pipeline_id` (Integer): Filter by pipeline
- `stage_id` (Integer): Filter by stage
- `opportunity_status` (String): Filter by status

**Response:**
```json
{
  "opportunities": [
    {
      "id": 1,
      "opportunity_number": "OPP-20240421-001",
      "name": "Annual Supply Contract",
      "lead_id": 1,
      "lead_company": "PT ABC Corporation",
      "pipeline_id": 1,
      "pipeline_name": "Standard Pipeline",
      "stage_id": 3,
      "stage_name": "Negotiation",
      "customer_id": 1,
      "opportunity_value": 500000000,
      "currency": "IDR",
      "probability": 70,
      "expected_close_date": "2024-05-30",
      "opportunity_status": "open"
    }
  ],
  "total": 30,
  "pages": 1
}
```

---

##### POST /api/sales/opportunities
Create new opportunity.

**Request Body:**
```json
{
  "lead_id": 1,
  "pipeline_id": 1,
  "stage_id": 1,
  "name": "Annual Supply Contract",
  "opportunity_value": 500000000,
  "currency": "IDR",
  "probability": 50,
  "expected_close_date": "2024-05-30",
  "notes": "Opportunity from qualified lead"
}
```

**Response:**
```json
{
  "message": "Opportunity created successfully",
  "opportunity": {
    "id": 1,
    "opportunity_number": "OPP-20240421-001",
    "opportunity_status": "open",
    ...
  }
}
```

---

##### GET /api/sales/customers
List all customers with filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `customer_type` (String): Filter by customer type
- `is_active` (Boolean): Filter by active status
- `search` (String): Search in company name

**Response:**
```json
{
  "customers": [
    {
      "id": 1,
      "customer_code": "CUST-001",
      "company_name": "PT ABC Corporation",
      "contact_person": "John Doe",
      "email": "john@abc.com",
      "phone": "021-12345678",
      "city": "Jakarta",
      "country": "Indonesia",
      "payment_terms_days": 30,
      "credit_limit": 100000000,
      "customer_type": "distributor",
      "rating": "A",
      "is_active": true,
      "total_orders": 50,
      "total_purchased": 1500000000
    }
  ],
  "total": 100,
  "pages": 2
}
```

---

##### POST /api/sales/customers
Create new customer.

**Request Body:**
```json
{
  "customer_code": "CUST-002",
  "company_name": "PT XYZ Corporation",
  "contact_person": "Jane Smith",
  "email": "jane@xyz.com",
  "phone": "021-87654321",
  "address": "Jl. Sudirman No. 123",
  "city": "Jakarta",
  "state": "DKI Jakarta",
  "country": "Indonesia",
  "postal_code": "12190",
  "payment_terms_days": 45,
  "credit_limit": 200000000,
  "customer_type": "retailer",
  "notes": "New customer from referral"
}
```

**Response:**
```json
{
  "message": "Customer created successfully",
  "customer": {
    "id": 2,
    "customer_code": "CUST-002",
    "is_active": true,
    ...
  }
}
```

---

##### GET /api/sales/orders
List all sales orders with filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `customer_id` (Integer): Filter by customer
- `status` (String): Filter by status
- `from_date` (Date): Start date filter
- `to_date` (Date): End date filter

**Response:**
```json
{
  "sales_orders": [
    {
      "id": 1,
      "so_number": "SO-20240421-001",
      "customer_id": 1,
      "customer_name": "PT ABC Corporation",
      "order_date": "2024-04-21",
      "required_date": "2024-05-15",
      "status": "confirmed",
      "priority": "high",
      "subtotal": 450000000,
      "tax_amount": 45000000,
      "discount_amount": 0,
      "total_amount": 495000000,
      "paid_amount": 0,
      "balance_due": 495000000,
      "item_count": 3
    }
  ],
  "total": 200,
  "pages": 4
}
```

---

##### POST /api/sales/orders
Create new sales order.

**Request Body:**
```json
{
  "customer_id": 1,
  "opportunity_id": 1,
  "required_date": "2024-05-15",
  "priority": "high",
  "payment_terms": "Net 30",
  "payment_method": "bank_transfer",
  "delivery_address": "Jl. Sudirman No. 123, Jakarta",
  "shipping_method": "truck",
  "shipping_cost": 5000000,
  "items": [
    {
      "product_id": 1,
      "description": "Wetkins Baby Blue 5S @384",
      "quantity": 10000,
      "uom": "pcs",
      "unit_price": 45000,
      "discount_percent": 0,
      "tax_percent": 10
    }
  ],
  "notes": "Urgent order for customer"
}
```

**Response:**
```json
{
  "message": "Sales order created successfully",
  "sales_order": {
    "id": 1,
    "so_number": "SO-20240421-001",
    "status": "draft",
    "subtotal": 450000000,
    "tax_amount": 45000000,
    "total_amount": 495000000,
    "item_count": 1
  },
  "inventory_check": {
    "available": true,
    "items": [
      {
        "product_id": 1,
        "required_quantity": 10000,
        "available_quantity": 15000,
        "status": "available"
      }
    ]
  }
}
```

---

##### PUT /api/sales/orders/<id>/status
Update sales order status.

**Request Body:**
```json
{
  "status": "confirmed",
  "notes": "Order confirmed by customer"
}
```

**Response:**
```json
{
  "message": "Sales order status updated successfully",
  "sales_order": {
    "id": 1,
    "so_number": "SO-20240421-001",
    "status": "confirmed",
    ...
  }
}
```

---

#### 7.3 Workflows

##### Lead to Customer Conversion Workflow
1. **Lead Creation:** Sales creates new lead from various sources
2. **Lead Qualification:** Sales team contacts and qualifies lead
3. **Opportunity Creation:** Qualified lead converted to opportunity
4. **Pipeline Stages:** Opportunity moves through pipeline stages
5. **Customer Creation:** Opportunity won, customer account created
6. **Lead Conversion:** Lead marked as converted

##### Sales Order Creation Workflow
1. **Order Received:** Customer places order
2. **Inventory Check:** System checks inventory availability
3. **MRP Check:** System checks MRP for material availability (partial)
4. **Sales Order Created:** Sales order created with items
5. **Approval:** Manager approves sales order
6. **Pending Journal Entry:** PendingJournalEntry created for finance integration
7. **Finance Approval:** Finance manager approves journal entry
8. **Order Confirmed:** Sales order status updated to confirmed

##### Sales Order Fulfillment Workflow
1. **Production Planning:** Sales order sent to production planning
2. **Work Order Creation:** Work order created for production
3. **Production Execution:** Production manufactures products
4. **Finished Goods Receipt:** Finished goods received in inventory
5. **Shipping Order Created:** Shipping order created for delivery
6. **Delivery:** Products delivered to customer
7. **Invoice Generation:** Invoice generated for customer
8. **Payment Collection:** Payment collected from customer

---

#### 7.4 Use Cases

**Use Case 1: Lead Management**
- Sales team captures lead from website form
- Lead assigned to sales representative
- Sales rep contacts lead via phone/email
- Lead qualified and converted to opportunity
- Opportunity moves through sales pipeline
- Opportunity won, customer account created

**Use Case 2: Create Sales Order**
- Customer places order for products
- Sales creates sales order with items
- System checks inventory availability
- Sales order sent for approval
- Manager approves sales order
- Pending journal entry created for finance
- Finance manager approves journal entry

**Use Case 3: Inventory Availability Check**
- Sales order created for products
- System checks inventory availability
- If insufficient: Alert sales team
- If sufficient: Proceed with order
- Stock reserved for sales order

**Use Case 4: Sales Order Fulfillment**
- Sales order confirmed
- Production planning creates work order
- Production manufactures products
- Finished goods received in inventory
- Shipping order created for delivery
- Products delivered to customer
- Invoice generated and sent

---

#### 7.5 Business Logic

**Lead Scoring:**
```
Lead score calculated based on:
- Company size (larger = higher score)
- Annual revenue (higher = higher score)
- Budget (higher = higher score)
- Decision maker (yes = higher score)
- Purchase timeline (sooner = higher score)
- Industry fit (relevant industry = higher score)
```

**Opportunity Probability:**
```
Stage probability overrides manual probability
Pipeline stages have default probabilities
Sales rep can adjust based on situation
```

**Sales Order Total Calculation:**
```
For each item:
  Line total = quantity × unit_price
  Discount amount = line total × (discount_percent / 100)
  Tax amount = (line total - discount) × (tax_percent / 100)
  Item total = line total - discount + tax

Subtotal = Sum of all item totals
Shipping cost = Shipping cost
Tax amount = Subtotal × tax_rate
Discount amount = Subtotal × discount_percent
Total amount = Subtotal + shipping cost + tax - discount
```

**Credit Limit Check:**
```
For customer:
  Calculate current outstanding balance
  Check if (outstanding + new order) <= credit_limit
  If exceeds: Block order or require approval
```

**Inventory Availability Check:**
```
For each sales order item:
  Check quantity_available in inventory
  If available < required:
    Check if production can fulfill by required_date
    If cannot fulfill: Alert sales team
```

**Pending Journal Entry Creation:**
```
When sales order confirmed:
  Create PendingJournalEntry with:
    Debit Accounts Receivable: Total amount
    Credit Sales Revenue: Subtotal
    Credit Tax Payable: Tax amount
  Send to approval workflow
  Finance manager approves
  Journal entry posted to GL

---

### 8. WIP Accounting Module
**Purpose:** Track work-in-progress costs and job costing

**Features:**
- WIP batch tracking
- Job cost entry
- Stage movement tracking
- Auto-posting ke GL
- Cost variance analysis

**Key Models:**
- `WIPBatch`: WIP batches
- `JobCostEntry`: Job cost entries
- `WIPStageMovement`: Stage movements

**API Endpoints:**
- `GET /api/wip-accounting/batches` - List WIP batches
- `POST /api/wip-accounting/cost-entries` - Create cost entry
- `GET /api/wip-accounting/movements` - List stage movements

---

### 9. HR Module (Payroll)

**Purpose:** Manage HR operations, employee management, attendance tracking with face recognition, and payroll processing

---

#### 9.1 Data Models

##### Department
Organizational departments for employee assignment.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `code` (String 50): Unique department code (e.g., "DEPT-001")
- `name` (String 200): Department name
- `description` (Text): Description
- `manager_id` (Integer, FK): Department manager (Employee)
- `is_active` (Boolean): Active status
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `employees`: One-to-many with Employee
- `manager`: Many-to-one with Employee (self-referencing)

---

##### Employee
Employee master data.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `employee_number` (String 50): Unique employee number (e.g., "EMP-001")
- `nik` (String 50): National ID (NIK)
- `user_id` (Integer, FK): Reference to User (unique)
- `first_name` (String 100): First name
- `last_name` (String 100): Last name
- `full_name` (String 200): Full name
- `email` (String 120): Email address
- `phone` (String 50): Phone number
- `mobile` (String 50): Mobile number
- `date_of_birth` (Date): Date of birth
- `gender` (String 20): Gender
- `marital_status` (String 20): Marital status
- `address` (Text): Address
- `city` (String 100): City
- `postal_code` (String 20): Postal code
- `department_id` (Integer, FK): Reference to Department
- `position` (String 200): Position/Job title
- `employment_type` (String 50): Employment type - `permanent`, `contract`, `temporary`
- `pay_type` (String 50): Pay type - `fixed`, `monthly`, `weekly`, `daily`, `piecework`, `outsourcing`
- `pay_rate` (Numeric 15,2): Rate per unit (daily/weekly/piece rate)
- `outsourcing_vendor_id` (Integer, FK): Reference to OutsourcingVendor
- `hire_date` (Date): Hire date
- `termination_date` (Date): Termination date
- `status` (String 50): Status - `active`, `on_leave`, `terminated`
- `salary` (Numeric 15,2): Monthly salary (for fixed/monthly pay type)
- `npwp` (String 30): Tax ID (NPWP)
- `ptkp_status` (String 10): PTKP tax status - `TK/0`, `TK/1`, `TK/2`, `TK/3`, `K/0`, `K/1`, `K/2`, `K/3`
- `dependents` (Integer): Number of dependents (0-3)
- `has_allowance` (Boolean): Has position allowance flag
- `position_allowance_amount` (Numeric 15,2): Position allowance amount
- `transport_allowance_amount` (Numeric 15,2): Transport allowance amount
- `emergency_contact_name` (String 200): Emergency contact name
- `emergency_contact_phone` (String 50): Emergency contact phone
- `is_active` (Boolean): Active status
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `user`: Many-to-one with User
- `department`: Many-to-one with Department
- `attendances`: One-to-many with Attendance
- `leaves`: One-to-many with Leave
- `rosters`: One-to-many with EmployeeRoster
- `outsourcing_vendor`: Many-to-one with OutsourcingVendor

---

##### ShiftSchedule
Shift schedules for attendance tracking.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `name` (String 100): Shift name
- `shift_type` (String 50): Shift type - `morning`, `afternoon`, `night`, `rotating`
- `start_time` (Time): Shift start time
- `end_time` (Time): Shift end time
- `break_duration_minutes` (Integer): Break duration in minutes
- `is_active` (Boolean): Active status
- `color_code` (String 20): Color code for roster display
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `rosters`: One-to-many with EmployeeRoster

---

##### Attendance
Employee attendance records with face recognition and GPS verification.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `employee_id` (Integer, FK): Reference to Employee (nullable for user-based attendance)
- `user_id` (Integer, FK): Reference to User (for user-based attendance)
- `attendance_date` (Date): Attendance date
- `shift_id` (Integer, FK): Reference to ShiftSchedule
- `clock_in` (DateTime): Clock in timestamp
- `clock_out` (DateTime): Clock out timestamp
- `status` (String 50): Status - `present`, `absent`, `late`, `half_day`
- `worked_hours` (Numeric 5,2): Worked hours
- `overtime_hours` (Numeric 5,2): Overtime hours
- `late_hours` (Numeric 5,2): Late hours
- `notes` (Text): Notes

**Photo Verification Fields:**
- `photo_hash` (String 64): SHA-256 hash of photo
- `photo_size_bytes` (Integer): Original photo size
- `face_detected` (Boolean): Face detected flag
- `face_confidence` (Float): Face detection confidence (0-100)
- `face_count` (Integer): Number of faces detected

**GPS/Location Fields:**
- `clock_in_latitude` (Float): Clock in GPS latitude
- `clock_in_longitude` (Float): Clock in GPS longitude
- `clock_in_accuracy` (Float): GPS accuracy in meters
- `clock_in_distance` (Float): Distance from office in meters
- `clock_in_location_valid` (Boolean): Within allowed radius
- `clock_out_latitude` (Float): Clock out GPS latitude
- `clock_out_longitude` (Float): Clock out GPS longitude
- `clock_out_accuracy` (Float): GPS accuracy
- `clock_out_distance` (Float): Distance from office
- `clock_out_location_valid` (Boolean): Within allowed radius

**Staff Info (for public attendance):**
- `staff_jabatan` (String 100): Position/Jabatan
- `staff_departemen` (String 100): Department

**Device/Network Metadata:**
- `device_info` (String 500): User agent
- `ip_address` (String 45): IPv4/IPv6 address

**Verification Status:**
- `verification_status` (String 20): Verification status - `pending`, `verified`, `rejected`
- `verified_by` (Integer, FK): User who verified
- `verified_at` (DateTime): Verification timestamp
- `rejection_reason` (String 255): Rejection reason

**Timestamps:**
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `employee`: Many-to-one with Employee
- `shift`: Many-to-one with ShiftSchedule
- `user`: Many-to-one with User
- `verifier`: Many-to-one with User

**Indexes:**
- `idx_employee_date`: (employee_id, attendance_date)
- `idx_user_date`: (user_id, attendance_date)

---

##### Leave
Employee leave requests.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `leave_number` (String 100): Unique leave number
- `employee_id` (Integer, FK): Reference to Employee
- `leave_type` (String 50): Leave type - `annual`, `sick`, `personal`, `maternity`, `paternity`, `unpaid`
- `start_date` (Date): Start date
- `end_date` (Date): End date
- `total_days` (Numeric 5,2): Total leave days
- `reason` (Text): Reason for leave
- `status` (String 50): Status - `pending`, `approved`, `rejected`, `cancelled`
- `approved_by` (Integer, FK): User who approved
- `approved_at` (DateTime): Approval timestamp
- `notes` (Text): Notes
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `employee`: Many-to-one with Employee
- `approved_by_user`: Many-to-one with User

---

##### PayrollPeriod
Payroll period definitions.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `period_name` (String 100): Period name (e.g., "April 2024")
- `start_date` (Date): Period start date
- `end_date` (Date): Period end date
- `pay_date` (Date): Payment date
- `status` (String 50): Status - `draft`, `calculating`, `calculated`, `paid`, `cancelled`
- `created_by` (Integer, FK): User who created period
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `created_by_user`: Many-to-one with User
- `payroll_records`: One-to-many with PayrollRecord

---

##### PayrollRecord
Individual payroll records for employees.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `payroll_period_id` (Integer, FK): Reference to PayrollPeriod
- `employee_id` (Integer, FK): Reference to Employee
- `basic_salary` (Numeric 15,2): Basic salary
- `position_allowance` (Numeric 15,2): Position allowance
- `transport_allowance` (Numeric 15,2): Transport allowance
- `overtime_pay` (Numeric 15,2): Overtime pay
- `gross_salary` (Numeric 15,2): Gross salary
- `bpjs_kesehatan` (Numeric 15,2): BPJS Kesehatan deduction
- `bpjs_ketenagakerjaan` (Numeric 15,2): BPJS Ketenagakerjaan deduction
- `tax_withholding` (Numeric 15,2): Tax withholding (PPh 21)
- `total_deductions` (Numeric 15,2): Total deductions
- `net_salary` (Numeric 15,2): Net salary
- `worked_days` (Integer): Worked days
- `overtime_hours` (Numeric 5,2): Overtime hours
- `leave_days` (Integer): Leave days
- `status` (String 50): Status - `draft`, `calculated`, `paid`
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `payroll_period`: Many-to-one with PayrollPeriod
- `employee`: Many-to-one with Employee

---

##### EmployeeRoster
Employee shift roster assignments.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `employee_id` (Integer, FK): Reference to Employee
- `shift_id` (Integer, FK): Reference to ShiftSchedule
- `roster_date` (Date): Roster date
- `notes` (Text): Notes
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `employee`: Many-to-one with Employee
- `shift`: Many-to-one with ShiftSchedule

---

##### OutsourcingVendor
Outsourcing vendor management.

**Fields:**
- `id` (Integer, PK): Unique identifier
- `vendor_code` (String 50): Unique vendor code
- `vendor_name` (String 200): Vendor name
- `contact_person` (String 200): Contact person
- `email` (String 120): Email
- `phone` (String 50): Phone
- `address` (Text): Address
- `is_active` (Boolean): Active status
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

**Relationships:**
- `employees`: One-to-many with Employee

---

#### 9.2 API Endpoints

##### GET /api/hr/employees
List all employees with filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `department_id` (Integer): Filter by department
- `status` (String): Filter by status
- `employment_type` (String): Filter by employment type
- `search` (String): Search in name

**Response:**
```json
{
  "employees": [
    {
      "id": 1,
      "employee_number": "EMP-001",
      "nik": "3201234567890001",
      "full_name": "John Doe",
      "email": "john@company.com",
      "phone": "081234567890",
      "department_id": 1,
      "department_name": "Production",
      "position": "Operator",
      "employment_type": "permanent",
      "pay_type": "monthly",
      "salary": 5000000,
      "status": "active",
      "hire_date": "2020-01-15"
    }
  ],
  "total": 100,
  "pages": 2
}
```

---

##### POST /api/hr/employees
Create new employee.

**Request Body:**
```json
{
  "employee_number": "EMP-002",
  "nik": "3201234567890002",
  "first_name": "Jane",
  "last_name": "Smith",
  "full_name": "Jane Smith",
  "email": "jane@company.com",
  "phone": "081234567891",
  "date_of_birth": "1990-05-15",
  "gender": "female",
  "marital_status": "single",
  "department_id": 2,
  "position": "Quality Inspector",
  "employment_type": "permanent",
  "pay_type": "monthly",
  "salary": 6000000,
  "hire_date": "2024-04-21",
  "ptkp_status": "TK/0",
  "dependents": 0,
  "has_allowance": true,
  "position_allowance_amount": 500000,
  "transport_allowance_amount": 300000
}
```

**Response:**
```json
{
  "message": "Employee created successfully",
  "employee": {
    "id": 2,
    "employee_number": "EMP-002",
    "status": "active",
    ...
  }
}
```

---

##### GET /api/hr/attendance
List attendance records with filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `employee_id` (Integer): Filter by employee
- `user_id` (Integer): Filter by user
- `from_date` (Date): Start date filter
- `to_date` (Date): End date filter
- `status` (String): Filter by status

**Response:**
```json
{
  "attendances": [
    {
      "id": 1,
      "employee_id": 1,
      "employee_name": "John Doe",
      "attendance_date": "2024-04-21",
      "shift_id": 1,
      "shift_name": "Morning Shift",
      "clock_in": "2024-04-21T08:00:00",
      "clock_out": "2024-04-21T17:00:00",
      "status": "present",
      "worked_hours": 8.5,
      "overtime_hours": 0.5,
      "late_hours": 0,
      "face_detected": true,
      "face_confidence": 95.5,
      "clock_in_location_valid": true,
      "verification_status": "verified"
    }
  ],
  "total": 200,
  "pages": 4
}
```

---

##### POST /api/hr/attendance/clock-in
Clock in with face recognition and GPS verification.

**Request Body:**
```json
{
  "user_id": 5,
  "shift_id": 1,
  "photo_hash": "abc123...",
  "photo_size_bytes": 102400,
  "clock_in_latitude": -6.2088,
  "clock_in_longitude": 106.8456,
  "clock_in_accuracy": 10.5,
  "device_info": "Mozilla/5.0...",
  "ip_address": "192.168.1.100",
  "staff_jabatan": "Operator",
  "staff_departemen": "Production"
}
```

**Response:**
```json
{
  "message": "Clock in successful",
  "attendance": {
    "id": 1,
    "user_id": 5,
    "attendance_date": "2024-04-21",
    "clock_in": "2024-04-21T08:00:00",
    "status": "present",
    "face_detected": true,
    "face_confidence": 95.5,
    "clock_in_location_valid": true,
    "verification_status": "verified"
  }
}
```

---

##### POST /api/hr/attendance/clock-out
Clock out with GPS verification.

**Request Body:**
```json
{
  "attendance_id": 1,
  "clock_out_latitude": -6.2088,
  "clock_out_longitude": 106.8456,
  "clock_out_accuracy": 10.5,
  "device_info": "Mozilla/5.0...",
  "ip_address": "192.168.1.100"
}
```

**Response:**
```json
{
  "message": "Clock out successful",
  "attendance": {
    "id": 1,
    "clock_out": "2024-04-21T17:00:00",
    "worked_hours": 8.5,
    "overtime_hours": 0.5,
    "clock_out_location_valid": true
  }
}
```

---

##### GET /api/hr/leaves
List leave requests with filtering.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `employee_id` (Integer): Filter by employee
- `leave_type` (String): Filter by leave type
- `status` (String): Filter by status
- `from_date` (Date): Start date filter
- `to_date` (Date): End date filter

**Response:**
```json
{
  "leaves": [
    {
      "id": 1,
      "leave_number": "LV-20240421-001",
      "employee_id": 1,
      "employee_name": "John Doe",
      "leave_type": "annual",
      "start_date": "2024-05-01",
      "end_date": "2024-05-03",
      "total_days": 3,
      "reason": "Family vacation",
      "status": "pending"
    }
  ],
  "total": 50,
  "pages": 1
}
```

---

##### POST /api/hr/leaves
Create leave request.

**Request Body:**
```json
{
  "employee_id": 1,
  "leave_type": "annual",
  "start_date": "2024-05-01",
  "end_date": "2024-05-03",
  "reason": "Family vacation"
}
```

**Response:**
```json
{
  "message": "Leave request created successfully",
  "leave": {
    "id": 1,
    "leave_number": "LV-20240421-001",
    "total_days": 3,
    "status": "pending"
  }
}
```

---

##### PUT /api/hr/leaves/<id>/approve
Approve leave request.

**Request Body:**
```json
{
  "status": "approved",
  "notes": "Leave approved"
}
```

**Response:**
```json
{
  "message": "Leave request approved successfully",
  "leave": {
    "id": 1,
    "status": "approved",
    "approved_at": "2024-04-21T10:00:00"
  }
}
```

---

##### GET /api/hr/payroll-periods
List payroll periods.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `status` (String): Filter by status
- `from_date` (Date): Start date filter
- `to_date` (Date): End date filter

**Response:**
```json
{
  "payroll_periods": [
    {
      "id": 1,
      "period_name": "April 2024",
      "start_date": "2024-04-01",
      "end_date": "2024-04-30",
      "pay_date": "2024-05-05",
      "status": "calculated",
      "employee_count": 100,
      "total_gross_salary": 500000000,
      "total_net_salary": 450000000
    }
  ],
  "total": 12,
  "pages": 1
}
```

---

##### POST /api/hr/payroll-periods
Create payroll period.

**Request Body:**
```json
{
  "period_name": "May 2024",
  "start_date": "2024-05-01",
  "end_date": "2024-05-31",
  "pay_date": "2024-06-05"
}
```

**Response:**
```json
{
  "message": "Payroll period created successfully",
  "payroll_period": {
    "id": 2,
    "period_name": "May 2024",
    "status": "draft"
  }
}
```

---

##### POST /api/hr/payroll-periods/<id>/calculate
Calculate payroll for period.

**Response:**
```json
{
  "message": "Payroll calculation started",
  "payroll_period": {
    "id": 1,
    "status": "calculating"
  },
  "calculation_details": {
    "total_employees": 100,
    "calculated": 0,
    "remaining": 100
  }
}
```

---

##### GET /api/hr/payroll-records
List payroll records for a period.

**Query Parameters:**
- `page` (Integer, default: 1): Page number
- `per_page` (Integer, default: 50): Items per page
- `payroll_period_id` (Integer): Filter by payroll period
- `employee_id` (Integer): Filter by employee
- `status` (String): Filter by status

**Response:**
```json
{
  "payroll_records": [
    {
      "id": 1,
      "payroll_period_id": 1,
      "employee_id": 1,
      "employee_name": "John Doe",
      "basic_salary": 5000000,
      "position_allowance": 500000,
      "transport_allowance": 300000,
      "overtime_pay": 250000,
      "gross_salary": 6050000,
      "bpjs_kesehatan": 100000,
      "bpjs_ketenagakerjaan": 50000,
      "tax_withholding": 300000,
      "total_deductions": 450000,
      "net_salary": 5600000,
      "worked_days": 22,
      "overtime_hours": 5,
      "status": "calculated"
    }
  ],
  "total": 100,
  "pages": 2
}
```

---

#### 9.3 Workflows

##### Employee Onboarding Workflow
1. **Hiring:** HR receives hire approval
2. **Employee Creation:** Create employee record
3. **User Account:** Create user account for system access
4. **Department Assignment:** Assign to department
5. **Shift Assignment:** Assign to shift schedule
6. **Roster Assignment:** Add to roster
7. **Training:** Employee orientation and training

##### Attendance Workflow (Clock In)
1. **Clock In:** User initiates clock in
2. **Photo Capture:** Capture photo for face recognition
3. **Face Detection:** System detects face in photo
4. **Face Verification:** Verify face matches registered face
5. **GPS Validation:** Validate GPS location within office radius
6. **Shift Detection:** Detect assigned shift for date
7. **Attendance Record:** Create attendance record
8. **Verification Status:** Mark as pending or verified

##### Attendance Workflow (Clock Out)
1. **Clock Out:** User initiates clock out
2. **GPS Validation:** Validate GPS location
3. **Work Hours Calculation:** Calculate worked hours and overtime
4. **Late Calculation:** Calculate late hours
5. **Attendance Update:** Update attendance record
6. **Verification:** Mark as verified

##### Leave Request Workflow
1. **Request:** Employee submits leave request
2. **Balance Check:** System checks leave balance
3. **Manager Approval:** Manager reviews and approves/rejects
4. **Schedule Update:** Update roster for leave dates
5. **Attendance Update:** Mark as on leave in attendance
6. **Payroll Adjustment:** Adjust payroll calculation

##### Payroll Calculation Workflow
1. **Period Creation:** HR creates payroll period
2. **Attendance Aggregation:** Aggregate attendance data for period
3. **Work Hours Calculation:** Calculate total work hours per employee
4. **Overtime Calculation:** Calculate overtime hours and pay
5. **Allowance Calculation:** Calculate allowances (position, transport)
6. **Gross Salary:** Calculate gross salary
7. **Deductions Calculation:** Calculate BPJS and tax deductions
8. **Net Salary:** Calculate net salary
9. **Payroll Record:** Create payroll record per employee
10. **Review:** HR reviews and approves payroll
11. **Payment:** Process payment to employees

---

#### 9.4 Use Cases

**Use Case 1: Employee Onboarding**
- New employee hired
- HR creates employee record
- User account created for system access
- Assigned to department and position
- Shift schedule assigned
- Added to roster
- Employee orientation completed

**Use Case 2: Daily Attendance (Clock In)**
- Employee arrives at office
- Opens attendance app
- Captures photo for face recognition
- System verifies face
- GPS location validated
- Clock in recorded
- Attendance marked as present

**Use Case 3: Leave Request**
- Employee needs leave
- Submits leave request with dates
- System checks leave balance
- Manager reviews request
- Manager approves/rejects
- Roster updated
- Payroll adjusted

**Use Case 4: Monthly Payroll Processing**
- HR creates payroll period
- System calculates work hours from attendance
- Overtime calculated
- Allowances calculated
- Deductions calculated (BPJS, tax)
- Net salary calculated
- HR reviews payroll
- Payment processed

---

#### 9.5 Business Logic

**Work Hours Calculation:**
```
For each attendance record:
  If clock_in and clock_out present:
    work_hours = clock_out - clock_in - break_duration
    If work_hours > shift_duration:
      overtime_hours = work_hours - shift_duration
    If clock_in > shift_start:
      late_hours = clock_in - shift_start
```

**Overtime Pay Calculation:**
```
For hourly/daily pay type:
  overtime_pay = overtime_hours × overtime_rate × 1.5

For monthly pay type:
  hourly_rate = monthly_salary / (22 × 8)
  overtime_pay = overtime_hours × hourly_rate × 1.5
```

**Gross Salary Calculation:**
```
For monthly pay type:
  gross_salary = basic_salary + position_allowance + transport_allowance + overtime_pay

For daily pay type:
  gross_salary = (worked_days × daily_rate) + overtime_pay

For piecework:
  gross_salary = (pieces_produced × piece_rate) + overtime_pay
```

**BPJS Deductions:**
```
BPJS Kesehatan = gross_salary × 0.01 (1% employee share)
BPJS Ketenagakerjaan = gross_salary × 0.02 (2% employee share)
```

**Tax Withholding (PPh 21) Calculation:**
```
PTKP (Penghasilan Tidak Kena Pajak):
  TK/0: 54,000,000
  TK/1: 58,500,000
  TK/2: 63,000,000
  TK/3: 67,500,000
  K/0: 58,500,000
  K/1: 63,000,000
  K/2: 67,500,000
  K/3: 72,000,000

Taxable Income = gross_salary - BPJS - PTKP
If Taxable Income <= 0: Tax = 0
Else:
  Apply progressive tax brackets:
  0 - 60,000,000: 5%
  60,000,001 - 250,000,000: 15%
  250,000,001 - 500,000,000: 25%
  500,000,001 - 5,000,000,000: 30%
  > 5,000,000,000: 35%
```

**Net Salary Calculation:**
```
net_salary = gross_salary - bpjs_kesehatan - bpjs_ketenagakerjaan - tax_withholding
```

**Face Recognition Verification:**
```
On clock in:
  Capture photo
  Calculate SHA-256 hash
  Detect face using ML model
  Calculate confidence score (0-100)
  If confidence >= 80: Mark as verified
  Else: Mark as pending for manual verification
```

**GPS Location Validation:**
```
On clock in/out:
  Get GPS coordinates
  Calculate distance from office coordinates
  If distance <= allowed_radius: Mark as valid
  Else: Mark as invalid
```

---

### 10. R&D Module
**Purpose:** Manage research and development activities

**Features:**
- R&D project management
- Experiment tracking
- Material usage tracking
- Partial integration dengan warehouse
- R&D cost tracking

**Key Models:**
- `RDMaterial`: R&D materials
- `RDProject`: R&D projects
- `RDExperiment`: R&D experiments

**API Endpoints:**
- `GET /api/rd/materials` - List R&D materials
- `POST /api/rd/projects` - Create R&D project
- `GET /api/rd/experiments` - List experiments

---

### 11. Waste Module
**Purpose:** Track and manage production waste

**Features:**
- Waste record management
- Stock deduction for waste
- Waste categorization
- Integration dengan warehouse
- Waste analytics

**Key Models:**
- `WasteRecord`: Waste records
- `WasteCategory`: Waste categories

**API Endpoints:**
- `GET /api/waste/records` - List waste records
- `POST /api/waste/records` - Create waste record

---

### 12. Document Control (DCC) Module
**Purpose:** ISO 9001:2015 compliant document management

**Features:**
- Document control (QP-DCC-01)
- Quality records (QP-DCC-02)
- CAPA management (QP-DCC-03)
- Internal communication (QP-DCC-04)
- Approval workflow
- Full audit trail

**Key Models:**
- `DccDocument`: Controlled documents
- `QualityRecord`: Quality records
- `CAPA`: Corrective and preventive actions

**API Endpoints:**
- `GET /api/dcc/documents` - List documents
- `POST /api/dcc/documents` - Create document
- `GET /api/dcc/quality-records` - List quality records

---

### 13. Quality Module
**Purpose:** Manage quality control and inspection

**Features:**
- Quality inspection
- Non-conformance tracking
- Quality records
- Integration dengan production

**Key Models:**
- `QualityInspection`: Quality inspections
- `NonConformance`: Non-conformance records

**API Endpoints:**
- `GET /api/quality/inspections` - List inspections
- `POST /api/quality/inspections` - Create inspection

---

### 14. MRP Module
**Purpose:** Material Requirement Planning

**Features:**
- Material requirement calculation
- Forecasting
- Resource planning
- Integration dengan Sales dan Production

**Key Models:**
- `MRPForecast`: MRP forecasts
- `MRPResource`: Resource planning

**API Endpoints:**
- `GET /api/mrp/forecasts` - List forecasts
- `POST /api/mrp/calculate` - Calculate MRP

---

### 15. Converting Module
**Purpose:** Manage converting operations (pre-production preparation)

**Features:**
- Converting machine management
- Production tracking
- Separate dari main production (mesin persiapan)
- Integration dengan warehouse

**Key Models:**
- `ConvertingMachine`: Converting machines
- `ConvertingProduction`: Converting production records

**API Endpoints:**
- `GET /api/converting/production` - List converting production
- `POST /api/converting/production` - Create converting record

---

### 16. BOM Module
**Purpose:** Bill of Materials management

**Features:**
- BOM creation and management
- Multi-level BOM
- Custom BOM
- Integration dengan Production
- BOM cost calculation

**Key Models:**
- `BOM`: Bill of Materials
- `BOMItem`: BOM line items
- `CustomBOM`: Custom BOMs

**API Endpoints:**
- `GET /api/bom` - List BOMs
- `POST /api/bom` - Create BOM
- `GET /api/bom/<id>/items` - Get BOM items

---

### 17. Attendance Module
**Purpose:** Employee attendance tracking

**Features:**
- Attendance tracking
- Face recognition
- Shift management
- Integration dengan HR

**Key Models:**
- `Attendance`: Attendance records
- `StaffFace`: Face recognition data
- `Shift`: Shift definitions

**API Endpoints:**
- `GET /api/attendance` - List attendance
- `POST /api/attendance/clock-in` - Clock in
- `POST /api/attendance/clock-out` - Clock out

---

### 18. MBF Report Module
**Purpose:** Production reporting and analysis

**Features:**
- Production reporting
- Roll usage tracking
- Shift tracking
- Carton conversion
- Report generation

**Key Models:**
- `MBFReport`: MBF reports
- `MBFDailyDetail`: Daily details
- `MBFRollUsage`: Roll usage tracking

**API Endpoints:**
- `GET /api/mbf-reports` - List reports
- `POST /api/mbf-reports` - Create report
- `GET /api/mbf-reports/<id>/export` - Export report

---

## Note on Module Documentation

The following 6 modules have been documented with complete detail including:
- Full data model field specifications
- Complete API endpoints with request/response examples
- Detailed workflow explanations
- Use case scenarios
- Business logic calculations

**Completed Detailed Modules:**
1. **Warehouse Module** - Inventory management, stock movements, material receiving, stock opname
2. **Production Module** - Work orders, BOM, material issues, production recording, WIP tracking
3. **Finance & Accounting Module** - Journal entries, GL posting, financial reports, approval workflows
4. **Sales Module** - Lead management, sales pipeline, sales orders, customer management
5. **Purchasing Module** - Purchase orders, GRN, supplier management, purchase invoices, returns
6. **HR Module (Payroll)** - Employee management, attendance with face recognition, payroll calculation, leave management

The remaining 12 modules (4, 5, 8, 10-18) have been documented with:
- Purpose and features
- Key models
- API endpoints

**Remaining Overview Modules:**
4. Shipping Module
5. Maintenance Module
8. WIP Accounting Module
10. R&D Module
11. Waste Module
12. Document Control (DCC) Module
13. Quality Module
14. MRP Module
15. Converting Module
16. BOM Module
17. Attendance Module
18. MBF Report Module

The current documentation provides a comprehensive overview of the entire system with deep dive into the 6 most critical modules.

---

## API Documentation

### Authentication

All API endpoints (except auth endpoints) require JWT authentication.

**Login:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

**Response:**
```json
{
  "access_token": "jwt_token_here",
  "user": {
    "id": 1,
    "username": "your_username",
    "full_name": "Your Name",
    "role": "Admin"
  }
}
```

**Using the Token:**
```http
GET /api/warehouse/materials
Authorization: Bearer jwt_token_here
```

### Rate Limiting
- 300 requests per day
- 100 requests per hour
- Notification polling endpoints are exempt

### Error Handling

Standard error response format:
```json
{
  "error": "Error message here"
}
```

### API Endpoints by Module

See individual module sections above for specific endpoints.

---

## Database Schema

### Database Technology
- **Development:** SQLite
- **Production:** PostgreSQL (recommended)

### Key Tables

#### Inventory Tables
- `materials`: Material master data
- `inventory`: Current stock levels
- `inventory_movements`: Stock movement history
- `warehouse_locations`: Storage locations

#### Production Tables
- `work_orders`: Production work orders
- `boms`: Bill of Materials
- `bom_items`: BOM line items
- `production_inputs`: Production input records
- `wip_stock`: Work-in-Progress inventory

#### Finance Tables
- `accounting_entries`: Journal entries
- `accounting_entry_lines`: Journal entry lines
- `accounts`: Chart of accounts
- `pending_journal_entries`: Pending entries for approval

#### HR Tables
- `employees`: Employee master data
- `attendance`: Attendance records
- `payroll_periods`: Payroll periods
- `payroll_records`: Payroll records
- `staff_leave_requests`: Leave requests

### Migrations

Database migrations are managed using Alembic.

**Create new migration:**
```bash
cd backend
flask db migrate -m "description"
```

**Apply migrations:**
```bash
flask db upgrade
```

**Rollback migration:**
```bash
flask db downgrade
```

---

## Installation & Setup

### Prerequisites

- Python 3.12+
- Node.js 18+
- Git
- (Optional) PostgreSQL for production

### Backend Setup

```bash
# Clone repository
git clone <repository-url>
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Initialize database
flask db upgrade

# (Optional) Seed initial data
python seeds/seed_initial_data.py

# Run development server
python app.py
```

Backend will run on `http://localhost:5000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Run development server
npm run dev
```

Frontend will run on `http://localhost:3000`

---

## Deployment

### Docker Deployment

**Build and run with Docker Compose:**

```bash
# Production
docker-compose up -d

# Development
docker-compose -f docker-compose.dev.yml up -d
```

### Manual Deployment

**Backend (Production):**

```bash
# Use PostgreSQL
export DATABASE_URL=postgresql://user:password@localhost/dbname

# Run with production config
export FLASK_ENV=production
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

**Frontend (Production):**

```bash
# Build for production
npm run build

# Serve with nginx or similar
# Build output in dist/ directory
```

### Environment Variables

See `.env.example` for required environment variables.

**Key Variables:**
- `DATABASE_URL`: Database connection string
- `SECRET_KEY`: Flask secret key
- `JWT_SECRET_KEY`: JWT signing key
- `CORS_ORIGINS`: Allowed CORS origins
- `FRONTEND_URL`: Frontend URL
- `SENTRY_DSN`: Sentry DSN for error monitoring

---

## Configuration

### Backend Configuration (config.py)

```python
class Config:
    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Security
    SECRET_KEY = os.getenv('SECRET_KEY')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    
    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS').split(',')
    
    # Rate Limiting
    RATELIMIT_STORAGE_URL = os.getenv('REDIS_URL')
```

### Frontend Configuration

Frontend configuration is in `.env` file:
```
VITE_API_URL=http://localhost:5000/api
VITE_FRONTEND_URL=http://localhost:3000
```

---

## Security

### Authentication
- JWT-based authentication with Flask-JWT-Extended
- Access token expiration: 1 hour
- Refresh token support available
- Session management with activity tracking

### Authorization
- Role-Based Access Control (RBAC)
- 40+ roles defined
- 200+ granular permissions
- Route-level permission checks

### Security Features
- Password hashing with Bcrypt
- CORS protection
- Rate limiting
- Input validation
- SQL injection prevention (parameterized queries)
- XSS protection (React escapes by default)

### Monitoring
- Sentry integration for error tracking
- Audit trail for all user activities
- Security logging

---

## Development Guide

### Code Style

**Backend:**
- Follow PEP 8 guidelines
- Use meaningful variable names
- Add docstrings to functions
- Keep functions focused and small

**Frontend:**
- Follow TypeScript best practices
- Use functional components with hooks
- Use Redux Toolkit for state management
- Follow React best practices

### Adding New Features

1. **Backend:**
   - Create/update model in `models/`
   - Create/update route in `routes/`
   - Add business logic in `utils/` if needed
   - Create database migration if schema changes
   - Add tests in `tests/`

2. **Frontend:**
   - Create component in `components/` or `pages/`
   - Create API service in `services/`
   - Update Redux store if needed
   - Add routing if new page
   - Add tests

### Testing

**Backend:**
```bash
cd backend
pytest
```

**Frontend:**
```bash
cd frontend
npm run test
```

### Debugging

**Backend:**
- Use Flask debugger in development
- Check logs in console
- Use Sentry for production errors

**Frontend:**
- Use React DevTools
- Use Redux DevTools
- Check browser console for errors

---

## Troubleshooting

### Common Issues

**Database connection error:**
- Check DATABASE_URL in .env
- Ensure PostgreSQL is running (if using PostgreSQL)
- Run `flask db upgrade` to ensure migrations are applied

**CORS error:**
- Check CORS_ORIGINS in .env
- Ensure frontend URL is included in CORS_ORIGINS

**Authentication error:**
- Check JWT_SECRET_KEY in .env
- Ensure token is being sent in Authorization header
- Check token expiration

**Build error (frontend):**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version (should be 18+)

---

## Changelog

### Version 1.0.0 (April 21, 2026)
- Initial release
- 18+ modules implemented
- RBAC with 40+ roles and 200+ permissions
- ISO 9001:2015 compliant DCC module
- Real-time monitoring with Socket.IO
- Face recognition attendance
- Sentry error monitoring
- Docker deployment support

---

## Support

**Developer:** [Mochammad Bayu Adhie Nugroho]  
**Role:** Solo Developer  
**Education:** SMA Graduate (2013) - Self-taught Software Developer  
**Development Period:** 6 months (October 2025 - March 2026)

For questions or support, contact: [baymngrh@gmail.com]

---

## License

Proprietary - All rights reserved

---

**End of Documentation**
