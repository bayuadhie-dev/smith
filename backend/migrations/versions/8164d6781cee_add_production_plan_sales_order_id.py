"""add_production_plan_sales_order_id

Revision ID: 8164d6781cee
Revises: fcba5f3eded5
Create Date: 2026-08-20 11:41:19.900816

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '8164d6781cee'
down_revision = 'fcba5f3eded5'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('production_plans', schema=None) as batch_op:
        batch_op.add_column(sa.Column('sales_order_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(None, 'sales_orders', ['sales_order_id'], ['id'])


def downgrade():
    with op.batch_alter_table('production_plans', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.drop_column('sales_order_id')
