"""approval_email_tokens (tautan approve/reject lewat email)

Revision ID: e8f0a2c4d6b9
Revises: d7e9a1c3f5b8
Create Date: 2026-11-05
"""
from alembic import op
import sqlalchemy as sa

revision = 'e8f0a2c4d6b9'
down_revision = 'd7e9a1c3f5b8'
branch_labels = None
depends_on = None


def upgrade():
    if 'approval_email_tokens' in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        'approval_email_tokens',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('token_hash', sa.String(64), nullable=False),
        sa.Column('workflow_id', sa.Integer, sa.ForeignKey('approval_workflows.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('step', sa.String(20), nullable=False),
        sa.Column('expires_at', sa.DateTime, nullable=False),
        sa.Column('used_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, nullable=False),
    )
    op.create_index('ix_approval_email_tokens_token_hash', 'approval_email_tokens', ['token_hash'], unique=True)
    op.create_index('ix_approval_email_tokens_workflow_id', 'approval_email_tokens', ['workflow_id'])


def downgrade():
    op.drop_table('approval_email_tokens')
