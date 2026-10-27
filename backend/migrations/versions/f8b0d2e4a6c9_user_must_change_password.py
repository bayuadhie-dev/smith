"""users.must_change_password (force new password at first login for admin-created users)

Revision ID: f8b0d2e4a6c9
Revises: e7a9c1d3f5b8
Create Date: 2026-10-27
"""
from alembic import op
import sqlalchemy as sa

revision = 'f8b0d2e4a6c9'
down_revision = 'e7a9c1d3f5b8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('must_change_password', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade():
    op.drop_column('users', 'must_change_password')
