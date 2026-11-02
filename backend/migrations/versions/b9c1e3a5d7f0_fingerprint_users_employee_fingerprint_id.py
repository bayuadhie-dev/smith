"""fingerprint: employees.fingerprint_id + fingerprint_users working list

Revision ID: b9c1e3a5d7f0
Revises: a8b0d2f4c6e9
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'b9c1e3a5d7f0'
down_revision = 'a8b0d2f4c6e9'
branch_labels = None
depends_on = None


def upgrade():
    insp = sa.inspect(op.get_bind())
    if 'fingerprint_id' not in {c['name'] for c in insp.get_columns('employees')}:
        op.add_column('employees', sa.Column('fingerprint_id', sa.String(50), nullable=True))
        op.create_index('ix_employees_fingerprint_id', 'employees', ['fingerprint_id'], unique=True)
    if 'fingerprint_users' not in insp.get_table_names():
        op.create_table(
            'fingerprint_users',
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('device_user_id', sa.String(50), nullable=False),
            sa.Column('name', sa.String(200), nullable=False),
            sa.Column('privilege', sa.Integer, nullable=True),
            sa.Column('card', sa.String(50), nullable=True),
            sa.Column('last_seen_at', sa.DateTime, nullable=True),
            sa.Column('log_count', sa.Integer, nullable=False, server_default='0'),
            sa.Column('last_log_at', sa.DateTime, nullable=True),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, nullable=True),
        )
        op.create_index('ix_fingerprint_users_device_user_id', 'fingerprint_users', ['device_user_id'], unique=True)


def downgrade():
    op.drop_table('fingerprint_users')
    op.drop_index('ix_employees_fingerprint_id', table_name='employees')
    op.drop_column('employees', 'fingerprint_id')
