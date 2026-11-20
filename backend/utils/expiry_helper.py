"""Tanggal kedaluwarsa untuk baris stok yang baru masuk.

Dua pintu masuk stok harus mengisinya, kalau tidak laporan "Batch Segera
Kedaluwarsa" dan urutan FEFO di faktur penjualan tidak punya bahan:

1. Penerimaan barang (GRN) - tanggalnya diketik petugas gudang dari kemasan.
2. Hasil produksi (FG) - tidak ada yang mengetik, jadi dihitung dari masa simpan
   di master barang.

Nama kolom masa simpan sengaja beda di dua master dan itu memang begitu sejak
awal: Material pakai `expiry_days`, Product pakai `self_life_days`.
"""
from datetime import date, datetime, timedelta


def masa_simpan_hari(product=None, material=None):
    """Berapa hari barang ini tahan sejak dibuat/diterima. None = tidak diatur."""
    for obj, field in ((product, 'self_life_days'), (material, 'expiry_days')):
        if obj is None:
            continue
        nilai = getattr(obj, field, None)
        try:
            nilai = int(nilai) if nilai is not None else None
        except (TypeError, ValueError):
            nilai = None
        if nilai and nilai > 0:
            return nilai
    return None


def _to_date(nilai):
    if nilai is None or nilai == '':
        return None
    if isinstance(nilai, datetime):
        return nilai.date()
    if isinstance(nilai, date):
        return nilai
    try:
        return datetime.strptime(str(nilai)[:10], '%Y-%m-%d').date()
    except ValueError:
        return None


def hitung_kedaluwarsa(explicit=None, base_date=None, product=None, material=None):
    """Tanggal yang diketik menang; kalau kosong, dihitung dari masa simpan master."""
    diketik = _to_date(explicit)
    if diketik:
        return diketik
    hari = masa_simpan_hari(product=product, material=material)
    if not hari:
        return None
    mulai = _to_date(base_date) or date.today()
    return mulai + timedelta(days=hari)


def isi_kedaluwarsa_stok(inventory, explicit=None, base_date=None, product=None, material=None):
    """Isi expiry_date (dan production_date) pada baris stok, tanpa menimpa yang sudah ada.

    Tidak menimpa karena satu baris stok bisa menampung beberapa penerimaan batch
    yang sama; yang pertama tercatat dianggap benar, dan yang lebih pendek menang
    supaya laporan tidak pernah terlalu optimis.
    """
    exp = hitung_kedaluwarsa(explicit, base_date, product=product, material=material)
    if exp:
        lama = getattr(inventory, 'expiry_date', None)
        if not lama or exp < lama:
            inventory.expiry_date = exp
    prod = _to_date(base_date)
    if prod and not getattr(inventory, 'production_date', None):
        inventory.production_date = prod
    return getattr(inventory, 'expiry_date', None)
