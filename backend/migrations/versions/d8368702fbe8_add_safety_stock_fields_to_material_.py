"""Add safety stock fields to Material (safety_stock_qty, safety_stock_days, is_excluded_from_mrp)

Revision ID: d8368702fbe8
Revises: 8e6ae835419d
Create Date: 2026-08-22 07:47:44.139522

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd8368702fbe8'
down_revision = '8e6ae835419d'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('materials', schema=None) as batch_op:
        batch_op.add_column(sa.Column('safety_stock_qty', sa.Numeric(precision=15, scale=2), nullable=True))
        batch_op.add_column(sa.Column('safety_stock_days', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('is_excluded_from_mrp', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('materials', schema=None) as batch_op:
        batch_op.drop_column('is_excluded_from_mrp')
        batch_op.drop_column('safety_stock_days')
        batch_op.drop_column('safety_stock_qty')
