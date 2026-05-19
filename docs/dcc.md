# 🏗️ Rencana Implementasi Modul DCC (Document Control Center) & CAPA

> **Referensi Prosedur:** QP-DCC-01, QP-DCC-02, QP-DCC-03, QP-DCC-04, WI-DCC-01, WI-DCC-02
> **Standar:** ISO 9001:2015 (Klausul 7.5)
> **Updated:** 2026-03-12

---

## 📑 Peta Modul & Formulir Terkait

| Sub-Modul | Prosedur | Formulir Digital |
|-----------|----------|-----------------|
| **Pengendalian Dokumen** | QP-DCC-01 | FRM-DCC-01 (Serah Terima), FRM-DCC-02 (Daftar Induk), FRM-DCC-04 (Distribusi), FRM-DCC-05 (Change Notice), FRM-DCC-10 (Kaji Ulang) |
| **Pengendalian Rekaman Mutu** | QP-DCC-02 | FRM-DCC-03 (Daftar Induk Rekaman Mutu) |
| **CAPA** | QP-DCC-03, WI-DCC-02 | FRM-DCC-08 (CPAR), FRM-DCC-11 (SCAR), FRM-DCC-09 (Lap. Bulanan CPAR), FRM-MKT-13 (CCHF) |
| **Komunikasi Internal** | QP-DCC-04 | FRM-DCC-07 (Memo Internal) |
| **Pemusnahan Dokumen** | WI-DCC-01 | FRM-DCC-14 (Berita Acara Pemusnahan) |

---

## 🗄️ Arsitektur Database (SQLAlchemy Models)

File: `/backend/models/dcc.py`

### I. Sub-Modul Pengendalian Dokumen (QP-DCC-01)

#### 1. `DccDocument` — Daftar Induk Dokumen (FRM-DCC-02)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | Integer, PK | |
| `document_number` | String, Unique | Format: `[Level]-[Dept]-[Urut]` (cth: QP-DCC-01) |
| `title` | String | Judul dokumen |
| `document_level` | Enum | `I` (QM), `II` (QP), `III` (WI), `IV` (Form/Standard) |
| `department_code` | String | Kode dept: DCC, PRD, QA, MKT, HRD, dll. |
| `retention_period_years` | Integer | Level I-III: 5 tahun; Level IV: null (berlaku selamanya) |
| `is_active` | Boolean | True = masih berlaku |
| `created_by` | FK → User | Pembuat/Originator |
| `created_at` | DateTime | |

#### 2. `DccDocumentRevision` — Riwayat Revisi & File Repository

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | Integer, PK | |
| `document_id` | FK → DccDocument | |
| `revision_number` | Integer | 00, 01, 02... |
| `effective_date` | Date | Tanggal efektif berlaku |
| `expiry_date` | Date | effective_date + retention_period (Level I-III) |
| `docx_file_path` | String | Master softcopy (.docx) |
| `pdf_file_path` | String | Published PDF + watermark "CONTROLLED COPY" |
| `status` | Enum | `draft`, `reviewing`, `pending_approval`, `active`, `obsolete` |
| `change_reason` | Text | Alasan perubahan (FRM-DCC-05) |
| `change_type` | String | `format_change`, `content_change`, `new_document` |
| `originator_id` | FK → User | Pembuat |
| `reviewer_id` | FK → User | Pengkaji/Pemeriksa |
| `approver_id` | FK → User | Pengesah |
| `originator_signed_at` | DateTime | |
| `reviewer_signed_at` | DateTime | |
| `approver_signed_at` | DateTime | |
| `obsoleted_at` | DateTime | Kapan di-stamp OBSOLETE |
| `obsoleted_by` | FK → User | |
| `created_at` | DateTime | |

> [!IMPORTANT]
> **Otorisasi berbeda per level:**
> - **QM (Level I):** Pembuat = MR, Pengkaji = GM, Pengesahan = Direktur
> - **QP (Level II):** Pembuat = Manager/Head Dept, Persetujuan = Mgr QA + Penanggung Jawab Teknis, Pengesahan = GM
> - **WI (Level III):** Pembuat = Staf/Supervisor/Dept Head, Pengkaji = Dept Head terkait, Pengesahan = Mgr QA + Penanggung Jawab Teknis
> - **Form (Level IV):** Perubahan via FRM-DCC-05

#### 3. `DccDocumentDistribution` — Distribusi & Serah Terima (FRM-DCC-01 + FRM-DCC-04)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | Integer, PK | |
| `revision_id` | FK → DccDocumentRevision | |
| `copy_number` | Integer | Nomor salinan |
| `copy_type` | Enum | `controlled`, `uncontrolled` |
| `department_target` | String | Dept penerima |
| `received_by` | FK → User | Penerima fisik |
| `received_at` | DateTime | Tanda tangan digital penerima (FRM-DCC-01) |
| `is_acknowledged` | Boolean | Sudah confirm kelengkapan? |
| `old_copy_returned` | Boolean | Sudah kembalikan revisi lama? |
| `old_copy_returned_at` | DateTime | |

#### 4. `DccDocumentReview` — Kaji Ulang Dokumen (FRM-DCC-10)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | Integer, PK | |
| `document_id` | FK → DccDocument | |
| `review_date` | Date | Tanggal kaji ulang |
| `review_result` | Enum | `still_relevant`, `needs_revision`, `obsolete` |
| `review_notes` | Text | Catatan hasil kaji ulang |
| `reviewed_by` | FK → User | |
| `next_review_date` | Date | 3-4 bulan sebelum expiry |

> [!NOTE]
> Kaji ulang wajib dilakukan **3-4 bulan sebelum masa berlaku habis** (per QP-DCC-01).

#### 5. `DccChangeNotice` — Permohonan Perubahan Dokumen (FRM-DCC-05)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | Integer, PK | |
| `document_id` | FK → DccDocument | |
| `request_number` | String, Unique | Auto-generated |
| `change_description` | Text | Uraian perubahan |
| `reason` | Text | Alasan perubahan |
| `requested_by` | FK → User | |
| `requested_at` | DateTime | |
| `approved_by` | FK → User | |
| `approved_at` | DateTime | |
| `status` | Enum | `pending`, `approved`, `rejected`, `implemented` |
| `resulting_revision_id` | FK → DccDocumentRevision | Revisi yang dihasilkan |

---

### II. Sub-Modul Pengendalian Rekaman Mutu (QP-DCC-02)

#### 6. `DccQualityRecord` — Daftar Induk Rekaman Mutu (FRM-DCC-03)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | Integer, PK | |
| `record_number` | String, Unique | Nomor khas rekaman |
| `title` | String | Judul rekaman |
| `record_type` | Enum | `smm` (Rekaman SMM), `product` (Rekaman Mutu Produk) |
| `revision_number` | Integer | |
| `department` | String | Departemen holder |
| `holder_id` | FK → User | Pemegang salinan |
| `storage_location` | String | Lokasi ordner penyimpanan |
| `retention_period` | String | Masa simpan (cth: "ED + 1 tahun") |
| `is_confidential` | Boolean | Bersifat rahasia? (menentukan metode pemusnahan) |
| `status` | Enum | `active`, `archived`, `destroyed` |
| `published_date` | Date | |
| `created_by` | FK → User | Originator |

---

### III. Sub-Modul CAPA (QP-DCC-03 + WI-DCC-02)

#### 7. `CapaRequest` — CPAR/SCAR/CCHF Induk

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | Integer, PK | |
| `capa_number` | String, Unique | Auto: CPAR = `CP/BB/CC/DD-nnn`, SCAR = `SC/BB/CC/nnn` |
| `capa_type` | Enum | `CPAR` (Internal), `SCAR` (Supplier), `CCHF` (Customer Complaint) |
| `capa_source` | Enum | `AI` (Audit Internal), `AE` (Audit External), `MR` (Mgmt Review), `PM` (Penyimpangan Mutu), `KP` (Keluhan Pelanggan) |
| `issue_description` | Text | Deskripsi ketidaksesuaian |
| `product_affected` | String | Produk yang terpengaruh |
| `attachment_paths` | JSON | Array path bukti foto/video |
| `raised_by` | FK → User | Inisiator |
| `raised_date` | Date | |
| `assigned_department` | String | Dept bertanggung jawab (CPAR) atau nama supplier (SCAR) |
| `supplier_id` | FK → Supplier | Jika SCAR |
| `status` | Enum | `open`, `investigation`, `action_progress`, `verifying`, `closed`, `cancelled` |
| `cancellation_reason` | Text | Hanya jika cancelled (perlu approval Inisiator + Management) |
| `cancelled_by` | FK → User | |
| `due_date` | Date | Batas waktu (SCAR: 5 hari kerja) |
| `approved_by` | FK → User | CPAR: Management Rep; SCAR: QA Manager |
| `approved_at` | DateTime | |
| `closed_at` | DateTime | |

> [!IMPORTANT]
> **Penomoran CPAR:** `CP/[Bulan 2digit]/[Tahun 2digit]/[Sumber]-[Urut 3digit]`
> Contoh: `CP/06/25/AI-001` = CPAR bulan Juni 2025, sumber Audit Internal, urutan ke-1
>
> **Penomoran SCAR:** `SC/[Bulan]/[Tahun]/[Urut 3digit]`
> Contoh: `SC/06/25/001`
>
> **Reset nomor urut setiap ganti tahun.**

#### 8. `CapaInvestigation` — Investigasi & RCA + Rencana Tindakan

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | Integer, PK | |
| `capa_id` | FK → CapaRequest | |
| `root_cause_method` | Enum | `five_why`, `fishbone` |
| `root_cause_analysis` | Text | Hasil analisis (5 Why / Fishbone) |
| `five_why_data` | JSON | Struktur 5 Why: `{why1, why2, why3, why4, why5}` |
| `temporary_action` | Text | Tindakan koreksi langsung/sementara |
| `corrective_action` | Text | Tindakan perbaikan (menghilangkan penyebab) |
| `preventive_action` | Text | Tindakan pencegahan (revisi prosedur/proses) |
| `action_due_date` | Date | |
| `pic_name` | String | Person In Charge |
| `pic_department` | String | |
| `investigated_by` | FK → User | Dept terkait |
| `investigation_date` | Date | |

#### 9. `CapaVerification` — Verifikasi Efektivitas & Penutupan

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | Integer, PK | |
| `capa_id` | FK → CapaRequest | |
| `verification_notes` | Text | Hasil evaluasi efektivitas |
| `is_effective` | Boolean | Efektif? |
| `follow_up_action` | Text | Jika tidak efektif, tindakan lanjutan |
| `follow_up_capa_id` | FK → CapaRequest | Link ke CAPA baru jika tidak efektif |
| `verified_by` | FK → User | CPAR: Inisiator + Management; SCAR: QA Manager |
| `verified_date` | Date | |

#### 10. `CapaMonthlyReport` — Laporan Bulanan Status CPAR (FRM-DCC-09)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | Integer, PK | |
| `report_month` | Integer | |
| `report_year` | Integer | |
| `total_open` | Integer | |
| `total_closed` | Integer | |
| `total_overdue` | Integer | |
| `report_data` | JSON | Detail per CPAR |
| `generated_by` | FK → User | DCC |
| `generated_at` | DateTime | |

---

### IV. Sub-Modul Komunikasi Internal (QP-DCC-04)

#### 11. `InternalMemo` — Memo Internal (FRM-DCC-07)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | Integer, PK | |
| `memo_number` | String, Unique | Auto-generated |
| `subject` | String | |
| `content` | Text | Rich Text (HTML) |
| `category` | Enum | `kebijakan_mutu`, `jadwal_produksi`, `kebutuhan_bahan`, `maklum_balas`, `audit`, `lainnya` |
| `attachment_paths` | JSON | Array path lampiran |
| `is_audit_related` | Boolean | Jika true, disimpan oleh Management |
| `published_by` | FK → User | Management |
| `published_date` | Date | |
| `status` | Enum | `draft`, `published`, `archived` |

#### 12. `InternalMemoDistribution` — Log Keterbacaan

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | Integer, PK | |
| `memo_id` | FK → InternalMemo | |
| `department` | String | |
| `user_id` | FK → User | |
| `is_read` | Boolean | |
| `read_at` | DateTime | |

---

### V. Sub-Modul Pemusnahan Dokumen (WI-DCC-01)

#### 13. `DccDestructionLog` — Berita Acara Pemusnahan (FRM-DCC-14)

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | Integer, PK | |
| `destruction_number` | String, Unique | Auto-generated |
| `document_type` | Enum | `document_revision`, `quality_record` |
| `revision_id` | FK → DccDocumentRevision | Jika pemusnahan dokumen |
| `quality_record_id` | FK → DccQualityRecord | Jika pemusnahan rekaman |
| `destruction_date` | Date | |
| `document_form` | Enum | `physical`, `digital`, `both` |
| `method_physical` | Enum | `shredder`, `burn`, `null` |
| `method_digital` | Enum | `delete`, `archive`, `null` |
| `reason` | Enum | `expired_retention`, `obsolete`, `not_relevant` |
| `destroyed_by` | FK → User | DCC Staff |
| `witnessed_by` | FK → User | QA / Saksi |
| `verified_by` | FK → User | Persetujuan pihak terkait |
| `verified_at` | DateTime | |
| `notes` | Text | |

---

## 🔄 Alur Kerja (Workflows)

### A. Alur Pengendalian Dokumen (QP-DCC-01)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  1. Pembuat  │───→│  2. Review   │───→│  3. Approve  │───→│  4. DCC      │
│  (Originator)│    │  (Pengkaji)  │    │  (Pengesah)  │    │  Terima &    │
│              │    │              │    │              │    │  Update      │
│ Buat dokumen │    │ Tanda tangan │    │ Tanda tangan │    │ Daftar Induk │
│ + Nomor      │    │ digital      │    │ digital      │    │ (FRM-DCC-02) │
└──────────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                                   │
                    ┌──────────────┐    ┌──────────────┐          │
                    │  6. Penerima │←───│  5. DCC      │←─────────┘
                    │              │    │  Distribusi  │
                    │ TTD FRM-01   │    │ (FRM-DCC-04) │
                    │ Kembalikan   │    │ Stamp        │
                    │ revisi lama  │    │ CONTROLLED   │
                    └──────────────┘    └──────────────┘
```

**Khusus Revisi:**
```
Originator ajukan FRM-DCC-05 (Change Notice)
       ↓ Approved
Level I-III: Tambah catatan di Bab Riwayat, naikkan nomor revisi
Level IV: Wajib FRM-DCC-05
       ↓
DCC stamp "OBSOLETE" pada master lama
DCC stamp "TIDAK BERLAKU" pada salinan lama → Musnahkan
DCC terbitkan versi baru → Distribusi ulang
```

### B. Alur CAPA (QP-DCC-03 + WI-DCC-02)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 1. Inisiator│───→│ 2. DCC      │───→│ 3. Approval │───→│ 4. Dept/    │
│             │    │             │    │             │    │ Supplier    │
│ Ajukan      │    │ Beri nomor  │    │ CPAR: MR    │    │             │
│ CPAR/SCAR   │    │ registrasi  │    │ SCAR: QA Mgr│    │ Investigasi │
│             │    │ FRM-DCC-08  │    │             │    │ RCA 5-Why   │
│             │    │ /FRM-DCC-11 │    │             │    │ Tindakan    │
└─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘
                                                                │
                   ┌─────────────┐    ┌─────────────┐          │
                   │ 6. Close /  │←───│ 5. Verifi-  │←─────────┘
                   │ Follow-up   │    │ kasi        │
                   │             │    │             │
                   │ Efektif →   │    │ CPAR: Inisi-│
                   │  Close      │    │ ator + Mgmt │
                   │ Tidak →     │    │ SCAR: QA Mgr│
                   │  CAPA baru  │    │             │
                   └─────────────┘    └─────────────┘

Monthly: DCC generate FRM-DCC-09 (Laporan Bulanan Status CPAR)
```

### C. Alur Pemusnahan (WI-DCC-01)

```
Identifikasi (masa retensi habis / obsolete)
  ↓
Verifikasi & Persetujuan (FRM-DCC-14)
  ↓
Pisahkan fisik vs digital
  ↓
Fisik: Shredder / Bakar   |   Digital: Simpan log + hapus/arsip
  ↓
Isi Berita Acara (FRM-DCC-14)
  ↓
Simpan bukti oleh DCC
```

---

## 🛠️ Backend Roadmap (4 Tahap)

### TAHAP 1: Database & Model (Estimasi: 1-2 hari)
- [ ] Buat `/backend/models/dcc.py` — 13 tabel
- [ ] Register di `models/__init__.py`
- [ ] Jalankan migrasi database (Alembic)
- [ ] Seed data awal (department codes, document levels)

### TAHAP 2: API CAPA — Prioritas Tertinggi (Estimasi: 3-4 hari)
- [ ] `POST /api/dcc/capa` — Create CPAR/SCAR dengan auto-numbering
- [ ] `GET /api/dcc/capa` — List semua CAPA (filter by type/source/status/dept)
- [ ] `GET /api/dcc/capa/<id>` — Detail CAPA + investigation + verification
- [ ] `POST /api/dcc/capa/<id>/investigation` — Input RCA (5-Why / Fishbone) + Action Plan
- [ ] `POST /api/dcc/capa/<id>/verify` — Verifikasi efektivitas (close / follow-up)
- [ ] `POST /api/dcc/capa/<id>/cancel` — Pembatalan (perlu approval Inisiator + Management)
- [ ] `GET /api/dcc/capa/monthly-report` — Generate laporan bulanan (FRM-DCC-09)
- [ ] `GET /api/dcc/capa/dashboard` — Summary KPIs (open, closed, overdue, by source)

### TAHAP 3: API Komunikasi Internal (Estimasi: 1-2 hari)
- [ ] `POST /api/dcc/memos` — Buat memo + push notification
- [ ] `GET /api/dcc/memos` — List memo (filter by category/status)
- [ ] `GET /api/dcc/memos/<id>` — Detail memo + read receipts
- [ ] `POST /api/dcc/memos/<id>/acknowledge` — Tandai sudah dibaca
- [ ] `GET /api/dcc/memos/unread` — Memo yang belum dibaca user aktif

### TAHAP 4: API Pengendalian Dokumen — Paling Kompleks (Estimasi: 5-7 hari)
- [ ] `POST /api/dcc/documents` — Registrasi dokumen baru ke Daftar Induk
- [ ] `GET /api/dcc/documents` — Daftar Induk Dokumen (FRM-DCC-02) + filter
- [ ] `POST /api/dcc/documents/<id>/revisions` — Upload .docx master baru
- [ ] `POST /api/dcc/documents/<id>/revisions/<rev>/review` — Submit review (tanda tangan digital)
- [ ] `POST /api/dcc/documents/<id>/revisions/<rev>/approve` — Approve + auto-generate PDF
- [ ] `POST /api/dcc/documents/<id>/change-notice` — Ajukan FRM-DCC-05
- [ ] `POST /api/dcc/documents/<id>/distribute` — Distribusi + catat FRM-DCC-04
- [ ] `POST /api/dcc/distribution/<id>/acknowledge` — Penerima TTD digital (FRM-DCC-01)
- [ ] `POST /api/dcc/documents/<id>/review` — Kaji ulang (FRM-DCC-10)
- [ ] `POST /api/dcc/destruction` — Berita acara pemusnahan (FRM-DCC-14)
- [ ] PDF Generator: `.docx` → PDF + watermark "CONTROLLED COPY"
- [ ] Auto-stamp "OBSOLETE" pada revisi lama
- [ ] Cron job: Alert kaji ulang 3-4 bulan sebelum expiry

---

## 🖥️ Frontend Pages (React/TypeScript)

### Navigasi Sidebar DCC
```
📁 DCC
├── 📊 DCC Dashboard
├── 📋 Daftar Induk Dokumen (FRM-DCC-02)
│   ├── List + Filter (Level, Dept, Status)
│   ├── Detail Dokumen + Revisi History
│   ├── Upload/Download .docx
│   └── View PDF (Controlled Copy)
├── 🔄 Change Notice (FRM-DCC-05)
├── 📤 Distribusi (FRM-DCC-04)
│   └── Serah Terima (FRM-DCC-01)
├── 🔍 Kaji Ulang (FRM-DCC-10)
├── 📁 Rekaman Mutu (FRM-DCC-03)
├── ⚠️ CAPA
│   ├── List CPAR/SCAR (filter, search)
│   ├── Form Buat CPAR (FRM-DCC-08)
│   ├── Form Buat SCAR (FRM-DCC-11)
│   ├── Detail + Investigation (5-Why form)
│   ├── Verification & Close-out
│   └── Laporan Bulanan (FRM-DCC-09)
├── 📢 Komunikasi Internal
│   ├── List Memo (FRM-DCC-07)
│   ├── Buat Memo (Rich Text Editor)
│   └── Read Receipts
└── 🗑️ Pemusnahan (FRM-DCC-14)
```

---

## ⚡ Fitur Otomasi

| Fitur | Detail |
|-------|--------|
| **Auto-Numbering** | CPAR: `CP/BB/CC/DD-nnn`, SCAR: `SC/BB/CC/nnn`, reset per tahun |
| **PDF Generator** | `.docx` → PDF + watermark "CONTROLLED COPY" via `python-docx` + `weasyprint` |
| **Auto-Obsolete** | Stamp "OBSOLETE" otomatis pada master lama saat revisi baru di-approve |
| **Review Alert** | Cron job / scheduler: kirim notif 3-4 bulan sebelum masa berlaku habis |
| **SCAR Deadline** | Auto-alert jika SCAR belum dikembalikan supplier dalam 5 hari kerja |
| **Monthly Report** | Auto-generate FRM-DCC-09 setiap akhir bulan |
| **Audit Trail** | Semua aksi tercatat: siapa, kapan, apa yang berubah |
| **Notification** | Email + in-app notif untuk approval requests, distribution, CAPA assignment |

---

## 🔐 Role & Permission Matrix

| Role | Buat Dokumen | Review | Approve | Distribusi | CAPA Initiate | CAPA Verify | Memo | Destroy |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| DCC Staff | ✅ | - | - | ✅ | - | - | ✅ | ✅ |
| Dept Head / Supervisor | ✅ | ✅ | Level III | - | ✅ | - | - | - |
| Manager | ✅ | ✅ | Level II | - | ✅ | ✅ | ✅ | - |
| QA Manager | ✅ | ✅ | Level II+III | - | ✅ | ✅ (SCAR) | - | ✅ |
| General Manager | - | ✅ (QM) | Level I+II | - | - | - | ✅ | - |
| Management Rep | ✅ (QM) | - | - | - | - | ✅ (CPAR) | - | - |
| Direktur | - | - | Level I | - | - | - | - | - |

---

# 🔄 Flow Approval DCC — Office-Friendly Design

> **Prinsip Utama:** Editing di Office (MS Word), Approval & Tracking di ERP Web
> User DCC tidak perlu belajar editor baru — mereka tetap pakai Word.

---

## 🎯 Filosofi Desain

```
┌─────────────────────────────────────────────────────────┐
│                    USER EXPERIENCE                       │
│                                                         │
│   EDITING          →  Microsoft Word (familiar)         │
│   APPROVAL         →  ERP Web (1-click) + Email notif   │
│   VIEWING          →  PDF di browser (read-only)        │
│   TRACKING & AUDIT →  ERP otomatis (zero effort)        │
│                                                         │
│   User hanya perlu: Download → Edit → Upload → Done.    │
│   Sisanya ERP yang handle.                              │
└─────────────────────────────────────────────────────────┘
```

---

## 📄 FLOW A: Dokumen Level I-III (QM, QP, WI) — Office Integration

Ini dokumen yang **layout rumit, paragraf panjang, penomoran** — wajib pakai Word.

### Alur Lengkap (7 Langkah)

```
 ORIGINATOR              ERP SYSTEM               REVIEWER/APPROVER
 ──────────              ──────────               ─────────────────

 1. Buat/Edit di
    MS Word (lokal)
         │
         ▼
 2. Upload .docx ──────→ 3. ERP terima file
    ke ERP web              - Simpan master .docx
    (drag & drop)           - Buat revision entry
                            - Status: "Draft"
                            - Kirim notifikasi
                              ke Reviewer
                                    │
                                    ▼
                            4. REVIEWER dapat ──────→ 5. Reviewer punya
                               email/WA notif           3 opsi:
                               + link langsung
                                                        a) "Approve" ✅
                                                           (1-click di web
                                                            atau link email)

                                                        b) "Reject + Notes" ❌
                                                           (tulis catatan
                                                            kenapa ditolak)

                                                        c) "Download & Review"
                                                           (unduh .docx,
                                                            aktifkan Track
                                                            Changes, upload
                                                            kembali dgn markup)
                                    │
                            ◄───────┘
                            │
                     ┌──────┴──────┐
                     │ Semua TTD   │
                     │ lengkap?    │
                     └──────┬──────┘
                      Ya    │
                            ▼
                     6. ERP AUTO-PROCESS:
                        - Generate PDF dari .docx
                        - Tambah watermark "CONTROLLED COPY"
                        - Tambah header: No. Revisi,
                          Tgl Efektif, TTD digital
                        - Status: "Active"
                        - Stamp "OBSOLETE" pada
                          revisi sebelumnya
                        - Notif ke DCC untuk distribusi
                            │
                            ▼
                     7. DCC distribusi via ERP
                        - Pilih departemen penerima
                        - System kirim notif + link PDF
                        - Penerima klik "Terima" (FRM-DCC-01)
```

### Detail Tiap Langkah

#### Langkah 1-2: Originator (Pembuat)
```
Di PC lokal:
├── Buka MS Word
├── Edit dokumen dengan Track Changes ON
├── Save as .docx
└── Buka ERP → DCC → Upload Revisi Baru
    ├── Drag & drop file .docx
    ├── Isi form minimal:
    │   ├── Alasan perubahan (1-2 kalimat)
    │   ├── Tipe perubahan (Format / Konten)
    │   └── Departemen penerima distribusi
    └── Klik "Submit untuk Review"
```

#### Langkah 4-5: Reviewer & Approver
```
OPSI 1 — Quick Approve via Web (Paling Umum)
├── Terima email: "Dokumen QP-DCC-01 Rev02 menunggu review Anda"
├── Klik link → langsung ke halaman approval ERP
├── Lihat preview PDF di browser (read-only)
├── Klik "Approve" ✅ atau "Reject" ❌
└── Selesai. Total waktu: < 1 menit.

OPSI 2 — Quick Approve via Email Link (Tanpa buka ERP)
├── Terima email dengan 2 tombol:
│   ├── [✅ Approve] → link token unik → auto-approve
│   └── [❌ Reject]  → link → form alasan penolakan
└── Tidak perlu login ERP sama sekali.

OPSI 3 — Deep Review via Word (Jika perlu markup)
├── Klik "Download .docx" di ERP
├── Buka di MS Word, aktifkan Track Changes
├── Beri komentar/markup di Word
├── Upload kembali .docx yg sudah di-markup
├── Status berubah ke "Needs Revision"
└── Originator terima notif + file yg sudah di-markup
```

> [!TIP]
> **Untuk reviewer yang sibuk:** Opsi 2 (Email link) paling efisien. Mereka
> cuma perlu klik 1 tombol di email tanpa buka browser/login ERP.

---

## 📝 FLOW B: Dokumen Level IV & CAPA — Full Web Form

Ini dokumen yang **diisi harian** (formulir operasional) — lebih efisien digital.

### Dokumen yang Full Web Form

| Formulir | Alasan Full Digital |
|----------|-------------------|
| FRM-DCC-08 (CPAR) | Perlu tracking status, auto-numbering, dashboard |
| FRM-DCC-11 (SCAR) | Perlu auto-deadline 5 hari, notif supplier |
| FRM-DCC-07 (Memo) | Rich text, distribusi otomatis, read receipts |
| FRM-DCC-05 (Change Notice) | Workflow approval terintegrasi |
| FRM-DCC-14 (Berita Acara Pemusnahan) | Audit trail wajib |
| FRM-DCC-09 (Lap. Bulanan CPAR) | Auto-generate dari data |
| FRM-DCC-10 (Kaji Ulang) | Scheduler otomatis |

### Alur CAPA (Contoh)

```
 INISIATOR                ERP SYSTEM              QA/DEPT/SUPPLIER
 ─────────                ──────────              ────────────────

 1. Buka ERP
    → DCC → CAPA
    → "Buat CPAR Baru"
         │
         ▼
 2. Isi form web:          3. ERP auto:
    - Deskripsi masalah       - Generate nomor
    - Upload foto               CP/03/26/PM-001
    - Pilih sumber (AI/       - Assign ke dept
      AE/MR/PM/KP)           - Kirim notif email
    - Submit                    + WA ke PIC
                                    │
                                    ▼
                              4. PIC dept terima
                                 notif, buka ERP
                                    │
                                    ▼
                              5. Isi form web:
                                 - Root Cause (5-Why)
                                 - Temporary Action
                                 - Corrective Action
                                 - Preventive Action
                                 - Due Date
                                 - Submit
                                    │
                                    ▼
                              6. Inisiator + Mgmt
                                 terima notif untuk
                                 verifikasi efektivitas
                                    │
                                    ▼
                              7. Klik "Efektif" ✅
                                 atau "Tidak Efektif"
                                 → Buat CAPA baru
```

> [!IMPORTANT]
> **SCAR (FRM-DCC-11) untuk supplier** bisa tetap pakai Word template:
> 1. ERP generate SCAR sebagai .docx dari template
> 2. Kirim via email ke supplier
> 3. Supplier isi di Word, kirim balik email
> 4. DCC upload SCAR yang sudah diisi ke ERP
> 5. QA Manager verify di ERP
>
> Ini karena **supplier eksternal tidak punya akses ke ERP**.

---

## 🔐 Mekanisme Tanda Tangan Digital

### Bukan e-signature gambar — tapi Approval Record

```python
# Setiap approval tersimpan sebagai record:
{
    "approver": "Ahmad Sutrisno",
    "role": "QA Manager",
    "action": "approved",        # approved / rejected / reviewed
    "timestamp": "2026-03-12T10:30:00+07:00",
    "ip_address": "192.168.88.101",
    "method": "web_click",       # web_click / email_link / api
    "notes": "",                 # Catatan jika reject
    "document": "QP-DCC-01",
    "revision": 2
}
```

### Ditampilkan di PDF sebagai:

```
┌─────────────────────────────────────────────┐
│          LEMBAR PENGESAHAN DOKUMEN          │
│                                             │
│  Pembuat    : Fitri Handayani               │
│               12 Mar 2026, 08:15 WIB        │
│               [Approved via ERP]            │
│                                             │
│  Pengkaji   : Ahmad Sutrisno                │
│               12 Mar 2026, 10:30 WIB        │
│               [Approved via Email Link]     │
│                                             │
│  Pengesah   : Irawan Yusuf (GM)             │
│               12 Mar 2026, 14:22 WIB        │
│               [Approved via ERP]            │
│                                             │
│  Status     : ✅ DISAHKAN                   │
│  No. Revisi : 02                            │
│  Tgl Efektif: 15 Mar 2026                   │
└─────────────────────────────────────────────┘

         ╔══════════════════════╗
         ║   CONTROLLED COPY   ║
         ║      Copy No. 3     ║
         ╚══════════════════════╝
```

---

## 📧 Notifikasi Multi-Channel

### Kapan Notifikasi Dikirim

| Event | Email | WA (opsional) | In-App |
|-------|:-----:|:-----:|:------:|
| Dokumen baru perlu review | ✅ + Quick Approve link | ✅ | ✅ |
| Dokumen di-approve | ✅ | - | ✅ |
| Dokumen di-reject | ✅ + alasan | ✅ | ✅ |
| Distribusi dokumen baru | ✅ + link PDF | - | ✅ |
| CAPA di-assign ke dept | ✅ | ✅ | ✅ |
| CAPA mendekati deadline | ✅ | ✅ | ✅ |
| SCAR belum dikembalikan | ✅ ke supplier | - | ✅ |
| Kaji ulang mendekati | ✅ | - | ✅ |
| Memo baru dipublish | ✅ | - | ✅ |

### Contoh Email Approval

```
Subject: [DCC] Review Required — QP-PRD-03 Rev02 "Prosedur Produksi"

Yth. Pak Ahmad Sutrisno (QA Manager),

Dokumen berikut memerlukan review dan persetujuan Anda:

📄 Dokumen  : QP-PRD-03 — Prosedur Produksi
📝 Revisi   : Rev 02 (sebelumnya Rev 01)
👤 Pembuat  : Fitri Handayani (Dept. Produksi)
📋 Perubahan: Update alur kerja shift 3, penambahan checklist

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   [ ✅ APPROVE ]    [ ❌ REJECT ]    [ 📥 Download .docx ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Atau buka langsung di ERP:
https://erp.company.co.id/dcc/documents/QP-PRD-03/revisions/2

—
ERP System — Document Control Center
```

---

## 📊 Perbandingan Approach

### Editing Dokumen: Office vs Web Editor

| Aspek | MS Word (Dipilih ✅) | Web Editor (Tidak dipilih) |
|-------|-----|-----|
| Familiarity User | ⭐⭐⭐⭐⭐ Sudah terbiasa | ⭐⭐ Perlu training |
| Layout Kompleks | ⭐⭐⭐⭐⭐ Table, header, dll | ⭐⭐⭐ Terbatas |
| Track Changes | ⭐⭐⭐⭐⭐ Built-in | ⭐⭐ Perlu develop |
| Offline Editing | ✅ Bisa offline | ❌ Perlu internet |
| Version Control | ⚠️ Manual upload | ✅ Auto-save |
| Kolaborasi Real-time | ❌ | ✅ (Google Docs style) |
| **Keputusan** | **Pakai ini — sesuai habit user** | Tidak dipakai |

### Approval: Web Click vs Email Link vs Offline

| Aspek | Web Click | Email Link (Rekomendasi ✅) | Offline TTD |
|-------|-----------|------------|-------------|
| Kecepatan | Buka browser → login → approve | Klik link di email | Print → TTD → scan |
| Audit Trail | ✅ Lengkap | ✅ Lengkap (via token) | ⚠️ Manual |
| Keamanan | ✅ Session-based | ✅ Token + expiry | ❌ Bisa dipalsukan |
| Mobile-friendly | ⚠️ Perlu responsive | ✅ Langsung dari HP | ❌ |
| **Keputusan** | Opsi utama | **Shortcut untuk manager sibuk** | Tidak dipakai |

---

## 🏗️ Technical Implementation

### Backend: Email Approval Token

```python
# Generate unique approval token (1-time use, 7-day expiry)
# Route: GET /api/dcc/approve/<token>

import secrets, hashlib
from datetime import datetime, timedelta

def generate_approval_token(revision_id, approver_id, action):
    """Generate token untuk 1-click email approval"""
    raw = f"{revision_id}:{approver_id}:{action}:{secrets.token_hex(16)}"
    token = hashlib.sha256(raw.encode()).hexdigest()[:32]
    # Simpan di DB dengan expiry 7 hari
    ApprovalToken.create(
        token=token,
        revision_id=revision_id,
        approver_id=approver_id,
        action=action,  # 'approve' atau 'reject'
        expires_at=datetime.now() + timedelta(days=7),
        is_used=False
    )
    return token
```

### Backend: Auto PDF Generator

```python
# Saat semua approval lengkap, auto-generate PDF

from docx import Document
from weasyprint import HTML  # atau docx2pdf

def generate_controlled_pdf(revision):
    """Generate PDF + watermark dari .docx master"""

    # 1. Buka .docx master
    doc = Document(revision.docx_file_path)

    # 2. Update header/footer dengan metadata ERP
    for section in doc.sections:
        header = section.header
        # Insert: No. Dok, Revisi, Tgl Efektif
        # Insert: Tanda tangan approval (nama + tanggal)

    # 3. Save updated .docx
    doc.save(f"updated_{revision.id}.docx")

    # 4. Convert ke PDF
    pdf_path = convert_to_pdf(f"updated_{revision.id}.docx")

    # 5. Tambah watermark "CONTROLLED COPY"
    add_watermark(pdf_path, "CONTROLLED COPY")

    # 6. Update DB
    revision.pdf_file_path = pdf_path
    revision.status = 'active'

    # 7. Auto-obsolete revisi lama
    old_revisions = DccDocumentRevision.query.filter(
        DccDocumentRevision.document_id == revision.document_id,
        DccDocumentRevision.id != revision.id,
        DccDocumentRevision.status == 'active'
    ).all()
    for old in old_revisions:
        old.status = 'obsolete'
        old.obsoleted_at = datetime.now()

    db.session.commit()
```

---

# 📋 Strategi Penanganan Formulir DCC (FRM Documents)

> **Prinsip:** Semua FRM jadi digital di ERP. Word/Excel hanya untuk output cetak atau kirim ke pihak luar.
> Source of truth = **Database ERP**, bukan file Word/Excel.

---

## 🗂️ Klasifikasi 12 Formulir

| # | Formulir | Nama | Pendekatan | Alasan |
|---|----------|------|:----------:|--------|
| 1 | FRM-DCC-01 | Serah Terima Dokumen | 🌐 **Web** | Cukup klik "Terima" + timestamp |
| 2 | FRM-DCC-02 | Daftar Induk Dokumen | 🤖 **Auto** | Auto-generate dari tabel `DccDocument` |
| 3 | FRM-DCC-03 | Daftar Induk Rekaman Mutu | 🤖 **Auto** | Auto-generate dari tabel `DccQualityRecord` |
| 4 | FRM-DCC-04 | Daftar Distribusi Dokumen | 🤖 **Auto** | Auto-generate saat distribusi |
| 5 | FRM-DCC-05 | Document/Form Change Notice | 🌐 **Web** | Form pengajuan perubahan |
| 6 | FRM-DCC-07 | Memo Internal | 🌐 **Web** | Rich text editor |
| 7 | FRM-DCC-08 | CPAR | 🌐 **Web** | Form multi-section + workflow |
| 8 | FRM-DCC-09 | Laporan Bulanan Status CPAR | 🤖 **Auto** | Auto-generate monthly report |
| 9 | FRM-DCC-10 | Form Kaji Ulang Dokumen | 🌐 **Web** | Form review + scheduler |
| 10 | FRM-DCC-11 | SCAR | 🔀 **Hybrid** | Web form internal + export Word untuk supplier |
| 11 | FRM-DCC-14 | Berita Acara Pemusnahan | 🌐 **Web** | Form + checklist + saksi |
| 12 | FRM-MKT-13 | Customer Complaint Handling | 🌐 **Web** | Cross-module (Marketing → QA → DCC) |

**Legenda:**
- 🌐 **Web** = Diisi langsung di ERP via web form
- 🤖 **Auto** = Auto-generate dari data di database (user tidak isi manual)
- 🔀 **Hybrid** = Web form di ERP + export ke Word/PDF untuk pihak luar

> [!IMPORTANT]
> **Semua form** punya tombol **"Export PDF"** untuk cetak/arsip.
> PDF-nya mengikuti layout form asli supaya auditor familiar.

---

## 📄 Detail Per Formulir

### 1. FRM-DCC-01 — Serah Terima Dokumen
**Pendekatan:** 🌐 Web (1-click acknowledge)

```
SEKARANG (Manual):
├── DCC print form → penerima TTD → scan → arsip
└── Masalah: sering hilang, lupa TTD, susah cari riwayat

NANTI (Digital):
├── DCC klik "Distribusi" → pilih dept penerima
├── Penerima dapat notif → buka ERP → lihat dokumen
├── Klik "Saya terima dokumen ini" ✅
├── Otomatis tercatat: siapa, kapan, IP, browser
├── Jika ada revisi lama: checkbox "Revisi lama sudah dikembalikan"
└── Export PDF: layout mirip FRM-DCC-01 asli (untuk arsip/audit)
```

**Fields di Web Form:**
| Field | Sumber | Diisi oleh |
|-------|--------|------------|
| No. Dokumen | Auto (dari distribusi) | System |
| Judul Dokumen | Auto | System |
| No. Revisi | Auto | System |
| No. Copy | Auto (urutan) | System |
| Dept. Penerima | Auto | System |
| Nama Penerima | Auto (dari login) | System |
| Tanggal Terima | Auto (timestamp klik) | System |
| TTD Digital | Auto (approval record) | System |
| Revisi lama dikembalikan? | Manual | Penerima (checkbox) |

> **User effort: Klik 1 tombol.** Semua data lain auto-fill.

---

### 2. FRM-DCC-02 — Daftar Induk Dokumen
**Pendekatan:** 🤖 Auto-Generate

```
SEKARANG (Manual):
├── DCC update Excel setiap ada dokumen baru/revisi
└── Masalah: sering lupa update, data tidak sinkron

NANTI (Digital):
├── Otomatis ter-generate dari tabel DccDocument + DccDocumentRevision
├── Real-time, selalu up-to-date
├── Filter: by level, dept, status (active/obsolete)
├── Search: by nomor dokumen atau judul
└── Export PDF/Excel: sesuai format FRM-DCC-02 asli
```

**Kolom yang ditampilkan:**
| No | No. Dokumen | Judul | Level | Dept | Revisi | Tgl Efektif | Status | Masa Berlaku |
|----|-------------|-------|-------|------|--------|-------------|--------|-------------|
| 1 | QP-DCC-01 | Control of Document | II | DCC | 01 | 18/12/2025 | ✅ Active | 18/12/2030 |
| 2 | WI-DCC-01 | Pemusnahan Dokumen | III | DCC | 00 | 18/12/2025 | ✅ Active | 18/12/2030 |

> **User effort: Nol.** Halaman auto-refresh dari database.

---

### 3. FRM-DCC-03 — Daftar Induk Rekaman Mutu
**Pendekatan:** 🤖 Auto-Generate

Sama seperti FRM-DCC-02, tapi untuk rekaman mutu (quality records).

**Kolom:**
| No | No. Rekaman | Judul | Tipe | Dept | Holder | Lokasi Ordner | Masa Simpan | Status |
|----|-------------|-------|------|------|--------|---------------|-------------|--------|

---

### 4. FRM-DCC-04 — Daftar Distribusi Dokumen
**Pendekatan:** 🤖 Auto-Generate

```
NANTI (Digital):
├── Saat DCC distribusi dokumen, system otomatis catat:
│   ├── Dept mana saja yang menerima
│   ├── No. copy per dept
│   ├── Tipe (Controlled / Uncontrolled)
│   └── Status penerimaan (sudah/belum di-acknowledge)
└── Export PDF: format FRM-DCC-04
```

---

### 5. FRM-DCC-05 — Document/Form Change Notice (DCN)
**Pendekatan:** 🌐 Web Form

```
SEKARANG (Manual):
├── Isi form Word → print → TTD → serahkan ke DCC
└── Masalah: proses lama, sering pending di meja approver

NANTI (Digital):
├── Originator buka ERP → DCC → "Ajukan Perubahan Dokumen"
├── Isi form:
│   ├── Pilih dokumen yang akan diubah (dropdown)
│   ├── Uraian perubahan yang diinginkan
│   ├── Alasan perubahan
│   └── Lampiran (opsional)
├── Submit → notif ke approver
├── Approver: Approve / Reject (1-click)
├── Jika approved → DCC dapat notif untuk proses revisi
└── Status tracking: Pending → Approved → Implemented
```

**Web Form Fields:**
| Field | Tipe Input | Wajib? |
|-------|-----------|--------|
| Dokumen yang diubah | Dropdown (dari Daftar Induk) | ✅ |
| Level dokumen | Auto-fill dari pilihan | Auto |
| Revisi saat ini | Auto-fill | Auto |
| Tipe perubahan | Radio: Format / Konten / Keduanya | ✅ |
| Uraian perubahan | Textarea | ✅ |
| Alasan perubahan | Textarea | ✅ |
| Lampiran | File upload (multi) | Opsional |
| Diajukan oleh | Auto (dari login) | Auto |
| Tanggal pengajuan | Auto (timestamp) | Auto |

---

### 6. FRM-DCC-07 — Memo Internal
**Pendekatan:** 🌐 Web Form (Rich Text Editor)

```
NANTI (Digital):
├── Management buat memo via ERP → Rich Text Editor (bold, bullet, tabel)
├── Attach file jika perlu (PDF, gambar)
├── Pilih kategori: Kebijakan Mutu / Jadwal Produksi / Kebutuhan Bahan / dll
├── Pilih dept tujuan (multi-select)
├── Publish → notif ke semua penerima
├── Penerima buka → klik "Sudah Dibaca" ✅
├── Dashboard: siapa yang sudah/belum baca
└── Memo terkait audit → otomatis flag "Audit Related" (disimpan Management)
```

---

### 7. FRM-DCC-08 — CPAR (Corrective/Preventive Action Request)
**Pendekatan:** 🌐 Web Form (Multi-Step)

Ini form paling kompleks. Dibagi jadi **4 section** yang diisi oleh **orang berbeda**:

```
┌─────────────────────────────────────────────────────────────┐
│ SECTION A — Permintaan (diisi Inisiator)                     │
│ ├── No. CPAR: [Auto: CP/03/26/PM-001]                      │
│ ├── Tanggal: [Auto]                                         │
│ ├── Sumber: [Dropdown: AI/AE/MR/PM/KP]                     │
│ ├── Deskripsi ketidaksesuaian: [Textarea]                   │
│ ├── Produk terdampak: [Input]                               │
│ ├── Bukti foto/video: [File upload]                         │
│ └── Dept bertanggung jawab: [Dropdown]                      │
│                                                             │
│ → Submit → Notif ke MR untuk Approve                        │
├─────────────────────────────────────────────────────────────┤
│ SECTION B — Investigasi (diisi Dept yang bertanggung jawab) │
│ ├── Root Cause Analysis:                                    │
│ │   ├── Metode: [Radio: 5-Why / Fishbone]                   │
│ │   ├── Why 1: [Input] → Why 2: [Input] → ... → Why 5      │
│ │   └── Akar masalah: [Textarea]                            │
│ ├── Tindakan Korektif: [Textarea]                           │
│ ├── Tindakan Pencegahan: [Textarea]                         │
│ ├── PIC: [Dropdown user]                                    │
│ ├── Target selesai: [Date picker]                           │
│ └── Investigator: [Auto dari login]                         │
│                                                             │
│ → Submit → Notif ke Inisiator + Management                  │
├─────────────────────────────────────────────────────────────┤
│ SECTION C — Verifikasi (diisi Inisiator + Management)       │
│ ├── Apakah tindakan efektif?: [Radio: Ya/Tidak]             │
│ ├── Catatan verifikasi: [Textarea]                          │
│ └── Jika tidak efektif: → Buat CAPA lanjutan                │
│                                                             │
│ → Close CPAR                                                │
├─────────────────────────────────────────────────────────────┤
│ FOOTER                                                      │
│ ├── Status: [Auto: Open → Investigation → Action → Closed]  │
│ ├── Timeline: [Visual timeline semua aksi]                  │
│ └── Export PDF: [Tombol] → format FRM-DCC-08                │
└─────────────────────────────────────────────────────────────┘
```

---

### 8. FRM-DCC-09 — Laporan Bulanan Status CPAR
**Pendekatan:** 🤖 Auto-Generate

```
NANTI (Digital):
├── Setiap akhir bulan, system auto-generate:
│   ├── Total CPAR bulan ini (open, closed, overdue)
│   ├── Breakdown per sumber (AI/AE/MR/PM/KP)
│   ├── Breakdown per dept
│   ├── Aging analysis (berapa lama rata-rata close)
│   ├── Trend chart (bulan ke bulan)
│   └── List CPAR yang masih open + overdue (highlight merah)
├── DCC tinggal review → klik "Publish Report"
└── Export PDF: format FRM-DCC-09
```

> **User effort: Review + 1 klik.** Data semua dari database.

---

### 9. FRM-DCC-10 — Form Kaji Ulang Dokumen
**Pendekatan:** 🌐 Web Form + Auto-Scheduler

```
NANTI (Digital):
├── System auto-detect: dokumen mana yang 3-4 bulan lagi expired
├── Kirim notif ke Dept Head + DCC: "Dokumen X perlu dikaji ulang"
├── Reviewer buka ERP → isi form:
│   ├── Dokumen: [Auto-fill]
│   ├── Hasil kaji ulang: [Radio: Masih Relevan / Perlu Revisi / Obsolete]
│   ├── Catatan: [Textarea]
│   └── Reviewer: [Auto dari login]
├── Jika "Perlu Revisi" → otomatis buat Change Notice (FRM-DCC-05)
├── Jika "Obsolete" → trigger proses obsolete + pemusnahan
└── Next review date: auto-set
```

---

### 10. FRM-DCC-11 — SCAR (Supplier Corrective Action Request)
**Pendekatan:** 🔀 Hybrid

```
KENAPA HYBRID?
├── Supplier TIDAK punya akses ke ERP kita
├── Mereka terbiasa terima Word/PDF via email
└── Tapi kita tetap perlu tracking internal di ERP

ALUR:
1. QA isi SCAR via web form di ERP (section A: deskripsi masalah)
2. System auto-generate file Word (.docx) dari template
   ├── Header sudah terisi: No. SCAR, tanggal, produk, deskripsi masalah
   └── Section investigasi KOSONG (untuk supplier isi)
3. DCC kirim Word via email ke supplier
4. Supplier isi di Word → kirim balik via email (max 5 hari kerja)
5. DCC upload Word yang sudah diisi ke ERP
6. System parse isian supplier (atau DCC input manual ke web form)
7. QA Manager verify → Close/Follow-up di ERP

DEADLINE TRACKING:
├── System hitung 5 hari kerja dari tanggal kirim
├── Hari ke-3: reminder email ke supplier
├── Hari ke-5: alert ke QA Manager "SCAR overdue"
└── Dashboard: list SCAR yang belum dikembalikan
```

---

### 11. FRM-DCC-14 — Berita Acara Pemusnahan Dokumen
**Pendekatan:** 🌐 Web Form

```
NANTI (Digital):
├── DCC pilih dokumen yang akan dimusnahkan (dari list obsolete/expired)
├── Isi form:
│   ├── Dokumen: [Multi-select dari list]
│   ├── Jenis: [Checkbox: Fisik / Digital]
│   ├── Metode fisik: [Dropdown: Shredder / Bakar]
│   ├── Metode digital: [Dropdown: Hapus / Arsip]
│   ├── Dilakukan oleh: [Auto dari login = DCC]
│   └── Saksi: [Dropdown user QA]
├── Submit → Saksi dapat notif → Klik "Saya menyaksikan" ✅
├── Setelah saksi confirm → status dokumen berubah ke "Destroyed"
└── Export PDF: Berita Acara Pemusnahan (untuk arsip)
```

---

### 12. FRM-MKT-13 — Customer Complaint Handling Form (CCHF)
**Pendekatan:** 🌐 Web Form (Cross-Module)

```
NANTI (Digital):
├── Marketing isi CCHF di modul Marketing ERP:
│   ├── Customer: [Dropdown]
│   ├── Produk: [Dropdown]
│   ├── Deskripsi complaint: [Textarea]
│   ├── Bukti: [File upload]
│   └── Submit
├── Otomatis ter-link ke modul DCC:
│   ├── Auto-create CPAR dengan sumber "KP" (Keluhan Pelanggan)
│   └── Nomor: CP/BB/CC/KP-nnn
├── Dept yang bertanggung jawab dapat notif
└── Alur selanjutnya sama seperti CPAR (investigasi → verifikasi → close)
```

---

## 📊 Ringkasan: Effort User vs Sekarang

| Formulir | Sekarang (Manual) | Nanti (Digital) | Effort Reduction |
|----------|-------------------|-----------------|:---:|
| FRM-DCC-01 | Print → TTD → scan → arsip | 1 klik "Terima" | **95%** ⬇️ |
| FRM-DCC-02 | Update Excel manual | Auto dari DB | **100%** ⬇️ |
| FRM-DCC-03 | Update Excel manual | Auto dari DB | **100%** ⬇️ |
| FRM-DCC-04 | Catat manual di Excel | Auto saat distribusi | **100%** ⬇️ |
| FRM-DCC-05 | Print → TTD → serahkan | Web form + 1-click approve | **80%** ⬇️ |
| FRM-DCC-07 | Ketik di Word → print → copy | Rich text + auto-distribute | **70%** ⬇️ |
| FRM-DCC-08 | Word → print → TTD → scan | Multi-step web form | **75%** ⬇️ |
| FRM-DCC-09 | Compile manual tiap bulan | Auto-generate report | **95%** ⬇️ |
| FRM-DCC-10 | Ingat sendiri kapan review | Auto-scheduler + notif | **90%** ⬇️ |
| FRM-DCC-11 | Word → email → tunggu → input | Hybrid: web + auto Word | **60%** ⬇️ |
| FRM-DCC-14 | Isi form → TTD → arsip | Web form + saksi digital | **85%** ⬇️ |
| FRM-MKT-13 | Isi di Marketing → copy ke DCC | Auto-link cross module | **90%** ⬇️ |

---

## 🖨️ Export PDF — Semua Form Bisa Dicetak

Setiap form punya tombol **"Export PDF"** yang generate PDF sesuai layout form asli.

```
Kenapa penting?
├── Auditor ISO terbiasa dengan format form fisik
├── Beberapa dept mungkin masih butuh printout
├── Arsip backup fisik (jika kebijakan perusahaan mengharuskan)
└── Bukti pemusnahan (FRM-DCC-14) mungkin perlu hardcopy

Implementasi:
├── Template HTML per form (mirip layout Word asli)
├── Data di-inject dari database
├── Convert ke PDF via WeasyPrint
├── Watermark: "GENERATED FROM ERP - [timestamp]"
└── QR Code: link verifikasi keaslian
```

---

# 🔒 PDF Protection & Internal Digital Signature — DCC Module

---

## 1. PDF Encrypted & Locked (Tidak Bisa Diedit Siapapun)

### 3 Layer Proteksi

```
┌───────────────────────────────────────────────────────────────┐
│                    PDF YANG SUDAH DISAHKAN                     │
│                                                               │
│   LAYER 1 — Permission Lock                                  │
│   ├── ❌ Editing       → disabled                             │
│   ├── ❌ Copy text     → disabled                             │
│   ├── ❌ Print         → opsional (bisa enable untuk print)   │
│   ├── ❌ Form filling  → disabled                             │
│   ├── ❌ Annotation    → disabled                             │
│   └── ✅ Viewing only  → satu-satunya yang bisa               │
│                                                               │
│   LAYER 2 — Owner Password                                   │
│   ├── Password digenerate & disimpan di DB (encrypted)        │
│   ├── Hanya system yang tahu password owner                   │
│   ├── User tidak bisa unlock meskipun punya file PDF-nya      │
│   └── Bahkan pembuat dokumen TIDAK bisa edit                  │
│                                                               │
│   LAYER 3 — Hash Integrity (Tamper Detection)                 │
│   ├── SHA-256 hash dari isi PDF disimpan di database          │
│   ├── Setiap kali file dibuka via ERP, hash diverifikasi      │
│   ├── Jika hash tidak cocok → ALERT "Dokumen telah diubah!"  │
│   └── Menjamin keaslian bahkan jika file di-copy ke luar     │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Implementasi Python

```python
import pikepdf
import hashlib
import secrets
from datetime import datetime

def lock_pdf(input_path: str, output_path: str, revision_id: int):
    """
    Lock PDF: read-only, no edit, no copy, no annotation.
    Bahkan pembuat dokumen tidak bisa edit.
    """

    # Generate owner password unik per dokumen (user tidak pernah tahu)
    owner_password = secrets.token_hex(32)

    # Buka PDF
    pdf = pikepdf.open(input_path)

    # Set permissions: HANYA boleh view
    permissions = pikepdf.Permissions(
        extract=False,        # ❌ Tidak bisa copy text
        modify_annotation=False,  # ❌ Tidak bisa annotate
        modify_form=False,    # ❌ Tidak bisa isi form
        modify_other=False,   # ❌ Tidak bisa edit apapun
        modify_assembly=False,  # ❌ Tidak bisa insert/delete page
        print_lowres=True,    # ✅ Boleh print (opsional, bisa False)
        print_highres=True,   # ✅ Boleh print (opsional, bisa False)
        accessibility=True,   # ✅ Screen reader (aksesibilitas)
    )

    # Save dengan encryption
    pdf.save(
        output_path,
        encryption=pikepdf.Encryption(
            owner=owner_password,   # Hanya system yang tahu
            user="",                # User password kosong = bisa buka tanpa password
            R=6,                    # AES-256 encryption (paling kuat)
            allow=permissions
        )
    )
    pdf.close()

    # Hitung SHA-256 hash untuk tamper detection
    with open(output_path, 'rb') as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()

    # Simpan ke database
    revision = DccDocumentRevision.query.get(revision_id)
    revision.pdf_file_path = output_path
    revision.pdf_owner_password = encrypt_string(owner_password)  # Encrypted di DB
    revision.pdf_hash = file_hash
    revision.pdf_locked_at = datetime.now()
    db.session.commit()

    return file_hash


def verify_pdf_integrity(revision_id: int) -> bool:
    """Cek apakah PDF masih asli / belum diubah"""
    revision = DccDocumentRevision.query.get(revision_id)

    with open(revision.pdf_file_path, 'rb') as f:
        current_hash = hashlib.sha256(f.read()).hexdigest()

    if current_hash != revision.pdf_hash:
        # ALERT! File sudah diubah / corrupt
        log_security_event(
            event="PDF_TAMPER_DETECTED",
            document=revision.document.document_number,
            revision=revision.revision_number,
            expected_hash=revision.pdf_hash,
            actual_hash=current_hash
        )
        return False

    return True  # ✅ File asli, tidak diubah
```

### Apa yang Terjadi di Sisi User

```
Sebelum disahkan:
├── .docx tersedia untuk download & edit ✅
├── PDF belum ada
└── Status: Draft / Reviewing

Setelah SEMUA approval lengkap:
├── .docx master DIKUNCI (tidak bisa download lagi oleh siapapun)
├── PDF generated + encrypted + locked
├── PDF bisa di-VIEW di browser (read-only)
├── PDF bisa di-PRINT (opsional, bisa dimatikan)
├── PDF TIDAK BISA diedit di Adobe, Foxit, atau tool apapun
├── Bahkan PEMBUAT dokumen tidak bisa edit
└── Satu-satunya cara mengubah: BUAT REVISI BARU

Jika seseorang mencoba edit:
├── Buka di Adobe Acrobat → "This document has restrictions"
├── Buka di online editor → "Password protected"
├── Copy-paste text → Disabled
└── API Hash Check → Jika file dimodifikasi diluar → TERDETEKSI
```

---

## 2. Tanda Tangan Digital — Auto-Generate (Internal)

### Tidak Perlu TTE Kominfo!

| Aspek | TTE Kominfo (BSrE) | Internal Signature (Yang Kita Pakai ✅) |
|-------|--------------------|-----------------------------------------|
| **Regulasi** | Terdaftar di Kominfo/BSSN | Tidak perlu registrasi |
| **Kegunaan** | Dokumen keluar ke pihak luar | Dokumen internal perusahaan |
| **Biaya** | Berbayar per sertifikat | Gratis (built-in ERP) |
| **Infrastruktur** | Perlu CA (Certificate Authority) | Cukup database ERP |
| **Legal** | Kekuatan hukum penuh (UU ITE) | Berlaku internal per kebijakan perusahaan |
| **Kompleksitas** | Tinggi (PKI, X.509, dll) | Rendah (nama + timestamp + hash) |

> [!NOTE]
> Karena ini **dokumen internal ISO 9001:2015**, yang diperlukan adalah
> **bukti bahwa orang yang berwenang telah menyetujui** — bukan sertifikat
> digital resmi negara. Approval record di database ERP sudah cukup sebagai
> bukti audit ISO.

### Apa yang Di-Generate Otomatis

```
Saat user klik "Approve" di ERP:
│
├── 1. APPROVAL RECORD disimpan di DB
│   {
│     "approver_id": 42,
│     "approver_name": "Ahmad Sutrisno",
│     "role": "QA Manager",
│     "action": "approved",
│     "timestamp": "2026-03-12T10:30:00+07:00",
│     "ip_address": "192.168.88.101",
│     "method": "web_click",   // atau "email_link"
│     "user_agent": "Chrome/120.0",
│     "session_id": "abc123..."
│   }
│
├── 2. SIGNATURE IMAGE di-generate otomatis
│   ┌─────────────────────────────┐
│   │ ✓ Disetujui secara digital  │
│   │                             │
│   │   Ahmad Sutrisno            │
│   │   QA Manager                │
│   │   12 Mar 2026, 10:30 WIB   │
│   │                             │
│   │   ID: APR-2026-0342         │
│   │   [QR Code Verifikasi]      │
│   └─────────────────────────────┘
│
└── 3. Di-embed ke PDF sebelum di-lock
```

### Implementasi: Auto-Generate Signature

```python
from PIL import Image, ImageDraw, ImageFont
import qrcode
from io import BytesIO

def generate_signature_block(approval_record: dict) -> Image:
    """
    Generate gambar tanda tangan digital dari data approval.
    Bukan TTD tangan — tapi blok approval resmi.
    """

    # Ukuran blok signature
    width, height = 400, 180
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)

    # Font
    font_bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    font_normal = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
    font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9)

    # Border
    draw.rectangle([0, 0, width-1, height-1], outline='#1a365d', width=2)

    # Header
    draw.rectangle([0, 0, width-1, 28], fill='#1a365d')
    draw.text((10, 5), "✓ DISETUJUI SECARA DIGITAL", fill='white', font=font_bold)

    # Nama & Role
    y = 38
    draw.text((15, y), approval_record['approver_name'], fill='#1a365d', font=font_bold)
    y += 20
    draw.text((15, y), approval_record['role'], fill='#4a5568', font=font_normal)
    y += 18
    draw.text((15, y), approval_record['timestamp_formatted'], fill='#4a5568', font=font_normal)
    y += 22

    # Approval ID
    draw.text((15, y), f"Approval ID: {approval_record['approval_id']}", fill='#718096', font=font_small)
    y += 14
    draw.text((15, y), f"Metode: {approval_record['method']}", fill='#718096', font=font_small)

    # QR Code (link ke halaman verifikasi ERP)
    verify_url = f"https://erp.company.co.id/verify/{approval_record['approval_id']}"
    qr = qrcode.make(verify_url, box_size=3, border=1)
    qr = qr.resize((80, 80))
    img.paste(qr, (width - 95, 40))

    return img
```

### QR Code Verifikasi

Setiap signature punya QR code yang jika di-scan mengarah ke:

```
https://erp.company.co.id/verify/APR-2026-0342
```

Halaman verifikasi menampilkan (tanpa perlu login):

```
┌─────────────────────────────────────────┐
│       ✅ DOKUMEN TERVERIFIKASI          │
│                                         │
│  Dokumen : QP-PRD-03 Rev02              │
│  Judul   : Prosedur Produksi            │
│  Status  : ACTIVE (Berlaku)             │
│                                         │
│  Approval Chain:                        │
│  1. Fitri Handayani — 12 Mar 2026 08:15 │
│  2. Ahmad Sutrisno  — 12 Mar 2026 10:30 │
│  3. Irawan Yusuf    — 12 Mar 2026 14:22 │
│                                         │
│  Hash: 7f3a...b2c1 ✅ Match             │
│                                         │
│  Dokumen ini SAH dan tidak diubah       │
│  sejak disahkan.                        │
└─────────────────────────────────────────┘
```

> [!TIP]
> QR Code ini berguna saat **audit ISO** — auditor bisa scan QR di
> printout dokumen untuk langsung verifikasi keaslian di sistem.

---

## 3. Full Pipeline: Dari Approve Sampai PDF Locked

```
┌────────────────────────────────────────────────────────────────┐
│                    FULL PIPELINE                                │
│                                                                │
│  1. Semua approver klik "Approve"                              │
│     ↓                                                          │
│  2. System check: semua TTD lengkap?                           │
│     ↓ Ya                                                       │
│  3. Generate signature blocks (gambar) per approver            │
│     ↓                                                          │
│  4. Buka .docx master                                          │
│     ↓                                                          │
│  5. Inject ke .docx:                                           │
│     ├── Update header: No. Revisi, Tgl Efektif                 │
│     ├── Update footer: No. Dok, Halaman                        │
│     └── Embed signature blocks di halaman pengesahan           │
│     ↓                                                          │
│  6. Convert .docx → PDF                                        │
│     ↓                                                          │
│  7. Tambah watermark "CONTROLLED COPY" (diagonal, transparan)  │
│     ↓                                                          │
│  8. Tambah QR code verifikasi di setiap halaman (pojok)        │
│     ↓                                                          │
│  9. LOCK PDF:                                                  │
│     ├── Set owner password (random, simpan encrypted di DB)    │
│     ├── Disable editing, copying, annotation                   │
│     ├── AES-256 encryption                                     │
│     └── Hitung SHA-256 hash → simpan di DB                     │
│     ↓                                                          │
│  10. Update status:                                            │
│      ├── Revisi baru → "Active"                                │
│      ├── Revisi lama → "Obsolete" + stamp                      │
│      └── .docx master → locked (tidak bisa download)           │
│     ↓                                                          │
│  11. Notif ke DCC: "Dokumen siap distribusi"                   │
│     ↓                                                          │
│  12. DCC distribusi → penerima view PDF di browser (read-only) │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Kolom Database Tambahan untuk Security

```python
# Tambahan di DccDocumentRevision model:

class DccDocumentRevision(db.Model):
    # ... kolom existing ...

    # PDF Security
    pdf_owner_password_encrypted = db.Column(db.String(256))  # AES encrypted
    pdf_hash_sha256 = db.Column(db.String(64))          # Tamper detection
    pdf_locked_at = db.Column(db.DateTime)               # Kapan di-lock
    docx_locked = db.Column(db.Boolean, default=False)   # Master .docx dikunci?

    # Approval Records (JSON array)
    approval_chain = db.Column(db.JSON)  # [{approver, role, timestamp, method, ip, approval_id}]

    # Verification
    verification_url = db.Column(db.String(256))  # Public URL untuk QR scan
    verification_token = db.Column(db.String(64)) # Token unik per dokumen
```

---

## 5. Dependencies Python

```
# Tambah di requirements.txt:
pikepdf>=8.0          # PDF encryption & permissions
python-docx>=0.8      # Read/write .docx
reportlab>=4.0         # PDF generation (alternatif)
Pillow>=10.0           # Image generation (signature blocks)
qrcode>=7.4            # QR code generator
weasyprint>=60.0       # HTML → PDF (alternatif docx2pdf)
cryptography>=41.0     # Encrypt owner password di DB
```
