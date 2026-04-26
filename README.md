# 🏭 SMITH ERP — Manufacturing Resource Planning

> **Sistem Manajemen Perusahaan Lengkap untuk Manufaktur Nonwoven**

[![CI/CD](https://github.com/bayuadhie-dev/smith/actions/workflows/ci.yml/badge.svg)](https://github.com/bayuadhie-dev/smith/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/bayuadhie-dev/smith/branch/main/graph/badge.svg)](https://codecov.io/gh/bayuadhie-dev/smith)
[![Python](https://img.shields.io/badge/Python-3.12+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0+-green.svg)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-18.2+-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-3178c6.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

## 📋 Daftar Isi

- [Tentang Sistem](#tentang-sistem)
- [Fitur Utama](#fitur-utama)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Teknologi yang Dipakai](#teknologi-yang-dipakai)
- [Modul-Modul](#modul-modul)
- [Integrasi Workflow](#integrasi-workflow)
- [Cara Install](#cara-install)
- [Pengujian](#pengujian)
- [Dokumentasi API](#dokumentasi-api)
- [AI Assistant](#ai-assistant)

---

## 🎯 Tentang Sistem

**Sistem ERP Nonwoven** adalah aplikasi manajemen perusahaan yang terintegrasi penuh, didesain khusus buat industri manufaktur nonwoven. Sistem ini ngatur semua proses bisnis dari penjualan, produksi, quality control, sampai keuangan dalam satu platform yang terpadu.

### 🌟 Keunggulan

- ✅ **Arsitektur Modern Full-Stack** - Flask REST API + React TypeScript
- ✅ **AI Assistant Terintegrasi** - Query data ERP dengan bahasa natural Indonesia
- ✅ **Sinkronisasi Data Real-time** - Update langsung di semua modul
- ✅ **Otomasi Workflow Lengkap** - Sales → MRP → Produksi → Quality → Shipping → Finance
- ✅ **Multi-bahasa** - Indonesia & English (i18n)
- ✅ **Kontrol Akses Berbasis Role** - Sistem permission yang detail
- ✅ **Responsive Mobile** - Jalan di desktop, tablet, dan mobile
- ✅ **15+ Business Workflows** - Semua proses bisnis terintegrasi
- ✅ **Arsitektur Scalable** - Desain siap microservices

---

## 🚀 Fitur Utama

### 🤖 AI Assistant
- **Query Natural Language** - Tanya data ERP pakai bahasa Indonesia
- **Multi-Module Support** - Akses semua modul: Sales, Production, Quality, HR, Finance, dll
- **Smart Intent Detection** - Deteksi otomatis maksud pertanyaan user
- **Quick Links** - Navigasi langsung ke halaman terkait
- **Playful Responses** - Jawaban santai dan informatif

### 📊 Business Intelligence
- **🎯 Executive Dashboard** - Halaman utama dengan advanced analytics & KPI real-time
- **Dashboard Real-time** - 20+ metrik bisnis dengan trend 12 bulan
- **Performance Scorecard** - 5 KPI utama dengan target & achievement tracking
- **Top Performers** - Ranking customers & products terbaik
- **Critical Alerts** - Notifikasi issue penting untuk executive
- **Reporting Canggih** - Report custom dengan export (PDF, Excel)
- **Analisa Data** - Trend penjualan, metrik produksi, analisa keuangan
- **Predictive Analytics** - Forecasting demand dan optimasi inventory

### 🏭 Manufaktur Excellence
- **Planning Produksi** - Work order, scheduling, capacity planning
- **Tracking OEE** - Monitoring efektivitas equipment
- **Quality Control** - Workflow inspeksi, tracking defect, CAPA
- **Manajemen Maintenance** - Preventive dan corrective maintenance

### 💼 Operasional Bisnis
- **Sales & CRM** - Order, quotation, manajemen customer
- **Purchasing** - Manajemen supplier, otomasi PO
- **Manajemen Inventory** - Tracking stock real-time, operasi gudang
- **Finance & Accounting** - GL, AP, AR, budgeting, cost accounting

### 👥 Human Resources
- **Manajemen Karyawan** - Profile, absensi, cuti
- **Sistem Payroll** - Kalkulasi gaji, potongan, pajak
- **Performance Appraisal** - Tracking KPI, review
- **Training & Development** - Tracking skill, manajemen sertifikasi

### 🔬 R&D & Inovasi
- **Manajemen Project** - Project R&D, tracking eksperimen
- **Pengembangan Produk** - Formulasi produk baru, testing
- **Riset Material** - Testing dan analisa material

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
│  React 18 + TypeScript + Redux Toolkit + React Router      │
│  Tailwind CSS + Recharts + React Beautiful DND             │
└─────────────────────────────────────────────────────────────┘
                            ↕ REST API
┌─────────────────────────────────────────────────────────────┐
│                     Backend Layer                           │
│  Flask 3.0 + SQLAlchemy + Flask-JWT-Extended               │
│  Flask-CORS + Flask-Migrate + Bcrypt                       │
└─────────────────────────────────────────────────────────────┘
                            ↕ ORM
┌─────────────────────────────────────────────────────────────┐
│                   Database Layer                            │
│  SQLite (Development) / PostgreSQL (Production)            │
│  Alembic Migrations + Database Indexing                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 💻 Teknologi yang Dipakai

### Backend
| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| Python | 3.12+ | Bahasa utama |
| Flask | 3.0+ | Web framework |
| SQLAlchemy | 2.0+ | ORM |
| Flask-JWT-Extended | 4.6+ | Authentication |
| Flask-CORS | 4.0+ | Cross-origin support |
| Flask-Migrate | 4.0+ | Database migrations |
| Pytest | 7.4+ | Testing framework |
| Bcrypt | 4.1+ | Password hashing |

### Frontend
| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| React | 18.2+ | UI framework |
| TypeScript | 5.2+ | Type safety |
| Redux Toolkit | 2.0+ | State management |
| React Router | 6.20+ | Routing |
| Tailwind CSS | 3.3+ | Styling |
| Recharts | 2.15+ | Visualisasi data |
| Vitest | 4.0+ | Testing framework |
| Axios | 1.6+ | HTTP client |

---

## 📦 Modul-Modul

### 1️⃣ **Modul Sales & Marketing**

**Fitur:**
- Manajemen Customer (CRM)
- Sales Order & Quotation
- Forecasting Penjualan
- Price List & Diskon
- Proses Return Customer
- Invoice & Payment Tracking

**API Endpoints:**
```bash
GET/POST   /api/sales/customers
GET/POST   /api/sales/orders
GET/POST   /api/sales/quotations
GET        /api/sales/forecasts
GET/POST   /api/returns
```

---

### 2️⃣ **Modul Produksi**

**Fitur:**
- Manajemen Work Order
- Scheduling Produksi (Schedule Grid)
- Input Produksi Per Shift (Manual)
- Recording & Analisa Downtime
- Kalkulasi OEE (Availability × Performance × Quality)
- Manajemen Mesin
- Manajemen Buffer Produksi
- Weekly Production Planning
- Work Order Monitoring Real-time
- Daily Controller Dashboard

**Input Produksi Per Shift:**
- Entry data per shift (Shift 1, 2, 3)
- Tracking target vs actual quantity
- Quantity Good, Reject, Rework
- Runtime dan downtime (menit)
- Assignment operator dan supervisor
- Kalkulasi OEE otomatis
- Konsumsi material otomatis

**Kategori Downtime:**
- Planned: Maintenance, Setup, Changeover
- Unplanned: Breakdown, Kekurangan material, Masalah quality
- **Idle Time**: Tunggu material, tunggu stiker, tunggu packaging
- **Early Stop**: Tracking shift berakhir lebih awal dengan alasan

**API Endpoints:**
```bash
GET/POST   /api/production/work-orders
GET        /api/production/machines
GET        /api/production/daily-controller
POST       /api/production/work-order-records
GET/POST   /api/schedule-grid
GET/POST   /api/weekly-production-plan
GET        /api/work-order-monitoring
```

---

### 3️⃣ **Modul WIP Stock & Packing List** 🆕

**Fitur:**
- **WIP Stock Management** - Tracking stok Work In Progress per produk
- **WIP Stock Movement** - History pergerakan stok WIP (in/out/adjustment)
- **Packing List Terpisah** - Packing list independen dari Work Order
- **Carton Weighing** - Input berat dan tanggal timbang per karton
- **Batch Mixing** - Pencampuran batch produksi
- **Pack Per Carton** - Otomatis dari data products_new

**Workflow:**
```
Work Order Production → WIP Stock (per product) → 
Packing List (per order) → Carton Weighing → Shipping
```

**API Endpoints:**
```bash
GET        /api/packing-list/wip-stock
POST       /api/packing-list/wip-stock/adjustment
GET        /api/packing-list/wip-stock/:id/movements
GET/POST   /api/packing-list
GET/PUT    /api/packing-list/:id
POST       /api/packing-list/:id/weigh-carton
POST       /api/packing-list/:id/cancel
```

---

### 4️⃣ **Modul Quality Control**

**Fitur:**
- Quality Inspection (Incoming, In-process, Final)
- Tracking & Analisa Defect
- CAPA (Corrective & Preventive Actions)
- Metrik & KPI Quality
- Alert & Notifikasi Quality
- Audit Quality
- Manajemen Training & Kompetensi

**🎯 Quality Objective Module:**
- **Target Manual Per Mesin** - Input target bulanan (penyusutan, maintenance)
- **Pencapaian Produksi** - Target vs actual per mesin dengan status tercapai/tidak
- **Top 3 Downtime Analysis** - Exclude design change, idle, istirahat
- **Root Cause Analysis** - Problem → Root Cause → Corrective → Preventive Action
- **Downtime by Category** - Grafik visual downtime per kategori (mesin, operator, material)
- **Achievement Tracking** - Persentase pencapaian, quality rate, working days

**API Endpoints:**
```bash
# Quality Objectives
GET    /api/oee/quality-objectives/production
GET/POST /api/oee/machine-monthly-targets
POST   /api/oee/machine-monthly-targets/bulk
GET    /api/oee/machine-downtime-analysis
GET/POST/DELETE /api/oee/downtime-root-causes

# Quality Inspections
GET    /api/quality/incoming
GET    /api/quality/in-process
GET    /api/quality/finish-good
POST   /api/quality/inspections
GET/POST /api/quality/enhanced
```

**Workflow Quality:**
```
Produksi Selesai → Auto Trigger QC → 
Inspeksi → Pass/Fail → Rework/Disposal → 
Update Metrik Quality
```

---

### 5️⃣ **Modul Warehouse & Inventory**

**Fitur:**
- Tracking Inventory Real-time
- Stock Movement (Receipt, Issue, Transfer)
- Manajemen Lokasi Gudang
- Alert Stock (Level Min/Max)
- Valuasi Inventory (FIFO, LIFO, Average)
- Cycle Counting & Stock Opname
- Support Barcode/QR Code
- Material Issue untuk Produksi
- Goods Receipt Note (GRN)
- Stock Adjustment dengan Approval

**API Endpoints:**
```bash
GET/POST   /api/warehouse
GET/POST   /api/warehouse/stock
GET/POST   /api/warehouse/transfers
GET/POST   /api/material-issue
GET/POST   /api/stock-opname
GET/POST   /api/stock-input
GET        /api/material-stock
```

---

### 6️⃣ **Modul Purchasing**

**Fitur:**
- Manajemen Supplier
- Purchase Requisition
- Purchase Order
- Goods Receipt Note
- Tracking Performa Supplier
- Perbandingan Harga
- Evaluasi Vendor

**API Endpoints:**
```bash
GET/POST   /api/purchasing/suppliers
GET/POST   /api/purchasing/purchase-orders
GET/POST   /api/purchasing/goods-receipts
GET        /api/purchasing/reports
```

---

### 7️⃣ **Modul Finance & Accounting**

**Fitur:**
- General Ledger (GL)
- Accounts Payable (AP)
- Accounts Receivable (AR)
- Chart of Accounts
- Journal Entry
- Planning & Analisa Variance Budget
- Manajemen Cash Flow
- Report Keuangan (P&L, Balance Sheet, Cash Flow)
- Cost Accounting (WIP, COGM, COGS)

**WIP Accounting & Job Costing:**
- WIP Ledger per Work Order
- Tracking cost Material, Labor, Overhead
- Analisa Variance (Material, Labor, Overhead, Yield)
- Auto-posting ke GL
- Flow COGM → Finished Goods → COGS
- Job Costing per Work Order

**API Endpoints:**
```bash
GET/POST   /api/finance/accounts
GET/POST   /api/finance/journals
GET/POST   /api/finance/transactions
GET        /api/finance/reports
GET/POST   /api/wip-accounting
GET/POST   /api/wip-job-costing
```

---

### 8️⃣ **Modul HR & Payroll**

**Fitur:**
- Manajemen Karyawan
- Manajemen Absensi & Cuti
- Proses Payroll
- Performance Appraisal
- Training & Development
- Manajemen Roster Shift
- Portal Self-Service Karyawan
- Public Attendance (QR Code)

**Integrasi Roster:**
- Data karyawan dari modul HR
- Data mesin dari modul Produksi
- Assignment berbasis shift
- Interface drag & drop
- View roster mingguan

**API Endpoints:**
```bash
GET/POST   /api/hr/employees
GET/POST   /api/hr/attendance
GET/POST   /api/hr/leaves
GET/POST   /api/hr-payroll
GET/POST   /api/hr-appraisal
GET/POST   /api/hr-training
GET/POST   /api/work-roster
```

---

### 9️⃣ **Modul Maintenance**

**Fitur:**
- Scheduling Preventive Maintenance
- Tracking Corrective Maintenance
- Manajemen Work Order
- Inventory Spare Parts
- History Equipment
- Tracking Cost Maintenance

**API Endpoints:**
```bash
GET/POST   /api/maintenance
GET/POST   /api/maintenance/schedules
GET/POST   /api/maintenance/work-orders
```

---

### 🔟 **Modul MRP (Material Requirements Planning)**

**Fitur:**
- Forecasting Demand
- Kalkulasi Kebutuhan Material
- Planning Produksi
- Planning Kapasitas
- Alert Kekurangan Material
- Planning Timeline

**Workflow MRP:**
```
Sales Order Confirmed → Analisa MRP → 
Cek Stock → Shortage Teridentifikasi → 
Purchase Order / Work Order Dibuat
```

**API Endpoints:**
```bash
GET/POST   /api/mrp
GET        /api/mrp/requirements
GET        /api/mrp/analysis
POST       /api/mrp/run
```

---

### 1️⃣1️⃣ **Modul R&D (Research & Development)**

**Fitur:**
- Manajemen Project R&D
- Tracking Eksperimen
- Testing Material
- Pengembangan Produk
- Manajemen Formulasi
- Analisa Hasil Test
- R&D Reports & Analytics
- Approval Workflow untuk R&D

**Backend Files (8 modules, 135KB total):**
- `rd.py` — Core R&D utilities and base routes
- `rd_projects.py` — Project management, milestones, approvals
- `rd_experiments.py` — Lab experiments, test tracking
- `rd_materials.py` — Material research, testing, formulations  
- `rd_products.py` — New product development, formulations
- `rd_reports.py` — R&D analytics and reporting
- `rd_extended.py` — Extended R&D features
- `rd_integration.py` — Integration with Production and Quality

**API Endpoints:**
```bash
GET/POST   /api/rd/projects
GET/POST   /api/rd/experiments
GET/POST   /api/rd/materials
GET/POST   /api/rd/products
GET/POST   /api/rd/reports
GET/POST   /api/rnd
```

---

### 1️⃣2️⃣ **Modul Shipping & Logistics**

**Fitur:**
- Manajemen Delivery Order
- Tracking Pengiriman
- Manajemen Carrier/Transporter
- Shipping Schedule
- Delivery Confirmation
- Proof of Delivery

**API Endpoints:**
```bash
GET/POST   /api/shipping
GET/POST   /api/shipping/deliveries
GET/POST   /api/shipping/carriers
```

---

### 1️⃣3️⃣ **Modul Waste Management**

**Fitur:**
- Tracking Waste Produksi
- Kategorisasi Waste
- Waste Analytics & Reports
- Compliance Tracking
- Disposal Management

**API Endpoints:**
```bash
GET/POST   /api/waste
GET        /api/waste/analytics
GET        /api/waste/reports
```

---

### 1️⃣4️⃣ **Modul DCC & CAPA (Document Control Center)**

**Standar:** ISO 9001:2015 (Klausul 7.5)  
**Referensi:** QP-DCC-01, QP-DCC-02, QP-DCC-03, QP-DCC-04, WI-DCC-01, WI-DCC-02  
**Database:** 13 tabel di `dcc.py`  
**RBAC:** Module `dcc` — view, create, edit, delete, approve

**Sub-Modul:**
- **Pengendalian Dokumen (QP-DCC-01)** — Registry dokumen Level I-IV (QM, QP, WI, Form), riwayat revisi, 3-level approval chain (Originator → Reviewer → Approver), distribusi salinan terkendali, kaji ulang berkala, change notice
- **Pengendalian Rekaman Mutu (QP-DCC-02)** — Daftar induk rekaman SMM & mutu produk, masa retensi, holder tracking
- **CAPA (QP-DCC-03)** — CPAR/SCAR/CCHF dengan auto-numbering, RCA 5-Why & Fishbone, tindakan korektif & preventif, verifikasi efektivitas, laporan bulanan. **Referensi Penyimpangan Mutu** — Input manual nomor dokumen penyimpangan saat sumber = PM
- **Komunikasi Internal (QP-DCC-04)** — Memo antar departemen, read receipts, kategori komunikasi
- **Pemusnahan Dokumen (WI-DCC-01)** — Berita acara pemusnahan fisik & digital, saksi & verifikasi

**Models:** `DccDocument`, `DccDocumentRevision`, `DccDocumentDistribution`, `DccDocumentReview`, `DccChangeNotice`, `DccQualityRecord`, `CapaRequest`, `CapaInvestigation`, `CapaVerification`, `CapaMonthlyReport`, `InternalMemo`, `InternalMemoDistribution`, `DccDestructionLog`

**Fitur:**
- Auto-numbering CPAR (`CP/BB/CC/DD-nnn`) & SCAR (`SC/BB/CC/nnn`), reset per tahun
- Nomor referensi penyimpangan mutu (manual input saat CPAR source = Penyimpangan Mutu)
- PDF Security: Permission Lock + AES Owner Password + SHA-256 Hash
- Digital signature auto-generated (nama, role, timestamp, QR code)
- Workflow: draft → reviewing → pending_approval → active → obsolete

**API Endpoints:**
```bash
POST   /api/dcc/capa                   # Create CPAR/SCAR/CCHF
GET    /api/dcc/capa                   # List (filter type/source/status)
GET    /api/dcc/capa/:id               # Detail + investigation + verification
POST   /api/dcc/capa/:id/investigation # Input RCA + Action Plan
POST   /api/dcc/capa/:id/verification  # Verifikasi efektivitas
PUT    /api/dcc/capa/:id/status        # Update status
POST   /api/dcc/capa/:id/cancel        # Pembatalan CAPA
GET    /api/dcc/capa/dashboard          # KPI Dashboard (by source, dept, status)
GET    /api/dcc/capa/monthly-report     # Laporan bulanan (FRM-DCC-09)
POST   /api/dcc/documents              # Registrasi dokumen
GET    /api/dcc/documents              # Daftar Induk (FRM-DCC-02)
POST   /api/dcc/memos                  # Buat memo internal
POST   /api/dcc/destruction            # Berita acara pemusnahan
```

---

### Modul Pendukung

| Modul | Fitur Utama | API Prefix |
|-------|-------------|------------|
| **BOM Management** | Multi-level BOM, versioning, cost calculation | `/api/bom` |
| **Dashboard & Analytics** | KPI real-time, Executive Dashboard, custom reports | `/api/dashboard`, `/api/executive-dashboard` |
| **OEE Tracking** | Availability, Performance, Quality metrics | `/api/oee` |
| **Notifications** | Real-time alerts, email notifications | `/api/notifications` |
| **Approval Workflow** | Multi-level approval, delegation | `/api/approval-workflow` |
| **AI Assistant** | Natural language query, smart navigation | `/api/ai-assistant` |
| **TV Display** | Production monitoring display | `/api/tv-display` |
| **Reports** | Custom reports, export PDF/Excel | `/api/reports` |
| **Settings** | System configuration, preferences | `/api/settings` |
| **Backup & Restore** | Data backup and recovery | `/api/backup` |
| **System Monitor** | Server health, performance metrics | `/api/system-monitor` |
| **Group Chat** | Internal team communication | `/api/group-chat` |
| **Pre-Shift Checklist** | K3 safety checks, machine handover | `/api/pre-shift-checklist` |
| **User Manual** | In-app documentation | `/api/user-manual` |
| **OAuth** | Google OAuth integration | `/api/oauth` |
| **KPI Targets** | Target setting and tracking | `/api/kpi-targets` |
| **Product Changeover** | Machine changeover tracking | `/api/product-changeover` |
| **Face Recognition** | Attendance with face verification | `/api/face-recognition` |
| **Live Monitoring** | Real-time production monitoring | `/api/live-monitoring` |
| **Material Stock** | Raw material inventory tracking | `/api/material-stock` |
| **Converting** | Converting production tracking | `/api/converting` |
| **Desk/Workspace** | Personal workspace management | `/api/desk`, `/api/workspace` |

---

## 🔄 Integrasi Workflow

### Flow Bisnis Lengkap

```
SALES → MRP → PURCHASING/PRODUCTION → WAREHOUSE → 
QUALITY → SHIPPING → FINANCE
```

### Workflow Otomatis

#### Sales Order ke Produksi
```
Sales Order Confirmed → 
  Auto Analisa MRP → 
    Kekurangan Material? → 
      Ya: Buat Purchase Order
      Tidak: Buat Work Order → 
        Produksi Selesai → 
          Auto Quality Inspection → 
            Pass: Pindah ke Finished Goods
            Fail: Rework/Disposal
```

#### Produksi ke Finance
```
Produksi Start → 
  Buat WIP Ledger → 
    Akumulasi Cost (Material + Labor + Overhead) → 
      Produksi Selesai → 
        COGM Transfer (WIP → FG) → 
          Auto GL Posting → 
            Produk Terjual → 
              COGS Posting → 
                Kalkulasi Gross Profit
```

---

## 🛠️ Cara Install

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm atau yarn
- Git

### Setup Backend

```bash
# Clone repository
git clone https://github.com/bayuadhie-dev/smith.git
cd smith/backend

# Buat virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env

# Initialize database
flask db upgrade

# Jalankan development server
python app.py
```

Backend jalan di `http://localhost:5000`

### Setup Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Jalankan development server
npm run dev
```

Frontend jalan di `http://localhost:5173`

---

## 🧪 Pengujian

### Pengujian Backend (Pytest)

```bash
cd backend

# Jalankan semua test
pytest tests/ -v

# Jalankan dengan coverage
pytest tests/ --cov=. --cov-report=html

# Jalankan test file tertentu
pytest tests/test_auth.py -v
```



### Pengujian Frontend (Vitest)

```bash
cd frontend

# Jalankan test
npm test

# Jalankan dengan UI
npm test:ui

# Jalankan dengan coverage
npm test:coverage
```

---

## 📚 Dokumentasi API

### Autentikasi

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

### Gunakan Token

```http
GET /api/products
Authorization: Bearer <your-jwt-token>
```

### Format Respons Umum

**Sukses:**
```json
{
  "success": true,
  "message": "Operasi berhasil",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Pesan error"
}
```

### Endpoint API Lengkap

#### Produksi & OEE
```bash
GET    /api/production/work-orders
POST   /api/production/work-orders
GET    /api/production/daily-controller
POST   /api/production/work-order-records
GET    /api/oee/monthly-summary
GET    /api/oee/quality-objectives/production
```

#### Kontrol Kualitas
```bash
GET    /api/quality/incoming
GET    /api/quality/in-process
GET    /api/quality/finish-good
POST   /api/quality/inspections
GET/POST /api/oee/machine-monthly-targets
POST   /api/oee/machine-monthly-targets/bulk
GET    /api/oee/machine-downtime-analysis
GET/POST/DELETE /api/oee/downtime-root-causes
```

#### Penjualan & CRM
```bash
GET    /api/sales/customers
POST   /api/sales/customers
GET    /api/sales/orders
POST   /api/sales/orders
GET    /api/sales/forecasts
POST   /api/sales/quotations
```

#### Inventori & Gudang
```bash
GET    /api/inventory/items
POST   /api/inventory/items
GET    /api/inventory/stock
POST   /api/inventory/transactions
GET    /api/inventory/warehouses
```

---

## 🗂️ Struktur Proyek

```
SourceCode/
├── backend/                    # 339 files, 97,428 lines
│   ├── app.py
│   ├── config.py
│   ├── models/                 # 49 model files (269 DB tables)
│   ├── routes/                 # 91 route files
│   ├── utils/                  # 19 helper files
│   ├── tests/                  # 44 test files
│   ├── migrations/             # 26 migration files
│   ├── seeds/                  # 3 seed files
│   └── scripts/                # 4 utility scripts
├── frontend/                   # 428 files, 180,231 lines
│   ├── src/
│   │   ├── pages/              # 35 modules, 420+ components
│   │   ├── components/         # 60 reusable components
│   │   ├── store/              # Redux store
│   │   └── hooks/              # Custom hooks
│   ├── package.json
│   └── vite.config.ts
├── docs/                       # 7 documentation files
└── README.md

Total: 816+ files, 310,000+ lines of code
```

---

## 🔐 Fitur Keamanan

- ✅ **JWT Authentication** — Token-based auth dengan refresh token
- ✅ **Password Hashing** — Bcrypt dengan salt
- ✅ **CORS Protection** — Whitelist origin
- ✅ **SQL Injection Prevention** — SQLAlchemy ORM parameterized queries
- ✅ **XSS Protection** — Input sanitization
- ✅ **Role-Based Access Control (RBAC)** — 40+ default roles, 200+ permissions, module-level access control
- ✅ **Audit Trail** — Tracking semua perubahan data
- ✅ **Google OAuth** — Login dengan akun Google

### RBAC System Detail

| Komponen | Jumlah | Deskripsi |
|----------|--------|-----------|
| **Roles** | 40+ | Dari Super Admin sampai Helper Gudang |
| **Modules** | 35+ | Termasuk DCC, Accounting, Pre-Shift Checklist |
| **Permissions** | 200+ | Format: `module.action` (e.g. `dcc.approve`) |
| **Actions** | view, create, edit, delete, approve, post, dll | Per-module granular |

**Hierarki Role:**
- **Super Admin** — Akses penuh semua modul + Settings
- **Direktur** (Utama, Operasional, Keuangan, HRD) — Executive dashboard + approval
- **Manager** (Produksi, Sales, QC, Finance, dll) — Full CRUD per departemen
- **Supervisor** — Monitoring + create/edit
- **Staff** — Operasional harian
- **Operator/Helper** — Input data produksi
- **Auditor** — Read-only semua modul
- **Viewer/Guest** — Limited read-only

**Catatan:** Modul **Group Chat** dapat diakses semua role tanpa permission check (komunikasi internal).

---

## 🌐 Internasionalisasi

Support:
- 🇮🇩 Bahasa Indonesia
- 🇬🇧 English

---

## 📝 Lisensi

**PROPRIETARY SOFTWARE**

Copyright (c) 2025-2026 **Mochammad Bayu Adhie Nugroho**. All Rights Reserved.

This software is proprietary and confidential. Unauthorized copying, distribution, modification, public display, or public performance of this software is strictly prohibited.

See [LICENSE](LICENSE) for full terms.

---

## 👨‍💻 Penulis

**Mochammad Bayu Adhie Nugroho**
- GitHub: [@bayuadhie-dev](https://github.com/bayuadhie-dev)
- Email: baymngrh@gmail.com

---

## 👥 Dukungan

Untuk support teknis: baymngrh@gmail.com

---

## 🤖 AI Assistant

AI Assistant adalah fitur chatbot terintegrasi yang memungkinkan user untuk query data ERP menggunakan bahasa natural Indonesia.

### Contoh Query

```
📦 Inventory & Warehouse
- "stok POLYESTER"
- "material yang hampir habis"
- "BOM produk ANDALAN"

🛒 Sales & Purchasing
- "PO pending"
- "revenue bulan ini"

🏭 Production & Quality
- "target produksi mesin 11"
- "top 3 downtime mesin 12"
- "root cause analysis"
- "achievement rate bulan ini"

📊 Analytics & Reports
- "OEE bulan kemarin"
- "downtime terbanyak"
- "quality rate"
```

### Quick Links

- **Production → Quality Objective** - Set target dan analisa downtime
- **Production → Daily Controller** - Monitoring shift dan OEE
- **Quality → Incoming QC** - Inspeksi material masuk
- **Quality → In-Process QC** - QC proses produksi
- **Quality → Finish Good QC** - QC produk jadi

---

## 📈 Pembaruan Terbaru

### ✨ v3.1.1 — April 2026 (README Update)
- **README Documentation Update** — Verifikasi dan update dokumentasi lengkap:
  - Backend routes: 91 files verified ✅
  - Frontend pages: 32 → **35 modules** ✅
  - Database models: 48 → **49 files** ✅
  - R&D Module: 1 → **8 backend files** (rd_projects, rd_experiments, rd_materials, rd_products, rd_reports, rd_extended, rd_integration)
  - New modules added: Face Recognition, Live Monitoring, Material Stock, Converting, Desk/Workspace
  - Total code: 811 files → **816+ files**, 304K → **310K+ lines**

### ✨ v3.1 — April 2026
- **RBAC Overhaul** — 40+ roles, 200+ permissions, module-level access control
- **DCC Permission** — Module `dcc` dengan 5 actions (view, create, edit, delete, approve) di-assign ke 13 roles
- **Accounting Permission** — Module `accounting` dengan 5 actions di-assign ke finance roles
- **Pre-Shift Checklist Permission** — Module baru untuk K3 safety checks
- **CAPA: Referensi Penyimpangan Mutu** — Field input manual nomor dokumen penyimpangan saat sumber CPAR = PM
- **Sidebar RBAC** — Permission check untuk DCC & Accounting di frontend sidebar
- **DCC Sidebar Fix** — Query-aware active state untuk tab-based navigation
- **Seed Script Upgrade** — Sekarang update existing roles dengan permission baru (tidak skip)
- **Group Chat** — Accessible untuk semua user tanpa permission check

### ✨ v3.0 — Maret 2026
- **DCC Module** — Document Control Center dengan 13 tabel (ISO 9001:2015)
- **CAPA Module** — CPAR/SCAR/CCHF dengan auto-numbering & RCA 5-Why
- **Internal Memo** — Komunikasi antar departemen dengan read receipts
- **Document Destruction** — Berita acara pemusnahan (FRM-DCC-14)
- **Quality Records** — Daftar induk rekaman mutu (FRM-DCC-03)

### ✨ Previous Features (v2.1 — Januari 2026)
- **WIP Stock Module** — Tracking stok Work In Progress per produk
- **Packing List Terpisah** — Packing list independen dari Work Order
- **R&D Module Enhanced** — **8 backend files**: Projects, Experiments, Materials, Products, Reports, Extended, Integration
- **Public Attendance** — QR Code based attendance

### ✨ Previous Features (v2.0)
- **Quality Objective Module** — Target manual per mesin, tracking achievement
- **Downtime Analysis** — Top 3 downtime, root cause analysis
- **Enhanced QC Workflows** — Incoming, In-Process, Finish Good QC

---

## 🎯 Quick Start Guide

### 1. Login System
- URL: `http://localhost:5173`
- Default Admin: `admin / admin123`

### 2. Key Modules Access
- **Production**: Work Orders → Daily Controller → Quality Objective
- **Quality**: Incoming → In-Process → Finish Good QC
- **Sales**: Customers → Orders → Quotations
- **Inventory**: Items → Stock → Transactions

### 3. Quality Objective Workflow
1. Go to **Production → Quality Objective**
2. Select year/month
3. Click **"Set Target"** to input monthly targets per machine
4. View achievement rates and status
5. Click **"Analisa Downtime"** for detailed analysis

---

## 📞 Contact & Support

**Mochammad Bayu Adhie Nugroho**
- 📧 Email: baymngrh@gmail.com
- 🐙 GitHub: [@bayuadhie-dev](https://github.com/bayuadhie-dev)

For technical support, feature requests, or bug reports, please email us at baymngrh@gmail.com

---

**© 2025-2026 Mochammad Bayu Adhie Nugroho. All Rights Reserved.**

---

## 🎯 Roadmap

### Selesai ✅
- 18+ modul utama, 100+ sub-modul
- **811 files**, **304,002 baris kode**, **269 tabel database**
- Authentication & authorization (JWT + OAuth)
- 15+ automated workflows end-to-end
- AI Assistant terintegrasi dengan grafik
- Executive Dashboard dengan KPI real-time
- DCC & CAPA Module (ISO 9001:2015) — 13 tabel
- WIP Stock & Packing List Module
- Quality Objective & Downtime Analysis
- R&D Module dengan approval workflow

### Sedang Dikerjakan 🚧
- Advanced reporting dengan export
- Enhanced DCC frontend (bulk operations, advanced search)

### Direncanakan 📋
- AI/ML predictive analytics
- Integrasi IoT untuk mesin produksi
- Mobile app (React Native)
- Multi-plant Support

---

<div align="center">

## 🏆 Achievements

- ✅ **811+ Files** | **304,000+ Lines of Code** | **269+ DB Tables**
- ✅ **18+ Business Modules** with 100+ Sub-Modules
- ✅ **40+ Roles** | **200+ Permissions** | Full RBAC
- ✅ **DCC & CAPA** ISO 9001:2015 Compliant
- ✅ **15+ Automated Workflows** End-to-End
- ✅ **AI Assistant** Natural Language Query + Charts
- ✅ **Real-time Dashboard** 30+ KPIs
- ✅ **80+ API Endpoints** RESTful Design

⭐ Star repository ini kalau bermanfaat!

</div>
