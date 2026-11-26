"""tarif cukai per batch di baris penerimaan

Revision ID: e9b3f6c1a7d2
Revises: d7a1c4b8e2f5
Create Date: 2026-11-26

Tarifnya ikut batch, bukan satu angka untuk semuanya: waktu tarif cukai naik,
kartu batch lama harus tetap memakai tarif yang berlaku saat barangnya masuk.
"""
from alembic import op
import sqlalchemy as sa

revision = 'e9b3f6c1a7d2'
down_revision = 'd7a1c4b8e2f5'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('grn_items') as b:
        b.add_column(sa.Column('cukai_tarif', sa.Numeric(precision=15, scale=2), nullable=True))


def downgrade():
    with op.batch_alter_table('grn_items') as b:
        b.drop_column('cukai_tarif')
