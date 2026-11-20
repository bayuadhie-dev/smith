"""Samakan gudang di baris penerimaan dengan tempat stoknya sekarang

Migrasi b4d6f8a0c2e3 memindahkan stok yang nyangkut di gudang WIP nonaktif ke
Gudang Persiapan dan Gudang Ethanol, tapi baris penerimaannya (grn_items) masih
menunjuk gudang lama. Akibatnya detail GRN menyebut gudang yang sudah tidak
memegang barangnya - persis yang dilaporkan untuk BPB-26/11/005 (PO 26-11-OLC-013).

Revision ID: e9a1c3b5d7f8
Revises: d8f0b2c4e6a7
Create Date: 2026-11-20
"""
from alembic import op
import sqlalchemy as sa

revision = 'e9a1c3b5d7f8'
down_revision = 'd8f0b2c4e6a7'
branch_labels = None
depends_on = None


def upgrade():
    # Baris penerimaan mengikuti tempat stok batch itu berada sekarang, selama
    # stoknya tinggal di satu lokasi saja (kalau sudah terpecah, biarkan apa
    # adanya - tidak ada satu jawaban yang benar).
    hasil = op.get_bind().execute(sa.text("""
        UPDATE grn_items gi
        SET location_id = s.location_id
        FROM (
            SELECT i.grn_id, i.material_id, i.product_id, i.batch_number,
                   MIN(i.location_id) AS location_id, COUNT(DISTINCT i.location_id) AS lokasi
            FROM inventory i
            WHERE i.grn_id IS NOT NULL AND i.is_active AND i.quantity_on_hand > 0
            GROUP BY i.grn_id, i.material_id, i.product_id, i.batch_number
        ) s
        WHERE s.grn_id = gi.grn_id
          AND s.lokasi = 1
          AND COALESCE(s.material_id, 0) = COALESCE(gi.material_id, 0)
          AND COALESCE(s.product_id, 0) = COALESCE(gi.product_id, 0)
          AND COALESCE(s.batch_number, '') = COALESCE(gi.batch_number, '')
          AND gi.location_id <> s.location_id
          AND gi.location_id IN (
              SELECT l.id FROM warehouse_locations l
              JOIN warehouse_zones z ON z.id = l.zone_id
              WHERE NOT z.is_active
          )
    """))
    print(f'  baris penerimaan disamakan dengan lokasi stoknya: {hasil.rowcount}')


def downgrade():
    pass
