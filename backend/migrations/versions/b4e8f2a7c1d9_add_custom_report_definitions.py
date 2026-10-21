"""External-audit mock-data cleanup, category 3 item 1/3 (2026-10-06):
adds CustomReportDefinition, replacing CustomReportBuilder.tsx's
Math.random()-fabricated preview rows and never-persisted saveReport()
with a real whitelist-based query engine. See
utils/custom_report_registry.py and routes/custom_report.py.

Revision ID: a1b2c3d4e5f6
Revises: f4a8e1c2b9d3
Create Date: 2026-10-06
"""
from alembic import op
import sqlalchemy as sa

revision = 'b4e8f2a7c1d9'
down_revision = 'f4a8e1c2b9d3'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'custom_report_definitions' in inspector.get_table_names():
        return

    op.create_table(
        'custom_report_definitions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('data_sources', sa.Text(), nullable=False),
        sa.Column('fields', sa.Text(), nullable=False),
        sa.Column('filters', sa.Text(), nullable=True),
        sa.Column('group_by', sa.Text(), nullable=True),
        sa.Column('order_by', sa.Text(), nullable=True),
        sa.Column('chart_type', sa.String(length=20), server_default='table'),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'custom_report_definitions' in inspector.get_table_names():
        op.drop_table('custom_report_definitions')
