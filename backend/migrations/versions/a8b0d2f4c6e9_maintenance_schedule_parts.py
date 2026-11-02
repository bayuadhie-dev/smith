"""maintenance_schedule_parts: spare parts needed per preventive schedule

Revision ID: a8b0d2f4c6e9
Revises: f7a9c1e3b5d8
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'a8b0d2f4c6e9'
down_revision = 'f7a9c1e3b5d8'
branch_labels = None
depends_on = None


def upgrade():
    if 'maintenance_schedule_parts' in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        'maintenance_schedule_parts',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('schedule_id', sa.Integer, sa.ForeignKey('maintenance_schedules.id', ondelete='CASCADE'), nullable=False),
        sa.Column('spare_part_id', sa.Integer, sa.ForeignKey('spare_parts.id'), nullable=False),
        sa.Column('qty', sa.Numeric(15, 2), nullable=False, server_default='1'),
        sa.UniqueConstraint('schedule_id', 'spare_part_id', name='uq_schedule_spare_part'),
    )
    op.create_index('ix_maintenance_schedule_parts_schedule_id', 'maintenance_schedule_parts', ['schedule_id'])


def downgrade():
    op.drop_table('maintenance_schedule_parts')
