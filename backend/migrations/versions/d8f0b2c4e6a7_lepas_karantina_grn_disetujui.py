"""Lepaskan stok karantina milik penerimaan yang sudah disetujui

Semua barang di master bertanda `erp_approval`, jadi setiap stok yang masuk lahir
berstatus `quarantine` dan menunggu pelepasan manual di halaman QC. Akibatnya
barang yang sudah diperiksa DAN penerimaannya sudah disetujui tetap terkunci -
di Fengsheng 21 baris (1,3 juta unit) menganggur padahal 5 GRN-nya approved dan
hasil pemeriksaannya lolos.

Mulai sekarang persetujuan GRN melepaskan stoknya sendiri (lihat approve_grn);
migrasi ini membereskan yang sudah terlanjur menumpuk. Yang ditolak QC tidak
disentuh: barisnya ada di gudang waste dengan status tersendiri.

Revision ID: d8f0b2c4e6a7
Revises: c6e8a0b2d4f5
Create Date: 2026-11-20
"""
from alembic import op
import sqlalchemy as sa

revision = 'd8f0b2c4e6a7'
down_revision = 'c6e8a0b2d4f5'
branch_labels = None
depends_on = None


def upgrade():
    hasil = op.get_bind().execute(sa.text("""
        UPDATE inventory i
        SET stock_status = CASE WHEN i.product_id IS NOT NULL THEN 'released' ELSE 'available' END
        FROM goods_received_notes g
        WHERE g.id = i.grn_id
          AND i.stock_status = 'quarantine'
          AND g.status = 'approved'
          AND COALESCE(g.quality_status, '') <> 'failed'
    """))
    print(f'  stok dilepas dari karantina: {hasil.rowcount}')


def downgrade():
    # Tidak dikembalikan: status karantinanya memang tidak pernah dimaksudkan menetap.
    pass
