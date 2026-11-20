"""Gudang Persiapan, Gudang Reject jadi Gudang Waste, dan roll beli dipindahkan

Tiga perubahan dari gudang Fengsheng (2026-11-20):

1. Gudang Persiapan dibuat. Main Roll dan Jumbo Roll yang dibeli jadi dari
   pemasok disimpan di sini - bukan hasil produksi sendiri, jadi tidak pantas
   duduk di gudang WIP.
2. Tiga roll MR/JR yang masih nyangkut di zona WIP-01 (zona lama yang sudah
   dinonaktifkan) dipindahkan ke Gudang Persiapan. Statusnya tidak diubah:
   kalau masih karantina, biar tetap karantina sampai QC meluluskan.
3. "Gudang Reject" berganti nama jadi "Gudang Waste". zone_type ikut diubah ke
   'quarantine' supaya pencarian lokasi karantina GRN tidak bergantung pada kata
   'reject' di namanya (kodenya di routes/purchasing.py juga sudah diperlebar).

Hanya dijalankan di instance Fengsheng. Aman diulang.

Revision ID: a3c5e7b9d1f2
Revises: f5b7d9c1e3a4
Create Date: 2026-11-20
"""
from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = 'a3c5e7b9d1f2'
down_revision = 'f5b7d9c1e3a4'
branch_labels = None
depends_on = None

ROLL_DIPINDAH = ('3010403012', '3020303010', '3020303008')


def upgrade():
    bind = op.get_bind()
    company = bind.execute(sa.text("SELECT company_name FROM company_profile LIMIT 1")).fetchone()
    if not company or 'FENGSHENG' not in (company[0] or '').upper():
        print('  bukan instance Fengsheng, dilewati')
        return

    # 1. Gudang Persiapan
    zone_id = bind.execute(sa.text("SELECT id FROM warehouse_zones WHERE code = 'WH-PERSIAPAN'")).scalar()
    if not zone_id:
        zone_id = bind.execute(sa.text("""
            INSERT INTO warehouse_zones (code, name, material_type, zone_type, is_active, created_at)
            VALUES ('WH-PERSIAPAN', 'Gudang Persiapan', 'wip', 'storage', TRUE, :now)
            RETURNING id
        """), {'now': datetime.utcnow()}).scalar()
    lokasi_id = bind.execute(sa.text(
        "SELECT id FROM warehouse_locations WHERE location_code = 'WH-PERSIAPAN-01'")).scalar()
    if not lokasi_id:
        lokasi_id = bind.execute(sa.text("""
            INSERT INTO warehouse_locations
                (zone_id, location_code, rack, level, position, capacity, capacity_uom,
                 occupied, is_active, is_available, created_at)
            VALUES (:z, 'WH-PERSIAPAN-01', 'R01', 'L01', 'P01', 999999, 'KG', 0, TRUE, TRUE, :now)
            RETURNING id
        """), {'z': zone_id, 'now': datetime.utcnow()}).scalar()

    # 2. Roll beli yang nyangkut di gudang nonaktif
    pindah = bind.execute(sa.text("""
        UPDATE inventory i SET location_id = :lok
        FROM materials m, warehouse_locations l, warehouse_zones z
        WHERE m.id = i.material_id AND l.id = i.location_id AND z.id = l.zone_id
          AND NOT z.is_active AND m.code IN :kode AND i.quantity_on_hand > 0
    """).bindparams(sa.bindparam('kode', expanding=True)),
        {'lok': lokasi_id, 'kode': list(ROLL_DIPINDAH)})

    # 3. Gudang Reject -> Gudang Waste
    ganti = bind.execute(sa.text("""
        UPDATE warehouse_zones SET name = 'Gudang Waste', zone_type = 'quarantine'
        WHERE code = 'WH-REJECT' AND name <> 'Gudang Waste'
    """))
    print(f'  roll dipindah ke Gudang Persiapan: {pindah.rowcount}, gudang diganti nama: {ganti.rowcount}')


def downgrade():
    bind = op.get_bind()
    bind.execute(sa.text("""
        UPDATE warehouse_zones SET name = 'Gudang Reject', zone_type = 'reject'
        WHERE code = 'WH-REJECT'
    """))
    # Lokasi roll tidak dikembalikan: gudang asalnya memang sudah dinonaktifkan.
    bind.execute(sa.text("DELETE FROM warehouse_locations WHERE location_code = 'WH-PERSIAPAN-01'"))
    bind.execute(sa.text("DELETE FROM warehouse_zones WHERE code = 'WH-PERSIAPAN'"))
