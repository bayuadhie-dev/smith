"""pr_items.preferred_supplier_name

Revision ID: e7f9b1d3a5c8
Revises: d6e8a0c2f4b7
"""
from alembic import op
import sqlalchemy as sa

revision = 'e7f9b1d3a5c8'
down_revision = 'd6e8a0c2f4b7'
branch_labels = None
depends_on = None


def upgrade():
    cols = [c['name'] for c in sa.inspect(op.get_bind()).get_columns('pr_items')]
    if 'preferred_supplier_name' not in cols:
        op.add_column('pr_items', sa.Column('preferred_supplier_name', sa.String(200), nullable=True))


def downgrade():
    op.drop_column('pr_items', 'preferred_supplier_name')
