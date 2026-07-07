"""merge all migration branches

Revision ID: ec99c48ae7c7
Revises: add_expense_tables, 20260505_085800_add_quantity_tracking, c6e83b456f4e, wms_advanced_001
Create Date: 2026-07-07 11:30:02.637798

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ec99c48ae7c7'
down_revision = ('add_expense_tables', '20260505_085800_add_quantity_tracking', 'c6e83b456f4e', 'wms_advanced_001')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
