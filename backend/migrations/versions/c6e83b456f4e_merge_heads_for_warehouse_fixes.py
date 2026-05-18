"""Merge heads for warehouse fixes

Revision ID: c6e83b456f4e
Revises: 7889c902bbc1, a028bf07f288
Create Date: 2026-05-05 08:57:43.680670

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c6e83b456f4e'
down_revision = ('7889c902bbc1', 'a028bf07f288')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
