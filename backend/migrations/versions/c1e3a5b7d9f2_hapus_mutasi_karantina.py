"""Hapus mutasi perpindahan karantina QC dari buku stok

Pemeriksaan QC pada penerimaan barang memindahkan barang antara gudang biasa dan
karantina, dan perpindahan itu dulu ditulis berpasangan (transfer_out +
transfer_in, jumlah sama, detik yang sama). Barangnya tidak pernah benar-benar
keluar masuk gudang - cuma pindah rak - jadi barisnya hanya meramaikan daftar
transaksi. Finance minta dihapus, bukan sekadar disembunyikan (2026-11-20).

Aman: pasangan ini selalu saling meniadakan, jadi saldo per barang tidak berubah
sedikit pun. Yang berubah hanya rincian per lokasi versi buku stok; stok
sesungguhnya tetap di tabel stok (inventory), tidak disentuh.

Kode penulisnya juga sudah dihentikan di routes/purchasing.py, jadi baris seperti
ini tidak terbentuk lagi.

Revision ID: c1e3a5b7d9f2
Revises: b9d1f3a5c7e9
Create Date: 2026-11-20
"""
from alembic import op
import sqlalchemy as sa

revision = 'c1e3a5b7d9f2'
down_revision = 'b9d1f3a5c7e9'
branch_labels = None
depends_on = None

REF_TYPES = ('grn_inspection', 'grn_inspection_reject')
TXN_TYPES = ('transfer_in', 'transfer_out')


def upgrade():
    bind = op.get_bind()
    hasil = bind.execute(sa.text("""
        DELETE FROM inventory_transactions
        WHERE reference_type IN :refs AND transaction_type IN :txns
    """).bindparams(sa.bindparam('refs', expanding=True), sa.bindparam('txns', expanding=True)),
        {'refs': list(REF_TYPES), 'txns': list(TXN_TYPES)})
    print(f'  mutasi karantina QC dihapus: {hasil.rowcount}')


def downgrade():
    # Barisnya murni catatan perpindahan internal yang saling meniadakan;
    # tidak ada yang bisa dipulihkan dari data lain.
    pass
