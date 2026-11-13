"""shipping_items: product_id boleh kosong + description (surat jalan tanpa SO: jasa/lainnya)

Revision ID: b6c8d0e2f4a7
Revises: a5b7c9d1e3f6
"""
from alembic import op
import sqlalchemy as sa

revision = 'b6c8d0e2f4a7'
down_revision = 'a5b7c9d1e3f6'
branch_labels = None
depends_on = None


def upgrade():
    have = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('shipping_items')]
    if 'description' not in have:
        op.add_column('shipping_items', sa.Column('description', sa.String(500), nullable=True))
    op.alter_column('shipping_items', 'product_id', existing_type=sa.Integer(), nullable=True)


def downgrade():
    op.alter_column('shipping_items', 'product_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('shipping_items', 'description')
