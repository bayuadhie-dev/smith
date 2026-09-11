"""forecast rolling calendar months (not fixed 12-slot window)

Revision ID: 2f7b6c1a9d4e
Revises: 8c1f2a9d3e4b
Create Date: 2026-08-25 16:00:00.000000

Rombak putaran 6 (keputusan manajemen): grid forecast "setahun" harus rolling ikut
tanggal hari ini (bulan ini + 11 ke depan, otomatis maju tiap bulan berganti) DAN bisa
digeser mundur buat lihat histori. qty_m1..qty_m12 (12 kolom tetap relatif ke
header.period_start) diganti forecast_line_months (1 baris per bulan KALENDER asli,
sparse, tidak dibatasi window 12 bulan). ForecastLineConversion.month (slot int) diganti
period (Date kalender asli) dengan alasan yang sama.
"""
from alembic import op
import sqlalchemy as sa

revision = '2f7b6c1a9d4e'
down_revision = '8c1f2a9d3e4b'
branch_labels = None
depends_on = None

MONTH_COLS = [f'qty_m{i}' for i in range(1, 13)]


def upgrade():
    op.create_table(
        'forecast_line_months',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('line_id', sa.Integer(), sa.ForeignKey('forecast_lines.id', ondelete='CASCADE'), nullable=False),
        sa.Column('period', sa.Date(), nullable=False),
        sa.Column('quantity', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('line_id', 'period', name='uq_forecast_line_month_line_period'),
    )

    # 1. Migrasi data qty_m1..qty_m12 (12 kolom, posisi relatif ke header.period_start) ->
    #    forecast_line_months (1 baris per bulan kalender ASLI, cuma yang qty > 0).
    case_expr = ' '.join(f"WHEN {i} THEN fl.{col}" for i, col in enumerate(MONTH_COLS, start=1))
    op.execute(f"""
        INSERT INTO forecast_line_months (line_id, period, quantity, updated_at)
        SELECT fl.id,
               (fh.period_start + ((gs.slot - 1) || ' months')::interval)::date,
               CASE gs.slot {case_expr} END,
               NOW()
        FROM forecast_lines fl
        JOIN forecast_headers fh ON fh.id = fl.header_id
        CROSS JOIN generate_series(1, 12) AS gs(slot)
        WHERE CASE gs.slot {case_expr} END > 0
    """)

    # 2. forecast_line_conversions.month (slot int) -> period (Date kalender asli)
    with op.batch_alter_table('forecast_line_conversions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('period', sa.Date(), nullable=True))
    op.execute("""
        UPDATE forecast_line_conversions flc
        SET period = (fh.period_start + ((flc.month - 1) || ' months')::interval)::date
        FROM forecast_lines fl
        JOIN forecast_headers fh ON fh.id = fl.header_id
        WHERE fl.id = flc.line_id
    """)
    with op.batch_alter_table('forecast_line_conversions', schema=None) as batch_op:
        batch_op.alter_column('period', nullable=False)
        batch_op.drop_column('month')

    # 3. Drop kolom qty_m1..qty_m12 dari forecast_lines - datanya sudah aman di
    #    forecast_line_months.
    with op.batch_alter_table('forecast_lines', schema=None) as batch_op:
        for col in MONTH_COLS:
            batch_op.drop_column(col)
        batch_op.drop_column('best_case')
        batch_op.drop_column('most_likely')
        batch_op.drop_column('worst_case')
        batch_op.drop_column('committed')


def downgrade():
    with op.batch_alter_table('forecast_lines', schema=None) as batch_op:
        for col in MONTH_COLS:
            batch_op.add_column(sa.Column(col, sa.Numeric(15, 2), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('best_case', sa.Numeric(15, 2), nullable=True))
        batch_op.add_column(sa.Column('most_likely', sa.Numeric(15, 2), nullable=True))
        batch_op.add_column(sa.Column('worst_case', sa.Numeric(15, 2), nullable=True))
        batch_op.add_column(sa.Column('committed', sa.Numeric(15, 2), nullable=True))

    for i, col in enumerate(MONTH_COLS, start=1):
        op.execute(f"""
            UPDATE forecast_lines fl SET {col} = COALESCE((
                SELECT flm.quantity FROM forecast_line_months flm
                JOIN forecast_headers fh ON fh.id = fl.header_id
                WHERE flm.line_id = fl.id
                  AND flm.period = (fh.period_start + '{i - 1} months'::interval)::date
            ), 0)
        """)

    with op.batch_alter_table('forecast_line_conversions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('month', sa.Integer(), nullable=True))
    op.execute("""
        UPDATE forecast_line_conversions flc
        SET month = EXTRACT(YEAR FROM AGE(flc.period, fh.period_start)) * 12
                     + EXTRACT(MONTH FROM AGE(flc.period, fh.period_start)) + 1
        FROM forecast_lines fl
        JOIN forecast_headers fh ON fh.id = fl.header_id
        WHERE fl.id = flc.line_id
    """)
    with op.batch_alter_table('forecast_line_conversions', schema=None) as batch_op:
        batch_op.alter_column('month', nullable=False)
        batch_op.drop_column('period')

    op.drop_table('forecast_line_months')
