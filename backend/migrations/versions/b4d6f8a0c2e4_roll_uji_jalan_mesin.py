"""Roll hasil uji jalan mesin boleh tanpa SPK

Produksi 2026-11-18 memutuskan SPK wajib mutlak untuk setiap roll. 2026-11-24
mereka menambahkan kekecualiannya: uji jalan mesin memakai bahan tidak sedikit
dan kainnya tetap jadi - bisa dijual - padahal job order-nya memang belum ada.
Penanda ini yang membedakan "sengaja tanpa SPK" dari "lupa mengisi SPK".

Revision ID: b4d6f8a0c2e4
Revises: a2c4e6b8d0f3
"""
import sqlalchemy as sa
from alembic import op

revision = 'b4d6f8a0c2e4'
down_revision = 'a2c4e6b8d0f3'
branch_labels = None
depends_on = None


def upgrade():
    kolom = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('production_rolls')}
    if 'is_trial' not in kolom:
        op.add_column('production_rolls',
                      sa.Column('is_trial', sa.Boolean(), nullable=False, server_default='0'))


def downgrade():
    kolom = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('production_rolls')}
    if 'is_trial' in kolom:
        op.drop_column('production_rolls', 'is_trial')
