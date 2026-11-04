"""drop user_signatures (digital signature feature withdrawn)

Revision ID: b5c7e9a1d3f6
Revises: a4b6d8f0c2e5
Create Date: 2026-11-04
"""
from alembic import op
import sqlalchemy as sa

revision = 'b5c7e9a1d3f6'
down_revision = 'a4b6d8f0c2e5'
branch_labels = None
depends_on = None


def upgrade():
    if 'user_signatures' in sa.inspect(op.get_bind()).get_table_names():
        op.drop_table('user_signatures')


def downgrade():
    pass
