"""peran yang mengurus dokumen transaksi boleh membaca master barang dan material

Revision ID: c3e5a7b9d1f4
Revises: b2d4f6a8c0e3
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3e5a7b9d1f4'
down_revision = 'b2d4f6a8c0e3'
branch_labels = None
depends_on = None

# Peran yang boleh melihat atau membuat dokumen transaksi pasti butuh membaca
# master barang - tanpa ini daftar pilihan barang di form PO, faktur, dan surat
# jalan tampil kosong (dilaporkan Finance Fengsheng 2026-11-17: dropdown produk
# dan material di PO tidak muncul, satuan terkunci di PCS karena daftar satuan
# juga dijaga izin materials.view).
PEMICU = (
    'purchase_orders.view', 'purchase_orders.create',
    'sales_orders.view', 'sales_orders.create',
    'invoices.view', 'invoices.create',
    'finance.view', 'ap.view', 'ar.view', 'shipping.view',
)
DIBERIKAN = ('products.view', 'materials.view')


def upgrade():
    bind = op.get_bind()
    izin = {n: bind.execute(sa.text("select id from permissions where name = :n"), {'n': n}).scalar()
            for n in DIBERIKAN}
    if not all(izin.values()):
        return

    peran = bind.execute(
        sa.text("""
            select distinct r.id
            from roles r
            join role_permissions rp on rp.role_id = r.id
            join permissions p on p.id = rp.permission_id
            where p.name in :pemicu
        """).bindparams(sa.bindparam('pemicu', expanding=True)), {'pemicu': list(PEMICU)}
    ).fetchall()

    for (role_id,) in peran:
        for pid in izin.values():
            ada = bind.execute(sa.text("select 1 from role_permissions where role_id = :r and permission_id = :p"),
                               {'r': role_id, 'p': pid}).first()
            if not ada:
                bind.execute(sa.text("insert into role_permissions (role_id, permission_id, created_at) values (:r, :p, now())"),
                             {'r': role_id, 'p': pid})


def downgrade():
    pass
