"""cabut hak hapus biaya dari direktur utama

Revision ID: b5e2f08c4a17
Revises: a4d19e7c6b83
Create Date: 2026-11-26

Keputusan pemilik sistem 2026-11-26: yang menyetujui biaya tidak perlu bisa
menghapusnya. Hak lainnya (buat, ubah, ajukan, setujui, bayar, lihat) tetap.
"""
from alembic import op
import sqlalchemy as sa

revision = 'b5e2f08c4a17'
down_revision = 'a4d19e7c6b83'
branch_labels = None
depends_on = None

PERAN = 'Direktur Utama'
IZIN = 'expense.delete'


def _pasangan(conn):
    peran = conn.execute(sa.text('SELECT id FROM roles WHERE name = :n'), {'n': PERAN}).scalar()
    izin = conn.execute(sa.text('SELECT id FROM permissions WHERE name = :n'), {'n': IZIN}).scalar()
    return peran, izin


def upgrade():
    conn = op.get_bind()
    peran, izin = _pasangan(conn)
    if peran and izin:
        conn.execute(sa.text('DELETE FROM role_permissions WHERE role_id = :r AND permission_id = :p'),
                     {'r': peran, 'p': izin})


def downgrade():
    conn = op.get_bind()
    peran, izin = _pasangan(conn)
    if peran and izin:
        conn.execute(sa.text(
            'INSERT INTO role_permissions (role_id, permission_id, created_at) '
            'SELECT :r, :p, NOW() WHERE NOT EXISTS ('
            '  SELECT 1 FROM role_permissions WHERE role_id = :r AND permission_id = :p)'),
            {'r': peran, 'p': izin})
