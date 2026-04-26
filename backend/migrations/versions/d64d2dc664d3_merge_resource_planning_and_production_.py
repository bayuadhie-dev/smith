"""merge resource planning and production planning

Revision ID: d64d2dc664d3
Revises: 1c1f2404c557, add_resource_planning
Create Date: 2025-11-06 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd64d2dc664d3'
down_revision = ('1c1f2404c557', 'add_resource_planning')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
