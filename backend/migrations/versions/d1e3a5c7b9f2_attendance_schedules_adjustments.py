"""attendance schedules + manual adjustments for fingerprint attendance

Revision ID: d1e3a5c7b9f2
Revises: c0d2f4b6e8a1
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'd1e3a5c7b9f2'
down_revision = 'c0d2f4b6e8a1'
branch_labels = None
depends_on = None


def _days(spec):
    import json
    return json.dumps({str(k): {'start': a, 'end': b, 'break': c} for k, (a, b, c) in spec.items()})


SEED = [
    ('Staf Kantor', {0: ('08:00', '17:00', 60), 1: ('08:00', '17:00', 60), 2: ('08:00', '17:00', 60), 3: ('08:00', '17:00', 60), 4: ('08:00', '17:00', 60)},
     True, 'Senin-Jumat 08.00-17.00, istirahat 60 menit (8 jam/hari, 40 jam/minggu).'),
    ('Produksi Shift 1', {0: ('07:00', '15:00', 30), 1: ('07:00', '15:00', 30), 2: ('07:00', '15:00', 30), 3: ('07:00', '15:00', 30),
                          4: ('07:00', '15:00', 60), 5: ('07:00', '10:00', 0)},
     False, 'Senin-Kamis istirahat 30 menit, Jumat 60 menit (salat Jumat). Sabtu 3 jam menggenapi 40 jam; jam Sabtu perlu dikonfirmasi.'),
    ('Produksi Shift 2', {0: ('15:00', '23:00', 30), 1: ('15:00', '23:00', 30), 2: ('15:00', '23:00', 30), 3: ('15:00', '23:00', 30),
                          4: ('15:00', '23:00', 30), 5: ('15:00', '17:30', 0)},
     False, 'Senin-Jumat istirahat 30 menit. Sabtu 2,5 jam menggenapi 40 jam; jam Sabtu perlu dikonfirmasi.'),
]


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())
    if 'attendance_schedules' not in tables:
        op.create_table(
            'attendance_schedules',
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('name', sa.String(100), nullable=False, unique=True),
            sa.Column('days', sa.JSON, nullable=False),
            sa.Column('late_tolerance_minutes', sa.Integer, nullable=False, server_default='10'),
            sa.Column('early_tolerance_minutes', sa.Integer, nullable=False, server_default='10'),
            sa.Column('is_default', sa.Boolean, nullable=False, server_default=sa.text('false')),
            sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.text('true')),
            sa.Column('notes', sa.Text, nullable=True),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, nullable=True),
        )
        for name, spec, default, notes in SEED:
            bind.execute(sa.text(
                "INSERT INTO attendance_schedules (name, days, is_default, notes) VALUES (:n, CAST(:d AS json), :df, :no)"),
                {'n': name, 'd': _days(spec), 'df': default, 'no': notes})
    if 'attendance_adjustments' not in tables:
        op.create_table(
            'attendance_adjustments',
            sa.Column('id', sa.Integer, primary_key=True),
            sa.Column('device_user_id', sa.String(50), nullable=True),
            sa.Column('employee_id', sa.Integer, sa.ForeignKey('employees.id'), nullable=True),
            sa.Column('date_from', sa.Date, nullable=False),
            sa.Column('date_to', sa.Date, nullable=False),
            sa.Column('adj_type', sa.String(30), nullable=False),
            sa.Column('letter_number', sa.String(100), nullable=True),
            sa.Column('note', sa.Text, nullable=True),
            sa.Column('corrected_in', sa.Time, nullable=True),
            sa.Column('corrected_out', sa.Time, nullable=True),
            sa.Column('created_by', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_attendance_adjustments_device_user_id', 'attendance_adjustments', ['device_user_id'])
        op.create_index('ix_attendance_adjustments_employee_id', 'attendance_adjustments', ['employee_id'])
        op.create_index('ix_attendance_adjustments_date_from', 'attendance_adjustments', ['date_from'])
    if 'schedule_id' not in {c['name'] for c in insp.get_columns('fingerprint_users')}:
        op.add_column('fingerprint_users', sa.Column('schedule_id', sa.Integer, sa.ForeignKey('attendance_schedules.id'), nullable=True))


def downgrade():
    op.drop_column('fingerprint_users', 'schedule_id')
    op.drop_table('attendance_adjustments')
    op.drop_table('attendance_schedules')
