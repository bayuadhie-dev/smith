"""Hapus seluruh tabel obrolan grup.

Fitur obrolan dihapus 2026-11-22: nol pesan di Fengsheng (produksi), 7 pesan
di kantor, dan staf tetap memakai WhatsApp. Tidak ada kode lain yang memakai
modelnya dan tidak ada foreign key dari tabel luar yang menunjuk ke sini -
sudah diperiksa di kedua server sebelum migrasi ini ditulis.

Kehadiran pengguna di Executive Dashboard dulu membaca chat_user_status;
sekarang dibaca dari audit_logs.

Revision ID: a2c4e6b8d0f3
Revises: e9a1c3b5d7f8
Create Date: 2026-11-22
"""
from alembic import op

revision = 'a2c4e6b8d0f3'
down_revision = 'e9a1c3b5d7f8'
branch_labels = None
depends_on = None


# Urutan tidak penting karena dibuang dengan CASCADE, tapi tetap ditulis dari
# yang paling bergantung ke yang paling dasar supaya terbaca jelas.
TABEL = [
    'chat_unread_messages',
    'chat_mentions',
    'chat_pinned_messages',
    'chat_reactions',
    'chat_attachments',
    'chat_threads',
    'chat_direct_messages',
    'chat_direct_conversations',
    'chat_messages',
    'chat_channel_members',
    'chat_channels',
    'chat_categories',
    'chat_server_role_members',
    'chat_server_roles',
    'chat_server_members',
    'chat_user_status',
    'chat_servers',
]


def upgrade():
    for nama in TABEL:
        op.execute(f'DROP TABLE IF EXISTS {nama} CASCADE')


def downgrade():
    # Tabelnya tidak dibangun ulang: fiturnya sudah dihapus dari kode, jadi
    # skema kosong tanpa kode yang memakainya tidak ada gunanya. Kalau suatu
    # saat obrolan dihidupkan lagi, buat migrasi baru bersama kodenya.
    pass
