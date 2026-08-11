"""add material_id and bom_level to bill_of_materials for multi-level BOM support

Revision ID: 93b93ad2c819
Revises: 9c5bd19595ae
Create Date: 2026-08-10

Context: Pak Giwa confirmed Accurate formula structure is multi-level:
Mixing (raw ingredients) -> WIP (mixing + ACC primer) -> Barang Jadi (WIP + ACC sekunder).
Mixing and WIP are materials.material_type = 'mixing'/'wip' rows, NOT products rows.
bill_of_materials.product_id was NOT NULL FK to products only, so a WIP/Mixing
output could never have its own BOM. This migration makes product_id nullable,
adds material_id (nullable FK to materials) as the alternate output reference,
adds a CHECK constraint requiring exactly one of the two to be set, and adds
bom_level to tag which tier a BOM row represents.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '93b93ad2c819'
down_revision = '9c5bd19595ae'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('bill_of_materials', schema=None) as batch_op:
        batch_op.alter_column('product_id', existing_type=sa.Integer(), nullable=True)
        batch_op.add_column(sa.Column('material_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('bom_level', sa.String(20), nullable=False,
                                       server_default='finished_goods'))
        batch_op.create_foreign_key(
            'bill_of_materials_material_id_fkey', 'materials',
            ['material_id'], ['id']
        )
        batch_op.create_check_constraint(
            'ck_bom_output_exactly_one',
            '(product_id IS NOT NULL AND material_id IS NULL) OR '
            '(product_id IS NULL AND material_id IS NOT NULL)'
        )


def downgrade():
    with op.batch_alter_table('bill_of_materials', schema=None) as batch_op:
        batch_op.drop_constraint('ck_bom_output_exactly_one', type_='check')
        batch_op.drop_constraint('bill_of_materials_material_id_fkey', type_='foreignkey')
        batch_op.drop_column('bom_level')
        batch_op.drop_column('material_id')
        batch_op.alter_column('product_id', existing_type=sa.Integer(), nullable=False)
