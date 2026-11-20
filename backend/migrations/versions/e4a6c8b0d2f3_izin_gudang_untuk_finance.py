"""Peran keuangan boleh melihat stok gudang

Finance membuka "Barang per Gudang" untuk mencocokkan nilai persediaan dengan
barang yang benar-benar ada, tapi halaman itu dijaga izin inventory.view dan
warehouse.view yang tidak dimiliki satu pun peran keuangan - jadi selalu ditolak.
Hanya izin BACA yang diberikan; membuat dan mengubah stok tetap milik gudang.

Revision ID: e4a6c8b0d2f3
Revises: d2f4b6a8c0e1
Create Date: 2026-11-20
"""
from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = 'e4a6c8b0d2f3'
down_revision = 'd2f4b6a8c0e1'
branch_labels = None
depends_on = None

PERAN = ('Manager Finance', 'Finance Staff', 'Direktur Keuangan', 'Direktur Utama')
IZIN = ('inventory.view', 'warehouse.view')


def upgrade():
    bind = op.get_bind()
    ditambah = 0
    for nama_peran in PERAN:
        peran = bind.execute(sa.text("SELECT id FROM roles WHERE name = :n"), {'n': nama_peran}).fetchone()
        if not peran:
            continue
        for nama_izin in IZIN:
            izin = bind.execute(sa.text("SELECT id FROM permissions WHERE name = :n"), {'n': nama_izin}).fetchone()
            if not izin:
                continue
            ada = bind.execute(sa.text(
                "SELECT 1 FROM role_permissions WHERE role_id = :r AND permission_id = :p"),
                {'r': peran[0], 'p': izin[0]}).fetchone()
            if ada:
                continue
            # created_at NOT NULL tanpa default di tabel ini
            bind.execute(sa.text(
                "INSERT INTO role_permissions (role_id, permission_id, created_at)"
                " VALUES (:r, :p, :now)"),
                {'r': peran[0], 'p': izin[0], 'now': datetime.utcnow()})
            ditambah += 1
    print(f'  izin gudang untuk peran keuangan ditambahkan: {ditambah}')


def downgrade():
    bind = op.get_bind()
    bind.execute(sa.text("""
        DELETE FROM role_permissions
        WHERE role_id IN (SELECT id FROM roles WHERE name IN :peran)
          AND permission_id IN (SELECT id FROM permissions WHERE name IN :izin)
    """).bindparams(sa.bindparam('peran', expanding=True), sa.bindparam('izin', expanding=True)),
        {'peran': list(PERAN), 'izin': list(IZIN)})
