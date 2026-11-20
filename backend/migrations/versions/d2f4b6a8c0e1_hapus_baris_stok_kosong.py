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


REFERENSI = [
    ('inventory_movements', 'inventory_id'),
    ('stock_opname_items', 'inventory_id'),
    ('material_consumptions', 'from_inventory_id'),
    ('pick_list_items', 'inventory_id'),
    ('stock_transfer_items', 'from_inventory_id'),
    ('inventory_adjustments', 'inventory_id'),
]


def upgrade():
    bind = op.get_bind()
    tabel = set(sa.inspect(bind).get_table_names())
    dipakai = ' OR '.join(
        f"EXISTS (SELECT 1 FROM {t} x WHERE x.{k} = i.id)"
        for t, k in REFERENSI if t in tabel
    ) or 'FALSE'

    kosong = f"""
        COALESCE(i.quantity_on_hand, 0) = 0
        AND COALESCE(i.quantity_reserved, 0) = 0
        AND COALESCE(i.quantity_available, 0) = 0
    """

    # Baris kosong yang masih dirujuk dokumen lain (opname, pick list, mutasi)
    # tidak boleh dihapus - cukup dinonaktifkan supaya hilang dari daftar.
    dinonaktifkan = bind.execute(sa.text(f"""
        UPDATE inventory i SET is_active = FALSE
        WHERE {kosong} AND i.is_active AND ({dipakai})
    """))
    dihapus = bind.execute(sa.text(f"""
        DELETE FROM inventory i
        WHERE {kosong} AND NOT ({dipakai})
    """))
    print(f'  baris stok kosong: {dihapus.rowcount} dihapus, {dinonaktifkan.rowcount} dinonaktifkan')


def downgrade():
    # Baris kosong tidak menyimpan apa pun yang bisa dipulihkan.
    pass
