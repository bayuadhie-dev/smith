"""add so_bumped_at to forecast_line_months

Keterangan visual di grid Forecast (masukan user 2026-08-26): saat target sebuah sel
forecast dinaikkan otomatis oleh _bump_forecast_for_so_item() (SO real melampaui target),
PPIC perlu tahu angka itu bukan input manual - jadi ditandai timestamp kapan terakhir
di-bump. Ditandai None lagi kalau user edit manual cell itu (lihat update_forecast_line
di routes/sales.py) - manual override menghapus tanda "otomatis".

Revision ID: b3c8e2f6a1d4
Revises: 9d3e7a1f5c82
Create Date: 2026-08-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'b3c8e2f6a1d4'
down_revision = '9d3e7a1f5c82'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('forecast_line_months', sa.Column('so_bumped_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('forecast_line_months', 'so_bumped_at')
