"""grn_items.item_name

Revision ID: f2a4c6e8b0d3
Revises: e1f3a5c7b9d2
"""
from alembic import op
import sqlalchemy as sa

revision = 'f2a4c6e8b0d3'
down_revision = 'e1f3a5c7b9d2'
branch_labels = None
depends_on = None


def upgrade():
    cols = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('grn_items')]
    if 'item_name' not in cols:
        op.add_column('grn_items', sa.Column('item_name', sa.String(255), nullable=True))


def downgrade():
    op.drop_column('grn_items', 'item_name')
