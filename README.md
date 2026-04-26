# 🏭 SMITH ERP — Sistem Perencanaan Sumber Daya Manufaktur

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
- ✅ **Asisten AI Terintegrasi** - Query data ERP dengan bahasa natural Indonesia
- ✅ **Sinkronisasi Data Real-time** - Update langsung di semua modul
- ✅ **Otomasi Workflow Lengkap** - Sales → MRP → Produksi → Quality → Shipping → Finance
- ✅ **Multi-bahasa** - Indonesia & English (i18n)
- ✅ **Kontrol Akses Berbasis Role** - Sistem permission yang detail
- ✅ **Responsive Mobile** - Jalan di desktop, tablet, dan mobile
- ✅ **15+ Business Workflows** - Semua proses bisnis terintegrasi
- ✅ **Arsitektur Scalable** - Desain siap microservices

---

## 🚀 Fitur Utama

### 📊 Kecerdasan Bisnis
- **🎯 Dashboard Eksekutif** - Halaman utama dengan analitik lanjutan & KPI real-time
- **Dashboard Real-time** - 20+ metrik bisnis dengan tren 12 bulan
- **Scorecard Kinerja** - 5 KPI utama dengan target & pelacakan pencapaian
- **Performer Terbaik** - Peringkat pelanggan & produk terbaik
- **Peringatan Kritis** - Notifikasi masalah penting untuk eksekutif
- **Pelaporan Canggih** - Laporan kustom dengan ekspor (PDF, Excel)
- **Analisis Data** - Tren penjualan, metrik produksi, analisis keuangan
- **Analisis Prediktif** - Peramalan permintaan dan optimasi inventori

### 🏭 Keunggulan Manufaktur
- **Perencanaan Produksi** - Work order, penjadwalan, perencanaan kapasitas
- **Pelacakan OEE** - Monitoring efektivitas peralatan
- **Kontrol Kualitas** - Alur kerja inspeksi, pelacakan cacat, CAPA
- **Manajemen Pemeliharaan** - Pemeliharaan preventif dan korektif

### 💼 Operasional Bisnis
- **Penjualan & CRM** - Pesanan, kutipan harga, manajemen pelanggan
- **Pembelian** - Manajemen pemasok, otomasi PO
- **Manajemen Inventori** - Pelacakan stok real-time, operasi gudang
- **Keuangan & Akuntansi** - GL, AP, AR, penganggaran, akuntansi biaya

### 👥 Sumber Daya Manusia
- **Manajemen Karyawan** - Profil, absensi, cuti
- **Sistem Penggajian** - Kalkulasi gaji, potongan, pajak
- **Penilaian Kinerja** - Pelacakan KPI, review
- **Pelatihan & Pengembangan** - Pelacakan skill, manajemen sertifikasi

### 🔬 Riset & Pengembangan
- **Manajemen Proyek** - Proyek R&D, pelacakan eksperimen
- **Pengembangan Produk** - Formulasi produk baru, pengujian
- **Riset Material** - Pengujian dan analisa material

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                     Lapisan Frontend                          │
│  React 18 + TypeScript + Redux Toolkit + React Router      │
│  Tailwind CSS + Recharts + React Beautiful DND             │
└─────────────────────────────────────────────────────────────┘
                            ↕ REST API
┌─────────────────────────────────────────────────────────────┐
│                     Lapisan Backend                           │
│  Flask 3.0 + SQLAlchemy + Flask-JWT-Extended               │
│  Flask-CORS + Flask-Migrate + Bcrypt                       │
└─────────────────────────────────────────────────────────────┘
                            ↕ ORM
┌─────────────────────────────────────────────────────────────┐
│                   Lapisan Database                            │
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
| Flask | 3.0+ | Framework web |
| SQLAlchemy | 2.0+ | ORM |
| Flask-JWT-Extended | 4.6+ | Autentikasi |
| Flask-CORS | 4.0+ | Dukungan cross-origin |
| Flask-Migrate | 4.0+ | Migrasi database |
| Pytest | 7.4+ | Framework pengujian |
| Bcrypt | 4.1+ | Enkripsi password |

### Frontend
| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| React | 18.2+ | Framework UI |
| TypeScript | 5.2+ | Keamanan tipe |
| Redux Toolkit | 2.0+ | Manajemen state |
| React Router | 6.20+ | Routing |
| Tailwind CSS | 3.3+ | Styling |
| Recharts | 2.15+ | Visualisasi data |
| Vitest | 4.0+ | Framework pengujian |
| Axios | 1.6+ | Klien HTTP |

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

**Endpoint API:**
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

**Endpoint API:**
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

**Endpoint API:**
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

**Endpoint API:**
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

**Endpoint API:**
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

**Endpoint API:**
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

**Endpoint API:**
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

**Endpoint API:**
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

**Endpoint API:**
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
Ya: Buat Purchase Order
Tidak: Buat Work Order → 
Produksi Selesai → 
Auto Quality Inspection → 
Pass: Pindah ke Finished Goods
Fail: Rework/Disposal
```

**Endpoint API:**
```bash
GET/POST   /api/mrp
GET        /api/mrp/requirements
GET        /api/mrp/analysis
POST       /api/mrp/run
```

---

### 1️⃣1️⃣ **Modul Riset & Pengembangan**

**Fitur:**
- Manajemen Project R&D
- Tracking Eksperimen
- Testing Material
- Pengembangan Produk
- Manajemen Formulasi
- Analisa Hasil Test
- R&D Reports & Analytics
- Approval Workflow untuk R&D

**File Backend (8 modul, 135KB total):**
- `rd.py` — Utilitas inti R&D dan rute dasar
- `rd_projects.py` — Manajemen proyek, milestone, persetujuan
- `rd_experiments.py` — Eksperimen laboratorium, pelacakan pengujian
- `rd_materials.py` — Riset material, pengujian, formulasi  
- `rd_products.py` — Pengembangan produk baru, formulasi
- `rd_reports.py` — Analitik dan pelaporan R&D
- `rd_extended.py` — Fitur R&D tambahan
- `rd_integration.py` — Integrasi dengan Produksi dan Kualitas

**Endpoint API:**
```bash
GET/POST   /api/rd/projects
GET/POST   /api/rd/experiments
GET/POST   /api/rd/materials
GET/POST   /api/rd/products
GET/POST   /api/rd/reports
GET/POST   /api/rnd
```

---

### 1️⃣2️⃣ **Modul Pengiriman & Logistik**

**Fitur:**
- Manajemen Order Pengiriman
- Pelacakan Pengiriman
- Manajemen Pengangkut/Transporter
- Jadwal Pengiriman
- Konfirmasi Pengiriman
- Bukti Pengiriman

**Endpoint API:**
```bash
GET/POST   /api/shipping
GET/POST   /api/shipping/deliveries
GET/POST   /api/shipping/carriers
```

---

### 1️⃣3️⃣ **Modul Manajemen Limbah**

**Fitur:**
- Pelacakan Limbah Produksi
- Kategorisasi Limbah
- Analitik & Laporan Limbah
- Pelacakan Kepatuhan
- Manajemen Pembuangan

**Endpoint API:**
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

**Endpoint API:**
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

## 🔄 Integrasi Alur Kerja

### Alur Bisnis Lengkap

```
SALES → MRP → PURCHASING/PRODUCTION → WAREHOUSE → 
QUALITY → SHIPPING → FINANCE
```

### Alur Kerja Otomatis

#### Order Penjualan ke Produksi
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

#### Produksi ke Keuangan
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

## 🛠️ Cara Instalasi

### Prasyarat

- Python 3.10+
- Node.js 18+
- npm atau yarn
- Git

### Pengaturan Backend

```bash
# Kloning repositori
git clone https://github.com/bayuadhie-dev/smith.git
cd smith/backend

# Buat lingkungan virtual
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env

# Inisialisasi database
flask db upgrade

# Jalankan development server
python app.py
```

Backend berjalan di `http://localhost:5000`

### Pengaturan Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Jalankan development server
npm run dev
```

Frontend berjalan di `http://localhost:5173`

---

## 🧪 Pengujian

### Pengujian Backend (Pytest)

```bash
cd backend

# Jalankan semua pengujian
pytest tests/ -v

# Jalankan dengan coverage
pytest tests/ --cov=. --cov-report=html

# Jalankan file pengujian tertentu
pytest tests/test_auth.py -v
```



### Pengujian Frontend (Vitest)

```bash
cd frontend

# Jalankan test
npm test

# Jalankan dengan antarmuka
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

- ✅ **Autentikasi JWT** — Token-based auth dengan refresh token
- ✅ **Enkripsi Password** — Bcrypt dengan salt
- ✅ **Proteksi CORS** — Whitelist origin
- ✅ **Pencegahan SQL Injection** — SQLAlchemy ORM parameterized queries
- ✅ **Proteksi XSS** — Input sanitization
- ✅ **Kontrol Akses Berbasis Role (RBAC)** — 40+ default roles, 200+ permissions, module-level access control
- ✅ **Jejak Audit** — Tracking semua perubahan data
- ✅ **Google OAuth** — Login dengan akun Google

### Detail Sistem RBAC

| Komponen | Jumlah | Deskripsi |
|----------|--------|-----------|
| **Peran** | 40+ | Dari Super Admin sampai Helper Gudang |
| **Modul** | 35+ | Termasuk DCC, Akuntansi, Daftar Periksa Pra-Shift |
| **Izin** | 200+ | Format: `module.action` (e.g. `dcc.approve`) |
| **Aksi** | view, create, edit, delete, approve, post, dll | Granular per-modul |

**Hierarki Peran:**
- **Super Admin** — Akses penuh semua modul + Pengaturan
- **Direktur** (Utama, Operasional, Keuangan, HRD) — Dashboard eksekutif + persetujuan
- **Manajer** (Produksi, Penjualan, QC, Keuangan, dll) — CRUD penuh per departemen
- **Supervisor** — Monitoring + create/edit
- **Staf** — Operasional harian
- **Operator/Helper** — Input data produksi
- **Auditor** — Baca-saja semua modul
- **Penampil/Tamu** — Baca-saja terbatas

**Catatan:** Modul **Grup Chat** dapat diakses semua peran tanpa pemeriksaan izin (komunikasi internal).

---

## 🌐 Internasionalisasi

Dukungan:
- 🇮🇩 Bahasa Indonesia
- 🇬🇧 Bahasa Inggris

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

## 🤖 Asisten AI

Asisten AI adalah fitur chatbot terintegrasi yang memungkinkan pengguna untuk melakukan query data ERP menggunakan bahasa alami Indonesia.

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

### Tautan Cepat

- **Production → Quality Objective** - Set target dan analisa downtime
- **Production → Daily Controller** - Monitoring shift dan OEE
- **Quality → Incoming QC** - Inspeksi material masuk
- **Quality → In-Process QC** - QC proses produksi
- **Quality → Finish Good QC** - QC produk jadi

---

## 📈 Pembaruan Terbaru

### ✨ v3.1.1 — April 2026 (Pembaruan README)
- **Pembaruan Dokumentasi README** — Verifikasi dan update dokumentasi lengkap:
  - Backend routes: 91 files verified ✅
  - Frontend pages: 32 → **35 modules** ✅
  - Database models: 48 → **49 files** ✅
  - R&D Module: 1 → **8 backend files** (rd_projects, rd_experiments, rd_materials, rd_products, rd_reports, rd_extended, rd_integration)
  - New modules added: Face Recognition, Live Monitoring, Material Stock, Converting, Desk/Workspace
  - Total code: 811 files → **816+ files**, 304K → **310K+ lines**

### ✨ v3.1 — April 2026
- **Overhaul RBAC** — 40+ peran, 200+ izin, kontrol akses level modul
- **Izin DCC** — Modul `dcc` dengan 5 aksi (view, create, edit, delete, approve) di-assign ke 13 peran
- **Izin Akuntansi** — Modul `accounting` dengan 5 aksi di-assign ke peran keuangan
- **Izin Daftar Periksa Pra-Shift** — Modul baru untuk pemeriksaan keselamatan K3
- **CAPA: Referensi Penyimpangan Mutu** — Field input manual nomor dokumen penyimpangan saat sumber CPAR = PM
- **Sidebar RBAC** — Pemeriksaan izin untuk DCC & Akuntansi di sidebar frontend
- **Perbaikan Sidebar DCC** — Active state yang sadar query untuk navigasi berbasis tab
- **Upgrade Script Seed** — Sekarang update peran yang ada dengan izin baru (tidak skip)
- **Grup Chat** — Dapat diakses semua pengguna tanpa pemeriksaan izin

### ✨ v3.0 — Maret 2026
- **Modul DCC** — Pusat Kontrol Dokumen dengan 13 tabel (ISO 9001:2015)
- **Modul CAPA** — CPAR/SCAR/CCHF dengan penomoran otomatis & RCA 5-Why
- **Memo Internal** — Komunikasi antar departemen dengan tanda terima baca
- **Pemusnahan Dokumen** — Berita acara pemusnahan (FRM-DCC-14)
- **Rekaman Kualitas** — Daftar induk rekaman mutu (FRM-DCC-03)

### ✨ Fitur Sebelumnya (v2.1 — Januari 2026)
- **Modul Stok WIP** — Pelacakan stok Work In Progress per produk
- **Daftar Packing Terpisah** — Daftar packing independen dari Work Order
- **Modul R&D Ditingkatkan** — **8 file backend**: Proyek, Eksperimen, Material, Produk, Laporan, Tambahan, Integrasi
- **Absensi Publik** — Absensi berbasis Kode QR

### ✨ Fitur Sebelumnya (v2.0)
- **Modul Tujuan Kualitas** — Target manual per mesin, pelacakan pencapaian
- **Analisis Downtime** — Top 3 downtime, analisis akar masalah
- **Enhanced QC Workflows** — Incoming, In-Process, Finish Good QC

---

## 🎯 Panduan Mulai Cepat

### 1. Sistem Login
- URL: `http://localhost:5173`
- Admin Default: `admin / admin123`

⚠️ **PENTING:** Ganti password default segera setelah setup pertama untuk keamanan sistem!

### 2. Akses Modul Utama
- **Produksi**: Work Orders → Daily Controller → Quality Objective
- **Kualitas**: Incoming → In-Process → Finish Good QC
- **Penjualan**: Customers → Orders → Quotations
- **Inventori**: Items → Stock → Transactions

### 3. Alur Kerja Tujuan Kualitas
1. Buka **Produksi → Quality Objective**
2. Pilih tahun/bulan
3. Klik **"Set Target"** untuk input target bulanan per mesin
4. Lihat tingkat pencapaian dan status
5. Klik **"Analisa Downtime"** untuk analisis detail

---

## 📞 Kontak & Dukungan

**Mochammad Bayu Adhie Nugroho**
- 📧 Email: baymngrh@gmail.com
- 🐙 GitHub: [@bayuadhie-dev](https://github.com/bayuadhie-dev)

Untuk dukungan teknis, permintaan fitur, atau laporan bug, silakan email kami di baymngrh@gmail.com

---

**© 2025-2026 Mochammad Bayu Adhie Nugroho. All Rights Reserved.**

---

## 🎯 Peta Jalan

### Selesai ✅
- 18+ modul utama, 100+ sub-modul
- **816+ file**, **310,000+ baris kode**, **269 tabel database**
- Autentikasi & otorisasi (JWT + OAuth)
- 15+ alur kerja otomatis end-to-end
- Asisten AI terintegrasi dengan grafik
- Dashboard Eksekutif dengan KPI real-time
- Modul DCC & CAPA (ISO 9001:2015) — 13 tabel
- Modul Stok WIP & Daftar Packing
- Tujuan Kualitas & Analisis Downtime
- Modul R&D dengan alur kerja persetujuan

### Sedang Dikerjakan 🚧
- Pelaporan lanjutan dengan ekspor
- Frontend DCC yang ditingkatkan (operasi massal, pencarian lanjutan)

### Direncanakan 📋
- Analitik prediktif AI/ML
- Integrasi IoT untuk mesin produksi
- Aplikasi mobile (React Native)
- Dukungan multi-pabrik

---

<div align="center">

## 🏆 Pencapaian

- ✅ **816+ File** | **310,000+ Baris Kode** | **269+ Tabel DB**
- ✅ **18+ Modul Bisnis** dengan 100+ Sub-Modul
- ✅ **40+ Peran** | **200+ Izin** | RBAC Penuh
- ✅ **DCC & CAPA** Sesuai ISO 9001:2015
- ✅ **15+ Alur Kerja Otomatis** End-to-End
- ✅ **Asisten AI** Query Bahasa Alami + Grafik
- ✅ **Dashboard Real-time** 30+ KPI
- ✅ **80+ Endpoint API** Desain RESTful

⭐ Beri bintang repository ini jika bermanfaat!

</div>
