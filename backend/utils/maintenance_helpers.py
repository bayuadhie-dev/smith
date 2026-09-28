"""
Shared helpers for Maintenance - extracted 2026-09-28 while maturing the
module (see routes/maintenance.py) so the same logic is callable from both
the Flask route (manual "Generate" button) and scripts/generate_due_
maintenance.py (cron, auto-generate when a schedule comes due) without
duplicating it.
"""
from datetime import datetime

from dateutil.relativedelta import relativedelta

from models import db
from models.maintenance import MaintenanceRecord
from models.asset_management import Asset
from utils import generate_number


def resolve_asset_for_machine(machine_id):
    """Best-effort lookup of the Asset row linked to a given machine_id
    (Asset.machine_id, added 2026-09-28 - see its column docstring). Returns
    None if the machine has no corresponding Asset record yet (not every
    machine necessarily has one - asset tracking may not be set up for it),
    which is fine: MaintenanceRecord.asset_id stays nullable for that case."""
    if not machine_id:
        return None
    asset = Asset.query.filter_by(machine_id=machine_id).first()
    return asset.id if asset else None


def generate_maintenance_record_from_schedule(schedule, user_id=None):
    """Create one MaintenanceRecord from a due MaintenanceSchedule and
    advance the schedule's next_maintenance_date - the exact logic
    routes/maintenance.py's generate_maintenance_from_schedule() endpoint
    already had, extracted here so scripts/generate_due_maintenance.py
    (cron) can call it too. Does NOT commit - caller controls the
    transaction boundary (the route commits once per call; the cron script
    commits once per schedule so one bad schedule doesn't roll back the
    others)."""
    record_number = generate_number('MR', MaintenanceRecord, 'record_number')

    record = MaintenanceRecord(
        record_number=record_number,
        machine_id=schedule.machine_id,
        asset_id=resolve_asset_for_machine(schedule.machine_id),
        schedule_id=schedule.id,
        maintenance_type=schedule.maintenance_type,
        maintenance_date=schedule.next_maintenance_date,
        duration_hours=schedule.estimated_duration_hours,
        status='scheduled',
        problem_description=f'Scheduled {schedule.maintenance_type} maintenance',
        performed_by=schedule.assigned_to or user_id,
        notes=f'Generated from schedule {schedule.schedule_number}',
    )
    db.session.add(record)

    schedule.last_maintenance_date = schedule.next_maintenance_date

    next_date = schedule.next_maintenance_date
    if schedule.frequency == 'daily':
        next_date = next_date + relativedelta(days=schedule.frequency_value)
    elif schedule.frequency == 'weekly':
        next_date = next_date + relativedelta(weeks=schedule.frequency_value)
    elif schedule.frequency == 'monthly':
        next_date = next_date + relativedelta(months=schedule.frequency_value)
    elif schedule.frequency == 'quarterly':
        next_date = next_date + relativedelta(months=schedule.frequency_value * 3)
    elif schedule.frequency == 'yearly':
        next_date = next_date + relativedelta(years=schedule.frequency_value)
    schedule.next_maintenance_date = next_date

    return record
