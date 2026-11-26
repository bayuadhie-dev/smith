# SOP Penginputan Data

Diminta Presiden Direktur 26 November 2026. Berkas `.docx` di folder ini **dibangkitkan**, bukan diketik
tangan - jangan menyunting hasilnya lalu menganggapnya selesai, karena hasil suntingan hilang pada
pembangkitan berikutnya.

## Isi

| Berkas | Isi |
|---|---|
| `00-Prosedur-Penginputan-Data-Umum.docx` | Aturan yang berlaku di semua modul (QP-ALL-01) |
| `00-Daftar-Induk-SOP.docx` | Daftar seluruh lembar beserta nomor dokumennya (FRM-ALL-01) |
| `SOP-<Modul>.docx` | Satu lembar Instruksi Kerja per modul (WI-xxx-nn) |

## Membangkitkan ulang

```bash
python3 scripts/sop/kumpulkan_fakta.py > scripts/sop/fakta.json   # tarik fakta dari kode
backend/venv_test/bin/python scripts/sop/buat_sop.py              # tulis seluruh .docx
backend/venv_test/bin/python scripts/sop/buat_sop.py Purchasing   # satu modul saja
```

Butuh `python-docx` di venv (`pip install python-docx`). Sengaja tidak masuk `requirements.txt`:
ini alat penulis dokumen, bukan bagian aplikasi yang jalan di server.

`scripts/sop/izin_peran.json` (peran pemegang tiap izin) dan `scripts/sop/jumlah_data.json`
(jumlah baris tiap tabel) diambil dari basis data produksi. Perbarui keduanya kalau peran berubah,
kalau tidak lembar SOP akan menyebut peran yang sudah tidak berlaku.

## Yang masih harus diisi orang

Tiap tanda **[PERLU DIPASTIKAN]** di dalam dokumen adalah kebijakan yang tidak bisa dibaca dari kode:
batas waktu penginputan, siapa yang melapor kalau telat, dan akibat kalau prosedurnya tidak diikuti.
Harus diputuskan Direksi/kepala bagian sebelum dokumen disahkan.
