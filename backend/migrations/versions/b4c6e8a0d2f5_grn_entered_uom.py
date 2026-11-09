"""grn_items.entered_qty / entered_uom

Revision ID: b4c6e8a0d2f5
Revises: a3b5d7f9c1e4
"""
from alembic import op
import sqlalchemy as sa

revision = 'b4c6e8a0d2f5'
down_revision = 'a3b5d7f9c1e4'
branch_labels = None
depends_on = None


def upgrade():
    cols = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('grn_items')]
    if 'entered_qty' not in cols:
        op.add_column('grn_items', sa.Column('entered_qty', sa.Numeric(15, 3), nullable=True))
    if 'entered_uom' not in cols:
        op.add_column('grn_items', sa.Column('entered_uom', sa.String(20), nullable=True))


def downgrade():
    op.drop_column('grn_items', 'entered_uom')
    op.drop_column('grn_items', 'entered_qty')
