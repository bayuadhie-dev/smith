# DOKUMENTASI KODE LENGKAP - SISTEM ERP

## Daftar Isi

1. [Arsitektur Sistem](#arsitektur-sistem)
2. [Backend - Python/Flask](#backend-python-flask)
   - [Models](#models)
   - [Routes](#routes)
   - [Utils](#utils)
   - [Middleware](#middleware)
   - [Seeds](#seeds)
3. [Frontend - React/TypeScript](#frontend-react-typescript)
   - [Components](#components)
   - [Pages](#pages)
   - [Services](#services)
   - [Hooks](#hooks)
   - [Contexts](#contexts)
4. [Integrasi dan API](#integrasi-dan-api)

---

## Arsitektur Sistem

Sistem ERP ini menggunakan arsitektur **Client-Server** dengan pemisahan jelas antara:

- **Backend**: Flask REST API (Python)
- **Frontend**: React SPA dengan TypeScript
- **Database**: SQLite (Development) / PostgreSQL (Production)
- **Real-time**: Socket.IO untuk komunikasi real-time

### Teknologi Stack

**Backend:**
- Flask 2.x
- SQLAlchemy (ORM)
- Flask-JWT-Extended (Authentication)
- Flask-SocketIO (WebSocket)
- Alembic (Migrasi Database)

**Frontend:**
- React 18
- TypeScript
- Redux Toolkit (State Management)
- React Router (Routing)
- Axios (HTTP Client)
- Tailwind CSS (Styling)

---

## BACKEND - Python/Flask

### 1. CORE FILES

#### 1.1 `app.py` - Application Factory

**Deskripsi**: File utama yang membuat dan mengkonfigurasi Flask application menggunakan Application Factory Pattern.

**Fungsi Utama**:

```python
def create_app(config_class=Config)
```
- **Tujuan**: Membuat instance Flask application dengan semua konfigurasi
- **Parameter**: `config_class` - Kelas konfigurasi (default: Config)
- **Return**: Flask app instance yang sudah dikonfigurasi
- **Fitur**:
  - Inisialisasi Database (SQLAlchemy)
  - JWT Authentication
  - Rate Limiting (5000 requests/hour)
  - CORS untuk LAN dan production
  - Sentry Error Monitoring
  - Swagger API Documentation
  - Security Headers (Talisman)
  - Audit Middleware
  - Socket.IO untuk real-time communication

```python
def create_initial_data(app)
```
- **Tujuan**: Membuat data awal (roles, permissions, admin user)
- **Parameter**: `app` - Flask app instance
- **Dijalankan**: Saat pertama kali setup sistem

**Blueprint yang Diregister**:
- Authentication (`/api/auth`)
- Products (`/api/products`)
- Warehouse (`/api/warehouse`)
- Sales (`/api/sales`)
- Purchasing (`/api/purchasing`)
- Production (`/api/production`)
- Finance (`/api/finance`)
- HR (`/api/hr`)
- Quality (`/api/quality`)
- Maintenance (`/api/maintenance`)
- R&D (`/api/rd`)
- Reports (`/api/reports`)
- Dashboard (`/api/dashboard`)
- Settings (`/api/settings`)
- Dan 50+ blueprint lainnya

**Endpoints Publik**:
- `GET /api/company/public` - Informasi company tanpa auth
- `GET /api/status` - Status sistem dan statistik
- `GET /uploads/chat/<filename>` - Serve uploaded files

---

#### 1.2 `config.py` - Configuration

**Deskripsi**: Konfigurasi aplikasi menggunakan environment variables.

**Class**: `Config`

**Atribut Penting**:

| Atribut | Default | Deskripsi |
|---------|---------|-----------|
| `TIMEZONE` | `Asia/Jakarta` | Zona waktu aplikasi (WIB, UTC+7) |
| `SECRET_KEY` | `dev-secret-key` | Flask secret key |
| `SQLALCHEMY_DATABASE_URI` | `sqlite:///erp_database.db` | Database connection string |
| `JWT_ACCESS_TOKEN_EXPIRES` | 2 jam | Durasi access token |
| `JWT_REFRESH_TOKEN_EXPIRES` | 30 hari | Durasi refresh token |
| `CORS_ORIGINS` | localhost + LAN IPs | Allowed origins untuk CORS |
| `ITEMS_PER_PAGE` | 50 | Default pagination |
| `MAX_CONTENT_LENGTH` | 16MB | Max upload file size |
| `MAIL_SERVER` | `smtp.gmail.com` | SMTP server untuk email |
| `GOOGLE_CLIENT_ID` | - | OAuth Google client ID |
| `FRONTEND_URL` | `http://localhost:3000` | URL frontend untuk links |

---

#### 1.3 `extensions.py` - Shared Extensions

**Deskripsi**: Shared extension instances untuk menghindari circular imports.

**Exports**:
- `socketio` - Flask-SocketIO instance untuk WebSocket communication

---

### 2. MODELS (Database Schema)

Semua model menggunakan SQLAlchemy ORM dan inherit dari `db.Model`.


#### 2.1 **User Management Models** (`models/user.py`)

**Model: User**
- **Tabel**: `users`
- **Deskripsi**: Model untuk user/karyawan yang dapat mengakses sistem

**Kolom Utama**:
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| id | Integer | Primary key |
| username | String(80) | Username unik untuk login |
| email | String(120) | Email unik |
| password_hash | String(255) | Bcrypt password hash |
| full_name | String(200) | Nama lengkap |
| phone | String(20) | Nomor telepon |
| department | String(100) | Departemen |
| position | String(100) | Posisi/jabatan |
| bio | Text | Biografi user |
| is_active | Boolean | Status aktif |
| is_admin | Boolean | Admin Produksi/Gudang |
| is_super_admin | Boolean | System Administrator |
| google_id | String(100) | ID untuk OAuth Google |
| reset_token | String(100) | Token reset password |

**Methods**:

```python
def set_password(password: str) -> None
```
- **Tujuan**: Set password menggunakan bcrypt hash
- **Parameter**: `password` - Plain text password
- **Return**: None
- **Note**: Selalu gunakan method ini untuk set password

```python
def check_password(password: str) -> bool
```
- **Tujuan**: Verifikasi password dengan hash tersimpan
- **Parameter**: `password` - Plain text password untuk dicek
- **Return**: True jika password benar, False jika salah
- **Note**: Mendukung legacy hash dan auto-migrate ke bcrypt

**Model: Role**
- **Tabel**: `roles`
- **Deskripsi**: Role untuk RBAC (Role-Based Access Control)
- **Relationships**: Many-to-Many dengan User via UserRole

**Model: Permission**
- **Tabel**: `permissions`
- **Deskripsi**: Permission granular untuk setiap resource dan action
- **Kolom**: resource, module, action (create/read/update/delete)

**Model: UserRole & RolePermission**
- Join tables untuk Many-to-Many relationships

---

#### 2.2 **Product Models** (`models/product.py`)

**Model: Material**
- **Tabel**: `materials`
- **Deskripsi**: Raw materials, packaging, chemicals, finished goods

**Kolom Utama**:
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| code | String(100) | Kode material unik |
| name | String(255) | Nama material |
| material_type | String(50) | raw_materials, packaging_materials, chemical_materials, finished_goods |
| category | String(100) | Kategori spesifik |
| primary_uom | String(20) | Unit utama (Kg, Meter, Liter) |
| cost_per_unit | Numeric(15,2) | Harga per unit |
| min_stock_level | Numeric(15,2) | Minimum stock level |
| reorder_point | Numeric(15,2) | Titik reorder |
| is_hazardous | Boolean | Material berbahaya atau tidak |
| expiry_days | Integer | Shelf life dalam hari |

**Model: Product**
- **Tabel**: `products`
- **Deskripsi**: Produk yang diproduksi/dijual (Wet Wipes, Dry Wipes, dll)

**Kolom Utama**:
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| code | String(100) | Kode produk unik |
| name | String(255) | Nama produk |
| category_id | Integer | FK ke ProductCategory |
| nonwoven_category | String(100) | Wet Tissue, Dry Tissue, dll |
| material_type | String(50) | finished_goods, raw_materials, dll |
| price | Numeric(15,2) | Harga jual |
| cost | Numeric(15,2) | Cost produksi |
| is_sellable | Boolean | Bisa dijual? |
| is_purchasable | Boolean | Bisa dibeli? |
| is_producible | Boolean | Bisa diproduksi? |

**Kolom Extended (dari products_new)**:
- `gramasi` (Float) - GSM (Grams per Square Meter)
- `cd`, `md` (Float) - Cross Direction, Machine Direction strength
- `sheet_per_pack`, `pack_per_karton` - Packaging configuration
- `ratio`, `ingredient`, `ukuran_batch_vol/ctn` - Batch calculation
- `spunlace`, `rayon`, `polyester`, `es` - Material composition (%)
- `slitting_cm`, `lebar_mr_net_cm`, `lebar_mr_gross_cm` - Slitting specs
- `no_mesin_epd`, `speed_epd_pack_menit` - EPD machine settings
- `meter_kain`, `kg_kain` - Fabric requirements
- `kebutuhan_rayon_kg`, `kebutuhan_polyester_kg`, `kebutuhan_es_kg` - Material needs
- `process_produksi` - Production process description
- `kode_jumbo_roll`, `kode_main_roll` - Roll codes
- `kapasitas_mixing_kg`, `actual_mixing_kg`, `dosing_kg` - Mixing parameters

**Methods**:
```python
def to_dict() -> dict
```
- **Tujuan**: Convert product ke dictionary untuk API response
- **Return**: Dict dengan semua fields (compatible dengan ProductNew format)

**Model: ProductSpecification**
- **Tabel**: `product_specifications`
- **Deskripsi**: Spesifikasi detail produk (GSM, width, length, color, dll)

**Model: ProductPackaging**
- **Tabel**: `product_packaging`
- **Deskripsi**: Informasi packaging produk
- **Kolom**: sheets_per_pack, packs_per_karton, dimensions, barcode, dll

---

#### 2.3 **Production Models** (`models/production.py`)

**Model: Machine**
- **Tabel**: `machines`
- **Deskripsi**: Mesin produksi (Nonwoven, Cutting, Packing)

**Kolom Utama**:
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| code | String(50) | Kode mesin unik (M001, M002, dll) |
| name | String(200) | Nama mesin |
| machine_type | String(100) | nonwoven_machine, cutting_machine, packing_machine |
| status | String(50) | idle, running, maintenance, breakdown, offline |
| capacity_per_hour | Numeric(15,2) | Kapasitas per jam |
| default_speed | Integer | Default speed pcs/menit |
| target_efficiency | Integer | Target efficiency % (default 60%) |
| efficiency | Numeric(5,2) | Current efficiency % |
| availability | Numeric(5,2) | Availability % |
| last_maintenance | Date | Tanggal maintenance terakhir |
| next_maintenance | Date | Tanggal maintenance berikutnya |

**Model: BillOfMaterials (BOM)**
- **Tabel**: `bill_of_materials`
- **Deskripsi**: Bill of Materials untuk produk

**Kolom Utama**:
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| bom_number | String(100) | Nomor BOM unik |
| product_id | Integer | FK ke Product |
| version | String(20) | Versi BOM (1.0, 1.1, dll) |
| batch_size | Numeric(15,2) | Ukuran batch produksi |
| batch_uom | String(20) | Unit batch (karton, kg, dll) |
| pack_per_carton | Integer | Jumlah pack per karton |
| is_active | Boolean | BOM aktif atau tidak |

**Properties**:
- `total_cost` - Total cost semua BOM items
- `total_materials` - Jumlah materials dalam BOM
- `critical_materials` - Jumlah critical materials

**Model: WorkOrder**
- **Tabel**: `work_orders`
- **Deskripsi**: Work Order untuk eksekusi produksi

**Kolom Utama**:
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| wo_number | String(100) | Nomor WO unik |
| product_id | Integer | Produk yang akan diproduksi |
| bom_id | Integer | BOM yang digunakan |
| quantity | Numeric(15,2) | Target quantity |
| status | String(50) | planned, released, in_progress, completed, cancelled |
| priority | String(20) | low, normal, high, urgent |
| machine_id | Integer | Mesin yang digunakan |
| batch_number | String(100) | Nomor batch |
| scheduled_start_date | DateTime | Jadwal mulai |
| actual_start_date | DateTime | Actual mulai |
| quantity_produced | Numeric(15,2) | Total produksi |
| quantity_good | Numeric(15,2) | Produksi good |
| quantity_scrap | Numeric(15,2) | Produksi scrap |

**Model: ShiftProduction**
- **Tabel**: `shift_productions`
- **Deskripsi**: Record produksi per shift (shift 1, 2, 3)

**Kolom Penting**:
- `production_date`, `shift`, `sub_shift`
- `machine_id`, `product_id`, `work_order_id`, `batch_number`
- `target_quantity`, `actual_quantity`, `good_quantity`
- `reject_quantity`, `rework_quantity`
- `planned_runtime`, `actual_runtime`, `downtime_minutes`
- Downtime by category: `downtime_mesin`, `downtime_operator`, `downtime_material`, etc.
- Loss percentages: `loss_mesin`, `loss_operator`, etc.
- OEE metrics: `quality_rate`, `efficiency_rate`, `oee_score`

---

## 3. ROUTES (API Endpoints)

Lihat dokumentasi lengkap di: **[BACKEND_ROUTES.md](./BACKEND_ROUTES.md)**

### Ringkasan Route Modules:

| Module | Base URL | Deskripsi |
|--------|----------|-----------|
| Authentication | `/api/auth` | Login, register, password reset |
| Products | `/api/products` | CRUD products, categories, BOM |
| Production | `/api/production` | Work orders, shift production, downtime |
| Warehouse | `/api/warehouse` | Inventory, transactions, stock opname |
| Sales | `/api/sales` | Customers, sales orders |
| Purchasing | `/api/purchasing` | Suppliers, purchase orders |
| Finance | `/api/finance` | Accounts, journal entries, invoices |
| HR | `/api/hr` | Employees, attendance, roster |
| Quality | `/api/quality` | Inspections, defects |
| Maintenance | `/api/maintenance` | Schedules, records |
| Reports | `/api/reports` | Production, OEE, inventory reports |

---

## 4. FRONTEND

Lihat dokumentasi lengkap di: **[FRONTEND_STRUKTUR.md](./FRONTEND_STRUKTUR.md)**

### Tech Stack:
- React 18 + TypeScript
- Vite (build tool)
- Redux Toolkit (state management)
- React Router v6 (routing)
- Tailwind CSS (styling)
- Axios (HTTP client)
- Socket.IO Client (real-time)

### Struktur Folder:
```
frontend/src/
├── components/     # Reusable components
├── pages/          # Page components (routes)
├── services/       # API service layer
├── store/          # Redux store & slices
├── hooks/          # Custom React hooks
├── contexts/       # React Context providers
├── utils/          # Utility functions
└── styles/         # Global styles
```

### Main Routes:
- `/` - Landing page
- `/login` - Login page
- `/dashboard` - Main dashboard
- `/production/*` - Production module
- `/warehouse/*` - Warehouse module
- `/sales/*` - Sales module
- Dan 10+ modules lainnya

---

## 5. UTILS & HELPERS

### Backend Utils (`backend/utils/`)

#### `helpers.py`
- Helper functions umum (date formatting, string manipulation)

#### `calculations.py`
- **Function**: `calculate_oee(availability, performance, quality)`
- **Function**: `calculate_efficiency(target, actual, downtime)`
- **Function**: `calculate_material_requirements(bom, quantity)`

#### `product_calculations.py`
- **Function**: `calculate_batch_size(product, quantity)`
- **Function**: `calculate_material_consumption(product, kartons)`

#### `business_rules.py`
- Business rules validation
- Downtime category limits (mesin: 15%, operator: 7%, dll)

#### `costing_helper.py`
- **Function**: `calculate_unit_cost(material_cost, labor_cost, overhead)`
- **Function**: `allocate_overhead_cost(direct_cost, rate)`

#### `document_generator.py`
- **Function**: `generate_wo_pdf(work_order)`
- **Function**: `generate_bom_pdf(bom)`
- **Function**: `generate_delivery_note(sales_order)`

#### `email_service.py`
- **Function**: `send_email(to, subject, body)`
- **Function**: `send_password_reset_email(user, reset_link)`
- **Function**: `send_notification_email(users, notification)`

---

## 6. INTEGRASI & WORKFLOW

### Production Workflow

```
1. Sales Order Created
   ↓
2. MRP Analysis (Material Requirements)
   ↓
3. Generate Work Order
   ↓
4. Release WO (Material Issue)
   ↓
5. Production Start
   ↓
6. Shift Production Recording
   ↓
7. Quality Inspection
   ↓
8. WO Completion
   ↓
9. Inventory Update (Finished Goods)
   ↓
10. Shipping & Delivery
```

### Warehouse Workflow

```
Purchase Order → Receipt → Inventory IN
Work Order → Material Issue → Inventory OUT
Production → Finished Goods → Inventory IN
Sales Order → Delivery → Inventory OUT
```

### Finance Integration

```
Purchase → AP Invoice → Payment
Sales → AR Invoice → Collection
Production → WIP Accounting → COGS
```

---

## 7. DATABASE RELATIONSHIPS

### Key Relationships:

1. **User ↔ Role ↔ Permission** (Many-to-Many)
2. **Product ↔ BOM ↔ BOMItem ↔ Material**
3. **SalesOrder → WorkOrder → ShiftProduction**
4. **WorkOrder → Machine → DowntimeRecord**
5. **Product → Inventory ↔ Warehouse**
6. **Customer → SalesOrder → SalesOrderItem → Product**
7. **Supplier → PurchaseOrder → PurchaseOrderItem → Material**
8. **Employee → Attendance / Roster**
9. **Machine → MaintenanceRecord**

---

## 8. SECURITY & AUTHENTICATION

### Authentication Flow:

1. User login dengan username/password
2. Backend validasi credentials
3. Generate JWT access token (2 jam) dan refresh token (30 hari)
4. Frontend store tokens di localStorage
5. Setiap API request, frontend attach access token di header
6. Backend verify token dengan JWT middleware
7. Jika token expired, frontend request refresh token
8. Jika refresh token expired, redirect ke login

### Authorization (RBAC):

- **Roles**: Admin, Manager, Supervisor, Operator, Viewer, dll
- **Permissions**: Format `resource:action` (e.g., `production:create_wo`)
- **Middleware**: `@jwt_required()` dan `@permission_required('permission')`

### Security Features:

- Bcrypt password hashing
- JWT token authentication
- Rate limiting (5000 req/hour)
- CORS configuration
- XSS protection
- CSRF protection
- Security headers (Talisman)
- SQL injection prevention (SQLAlchemy ORM)

---

## 9. DEPLOYMENT

### Backend Deployment:

```bash
# Production mode
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# With environment variables
export FLASK_ENV=production
export DATABASE_URL=postgresql://...
export SECRET_KEY=...
```

### Frontend Deployment:

```bash
# Build for production
npm run build

# Output: dist/
# Deploy dist/ ke static hosting (Vercel, Netlify, dll)
```

### Docker Deployment:

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Services:
# - backend (Flask)
# - frontend (Nginx)
# - database (PostgreSQL)
```

---

## 10. TESTING

### Backend Testing:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Test files: backend/tests/
```

### Frontend Testing:

```bash
# Run tests
npm test

# E2E tests
npm run test:e2e

# Test files: frontend/src/tests/
```

---

## 11. PERFORMANCE OPTIMIZATION

### Backend:

- Database indexing pada kolom yang sering di-query
- Pagination untuk list endpoints
- Caching dengan Redis (optional)
- Query optimization dengan eager loading
- Background jobs untuk heavy tasks

### Frontend:

- Code splitting (React.lazy)
- Lazy loading images
- Debouncing search inputs
- Memoization (useMemo, useCallback)
- Virtual scrolling untuk large lists

---

## 12. MAINTENANCE & MONITORING

### Logging:

- Backend: `logs/app.log`, `logs/error.log`
- Frontend: Browser console
- Sentry integration untuk error tracking

### Monitoring:

- System health endpoint: `/api/health`
- System status: `/api/status`
- Performance metrics: `/api/system-monitor/metrics`

### Backup:

- Database backup: `/api/settings/backup/create`
- Scheduled backups (daily/weekly)
- Backup location: `backend/backups/database/`

---

## 13. REFERENSI DOKUMEN LAIN

1. **[BACKEND_MODELS.md](./BACKEND_MODELS.md)** - Dokumentasi lengkap semua models
2. **[BACKEND_ROUTES.md](./BACKEND_ROUTES.md)** - Dokumentasi lengkap semua API endpoints
3. **[FRONTEND_STRUKTUR.md](./FRONTEND_STRUKTUR.md)** - Dokumentasi frontend structure
4. **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** - Database schema & ERD
5. **[TECHNICAL_GUIDE.md](./TECHNICAL_GUIDE.md)** - Technical implementation guide
6. **[PANDUAN_PENGGUNA.md](./PANDUAN_PENGGUNA.md)** - User manual (Indonesian)

---

## 14. GLOSSARY

| Term | Definisi |
|------|----------|
| BOM | Bill of Materials - Daftar material untuk produksi |
| WO | Work Order - Order produksi |
| MPS | Master Production Schedule |
| MRP | Material Requirements Planning |
| OEE | Overall Equipment Effectiveness |
| GSM | Grams per Square Meter |
| UOM | Unit of Measure |
| FIFO | First In First Out |
| COGS | Cost of Goods Sold |
| AR | Accounts Receivable |
| AP | Accounts Payable |
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token |

---

**Dokumentasi ini dibuat pada**: 17 Juni 2026
**Versi Sistem**: 1.0.0
**Terakhir Update**: 17 Juni 2026

