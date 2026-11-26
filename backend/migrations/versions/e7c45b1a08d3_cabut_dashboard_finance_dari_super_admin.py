"""cabut dashboard.finance dari peran Super Admin

Revision ID: e7c45b1a08d3
Revises: d8b26f3c91a4
Create Date: 2026-11-26

Akun super admin lebih dari satu (`admin` milik pemilik sistem dan
`internalaudit`). Pemilik minta angka rupiah di dasbor utama hanya terbuka untuk
akun `admin`, bukan untuk setiap akun berstatus super admin. Akun `admin`
dikenali di kode (utils/pemilik.py), jadi izin di peran ini tidak diperlukan -
dan selama masih menempel, super admin lain ikut melihat angkanya.

Peran lain yang menerima izin ini (Direksi, Finance, Auditor) tidak disentuh.
"""
from alembic import op
import sqlalchemy as sa

revision = 'e7c45b1a08d3'
down_revision = 'd8b26f3c91a4'
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().execute(sa.text(
        'DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE name = :peran) '
        'AND permission_id IN (SELECT id FROM permissions WHERE name = :izin)'),
        {'peran': 'Super Admin', 'izin': 'dashboard.finance'})


def downgrade():
    op.get_bind().execute(sa.text(
        'INSERT INTO role_permissions (role_id, permission_id, created_at) '
        'SELECT r.id, p.id, NOW() FROM roles r CROSS JOIN permissions p '
        'WHERE r.name = :peran AND p.name = :izin AND NOT EXISTS ('
        '  SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id)'),
        {'peran': 'Super Admin', 'izin': 'dashboard.finance'})
