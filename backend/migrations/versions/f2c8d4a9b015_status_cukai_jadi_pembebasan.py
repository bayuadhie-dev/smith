"""kalimat status cukai di kartu pengawasan jadi pembebasan

Revision ID: f2c8d4a9b015
Revises: e9b3f6c1a7d2
Create Date: 2026-11-26

Pembacaan awal keliru: yang diawasi Bea Cukai bukan cukai yang sudah dibayar,
melainkan cukai yang DIBEBASKAN atas ethanol yang diterima. Setelan yang sudah
terlanjur tersimpan dengan kalimat lama ikut diperbaiki di sini supaya dua
server tidak perlu disentuh satu per satu. Kalimat yang sudah diubah tangan
(bukan kalimat bawaan lama) dibiarkan apa adanya.
"""
from alembic import op
import sqlalchemy as sa

revision = 'f2c8d4a9b015'
down_revision = 'e9b3f6c1a7d2'
branch_labels = None
depends_on = None

LAMA = 'Cukai dibayar, belum memakai fasilitas pembebasan'
BARU = 'Pembebasan cukai'


def upgrade():
    op.execute(sa.text("UPDATE system_settings SET setting_value = :baru "
                       "WHERE setting_key = 'pengawasan.ethanol_status_cukai' AND setting_value = :lama")
               .bindparams(baru=BARU, lama=LAMA))


def downgrade():
    op.execute(sa.text("UPDATE system_settings SET setting_value = :lama "
                       "WHERE setting_key = 'pengawasan.ethanol_status_cukai' AND setting_value = :baru")
               .bindparams(baru=BARU, lama=LAMA))
