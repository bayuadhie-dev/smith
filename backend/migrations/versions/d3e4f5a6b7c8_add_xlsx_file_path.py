"""add xlsx_file_path to dcc_document_revisions

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-03-30 19:30:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'd3e4f5a6b7c8'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('dcc_document_revisions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('xlsx_file_path', sa.String(length=500), nullable=True))


def downgrade():
    with op.batch_alter_table('dcc_document_revisions', schema=None) as batch_op:
        batch_op.drop_column('xlsx_file_path')
