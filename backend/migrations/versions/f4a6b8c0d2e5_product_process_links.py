"""products: tautan Ingredient/WIP/WIPC/WIPP/WASTE per FG

Revision ID: f4a6b8c0d2e5
Revises: e3f5a7b9c1d4
"""
from alembic import op
import sqlalchemy as sa

revision = 'f4a6b8c0d2e5'
down_revision = 'e3f5a7b9c1d4'
branch_labels = None
depends_on = None
COLS = ['ingredient_product_id', 'wip_product_id', 'wipc_product_id', 'wipp_product_id', 'waste_product_id']


def upgrade():
    have = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('products')]
    for c in COLS:
        if c not in have:
            op.add_column('products', sa.Column(c, sa.Integer(), sa.ForeignKey('products.id'), nullable=True))


def downgrade():
    for c in COLS:
        op.drop_column('products', c)
