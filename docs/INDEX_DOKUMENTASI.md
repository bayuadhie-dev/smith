# INDEX DOKUMENTASI SISTEM ERP

## 📚 Panduan Navigasi Dokumentasi

Sistem ERP ini memiliki dokumentasi lengkap yang terorganisir dalam beberapa file. Gunakan index ini sebagai panduan untuk menemukan informasi yang Anda butuhkan.

---

## 🗂️ Struktur Dokumentasi

### 1. **DOKUMENTASI_KODE_LENGKAP.md** 
📄 *Dokumen Utama - Overview Sistem*

**Isi**:
- Arsitektur sistem secara keseluruhan
- Tech stack (Backend & Frontend)
- Core files (app.py, config.py, extensions.py)
- Ringkasan models, routes, dan komponen
- Workflow & integrasi antar modul
- Security & authentication
- Deployment guide
- Glossary & terminologi

**Kapan Digunakan**: 
- Memahami gambaran besar sistem
- Onboarding developer baru
- Referensi cepat untuk struktur project

---

### 2. **BACKEND_MODELS.md**
🗃️ *Database Schema & Models*

**Isi**:
- Semua SQLAlchemy models (50+ models)
- Struktur tabel database
- Relationships antar model
- Properties & methods penting
- Cascade delete rules
- Database indexes

**Modul yang Didokumentasikan**:
- User & Authentication
- Product & Material
- Production (Machine, BOM, WorkOrder, ShiftProduction)
- Warehouse & Inventory
- Sales & Purchasing
- Finance
- HR
- Quality
- Maintenance
- Analytics & OEE

**Kapan Digunakan**:
- Membuat query database
- Memahami struktur data
- Membuat/modifikasi model baru
- Troubleshooting data issues

---

### 3. **BACKEND_ROUTES.md**
🌐 *API Endpoints Documentation*

**Isi**:
- Semua API endpoints (100+ endpoints)
- HTTP methods (GET, POST, PUT, DELETE)
- Request/response format
- Query parameters
- Authentication requirements
- Permission checks

**Modul API yang Didokumentasikan**:
- Authentication (`/api/auth`)
- Products (`/api/products`)
- Production (`/api/production`)
- Warehouse (`/api/warehouse`)
- Sales (`/api/sales`)
- Purchasing (`/api/purchasing`)
- Finance (`/api/finance`)
- HR (`/api/hr`)
- Quality (`/api/quality`)
- Maintenance (`/api/maintenance`)
- Reports (`/api/reports`)
- WebSocket events (Socket.IO)

**Kapan Digunakan**:
- Integrasi dengan API
- Membuat frontend requests
- Testing API dengan Postman
- Debugging API calls

---

### 4. **FRONTEND_STRUKTUR.md**
⚛️ *Frontend Architecture & Components*

**Isi**:
- Arsitektur React application
- Struktur folder & files
- Routing dengan React Router
- State management (Redux Toolkit)
- API integration (Axios)
- Komponen utama (Layout, DataTable, Forms)
- Pages per module
- Custom hooks
- Utility functions
- Context providers (Theme, Language, Permission)

**Kapan Digunakan**:
- Membuat komponen baru
- Memahami flow data frontend
- Integrasi dengan backend API
- Styling & theming
- Internationalization (i18n)

---

### 5. **UTILS_DAN_SERVICES.md**
🔧 *Utility Functions & Services*

**Isi**:

**Backend Utils**:
- `helpers.py` - General helpers (generate_code, format_date)
- `calculations.py` - Business calculations (OEE, efficiency)
- `product_calculations.py` - Product & material calculations
- `business_rules.py` - Business rule validations
- `costing_helper.py` - Cost calculations & allocation
- `document_generator.py` - PDF generation
- `email_service.py` - Email sending
- `shipping_integration.py` - Shipping integration
- `fifo_helper.py` - FIFO inventory costing
- `logger.py` - Logging setup

**Frontend Utils**:
- `apiConfig.ts` - API endpoints configuration
- `formatters.ts` - Date, number, currency formatters
- `validators.ts` - Form validation helpers
- `exportUtils.ts` - Excel & PDF export
- `errorLogger.ts` - Error logging
- `currencyUtils.ts` - Currency conversion

**Kapan Digunakan**:
- Reusing common functions
- Understanding business logic calculations
- Implementing similar features
- Debugging calculation errors

---

## 🎯 Quick Reference

### Saya Ingin...

#### **Memahami struktur database**
👉 Baca: `BACKEND_MODELS.md`
- Lihat section model yang relevan (Production, Warehouse, dll)
- Check relationships diagram

#### **Membuat API call dari frontend**
👉 Baca: `BACKEND_ROUTES.md`
- Cari endpoint yang diperlukan
- Lihat request/response format
- Copy example code

#### **Membuat komponen React baru**
👉 Baca: `FRONTEND_STRUKTUR.md`
- Lihat struktur folder components
- Check reusable components (Common, ui)
- Follow component pattern yang ada

#### **Calculate OEE atau efficiency**
👉 Baca: `UTILS_DAN_SERVICES.md`
- Section: Backend Utils → `calculations.py`
- Function: `calculate_oee()`, `calculate_efficiency()`

#### **Generate PDF documents**
👉 Baca: `UTILS_DAN_SERVICES.md`
- Section: Backend Utils → `document_generator.py`
- Functions: `generate_work_order_pdf()`, `generate_bom_pdf()`

#### **Setup authentication & permissions**
👉 Baca: `DOKUMENTASI_KODE_LENGKAP.md`
- Section: Security & Authentication
- Also: `BACKEND_MODELS.md` → User & Authentication

#### **Understand production workflow**
👉 Baca: `DOKUMENTASI_KODE_LENGKAP.md`
- Section: Integrasi & Workflow → Production Workflow

#### **Deploy aplikasi**
👉 Baca: `DOKUMENTASI_KODE_LENGKAP.md`
- Section: Deployment

---

## 📖 Dokumentasi Tambahan

### Dokumentasi Lain yang Tersedia:

1. **DATABASE_SCHEMA.md** - ERD & database design
2. **TECHNICAL_GUIDE.md** - Technical implementation details
3. **PANDUAN_PENGGUNA.md** - User manual (Bahasa Indonesia)
4. **DOKUMENTASI_ERP_LENGKAP.md** - Complete ERP documentation
5. **CHANGELOG.md** - Version history & updates
6. **CONTRIBUTING.md** - Contribution guidelines

---

## 🔍 How to Search

### Mencari Informasi Spesifik:

1. **Cari by Modul**:
   - Production → `BACKEND_MODELS.md` (Models), `BACKEND_ROUTES.md` (API), `FRONTEND_STRUKTUR.md` (Pages)
   - Warehouse → Same pattern
   - dll

2. **Cari by Feature**:
   - OEE Calculation → `UTILS_DAN_SERVICES.md` → `calculations.py`
   - Work Order Management → `BACKEND_MODELS.md` → WorkOrder model + `BACKEND_ROUTES.md` → `/api/production/work-orders`
   - User Authentication → `DOKUMENTASI_KODE_LENGKAP.md` → Security section

3. **Cari by Tech**:
   - Database → `BACKEND_MODELS.md`
   - API → `BACKEND_ROUTES.md`
   - React Components → `FRONTEND_STRUKTUR.md`
   - Utilities → `UTILS_DAN_SERVICES.md`

---

## 📝 Format Dokumentasi

### Konvensi yang Digunakan:

**Code Blocks**:
```python
# Python code
def example_function():
    pass
```

```typescript
// TypeScript code
const exampleFunction = () => {}
```

**Tables**:
| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |

**Links**:
- Internal: `[Text](./FILE.md#section)`
- External: `[Text](https://url.com)`

**Emphasis**:
- **Bold** untuk emphasis
- *Italic* untuk terms
- `code` untuk inline code/commands

---

## 🚀 Getting Started

### Untuk Developer Baru:

1. **Mulai dengan Overview**:
   ```
   Baca: DOKUMENTASI_KODE_LENGKAP.md
   ```

2. **Pahami Database**:
   ```
   Baca: BACKEND_MODELS.md
   Focus: Models yang relevan dengan tugas
   ```

3. **Explore API**:
   ```
   Baca: BACKEND_ROUTES.md
   Try: Test endpoints dengan Postman
   ```

4. **Lihat Frontend**:
   ```
   Baca: FRONTEND_STRUKTUR.md
   Explore: Komponen & pages yang ada
   ```

5. **Study Utils**:
   ```
   Baca: UTILS_DAN_SERVICES.md
   Understand: Business logic & calculations
   ```

---

## 🔄 Update History

| Date | File | Changes |
|------|------|---------|
| 2026-06-17 | All | Initial complete documentation |

---

## 📞 Support

Jika ada pertanyaan atau membutuhkan klarifikasi:
- Check dokumentasi terlebih dahulu
- Search by keyword
- Tanyakan ke team lead

---

## 🎓 Best Practices

### Menggunakan Dokumentasi:

1. ✅ **DO**: Baca dokumentasi sebelum coding
2. ✅ **DO**: Update dokumentasi saat membuat perubahan
3. ✅ **DO**: Follow patterns yang sudah ada
4. ✅ **DO**: Reference dokumentasi di code comments
5. ❌ **DON'T**: Copy-paste tanpa memahami
6. ❌ **DON'T**: Skip dokumentasi untuk "save time"

---

**Happy Coding! 🚀**

