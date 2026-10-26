"""credit memo applications can be reversed

Revision ID: c5e7a9b1d3f2
Revises: b4d6f8a1c3e5
Create Date: 2026-10-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'c5e7a9b1d3f2'
down_revision = 'b4d6f8a1c3e5'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('credit_memo_applications', sa.Column('reversed_at', sa.DateTime(), nullable=True))
    op.add_column('credit_memo_applications', sa.Column('reversed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))


def downgrade():
    op.drop_column('credit_memo_applications', 'reversed_by')
    op.drop_column('credit_memo_applications', 'reversed_at')
