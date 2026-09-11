"""add DowntimeKeyword model (no-op, fixes recurring Alembic warning)

Revision ID: 5c6128c0236f
Revises: 4d8fab0a40f2
Create Date: 2026-08-16 16:38:43.941319

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5c6128c0236f'
down_revision = '4d8fab0a40f2'
branch_labels = None
depends_on = None


def upgrade():
    # No-op: this migration originally auto-detected a drop of
    # idx_downtime_keywords_keyword_lower (a functional unique index on
    # LOWER(keyword)) because SQLAlchemy's autogenerate can't represent
    # functional indexes from a plain model class. That index is load-
    # bearing (prevents duplicate keywords differing only by case) and
    # must NOT be dropped - stripped out manually, see routes/keyword_manager.py
    # for where it's actually created via raw SQL.
    pass


def downgrade():
    pass
