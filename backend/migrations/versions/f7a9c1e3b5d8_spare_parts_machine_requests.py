"""spare parts: machine link, requests, maintenance.approve permission

Revision ID: f7a9c1e3b5d8
Revises: e6b8d0f2a4c7
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'f7a9c1e3b5d8'
down_revision = 'e6b8d0f2a4c7'
branch_labels = None
depends_on = None


def upgrade():
    insp = sa.inspect(op.get_bind())
    tables = set(insp.get_table_names())

    if 'machine_spare_parts' not in tables:
        op.create_table(
            'machine_spare_parts',
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('machine_id', sa.Integer, sa.ForeignKey('machines.id', ondelete='CASCADE'), nullable=False),
            sa.Column('spare_part_id', sa.Integer, sa.ForeignKey('spare_parts.id', ondelete='CASCADE'), nullable=False),
            sa.Column('qty_installed', sa.Numeric(15, 2), nullable=False, server_default='1'),
            sa.Column('replace_interval_days', sa.Integer, nullable=True),
            sa.Column('last_replaced_date', sa.Date, nullable=True),
            sa.Column('notes', sa.Text, nullable=True),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, nullable=True),
            sa.UniqueConstraint('machine_id', 'spare_part_id', name='uq_machine_spare_part'),
        )
        op.create_index('ix_machine_spare_parts_machine_id', 'machine_spare_parts', ['machine_id'])
        op.create_index('ix_machine_spare_parts_spare_part_id', 'machine_spare_parts', ['spare_part_id'])

    if 'spare_part_requests' not in tables:
        op.create_table(
            'spare_part_requests',
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('request_number', sa.String(100), nullable=False, unique=True),
            sa.Column('machine_id', sa.Integer, sa.ForeignKey('machines.id'), nullable=True),
            sa.Column('maintenance_record_id', sa.Integer, sa.ForeignKey('maintenance_records.id'), nullable=True),
            sa.Column('status', sa.String(30), nullable=False, server_default='pending'),
            sa.Column('notes', sa.Text, nullable=True),
            sa.Column('requested_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
            sa.Column('requested_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('decided_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
            sa.Column('decided_at', sa.DateTime, nullable=True),
            sa.Column('decision_note', sa.Text, nullable=True),
        )
        op.create_index('ix_spare_part_requests_status', 'spare_part_requests', ['status'])

    if 'spare_part_request_items' not in tables:
        op.create_table(
            'spare_part_request_items',
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('request_id', sa.Integer, sa.ForeignKey('spare_part_requests.id', ondelete='CASCADE'), nullable=False),
            sa.Column('spare_part_id', sa.Integer, sa.ForeignKey('spare_parts.id'), nullable=False),
            sa.Column('qty_requested', sa.Numeric(15, 2), nullable=False),
            sa.Column('qty_issued', sa.Numeric(15, 2), nullable=False, server_default='0'),
            sa.Column('notes', sa.Text, nullable=True),
        )
        op.create_index('ix_spare_part_request_items_request_id', 'spare_part_request_items', ['request_id'])

    # Izin baru: kepala maintenance menyetujui permintaan sparepart.
    bind = op.get_bind()
    if 'permissions' in tables:
        bind.execute(sa.text(
            "INSERT INTO permissions (name, resource, module, action, description, is_active, created_at) "
            "SELECT 'maintenance.approve', 'maintenance', 'Maintenance', 'approve', "
            "'Menyetujui permintaan sparepart', true, now() "
            "WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'maintenance.approve')"))
        bind.execute(sa.text(
            "INSERT INTO role_permissions (role_id, permission_id, created_at) "
            "SELECT r.id, p.id, now() FROM roles r, permissions p "
            "WHERE r.name = 'Manager Maintenance' AND p.name = 'maintenance.approve' "
            "AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id)"))


def downgrade():
    bind = op.get_bind()
    bind.execute(sa.text("DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE name = 'maintenance.approve')"))
    bind.execute(sa.text("DELETE FROM permissions WHERE name = 'maintenance.approve'"))
    op.drop_table('spare_part_request_items')
    op.drop_table('spare_part_requests')
    op.drop_table('machine_spare_parts')
