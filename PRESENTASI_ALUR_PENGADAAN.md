# 📋 Presentasi: Alur Pengadaan Barang (End-to-End)
#
---

## 🗺️ Gambaran Besar Alur

```
[1] PERMINTAAN   →  [2] PENAWARAN  →  [3] ORDER
    (PR)               (RFQ)             (PO)
                                           ↓
[6] PEMBAYARAN  ←  [5] VERIFIKASI  ←  [4] PENERIMAAN
    (Payment)         (3-Way Match)       (GRN + QC)
                                           ↓
                                       [7] STOK MASUK
                                           ↓
                                       [8] PENJUALAN
```

---

## TAHAP 1 — Purchase Requisition (PR)
### 📍 Menu: **Purchasing → Requisition (PR)**

### Apa itu PR?
PR adalah **permintaan pembelian internal** dari bagian/departemen yang membutuhkan barang atau bahan baku.
Sebelum ada PR yang disetujui, tidak boleh ada pembelian. Ini adalah **titik kontrol pertama**.

### Alur Status PR:
```
Draft  →  Submitted  →  Approved  →  Converted to PO
                    ↘  Rejected
```

### Demo Langkah-langkah:
1. **Klik tombol "Buat PR"** (pojok kanan atas / Quick Action di dashboard)
2. Isi form:
   - **Departemen** yang meminta
   - **Tanggal dibutuhkan** (kapan barang harus tersedia)
   - **Tujuan/keperluan** pembelian
   - **Item yang diminta** — nama barang, jumlah, satuan, estimasi harga
3. **Klik "Simpan"** → Status: `Draft`
4. **Klik "Ajukan untuk Approval"** → Status: `Submitted`
5. Login sebagai Manager / Admin → **Klik "Approve"** → Status: `Approved`

### Nilai Tambah:
- ✅ Ada jejak siapa yang meminta dan siapa yang menyetujui
- ✅ Bisa di-reject dengan alasan penolakan
- ✅ PR yang sudah approved bisa langsung **dikonversi ke Purchase Order**
- ✅ Tidak bisa dihapus setelah di-submit (audit trail)

---

## TAHAP 2 — Request for Quotation (RFQ) *(Opsional)*
### 📍 Menu: **Purchasing → RFQ**

### Apa itu RFQ?
RFQ adalah **permintaan penawaran harga** ke beberapa supplier sebelum memutuskan beli ke mana.

### Demo Langkah-langkah:
1. Buat RFQ baru dari menu
2. Tambahkan beberapa supplier yang akan diminta penawaran
3. Supplier mengisi harga → masuk ke **Supplier Quotes**
4. Bandingkan harga di **Price Comparison**
5. Pilih supplier terbaik → lanjut buat PO

---

## TAHAP 3 — Purchase Order (PO)
### 📍 Menu: **Purchasing → Purchase Orders**

### Apa itu PO?
PO adalah **dokumen resmi pembelian** yang dikirim ke supplier.
Berisi: nama barang, jumlah, harga satuan, total, dan tanggal pengiriman yang diharapkan.

### Cara Membuat PO:
**Cara 1 — Convert dari PR:**
1. Buka PR yang sudah `Approved`
2. Klik **"Convert ke PO"**
3. Pilih supplier, konfirmasi → PO otomatis terbuat dengan item dari PR

**Cara 2 — Manual:**
1. Klik **"Buat PO"** di menu Purchase Orders
2. Pilih supplier, isi item, harga, tanggal

### Status PO:
```
Draft  →  Submitted  →  Approved  →  Sent  →  Partial  →  Completed
```

### Nilai Tambah:
- ✅ PO terhubung ke PR (ada referensi dokumen)
- ✅ Bisa lihat history PO per supplier
- ✅ Approval berjenjang sebelum dikirim ke supplier

---

## TAHAP 4 — Penerimaan Barang + QC Inspection
### 📍 Menu: **Purchasing → Goods Receipt (GRN)**

### Apa itu GRN?
GRN (Goods Received Note) adalah **bukti penerimaan barang** dari supplier.
Di sini dilakukan **Quality Control (QC)** — barang dicek sebelum masuk stok.

### Alur Status GRN:
```
Pending  →  [QC Inspected]  →  Approved
              ↓
         (Stok masuk hanya untuk qty yang LULUS QC)
```

### Demo Langkah-langkah:

**A. Buat GRN (saat barang datang):**
1. Klik **"Buat GRN"**
2. Pilih PO yang barangnya baru datang
3. Isi: tanggal terima, nomor surat jalan, nomor polisi kendaraan, nama driver
4. Input **jumlah yang diterima** per item
5. Simpan → Status: `Pending`

**B. Inspeksi QC:**
1. Buka GRN yang baru dibuat
2. Terlihat tabel inspeksi per item:
   - Kolom **"Qty Diterima"** — input jumlah yang LULUS pemeriksaan
   - Kolom **"Qty Ditolak"** — input jumlah yang RUSAK / tidak sesuai spesifikasi
   - Kolom **"Alasan Penolakan"** — wajib diisi jika ada yang ditolak
3. Klik **"Terima Semua"** jika semua barang OK (shortcut)
4. Klik **"Simpan Inspeksi"** → Status: `Inspected`
5. Hasil QC otomatis:
   - 🟢 `Lulus QC` — semua diterima
   - 🟡 `Sebagian` — ada yang ditolak, ada yang diterima
   - 🔴 `Gagal QC` — semua ditolak

**C. Approval GRN:**
1. Setelah inspeksi, klik **"Approve GRN"**
2. Status: `Approved`
3. **Stok otomatis bertambah** sesuai qty yang diterima

### Nilai Tambah:
- ✅ Barang yang ditolak TIDAK masuk stok
- ✅ Ada catatan alasan penolakan untuk klaim ke supplier
- ✅ Progress bar visual persentase penerimaan
- ✅ Semua riwayat inspeksi tersimpan (siapa, kapan, berapa yang ditolak)

---

## TAHAP 5 — Verifikasi Tagihan: 3-Way Matching
### 📍 Menu: **Purchasing → Invoice & 3-Way Match**

### Apa itu 3-Way Matching?
3-Way Match adalah **proses verifikasi tagihan supplier** dengan membandingkan **3 dokumen**:

| Dokumen | Pertanyaan |
|---------|------------|
| 🔵 **Purchase Order** | Berapa yang kita PESAN? Harga berapa? |
| 🟣 **GRN (Penerimaan)** | Berapa yang sudah kita TERIMA dan lulus QC? |
| 🟢 **Invoice (Tagihan)** | Berapa yang supplier TAGIH? Harga berapa? |

> **Prinsip:** Supplier hanya boleh menagih untuk barang yang **sudah diterima dan lulus QC**.

### Demo Langkah-langkah:
1. Buka daftar invoice di menu **Invoice & 3-Way Match**
2. Klik **"3-Way Match"** pada invoice yang ingin diverifikasi
3. Sistem menampilkan tabel perbandingan:

| Item | PO Qty | PO Harga | GRN Terima | Inv Qty | Inv Harga | Status |
|------|--------|----------|------------|---------|-----------|--------|
| Bahan A | 100 | Rp 5.000 | 98 | 98 | Rp 5.000 | ✅ OK |
| Bahan B | 50 | Rp 10.000 | 50 | 50 | Rp 11.000 | ⚠️ Selisih Harga |

4. Sistem otomatis mendeteksi:
   - **⚠️ Selisih Harga** — harga invoice berbeda dari PO
   - **⚠️ Qty Lebih** — supplier menagih lebih dari yang diterima
   - **❌ Belum Ada GRN** — barang belum diterima tapi sudah ditagih

### Status Matching:
- ✅ **3-Way Match OK** — semua cocok, aman untuk dibayar
- ⚠️ **Ada Selisih** — perlu klarifikasi dengan supplier sebelum bayar
- ❌ **GRN Belum Ada** — tahan pembayaran, barang belum datang

### Nilai Tambah:
- ✅ Mencegah pembayaran ganda atau pembayaran lebih
- ✅ Mencegah tagihan untuk barang yang belum diterima
- ✅ Deteksi otomatis selisih harga dari PO
- ✅ Semua discrepancy terdokumentasi

---

## TAHAP 6 — Pembayaran (Payment Recording)
### 📍 Menu: **Purchasing → Invoice & 3-Way Match** → Tombol "Bayar"

### Demo Langkah-langkah:
1. Di daftar invoice, cari invoice dengan status **"Belum Bayar"**
2. Klik tombol **"Bayar"** (kolom Aksi)
3. Muncul modal pembayaran:
   - **Jumlah Bayar** — bisa bayar penuh atau sebagian
   - **Metode Pembayaran** — Transfer Bank / Tunai / Giro / Cek
   - **Catatan** — nomor referensi transfer, dll
4. Klik **"Catat Pembayaran"**
5. Status invoice berubah:
   - Bayar sebagian → `Sebagian`
   - Bayar lunas → `Lunas` ✅

### Nilai Tambah:
- ✅ Bisa cicil pembayaran (partial payment)
- ✅ Semua riwayat pembayaran tercatat di internal notes invoice
- ✅ Otomatis menghitung sisa tagihan (balance due)
- ✅ Tidak bisa bayar melebihi total tagihan

---

## TAHAP 7 — Stok Masuk (Inventory)
### 📍 Menu: **Warehouse → Inventory**

### Bagaimana Stok Masuk?
Stok **otomatis bertambah** saat GRN dibuat dan diapprove.
- Tidak perlu input manual ke stok
- Hanya qty yang **lulus QC** yang masuk stok
- Bisa dicek langsung di modul Warehouse

### Yang Bisa Dilihat:
- Jumlah stok terkini per item
- Lokasi penyimpanan (gudang/rak)
- Riwayat movement stok (masuk dari GRN mana, tanggal berapa)
- Batch number dan tanggal expired

---

## TAHAP 8 — Penjualan (Sales)
### 📍 Menu: **Sales**

### Hubungan dengan Pengadaan:
Barang yang sudah masuk stok dari proses pengadaan **langsung tersedia untuk dijual**.

### Alur Penjualan (singkat):
```
Customer Order  →  Sales Order  →  Delivery Order  →  Invoice Penjualan  →  Pembayaran
```

---

## 📊 Ringkasan Kontrol & Manfaat Sistem

| Masalah Umum | Solusi di Sistem |
|---|---|
| Pembelian tanpa persetujuan | PR harus di-approve sebelum PO dibuat |
| Bayar barang yang belum datang | 3-Way Match mendeteksi GRN kosong |
| Supplier tagih harga berbeda dari PO | 3-Way Match deteksi selisih harga otomatis |
| Barang rusak masuk stok | QC Inspection di GRN — hanya yg lulus masuk stok |
| Tidak ada audit trail | Semua aksi tercatat: siapa, kapan, berapa |
| Pembayaran ganda | Invoice hanya bisa dibayar sesuai balance_due |

---

## 🔑 Akses & Hak User

| Role | Yang Bisa Dilakukan |
|---|---|
| **Staff Purchasing** | Buat PR, Buat GRN, Input Invoice |
| **Manager Purchasing** | Approve PR, Approve PO, Approve GRN |
| **Finance** | Verifikasi 3-Way Match, Catat Pembayaran |
| **Gudang (Warehouse)** | Lihat GRN, Konfirmasi penerimaan fisik |


---

## ❓ Pertanyaan yang Sering Diajukan

**Q: Bagaimana jika supplier kirim barang lebih dari yang dipesan?**
> Di GRN, input saja jumlah yang diterima. Sistem akan menandai sebagai "over delivery" dan perlu konfirmasi sebelum masuk stok.

**Q: Bagaimana jika barang rusak semua?**
> Di inspeksi QC, set qty diterima = 0, qty ditolak = semua. Status GRN jadi `Gagal QC`. Barang tidak masuk stok. Bisa dibuat Purchase Return ke supplier.

**Q: Bisa bayar invoice sebagian?**
> Ya. Input jumlah yang dibayar. Status berubah ke `Sebagian`. Sisa tagihan tetap tercatat dan bisa dibayar di lain waktu.

**Q: Bagaimana jika harga invoice berbeda dari PO?**
> 3-Way Match akan menandai `Selisih Harga`. Finance perlu konfirmasi dengan supplier atau minta credit note sebelum melanjutkan pembayaran.

**Q: Data stok langsung update setelah GRN?**
> Ya, stok otomatis bertambah saat GRN diapprove. Tidak perlu input manual ke gudang.

---


