"""user_signatures: digital signature image per user for printed documents

Revision ID: a4b6d8f0c2e5
Revises: f3a5c7e9b1d4
Create Date: 2026-11-03
"""
from alembic import op
import sqlalchemy as sa

revision = 'a4b6d8f0c2e5'
down_revision = 'f3a5c7e9b1d4'
branch_labels = None
depends_on = None


def upgrade():
    if 'user_signatures' in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        'user_signatures',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('file_path', sa.String(300), nullable=False),
        sa.Column('mime_type', sa.String(30), nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=True),
    )
    op.create_index('ix_user_signatures_user_id', 'user_signatures', ['user_id'], unique=True)


def downgrade():
    op.drop_table('user_signatures')
