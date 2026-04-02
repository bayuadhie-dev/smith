"""Add push_subscriptions table for Web Push notifications

Revision ID: c2d3e4f5a6b7
Revises: b1c3f4e5a6d7
Create Date: 2026-03-29

"""
from alembic import op
import sqlalchemy as sa

revision = 'c2d3e4f5a6b7'
down_revision = 'b1c3f4e5a6d7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('push_subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('endpoint', sa.Text(), nullable=False),
        sa.Column('p256dh', sa.String(length=200), nullable=False),
        sa.Column('auth', sa.String(length=200), nullable=False),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'endpoint', name='unique_user_endpoint')
    )


def downgrade():
    op.drop_table('push_subscriptions')
