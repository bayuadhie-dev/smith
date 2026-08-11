"""add material_id to warehouse stock snapshot detail

Revision ID: ebc6833df1f5
Revises: def4c63c2e9d
Create Date: 2026-08-11

Context: sync_warehouse_stock_from_item_detail() was only matching
Accurate items against SMITH products, silently skipping items that
should match against materials instead (raw materials, chemicals,
packaging - which make up most of PM warehouse stock). This adds
material_id as an alternate reference, mirroring the product_id/
material_id pattern already used elsewhere (e.g. bill_of_materials).
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'ebc6833df1f5'
down_revision = 'def4c63c2e9d'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('warehouse_stock_snapshot_detail', schema=None) as batch_op:
        batch_op.drop_constraint('uq_product_location_snapshot', type_='unique')
        batch_op.alter_column('product_id', existing_type=sa.Integer(), nullable=True)
        batch_op.add_column(sa.Column('material_id', sa.Integer(), nullable=True))
        batch_op.create_check_constraint(
            'ck_snapshot_output_exactly_one',
            '(product_id IS NOT NULL AND material_id IS NULL) OR '
            '(product_id IS NULL AND material_id IS NOT NULL)'
        )
        batch_op.create_unique_constraint(
            'uq_product_location_snapshot', ['product_id', 'smith_location_id']
        )
        batch_op.create_unique_constraint(
            'uq_material_location_snapshot', ['material_id', 'smith_location_id']
        )


def downgrade():
    with op.batch_alter_table('warehouse_stock_snapshot_detail', schema=None) as batch_op:
        batch_op.drop_constraint('uq_material_location_snapshot', type_='unique')
        batch_op.drop_constraint('uq_product_location_snapshot', type_='unique')
        batch_op.drop_constraint('ck_snapshot_output_exactly_one', type_='check')
        batch_op.drop_column('material_id')
        batch_op.alter_column('product_id', existing_type=sa.Integer(), nullable=False)
        batch_op.create_unique_constraint(
            'uq_product_location_snapshot', ['product_id', 'smith_location_id']
        )
