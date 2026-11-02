"""fingerprint_logs: raw punches pulled from the fingerprint device

Revision ID: c0d2f4b6e8a1
Revises: b9c1e3a5d7f0
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'c0d2f4b6e8a1'
down_revision = 'b9c1e3a5d7f0'
branch_labels = None
depends_on = None


def upgrade():
    if 'fingerprint_logs' in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        'fingerprint_logs',
        sa.Column('id', sa.BigInteger, primary_key=True),
        sa.Column('device_user_id', sa.String(50), nullable=False),
        sa.Column('punched_at', sa.DateTime, nullable=False),
        sa.Column('status', sa.Integer, nullable=True),
        sa.Column('punch', sa.Integer, nullable=True),
        sa.Column('source_device', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('device_user_id', 'punched_at', name='uq_fingerprint_log_user_time'),
    )
    op.create_index('ix_fingerprint_logs_device_user_id', 'fingerprint_logs', ['device_user_id'])
    op.create_index('ix_fingerprint_logs_punched_at', 'fingerprint_logs', ['punched_at'])


def downgrade():
    op.drop_table('fingerprint_logs')
