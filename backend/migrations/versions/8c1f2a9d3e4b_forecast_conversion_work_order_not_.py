"""forecast conversion -> work order (not sales order)

Revision ID: 8c1f2a9d3e4b
Revises: 403daf6de626
Create Date: 2026-08-25 14:00:00.000000

Rombak putaran 5 (keputusan manajemen): forecast di-convert jadi Work Order (produksi
build-ahead), bukan Sales Order lagi - forecast itu agregat semua customer, SO/customer
riil baru muncul dari Manual/Quotation. ForecastLineConversion.sales_order_id dibuat
nullable (baris lama tetap tertaut ke SO), tambah work_order_id nullable - tepat 1 dari
keduanya harus terisi per baris (CheckConstraint).
"""
from alembic import op
import sqlalchemy as sa

revision = '8c1f2a9d3e4b'
down_revision = '403daf6de626'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('forecast_line_conversions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('work_order_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_forecast_line_conversions_work_order', 'work_orders', ['work_order_id'], ['id'])
        batch_op.alter_column('sales_order_id', nullable=True)
        batch_op.create_check_constraint(
            'check_forecast_conversion_so_or_wo',
            '(sales_order_id IS NOT NULL AND work_order_id IS NULL) OR (sales_order_id IS NULL AND work_order_id IS NOT NULL)'
        )


def downgrade():
    with op.batch_alter_table('forecast_line_conversions', schema=None) as batch_op:
        batch_op.drop_constraint('check_forecast_conversion_so_or_wo', type_='check')
        batch_op.alter_column('sales_order_id', nullable=False)
        batch_op.drop_constraint('fk_forecast_line_conversions_work_order', type_='foreignkey')
        batch_op.drop_column('work_order_id')
