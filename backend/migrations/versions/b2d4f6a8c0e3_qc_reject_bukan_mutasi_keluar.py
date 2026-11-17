"""mutasi QC penerimaan: perpindahan ke/dari karantina ditandai transfer, bukan penyesuaian

Revision ID: b2d4f6a8c0e3
Revises: a1c3e5f7b9d4
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2d4f6a8c0e3'
down_revision = 'a1c3e5f7b9d4'
branch_labels = None
depends_on = None

# Pasangan baris dari satu inspeksi GRN: sisi gudang terima ('grn_inspection') dan
# sisi karantina ('grn_inspection_reject'). Kalau jumlahnya sama dan arahnya
# berlawanan, itu cuma barang pindah lokasi - bukan barang masuk atau keluar.
PASANGAN = """
    select a.id as id_a, b.id as id_b, a.direction as arah_a, b.direction as arah_b
    from inventory_transactions a
    join inventory_transactions b
      on b.reference_id = a.reference_id
     and coalesce(b.batch_number, '') = coalesce(a.batch_number, '')
     and coalesce(b.product_id, 0) = coalesce(a.product_id, 0)
     and coalesce(b.material_id, 0) = coalesce(a.material_id, 0)
     and abs(b.quantity - a.quantity) < 0.0001
     and b.direction <> a.direction
     and b.reference_type = 'grn_inspection_reject'
    where a.reference_type = 'grn_inspection'
      and a.transaction_type = 'adjustment'
      and b.transaction_type = 'adjustment'
"""


def upgrade():
    bind = op.get_bind()
    rows = bind.execute(sa.text(PASANGAN)).fetchall()
    for id_a, id_b, arah_a, arah_b in rows:
        for tid, arah in ((id_a, arah_a), (id_b, arah_b)):
            bind.execute(sa.text("update inventory_transactions set transaction_type = :t where id = :i"),
                         {'t': 'transfer_in' if arah == 'in' else 'transfer_out', 'i': tid})


def downgrade():
    op.get_bind().execute(sa.text("""
        update inventory_transactions set transaction_type = 'adjustment'
        where reference_type in ('grn_inspection', 'grn_inspection_reject')
          and transaction_type in ('transfer_in', 'transfer_out')
    """))
