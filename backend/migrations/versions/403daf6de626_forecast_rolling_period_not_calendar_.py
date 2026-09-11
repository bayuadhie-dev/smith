"""forecast rolling period (not calendar year) - period_start + qty_m1..m12

Revision ID: 403daf6de626
Revises: 7a7dffbee3ab
Create Date: 2026-08-25 09:10:00.000000

Rombak 2026-08-25 per keputusan manajemen: ForecastHeader tidak lagi terkunci ke tahun
kalender (year Integer) - diganti period_start (Date, bisa mulai bulan apa saja, mis.
Agustus). ForecastLine.qty_jan..qty_des di-rename jadi qty_m1..qty_m12 (POSISI dalam
window 12 bulan header, bukan kalender Jan-Des lagi) - data lama dipertahankan penuh via
RENAME COLUMN, bukan drop+recreate.
"""
from alembic import op
import sqlalchemy as sa

revision = '403daf6de626'
down_revision = '7a7dffbee3ab'
branch_labels = None
depends_on = None

OLD_MONTH_COLS = ['qty_jan', 'qty_feb', 'qty_mar', 'qty_apr', 'qty_mei', 'qty_jun',
                   'qty_jul', 'qty_agu', 'qty_sep', 'qty_okt', 'qty_nov', 'qty_des']
NEW_MONTH_COLS = [f'qty_m{i}' for i in range(1, 13)]


def upgrade():
    # 1. Tambah period_start (nullable dulu supaya bisa diisi dari data year lama)
    with op.batch_alter_table('forecast_headers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('period_start', sa.Date(), nullable=True))

    # 2. Migrasi data: year -> period_start (1 Januari tahun itu). 1 pengecualian
    #    diketahui di data dev sekarang (header id=5, year=202602 - kode hack manual
    #    staf untuk merepresentasikan "Sep 26 - Aug 27" sebelum fitur ini ada, namanya
    #    sudah literally berisi itu) - diisi langsung ke bulan yang benar.
    op.execute("UPDATE forecast_headers SET period_start = make_date(year, 1, 1) WHERE year BETWEEN 1900 AND 2200")
    op.execute("UPDATE forecast_headers SET period_start = '2026-09-01' WHERE year = 202602")
    # Fallback generik kalau ada baris lain yang belum kena 2 kondisi di atas (mis. year
    # rusak/di luar rentang wajar) - jangan biarkan NULL, taruh awal tahun berjalan.
    op.execute("UPDATE forecast_headers SET period_start = make_date(EXTRACT(YEAR FROM created_at)::int, 1, 1) WHERE period_start IS NULL")

    with op.batch_alter_table('forecast_headers', schema=None) as batch_op:
        batch_op.alter_column('period_start', nullable=False)
        batch_op.drop_constraint('forecast_headers_year_key', type_='unique')
        batch_op.drop_column('year')

    # 3. Rename kolom qty_jan..qty_des -> qty_m1..qty_m12 (data ikut, bukan drop+add)
    with op.batch_alter_table('forecast_lines', schema=None) as batch_op:
        for old, new in zip(OLD_MONTH_COLS, NEW_MONTH_COLS):
            batch_op.alter_column(old, new_column_name=new)


def downgrade():
    with op.batch_alter_table('forecast_lines', schema=None) as batch_op:
        for old, new in zip(OLD_MONTH_COLS, NEW_MONTH_COLS):
            batch_op.alter_column(new, new_column_name=old)

    with op.batch_alter_table('forecast_headers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('year', sa.Integer(), nullable=True))

    op.execute("UPDATE forecast_headers SET year = EXTRACT(YEAR FROM period_start)::int")

    with op.batch_alter_table('forecast_headers', schema=None) as batch_op:
        batch_op.alter_column('year', nullable=False)
        batch_op.create_unique_constraint('forecast_headers_year_key', ['year'])
        batch_op.drop_column('period_start')
