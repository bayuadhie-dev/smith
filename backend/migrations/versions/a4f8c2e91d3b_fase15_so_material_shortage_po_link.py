"""Fase 15 (fix_report_3.md, 2026-10-02): kolom baru untuk alur "SO tetap
jalan walau bahan baku kurang, tapi dapat keterangan estimasi kedatangan
dari PR/PO yang di-auto-create".

- sales_orders.material_shortage_note (Text, nullable) - ringkasan
  kekurangan bahan baku per material, diisi otomatis saat confirm_order_core()
  mendeteksi shortage (MRP check baru).
- sales_orders.material_eta_date (Date, nullable) - estimasi kedatangan
  bahan baku, diisi MANUAL oleh admin purchasing lewat PUT /sales/orders/<id>
  setelah PR/PO diproses - bukan otomatis.
- purchase_requisitions.sales_order_id (FK ke sales_orders.id, nullable) -
  traceability PR -> SO asal, supaya admin purchasing tahu PR mana yang
  terkait shortage SO mana.

Revision ID: a4f8c2e91d3b
Revises: 90875b1449f6
Create Date: 2026-10-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'a4f8c2e91d3b'
down_revision = '90875b1449f6'
branch_labels = None
depends_on = None


def _has_column(bind, table_name, column_name):
    inspector = sa.inspect(bind)
    return column_name in [c['name'] for c in inspector.get_columns(table_name)]


def upgrade():
    bind = op.get_bind()

    with op.batch_alter_table('sales_orders', schema=None) as batch_op:
        if not _has_column(bind, 'sales_orders', 'material_shortage_note'):
            batch_op.add_column(sa.Column('material_shortage_note', sa.Text(), nullable=True))
        if not _has_column(bind, 'sales_orders', 'material_eta_date'):
            batch_op.add_column(sa.Column('material_eta_date', sa.Date(), nullable=True))

    with op.batch_alter_table('purchase_requisitions', schema=None) as batch_op:
        if not _has_column(bind, 'purchase_requisitions', 'sales_order_id'):
            batch_op.add_column(sa.Column('sales_order_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                'fk_pr_sales_order_id', 'sales_orders', ['sales_order_id'], ['id'],
            )


def downgrade():
    bind = op.get_bind()

    with op.batch_alter_table('purchase_requisitions', schema=None) as batch_op:
        if _has_column(bind, 'purchase_requisitions', 'sales_order_id'):
            batch_op.drop_constraint('fk_pr_sales_order_id', type_='foreignkey')
            batch_op.drop_column('sales_order_id')

    with op.batch_alter_table('sales_orders', schema=None) as batch_op:
        if _has_column(bind, 'sales_orders', 'material_eta_date'):
            batch_op.drop_column('material_eta_date')
        if _has_column(bind, 'sales_orders', 'material_shortage_note'):
            batch_op.drop_column('material_shortage_note')
