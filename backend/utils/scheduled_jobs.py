import json
from datetime import date

from models import db
from models.warehouse import Inventory
from models.product import Product, Material
from models.settings_extended import AuditLog

AUTO_QUARANTINE_REASON = 'Auto-quarantine: masa self-life/retest period terlampaui'


def _self_life_days(item):
    if isinstance(item, Product):
        return item.retest_period_days if item.material_type == 'wip' else item.self_life_days
    if isinstance(item, Material):
        return item.expiry_days
    return None


def auto_quarantine_expired_batches(app):
    """Daily job: scan active Inventory batches, and for any whose item's
    self_life_days (or retest_period_days for WIP products) has elapsed since
    production_date, move it to 'quarantine' (unless already quarantine/reject).
    Native replacement for what used to require a manual check - see the QC
    'Ubah Status Batch' plan (models/spk.py's sibling feature)."""
    with app.app_context():
        candidates = Inventory.query.filter(
            Inventory.is_active == True,
            Inventory.production_date.isnot(None),
            Inventory.stock_status.notin_(['quarantine', 'reject']),
        ).all()

        quarantined = 0
        for inv in candidates:
            item = inv.product or inv.material
            if not item:
                continue
            days = _self_life_days(item)
            if not days:
                continue
            if (date.today() - inv.production_date).days <= days:
                continue

            old_status = inv.stock_status
            inv.stock_status = 'quarantine'
            inv.qc_notes = AUTO_QUARANTINE_REASON
            inv.qc_date = db.func.now()

            db.session.add(AuditLog(
                user_id=None,
                action='update',
                resource_type='inventory_batch',
                resource_id=str(inv.id),
                resource_name=inv.batch_number or f'Inventory #{inv.id}',
                old_values=json.dumps({'stock_status': old_status}),
                new_values=json.dumps({'stock_status': 'quarantine', 'reason': AUTO_QUARANTINE_REASON}),
            ))
            quarantined += 1

        if quarantined:
            db.session.commit()

        return quarantined


def register_scheduled_jobs(app):
    """Registers the daily auto-quarantine job. Guarded so it only runs in the
    actual server process, not Flask's dev-mode reloader parent process (which
    would otherwise register the job twice)."""
    import os
    if app.config.get('TESTING'):
        return
    if app.debug and os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        # Debug mode's reloader parent/watcher process - skip, the reloaded
        # child process (where WERKZEUG_RUN_MAIN='true') will register it.
        return

    from apscheduler.schedulers.background import BackgroundScheduler
    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(
        func=lambda: auto_quarantine_expired_batches(app),
        trigger='cron',
        hour=1,
        minute=0,
        id='auto_quarantine_expired_batches',
        replace_existing=True,
    )
    scheduler.start()
    app.extensions = getattr(app, 'extensions', {})
    app.extensions['scheduler'] = scheduler
