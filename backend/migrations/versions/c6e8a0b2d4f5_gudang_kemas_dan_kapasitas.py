"""Gudang Bahan Kemas dan Aksesoris, plus kapasitas lokasi yang konsisten

1. "Gudang Bahan Kemas" berganti nama jadi "Gudang Bahan Kemas dan Aksesoris" -
   aksesoris memang disimpan di gudang yang sama (lihat alur dokumen Fengsheng).
2. Kapasitas lokasi selama ini campur aduk: 999999 PCS, 999999 KG, 100000 kg,
   0 unit, 100 m3 - angka 999999 itu "tak terbatas" yang ditulis sebagai angka
   besar, dan satuannya ada yang huruf kecil. Sekarang: 0 berarti tidak dibatasi
   (itu yang dipakai 999999 sebelumnya), satuan ditulis huruf besar.

Kolom `occupied` sengaja tidak diapa-apakan di sini: isinya memang tidak pernah
benar karena hanya diperbarui oleh Transfer Stok, bukan oleh penerimaan atau
pengiriman. Pemakaian gudang sekarang dihitung dari tabel stok saat dibaca.

Revision ID: c6e8a0b2d4f5
Revises: b4d6f8a0c2e3
Create Date: 2026-11-20
"""
from alembic import op
import sqlalchemy as sa

revision = 'c6e8a0b2d4f5'
down_revision = 'b4d6f8a0c2e3'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    company = bind.execute(sa.text("SELECT company_name FROM company_profile LIMIT 1")).fetchone()
    if company and 'FENGSHENG' in (company[0] or '').upper():
        bind.execute(sa.text("""
            UPDATE warehouse_zones SET name = 'Gudang Bahan Kemas dan Aksesoris'
            WHERE code = 'WH-PM' AND name <> 'Gudang Bahan Kemas dan Aksesoris'
        """))

    # 999999 = "tak terbatas" yang ditulis sebagai angka besar
    bind.execute(sa.text("UPDATE warehouse_locations SET capacity = 0 WHERE capacity >= 999999"))
    bind.execute(sa.text("UPDATE warehouse_locations SET capacity_uom = UPPER(capacity_uom) WHERE capacity_uom IS NOT NULL"))
    bind.execute(sa.text("UPDATE warehouse_zones SET capacity_uom = UPPER(capacity_uom) WHERE capacity_uom IS NOT NULL"))


def downgrade():
    bind = op.get_bind()
    bind.execute(sa.text("""
        UPDATE warehouse_zones SET name = 'Gudang Bahan Kemas'
        WHERE code = 'WH-PM' AND name = 'Gudang Bahan Kemas dan Aksesoris'
    """))
    bind.execute(sa.text("UPDATE warehouse_locations SET capacity = 999999 WHERE capacity = 0"))
