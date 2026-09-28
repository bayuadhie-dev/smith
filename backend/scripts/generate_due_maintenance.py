"""
Generate Due Maintenance
=========================
Auto-generate MaintenanceRecord rows for any active MaintenanceSchedule
whose next_maintenance_date has arrived (2026-09-28, closes a gap found
while maturing the Maintenance module: the schedule->record generation
endpoint existed (POST /schedules/<id>/generate) but nothing ever called
it automatically - someone had to remember to click "Generate" per
schedule. Every other auto-generation pattern in this codebase (e.g. the
Production Schedule Grid auto-creating Work Orders when their date
arrives) already runs unattended; this brings Maintenance up to the same
standard.

Designed to be run via cron (same pattern as health_history_collector.py -
standalone script, own lightweight app context, not inside the Flask app
process):

    # crontab -e, once per day is enough (schedules are daily/weekly/
    # monthly/quarterly/yearly - a job doesn't need sub-day precision):
    0 6 * * * cd /path/to/backend && venv/bin/python scripts/generate_due_maintenance.py >> logs/generate_due_maintenance.log 2>&1

Idempotent by construction: each run only picks up schedules whose
next_maintenance_date <= today, and generating a record immediately
advances that schedule's next_maintenance_date past today (see
utils/maintenance_helpers.py) - so a schedule already generated today
won't be picked up again until its next real due date.
"""
import os
import sys
from datetime import date

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app import create_app
from models import db, MaintenanceSchedule
from utils.maintenance_helpers import generate_maintenance_record_from_schedule


def run():
    app = create_app()
    with app.app_context():
        today = date.today()
        due_schedules = MaintenanceSchedule.query.filter(
            MaintenanceSchedule.is_active.is_(True),
            MaintenanceSchedule.next_maintenance_date <= today,
        ).all()

        if not due_schedules:
            print(f"[{today.isoformat()}] Tidak ada schedule maintenance yang jatuh tempo.")
            return

        generated, failed = 0, 0
        for schedule in due_schedules:
            try:
                record = generate_maintenance_record_from_schedule(schedule)
                # Commit SATU per schedule - satu schedule gagal (mis. data
                # tidak valid) tidak boleh menggagalkan/rollback schedule lain
                # yang sudah berhasil diproses dalam run yang sama.
                db.session.commit()
                print(f"  [OK] {schedule.schedule_number} -> {record.record_number} (next: {schedule.next_maintenance_date.isoformat()})")
                generated += 1
            except Exception as e:
                db.session.rollback()
                print(f"  [GAGAL] {schedule.schedule_number} - {e}")
                failed += 1

        print(f"[{today.isoformat()}] Selesai. Dibuat {generated}, gagal {failed}.")


if __name__ == '__main__':
    run()
