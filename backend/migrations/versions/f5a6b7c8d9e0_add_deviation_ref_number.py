"""add deviation_ref_number to capa_requests

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-03-31 12:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f5a6b7c8d9e0'
down_revision = 'e4f5a6b7c8d9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('dcc_capa_requests', sa.Column('deviation_ref_number', sa.String(50), nullable=True))


def downgrade():
    op.drop_column('dcc_capa_requests', 'deviation_ref_number')
