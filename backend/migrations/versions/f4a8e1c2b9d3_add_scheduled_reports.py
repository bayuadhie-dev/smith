"""External-audit mock-data cleanup, category 3 item 2/3 (2026-10-06):
adds ScheduledReport, replacing the frontend's hardcoded
mockScheduledReports fake array (fabricated falmaco.com emails, no real
persistence). See models/report_scheduler.py and
routes/report_scheduler.py (CRUD + cron-triggered due-report runner,
protected via utils.cron_auth.require_cron_secret like the other 5
cron endpoints added this session).

Revision ID: f4a8e1c2b9d3
Revises: e3a9c7d5f1b2
Create Date: 2026-10-06
"""
from alembic import op
import sqlalchemy as sa

revision = 'f4a8e1c2b9d3'
down_revision = 'e3a9c7d5f1b2'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'scheduled_reports' in inspector.get_table_names():
        return

    op.create_table(
        'scheduled_reports',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('report_type', sa.String(length=50), nullable=False),
        sa.Column('frequency', sa.String(length=20), nullable=False),
        sa.Column('time_of_day', sa.String(length=5), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=True),
        sa.Column('day_of_month', sa.Integer(), nullable=True),
        sa.Column('recipients', sa.Text(), nullable=False),
        sa.Column('format', sa.String(length=10), server_default='pdf'),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true()),
        sa.Column('last_run', sa.DateTime(), nullable=True),
        sa.Column('next_run', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'scheduled_reports' in inspector.get_table_names():
        op.drop_table('scheduled_reports')
