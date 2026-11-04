"""record_attachments (lampiran generik transaksi)

Revision ID: d7e9a1c3f5b8
Revises: c6d8f0b2e4a7
Create Date: 2026-11-04
"""
from alembic import op
import sqlalchemy as sa

revision = 'd7e9a1c3f5b8'
down_revision = 'c6d8f0b2e4a7'
branch_labels = None
depends_on = None


def upgrade():
    if 'record_attachments' in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        'record_attachments',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.Integer, nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('stored_name', sa.String(255), nullable=False),
        sa.Column('mime_type', sa.String(100)),
        sa.Column('file_size', sa.Integer),
        sa.Column('description', sa.String(255)),
        sa.Column('uploaded_by', sa.Integer, sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime, nullable=False),
    )
    op.create_index('ix_record_attachments_entity', 'record_attachments', ['entity_type', 'entity_id'])


def downgrade():
    op.drop_table('record_attachments')
