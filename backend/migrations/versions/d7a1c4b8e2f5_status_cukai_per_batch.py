"""status cukai per batch di baris penerimaan

Revision ID: d7a1c4b8e2f5
Revises: c5e7f9b1d3a6
Create Date: 2026-11-26

Bea Cukai membaca kartu pengawasan per batch, jadi status cukainya ikut batch -
bukan satu kalimat untuk seluruh barang.
"""
from alembic import op
import sqlalchemy as sa

revision = 'd7a1c4b8e2f5'
down_revision = 'c5e7f9b1d3a6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('grn_items') as b:
        b.add_column(sa.Column('cukai_status', sa.String(length=80), nullable=True))
        b.add_column(sa.Column('cukai_dokumen', sa.String(length=100), nullable=True))


def downgrade():
    with op.batch_alter_table('grn_items') as b:
        b.drop_column('cukai_dokumen')
        b.drop_column('cukai_status')
