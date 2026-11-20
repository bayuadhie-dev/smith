"""Lokasi untuk Gudang Chemical & Ethanol, plus Gudang Spunlace & Laminasi

Gudang Chemical (WH-CMW) dan Gudang Ethanol (WH-ETH) sudah ada sebagai zona tapi
belum punya satu pun lokasi rak, jadi tidak pernah muncul di pilihan gudang -
chemical dan ethanol terpaksa diterima ke Gudang Bahan Baku. Sekaligus menambah
dua gudang yang diminta: Spunlace (roll hasil lini spunlace) dan Laminasi.

Hanya dijalankan di instance Fengsheng; Falmaco punya susunan gudangnya sendiri.
Aman diulang: semuanya dicek dulu berdasarkan kode.

Revision ID: f5b7d9c1e3a4
Revises: e4a6c8b0d2f3
Create Date: 2026-11-20
"""
from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = 'f5b7d9c1e3a4'
down_revision = 'e4a6c8b0d2f3'
branch_labels = None
depends_on = None

# (kode zona, nama, jenis barang, kode lokasi, satuan kapasitas)
ZONA_BARU = [
    ('WH-SPUNLACE', 'Gudang Spunlace', 'wip', 'WH-SPUNLACE-01', 'KG'),
    ('WH-LAMINASI', 'Gudang Laminasi', 'wip', 'WH-LAMINASI-01', 'KG'),
]
# zona yang sudah ada tapi belum punya lokasi
LOKASI_SAJA = [
    ('WH-CMW', 'WH-CMW-01', 'KG'),
    ('WH-ETH', 'WH-ETH-01', 'KG'),
]


def _buat_lokasi(bind, zone_id, kode, uom):
    ada = bind.execute(sa.text("SELECT 1 FROM warehouse_locations WHERE location_code = :k"),
                       {'k': kode}).fetchone()
    if ada:
        return False
    bind.execute(sa.text("""
        INSERT INTO warehouse_locations
            (zone_id, location_code, rack, level, position, capacity, capacity_uom,
             occupied, is_active, is_available, created_at)
        VALUES (:z, :k, 'R01', 'L01', 'P01', 999999, :u, 0, TRUE, TRUE, :now)
    """), {'z': zone_id, 'k': kode, 'u': uom, 'now': datetime.utcnow()})
    return True


def upgrade():
    bind = op.get_bind()
    company = bind.execute(sa.text("SELECT company_name FROM company_profile LIMIT 1")).fetchone()
    if not company or 'FENGSHENG' not in (company[0] or '').upper():
        print('  bukan instance Fengsheng, gudang tidak ditambahkan')
        return

    dibuat_zona = dibuat_lokasi = 0

    for kode_zona, nama, jenis, kode_lokasi, uom in ZONA_BARU:
        row = bind.execute(sa.text("SELECT id FROM warehouse_zones WHERE code = :k"),
                           {'k': kode_zona}).fetchone()
        if row:
            zone_id = row[0]
        else:
            zone_id = bind.execute(sa.text("""
                INSERT INTO warehouse_zones
                    (code, name, material_type, zone_type, is_active, created_at)
                VALUES (:k, :n, :t, 'storage', TRUE, :now)
                RETURNING id
            """), {'k': kode_zona, 'n': nama, 't': jenis, 'now': datetime.utcnow()}).scalar()
            dibuat_zona += 1
        if _buat_lokasi(bind, zone_id, kode_lokasi, uom):
            dibuat_lokasi += 1

    for kode_zona, kode_lokasi, uom in LOKASI_SAJA:
        row = bind.execute(sa.text("SELECT id FROM warehouse_zones WHERE code = :k"),
                           {'k': kode_zona}).fetchone()
        if row and _buat_lokasi(bind, row[0], kode_lokasi, uom):
            dibuat_lokasi += 1

    print(f'  gudang baru: {dibuat_zona}, lokasi baru: {dibuat_lokasi}')


def downgrade():
    bind = op.get_bind()
    for kode_zona, _, _, kode_lokasi, _ in ZONA_BARU:
        bind.execute(sa.text("DELETE FROM warehouse_locations WHERE location_code = :k"), {'k': kode_lokasi})
        bind.execute(sa.text("DELETE FROM warehouse_zones WHERE code = :k"), {'k': kode_zona})
    for _, kode_lokasi, _ in LOKASI_SAJA:
        bind.execute(sa.text("DELETE FROM warehouse_locations WHERE location_code = :k"), {'k': kode_lokasi})
