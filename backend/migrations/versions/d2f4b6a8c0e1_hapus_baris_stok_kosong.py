"""Hapus baris stok yang isinya nol

Sisa dari perpindahan karantina/reject: batch yang sudah keluar meninggalkan
baris 0 kg di gudang reject, dan baris itu tetap ikut terdaftar di "Barang per
Gudang" (keluhan Finance 2026-11-20, VISCOSE RAYON di WH-REJECT-01).

Aman: tidak ada kuantitas yang hilang karena isinya memang nol, dan kalau nanti
ada barang masuk lagi untuk batch+lokasi yang sama, kode penerimaan membuat
barisnya kembali sendiri.

Revision ID: d2f4b6a8c0e1
Revises: c1e3a5b7d9f2
Create Date: 2026-11-20
"""
from alembic import op
import sqlalchemy as sa

revision = 'd2f4b6a8c0e1'
down_revision = 'c1e3a5b7d9f2'
branch_labels = None
depends_on = None


def upgrade():
    hasil = op.get_bind().execute(sa.text("""
        DELETE FROM inventory
        WHERE COALESCE(quantity_on_hand, 0) = 0
          AND COALESCE(quantity_reserved, 0) = 0
          AND COALESCE(quantity_available, 0) = 0
    """))
    print(f'  baris stok kosong dihapus: {hasil.rowcount}')


def downgrade():
    # Baris kosong tidak menyimpan apa pun yang bisa dipulihkan.
    pass
