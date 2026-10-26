<div align="center">

# SMITH ERP

Sistem ERP untuk manufaktur nonwoven: dari sales order, produksi, gudang, dan kualitas sampai keuangan, dalam satu aplikasi.

[![CI/CD](https://github.com/bayuadhie-dev/smith/actions/workflows/ci.yml/badge.svg)](https://github.com/bayuadhie-dev/smith/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/bayuadhie-dev/smith/branch/main/graph/badge.svg)](https://codecov.io/gh/bayuadhie-dev/smith)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0+-green.svg)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-18.2+-61dafb.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-3178c6.svg)](https://www.typescriptlang.org/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://github.com/bayuadhie-dev/smith/blob/main/LICENSE)

[Fitur](#fitur-utama) · [Arsitektur](#arsitektur-sistem) · [Modul](#katalog-modul-lengkap) · [Instalasi](#cara-instalasi) · [API](#dokumentasi-api) · [Pembaruan](#pembaruan-terbaru)

</div>

<div align="center">

| Tabel database | File route | File test | Modul |
|:---:|:---:|:---:|:---:|
| 351 | 116 | 101 | ±50 |

</div>

---

## Tampilan

Tangkapan layar dari aplikasi yang berjalan. Nama perusahaan, customer, supplier, dan semua angka di gambar adalah data contoh, bukan data perusahaan. Beberapa kartu bernilai nol karena data contohnya sedikit.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/01_pusat_laporan.jpg" alt="Pusat Laporan Keuangan"><br><sub>Finance: Pusat Laporan Keuangan, dengan tab modul dan tab halaman di atas</sub></td>
<td width="50%"><img src="docs/screenshots/02_neraca_saldo.jpg" alt="Neraca Saldo"><br><sub>Finance: Neraca Saldo dengan saldo awal, mutasi, saldo akhir, dan cek keseimbangan</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/03_rekap_kas_harian.jpg" alt="Rekap Kas Harian"><br><sub>Finance: Rekap Kas Harian per hari dan per rekening</sub></td>
<td width="50%"><img src="docs/screenshots/04_kartu_piutang.jpg" alt="Kartu Piutang per Customer"><br><sub>Finance: Kartu Piutang per Customer</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/05_rekap_ppn.jpg" alt="Rekap PPN"><br><sub>Finance: Rekap PPN Keluaran dan Masukan per bulan</sub></td>
<td width="50%"><img src="docs/screenshots/06_produksi.jpg" alt="Dashboard Produksi"><br><sub>Produksi: dashboard SPK aktif, mesin, dan menu modul</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/07_warehouse.jpg" alt="Dashboard Gudang"><br><sub>Warehouse: produk, nilai persediaan, dan lokasi</sub></td>
<td width="50%"><img src="docs/screenshots/08_purchasing.jpg" alt="Daftar Purchase Order"><br><sub>Purchasing: daftar PO dengan status dan mata uang asing</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/09_sales_orders.jpg" alt="Daftar Sales Order"><br><sub>Sales: daftar sales order dengan status dan total</sub></td>
<td width="50%"><img src="docs/screenshots/10_hr_dashboard.jpg" alt="Dashboard HR"><br><sub>HR: karyawan, kehadiran, cuti, dan menu HR</sub></td>
</tr>
<tr>
<td colspan="2"><img src="docs/screenshots/11_maintenance.jpg" alt="Dashboard Maintenance"><br><sub>Maintenance: SPK, uptime, MTTR, dan biaya</sub></td>
</tr>
</table>

---

## Tentang Sistem

Sistem ERP Nonwoven adalah aplikasi manajemen perusahaan yang terintegrasi penuh, didesain khusus buat industri manufaktur nonwoven. Sistem ini ngatur semua proses bisnis dari penjualan, produksi, quality control, sampai keuangan dalam satu platform yang terpadu.

### Ringkasan

- Backend Flask REST API dan frontend React + TypeScript, database PostgreSQL
- Sekitar 50 modul: penjualan, produksi, gudang, pembelian, keuangan, HR, kualitas, aset, R&D, dan lainnya
- Alur sales order sampai pengiriman dan faktur terhubung (Sales → MRP → Produksi → QC → Shipping → Finance)
- Akses berbasis role dengan permission per modul dan aksi
- Antarmuka Indonesia dan Inggris
- Workspace bertab: beberapa halaman terbuka dalam satu jendela, isian form tetap ada setelah refresh
- Pusat Laporan Keuangan: neraca saldo, mutasi bank, rekap kas harian, kartu piutang/hutang, PPN; bisa diekspor ke Excel dan PDF
- Pencarian global dan pembuat laporan kustom

---

## Fitur Utama

| Area | Fitur |
|---|---|
| Dashboard & Analitik | Dashboard Eksekutif · Production Monitoring Real-time · Dashboard Real-time · Scorecard Kinerja · Performer Terbaik · Peringatan Kritis · Pelaporan · Analisis Data · Analisis Prediktif |
| Manufaktur | Perencanaan Produksi · Pelacakan OEE · Kontrol Kualitas · SPC (Statistical Process Control) · Manajemen Pemeliharaan · Converting Production |
| Operasional | Penjualan & CRM · Pembelian · Manajemen Inventori · Keuangan & Akuntansi · Expense & Reimbursement |
| Pengalaman Pengguna | Workspace dua tingkat · Format angka otomatis · ConfirmDialog & Toast · Dashboard bento & tema Axion · Print Designer |
| Sumber Daya Manusia | Manajemen Karyawan · Face Recognition · Sistem Penggajian · Penilaian Kinerja · Pelatihan & Pengembangan · Work Roster Management |
| Riset & Pengembangan | Manajemen Proyek R&D · Pengembangan Produk · Riset Material · RND Workflow |

Rincian tiap fitur ada di bagian modul di bawah.

---

## Perbandingan dengan SAP

> [!NOTE]
> Fitur yang mengikuti konsep SAP, beserta lokasi implementasinya di kode (diperbarui Oktober 2026).

### MM (Materials Management)

| Fitur | Konsep SAP | Implementasi |
|---|---|---|
| 3-Way Match | SAP MM 3-Way Match | PO → GRN → Invoice divalidasi (`routes/purchase_invoice.py`) |
| Movement Type codes | SAP MIGO (101/261/311/601/701) | `derive_movement_type_code()` - mapping persis gaya SAP |
| Auto Stock Reservation FIFO by Document Date | SAP MRP reservation | `process_auto_reserve_queue()` - urut berdasar document date, bukan waktu request masuk |
| Vendor Scorecard | SAP MM Supplier Evaluation | `compute_vendor_scorecard()` - on-time delivery, quality reject rate, price variance |
| Budget Commitment (PO Reserve) | SAP MM Commitment Management | `reserve_po_budget_commitment()` - reservasi anggaran saat PO approved |
| Source List | SAP ME01 | `ApprovedVendor` - PO ditolak kalau supplier bukan yang terdaftar untuk material tersebut (`routes/purchasing.py`) |
| Release Strategy | SAP ME28/ME29N | Ambang nilai PO menentukan perlu tidaknya langkah review/persetujuan (`routes/purchasing.py`) |
| Invoice Blocking | SAP MIRO blocking | Selisih harga/kuantitas pada 3-way match menahan faktur sampai di-release (`routes/purchase_invoice.py`) |
| GRN wajib PO approved | SAP MIGO 101 ref. PO | Penerimaan barang tidak bisa dibuat kalau PO (termasuk PO valas) masih draft |

### PP (Production Planning)

| Fitur | Konsep SAP | Implementasi |
|---|---|---|
| MRP Time-Phased dengan Low-Level Code | SAP MD01/MD02 | `mrp_engine.py` - weekly buckets, netting WIP, multi-level BOM, lead-time offsetting |
| BOM Explosion Rekursif + Circular Detection | SAP CS01 | `bom_explosion.py` - `CircularBOMError`, `MaxDepthExceededError`, depth limit 10 |
| Batch Scheduling 3-Layer Calendar | SAP Work Center Calendar | MachineCalendarOverride > ExceptionCalendar > GlobalCalendar |
| Capacity-based Scheduling + Timeline Walk | SAP CRP | `_build_timeline()` + `_consume()` - alokasi per slot shift per mesin |
| WIP Job Costing (Material+Labor+Overhead) | SAP CO-PC | `WIPBatch` dengan pemisahan 3 komponen biaya; saldo WIP per SPK dibaca dari GL |
| MRP Lot Sizing | SAP MRP lot size (EX/FX/WB/MB) | `_lookup_lot_sizing()` di `mrp_engine.py` - lot-for-lot, fixed, weekly, monthly per material |
| Tutup SPK (Order Settlement) | SAP CO88 | Gate konsumsi BOM + waste + packing sebelum SPK bisa `complete`; pembatalan SPK/konfirmasi membalik gudang |

### SD (Sales & Distribution)

| Fitur | Konsep SAP | Implementasi |
|---|---|---|
| ATP (Available to Promise) | SAP SD ATP Check | `check_atp()` - `free_to_promise = on_hand - committed_elsewhere`, hindari double-promise |
| Sales Order Workflow Engine | SAP SD Order Management | `confirm_order_core()` - atomic commit satu transaksi |
| Forecast Auto-Bump dari SO | SAP Demand Management | SO confirmed otomatis update target forecast kalau melampaui |
| Sales Forecast Grid (rolling 12 bulan, multi-skenario) | SAP SOP | Multi-header forecast, tumpang tindih skenario |
| Pricing Procedure | SAP SD condition technique | `utils/pricing_procedure.py` + `/api/sales/pricing/calculate`, kondisi harga di `/api/sales/pricing-conditions` |
| Customer-Material Info Record | SAP VD51 | `/api/sales/customer-material-info` |
| Nota Kredit Customer | SAP FB75 / credit memo | Kelebihan retur di atas faktur menjadi `CreditMemo`; bisa dipakai ke faktur lain atau di-refund, dan bisa di-undo dengan jurnal pembalik |

### FI/CO (Finance & Controlling)

| Fitur | Konsep SAP | Implementasi |
|---|---|---|
| GL Account Resolution 3-Level | SAP Account Determination (OBYC) | `resolve_account()` - item override → category default → global default |
| Journal Balancing Check | SAP FI Posting | Jurnal tidak bisa posting kalau `debit != credit` |
| Pending Journal → Approved → Posted | SAP FI Document Workflow | `PendingJournalEntry` → approval → `AccountingEntry` |
| Closing Period (Cockpit-lite) | SAP MMPV/Closing Cockpit | Lihat section Finance & Accounting di atas |
| Posting Period per jenis akun | SAP OB52 (variant per account type) | Tabel `period_account_type_locks` - periode dikunci terpisah per bucket subledger (Debitur/Kreditur/Aset/Material/GL) |
| Mata uang asing + selisih kurs | SAP FB05 + F.05 | Hutang valas dilunasi dalam IDR pada kurs faktur; selisih ke akun Selisih Kurs (`fx_difference_line()`) |
| Chart of Accounts kompatibel Accurate | - | Peran akun (kas, piutang, PPN, HPP, dll.) dideteksi lewat `utils/coa_roles.py`, jadi laporan jalan di CoA Accurate maupun CoA lama |

### QM (Quality Management)

| Fitur | Konsep SAP | Implementasi |
|---|---|---|
| SPC dengan Western Electric Rules | SAP QM SPC | `check_western_electric_rules()` - Rule 1-4, faktor ASTM/ISO A2/D3/D4/d2 |
| UCL/LCL Control Chart | SAP QM Control Charts | X-bar R chart, faktor subgroup 2-10 |
| Ubah Status Batch (MSC2N) | SAP MSC2N | Ubah status batch dengan alasan wajib + audit log (`/api/qc-batch-status`); pemecahan kuantitas ke beberapa status lewat `inventory-disposition`; karantina otomatis batch kedaluwarsa via scheduler |
| QC Disposition (Quarantine/Reject) | SAP QM Usage Decision | Status quarantine/reject dikecualikan otomatis dari FIFO picking |

### PM (Plant Maintenance) + Warehouse Extras

| Fitur | Konsep SAP | Implementasi |
|---|---|---|
| OEE (Availability × Performance × Quality) | SAP OEE Monitoring | Per mesin per shift, Grade A/B/C |
| MB51 - Material Document List | SAP MB51 | Lihat section Warehouse & Inventory di atas |
| Handling Unit Management | SAP HUM | `HandlingUnit` (palet/kemasan) dengan persen isi palet parsial, endpoint di `/api/shipping` (`routes/handling_unit.py`) |
| MB56 - Batch Traceability | SAP MB56 | `/reports/batch-traceability/{batch}` - lacak 1 batch lintas InventoryTransaction + MaterialConsumption + WIPMovement |
| EWS - ML Prediction Downtime | *(tidak ada di SAP standar)* | Random Forest (`model_ews_rich.pkl`) - SAP sendiri butuh add-on berbayar (SAC/BTP) untuk ini |

### HCM (Human Capital Management)

| Fitur | Konsep SAP | Implementasi |
|---|---|---|
| Multi Pay-Type (6 jenis) | SAP Payroll IT0008 | fixed/monthly/weekly/daily/piecework/outsourcing |
| PPh 21 DTP + TER PP 58/2023 | SAP Tax Schema | Dihitung TER (3 kategori, 40+ bracket) tapi ditanggung perusahaan, tidak dipotong gaji |
| Payroll → GL (PY-FI) | SAP PY-FI Integration | `post_payroll_journal()` - Dr Beban Gaji/PPh21 DTP, Cr Hutang masing-masing |
| Time & Attendance (GPS + Face) | SAP PA-TM | Geofencing Haversine + face detection OpenCV |
| Leave, Appraisal, Training, Roster, Skill Matrix | SAP PA/PD/LSO | Lihat section HR & Payroll di atas |

> [!NOTE]
> EWS (prediksi downtime dengan Random Forest) dan PPh 21 DTP + clock-in dengan deteksi wajah tidak punya padanan di SAP standar. Keduanya dibuat untuk kebutuhan lokal.

> [!NOTE]
> Cakupannya MM, PP, SD, FI/CO, QM, PM, WM, dan HCM, dengan kedalaman yang berbeda-beda per area. Sistem ini bukan pengganti SAP penuh.

---

## Arsitektur Sistem

```mermaid
flowchart TB
    subgraph FE["Frontend"]
        A["React 18 + TypeScript<br/>Redux Toolkit, React Router 7, Tailwind"]
    end
    subgraph BE["Backend"]
        B["Flask 3 + SQLAlchemy 2<br/>JWT, Flask-SocketIO"]
        J["APScheduler<br/>job terjadwal"]
    end
    subgraph DATA["Data"]
        D[("PostgreSQL<br/>351 tabel")]
        R[("Redis<br/>cache")]
    end
    W["OpenWA<br/>gateway WhatsApp"]
    A -- "REST + WebSocket" --> B
    J --> B
    B -- "ORM" --> D
    B -- "cache" --> R
    B -- "notifikasi" --> W
```

---

## Teknologi yang Dipakai

### Backend
| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| Python | 3.11+ | Bahasa utama (CI 3.11, server produksi memakai versi lebih baru) |
| Flask | 3.0+ | Framework web |
| SQLAlchemy | 2.0+ | ORM |
| Flask-JWT-Extended | 4.6+ | Autentikasi |
| Flask-SocketIO | 5.6+ | WebSocket real-time (mode `threading`) |
| PostgreSQL / psycopg2 | 15+ / 2.9 | Database produksi |
| Redis / Flask-Caching | 5.0+ / 2.1 | Cache (prefix `erp_`, 300 dtk) |
| APScheduler | 3.10+ | Job terjadwal (karantina batch kedaluwarsa, eskalasi persetujuan, dll.) |
| Flask-Limiter / Flask-Talisman | 3.5+ / 1.1 | Rate limit & header keamanan |
| scikit-learn / joblib | - | Memuat model EWS (`.pkl`) - belum tercantum di `requirements.txt`, install manual |
| Flask-CORS | 4.0+ | Dukungan cross-origin |
| Flask-Migrate | 4.0+ | Migrasi database |
| Pytest | 7.4+ | Framework pengujian (101 file test) |
| Bcrypt | 4.1+ | Enkripsi password |
| openpyxl | 3.1+ | Export Excel |
| reportlab | 4.0+ | Export PDF |

### Frontend
| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| React | 18.2+ | Framework UI |
| TypeScript | 5.2+ | Keamanan tipe |
| Redux Toolkit | 2.0+ | Manajemen state |
| React Router | 7.x | Routing (dengan router kustom per tab workspace) |
| Tailwind CSS | 3.3+ | Styling |
| Recharts | 2.15+ | Visualisasi data & SPC Charts (Chart.js sebagai pelengkap) |
| Vite | 8.x | Build tool (dev server port 3000, proxy `/api` → 5000) |
| Vitest | 4.x | Pengujian frontend |
| Axios | 1.6+ | Klien HTTP |
| TanStack Table | 8.x | Tabel data |
| React Hook Form | 7.x | Form |
| Framer Motion / lucide-react | 10.x / 0.5x | Animasi & ikon |

---

## Modul-Modul

Klik judul modul untuk membuka rinciannya.

<details>
<summary><b>1. Modul Sales & Marketing</b></summary>

Fitur:

- Manajemen Customer (CRM) - lead, kontak, akun
- Sales Order & Quotation dengan workflow approval - quotation bisa dikonversi ke SO; SO punya ATP preview (`check_atp()`), preview kapasitas produksi, konfirmasi + mulai produksi, dan konfirmasi dengan shipment sekaligus
- Sales Forecast - daftar forecast + grid forecast (rolling 12 bulan, multi-skenario), approval, dan konversi massal forecast ke Sales Order
- Pricing Procedure (kondisi harga, diskon) dan Customer-Material Info Record - lihat tabel Perbandingan dengan SAP
- Proses Return Customer (QC, disposisi, analitik) - kelebihan retur di atas faktur menjadi Nota Kredit (lihat modul Finance)
- Invoice & Payment Tracking (faktur penjualan dikelola di modul Finance)
- Sales Pipeline: lead, opportunity, aktivitas, pipeline
- Laporan Penjualan - per customer, per item, per gudang, grafik penjualan, dan riwayat proses SO; dashboard analitik penjualan

Endpoint API:
```bash
GET/POST   /api/sales/customers
GET/POST   /api/sales/leads | /opportunities | /activities
GET/POST   /api/sales/orders                      # + /:id/confirm, /cancel, /atp-preview,
                                                  #   /production-capacity-preview, /confirm-and-start-production,
                                                  #   /confirm-with-shipment, /create-shipment
GET/POST   /api/sales/quotations                  # + /:id/convert
GET/POST   /api/sales/forecasts                   # + /:id/approve, /:id/lines, /:header_id/bulk-convert-to-order
GET        /api/sales/pricing/calculate           # + /pricing-conditions (CRUD)
GET/POST   /api/sales/customer-material-info
GET        /api/sales/reports/sales-per-customer | sales-per-item | sales-per-warehouse | sales-charts | sales-process-history
GET        /api/sales/analytics/dashboard
GET/POST   /api/returns                           # + /:id/qc, /:id/disposition, /analytics
```

</details>

<details>
<summary><b>2. Modul Produksi</b></summary>

Fitur:

- Manajemen Work Order (CRUD, BOM, approval)
- Scheduling Produksi (Schedule Grid visual)
- Input Produksi Per Shift (Shift 1/2/3 + sub-shift a/b/c)
- Recording & Analisa Downtime dengan kategorisasi
- Kalkulasi OEE (Availability × Performance × Quality)
- Manajemen Mesin
- Weekly Production Planning & Monthly Production Plan, plus Production Planning (MPS)
- Batch Planning & Batch Scheduling - pemecahan WO menjadi batch/SPK, kalender 3 lapis (global, pengecualian, override mesin), jadwal ulang batch, cetak ulang SPK
- SPK & Tutup SPK - konfirmasi bahan aktual (pemilihan batch manual selain saran FIFO), tutup batch (`/batches/:id/close`), batalkan konfirmasi, log staging gudang per SPK (`/api/spk`), barang jadi pindah ke Gudang Barang Jadi saat tutup SPK
- Batch Record (GMP) dengan daftar, detail, dan laporan mingguan
- Work Order Monitoring Real-time (Kanban + timeline + breakdown impact)
- Daily, Weekly & Monthly Controller Dashboard
- Pre-Shift Checklist per mesin (belum menjadi gate yang memblokir produksi) dan Live Monitoring dashboard
- Product Changeover, Material Issue (dengan daftar kekurangan), dan Efficiency Tracking
- Produksi Approval Workflow
- Traceability per Work Order
- MBF Report - Machine Block Format reporting per mesin
- Breakdown Summary - Rekap breakdown mesin
- FG Conversion - Konversi produk Finish Good (backend dan UI ada, tetapi belum diadopsi staf pabrik; datanya masih kosong)
- WIP Batch Management - Manajemen batch WIP
- Work Center Dashboard - Ringkasan status & OEE seluruh mesin per hari, dengan breakdown downtime per kategori (mesin, operator, material, design, others) dan navigasi tanggal historis
- Early Warning System (EWS) - Prediksi risiko downtime shift produksi berbasis Machine Learning (Random Forest) dengan fitur lag, rolling average, auto-scoring background thread, dan rescoring manual

Input Produksi Per Shift:

- Entry data per shift (Shift 1, 2, 3) dengan sub-shift a/b/c
- Tracking target vs actual quantity
- Quantity Good, Reject, Rework
- Runtime dan downtime (menit)
- Assignment operator dan supervisor
- Kalkulasi OEE otomatis
- Konsumsi material otomatis dari BOM

Kategori Downtime:

- Planned: Maintenance, Setup, Changeover
- Unplanned: Breakdown, Kekurangan material, Masalah quality
- Idle Time: Tunggu material, tunggu stiker, tunggu packaging
- Early Stop: Tracking shift berakhir lebih awal dengan alasan

Endpoint API:
```bash
GET/POST   /api/production/work-orders            # + /:id/start, /complete, /status, /bulk-complete, /:id/bom
GET        /api/production/machines
GET        /api/production/work-center-summary
GET        /api/oee/daily-controller              # + /weekly-controller, /monthly-controller, /downtime
GET/POST   /api/production-input/shift-productions  # input produksi per shift + /downtime-records
GET/POST   /api/production/schedule-grid          # + /:id/generate-wo, /generate-wo-batch
GET/POST   /api/production/weekly-plans           # + /:id/items
GET        /api/work-orders/monitoring            # + /breakdown-summary, /:id/timeline, /:id/breakdown-impact
GET/POST   /api/mbf-report/reports                # + /:id/submit, /approve, /reject
GET/POST   /api/fg-conversion/list | /create      # + /:id/complete, /loss-report
GET/POST   /api/batch-scheduling/batches          # + /batches/approve, /calendar/*, /generate-replan
PUT        /api/production/batches/:id/close      # + /cancel-confirmation (Tutup SPK)
GET        /api/spk/:wo_id/completion-records     # + /material-breakdown, /warehouse-history
GET/POST   /api/pre-shift-checklist | /api/live-monitoring
GET        /api/ews/predictions
GET        /api/ews/predictions/:id
GET        /api/ews/summary
POST       /api/ews/rescore/:id
```

</details>

<details>
<summary><b>3. Modul WIP Stock & Packing List</b></summary>

Fitur:

- WIP Stock Management - Tracking stok Work In Progress per produk
- WIP Stock Movement - History pergerakan stok WIP (in/out/adjustment)
- WIP Dashboard - KPI dan monitoring stok WIP
- Packing List per Work Order - Dikelola lewat tab Packing List di detail WO (sinkronisasi dari produksi, item manual)
- Carton Weighing - Input berat per karton, termasuk pratinjau penimbangan via OCR (Gemini)
- Batch Mixing - Pencampuran batch produksi
- Pack Per Carton - Otomatis dari data products_new

Workflow:
```
Work Order Production → WIP Stock (per product) →
Packing List (per order) → Carton Weighing → Shipping
```

Endpoint API:
```bash
GET/POST   /api/production/work-orders/:wo_id/packing-list            # + /sync, /items
POST       /api/production/work-orders/:wo_id/packing-list/batch-mixing
POST       /api/production/work-orders/:wo_id/packing-list/ocr-weigh-preview
GET        /api/fg-conversion/wip-stock/:product_id
```

> [!NOTE]
> Halaman WIP Stock (`/app/production/wip-stock`) masih memanggil `/api/packing-list/wip-stock*` (stok, penyesuaian, movement) yang tidak ada di backend saat ini - endpoint itu hilang saat packing list dipindah ke per-WO, jadi halaman tersebut belum berfungsi sampai endpoint-nya dibuat ulang.

</details>

<details>
<summary><b>4. Modul Quality Control</b></summary>

Fitur:

- Quality Inspection (Incoming, In-process, Final) dengan halaman detail inspeksi (`QualityInspectionDetail`)
- Pending QC - antrean Work Order yang menunggu QC; form QC per Work Order (`/api/quality/work-order/:id/qc-test`) dan detail QC barang jadi
- Disposisi QC & transfer ke gudang - `set-disposition` per inspeksi lalu `transfer-to-warehouse` (halaman *QC → Gudang*); `inventory-disposition` mendukung pemecahan kuantitas ke beberapa status sekaligus (misal 9.900 release + 100 reject) lewat `apply_qc_disposition_splits()` dengan jejak histori kuantitas
- Ubah Status Batch (gaya SAP MSC2N) - halaman `quality/batch-status` (`/api/qc-batch-status`): ubah status satu batch ke arah mana saja (release/quarantine/reject; available/quarantine/reject untuk material) dengan alasan wajib yang tercatat di Audit Log; saat batch keluar dari quarantine/reject, permintaan material yang menunggu stok otomatis dicoba reservasi ulang
- Auto-karantina batch kedaluwarsa - job harian (APScheduler) memindahkan batch yang melewati `self_life_days`/`retest_period_days` ke status quarantine
- Tracking & Analisa Defect
- CAPA (Corrective & Preventive Actions) - versi ringan di `/api/quality/capa`; CAPA penuh ber-nomor ISO ada di modul DCC & CAPA
- Metrik & KPI Quality, Analytics (`QualityAnalytics`)
- Alert & Notifikasi Quality (acknowledge/resolve)
- Audit Quality dan Target Quality
- Manajemen Training & Kompetensi
- Pre-Shift Checklist (di menu Production, `/api/pre-shift-checklist`) - checklist kondisi mesin sebelum shift: item umum dan per-mesin, submit checklist, ringkasan mingguan, daftar item NG, tindakan korektif + catatan supervisor, dan audit log per jawaban. *Belum ada gate yang memblokir produksi saat ada item NG.*
- EWS (Early Warning System) - halaman `/app/ews` dan `/api/ews`: skor risiko downtime per shift produksi (Random Forest), ringkasan, dan *rescore* manual

Quality Objective Module:

- Target Manual Per Mesin - Input target bulanan (penyusutan, maintenance)
- Pencapaian Produksi - Target vs actual per mesin dengan status tercapai/tidak
- Top 3 Downtime Analysis - Exclude design change, idle, istirahat
- Root Cause Analysis - Problem → Root Cause → Corrective → Preventive Action
- Downtime by Category - Grafik visual downtime per kategori (mesin, operator, material)
- Achievement Tracking - Persentase pencapaian, quality rate, working days
- Export Excel & PDF - Export data "Top 3 Penyebab Target Tidak Tercapai"

Endpoint API:
```bash
# Quality Objectives
GET    /api/oee/quality-objectives/production
GET/POST /api/oee/machine-monthly-targets
POST   /api/oee/machine-monthly-targets/bulk
GET    /api/oee/machine-downtime-analysis
GET/POST/DELETE /api/oee/downtime-root-causes

# Quality Inspections
GET    /api/quality/incoming-materials             # POST /incoming-materials/:id/inspect
GET    /api/quality/in-process                     # POST /in-process/:wo_id/inspect
GET    /api/quality/pending-qc
GET/POST /api/quality/work-order/:wo_id/qc-test    # GET /work-order/:wo_id/detail (QC barang jadi)
GET/POST /api/quality/inspections                  # GET /inspections/:id
POST   /api/quality/inspections/:id/set-disposition
POST   /api/quality/inspections/:id/transfer-to-warehouse
POST   /api/quality/inventory-disposition          # disposisi + pecah kuantitas
GET    /api/quality/tests | /standards | /capa
# Quality Enhanced
GET    /api/quality-enhanced/dashboard | /analytics | /alerts | /targets | /audits | /training/competency
PUT    /api/quality-enhanced/alerts/:id/acknowledge | /alerts/:id/resolve
# Ubah Status Batch
GET    /api/qc-batch-status/batches
PUT    /api/qc-batch-status/batches/:inventory_id/status
# Pre-Shift Checklist & EWS
GET/POST /api/pre-shift-checklist/items | /submit | /submissions | /ng-items | /weekly-summary
GET    /api/ews/predictions | /summary        # POST /api/ews/rescore/:shift_production_id

# Downtime Actions Export
GET    /api/downtime-actions/export-excel
GET    /api/downtime-actions/export-pdf
```

Workflow Quality:
```
Produksi Selesai → Pending QC → Input QC per Work Order →
Disposisi (release / quarantine / reject, kuantitas bisa dipecah) →
Transfer ke Gudang → Update Metrik & Alert Quality
```

</details>

<details>
<summary><b>5. Modul SPC (Statistical Process Control)</b></summary>

Fitur:

- X-bar & R Chart - Grafik kontrol statistik subgroup per parameter
- Western Electric Rules - Deteksi otomatis 4 aturan out-of-control: 1 titik di luar 3σ; 2 dari 3 titik di luar 2σ; 4 dari 5 titik di luar 1σ; 8 titik berurutan di satu sisi garis tengah
- Capability Analysis - Kalkulasi Cp, Cpk, Cpu, Cpl per produk per parameter
- Subgroup Sample Input - Form input sample terhubung ke Work Order
- Auto Control Limit Calculation - UCL/LCL dihitung otomatis dari minimal 25 subgroup
- Control Limit History - Audit trail perubahan batas UCL/LCL
- Auto-create Specs - Spesifikasi SPC otomatis dari data produk saat sample pertama diinput: GSM (toleransi ±10%), CD dan MD (±15%); parameter lain diisi manual lewat `/api/spc/specs`
- OOC Detection - Penandaan titik out-of-control secara real-time saat input

Parameter (7 baris di tabel `spc_parameters`; di-seed lewat database, belum ada seeder di kode - instalasi baru perlu mengisinya):
| Kode | Nama | UoM | Tipe |
|------|------|-----|------|
| GSM | Gramasi | g/m² | Variable |
| CD | Cross Direction | N/5cm | Variable |
| MD | Machine Direction | N/5cm | Variable |
| THICKNESS | Ketebalan | mm | Variable |
| MOISTURE | Kadar Air | % | Variable |
| PH | pH Level | pH | Variable |
| DEFECT_P | Defect Rate (p) | % | Attribute |

Konstanta SPC (ASTM/ISO):

- Faktor A2, d2, D3, D4 untuk subgroup size n=2 sampai n=10
- Perhitungan UCL = X̄̄ + A2 × R̄, LCL = X̄̄ - A2 × R̄

Database (5 tabel):

- `spc_parameters` - Daftar parameter yang dikontrol
- `spc_product_specs` - Spesifikasi (USL/LSL/UCL/LCL) per produk per parameter
- `spc_samples` - Subgroup sample yang diambil QC
- `spc_measurements` - Nilai pengukuran aktual per sample per parameter
- `spc_control_limit_history` - Histori perubahan control limits

Endpoint API:
```bash
GET        /api/spc/parameters
GET/POST   /api/spc/specs
PUT        /api/spc/specs/:id
GET/POST   /api/spc/samples
GET        /api/spc/samples/:id
GET        /api/spc/chart-data
GET        /api/spc/dashboard
POST       /api/spc/recalculate/:product_id/:parameter_id
```

Frontend Components:

- `SPCDashboard` - Dashboard capability summary + grafik X-bar & R Chart (Recharts), route `/app/quality/spc`
- `SPCSampleForm` - Form input sample subgroup terhubung ke Work Order
- *p-chart untuk `DEFECT_P` (attribute) belum ada - parameter terdaftar tetapi grafiknya masih X-bar/R*

</details>

<details>
<summary><b>6. Modul Warehouse & Inventory</b></summary>

Fitur:

- Tracking Inventory Real-time
- Stock Movement (Receipt, Issue, Transfer)
- Storage Location Real (v3.9) - Area Produksi, Gudang Bahan Baku, Gudang Bahan Kemas, Gudang Barang Jadi (WIP disimpan di sini), Gudang Reject; status batch (release/quarantine/reject) independen dari lokasi fisik
- Alert Stock (Level Min/Max)
- Valuasi Inventory (FIFO, LIFO, Average) - FIFO otomatis mengecualikan stok quarantine/reject
- Cycle Counting & Stock Opname
- Support Barcode/QR Code
- Material Issue untuk Produksi
- Goods Receipt Note (GRN)
- Stock Adjustment dengan Approval
- Handling Unit (palet/kemasan) - pelacakan HU dengan persen isi palet parsial; menutup celah field `package_numbers` yang sebelumnya tidak dipakai (endpoint di `/api/shipping`)
- Stok masuk manual terjurnal - input stok manual memposting Dr Persediaan / Cr Saldo Awal Persediaan dengan biaya per unit yang jelas, bukan lagi diam-diam tanpa jurnal
- Transfer & stock opname sadar-batch - transfer antar lokasi membawa batch yang benar; persetujuan stock opname menerapkan selisih (delta), bukan menimpa saldo

WMS Advanced (Terintegrasi):

- Stok per Work Order - Tracking inventori, WIP, dan konsumsi material per WO, dengan halaman detail per WO
- Konsumsi Material - Planned vs actual material consumption dengan variance tracking; fallback otomatis dari `work_order_bom_items` → master `bom_items` via product BOM
- Transaksi Stok Terpadu (gaya SAP MB51) (v3.10) - Log semua pergerakan stok lintas modul (Purchasing, Production, Shipping, Finance) di satu report: selection screen (tidak auto-load, harus "Jalankan Pencarian"), ALV grid dengan kolom sortable + field catalog custom per user (tersimpan), saldo berjalan (running balance) per baris direkonstruksi read-time via window function, drawer detail 3 tab (Fisik Material/Jurnal Akuntansi/Document Flow), export Excel/CSV. Dipindah ke menu global Reports & Settings (bukan lagi di bawah Warehouse saja, karena datanya lintas modul)
- Pick List Management - Daftar pengambilan barang untuk produksi, pengiriman, transfer
- Transfer Stok - Pemindahan antar zona/lokasi dengan approval workflow
- Cycle Count Schedule - Jadwal stock opname berkala dengan tracking akurasi
- Batch Traceability - Lacak nomor batch di seluruh sistem (inventori, transaksi, WIP)

Frontend Components:

- `WMSDashboard` - KPI dashboard WMS dengan ringkasan inventory, WIP, material consumption
- `StockByWorkOrder` - List WO dengan ringkasan stok FG, WIP, material
- `StockByWODetail` - Detail per WO: FG inventory, material consumption, produksi, transaksi
- `MaterialConsumptionPage` - List material consumption dengan planned vs actual variance
- `TransactionsPage` - Log transaksi stok dengan filter tipe & arah
- `TransactionDetail` - Detail transaksi lengkap (item, lokasi, referensi, biaya, saldo)
- `BatchTraceability` - Lacak batch number di seluruh sistem
- `PickListPage`, `TransferOrderPage`, `CycleCountPage` - Halaman operasional WMS

Endpoint API:
```bash
# Warehouse Basic
GET/POST   /api/warehouse
GET/POST   /api/warehouse/stock
GET/POST   /api/warehouse/transfers
GET/POST   /api/material-issue
GET/POST   /api/stock-opname
GET/POST   /api/stock-input
GET        /api/material-stock

# WMS Advanced
GET        /api/wms/dashboard
GET        /api/wms/stock-by-wo
GET        /api/wms/stock-by-wo/:wo_id
GET/POST   /api/wms/material-consumption
POST       /api/wms/material-consumption/generate/:wo_id
POST       /api/wms/material-consumption/:id/issue
GET/POST   /api/wms/transactions
GET        /api/wms/transactions/:txn_id
GET/POST   /api/wms/pick-lists
GET/POST   /api/wms/transfers
GET/POST   /api/wms/cycle-counts
GET        /api/wms/reports/batch-traceability/:batch_number
```

</details>

<details>
<summary><b>7. Modul Purchasing</b></summary>

Fitur:

- Manajemen Supplier
- Purchase Requisition (PR) dengan approval - konversi ke PO otomatis dipecah per supplier (v3.10) kalau item-item dalam satu PR punya supplier pilihan berbeda-beda, bukan dipaksa satu PO satu supplier
- Purchase Order dengan approval workflow
- Goods Receipt Note (GRN)
- Purchase Invoice & Payment - PPN Masukan dipisah ke akun sendiri di jurnal faktur/retur (sesuai `ppn_code`/header), faktur valas dicatat pada kurs faktur
- Purchase Return - masuk karantina, jurnal GL otomatis, retur valas pada kurs faktur asal
- Goods Receipt wajib PO yang sudah approved - PO (termasuk PO valas) yang masih draft tidak bisa diterima barangnya
- Source List, Release Strategy & Invoice Blocking (konsep SAP MM) - lihat tabel di bagian Perbandingan dengan SAP
- Laporan Pembelian per faktur dan per supplier (kolom Retur, PPN Masukan) di Pusat Laporan Keuangan
- Tracking Performa Supplier
- Perbandingan Harga
- Evaluasi Vendor

Endpoint API:
```bash
GET/POST   /api/purchasing/suppliers
GET/POST   /api/purchasing/purchase-orders
GET/POST   /api/purchasing/goods-receipts
GET/POST   /api/purchasing/purchase-requisitions
GET/POST   /api/purchasing/purchase-invoices
GET/POST   /api/purchasing/purchase-returns
GET        /api/purchasing/reports
```

</details>

<details>
<summary><b>8. Modul Finance & Accounting</b></summary>

Fitur:

- General Ledger (GL)
- Accounts Payable (AP)
- Accounts Receivable (AR)
- Chart of Accounts (CoA)
- Journal Entry
- Planning & Analisa Variance Budget
- Manajemen Cash Flow & Cash Bank
- Report Keuangan (P&L, Balance Sheet, Cash Flow, Laporan Penjualan yang direkonsiliasi ke akun Laba Rugi)
- Cost Accounting (WIP, COGM, COGS)
- Tax Management - PPh 21 TER, PPN Keluaran/Masukan, ekspor e-Faktur/Coretax (Faktur Keluaran dan Nota Retur; NPWP kosong/format salah tetap lolos dengan peringatan)
- Consolidation Antar Entity
- Expense & Reimbursement - Klaim pengeluaran karyawan
- Bank Reconciliation - Import mutasi bank (CSV/Excel) + pencocokan manual terhadap GL
- Commitment/Encumbrance Accounting - PO approval mereservasi budget, invoice/cancel melepasnya
- Penerimaan & Pembayaran Kas/Bank - tiga form terpisah (Penerimaan Penjualan, Pembayaran Pembelian, Kas/Bank mandiri tanpa faktur). Satu pembayaran bisa melunasi banyak faktur sekaligus atau dipecah ke banyak akun; validasi alokasi berlebih, pratinjau jurnal, pemilih customer/supplier dan rekening yang bisa dicari, kolom Dibayarkan kepada / Diterima dari, nomor manual, ubah & void dari UI (void membuat jurnal pembalik), cetak kwitansi A4
- Mata Uang Asing - hutang valas dilunasi dalam IDR pada kurs faktur; selisih kurs ke akun Selisih Kurs; PO/GRN/faktur/retur valas konsisten
- Nota Kredit Customer - kelebihan retur penjualan di atas nilai faktur menjadi credit memo, bisa dipakai ke faktur lain atau di-refund, dan bisa dibatalkan (undo) dengan jurnal pembalik
- Umur Piutang & Hutang (AR/AP Aging) - bucket keterlambatan per customer/supplier; pembayaran menjadi *cleared* otomatis saat dicocokkan di Bank Reconciliation (entri yang di-void tidak muncul di rekonsiliasi)
- Chart of Accounts kompatibel Accurate - struktur akun induk 4-digit dan akun transaksi 6-digit sesuai daftar Accurate Online (459 akun), kode akun otomatis saat membuat akun baru, akun induk bisa dipilih di Buku Besar, riwayat transaksi akun dengan filter periode dan saldo awal/akhir; laporan membaca peran akun lewat `utils/coa_roles.py`
- Pusat Laporan Keuangan (menu Finance → Pusat Laporan) - lihat daftar di bawah
- Proses Akhir Bulan / Closing Period (gaya SAP, v3.10) - bukan cuma kunci on/off sederhana:
  - Kunci berurutan wajib - tidak bisa tutup Maret tanpa tutup Januari/Februari dulu (kecuali closing pertama kali)
  - Reopen guard - tidak bisa buka kembali periode kalau periode setelahnya sudah ditutup (mencegah saldo awal periode berikutnya rusak diam-diam)
  - Kunci parsial per jenis transaksi - tutup AP tanpa menutup jurnal manual, tanpa perlu closing penuh
  - Checklist Closing ("Closing Cockpit" ringan) - item wajib (rekonsiliasi bank, stock opname, aging AR/AP, payroll, dll) yang harus dicentang sebelum bisa closing, bisa di-override eksplisit
  - Peringatan stok negatif (advisory) saat closing
  - Enforcement `is_period_locked()` terpasang di 8 titik penulisan jurnal (Faktur Pembelian/Penjualan, Jurnal Manual, Pembayaran, Expense, Penyusutan Aset, Payroll, Approval Workflow generik)

Pusat Laporan Keuangan (`/app/finance/reports`, API `/api/finance/reports/*`) - hanya jurnal *posted*, dalam IDR; tiap laporan punya filter periode, halaman rincian, dan tombol Excel / PDF / Cetak:

| Laporan | Rincian (drill-down) |
|---|---|
| Neraca Saldo (saldo awal, mutasi, saldo akhir; cek debit = kredit) | Buku besar per akun |
| Mutasi Rekening Bank / Kas (buku bank dengan saldo berjalan) | Dokumen sumber tiap baris |
| Rekap Kas Harian (penerimaan/pengeluaran per hari dan per rekening) | Semua transaksi pada hari itu beserta akun lawan |
| Posisi Kas & Bank (saldo semua rekening per tanggal) | Mutasi per rekening |
| Kartu Piutang per Customer / Kartu Hutang per Supplier | Kartu lengkap (faktur, retur, pembayaran, pengembalian dana, saldo berjalan) |
| Laporan Pembelian (per faktur dan per supplier) | Faktur pembelian |
| Rekap PPN (Keluaran/Masukan per bulan) | Daftar faktur ber-PPN per bulan |
| Perubahan Ekuitas | - |

Ekspor dibuat di server: Excel berformat (blok judul, header berwarna, angka/tanggal terformat, baris total tebal, siap cetak A4) dan PDF sungguhan (reportlab, header berulang tiap halaman, nomor halaman). Tombol Cetak membuka PDF itu di tab baru. Saldo laporan direkonsiliasi ke GL (misalnya total kartu piutang = saldo akun piutang).

WIP Accounting & Job Costing:

- WIP Ledger per Work Order
- Tracking cost Material, Labor, Overhead
- Analisa Variance (Material, Labor, Overhead, Yield)
- Auto-posting ke GL
- Flow COGM → Finished Goods → COGS
- Job Costing per Work Order

Frontend Pages (50 halaman):
Dashboard, General Ledger, Chart of Accounts, Accounts Payable, Accounts Receivable, Budget Planning & Forecasting, Cash Flow, Cash Bank Management, Penerimaan/Pembayaran/Kas-Bank (list, form, detail), Nota Kredit, Aging, Financial Reports, Pusat Laporan (12 halaman laporan + rincian), Bank Reconciliation, WIP Ledger, Tax Management, Consolidation, Costing & Controlling, Invoice Management, Expense & Reimbursement, Proses Akhir Bulan (Closing Period)

Endpoint API:
```bash
GET/POST   /api/finance/accounts
GET/POST   /api/finance/journals
GET/POST   /api/finance/transactions
GET        /api/finance/reports
GET/POST   /api/finance/bank-reconciliation
GET/POST   /api/finance/payments                    # + /:id, /:id/void, /next-number
GET/POST   /api/finance/credit-memos                # + /:id/apply, /:id/refund, /applications/:id/undo
GET        /api/finance/reports/aging               # umur piutang & hutang
GET        /api/finance/invoices/efaktur-export     # + /efaktur-retur-export (Nota Retur)
GET        /api/finance/chart-of-accounts/next-code # kode akun otomatis
# Pusat Laporan (semua mendukung ?format=xlsx atau ?format=pdf)
GET        /api/finance/reports/trial-balance
GET        /api/finance/reports/account-ledger
GET        /api/finance/reports/cash-accounts
GET        /api/finance/reports/cash-daily          # + /cash-daily-detail
GET        /api/finance/reports/cash-position
GET        /api/finance/reports/party-statements    # + /party-statement/:kind/:id
GET        /api/finance/reports/purchase-report
GET        /api/finance/reports/vat-summary         # + /vat-detail
GET        /api/finance/reports/equity-changes
GET/POST   /api/finance/period-close
DELETE     /api/finance/period-close/:id          # reopen (dengan guard)
GET/POST   /api/finance/closing-tasks             # checklist closing
GET/POST   /api/finance/period-transaction-locks   # kunci parsial per jenis transaksi
GET/POST   /api/wip-accounting
GET/POST   /api/wip-job-costing
GET/POST   /api/expenses
GET/POST   /api/expenses/reimbursements
```

</details>

<details>
<summary><b>9. Modul HR & Payroll</b></summary>

Fitur:

- Manajemen Karyawan (profil, jabatan, departemen, org hierarchy dengan `manager_id`)
- Absensi & Cuti - satu sistem terpadu (v3.10, konsolidasi dari 2 sistem paralel yang sebelumnya tidak sinkron): ESS self-submit, approval berjenjang (manager departemen → HR), geofencing lokasi kantor multi-titik, kalender cuti
- Kuota/Saldo Cuti Tahunan (v3.10) - dihitung real-time dari pengaturan `hr.annual_leave_days`, submit otomatis ditolak kalau kuota habis, sisa jatah tampil langsung di form pengajuan
- Koreksi & Rekonsiliasi Absensi (v3.10) - karyawan bisa ajukan koreksi kalau lupa clock-in/out; cross-check otomatis antara Absensi dan log produksi operator (shift_productions) untuk temukan selisih tanpa auto-koreksi
- Jadwal Kerja Staff Kantor (v3.10) - jadwal jam kerja per karyawan (terpisah dari roster shift produksi), menentukan keterlambatan/lembur secara individual, bukan satu jam kantor global untuk semua orang
- Face Recognition Attendance (real-time dengan face-api.js) + validasi GPS radius kantor
- Public Attendance (QR Code tanpa login)
- Proses Payroll - 6 tipe gaji (bulanan/mingguan/harian/borongan/outsourcing/tetap), PPh 21 TER PP 58/2023 ditanggung perusahaan, BPJS otomatis, segregation-of-duty (v3.10: penghitung payroll tidak bisa approve hasil hitungannya sendiri)
- Performance Appraisal - alur cycle → self-review → manager-review berjenjang (v3.10: manager tidak bisa menilai duluan sebelum karyawan self-review)
- Training & Development
- Manajemen Roster Shift (drag & drop)
- Piecework Log (tracking borongan)
- Laporan HR (v3.10) - 5 jenis laporan (karyawan, kehadiran, cuti, payroll, headcount per departemen) dengan export Excel & PDF
- Outsourcing Vendor Management
- Portal Self-Service Karyawan

Integrasi Roster:

- Data karyawan dari modul HR
- Data mesin dari modul Produksi
- Assignment berbasis shift
- Interface drag & drop
- View roster mingguan & bulanan

Frontend Pages (33 file halaman):
HR Dashboard, Employee List & Form, Attendance Management & Admin, Attendance Calendar & Report, Absen Belum Clock-out, Koreksi & Rekonsiliasi Absensi, Jadwal Kerja Staff Kantor, Staff Leave Management (cuti terpadu), Payroll List, Periode & Records, Appraisal Management (siklus penilaian), Training Management, Roster Management (Drag & Drop), Work Roster Weekly, Departments, Manajemen Posisi/Jabatan, Face Admin, Piecework Log, Outsourcing Vendor, Laporan HR

Endpoint API:
```bash
GET/POST   /api/hr/employees                # + GET/PUT/DELETE /api/hr/employees/:id
GET/POST   /api/hr/attendance               # + /attendance/clock-in, /clock-out, /bulk-mark
GET/POST   /api/attendance/correction-requests
GET        /api/attendance/reconciliation
GET/POST   /api/attendance/work-schedules
POST       /api/attendance/public/clock-in  # absensi publik (QR), tanpa login; + /public/clock-out, /public/check
GET/POST   /api/hr/payroll/periods          # + /periods/:id/approve, /payroll/records
GET/POST   /api/hr/appraisal/cycles         # + /appraisal/appraisals
GET/POST   /api/hr/training/programs        # + /training/categories
GET/POST   /api/hr/work-roster/rosters      # roster shift (drag & drop), + /rosters/by-week
POST       /api/staff-leave/submit          # sistem cuti terpadu, ESS submit + approval berjenjang
GET        /api/staff-leave/list            # + /manager-approve/:id
GET        /api/staff-leave/balance         # kuota/saldo cuti tahunan
POST       /api/staff-leave/public/submit   # form izin tanpa login (+ /public/check, /public/cancel/:id)
GET/POST   /api/face/register | /recognize | /list   # Face Recognition
GET        /api/hr/reports/generate
GET        /api/hr/reports/export
```

</details>

<details>
<summary><b>10. Modul Asset Management</b></summary>

> [!NOTE]
> Sudah dikonsolidasi (September 2026): `FixedAsset` (Finance) sudah digabung ke modul Asset Management ini - tidak ada lagi dua sistem aset tetap paralel yang terpisah.

Fitur:

- Siklus Hidup Aset Lengkap - Planning → Procurement → Installation → Active → Maintenance → Disposal
- Penyusutan Otomatis - Straight line & declining balance; opsional metode/umur manfaat fiskal terpisah (`tax_depreciation_method`, `tax_useful_life_years`, akumulasi penyusutan fiskal)
- Depreciation Schedule - Auto-generated jadwal penyusutan bulanan
- Asset Transfer - Tracking perpindahan aset antar lokasi/departemen dengan approval
- Disposal Aset - `POST /api/assets/:id/dispose` menghitung nilai buku dan laba/rugi pelepasan, lalu memposting jurnal otomatis (akumulasi penyusutan + laba/rugi pelepasan); dikunci oleh Closing Period
- Functional Location - Hierarki lokasi fungsional aset (CRUD di `/api/assets/functional-locations`) dengan halaman sendiri
- Asset Valuation - Model `AssetValuation` (riwayat revaluasi) sudah ada, tetapi belum ada endpoint/UI revaluasi
- Spare Parts Inventory (MRO) - Daftar suku cadang dengan filter stok rendah (`current_stock <= min_stock`); model `SparePartMovement` sudah ada, tetapi pencatatan pergerakan belum punya endpoint
- Maintenance Integration - Link dengan maintenance records
- Financial Integration - `batch-depreciation` memposting satu jurnal gabungan Dr Beban Penyusutan / Cr Akumulasi Penyusutan; aset yang dicatat manual bisa langsung memposting jurnal perolehan (`post_journal`)
- Production Machine - Tracking aset mesin produksi dengan kapasitas & speed
- Reports & Analytics - Summary by type/status, maintenance due alerts

Models (7 tabel):

- `Asset` - Unified asset model (FixedAsset + Machine + Equipment)
- `DepreciationSchedule` - Auto-generated depreciation schedule
- `FunctionalLocation` - Hierarki lokasi fungsional
- `AssetTransfer` - Asset transfer tracking dengan approval workflow
- `AssetValuation` - Revaluation history
- `SparePart` - MRO inventory dengan min/reorder stock
- `SparePartMovement` - Spare parts movement tracking

Endpoint API:
```bash
GET/POST   /api/assets
GET/PUT    /api/assets/:id
GET        /api/assets/:id/depreciation-schedule
POST       /api/assets/batch-depreciation
POST       /api/assets/:id/transfer
POST       /api/assets/transfers/:id/approve
POST       /api/assets/:id/dispose                 # disposal + jurnal laba/rugi pelepasan
GET/POST   /api/assets/functional-locations        # + PUT/DELETE /:id
GET        /api/assets/spare-parts
GET        /api/assets/reports/summary
GET        /api/assets/reports/maintenance-due
```

Frontend Components:

- `AssetDashboard` - KPI cards, summary by type, maintenance alerts
- `AssetList` - List dengan filter & search
- `AssetDetail` - Detail lengkap (3 tabs: Overview, Depreciation, Maintenance)
- `AssetForm` - Create/Edit form
- `SparePartsList` - Inventaris suku cadang dengan low stock alerts
- `DepreciationReport` - Batch calculation & reporting
- `FunctionalLocations` - Kelola hierarki lokasi fungsional

(7 halaman di `frontend/src/pages/AssetManagement/`.)

</details>

<details>
<summary><b>11. Modul Maintenance</b></summary>

Fitur:

- Scheduling Preventive Maintenance
- Tracking Corrective Maintenance
- Manajemen Work Order Maintenance
- History Equipment
- Tracking Cost Maintenance
- Integration dengan Asset Management
- Analytics & Pelaporan Maintenance (tren, performa per equipment, ekspor)
- Permintaan Suku Cadang (`parts-requests`) dan pembangkitan jadwal PM otomatis (`/schedules/:id/generate`)
- Alert jatuh tempo, KPI dashboard, dan statistik record maintenance
- Machine Health / Deteksi Anomali Downtime - baseline statistik (rata-rata + 2×stddev) per mesin dari riwayat downtime mingguan, dengan notifikasi otomatis (`/api/machine-health`, endpoint cron dilindungi secret)
- Halaman Checklist NG Items (`/app/maintenance/checklist-ng`) untuk item checklist yang NG

Models (4 tabel): `MaintenanceSchedule`, `MaintenanceRecord`, `MaintenanceTask`, `EquipmentHistory`

Endpoint API:
```bash
GET/POST   /api/maintenance
GET/POST   /api/maintenance/schedules
GET/POST   /api/maintenance/work-orders           # + GET/PUT /:id
GET/POST   /api/maintenance/parts-requests        # + GET/PUT /:id
GET/POST   /api/maintenance/records               # + GET/PATCH /:id
POST       /api/maintenance/schedules/:id/generate
GET        /api/maintenance/alerts | /stats | /dashboard/kpis | /work-orders/summary
GET        /api/maintenance/analytics             # + /analytics/trends, /analytics/equipment-performance, /analytics/export
GET        /api/machine-health/status             # + /history/:machine_id, POST /check-and-notify
```

</details>

<details>
<summary><b>12. Modul MRP (Material Requirements Planning)</b></summary>

Fitur:

- Forecasting Demand
- Kalkulasi Kebutuhan Material
- Planning Produksi
- Planning Kapasitas
- Alert Kekurangan Material
- Planning Timeline
- Integrasi dengan Sales Order & Work Order
- MRP Run time-phased - `run_mrp()` (`utils/mrp_engine.py`) menghitung kebutuhan per bucket mingguan (horizon default 12 minggu, forecast opsional) dengan BOM multi-level, netting terhadap stok WIP yang sudah ada, dan lead-time offsetting
- Lot sizing - prosedur EX / FX / WB / MB per material (`Material.lot_sizing_procedure`, `fixed_lot_size`) plus pembulatan ke MOQ material atau kontrak supplier
- Planned order bertipe `buy` / `make` - `buy` bisa dikonversi menjadi Purchase Requisition draft (`POST /api/mrp/run/convert-to-pr`); `make` punya tombol Buat WO di halaman MRP Run yang membuat Work Order lewat `/api/production/work-orders`
- Cek time-phased per Sales Order (`/time-phased-check/:sales_order_id`), pembuatan PO dari shortage, simulasi what-if, dan dashboard permintaan/kapasitas/shortage/timeline

Frontend Pages (8 halaman, `frontend/src/pages/MRP/`): MRPDashboard, MRPRun, DemandPlanning, CapacityPlanning, MaterialRequirements, SupplierIntegration, WhatIfSimulation, dan MRP lama (`/app/mrp/legacy`). Rute lama `/app/mrp/*` dialihkan ke `/app/production/*`

Workflow MRP:
```
Sales Order / Forecast → MRP Run (bucket mingguan) →
Netting stok + WIP + penerimaan terjadwal → Planned Order per minggu
  buy : Konversi ke Purchase Requisition draft → PO
  make: Buat Work Order → Produksi → QC → Finished Goods
```

Endpoint API:
```bash
GET        /api/mrp/run?horizon_weeks=12&include_forecasts=true   # MRP Run time-phased
POST       /api/mrp/run/convert-to-pr                             # planned order 'buy' → PR draft
GET        /api/mrp/requirements | /materials | /bom | /forecasts
POST       /api/mrp/planning
GET        /api/mrp/time-phased-check/:sales_order_id
POST       /api/mrp/create-purchase-order-from-shortage | /check-and-create-po
GET        /api/mrp/dashboard/metrics | /dashboard/material-shortages | /dashboard/timeline | /dashboard/capacity | /dashboard/demand-forecast
GET/POST   /api/mrp/demand/* | /capacity/* | /suppliers/* | /simulation/*
```

</details>

<details>
<summary><b>13. Modul Riset & Pengembangan</b></summary>

> [!WARNING]
> Catatan status (per Oktober 2026): hanya RND (`rnd.py`, prefix `/api/rnd`) yang aktif - blueprint-nya terdaftar di `app.py` dan halamannya punya rute di `App.tsx`. Delapan file `rd*.py` ("R&D Legacy", model `ResearchProject`) mendefinisikan blueprint tetapi tidak pernah didaftarkan, dan folder `pages/RD/` (12 file) tidak punya rute - jadi seluruhnya dead code. Jangan menambah fitur di modul RD.

Fitur:

- Manajemen Project R&D (proyek, milestone, approval)
- Tracking Eksperimen di laboratorium
- Testing Material
- Pengembangan Produk (formulasi baru)
- Manajemen Formulasi (RND Formula & Items)
- Analisa Hasil Test
- R&D Reports & Analytics
- Approval Workflow untuk R&D dengan status tracking
- Konversi proyek menjadi produk produksi (`POST /api/rnd/projects/:id/convert-to-production`) dan riwayat konversi (`/api/rnd/conversions`)

**File Backend (9 file, ~178KB total - hanya `rnd.py` yang aktif; 8 file `rd*.py` dead code):**

- `rd.py` - Utilitas inti R&D dan rute dasar
- `rd_projects.py` - Manajemen proyek, milestone, persetujuan
- `rd_experiments.py` - Eksperimen laboratorium, pelacakan pengujian
- `rd_materials.py` - Riset material, pengujian, formulasi
- `rd_products.py` - Pengembangan produk baru, formulasi
- `rd_reports.py` - Analitik dan pelaporan R&D
- `rd_extended.py` - Fitur R&D tambahan
- `rd_integration.py` - Integrasi dengan Produksi dan Kualitas
- `rnd.py` - RND workflow aktif (proyek, formula, eksperimen, approval, konversi ke produksi); 6 tabel di `models/rnd.py`

**Frontend Pages (RND - 6 file, 7 rute di `/app/rnd/*`):**
Dashboard, Project List, Project Detail, Project Form (baru & edit), Approvals

Endpoint API:
```bash
# RND (aktif)
GET        /api/rnd/dashboard
GET/POST   /api/rnd/projects                    # + GET/PUT/DELETE /:id
POST       /api/rnd/projects/:id/request-approval
GET        /api/rnd/approvals/pending               # + POST /approvals/:id/approve | /reject
GET/POST   /api/rnd/projects/:project_id/formulas   # + GET/PUT/DELETE /formulas/:id, POST /formulas/:id/select
GET/POST   /api/rnd/formulas/:formula_id/experiments # + GET/PUT/DELETE /experiments/:id
POST       /api/rnd/projects/:id/convert-to-production
GET        /api/rnd/conversions | /machines | /materials | /products
# /api/rd/* tidak terdaftar (dead code)
```

</details>

<details>
<summary><b>14. Modul Pengiriman & Logistik</b></summary>

Fitur:

- Manajemen Order Pengiriman / Surat Jalan - dibuat dari Sales Order (`available-sales-orders`), dari hasil QC (`create-from-qc`, halaman `CreateShippingFromQC`), atau manual
- Guard kelebihan/double-ship - kuantitas kirim per produk dicek terhadap sisa `SalesOrderItem.quantity_shipped`; `create-from-qc` menolak WO yang sama dikirim dua kali (double-click/retry/race)
- Alokasi stok FIFO otomatis - tanpa batch yang dipin, stok dipotong FIFO lewat `fifo_deduct_stock` dan dipecah menjadi satu `ShippingItem` per batch (gaya SAP batch-split-on-delivery); batch bisa dipin manual
- Jurnal HPP pengiriman - memposting HPP dan persediaan barang jadi keluar (`reference_type='sales_delivery'`); `ShippingOrder.invoice_id` menghubungkan ke faktur penjualan yang dibuat dari surat jalan
- Handling Unit (palet/kemasan) - satu `ShippingItem` bisa dipecah ke beberapa HU dengan kuantitas asli (bukan "1 palet"); persen isi dihitung saat tampil terhadap `Product.standard_pallet_qty`; HU bisa dicari lewat nomor HU (`handling-units/scan/:hu_number`)
- Pelacakan Pengiriman (Delivery Tracking) per nomor tracking dan manajemen Pengangkut/Logistics Provider
- Kalkulator ongkir, laporan pengiriman, dan TV Display pengiriman (`/tv/shipping`, tanpa login)

Endpoint API:
```bash
GET/POST   /api/shipping/orders                 # + GET/PUT/DELETE /orders/:id
POST       /api/shipping/shipments
GET        /api/shipping/available-sales-orders | /ready-for-shipping
POST       /api/shipping/create-from-qc
GET/POST   /api/shipping/tracking               # + PUT /tracking/:tracking_number
GET/POST   /api/shipping/providers              # + PUT/DELETE /providers/:id
GET/POST   /api/shipping/shipping-items/:item_id/handling-units
DELETE     /api/shipping/handling-units/:hu_id  # + GET /handling-units/scan/:hu_number
```

</details>

<details>
<summary><b>15. Modul Manajemen Limbah</b></summary>

Fitur:

- Pelacakan Limbah Produksi (`WasteRecord`) - CRUD catatan limbah dengan filter rentang hari, terhubung ke shift produksi/mesin/Work Order/produk
- Kategorisasi Limbah (`WasteCategory`)
- Target Limbah per Periode (`WasteTarget`, baca lewat API)
- Manajemen Pembuangan / Disposal (`WasteDisposal`) - metode (landfill/recycling/incineration), perusahaan pengangkut, kendaraan, driver, nomor manifest & sertifikat, biaya, approval; baca lewat API
- Data limbah ikut dipakai laporan lintas modul (`routes/reports.py`); belum ada endpoint analitik/laporan limbah tersendiri
- Frontend: `WasteRecordList` dan `WasteRecordForm` di `/app/waste`

Endpoint API:
```bash
GET/POST   /api/waste/records
GET/PUT/DELETE /api/waste/records/:id
GET        /api/waste/categories
GET        /api/waste/targets
GET        /api/waste/disposals
```

</details>

<details>
<summary><b>16. Modul DCC & CAPA (Document Control Center)</b></summary>

Standar: ISO 9001:2015 (Klausul 7.5)
Referensi: QP-DCC-01, QP-DCC-02, QP-DCC-03, QP-DCC-04, WI-DCC-01, WI-DCC-02
Database: 13 tabel di `dcc.py`
RBAC: Module `dcc` - view, create, edit, delete, approve

Sub-Modul:

- Pengendalian Dokumen (QP-DCC-01) - Registry dokumen Level I-IV (QM, QP, WI, Form), riwayat revisi, 3-level approval chain (Originator → Reviewer → Approver), distribusi salinan terkendali, kaji ulang berkala, change notice
- Pengendalian Rekaman Mutu (QP-DCC-02) - Daftar induk rekaman SMM & mutu produk, masa retensi, holder tracking
- CAPA (QP-DCC-03) - CPAR/SCAR/CCHF dengan auto-numbering, RCA 5-Why & Fishbone, tindakan korektif & preventif, verifikasi efektivitas, laporan bulanan. Referensi Penyimpangan Mutu - Input manual nomor dokumen penyimpangan saat sumber = PM
- Komunikasi Internal (QP-DCC-04) - Memo antar departemen, read receipts, kategori komunikasi
- Pemusnahan Dokumen (WI-DCC-01) - Berita acara pemusnahan fisik & digital, saksi & verifikasi

Models: `DccDocument`, `DccDocumentRevision`, `DccDocumentDistribution`, `DccDocumentReview`, `DccChangeNotice`, `DccQualityRecord`, `CapaRequest`, `CapaInvestigation`, `CapaVerification`, `CapaMonthlyReport`, `InternalMemo`, `InternalMemoDistribution`, `DccDestructionLog`

Fitur:

- Auto-numbering CPAR (`CP/BB/CC/DD-nnn`) & SCAR (`SC/BB/CC/nnn`), reset per tahun
- Nomor referensi penyimpangan mutu (manual input saat CPAR source = Penyimpangan Mutu)
- PDF Security: Permission Lock + AES Owner Password + SHA-256 Hash
- Digital signature auto-generated (nama, role, timestamp, QR code)
- Workflow: draft → reviewing → pending_approval → active → obsolete
- Document Verify Page - Halaman publik verifikasi dokumen via QR

Endpoint API:
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
GET    /api/dcc/revisions/:id/export-pdf # Export PDF dengan digital signature
POST   /api/dcc/memos                  # Buat memo internal
POST   /api/dcc/destructions           # Berita acara pemusnahan (+ /:id/witness, /:id/verify)
POST   /api/dcc/documents/:id/revisions # Revisi dokumen (+ /revisions/:id/upload, /approve, /download)
POST   /api/dcc/documents/:id/distribute # Distribusi salinan terkendali (GET /distributions)
POST   /api/dcc/documents/:id/review    # Kaji ulang berkala (GET /reviews)
POST   /api/dcc/documents/:id/change-notice # Change notice (+ /change-notices/:id/approve)
GET    /api/dcc/documents/expiring      # Dokumen mendekati jatuh tempo kaji ulang
GET/POST /api/dcc/quality-records       # Daftar induk rekaman mutu
POST   /api/dcc/memos/:id/publish       # + /read, /acknowledge, GET /memos/unread
GET    /api/dcc/verify/:token           # Verifikasi dokumen via QR (publik)
```

</details>

<details>
<summary><b>17. Modul Converting Production</b></summary>

Fitur:

- Manajemen Mesin Converting (cutting, slitting, dll.)
- Input Produksi Converting terpisah
- Tracking output, waste, dan shift
- Dashboard monitoring Converting

Endpoint API:
```bash
GET/POST   /api/converting/machines               # + /machines/seed, /machines/:id
GET/POST   /api/converting/production              # + /production/:id (PUT/DELETE)
GET        /api/converting/dashboard
GET        /api/converting/daily-report
GET        /api/converting/monthly-summary
```

Halaman: `ConvertingDashboard` dan `ConvertingInput` (di `pages/Production/`).

</details>

<details>
<summary><b>18. Modul Integrasi Accurate Online</b></summary>

> [!NOTE]
> ℹStatus (Oktober 2026): CoA internal kini mengikuti daftar akun Accurate dan alur SPK/EJO sudah native, tetapi integrasi Accurate belum dicabut - penghapusan ditahan sampai data yang dibutuhkan manajemen selesai ditarik. Beberapa endpoint masih terblokir izin di sisi Accurate (bukan masalah kode).

Fitur:

- OAuth2 Integration - Koneksi resmi ke Accurate Online dengan 175 scope API (item, BOM, work order, finished good slip, item transfer, dan seluruh modul yang didokumentasikan Accurate)
- Sinkronisasi Item Master - `item_new`, `item_stock_change`, `item_price_change`, `item_deleted` dengan approval queue, exact-name matching (tanpa fuzzy matching by design - mencegah salah tebak diam-diam)
- Sinkronisasi BOM/Formula - `bom_new`, `bom_line_changed`, `bom_deleted` dengan diff per-baris (added/removed/changed), blocking approval sampai semua ingredient ter-mapping
- BOM Multi-Level - Dukungan formula bertingkat Barang Jadi → WIP → Mixing (BillOfMaterials kini bisa merujuk `product_id` ATAU `material_id`), terverifikasi dengan data real sampai 5 tingkat kedalaman
- Cek EJO (Perintah Kerja) - Cari nomor EJO Accurate, lihat ringkasan, breakdown bahan bertingkat rekursif, histori tahap gudang (EPD→FG), Mesin/Operator/Shift dari Finished Good Slip, serta perbandingan otomatis dengan Work Order Internal ERP (dengan fallback pemilihan kandidat produk mirip saat exact-match gagal)
- Stok Gudang PM/EPD/FG - Dua pendekatan pelengkap:
  - Berbasis histori EJO (`processHistory`): kumulatif/historis, untuk produk jadi yang ter-match tepat
  - Berbasis snapshot resmi Accurate (`item/detail.do`): mencakup seluruh katalog (~1.600 item) termasuk bahan baku/kimia/kemasan, sumber data paling lengkap dan akurat
- Jejak Audit Transfer Gudang - Sinkronisasi transaksi resmi perpindahan barang antar gudang dari Accurate (`item-transfer`): prefix `IT-` untuk PM↔EPD, prefix `PL-` untuk EPD↔FG (otomatis dari Packing List), lengkap dengan nomor batch/serial number dan tanggal kedaluwarsa
- Pelacakan Produk Belum Tersinkron - Daftar nama item Accurate yang gagal exact-match ke Internal ERP, dengan kandidat produk mirip (persentase kemiripan) untuk rekonsiliasi manual
- Browser Data Modul Live - Jelajahi data langsung dari Accurate (Item, Vendor, Customer, GL Account, Faktur, Pesanan, BOM) tanpa perlu sinkronisasi permanen

Arsitektur:
```
Accurate Online (OAuth2) →
  AccurateClient (utils/accurate_client.py) →
    Item/BOM Sync → Approval Queue → Internal ERP (Product/Material/BillOfMaterials)
    EJO Cross-Check → Rekursif Material Tree + Diff vs WorkOrder
    Warehouse Sync → Inventory (PM/EPD/FG) + Transfer Audit Trail
```

Models: `AccurateConfig`, `AccurateItemMapping`, `AccurateSyncLog`, `EjoWarehouseSyncLog`, `EjoWarehouseUnmatchedProduct`, `WarehouseStockSnapshotDetail`, `AccurateBomItemIndex`, `AccurateWorkOrderCache`, `AccurateWarehouseTransferLog`, `AccurateWarehouseTransferItem`

Endpoint API:
```bash
GET/POST   /api/integrations/accurate/config
GET        /api/integrations/accurate/sync-logs
POST       /api/integrations/accurate/sync-logs/:id/approve
POST       /api/integrations/accurate/bom-scan
POST       /api/integrations/accurate/ejo-check
POST       /api/integrations/accurate/ejo-manual-match
GET        /api/integrations/accurate/smith-work-orders-by-product
POST       /api/integrations/accurate/ejo-warehouse-sync
POST       /api/integrations/accurate/warehouse-stock-full-sync
GET        /api/integrations/accurate/warehouse-snapshot-summary
GET        /api/integrations/accurate/warehouse-snapshot-detail
GET        /api/integrations/accurate/warehouse-unmatched-suggestions
POST       /api/integrations/accurate/warehouse-transfer-sync
GET        /api/integrations/accurate/warehouse-transfer-list
GET        /api/integrations/accurate/warehouse-transfer-detail/:id
POST       /api/integrations/accurate/sync-logs/:id/reject
POST       /api/integrations/accurate/sync-scan            # + /sync-scan-cron
POST       /api/integrations/accurate/delete-scan          # + /bom-delete-scan, /bom-item-index-scan
GET/POST   /api/integrations/accurate/mappings             # + /mappings/auto-map, /bulk-import-master
POST       /api/integrations/accurate/sync/dry-run
GET        /api/integrations/accurate/work-order-cache     # + /work-order-cache-scan
GET        /api/integrations/accurate/{items,vendors,customers,gl-accounts,sales-invoices,sales-orders,purchase-invoices,purchase-orders,bills-of-material,journal-vouchers,expenses,bank-transfers}   # browser data live (+ endpoint */…-detail/:no)
```

Catatan Teknis:

- Sinkronisasi dipicu manual dari UI, atau dijadwalkan dari luar lewat endpoint `*-cron` (`sync-scan-cron`, `bom-scan-cron`, `warehouse-stock-full-sync-cron`, `warehouse-transfer-sync-cron`) yang dilindungi `CRON_SECRET_TOKEN` (fail-closed kalau token belum di-set); tidak ada job APScheduler internal untuk Accurate. Pemindaian penghapusan (`delete-scan`, `bom-delete-scan`) sengaja tidak punya versi cron karena efeknya menonaktifkan data
- Cache lokal (`AccurateBomItemIndex`, `AccurateWorkOrderCache`) mempercepat lookup berulang dari ~1,5 menit menjadi <1 detik untuk data yang sering diakses
- Exact-name matching (tanpa fuzzy) adalah keputusan desain sengaja - mencegah kesalahan pencocokan produk yang tidak terlihat, dengan trade-off sebagian item perlu direkonsiliasi manual (dibantu fitur kandidat produk mirip)

</details>

<details>
<summary><b>Modul Pendukung</b></summary>

| Modul | Fitur Utama | API Prefix |
|-------|-------------|------------|
| **BOM Management** | Multi-level BOM, versioning, cost calculation, custom BOM | `/api/boms`, `/api/production/custom-boms` |
| **Dashboard & Analytics** | KPI real-time, Executive Dashboard, custom reports | `/api/dashboard`, `/api/executive` |
| **OEE Tracking** | Availability, Performance, Quality metrics | `/api/oee` |
| **Notifications** | Real-time alerts, email notifications | `/api/notifications` |
| **Approval Workflow** | Multi-level approval, delegation, eskalasi per jam (notifikasi) | `/api/approval` |
| **TV Display** | Production monitoring display (public) | `/api/tv-display` |
| **Reports** | Laporan operasional, export PDF/Excel | `/api/reports` |
| **Custom Report Builder** | Susun laporan sendiri dari sumber data (preview + simpan) | `/api/reports/custom` |
| **Report Scheduler** | Jadwal pengiriman laporan berkala | `/api/reports/scheduler` |
| **Pusat Laporan Keuangan** | 12 laporan keuangan + rincian, ekspor Excel/PDF (lihat Modul Finance) | `/api/finance/reports` |
| **Settings** | System configuration & preferences (khusus super admin) | `/api/settings` |
| **Audit Log Viewer** | Riwayat perubahan data level-field, ekspor, dan ringkasan | `/api/settings/audit-logs` |
| **Config Manager / Keyword Manager** | Konfigurasi netto & keyword downtime (halaman admin berbasis template) | `/api/config`, `/keywordedit` |
| **Backup & Restore** | Data backup and recovery | `/api/settings/backups` |
| **System Monitor** | Server health, performance metrics | `/api/system/metrics` |
| **Group Chat** | Internal team communication (SocketIO), server & channel | `/api/chat` |
| **Pre-Shift Checklist** | K3 safety checks, machine handover | `/api/pre-shift-checklist` |
| **Live Monitoring** | Real-time production monitoring (public) | `/api/live-monitoring` |
| **User Manual** | In-app documentation & FAQ | `/api/manual` |
| **OAuth** | Google OAuth integration | `/api/oauth` |
| **KPI Targets** | Target setting and tracking | `/api/kpi-targets` |
| **Product Changeover** | Machine changeover tracking | `/api/production/changeovers` |
| **Face Recognition** | Attendance with face verification | `/api/face` |
| **Material Stock** | Raw material inventory tracking | `/api/materials/inventory` |
| **UoM (Unit of Measure)** | Satuan ukur & konversi | `/api/uom` |
| **Search** | Global search seluruh modul | `/api/search` |
| **Production Approval** | Approval workflow produksi | `/api/production/production-approvals` |
| **Purchase Invoice** | Invoice pembelian & pembayaran | `/api/purchasing/purchase-invoices` |
| **Purchase Requisition** | Permintaan pembelian | `/api/purchasing` |
| **Staff Leave (Public)** | Form izin staf tanpa login | `/api/staff-leave/public/*` |
| **Early Warning System (EWS)** | Prediksi risiko downtime shift (Random Forest ML) | `/api/ews` |
| **Master Data** | Halaman master data terpadu (Barang, Akun, Resep) + import item dari Excel | `/api/master-data` |
| **Executive Dashboard** | Dashboard eksekutif, layout pabrik, production monitoring executive | `/api/executive` |
| **Document Templates / Print Designer** | Template dokumen & cetak berversi (PO, Surat Jalan, SPK, Faktur, Kwitansi) | `/api/documents` |
| **Workspace API** | Data workspace per modul (modul terkait & pintasan) | `/api/workspace` |
| **Machine Health** | Status kesehatan mesin + notifikasi WhatsApp otomatis | `/api/machine-health` |
| **Converting** | Produksi converting (mesin & proses terpisah) | `/api/converting` |
| **Handling Unit** | Palet/kemasan dengan persen isi | `/api/shipping` |
| **Workspace Bertab (frontend)** | Tab dua tingkat, pemulihan form setelah refresh | - |
| **Accurate Online Integration** | Sinkronisasi item/BOM, EJO cross-check, stok & transfer gudang PM/EPD/FG (detail: lihat Modul 18) | `/api/integrations/accurate` |

</details>

<details>
<summary><b>Modul WhatsApp Notification Gateway</b></summary>

Fitur:

- Notifikasi Work Order Otomatis - Kirim pesan WhatsApp otomatis saat Work Order selesai, berisi ringkasan metrik produksi (quantity, OEE, downtime)
- Dual Provider Support:
  - Local (Self-hosted) - Gateway Node.js sendiri (OpenWA) dengan engine whatsapp-web.js/Baileys
  - Twilio WhatsApp Business API - Alternatif provider terkelola untuk deployment yang butuh reliability lebih tinggi
- Multi-target - Kirim ke beberapa nomor tujuan sekaligus (dipisah koma)
- Notifikasi Kesehatan Mesin - `POST /api/machine-health/check-and-notify` (dipicu cron, dilindungi secret) mengirim peringatan WhatsApp lewat gateway yang sama
- Konfigurasi via Settings - Enable/disable, pilih provider, API URL, token, dan nomor tujuan - semua diatur dari UI tanpa perlu redeploy
- Session Management - Reconnect session WhatsApp langsung dari System Health Dashboard

Arsitektur:
```
Work Order Selesai (Backend Event) →
production_events.py (trigger) →
production_notifications.py (format pesan + hitung metrik) →
Provider Local: OpenWA Gateway (Node.js, port 2785) → WhatsApp Web/Baileys
Provider Twilio: Twilio WhatsApp Business API
```
File Terkait:

- `utils/production_notifications.py` - Formatting pesan & trigger notifikasi
- `utils/production_events.py` - Event listener untuk WO completion
- `routes/health.py` - Status monitoring & endpoint reconnect
- `routes/config_manager.py` - Konfigurasi provider & target nomor
- `scripts/OpenWA/` - Self-hosted WhatsApp gateway (Node.js, NestJS)

Endpoint API:
```bash
POST   /api/health/whatsapp/reconnect   # Reconnect WhatsApp session
GET    /api/health/system                # Status WhatsApp (bagian dari system health)
POST   /api/machine-health/check-and-notify   # Cek kesehatan mesin + kirim notifikasi
```

Konfigurasi (Settings → Notifications):
| Key | Deskripsi |
|-----|-----------|
| `notifications.whatsapp_enabled` | Aktifkan/nonaktifkan notifikasi WhatsApp |
| `notifications.whatsapp_provider` | `local` (self-hosted) atau `twilio` |
| `notifications.whatsapp_api_url` | URL API gateway (untuk provider local) |
| `notifications.whatsapp_token` | Token autentikasi ke gateway |
| `notifications.whatsapp_target_phones` | Nomor tujuan (pisah koma) |

</details>

<details>
<summary><b>Ops Agent Monitor (v3.10, di luar aplikasi ERP utama)</b></summary>

Alat operasional terpisah (folder `agent/` + `agent-dashboard/`, proses PM2 sendiri) - bukan bagian dari ERP itu sendiri, tapi memantaunya. Menonton log `stdout`/`stderr` proses backend/frontend yang dikelola PM2, mendeteksi error otomatis, mendiagnosisnya lewat Claude API, dan mengirim notifikasi WhatsApp yang bisa langsung di-approve/skip dengan reply `"ok"`/`"skip"` dari HP.

Fitur:

- Auto-discovery PM2 - scan `pm2 jlist` live, admin tinggal centang app mana saja yang mau dipantau dari dashboard (tidak perlu nama app di-hardcode)
- Klasifikasi risiko berdasarkan dampak - `risk_classifier.py` menentukan HIGH/MEDIUM/LOW dari teks log (endpoint transaksi inti yang gagal = HIGH; masalah kosmetik = LOW; tidak jelas = MEDIUM sebagai default aman), terpisah dari watcher supaya aturannya mudah diedit
- Dedup & cooldown - error yang sama berulang (signature sama) tidak memicu diagnosis/notifikasi ulang, cuma counter kemunculan yang bertambah
- Diagnosis via Claude API - hanya mengirim potongan log (traceback + konteks), tidak pernah membaca isi source code project - lebih aman & murah
- Auto-discovery sesi OpenWA + auto-register webhook - tidak perlu cari session ID atau daftar webhook manual
- Login + HMAC signature verification - dashboard dan API di belakang password login (token session, bukan JWT - bisa di-revoke instan), webhook OpenWA diverifikasi HMAC-SHA256 sebelum diproses
- `_apply_fix()` (di `wa_webhook.py`) sengaja placeholder - approve dari WhatsApp mencatat keputusan, tidak pernah otomatis menulis ke kode produksi tanpa review manusia
- Dashboard React terpisah: histori error + statistik, pemilihan sumber log PM2, konfigurasi (API key tidak pernah round-trip penuh ke browser)

File Terkait:

- `agent/` - Python backend (watcher, diagnose, risk_classifier, wa_notify, wa_webhook, auth, openwa_client, pm2_discovery, activity_log, state, api, main); webhook + API di port 4500 (`AGENT_WEBHOOK_PORT`)
- `agent-dashboard/` - Frontend React + Vite terpisah, port dashboard 4501

</details>

<details>
<summary><b>System Health Dashboard</b></summary>

Halaman monitoring real-time untuk kesehatan infrastruktur sistem, dapat diakses admin di `Settings → System Health`.

Menampilkan:

- Status Komponen - API server, database, WhatsApp gateway, frontend (healthy/warning/error)
- Resource Usage - CPU, memory, disk usage server
- Info Database - Jumlah tabel, ukuran database, waktu backup terakhir, engine (PostgreSQL)
- WhatsApp Gateway - Status koneksi, nomor aktif, push name, aktivitas terakhir, tombol reconnect
- PM2 Processes - Uptime, jumlah restart, penggunaan memory per proses (backend, frontend, WhatsApp gateway)
- Auto-refresh - Update otomatis berkala tanpa perlu reload manual

Endpoint API:
```bash
GET    /api/health/system              # Status lengkap semua komponen
POST   /api/health/whatsapp/reconnect  # Reconnect WhatsApp session
```

</details>

---

## Katalog Modul Lengkap

> [!NOTE]
> Daftar semua modul. Setiap file di `backend/routes/` (116 file) dan setiap direktori di `frontend/src/pages/` masuk ke satu baris di bawah. Modul yang tidak aktif ditandai di bawah namanya: _belum diadopsi_ (backend ada, data masih kosong), _tanpa UI_ (dipanggil sistem atau skrip), _dead code_ (blueprint tidak terdaftar). Relasi antar modul ada di [`PETA_MODUL.md`](PETA_MODUL.md), tapi sebagian isinya masih audit awal.

### Penjualan & Pelanggan

| Modul | Backend | Halaman | Fungsi |
|---|---|---|---|
| **Retur Pelanggan** | `returns`<br>`/api/returns` | Returns/ (via services/returnsApi.ts) | Retur penjualan dengan QC, disposisi, analitik, dan kaitan ke persetujuan, finance, serta gudang. |
| **Sales & CRM** | `sales`<br>`/api/sales` | Sales/, Documents/, Finance/, Production/ | Customer, lead, opportunity, quotation, sales order, forecast, Pricing Procedure, dan Customer-Material Info (61 endpoint). |

### Produksi & Perencanaan

| Modul | Backend | Halaman | Fungsi |
|---|---|---|---|
| **Batch Scheduling** | `batch_scheduling`<br>`/api/batch-scheduling` | Production/ | Resep produksi, kalender 3 lapis (global, pengecualian, override mesin), dan penjadwalan batch berbasis kapasitas mesin dengan generate/replan. |
| **BOM Master (Produksi)** | `bom`<br>`/api/production (boms)` | Production/, Sales/ | BOM master dengan analisis kekurangan material dan analisis biaya. _(paralel dengan bom_management)_ |
| **Manajemen BOM & Riwayat** | `bom_management`<br>`/api (boms)` | Production/, Products/ | CRUD BOM multi-level, riwayat perubahan, versi per produk, dan log impor BOM. _(paralel dengan bom)_ |
| **Custom BOM per Work Order**<br>_tanpa UI_ | `custom_bom`<br>`/api/production (custom-boms)` | tanpa UI | BOM kustom per work order yang dapat dibuat dari BOM master dan di-reset. |
| **Converting Production** | `converting`<br>`/api/converting` | Production/ (Converting), Executive/ | Master mesin converting dan pencatatan produksi converting yang terpisah dari produksi utama. |
| **Downtime Action Items** | `downtime_actions`<br>`/api/downtime-actions` | components/Production (tertanam di halaman downtime) | Action item perbaikan downtime yang dibuat otomatis dari data downtime, dengan ringkasan dan ekspor Excel/PDF. |
| **EWS (Early Warning System)** | `ews`<br>`/api/ews` | EWS/ | Prediksi risiko downtime shift produksi dengan model ML (skoring batch harian dan rescore manual). |
| **Live Monitoring & Pre-Shift** | `live_monitoring`<br>`/api/live-monitoring` | Production/ | Pengecekan live mesin, jawaban checklist, ringkasan mingguan, dan deteksi ketidakcocokan (mismatch) antar pengecekan. |
| **FG Conversion**<br>_belum diadopsi_ | `fg_conversion`<br>`/api/fg-conversion` | Production/ (FGConversionList, FGConversionDetail) | Konversi WIP menjadi barang jadi dengan pelacakan loss dan material, ringkasan per batch, serta laporan loss. |
| **Produksi Inti** | `production`, `production_integration`<br>`/api/production` | Production/, Maintenance/, HR/, components/Production | Work order, batch, mesin, catatan produksi, sisa stok, dan BOM per WO; `production_integration` menambah auto-deduct/auto-receive material dan cek ketersediaan material per WO. |
| **Input Produksi Shift** | `production_input`<br>`/api/production-input` | Production/ | Input produksi per shift (`shift-productions`), downtime, serta data pendukung karyawan/mesin/produk. |
| **Perencanaan Produksi**<br>_belum diadopsi_ | `production_planning`<br>`/api/production-planning` | Production/ | Rencana produksi, approval, pembuatan WO dari rencana atau dari forecast, dan dashboard. |
| **Persetujuan Produksi** | `production_approval`<br>`/api/production` | Production/ | Approval bertingkat catatan produksi per WO (ajukan, setujui, tolak, teruskan ke finance). |
| **Changeover Produk** | `product_changeover`<br>`/api/production` | Production/, Maintenance/ | Pencatatan pergantian produk di mesin (mulai, selesai, batal) dan WO yang tersedia per mesin. |
| **Laporan MBF** | `mbf_report`<br>`/api/mbf-report` | Production/ (MBFReport, MBFReportList) | Laporan produksi MBF dengan alur draft, submit, approve/reject, dan sinkron dari data produksi. |
| **OEE & Daily Controller** | `oee`<br>`/api/oee` | OEE/, Quality/, Production/ | OEE per mesin dan shift, Daily Controller, downtime beserta akar masalah, Quality Objective, alert, dan ekspor. |
| **Pre-Shift Checklist** | `pre_shift_checklist`<br>`/api/pre-shift-checklist` | Production/ (PreShiftChecklist*), Maintenance/ (ChecklistNGItems) | Checklist sebelum shift per mesin, submit dan rekap mingguan, audit log jawaban, serta tindakan korektif untuk item NG. Belum memblokir produksi saat ada NG. |
| **MRP** | `mrp`<br>`/api/mrp` | MRP/, Sales/ | Perhitungan kebutuhan material (BOM, kapasitas, shortage), MRP Run, dan pembuatan PR/PO/WO dari hasil. |
| **Produk (skema lama)** | `products`, `product_calculations`<br>`/api/products` | Products/ | CRUD produk, BOM, kategori, konversi, analitik, dan kalkulasi spesifikasi/biaya produk (`calculate`, `recalculate-all`). |
| **Produk (skema baru / Excel)** | `products_new`, `products_new_extended`, `products_new_excel`<br>`/api/products-new, /api/products-excel` | ProductsNewPage, Production/ (WeeklyProductionPlan, WorkOrderProductionInput, RemainingStock), components/ | Master produk skema baru: CRUD, versi, impor Excel, opsi spunlace/proses, validasi kode, kebutuhan material, ekspor, dan dashboard. |
| **Weekly Plan & Schedule Grid** | `weekly_production_plan`, `schedule_grid`<br>`/api/production` | Production/, HR/ | Rencana produksi mingguan beserta item, dan grid jadwal mesin yang bisa membuat Work Order (generate-wo). |
| **SPK (Surat Perintah Kerja)** | `spk`<br>`/api/spk` | Production/ | Riwayat staging gudang, catatan penyelesaian, dan rincian material per SPK/Work Order. |
| **Waste Management** | `waste`<br>`/api/waste` | Waste/, Production/ | Catatan waste per kategori, target, dan disposal. |
| **Work Order Monitoring** | `work_order_monitoring`<br>`/api/work-orders/monitoring (path penuh di route, tanpa url_prefix)` | Production/ (WorkOrderMonitoring, BreakdownSummary) | Monitoring status Work Order, timeline, dan dampak breakdown mesin. |

### Kualitas

| Modul | Backend | Halaman | Fungsi |
|---|---|---|---|
| **Ubah Status Batch QC** | `qc_batch_status`<br>`/api/qc-batch-status` | Quality/ (BatchStatusChange) | Daftar batch dan perubahan status release/quarantine/reject dengan alasan wajib serta audit log. |
| **Quality Enhanced** | `quality_enhanced`<br>`/api/quality-enhanced` | Quality/ (QualityDashboardEnhanced, QualityAlerts, QualityAnalytics; lewat RTK `services/api.ts`) | Dashboard kualitas, alert (acknowledge/resolve), analitik, target, audit, dan kompetensi pelatihan. |
| **Quality Control** | `quality`<br>`/api/quality` | Quality/, Production/ | Inspeksi mutu, tes QC per Work Order, CAPA, serta disposisi persediaan (set-disposition, inventory-disposition, transfer ke gudang). |
| **SPC (Statistical Process Control)** | `spc`<br>`/api/spc` | Quality/ (SPC, lewat services/api.ts) | Parameter, spesifikasi, dan sampel SPC untuk X-bar R chart serta Cp/Cpk. |

### Gudang & Persediaan

| Modul | Backend | Halaman | Fungsi |
|---|---|---|---|
| **Master Material & Stok Material** | `materials`, `materials_crud`, `material_stock`<br>`/api/materials, /api (material_stock)` | Warehouse/, Materials/, Purchasing/, Production/ (dropdown) | CRUD material, dashboard material, inventori & mutasi stok, tambah stok, lokasi, dan inisialisasi inventori. |
| **Material Issue** | `material_issue`<br>`/api/production` | Production/ (dipanggil dari WO), components/ | Permintaan dan pengeluaran material ke produksi (dari work order), approval, retry bila kurang, reservasi, dan konfirmasi terima. |
| **Stock Input** | `stock_input`<br>`/api/warehouse` | Warehouse/ | Input stok masuk manual dengan validasi lokasi, quick-add, riwayat, dan template. |
| **Stock Opname** | `stock_opname`<br>`/api/stock-opname` | Warehouse/ | Order stock opname: mulai, hitung per item, dan persetujuan penyesuaian dengan selisih (delta). |
| **Warehouse Inti** | `warehouse`<br>`/api/warehouse` | Warehouse/, WMS/, Production/, Purchasing/, Quality/ | Gudang, lokasi/zona, stok, transfer, dan inventori dasar yang dipakai hampir semua modul. |
| **Warehouse Enhanced**<br>_belum diadopsi_ | `warehouse_enhanced`<br>`/api/warehouse-enhanced` | services/api.ts saja (belum terlihat dipakai halaman) | Dashboard gudang, analitik, analisis ABC, alert stok, dan optimasi. |
| **WMS Advanced** | `wms_advanced`<br>`/api/wms` | WMS/, Warehouse/ | Pick list, cycle count, transfer order, konsumsi material, transaksi stok gaya MB51, dan batch traceability. |
| **Unit of Measure** | `uom`<br>`/api/uom` | Warehouse/ (UoMList), services/api.ts | Master satuan dan konversi antar satuan. |

### Pembelian & Pengiriman

| Modul | Backend | Halaman | Fungsi |
|---|---|---|---|
| **Handling Unit** | `handling_unit`<br>`/api/shipping` | Shipping/ | Pelacakan pallet/kemasan fisik per item pengiriman, termasuk pemindaian nomor HU. |
| **Purchasing (PO, GRN, Supplier)** | `purchasing`<br>`/api/purchasing` | Purchasing/, Finance/, Documents/ | Supplier, PO, GRN, kontrak, perbandingan harga, kurs, dan Approved Vendor (Source List). |
| **Purchase Requisition** | `purchase_requisition`<br>`/api/purchasing` | Purchasing/ | PR dengan approval dan konversi ke PO (dipecah per supplier). |
| **Purchase Invoice** | `purchase_invoice`<br>`/api/purchasing` | Purchasing/, Finance/ | Faktur pembelian dengan 3-way match, invoice blocking, PPN Masukan, pembayaran, dan jurnal GL. |
| **Purchase Return** | `purchase_return`<br>`/api/purchasing` | Purchasing/ | Retur pembelian (karantina, disposisi) dan jurnal GL pengurang hutang/persediaan. |
| **Shipping** | `shipping`<br>`/api/shipping` | Shipping/, Documents/ | Shipping order, pengiriman dari QC, tracking, provider logistik, dan kaitan ke sales order serta produksi. |

### Keuangan & Akuntansi

| Modul | Backend | Halaman | Fungsi |
|---|---|---|---|
| **Rekonsiliasi Bank** | `bank_reconciliation`<br>`/api/finance/bank-reconciliation` | Finance/ | Impor mutasi bank dan pencocokan terhadap jurnal GL; pembayaran yang cocok otomatis berstatus cleared. |
| **Expense & Reimbursement** | `expense`<br>`/api/expenses` | Finance/ | Klaim pengeluaran karyawan dengan unggah bukti, persetujuan manajer, dan reimbursement. |
| **Finance Inti** | `finance`<br>`/api/finance` | Finance/ | Chart of Accounts, jurnal dan GL, faktur, penerimaan/pembayaran, credit memo, aging, e-Faktur, anggaran, closing period, dan laporan keuangan standar. |
| **Pusat Laporan Keuangan** | `finance_reports`<br>`/api/finance/reports` | Finance/Reports | Neraca saldo, mutasi bank, kas harian, posisi kas, kartu piutang/hutang, laporan pembelian, PPN, perubahan ekuitas dengan ekspor Excel dan PDF. |
| **WIP Accounting** | `wip_accounting`<br>`/api/wip-accounting` | Finance/ | Ledger WIP per Work Order, transaksi dengan posting ke GL, analisis varian, dan transfer COGM. |
| **WIP Job Costing** | `wip_job_costing`<br>`/api/wip` | Finance/, Production/ | Batch WIP per tahap (pindah/selesai tahap) dan biaya pekerjaan (job cost) per Work Order. |

### SDM

| Modul | Backend | Halaman | Fungsi |
|---|---|---|---|
| **Absensi & Rekonsiliasi** | `attendance`, `face_recognition`<br>`/api/attendance, /api/face` | HR/, Public/ (clock-in publik), Landing/ | Absensi clock-in/out (GPS geofence dan pengenalan wajah), absen publik tanpa login, jadwal kerja, permintaan koreksi, dan rekonsiliasi absensi; registrasi dan pengenalan wajah staf. |
| **HR Inti (Karyawan, Departemen, Cuti, Roster)** | `hr`, `hr_extended`<br>`/api/hr` | HR/ | Master karyawan, departemen, posisi, shift, cuti, dan roster kerja karyawan. |
| **Payroll** | `hr_payroll`<br>`/api/hr/payroll` | HR/ | Perhitungan dan persetujuan penggajian (multi tipe upah, PPh21 TER) dengan posting jurnal ke GL. |
| **Penilaian Kinerja (Appraisal)** | `hr_appraisal`<br>`/api/hr/appraisal` | HR/ | Siklus penilaian, template, self-review dan review manajer, serta laporan siklus. |
| **Pelatihan & Kompetensi** | `hr_training`<br>`/api/hr/training` | HR/ | Kategori dan program pelatihan karyawan serta pelacakan sertifikasi. |
| **Laporan HR** | `hr_reports`<br>`/api/hr/reports` | HR/ | Lima jenis laporan HR dengan ekspor Excel/PDF. |
| **Cuti Staf Kantor** | `staff_leave`<br>`/api/staff-leave` | HR/, Public/ | Pengajuan cuti staf, persetujuan manajer, saldo cuti, dan form publik. |
| **Work Roster** | `work_roster`<br>`/api/hr/work-roster` | HR/, Production/ | Roster shift karyawan per minggu dan kalender; dasar penugasan operator. |

### Aset & Pemeliharaan

| Modul | Backend | Halaman | Fungsi |
|---|---|---|---|
| **Asset Management (EAM)** | `asset_management`<br>`/api/assets` | AssetManagement/ | Master aset tetap, jadwal penyusutan, transfer aset, disposal dengan jurnal laba/rugi, dan pencatatan pemeliharaan aset. |
| **Maintenance** | `maintenance`, `maintenance_extended`<br>`/api/maintenance` | Maintenance/ | Jadwal, catatan, alert, dan dashboard pemeliharaan, plus ekstensi analitik, permintaan suku cadang (`parts-requests`), dan work order maintenance. |
| **Machine Health** | `machine_health`<br>`/api/machine-health` | Executive/ (ProductionMonitoringDashboard) | Status kesehatan mesin, riwayat per mesin, dan pengecekan + notifikasi otomatis. |

### R&D & Dokumen

| Modul | Backend | Halaman | Fungsi |
|---|---|---|---|
| **DCC & CAPA** | `dcc`<br>`/api/dcc` | DCC/ | Document control center (revisi, approval, distribusi), CAPA, quality record, memo, dan kaji ulang berkala sesuai ISO 9001. |
| **Document Management (Template)** | `document_management`<br>`/api/documents` | Documents/ | Template dokumen berversi dan generator PDF, terpisah dari DCC. |
| **RND (R&D aktif)** | `rnd`<br>`/api/rnd` | RND/ | Proyek, formula, dan alur persetujuan R&D; modul R&D yang aktif dipakai. |
| **RD (legacy)**<br>_dead code_ | `rd`, `rd_experiments`, `rd_extended`, `rd_integration`, `rd_materials`, `rd_products`, `rd_projects`, `rd_reports`<br>_(tidak terdaftar)_ | RD/ (tanpa rute di App.tsx) | Proyek, eksperimen, material, dan laporan R&D versi lama; blueprint tidak didaftarkan di app.py dan halaman RD/ tidak terjangkau. |

### Integrasi & Otomasi

| Modul | Backend | Halaman | Fungsi |
|---|---|---|---|
| **Integrasi Accurate Online** | `accurate_integration`<br>`/api/integrations/accurate` | Integration/ | Sinkronisasi item, BOM, stok dan transfer gudang antara ERP dan Accurate Online, termasuk cek EJO, log sinkronisasi, dan endpoint cron terjadwal. _(sebagian endpoint terblokir izin di sisi Accurate; penghapusan ditahan)_ |
| **Integrasi Pihak Ketiga (lama)**<br>_dead code_ | `integration`<br>_(tidak terdaftar)_ | tanpa UI | Sisa modul integrasi lama (daftar API pihak ketiga dan log integrasi) yang blueprint-nya tidak pernah didaftarkan di app.py. |
| **Workflow Order-to-Cash** | `workflow_complete`<br>`/api/workflow-complete` | Sales/ | Konfirmasi sales order, persetujuan QC, pengiriman, dan status workflow end-to-end. |
| **Workflow Otomatis Lama & Integrasi**<br>_tanpa UI_ | `workflow`, `workflow_integration`<br>`/api/workflow, /api/workflow-integration` | tanpa UI | Trigger otomatis SO→MRP→PO/WO dan produksi→gudang, termasuk buffer produksi; backend ada tetapi tidak dipanggil frontend. |

### Dashboard & Pelaporan

| Modul | Backend | Halaman | Fungsi |
|---|---|---|---|
| **Analytics KPI/Metric (lama)**<br>_dead code_ | `analytics`<br>_(tidak terdaftar)_ | tanpa UI | Endpoint KPI, metrik, dan laporan analitik generik; blueprint tidak didaftarkan sehingga tidak terjangkau (dashboard eksekutif memakai executive_dashboard). |
| **Custom Report Builder** | `custom_report`<br>`/api/reports/custom` | Reports/ | Pembuat laporan kustom dari sumber data terdaftar dengan pratinjau dan penyimpanan definisi laporan. |
| **Dashboard Utama** | `dashboard`<br>`/api/dashboard` | Dashboard/ | Ringkasan overview dan grafik penjualan/produksi untuk dashboard utama. |
| **Executive Dashboard & Machine Layout** | `executive_dashboard`<br>`/api/executive` | Executive/, Reports/, Dashboard/ | KPI dan scorecard eksekutif, production monitoring, analitik QC/WO/gudang/HR/maintenance, audit log, serta denah mesin pabrik. |
| **KPI Target** | `kpi_targets`<br>`/api/kpi-targets` | Settings/ (KPITargetSettings) | Target KPI perusahaan/departemen yang dipakai dashboard eksekutif. |
| **Laporan Gabungan** | `reports`<br>`/api/reports` | Reports/ | Laporan sales, produksi, inventori, waste, maintenance, kualitas, dan HR dengan ekspor. |
| **Report Scheduler** | `report_scheduler`<br>`/api/reports/scheduler` | Reports/ | Penjadwalan laporan berkala: buat, aktif/nonaktif, run-now, dan run-due untuk eksekusi terjadwal. |
| **TV Display** | `tv_display`<br>`/api/tv-display` | TVDisplay/ | Layar monitor pabrik (overview, roster, produksi, shipping); sengaja tanpa autentikasi. |

### Komunikasi & Notifikasi

| Modul | Backend | Halaman | Fungsi |
|---|---|---|---|
| **Group Chat** | `group_chat`<br>`/api/chat` | Chat/ | Chat server/kanal/thread internal berbasis Socket.IO. |
| **Notifikasi In-App & Push** | `notifications`<br>`/api/notifications` | Notifications/, components/ (lonceng notifikasi) | Daftar notifikasi pengguna, tandai dibaca, alert, dan langganan Web Push (VAPID). |
| **Notifikasi Email** | `notifications_email`<br>`/api/email` | Settings/ (EmailSettings) | Konfigurasi dan status email, kirim tes, serta email persetujuan, konfirmasi order, dan peringatan stok rendah. |
| **Group Chat Real-time (Socket.IO)** | `socketio_chat`<br>_(event Socket.IO, bukan blueprint)_ | Chat/ | Handler event Socket.IO untuk chat server/channel/thread; diimpor sebagai side-effect di app.py. |

### Platform & Administrasi

| Modul | Backend | Halaman | Fungsi |
|---|---|---|---|
| **Approval Workflow Generik** | `approval_workflow`<br>`/api/approval` | Approval/ (dipakai juga oleh Production/, Purchasing/, Warehouse/, RND/) | Alur persetujuan generik lintas modul (submit, review, approve, riwayat, konfigurasi) termasuk persetujuan jurnal keuangan yang menunggu (PendingJournalEntry). |
| **Backup Database** | `backup`<br>`/api/settings (backups)` | Settings/ | Membuat, mengunggah, mengunduh, dan memulihkan backup database serta konfigurasi jadwal backup. |
| **Statistik Cache (lama)**<br>_dead code_ | `cache_stats`<br>_(tidak terdaftar)_ | tanpa UI | Endpoint statistik dan pembersihan cache; blueprint tidak didaftarkan karena fungsi serupa sudah ada di health.py. |
| **Config Manager** | `config_manager`<br>`/api/config` | Settings/ | Pengelolaan konfigurasi sistem (key-value) dan aturan potongan netto, khusus super admin dengan jejak audit. |
| **Health & Monitoring Server** | `health`<br>`/api (health, ready, live)` | Settings/ (SystemHealth) | Endpoint kesehatan (database, cache, sistem, riwayat) untuk monitoring dan probe readiness. |
| **Import Data Massal** | `import_data`<br>`/api/import/data` | Settings/ | Impor data master massal dari Excel (produk, material, inventori, lokasi, supplier). |
| **Keyword Manager (Downtime)** | `keyword_manager`<br>`/keywordedit (halaman HTML server-side)` | tanpa UI SPA (template HTML) | Editor keyword klasifikasi downtime di database yang dapat disinkronkan ke file kode dan meregenerasi record downtime. _(hati-hati: sync-to-files menulis ulang file sumber)_ |
| **Autentikasi & Registrasi** | `auth`<br>`/api/auth` | Auth/, Profile/, Settings/ | Login JWT dengan refresh token dan lockout brute-force, registrasi (menunggu persetujuan super admin), profil, dan manajemen kata sandi. |
| **Log Error Frontend** | `logs`<br>`/api/logs` | tanpa halaman (dipanggil `utils/errorLogger.ts`) | Menerima log error dari browser (`POST /frontend`) dan menampilkannya lewat `GET /view`. |
| **Google OAuth (sisi backend)**<br>_tanpa UI_ | `oauth`<br>`/api/oauth` | tanpa UI (login Google di frontend memakai `/api/auth/google/*`, bukan route ini) | Alur login/callback/status Google OAuth; registrasi `init_oauth` dipanggil dari `app.py`. |
| **Import Master Data Barang** | `master_data_import`<br>`/api/master-data` | MasterData/ (tab Barang) | Import massal item master (`POST /import-items`) dari Excel. |
| **Global Search** | `search`<br>`/api/search` | Search/ | Pencarian global lintas modul DCC, HR, maintenance, produk, produksi, pembelian, kualitas, sales, dan gudang plus saran. |
| **Settings & RBAC Lanjutan** | `settings`, `settings_extended`<br>`/api/settings` | Settings/, Auth/, Landing/, Dashboard/ | Konfigurasi sistem dan profil perusahaan, system-config, roles/permissions, serta audit log dengan ekspor. |
| **Workspace API**<br>_tanpa UI_ | `workspace`<br>`/api/workspace` | tanpa UI (folder frontend/src/workspace murni sisi klien) | Daftar modul dan ringkasan data per modul untuk workspace. |
| **System Monitor** | `system_monitor`<br>`/api/system/* (url_prefix /api)` | Landing/ (SystemOverview), SystemMonitor.tsx | Metrik server publik, info sistem, proses, dan riwayat penggunaan sumber daya. |
| **User Manual** | `user_manual`<br>`/api/manual` | Manual/ | Kategori dan artikel panduan pengguna internal. |

Total 97 modul dari 116 file route.

---

## Integrasi Alur Kerja

Alur utama: Sales → MRP → Purchasing/Produksi → Gudang → Quality → Shipping → Finance.

### Order penjualan ke produksi

```mermaid
flowchart LR
    SO["Sales Order<br/>confirmed"] --> MRP["Analisa MRP"]
    MRP --> Q{"Material<br/>kurang?"}
    Q -- "ya" --> PO["Buat Purchase Order"]
    Q -- "tidak" --> WO["Buat Work Order"]
    PO --> WO
    WO --> PR["Produksi selesai"]
    PR --> QC{"Quality<br/>inspection"}
    QC -- "lolos" --> FG["Finished Goods"]
    QC -- "gagal" --> RW["Rework / disposal"]
```

### Produksi ke keuangan

```mermaid
flowchart TD
    S["Produksi mulai"] --> W["WIP Ledger"]
    W --> C["Akumulasi biaya<br/>material + labor + overhead"]
    C --> F["Produksi selesai<br/>WIP ke FG (COGM)"]
    F --> G["Posting GL otomatis"]
    G --> T["Produk terjual<br/>posting COGS"]
    T --> GP["Gross profit"]
```

### Pembelian ke pembayaran (Procure-to-Pay)

```mermaid
flowchart TD
    PRQ["Purchase Requisition<br/>(approval)"] --> PO["PO<br/>dipecah per supplier,<br/>ambang Release Strategy"]
    PO --> GRN["GRN<br/>wajib PO approved"]
    GRN --> INV["Faktur pembelian<br/>3-way match"]
    INV -- "selisih" --> BLK["Invoice Blocking"]
    BLK --> INV
    INV --> JNL["Jurnal<br/>Dr Persediaan + PPN Masukan<br/>Cr Hutang"]
    JNL --> PAY["Pembayaran kas/bank<br/>banyak faktur sekaligus"]
    PAY --> BR["Bank Reconciliation<br/>status cleared"]
```

### Penjualan ke penerimaan kas (Order-to-Cash)

```mermaid
flowchart TD
    SO["Sales Order<br/>ATP + Pricing Procedure"] --> CF["Confirm<br/>MRP otomatis"]
    CF --> PRD["Produksi<br/>Tutup SPK"]
    PRD --> SJ["Surat Jalan<br/>alokasi batch FIFO"]
    SJ --> FK["Faktur penjualan<br/>PPN, e-Faktur"]
    FK --> J["Jurnal<br/>Dr Piutang, Cr Penjualan + HPP"]
    J --> RC["Penerimaan kas/bank"]
    RC --> AG["Umur piutang"]
    FK --> RT["Retur: Nota Retur"]
    RT --> NK["Kelebihan di atas faktur:<br/>Nota Kredit (pakai / refund / undo)"]
```

### SPC quality control

```mermaid
flowchart LR
    P["Produksi berjalan"] --> I["Input sample QC<br/>subgroup n=5"]
    I --> X["Hitung X-bar dan R"]
    X --> WE{"Western<br/>Electric Rules"}
    WE -- "normal" --> OK["Lanjut produksi"]
    WE -- "out of control" --> AL["Alert ke supervisor"]
    AL --> CA["Investigasi dan CAPA"]
```

---

## Cara Instalasi

### Prasyarat

- Python 3.11+
- Node.js 20+ (CI memakai Node 22)
- npm
- Git
- PostgreSQL 15+ (database utama; SQLite hanya untuk tes cepat, bukan untuk dijalankan sungguhan)
- Redis Server (untuk caching, opsional)
- Opsional: Docker (`docker-compose.yml` menjalankan postgres, redis, backend, frontend)

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
# Edit .env: isi SECRET_KEY, JWT_SECRET_KEY, dan DATABASE_URL ke PostgreSQL
# (contoh: postgresql://user:pass@localhost:5432/erp_db - default contoh .env masih SQLite)

# Inisialisasi database (116 migrasi Alembic)
flask db upgrade

# Jalankan development server
python app.py
```

Backend berjalan di `http://localhost:5000` (Swagger di `/api/docs`)

#### Install Redis (Untuk Caching, Opsional)

Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

CentOS/RHEL:
```bash
sudo yum install redis
sudo systemctl start redis
sudo systemctl enable redis
```

Docker:
```bash
docker run -d -p 6379:6379 redis:alpine
```

Verify Redis:
```bash
redis-cli ping
# Should return: PONG
```

Konfigurasi Redis di `.env`:
```bash
REDIS_URL=redis://localhost:6379/0
```

### Pengaturan Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# (opsional) set VITE_API_URL kalau backend tidak di http://localhost:5000

# Jalankan development server
npm run dev
```

Frontend berjalan di `http://localhost:3000` (dev server Vite me-proxy `/api` ke `localhost:5000`; URL API otomatis terdeteksi dari host kalau `VITE_API_URL` tidak di-set)

---

## Pengujian

101 file test backend (pytest, ~20.800 baris) mencakup finance (termasuk `test_finance_reports.py` yang mengekspor semua laporan ke Excel dan PDF), sales, purchasing, production, warehouse, auth, OEE, dan lainnya - termasuk `test_production_extended.py` (4.155 baris) yang cukup detail. Frontend memakai Vitest (5 file test, antara lain routing dan workspace bertab).

> [!WARNING]
> CI di GitHub Actions (`.github/workflows/ci.yml`) saat ini hanya menjalankan `test_health.py` dan `test_auth.py` saat push. 99 dari 101 file test lainnya hanya jalan manual (`pytest tests/ -v`). Beberapa step CI juga memakai `continue-on-error: true`, jadi CI belum bisa menggagalkan build.

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
npm run test:ui

# Jalankan dengan coverage
npm run test:coverage
```

---

## Dokumentasi API

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

Login mengembalikan `access_token`, `refresh_token`, dan data `user` (termasuk `roles`); perbarui token lewat `POST /api/auth/refresh` dan perpanjang sesi lewat `POST /api/auth/extend-session`. Registrasi user baru lewat `POST /api/auth/register` menunggu persetujuan super admin. Dokumentasi interaktif (Swagger) tersedia di `/api/docs`.

### Format Respons Umum

Format respons belum seragam antar endpoint. Pola yang paling umum:

Sukses: objek/array JSON langsung (misalnya `{"items": [...], "total": 10, "page": 1}` untuk list berpaginasi, atau `{"message": "...", "id": 1}` untuk aksi tulis); sebagian endpoint lama memakai amplop `{"success": true, "data": {...}}`.

Error: `{"error": "Pesan error"}` dengan status HTTP 4xx/5xx yang sesuai.

### Redis Cache Endpoints

```http
GET  /api/cache/stats     # Statistik cache
POST /api/cache/clear     # Hapus cache
```

Cache Configuration:

- Default timeout: 5 menit (300 detik)
- Machines cache: 10 menit
- Dashboard metrics: 2 menit
- Work orders: 1 menit

---

## Struktur Proyek

```
SourceCode/
├── backend/
│   ├── app.py                  # Main Flask application
│   ├── config.py               # Konfigurasi aplikasi
│   ├── models/                 # 60 model files · 351 DB tables
│   │   ├── spc.py              # SPC models (5 tabel)
│   │   ├── dcc.py              # DCC & CAPA models (13 tabel)
│   │   ├── production.py       # Production models (~15 tabel)
│   │   └── ...
│   ├── routes/                 # 116 route files (±104 blueprint terdaftar)
│   │   ├── spc.py              # SPC API endpoints
│   │   ├── finance_reports.py  # Pusat Laporan Keuangan (Excel/PDF)
│   │   ├── oee.py              # OEE + Quality Objective
│   │   ├── production.py       # Production endpoints
│   │   └── ...
│   ├── utils/                  # 67 helper files
│   │   ├── dcc_pdf.py          # PDF generation dengan digital signature
│   │   ├── coa_roles.py        # Peran akun CoA (Accurate / legacy)
│   │   ├── finance_helpers.py  # Jurnal, kurs, credit memo, periode
│   │   ├── scheduled_jobs.py   # APScheduler (karantina batch, eskalasi persetujuan)
│   │   ├── email_service.py    # Email notifications
│   │   ├── production_events.py # Production event handlers
│   │   └── ...
│   ├── tests/                  # 101 file test (~20.800 baris)
│   ├── migrations/             # Alembic migration files
│   ├── seeds/                  # Seed data files
├── frontend/                   # 547 file .tsx/.ts
│   └── src/
│       ├── pages/              # 40 direktori modul · 411 file halaman
│       │   ├── Quality/SPC/    # SPCDashboard, SPCSampleForm
│       │   ├── Production/     # 70 production pages
│       │   ├── Finance/        # 50 finance pages (termasuk Reports/ - 12 laporan)
│       │   ├── HR/             # 33 HR pages
│       │   └── ...
│       ├── components/         # 79 reusable components (ui/NumberInput, ConfirmDialog, SearchableSelect, ...)
│       ├── workspace/          # Workspace bertab: TabRouter, drafts, click tracker
│       ├── services/           # RTK Query API services
│       ├── store/              # Redux store
│       └── contexts/           # React contexts (Language, Theme)
├── scripts/OpenWA/             # WhatsApp gateway (NestJS, service terpisah)
├── agent/ · agent-dashboard/   # Ops Agent Monitor (alat terpisah)
├── PETA_MODUL.md               # Peta modul, FK, dan prefix API
├── docker-compose.yml          # Docker configuration (postgres 15, redis 7, backend, frontend)
└── README.md

Backend:  ~144,700 baris (di luar test & migrasi)
Test:     ~20,800 baris (backend)
Frontend: ~221,700 baris
Total:    ~387,000 baris (per Oktober 2026)
```

---

## Fitur Keamanan

- Autentikasi JWT - Token-based auth dengan refresh token
- Enkripsi Password - Bcrypt dengan salt
- Proteksi CORS - Whitelist origin
- Pencegahan SQL Injection - SQLAlchemy ORM parameterized queries
- Proteksi XSS - Input sanitization
- Kontrol Akses Berbasis Role (RBAC) - 40+ default roles, 200+ permissions, module-level access control
- Jejak Audit - Tracking semua perubahan data
- Google OAuth - Login dengan akun Google
- Rate Limiter - Pembatasan request per endpoint (Flask-Limiter, 20.000/jam global) + brute-force lockout login (5x gagal, window 15 menit)
- PDF Security - AES encryption + digital signature (DCC module)
- Flask-Talisman - CSP headers + secure cookies, aktif environment-aware (production only)
- Security Scanning - Bandit & Safety di CI/CD
- Sentry - Error monitoring production
- Audit Log level-field - setiap perubahan data (before/after tiap kolom) dicatat lewat event SQLAlchemy `before_flush`/`after_flush`; super admin dikecualikan; ada halaman viewer dan ringkasan di dashboard
- RBAC ketat - `is_admin` tidak lagi menjadi bypass global (dibatasi ke peran yang sah); halaman Settings khusus super admin; ~1.100 endpoint dijaga permission
- Persetujuan aman - row-locking mencegah posting GL ganda saat approve bersamaan, plus job eskalasi persetujuan per jam (opt-in, hanya notifikasi)
- Penomoran dokumen aman konkurensi - `generate_number()` memakai counter ber-lock (diuji 10 thread, 0 error)
- Registrasi pending - user baru menunggu persetujuan super admin sebelum bisa login

> [!WARNING]
> Catatan keamanan: `SECRET_KEY` di `config.py` punya default `'dev-secret-key'` kalau environment variable tidak diisi. Itu aman selama production mengisinya, tapi berisiko di environment yang lupa. `JWT_QUERY_STRING_NAME = 'token'` juga aktif, jadi JWT bisa dikirim lewat query string dan berpotensi tercatat di access log. Rate limiter login masih memakai dict in-memory, bukan Redis, sehingga tidak konsisten kalau dijalankan multi-process atau multi-server.

### Detail Sistem RBAC

| Komponen | Jumlah | Deskripsi |
|----------|--------|-----------|
| **Peran** | 40+ | Dari Super Admin sampai Helper Gudang |
| **Modul** | 35+ | Termasuk DCC, SPC, Akuntansi, Pre-Shift Checklist |
| **Izin** | 200+ | Format: `module.action` (e.g. `dcc.approve`, `spc.view`) |
| **Aksi** | view, create, edit, delete, approve, post, dll | Granular per-modul |

Hierarki Peran:

- Super Admin - Akses penuh semua modul + Pengaturan
- Direktur (Utama, Operasional, Keuangan, HRD) - Dashboard eksekutif + persetujuan
- Manajer (Produksi, Penjualan, QC, Keuangan, dll) - CRUD penuh per departemen
- Supervisor - Monitoring + create/edit
- Staf - Operasional harian
- Operator/Helper - Input data produksi
- Auditor - Baca-saja semua modul
- Penampil/Tamu - Baca-saja terbatas

Catatan: Modul Grup Chat dapat diakses semua peran tanpa pemeriksaan izin (komunikasi internal).

---

## Internasionalisasi

Dukungan:

- Bahasa Indonesia
- Bahasa Inggris

---

## Asisten AI

> [!WARNING]
> Fitur ini sudah dihapus (16 September 2026, commit `d21f1ec`) - widget chat melayang, endpoint `/api/ai-assistant`, util LLM lokal, dan tombol "Tanya AI" di dashboard dihapus total. Kalau pencarian data dibutuhkan, pakai Global Search (`/api/search/global`) dan Custom Report Builder. File model GGUF di `backend/ml_models/local_llm/` sisa dari fitur lama dan tidak dipakai oleh kode apa pun. Model prediksi EWS (Random Forest) tidak terkait dan masih aktif.

### Tautan Cepat

- Production → Quality Objective - Set target dan analisa downtime
- Production → Daily Controller - Monitoring shift dan OEE
- Quality → SPC - X-bar R Chart & capability analysis
- Quality → Incoming QC - Inspeksi material masuk
- Quality → In-Process QC - QC proses produksi
- Quality → Finish Good QC - QC produk jadi

---

## Pembaruan Terbaru

### v3.12 - Oktober 2026 (Overhaul Finance, Pusat Laporan, Workspace Bertab)

- Pusat Laporan Keuangan - 12 halaman laporan (Neraca Saldo, Mutasi Bank/Kas, Rekap Kas Harian, Posisi Kas & Bank, Kartu Piutang/Hutang, Laporan Pembelian, Rekap PPN, Perubahan Ekuitas) lengkap dengan halaman rincian, ekspor Excel berformat dan PDF sungguhan dari server. Semua angka direkonsiliasi ke GL (total kartu piutang = saldo akun piutang; posisi kas = kas di Neraca).
- Workspace bertab dua tingkat - Tab modul di atas, tab halaman di bawah; detail terbuka di tab baru berjudul sama dengan item yang diklik; tab dan isian form dipulihkan setelah refresh; router kustom per tab dengan keep-alive.
- Format angka/mata uang otomatis pada 480+ input (`NumberInput`), termasuk input `react-hook-form`.
- Penerimaan & Pembayaran Kas/Bank dirombak - satu pembayaran melunasi banyak faktur atau dipecah ke banyak akun, tiga form terpisah, pemilih yang bisa dicari, field *Dibayarkan kepada*, ubah/void dari UI, kwitansi A4 bersih, penomoran manual.
- Chart of Accounts disinkronkan dengan Accurate (459 akun; induk 4-digit, transaksi 6-digit), kode akun otomatis, akun induk bisa dipilih di Buku Besar, riwayat akun dengan filter periode; laporan memakai peran akun (`coa_roles.py`) sehingga tetap jalan di CoA lama.
- Mata uang asing & PPN - pelunasan hutang valas dalam IDR dengan selisih kurs, PPN Masukan dipisah di jurnal faktur/retur pembelian, GRN wajib PO approved, ekspor e-Faktur (Faktur Keluaran + Nota Retur) dengan peringatan NPWP.
- Nota Kredit Customer + undo, Umur Piutang/Hutang, pembayaran *cleared* otomatis saat match bank, saldo WIP per SPK dari GL, stok masuk manual terjurnal.
- Perbaikan akuntansi hasil audit - Neraca menghitung semua akun ekuitas, void tidak lagi mengurangi saldo dua kali, pembayaran payroll memposting Dr Hutang Gaji / Cr Kas, halaman Pajak tidak crash, upah buruh langsung dipecah ke sub-akun HPP, utilitas pabrik ke HPP.
- Cetak ulang - PO, Surat Jalan, SPK, SPK Batch, Faktur, dan Kwitansi dibangun ulang sebagai layout A4 bersih (tanda tangan SPK: PPIC dan Manager Produksi), tetap lewat template Designer.

### v3.11 - Oktober 2026 (Audit Lintas Modul, Hardening Enterprise, Paritas SAP)

- Audit end-to-end puluhan modul - Puluhan bug diperbaiki: data dashboard yang dikarang (margin 24% hardcode, harga Rp15.000/unit palsu, fallback mock), halaman yang crash karena kontrak field, SQL gaya SQLite di PostgreSQL, hitungan omset yang ikut menjumlah draft/cancelled, retur penjualan/pembelian yang sebelumnya 100% rusak, dan lainnya.
- Hardening enterprise - RBAC `is_admin` tidak lagi bypass global, row-locking approval (mencegah posting GL ganda), job eskalasi persetujuan, penomoran dokumen aman konkurensi, registrasi pending oleh super admin, audit log level-field dengan viewer dan widget dashboard, penambalan celah JWT dan secret cron.
- Paritas SAP lanjutan - Movement Type, MRP Lot Sizing (EX/FX/WB/MB), Posting Period per jenis akun, netting MRP "firm", dan pemecahan batch FIFO saat pengiriman (lihat tabel Perbandingan dengan SAP).
- Handling Unit (palet/kemasan dengan persen isi), guard double-ship pada pengiriman, stok opname delta-based, transfer sadar-batch.
- Tutup SPK, alur SPK/EJO native (`/api/spk` + log staging gudang `SPKWarehouseStageLog`), Ubah Status Batch (QC), Batch Record GMP + laporan mingguan.
- Komponen UI bersama - `ConfirmDialog` + Toast menggantikan 137 file yang masih memakai `confirm()`/`alert()`; rollout dashboard bento 17 modul; cascade warna Axion lewat satu perubahan `tailwind.config.js`; Report Scheduler dan Custom Report Builder yang sebelumnya mock kini nyata.
- Infrastruktur - Server VPS cadangan (Postgres + Redis + PM2) dengan domain `erp.`/`api.` lewat nginx + certbot; dua database (`erp_db`, `erp_db_v2`) selalu dimigrasi bersamaan; perbaikan keamanan dependensi (Pillow, ws, tar-fs, js-yaml, guzzle, dll.).

### v3.10 - September 2026 (Pematangan HR, Closing Period gaya SAP, Transaksi Stok MB51, Ops Agent Monitor)

- Konsolidasi Sistem Cuti - Dua sistem cuti paralel yang sebelumnya tidak sinkron (`Leave` vs `StaffLeaveRequest`) digabung jadi satu, ditambah kuota/saldo cuti tahunan real-time, koreksi & rekonsiliasi absensi (cross-check vs log produksi operator), dan jadwal kerja per-karyawan untuk staff kantor (terpisah dari roster shift produksi).
- Segregation-of-Duty Payroll & Appraisal - Payroll tidak bisa di-approve oleh orang yang menghitungnya sendiri; Appraisal manager tidak bisa menilai duluan sebelum karyawan self-review.
- Laporan HR - Endpoint backend dibangun dari nol untuk halaman laporan yang sudah lama ada di frontend tapi selalu 404 (tidak pernah ada backend-nya sama sekali) - 5 jenis laporan dengan export Excel/PDF.
- Closing Period gaya SAP - Dari kunci on/off sederhana jadi: kunci berurutan wajib, reopen guard (tidak bisa buka periode kalau periode setelahnya sudah ditutup), kunci parsial per jenis transaksi, checklist closing ("Closing Cockpit" ringan, admin-editable tanpa migrasi), peringatan stok negatif (advisory), dan enforcement `is_period_locked()` di 8 titik penulisan jurnal termasuk Payroll dan Approval Workflow generik.
- Transaksi Stok gaya SAP MB51 (Reports & Settings, lintas modul) - Selection screen, ALV grid dengan field catalog per-user, saldo berjalan (running balance) direkonstruksi read-time, drawer detail 3 tab, export Excel/CSV. Dipindah dari menu Warehouse ke menu global karena datanya sudah lintas Purchasing/Production/Shipping/Finance.
- PR → PO Split Multi-Supplier - Konversi Purchase Requisition ke Purchase Order sekarang otomatis pecah jadi beberapa PO kalau item-itemnya punya supplier pilihan berbeda-beda.
- Ops Agent Monitor (alat operasional terpisah, bukan bagian ERP) - Memantau log PM2 backend/frontend, deteksi error otomatis, diagnosis via Claude API, notifikasi & approval lewat WhatsApp (auto-discovery sesi OpenWA + HMAC signature verification + login dashboard).

<details>
<summary><b>Riwayat versi sebelumnya (v2.0 sampai v3.9)</b></summary>

### v3.9 - September 2026 (Restrukturisasi Gudang, Siklus Hidup SPK, Perbaikan GL Finance)

- Restrukturisasi Storage Location Gudang - Zona gudang dirombak total menjadi struktur nyata bergaya SAP storage location: Area Produksi, Gudang Bahan Baku, Gudang Bahan Kemas, Gudang Barang Jadi (WIP ikut di sini), dan Gudang Reject. Status batch (release/quarantine/reject) tetap independen dari lokasi fisik. Barang jadi otomatis masuk Area Produksi saat produksi selesai, lalu berpindah ke Gudang Barang Jadi saat Tutup SPK - tercatat sebagai transfer movement yang bisa dibalik.
- Siklus Pembatalan SPK - Dua aksi baru: "Batalkan SPK" (untuk SPK yang sudah *completed*, membalikkan transfer gudang + status QC kembali ke *released*, ditolak otomatis kalau barang sudah dikirim/terpakai) dan "Batalkan Konfirmasi" (untuk batch yang masih *in_progress*, mengosongkan Bahan Aktual dan mengembalikan reservasi/stok tanpa menyentuh gudang).
- Pemilihan Batch Manual & Disposisi QC Bertingkat - Layar konfirmasi Bahan Aktual kini bisa menampilkan stok bahan di semua lokasi dan memilih batch aktual berbeda dari saran FIFO. Disposisi QC (halaman "Ubah Status Batch") kini mendukung pemecahan kuantitas ke beberapa status sekaligus (misal 9.900 pcs release + 100 pcs reject dari satu batch), bukan lagi ubah status satu baris utuh - gaya SAP MB1A/MB1B, dengan jejak histori kuantitas penuh.
- Perbaikan GL Finance - Fixed Asset disposal kini memposting jurnal akuntansi otomatis (akumulasi penyusutan + laba/rugi pelepasan), Purchase Return terhubung ke Inventory/Invoice/GL (sebelumnya blueprint-nya bahkan belum terdaftar), dan beberapa bug field-mismatch yang membuat dropdown Chart of Accounts/Budget/Cash & Bank tampil kosong sudah diperbaiki.
- Pembersihan Kode Mati - Modul Integration palsu (External Connectors/API Gateway/Webhook/Data Sync - tidak pernah benar-benar tersambung ke sistem apa pun) dan sejumlah halaman/endpoint yatim (orphan) dihapus.

### v3.8 - Agustus 2026 (Integrasi Accurate Online, BOM Multi-Level, Gudang PM/EPD/FG)

- Modul Integrasi Accurate Online - Sinkronisasi dua arah antara Internal ERP dan Accurate Online, mencakup item master, BOM/formula, Work Order, dan pergerakan stok antar gudang (lihat Modul 18 untuk detail lengkap):
  - BOM Multi-Level - `BillOfMaterials` kini mendukung formula bertingkat Barang Jadi → WIP → Mixing, terverifikasi dengan data produksi real sampai 5 tingkat
  - Cek EJO - Pencarian dan breakdown lengkap Perintah Kerja Accurate: bahan bertingkat rekursif, histori tahap gudang, Mesin/Operator/Shift, dan perbandingan otomatis dengan Work Order Internal ERP
  - Stok Gudang PM/EPD/FG - Sinkronisasi stok resmi dari Accurate (`item/detail.do`), mencakup seluruh katalog barang termasuk bahan baku/kimia/kemasan, bukan cuma barang jadi
  - Jejak Audit Transfer Gudang - Sinkronisasi 2.900+ transaksi resmi perpindahan barang antar gudang (PM↔EPD↔FG) dari Accurate, lengkap dengan nomor batch dan tanggal kedaluwarsa
  - Rekonsiliasi Penamaan Produk - Alat pencocokan kandidat nama produk mirip untuk item yang belum tersinkron otomatis antara kedua sistem
  - OAuth2 dengan 175 scope API resmi Accurate - dari sinkronisasi item dasar hingga transfer stok dan Perintah Kerja

### v3.7 - Juli 2026 (Modul EWS - Early Warning System Machine Learning)

- Modul EWS (Early Warning System) - Sistem prediksi risiko downtime shift produksi berbasis Machine Learning:
  - Random Forest Model - Menggunakan model ML `rich_p75_v1` dengan feature engineering lanjutan (lag metrics, 3-shift rolling averages, downtime breakdown)
  - Asynchronous Auto-Scoring - Event listener SQLAlchemy `after_insert` yang menghitung probabilitas risiko secara otomatis di background thread
  - EWS Dashboard - UI frontend terintegrasi dengan indikator status AMAN/BAHAYA, probabilitas bahaya, per-machine risk breakdown, dan detail modal
  - Manual Re-scoring & Backfill - Endpoint `/api/ews/rescore/:id` dan script CLI `ews_backfill.py` untuk pemrosesan ulang/historis

### v3.6 - Juli 2026 (Migrasi PostgreSQL, Berat Kotor OCR, Auto-Merge Batch)

- Migrasi Database SQLite → PostgreSQL - Database production kini berjalan di PostgreSQL (sebelumnya SQLite):
  - Script migrasi otomatis (`migrate_to_postgres.py`) dengan dry-run, sanitasi datetime multi-format, fallback row-by-row, dan verifikasi integritas FK
  - 305/306 tabel bermigrasi dengan kecocokan baris 100%, 0 orphan record
  - Koneksi laptop ↔ server via Tailscale, PostgreSQL dikonfigurasi menerima koneksi remote (firewall & listen_addresses)
- Berat Kotor (Gross Weight) pada Packing List OCR - Pelacakan berat kotor selain berat netto:
  - Kolom `weight_gross_kg` baru di `packing_list_new_items`, tersimpan otomatis dari hasil scan OCR
  - Ditampilkan di halaman detail Packing List (per karton & ringkasan per batch)
- Auto-Merge Batch pada OCR Packing List - Saat scan OCR mendeteksi batch number yang sudah ada di Packing List terbuka untuk produk yang sama, sistem menawarkan penggabungan otomatis (nomor karton lanjut berurutan, bukan bikin Packing List baru):
  - Endpoint baru: `check-existing-batch` (deteksi PL yang cocok) dan `append-cartons` (tambah karton ke batch yang sudah ada)
- Restyling Glassmorphism - `ProductionMonitoringDashboard.tsx` diperbarui ke gaya glassmorphism
### v3.5 - Juli 2026 (Work Center Dashboard)

- Work Center Dashboard - Halaman ringkasan status mesin real-time (`/app/production/work-center`):
  - 1 Endpoint Baru - `GET /api/production/work-center-summary`, agregasi harian OEE & downtime per mesin dari data Shift Production (query tunggal ter-group, tanpa N+1)
  - Breakdown Downtime per Kategori - Mesin, Operator, Material, Design, Others - ditampilkan dengan visualisasi bar per mesin (expandable row)
  - Navigasi Tanggal Historis - Parameter `?date=` untuk melihat ringkasan hari mana pun, tidak terbatas hari ini
  - Sidebar Integration - Menu "Work Center" di bawah Machine Data pada modul Produksi

### v3.4 - Juli 2026 (WhatsApp Gateway, System Health, Codebase Cleanup)

- WhatsApp Notification Gateway - Integrasi notifikasi WhatsApp otomatis saat Work Order selesai:
  - Dual Provider - Self-hosted (OpenWA/Node.js gateway) atau Twilio WhatsApp Business API, dikonfigurasi via Settings
  - Auto-trigger - Notifikasi otomatis ke nomor tujuan (multi-nomor) saat WO completion, dengan metrik ringkasan produksi
  - Konfigurasi Fleksibel - Enable/disable, provider, API URL, token, dan target phone numbers via `config_manager`
- System Health Dashboard - Halaman monitoring real-time di Settings (`/app/settings/system-health`):
  - Status API server, database, WhatsApp gateway, dan frontend dalam satu tampilan
  - Resource usage (CPU, memory, disk), info database (tabel, ukuran, backup terakhir)
  - Status PM2 processes (uptime, restart count, memory per proses)
  - WhatsApp Gateway detail: status koneksi, nomor aktif, aktivitas terakhir, tombol reconnect
- Automated Database Backup - Cron job harian (02:00) dengan retensi lokal 7 hari & retensi Google Drive 90 hari (via rclone)
- Codebase Cleanup - Pembersihan one-off debug/fix scripts dan arsip backup usang:
  - Baris kode backend: ~256,000 → ~127,600 (penghapusan script sekali-pakai, bukan regresi fitur)
  - Total baris kode: ~458,000 → ~332,000
- Route files: 108 → 110 | Module directories: 39 → 40 | Page files: 368 → 371 | Database tables: 306 → 308

### v3.3 - Juni 2026 (SPC Module)

- Modul SPC Lengkap - Statistical Process Control terintegrasi penuh:
  - 5 Models Baru: SPCParameter, SPCProductSpec, SPCSample, SPCMeasurement, SPCControlLimitHistory
  - 8 API Endpoints: parameter, specs, samples, chart-data, dashboard, recalculate
  - 2 Frontend Components: SPCDashboard (Recharts X-bar & R Chart), SPCSampleForm
  - Logika SPC Lengkap: Western Electric Rules 4 aturan, Cp/Cpk/Cpu/Cpl, ASTM/ISO factors n=2-10
  - Auto-create Specs: Spesifikasi otomatis dari data produk (GSM, CD, MD) dengan toleransi ±10-15%
  - 7 Parameter Default: GSM, CD, MD, THICKNESS, MOISTURE, PH, DEFECT_P
  - Sidebar Integration: Menu SPC di bawah modul Quality
  - Database models: 52 → 53 files, 301 → 308 tabel DB 
- Export Fix - Perbaikan export Excel & PDF "Top 3 Downtime" di Production Monitoring:
  - `@jwt_required(optional=True)` untuk halaman publik
  - Unique ParagraphStyle names (ReportLab)
  - Improved error handling di frontend (detect JSON error in blob)

### v3.2 - Mei 2026 (Asset Management Module)

- Modul Asset Management Terpadu - Enterprise Asset Management (EAM) lengkap:
  - 6 Models Baru: Asset, DepreciationSchedule, AssetTransfer, AssetValuation, SparePart, SparePartMovement
  - 15 API Endpoints: CRUD, depreciation, transfer, spare parts, reports
  - 6 Frontend Components: Dashboard, List, Detail, Form, SpareParts, DepreciationReport
  - Siklus Hidup Lengkap: Planning → Procurement → Installation → Active → Maintenance → Disposal
  - Penyusutan Otomatis: Straight line & declining balance, batch calculation
  - Spare Parts (MRO): Inventaris suku cadang dengan reorder alerts
  - Integration: Link dengan Maintenance records & Financial accounting

### v3.1.1 - April 2026 (Pembaruan README)

- Dokumentasi README diverifikasi dan diperbarui
- Backend routes: 91 → 108 files verified 
- Frontend pages: 35 → 39 module directories 
- Database models: 49 → 52 files 

### v3.1 - April 2026

- Overhaul RBAC - 40+ peran, 200+ izin, kontrol akses level modul
- Izin DCC - Modul `dcc` dengan 5 aksi
- CAPA: Referensi Penyimpangan Mutu - Field input manual nomor dokumen
- Sidebar RBAC - Pemeriksaan izin untuk DCC & Akuntansi

### v3.0 - Maret 2026

- Modul DCC - Pusat Kontrol Dokumen dengan 13 tabel (ISO 9001:2015)
- Modul CAPA - CPAR/SCAR/CCHF dengan penomoran otomatis & RCA 5-Why
- Memo Internal - Komunikasi antar departemen
- Pemusnahan Dokumen - Berita acara pemusnahan (FRM-DCC-14)

### v2.1 - Januari 2026

- Modul Stok WIP - Tracking stok Work In Progress
- Daftar Packing Terpisah - Packing list independen dari WO
- Modul R&D Ditingkatkan - 8 file backend
- Absensi Publik - QR Code attendance tanpa login

### v2.0 - 2025

- Modul Quality Objective - Target manual per mesin, pelacakan pencapaian
- Analisis Downtime - Top 3 downtime, analisis akar masalah
- Enhanced QC Workflows - Incoming, In-Process, Finish Good QC

</details>

---

## Panduan Mulai Cepat

### 1. Sistem Login

- URL: `http://localhost:5173`
- Admin Default: `admin / admin123`

PENTING: Ganti password default segera setelah setup pertama untuk keamanan sistem!

### 2. Akses Modul Utama

- Produksi: Work Orders → Daily Controller → Quality Objective
- Kualitas: Incoming → In-Process → Finish Good QC → SPC
- Penjualan: Customers → Orders → Quotations
- Inventori: Items → Stock → WMS Dashboard
- SPC: Quality → SPC → Dashboard / Input Sample

### 3. Alur Kerja Quality Objective

1. Buka Produksi → Quality Objective
2. Pilih tahun/bulan
3. Klik "Set Target" untuk input target bulanan per mesin
4. Lihat tingkat pencapaian dan status
5. Klik "Analisa Downtime" untuk analisis detail
6. Export hasil ke Excel atau PDF

### 4. Alur Kerja SPC

1. Buka Quality → SPC
2. Klik "Input Sample" untuk memasukkan data subgroup
3. Pilih Work Order yang sedang berjalan
4. Tambahkan parameter (GSM, CD, MD, dll.) dan masukkan readings
5. Submit - sistem otomatis deteksi OOC & Western Electric Rules
6. Lihat grafik X-bar & R Chart di dashboard

---

## Kontak & Dukungan

Mochammad Bayu Adhie Nugroho

- Email: baymngrh@gmail.com
- GitHub: [@bayuadhie-dev](https://github.com/bayuadhie-dev)

Untuk dukungan teknis, permintaan fitur, atau laporan bug, silakan email kami di baymngrh@gmail.com

---

## Lisensi

GNU Affero General Public License v3.0 (AGPL-3.0)

Copyright (c) 2025-2026 Mochammad Bayu Adhie Nugroho. All Rights Reserved.



See [LICENSE](LICENSE) for full terms.

---

## Peta Jalan

### Selesai

- ~50 modul/domain logis, 100+ sub-modul
- 60 model files, 351 tabel database (model), 116 route files, 101 file test backend
- ~387,000 baris kode (backend + test + frontend; belum termasuk alat terpisah `agent/`+`agent-dashboard/`)
- Autentikasi & otorisasi (JWT + OAuth + Face Recognition)
- 15+ alur kerja otomatis end-to-end
- Dashboard Eksekutif dengan KPI real-time
- SPC (Statistical Process Control) - X-bar R Chart, Western Electric Rules, Cp/Cpk
- Early Warning System (EWS) - Prediksi risiko downtime shift produksi dengan Random Forest ML
- Modul DCC & CAPA (ISO 9001:2015) - 13 tabel
- Modul Asset Management (EAM) - sudah konsolidasi dengan Fixed Assets, satu sistem aset tetap
- Modul Stok WIP & Daftar Packing
- Quality Objective & Analisis Downtime + Export Excel/PDF
- Modul R&D dengan alur kerja persetujuan
- WMS Advanced dengan batch traceability + Transaksi Stok gaya SAP MB51 (saldo berjalan, field catalog, lintas modul)
- Finance lengkap: GL, AP, AR, WIP Accounting, Job Costing, Bank Reconciliation, Commitment Accounting, Closing Period gaya SAP (kunci berurutan, reopen guard, kunci parsial, checklist)
- Integrasi Accurate Online - Sinkronisasi item/BOM, EJO cross-check, stok & transfer gudang PM/EPD/FG
- HR terpadu - sistem cuti tunggal dengan kuota real-time, koreksi & rekonsiliasi absensi, segregation-of-duty payroll/appraisal
- Ops Agent Monitor - alat monitoring log PM2 + diagnosis AI + notifikasi WhatsApp (terpisah dari ERP utama)
- Pusat Laporan Keuangan - 12 laporan + rincian, ekspor Excel & PDF sungguhan
- Workspace bertab dua tingkat dengan pemulihan form setelah refresh; format angka otomatis
- Finance sampai level kas/bank - penerimaan/pembayaran multi-faktur, mata uang asing, Nota Kredit, e-Faktur, umur piutang/hutang, CoA sesuai Accurate
- Hardening enterprise - RBAC scoping, audit log level-field, row-locking approval, penomoran dokumen aman konkurensi
- Handling Unit, Source List / Release Strategy / Invoice Blocking / Pricing Procedure / MRP Lot Sizing

### Sedang Dikerjakan

- Keputusan kebijakan Pre-Shift Checklist (gate NG) dan daftar keyword downtime dari manajemen
- Pencabutan integrasi Accurate (ditahan sampai data selesai ditarik)
- Menaikkan CI dari 2 menjadi seluruh test backend (saat ini `continue-on-error`)
- Frontend DCC yang ditingkatkan (operasi massal, pencarian lanjutan)
- SPC: p-chart untuk parameter attribute (DEFECT_P)

### Direncanakan

- Analitik prediktif AI/ML
- Integrasi IoT untuk mesin produksi
- Aplikasi mobile (React Native)
- Dukungan multi-pabrik
