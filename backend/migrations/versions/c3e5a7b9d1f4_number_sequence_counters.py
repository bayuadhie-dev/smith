"""number_sequence_counters table (model existed without a migration; missing on fresh databases)

Revision ID: c3e5a7b9d1f4
Revises: b2d4f6a8c1e3
Create Date: 2026-10-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3e5a7b9d1f4'
down_revision = 'b2d4f6a8c1e3'
branch_labels = None
depends_on = None


def upgrade():
    if sa.inspect(op.get_bind()).has_table('number_sequence_counters'):
        return
    op.create_table(
        'number_sequence_counters',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('prefix', sa.String(50), nullable=False),
        sa.Column('period', sa.String(10), nullable=False),
        sa.Column('last_seq', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('prefix', 'period', name='uq_number_sequence_counter_prefix_period'),
    )


def downgrade():
    op.drop_table('number_sequence_counters')
