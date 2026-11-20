"""Peran Viewer tidak lagi bisa membuka data keuangan

Daftar terbuka sejak 2026-11-13: "restrict Finance access non-Finance". Viewer
adalah peran serba-lihat untuk orang yang hanya perlu memantau operasional -
gaji, kas, dan buku besar tidak termasuk. Auditor sengaja TETAP punya
finance.view karena memeriksa angka memang tugasnya.

Aman dijalankan ulang; kalau izinnya memang sudah tidak ada, tidak terjadi apa-apa.

Revision ID: f3a5c7e9b1d2
Revises: d7b9f1c3e5a8
Create Date: 2026-11-20
"""
from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = 'f3a5c7e9b1d2'
down_revision = 'd7b9f1c3e5a8'
branch_labels = None
depends_on = None

PERMISSIONS = ('finance.view',)


def upgrade():
    bind = op.get_bind()
    for perm in PERMISSIONS:
        bind.execute(sa.text("""
            DELETE FROM role_permissions
            WHERE role_id IN (SELECT id FROM roles WHERE name = 'Viewer')
              AND permission_id IN (SELECT id FROM permissions WHERE name = :perm)
        """), {'perm': perm})


def downgrade():
    bind = op.get_bind()
    for perm in PERMISSIONS:
        row = bind.execute(sa.text(
            "SELECT r.id AS role_id, p.id AS perm_id FROM roles r, permissions p"
            " WHERE r.name = 'Viewer' AND p.name = :perm"), {'perm': perm}).fetchone()
        if not row:
            continue
        exists = bind.execute(sa.text(
            "SELECT 1 FROM role_permissions WHERE role_id = :r AND permission_id = :p"),
            {'r': row[0], 'p': row[1]}).fetchone()
        if not exists:
            # created_at NOT NULL tanpa default di tabel ini
            bind.execute(sa.text(
                "INSERT INTO role_permissions (role_id, permission_id, created_at)"
                " VALUES (:r, :p, :now)"),
                {'r': row[0], 'p': row[1], 'now': datetime.utcnow()})
