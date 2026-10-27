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


def check_approval_escalations(app):
    """Hourly job (2026-10-17): notify the relevant role(s) again when an
    approval has been sitting unactioned past its configured window.

    Two systems checked, since the approval engine isn't one single model
    in this codebase - see [[project_sap_gap_analysis_2026_10_15]]/
    [[project_enterprise_hardening_roadmap]]:

    1. Generic ApprovalWorkflow (PO/SO/stock transfer/stock opname/etc) -
       opt-in per transaction_type via ApprovalConfiguration.escalation_hours
       (NULL = disabled for that type, the default - this does not force
       escalation onto every workflow, only ones an admin configured).
    2. PRApproval (the 2026-10-16 tiered PR approval) - fixed 48h window,
       since there's no per-type config table for it; escalates to the
       step's own required_role holders again AND to all super_admins as a
       fallback, since PRApproval has no "backup approver"/manager-hierarchy
       concept to escalate to (see research note: User has no manager_id/
       reporting-line field anywhere in this codebase).

    This only SENDS A NOTIFICATION (reminder) - it does not reassign,
    reroute, or auto-approve anything. `escalated_at` is set on the row so
    the same reminder doesn't repeat every hourly run; it's cleared when
    the workflow/step moves to a new state so a fresh step gets its own
    window.
    """
    with app.app_context():
        from models.approval_workflow import ApprovalWorkflow, ApprovalConfiguration
        from models.purchasing import PRApproval
        from models.user import User, UserRole, Role
        from utils.send_notification import send_notification
        from utils.timezone import get_local_now
        from datetime import timedelta

        now = get_local_now()
        escalated_count = 0

        # --- 1. Generic ApprovalWorkflow ---
        configs = {c.transaction_type: c for c in ApprovalConfiguration.query.filter(
            ApprovalConfiguration.escalation_hours.isnot(None),
            ApprovalConfiguration.is_active == True,
        ).all()}

        if configs:
            pending_workflows = ApprovalWorkflow.query.filter(
                ApprovalWorkflow.transaction_type.in_(list(configs.keys())),
                ApprovalWorkflow.status.in_(['pending_review', 'pending_approval']),
                ApprovalWorkflow.escalated_at.is_(None),
            ).all()

            for wf in pending_workflows:
                config = configs[wf.transaction_type]
                step_started_at = wf.reviewed_at if wf.status == 'pending_approval' and wf.reviewed_at else wf.submitted_at
                if not step_started_at:
                    continue
                age_hours = (now - step_started_at).total_seconds() / 3600
                if age_hours < config.escalation_hours:
                    continue

                roles = config.approver_roles if wf.status == 'pending_approval' else config.reviewer_roles
                if not roles:
                    continue
                user_ids = db.session.query(UserRole.user_id).join(Role).filter(
                    Role.name.in_(roles), Role.is_active == True
                ).distinct().all()

                for (uid,) in user_ids:
                    send_notification(
                        uid,
                        title='Approval Terlambat Diproses',
                        message=f'{wf.transaction_type} #{wf.transaction_number or wf.transaction_id} sudah menunggu {int(age_hours)} jam - mohon segera diproses.',
                        category='system',
                        notification_type='warning',
                        priority='high',
                        reference_type=wf.transaction_type,
                        reference_id=wf.transaction_id,
                    )
                wf.escalated_at = now
                escalated_count += 1

        # --- 2. PRApproval (fixed 48h window) ---
        pr_cutoff = now - timedelta(hours=48)
        pending_steps = PRApproval.query.filter(
            PRApproval.status == 'pending',
            PRApproval.escalated_at.is_(None),
            PRApproval.created_at <= pr_cutoff,
        ).all()

        for step in pending_steps:
            # Only escalate the level actually being waited on (earlier
            # levels not yet approved aren't "stuck", they're just not
            # reached yet - same sequential-gate logic as the approval
            # endpoint itself).
            prior_unapproved = PRApproval.query.filter(
                PRApproval.pr_id == step.pr_id,
                PRApproval.approval_level < step.approval_level,
                PRApproval.status != 'approved',
            ).first()
            if prior_unapproved:
                continue

            target_user_ids = set()
            role_user_ids = db.session.query(UserRole.user_id).filter(UserRole.role_id == step.required_role_id).all()
            target_user_ids.update(uid for (uid,) in role_user_ids)
            super_admin_ids = db.session.query(User.id).filter(User.is_super_admin == True, User.is_active == True).all()
            target_user_ids.update(uid for (uid,) in super_admin_ids)

            pr = step.purchase_requisition
            for uid in target_user_ids:
                send_notification(
                    uid,
                    title='Approval PR Terlambat Diproses',
                    message=f'PR {pr.pr_number if pr else step.pr_id} level {step.approval_level} ({step.required_role.name if step.required_role else ""}) sudah menunggu lebih dari 48 jam - mohon segera diproses.',
                    category='system',
                    notification_type='warning',
                    priority='high',
                    action_url='/app/purchasing/requisitions',
                    reference_type='pr_approval',
                    reference_id=step.pr_id,
                )
            step.escalated_at = now
            escalated_count += 1

        if escalated_count:
            db.session.commit()

        return escalated_count


def refresh_exchange_rates(app):
    """Self-contained daily kurs refresh so servers without the crontab curl
    still get rates. Skips when a rate was stored in the last 12 hours (the
    office server also runs the cron endpoint)."""
    from datetime import datetime, timedelta
    with app.app_context():
        from models.finance import ExchangeRate
        from utils.exchange_rates import fetch_exchange_rates
        latest = ExchangeRate.query.order_by(ExchangeRate.fetched_at.desc()).first()
        if latest and latest.fetched_at and latest.fetched_at > datetime.utcnow() - timedelta(hours=12):
            return 0
        return fetch_exchange_rates()


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
    scheduler.add_job(
        func=lambda: check_approval_escalations(app),
        trigger='interval',
        hours=1,
        id='check_approval_escalations',
        replace_existing=True,
    )
    scheduler.add_job(
        func=lambda: refresh_exchange_rates(app),
        trigger='cron',
        hour=6,
        minute=0,
        id='refresh_exchange_rates',
        replace_existing=True,
    )
    from datetime import datetime, timedelta
    scheduler.add_job(
        func=lambda: refresh_exchange_rates(app),
        trigger='date',
        run_date=datetime.now() + timedelta(seconds=45),
        id='refresh_exchange_rates_startup',
        replace_existing=True,
    )
    scheduler.start()
    app.extensions = getattr(app, 'extensions', {})
    app.extensions['scheduler'] = scheduler
