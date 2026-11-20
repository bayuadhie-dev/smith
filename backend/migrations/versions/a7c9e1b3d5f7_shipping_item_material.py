"""Surat jalan boleh memuat material (waste, drum bekas), bukan hanya produk jadi

Sebelum ini baris seperti "WASTE DRUM" hanya bisa ditulis sebagai keterangan
bebas tanpa product_id - stoknya tidak pernah berkurang dan nilainya tidak
pernah masuk HPP. Sekarang barisnya boleh menunjuk material, dan pengurangan
stoknya memakai jalur FIFO yang sama dengan produk.

Revision ID: a7c9e1b3d5f7
Revises: f3a5c7e9b1d2
Create Date: 2026-11-20
"""
from alembic import op
import sqlalchemy as sa

revision = 'a7c9e1b3d5f7'
down_revision = 'f3a5c7e9b1d2'
branch_labels = None
depends_on = None


def upgrade():
    cols = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('shipping_items')}
    if 'material_id' not in cols:
        with op.batch_alter_table('shipping_items') as batch:
            batch.add_column(sa.Column('material_id', sa.Integer(), nullable=True))
            batch.create_foreign_key('fk_shipping_items_material', 'materials', ['material_id'], ['id'])


def downgrade():
    with op.batch_alter_table('shipping_items') as batch:
        batch.drop_constraint('fk_shipping_items_material', type_='foreignkey')
        batch.drop_column('material_id')
