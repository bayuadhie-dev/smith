"""add target_speed and actual_speed to converting_productions

Revision ID: add_converting_speed_cols
Revises: ec99c48ae7c7
Create Date: 2026-07-07

Catatan:
- Kedua kolom nullable karena hanya relevan untuk mesin Bagmaker & Laminasi.
- target_speed: kecepatan target yang diinput operator saat membuat laporan shift.
- actual_speed: kecepatan aktual yang dicapai, juga diinput manual oleh operator.
- Satuan: pcs/menit (konsisten dengan ConvertingMachine.default_speed).
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_converting_speed_cols'
down_revision = 'ec99c48ae7c7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'converting_productions',
        sa.Column('target_speed', sa.Integer(), nullable=True)
    )
    op.add_column(
        'converting_productions',
        sa.Column('actual_speed', sa.Integer(), nullable=True)
    )


def downgrade():
    op.drop_column('converting_productions', 'actual_speed')
    op.drop_column('converting_productions', 'target_speed')
