# 🐘 Panduan Migrasi SQLite ke PostgreSQL (PC Server)

Dokumen ini berisi panduan langkah demi langkah untuk menjalankan migrasi data dari SQLite (`erp_database.db`) ke PostgreSQL di PC Server kantor kapan saja Anda siap.

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

## 🚀 Langkah Migrasi (Hanya 2 Langkah)

### Langkah 1: Jalankan Skrip Migrasi Otomatis
Masuk ke folder `backend` di server dan jalankan:
```bash
python3 scripts/migrate_to_postgres.py --pg-uri "postgresql://postgres:PASSWORD_ANDA@localhost:5432/erp_db"
```

*Skrip ini otomatis:*
- Membuat seluruh struktur tabel & skema PostgreSQL secara otomatis
- Memindahkan 100.000+ baris data dari SQLite tanpa data yang hilang
- Menyesuaikan tipe data (Boolean, Datetime, String, JSON)
- Mereset urutan ID *Auto-Increment* PostgreSQL

---

### Langkah 2: Aktifkan PostgreSQL di File `.env`
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
