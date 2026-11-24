"""Setelan mesin ikut tercatat di tiap roll spunlace

Produksi 2026-11-24: lembar harian spunlace mencatat gramasi, ketebalan,
kecepatan mesin dan lama satu roll di baris yang sama dengan nomor rollnya.
Sebelumnya hanya muat di kolom catatan, jadi tidak bisa dijumlah atau dibanding.

Gramasi juga dipakai menghitung berat kain kalau rollnya tidak ditimbang -
pada uji jalan mesin yang dicatat memang panjang dan setelannya.

Revision ID: c5e7f9b1d3a6
Revises: b4d6f8a0c2e4
"""
import sqlalchemy as sa
from alembic import op

revision = 'c5e7f9b1d3a6'
down_revision = 'b4d6f8a0c2e4'
branch_labels = None
depends_on = None

KOLOM = ('gramasi_gsm', 'thickness_micron', 'speed_m_per_min', 'minutes_per_roll')


def upgrade():
    ada = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('production_rolls')}
    for nama in KOLOM:
        if nama not in ada:
            op.add_column('production_rolls', sa.Column(nama, sa.Numeric(10, 2), nullable=True))


def downgrade():
    ada = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('production_rolls')}
    for nama in KOLOM:
        if nama in ada:
            op.drop_column('production_rolls', nama)
