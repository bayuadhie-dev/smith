"""add weight_gross_kg to packing_list_new_items

Revision ID: 3aa83aa50d11
Revises: add_converting_speed_cols
Create Date: 2026-07-24 15:07:36.457037

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3aa83aa50d11'
down_revision = 'add_converting_speed_cols'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('packing_list_new_items', sa.Column('weight_gross_kg', sa.Numeric(10, 3), nullable=True))


def downgrade():
    op.drop_column('packing_list_new_items', 'weight_gross_kg')
