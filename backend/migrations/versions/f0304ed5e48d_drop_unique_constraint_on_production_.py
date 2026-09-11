"""drop unique constraint on production_recipes product_id+machine_id

Revision ID: f0304ed5e48d
Revises: 79f502aae1ce
Create Date: 2026-08-24 11:26:57.092658

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f0304ed5e48d'
down_revision = '79f502aae1ce'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('production_recipes', schema=None) as batch_op:
        batch_op.drop_constraint('uq_production_recipe_product_machine', type_='unique')


def downgrade():
    with op.batch_alter_table('production_recipes', schema=None) as batch_op:
        batch_op.create_unique_constraint('uq_production_recipe_product_machine', ['product_id', 'machine_id'])
