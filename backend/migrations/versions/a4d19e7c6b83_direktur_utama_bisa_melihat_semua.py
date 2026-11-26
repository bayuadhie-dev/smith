"""direktur utama bisa melihat modul yang selama ini tertutup

Revision ID: a4d19e7c6b83
Revises: f2c8d4a9b015
Create Date: 2026-11-26

Perannya terbalik: Direktur Utama boleh MENYETUJUI pesanan pembelian, penjualan,
dan penggajian, tapi tidak boleh MELIHAT SPK, buku besar, piutang/utang, QC,
pengiriman, perawatan, dan retur - padahal Auditor yang hanya membaca justru
bisa. Ketahuan 2026-11-26 waktu menyiapkan akun Presiden Direktur.

Yang ditambahkan hanya hak LIHAT. Hak menyetujui tidak disentuh, dan
pengelolaan pengguna/peran sengaja tidak diberikan.
"""
from alembic import op
import sqlalchemy as sa

revision = 'a4d19e7c6b83'
down_revision = 'f2c8d4a9b015'
branch_labels = None
depends_on = None

PERAN = 'Direktur Utama'
IZIN = [
    'ap.view', 'ar.view', 'journal.view',           # keuangan: utang, piutang, buku besar
    'work_orders.view', 'quality.view', 'bom.view', 'mrp.view', 'oee.view',
    'shipping.view', 'maintenance.view', 'returns.view', 'waste.view',
    'customers.view', 'suppliers.view', 'purchase_requests.view',
    'documents.view', 'attendance.view', 'leave.view', 'roster.view',
]


def upgrade():
    conn = op.get_bind()
    peran = conn.execute(sa.text('SELECT id FROM roles WHERE name = :n'), {'n': PERAN}).scalar()
    if not peran:
        return
    for nama in IZIN:
        izin = conn.execute(sa.text('SELECT id FROM permissions WHERE name = :n'), {'n': nama}).scalar()
        if not izin:
            continue
        conn.execute(sa.text(
            'INSERT INTO role_permissions (role_id, permission_id, created_at) '
            'SELECT :r, :p, NOW() WHERE NOT EXISTS ('
            '  SELECT 1 FROM role_permissions WHERE role_id = :r AND permission_id = :p)'),
            {'r': peran, 'p': izin})


def downgrade():
    conn = op.get_bind()
    peran = conn.execute(sa.text('SELECT id FROM roles WHERE name = :n'), {'n': PERAN}).scalar()
    if not peran:
        return
    conn.execute(sa.text(
        'DELETE FROM role_permissions WHERE role_id = :r AND permission_id IN '
        '(SELECT id FROM permissions WHERE name = ANY(:names))'),
        {'r': peran, 'names': IZIN})
