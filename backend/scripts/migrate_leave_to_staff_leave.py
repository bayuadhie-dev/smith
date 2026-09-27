"""
One-off data migration (2026-09-27): Leave -> StaffLeaveRequest.

Context: two parallel leave systems existed in the codebase (see
CLAUDE.md gotcha pattern "RD vs RND duplikasi" for the same shape of
problem elsewhere). StaffLeaveRequest was chosen as the single surviving
system because it already had office-location geofencing, a calendar
view, and public/kiosk submission that Leave lacked. This script ports
every existing Leave row into StaffLeaveRequest (now extended with
employee_id + manager routing fields to match what Leave had) so no
history is lost, then the Leave model/routes can be retired.

Run manually once, after the DB is reachable again:
    cd backend && python scripts/migrate_leave_to_staff_leave.py [--dry-run]

Safe to re-run: skips any Leave row whose leave_number already has a
matching StaffLeaveRequest (matched via the request_number we mint as
"LV-MIGRATED-{leave.id}").
"""
import sys
import argparse

sys.path.insert(0, '.')

from app import create_app
from models import db
from models.hr import Leave, StaffLeaveRequest, Employee


def migrate(dry_run=False):
    app = create_app()
    with app.app_context():
        leaves = Leave.query.order_by(Leave.id).all()
        print(f"Found {len(leaves)} Leave rows to migrate.")

        migrated, skipped = 0, 0
        for leave in leaves:
            marker = f"LV-MIGRATED-{leave.id}"
            existing = StaffLeaveRequest.query.filter_by(request_number=marker).first()
            if existing:
                skipped += 1
                continue

            employee = db.session.get(Employee, leave.employee_id)
            staff_name = employee.full_name if employee else f"Employee #{leave.employee_id}"

            record = StaffLeaveRequest(
                request_number=marker,
                staff_name=staff_name,
                employee_id=leave.employee_id,
                leave_type=leave.leave_type,
                start_date=leave.start_date,
                end_date=leave.end_date,
                total_days=leave.total_days,
                reason=leave.reason or '(migrasi dari sistem lama, tanpa alasan tercatat)',
                status=leave.status,
                approved_by=leave.approved_by,
                approved_at=leave.approved_at,
                required_manager_id=leave.required_manager_id,
                manager_status=leave.manager_status,
                manager_approved_at=leave.manager_approved_at,
                created_at=leave.created_at,
                updated_at=leave.updated_at,
            )
            db.session.add(record)
            migrated += 1
            print(f"  [{'DRY-RUN' if dry_run else 'OK'}] Leave#{leave.id} ({leave.leave_number}) -> {marker}")

        if dry_run:
            db.session.rollback()
            print(f"\nDry run complete. Would migrate {migrated}, skip {skipped} (already migrated).")
        else:
            db.session.commit()
            print(f"\nMigration complete. Migrated {migrated}, skipped {skipped} (already migrated).")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    migrate(dry_run=args.dry_run)
