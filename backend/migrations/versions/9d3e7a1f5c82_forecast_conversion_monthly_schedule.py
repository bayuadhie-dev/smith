"""forecast conversion -> monthly schedule (not direct work order)

Revision ID: 9d3e7a1f5c82
Revises: 2f7b6c1a9d4e
Create Date: 2026-08-26 10:00:00.000000

Rombak putaran 7 (keputusan manajemen): forecast TIDAK lagi langsung jadi Work Order -
dikirim ke Monthly Schedule (routes/schedule_grid.py) dulu supaya PPIC review & pecah ke
Weekly Planning sebelum WO beneran terbit. ForecastLineConversion dapat kolom baru
`monthly_schedule_id` (nullable) - baris LAMA (sales_order_id/work_order_id) tidak
disentuh, CheckConstraint diperluas jadi "tepat 1 dari 3 kolom terisi".
"""
from alembic import op
import sqlalchemy as sa

revision = '9d3e7a1f5c82'
down_revision = '2f7b6c1a9d4e'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('forecast_line_conversions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('monthly_schedule_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_forecast_line_conversions_monthly_schedule', 'monthly_schedules', ['monthly_schedule_id'], ['id'])
        batch_op.drop_constraint('check_forecast_conversion_so_or_wo', type_='check')
        batch_op.create_check_constraint(
            'check_forecast_conversion_so_or_wo',
            '(CASE WHEN sales_order_id IS NOT NULL THEN 1 ELSE 0 END + '
            'CASE WHEN work_order_id IS NOT NULL THEN 1 ELSE 0 END + '
            'CASE WHEN monthly_schedule_id IS NOT NULL THEN 1 ELSE 0 END) = 1'
        )


def downgrade():
    with op.batch_alter_table('forecast_line_conversions', schema=None) as batch_op:
        batch_op.drop_constraint('check_forecast_conversion_so_or_wo', type_='check')
        batch_op.create_check_constraint(
            'check_forecast_conversion_so_or_wo',
            '(sales_order_id IS NOT NULL AND work_order_id IS NULL) OR (sales_order_id IS NULL AND work_order_id IS NOT NULL)'
        )
        batch_op.drop_constraint('fk_forecast_line_conversions_monthly_schedule', type_='foreignkey')
        batch_op.drop_column('monthly_schedule_id')
