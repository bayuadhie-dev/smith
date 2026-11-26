"""rapikan izin biaya: peran pembaca tidak membuat/menghapus, penyetuju tidak menghapus

Revision ID: c6f40a1d9e52
Revises: b5e2f08c4a17
Create Date: 2026-11-26

Izin modul biaya tersemai borongan: 38 dari 39 peran memegang `expense.delete`,
termasuk Viewer, Helper Gudang, dan Auditor - yang bahkan ikut bisa membuat dan
mengubah biaya. Itu hasil penyemaian, bukan keputusan.

Yang dibereskan:
- peran pembaca (Auditor, Viewer, Guest) tidak lagi membuat/mengubah/mengajukan/
  menghapus biaya. Auditor memeriksa, tidak mencatat transaksi.
- peran penyetuju di luar keuangan tidak lagi menghapus. Yang menyetujui jangan
  bisa menghapus - aturan yang sama sudah dipakai untuk Direktur Utama.

Hak hapus sengaja TIDAK dicabut dari peran pelaksana: orang harus tetap bisa
membereskan drafnya sendiri. Penghapusan draf milik ORANG LAIN dijaga di
`routes/expense.py` - hanya pemegang `expense.payment`.
"""
from alembic import op
import sqlalchemy as sa

revision = 'c6f40a1d9e52'
down_revision = 'b5e2f08c4a17'
branch_labels = None
depends_on = None

PEMBACA = ['Auditor', 'Viewer', 'Guest']
IZIN_TULIS = ['expense.create', 'expense.edit', 'expense.submit', 'expense.delete']
PENYETUJU_NON_KEUANGAN = ['Direktur Operasional', 'Direktur HRD', 'General Manager']


def _cabut(conn, peran, izin):
    conn.execute(sa.text(
        'DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE name = ANY(:peran)) '
        'AND permission_id IN (SELECT id FROM permissions WHERE name = ANY(:izin))'),
        {'peran': peran, 'izin': izin})


def _beri(conn, peran, izin):
    conn.execute(sa.text(
        'INSERT INTO role_permissions (role_id, permission_id, created_at) '
        'SELECT r.id, p.id, NOW() FROM roles r CROSS JOIN permissions p '
        'WHERE r.name = ANY(:peran) AND p.name = ANY(:izin) AND NOT EXISTS ('
        '  SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id)'),
        {'peran': peran, 'izin': izin})


def upgrade():
    conn = op.get_bind()
    _cabut(conn, PEMBACA, IZIN_TULIS)
    _cabut(conn, PENYETUJU_NON_KEUANGAN, ['expense.delete'])


def downgrade():
    conn = op.get_bind()
    _beri(conn, PEMBACA, IZIN_TULIS)
    _beri(conn, PENYETUJU_NON_KEUANGAN, ['expense.delete'])
