"""notification_preferences

Revision ID: b2d4f6a8c0e1
Revises: a1c3e5f7b9d2
Create Date: 2026-11-07
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2d4f6a8c0e1'
down_revision = 'a1c3e5f7b9d2'
branch_labels = None
depends_on = None


def upgrade():
    if 'notification_preferences' in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        'notification_preferences',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_key', sa.String(50), nullable=False),
        sa.Column('in_app', sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column('email', sa.Boolean, nullable=False, server_default=sa.true()),
        sa.UniqueConstraint('user_id', 'event_key', name='unique_user_event_pref'),
    )
    op.create_index('ix_notification_preferences_user_id', 'notification_preferences', ['user_id'])


def downgrade():
    op.drop_table('notification_preferences')
