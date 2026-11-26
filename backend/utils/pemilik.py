"""Satu akun pemilik sistem.

Beberapa hal sengaja dibatasi ke satu akun, bukan ke "semua super admin":
saklar penerimaan tanpa QC (2026-11-25) dan angka rupiah di dasbor utama
(2026-11-26). Alasannya sama: akun super admin bisa lebih dari satu (mis.
`internalaudit`), dan yang dimaksud pemilik waktu bilang "khusus akun saya"
memang satu akun itu saja.

Dipakai bersama supaya namanya tidak tersebar sebagai teks di banyak berkas.
"""

PEMILIK_USERNAME = 'admin'


def adalah_pemilik(user) -> bool:
    return bool(user is not None and getattr(user, 'username', None) == PEMILIK_USERNAME)
