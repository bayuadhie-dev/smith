#!/bin/bash
# ==========================================================
# Script Automasi Sinkronisasi GitHub (SMITH ERP)
# ==========================================================
echo "🚀 Memulai proses sinkronisasi ke Repositori GitHub..."

# 1. Cek status file (Melihat data yang dipindah/dihapus)
echo -e "\n📝 Status Perubahan:"
git status -s

# 2. Menambahkan semua perubahan (termasuk file-file yang baru di-move)
git add .

# 3. Membuat Commit dengan pesan standar "Housekeeping"
echo -e "\n⏳ Menyimpan riwayat komit..."
git commit -m "chore(backend): Housekeeping & merapihkan root directory scripts"

# 4. Git Push
echo -e "\n☁️ Mendorong (Pushing) ke GitHub..."
git push -u origin main

echo -e "\n✅ Selesai! Repositori GitHub Anda sekarang sama rapinya dengan direktori lokal."
