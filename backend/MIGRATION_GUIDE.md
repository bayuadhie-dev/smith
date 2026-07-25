# 🐘 Panduan Migrasi Production: SQLite ke PostgreSQL (PC Server)

Dokumen ini berisi panduan langkah demi langkah (*Complete Production Migration Blueprint*) untuk memindahkan database ERP dari SQLite (`erp_database.db`) ke PostgreSQL terpusat di PC Server kantor dengan aman.

---

## 📌 Langkah 0: Pre-Check Koneksi Jaringan & Port (Dari Laptop)
Sebelum memulai migrasi di PC Server, pastikan koneksi port PostgreSQL (5432) dari laptop ke PC Server via Tailscale sudah terbuka.

```bash
# Jalankan dari terminal laptop:
psql -h 100.91.124.96 -U postgres -d postgres -c "SELECT version();"
```
> [!NOTE]
> Jika perintah `psql` belum terinstall di laptop:
> - **Arch Linux**: `sudo pacman -S postgresql-libs`
> - **Ubuntu/Debian**: `sudo apt install postgresql-client`
> - **macOS**: `brew install libpq`

*Jika tersambung dan menampilkan versi PostgreSQL, maka jalur jaringan Tailscale sudah 100% siap.*

---

## 🚀 Rencana Eksekusi Migrasi (5 Langkah Aman)

### Langkah 1: Uji Coba Mode Dry-Run
Lakukan simulasi awal untuk memastikan seluruh 306+ tabel & data SQLite terbaca tanpa mengubah database target:
```bash
python3 scripts/migrate_to_postgres.py --dry-run
```

---

### Langkah 2: Backup Manual File SQLite (Safety Net)
Buat salinan cadangan manual file SQLite di PC Server sebelum migrasi eksekusi dijalankan:
```bash
cp instance/erp_database.db instance/erp_database.db.pre-pg-migration
```

---

### Langkah 3: Eksekusi Migrasi Otomatis ke PostgreSQL
Eksekusi migrasi data penuh dengan menyertakan URI PostgreSQL:
```bash
python3 scripts/migrate_to_postgres.py --pg-uri "postgresql://postgres:PASSWORD_ANDA@localhost:5432/erp_db"
```

---

### Langkah 4: Spot-Check Manual & Verifikasi Integritas Relasional (FK Check)
Lakukan verifikasi integritas data & cek apakah ada data child yang "yatim" (orphan records):

1. **Cek Sampel Datetime & Data Terbaru**:
   ```bash
   sudo -u postgres psql -d erp_db -c "SELECT id, created_at FROM packing_lists_new ORDER BY id DESC LIMIT 5;"
   ```

2. **Cek Integritas Relasional Foreign Key (Harus Bernilai 0)**:
   ```bash
   sudo -u postgres psql -d erp_db -c "SELECT COUNT(*) AS orphan_items FROM packing_list_new_items i LEFT JOIN packing_lists_new p ON i.packing_list_id = p.id WHERE p.id IS NULL;"
   ```
   *Jika hasilnya `0`, berarti integritas relasi antar tabel utuh 100%.*

---

### Langkah 5: Switch `.env` & Restart Service via PM2
1. Buka file `backend/.env` (di PC Server dan di Laptop) lalu sesuaikan `DATABASE_URL`:
   - **Di PC Server**: `DATABASE_URL=postgresql://postgres:PASSWORD_ANDA@localhost:5432/erp_db`
   - **Di Laptop**: `DATABASE_URL=postgresql://postgres:PASSWORD_ANDA@100.91.124.96:5432/erp_db`

2. Restart seluruh process PM2 yang berkaitan di PC Server:
   ```bash
   pm2 restart smith-backend --update-env
   pm2 restart openwa --update-env
   # Atau restart seluruh service PM2:
   pm2 restart all --update-env
   ```

---

## ⛔ Pasca Migrasi: Depresiasi File SQLite & Syncthing
Setelah migrasi sukses dan aplikasi sudah berjalan di PostgreSQL:
1. **Rename File SQLite Lama** di server agar tidak ada aplikasi/script yang salah membaca data lama:
   ```bash
   mv instance/erp_database.db instance/erp_database.db.DEPRECATED
   ```
2. **Keluarkan File `.db` dari Syncthing**:
   Abaikan (*ignore*) file `.db` di Syncthing. PC Server kini menjadi **Single Source of Truth** (Pusat Data Tunggal) secara real-time via jaringan.

---

## 🛡️ Panduan Revert (Rollback ke SQLite)

> [!WARNING]
> **PENTING REGARDING REVERT**: Revert ke SQLite lama **hanya aman dilakukan SEBELUM ada transaksi/input data baru** di PostgreSQL. Jika sudah ada transaksi baru di PostgreSQL lalu Anda melakukan revert, data transaksi baru tersebut akan tertinggal di PostgreSQL.

**Langkah Revert (Jika Terjadi Kendala di Awal Setup)**:
1. Buka `backend/.env` (di server & laptop).
2. Kembalikan nilai `DATABASE_URL`:
   ```env
   DATABASE_URL=sqlite:///erp_database.db
   ```
3. Kembalikan nama file SQLite:
   ```bash
   mv instance/erp_database.db.DEPRECATED instance/erp_database.db
   ```
4. Restart service PM2: `pm2 restart smith-backend --update-env`.
