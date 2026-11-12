"""work_orders: parent_wo_id + package_role (paket Ingredient/WIP/WASTE)

Revision ID: a5b7c9d1e3f6
Revises: f4a6b8c0d2e5
"""
from alembic import op
import sqlalchemy as sa

revision = 'a5b7c9d1e3f6'
down_revision = 'f4a6b8c0d2e5'
branch_labels = None
depends_on = None


def upgrade():
    have = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('work_orders')]
    if 'parent_wo_id' not in have:
        op.add_column('work_orders', sa.Column('parent_wo_id', sa.Integer(), sa.ForeignKey('work_orders.id'), nullable=True))
    if 'package_role' not in have:
        op.add_column('work_orders', sa.Column('package_role', sa.String(20), nullable=True))


def downgrade():
    op.drop_column('work_orders', 'package_role')
    op.drop_column('work_orders', 'parent_wo_id')
