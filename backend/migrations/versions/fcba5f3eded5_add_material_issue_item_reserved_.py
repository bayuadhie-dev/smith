"""add_material_issue_item_reserved_quantity

Revision ID: fcba5f3eded5
Revises: ade0a5ce6fd7
Create Date: 2026-08-20 09:47:39.227557

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'fcba5f3eded5'
down_revision = 'ade0a5ce6fd7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('material_issue_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('reserved_quantity', sa.Numeric(precision=15, scale=2), nullable=True))


def downgrade():
    with op.batch_alter_table('material_issue_items', schema=None) as batch_op:
        batch_op.drop_column('reserved_quantity')
