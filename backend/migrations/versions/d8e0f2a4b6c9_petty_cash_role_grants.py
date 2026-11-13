"""kas kecil: tambahan izin untuk nama peran yang dipakai di Fengsheng

Revision ID: d8e0f2a4b6c9
Revises: c7d9e1f3a5b8
"""
from alembic import op
import sqlalchemy as sa

revision = 'd8e0f2a4b6c9'
down_revision = 'c7d9e1f3a5b8'
branch_labels = None
depends_on = None

GRANTS = {
    'Manager HRD': ['view', 'create', 'pay', 'replenish', 'report', 'manage'],
    'Direktur HRD': ['view', 'report'],
    'Manager Finance': ['view', 'replenish_approve', 'report'],
    'Direktur Keuangan': ['view', 'replenish_approve', 'report'],
    'General Manager': ['view', 'approve', 'report'],
    'Direktur Operasional': ['view', 'approve', 'report'],
    'Manager Produksi': ['view', 'approve'],
}


def upgrade():
    bind = op.get_bind()
    for role, acts in GRANTS.items():
        rid = bind.execute(sa.text("select id from roles where name=:r"), {'r': role}).scalar()
        if not rid:
            continue
        for a in acts:
            pid = bind.execute(sa.text("select id from permissions where name=:n"), {'n': f'petty_cash.{a}'}).scalar()
            if pid and not bind.execute(sa.text("select 1 from role_permissions where role_id=:r and permission_id=:p"), {'r': rid, 'p': pid}).first():
                bind.execute(sa.text("insert into role_permissions (role_id, permission_id, created_at) values (:r, :p, now())"), {'r': rid, 'p': pid})


def downgrade():
    pass
