"""izin baru: siapa yang boleh melihat angka rupiah di dasbor utama

Revision ID: d8b26f3c91a4
Revises: c6f40a1d9e52
Create Date: 2026-11-26

Angka rupiah di dasbor utama selama ini ikut izin `<modul>.view` - yang dipegang
hampir semua peran. Akibatnya nilai stok fisik terbaca sampai helper gudang dan
operator forklift (21 peran), omzet dan piutang terbaca staf PPIC (12 peran).

`dashboard.finance` dipakai untuk uang lintas perusahaan (saldo kas, piutang
usaha, utang usaha). Uang milik satu modul (omzet, nilai stok, utang jatuh
tempo) cukup dengan hak keputusan di modul itu - lihat routes/dashboard.py.
"""
from alembic import op
import sqlalchemy as sa

revision = 'd8b26f3c91a4'
down_revision = 'c6f40a1d9e52'
branch_labels = None
depends_on = None

IZIN = 'dashboard.finance'
PENERIMA = ['Super Admin', 'Direktur Utama', 'Direktur Keuangan', 'Direktur Operasional',
            'General Manager', 'Manager Finance', 'Finance Staff', 'Auditor']


def upgrade():
    conn = op.get_bind()
    conn.execute(sa.text(
        "INSERT INTO permissions (name, resource, module, action, description, is_active, created_at) "
        "SELECT :n, 'dashboard', 'Dashboard', 'finance', "
        "'Melihat angka rupiah di dasbor utama (kas, piutang, utang)', true, NOW() "
        "WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = :n)"), {'n': IZIN})
    conn.execute(sa.text(
        'INSERT INTO role_permissions (role_id, permission_id, created_at) '
        'SELECT r.id, p.id, NOW() FROM roles r CROSS JOIN permissions p '
        'WHERE r.name = ANY(:peran) AND p.name = :izin AND NOT EXISTS ('
        '  SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id)'),
        {'peran': PENERIMA, 'izin': IZIN})


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text('DELETE FROM role_permissions WHERE permission_id IN '
                         '(SELECT id FROM permissions WHERE name = :n)'), {'n': IZIN})
    conn.execute(sa.text('DELETE FROM permissions WHERE name = :n'), {'n': IZIN})
