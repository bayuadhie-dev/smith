"""products/materials: barcode, brand, dimensions, weight, batch/expiry flags (from Accurate Barang & Jasa export)

Revision ID: e6b8d0f2a4c7
Revises: d4f6b8c0e2a5
Create Date: 2026-10-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'e6b8d0f2a4c7'
down_revision = 'd4f6b8c0e2a5'
branch_labels = None
depends_on = None

COLS = [
    ('barcode', sa.String(100)), ('brand', sa.String(100)),
    ('item_length_m', sa.Numeric(10, 3)), ('item_width_m', sa.Numeric(10, 3)),
    ('item_height_m', sa.Numeric(10, 3)), ('item_weight_kg', sa.Numeric(10, 3)),
]


def upgrade():
    insp = sa.inspect(op.get_bind())
    for table in ('products', 'materials'):
        have = {c['name'] for c in insp.get_columns(table)}
        for name, typ in COLS:
            if name not in have:
                op.add_column(table, sa.Column(name, typ, nullable=True))
        for name in ('require_batch', 'require_expiry'):
            if name not in have:
                op.add_column(table, sa.Column(name, sa.Boolean(), nullable=False, server_default=sa.text('false')))
        if not any(i['name'] == f'ix_{table}_barcode' for i in insp.get_indexes(table)):
            op.create_index(f'ix_{table}_barcode', table, ['barcode'])


def downgrade():
    for table in ('products', 'materials'):
        op.drop_index(f'ix_{table}_barcode', table_name=table)
        for name in ('require_expiry', 'require_batch', 'item_weight_kg', 'item_height_m', 'item_width_m', 'item_length_m', 'brand', 'barcode'):
            op.drop_column(table, name)
