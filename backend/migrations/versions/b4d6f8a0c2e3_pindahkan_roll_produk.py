"""Pindahkan isi gudang WIP yang sudah mati (roll MR/JR + ethanol)

Migrasi sebelumnya (a3c5e7b9d1f2) mencocokkan baris stok lewat tabel materials,
padahal ketiga roll itu terdaftar sebagai PRODUK - jadi tidak ada yang pindah.
Sekarang dicocokkan ke dua-duanya.

Tujuan: roll MR/JR ke Gudang Persiapan (dibeli jadi dari pemasok, bukan hasil
produksi sendiri), ethanol ke Gudang Ethanol yang memang baru dibuatkan lokasi.
Status stok tidak disentuh - yang karantina tetap karantina.

Revision ID: b4d6f8a0c2e3
Revises: a3c5e7b9d1f2
Create Date: 2026-11-20
"""
from alembic import op
import sqlalchemy as sa

revision = 'b4d6f8a0c2e3'
down_revision = 'a3c5e7b9d1f2'
branch_labels = None
depends_on = None

# kode barang -> kode lokasi tujuan
TUJUAN = {
    '3010403012': 'WH-PERSIAPAN-01',
    '3020303010': 'WH-PERSIAPAN-01',
    '3020303008': 'WH-PERSIAPAN-01',
    '1050100013': 'WH-ETH-01',
}


def upgrade():
    bind = op.get_bind()
    company = bind.execute(sa.text("SELECT company_name FROM company_profile LIMIT 1")).fetchone()
    if not company or 'FENGSHENG' not in (company[0] or '').upper():
        print('  bukan instance Fengsheng, dilewati')
        return

    pindah = 0
    for kode_barang, kode_lokasi in TUJUAN.items():
        lok = bind.execute(sa.text("SELECT id FROM warehouse_locations WHERE location_code = :k"),
                           {'k': kode_lokasi}).scalar()
        if not lok:
            continue
        hasil = bind.execute(sa.text("""
            UPDATE inventory i SET location_id = :lok
            WHERE i.id IN (
                SELECT i2.id FROM inventory i2
                LEFT JOIN materials m ON m.id = i2.material_id
                LEFT JOIN products p ON p.id = i2.product_id
                JOIN warehouse_locations l ON l.id = i2.location_id
                JOIN warehouse_zones z ON z.id = l.zone_id
                WHERE COALESCE(m.code, p.code) = :kode
                  AND NOT z.is_active AND i2.quantity_on_hand > 0
            )
        """), {'lok': lok, 'kode': kode_barang})
        pindah += hasil.rowcount
    print(f'  baris stok dipindahkan dari gudang nonaktif: {pindah}')


def downgrade():
    # Gudang asalnya memang sudah dinonaktifkan; tidak ada gunanya dikembalikan.
    pass
