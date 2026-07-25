# 🐘 Panduan Migrasi Production: SQLite ke PostgreSQL (PC Server)

Dokumen ini berisi panduan langkah demi langkah yang aman (*safe execution workflow*) untuk migrasi data dari SQLite (`erp_database.db`) ke PostgreSQL di PC Server kantor.

---

## 📋 Prasyarat di PC Server
1. PostgreSQL service aktif:
   ```bash
   sudo systemctl start postgresql
   ```

2. Buat Database PostgreSQL Target (misal: `erp_db`):
   ```bash
   sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'PASSWORD_ANDA';"
   sudo -u postgres psql -c "CREATE DATABASE erp_db;"
   ```

---

## 🚀 Rencana Eksekusi 5 Langkah (Rekomendasi Keamanan Tinggi)

### Langkah 1: Uji Coba Mode Dry-Run
Lakukan tes simulasi awal untuk memastikan seluruh tabel & baris SQLite terbaca dengan benar tanpa mengubah database:
```bash
python3 scripts/migrate_to_postgres.py --dry-run
```

---

### Langkah 2: Backup Manual File SQLite (Safety Net)
Buat salinan cadangan manual file SQLite sebelum migrasi dijalankan:
```bash
cp instance/erp_database.db instance/erp_database.db.pre-pg-migration
```

---

### Langkah 3: Jalankan Migrasi Otomatis ke PostgreSQL
Eksekusi migrasi penuh dengan menyertakan URI koneksi PostgreSQL:
```bash
python3 scripts/migrate_to_postgres.py --pg-uri "postgresql://postgres:PASSWORD_ANDA@localhost:5432/erp_db"
```

*Skrip ini otomatis:*
- Membuat seluruh struktur tabel & skema PostgreSQL secara otomatis
- Memindahkan data dengan sanitasi tanggal (ISO 8601 & Indonesia `DD/MM/YYYY`) & Boolean
- Mode **Fallback Row-by-Row** jika ada baris data yang bermasalah (mencegah rollback tabel)
- Reset urutan ID *Auto-Increment* PostgreSQL
- Verifikasi perbandingan jumlah baris data SQLite vs PostgreSQL di akhir proses

---

### Langkah 4: Spot-Check Manual Tabel Kritis
Lakukan verifikasi acak untuk beberapa tabel penting (misal `packing_lists_new`, `work_orders`, `sales_orders`) menggunakan `psql`:
```bash
sudo -u postgres psql -d erp_db -c "SELECT id, created_at FROM packing_lists_new ORDER BY id DESC LIMIT 5;"
```

---

### Langkah 5: Aktifkan PostgreSQL di File `.env`
Buka file `backend/.env` dan ubah nilai `DATABASE_URL`:
```env
DATABASE_URL=postgresql://postgres:PASSWORD_ANDA@localhost:5432/erp_db
```

Lalu restart backend Flask:
```bash
sudo systemctl restart erp-backend
```

---

## 🛡️ Panduan Revert (Jika Ingin Kembali ke SQLite)
Jika ingin mengembalikan backend ke SQLite kapan saja:
1. Buka `backend/.env`
2. Ubah `DATABASE_URL` kembali ke:
   ```env
   DATABASE_URL=sqlite:///erp_database.db
   ```
3. Restart backend. Proses revert hanya membutuhkan waktu 5 detik.
