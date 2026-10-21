"""
Report Scheduler CRUD + cron-triggered due-report runner (2026-10-06).
Replaces frontend/src/pages/Reports/ReportScheduler.tsx's hardcoded
mockScheduledReports fake array (fabricated falmaco.com emails, no real
persistence, no actual email delivery) with a real model + endpoints.

The "run due reports" endpoint is meant to be called periodically by
the server's own crontab (hourly is enough granularity for
daily/weekly/monthly/quarterly schedules - see cron entry note below),
not by a logged-in user, so it uses @require_cron_secret like the other
5 cron endpoints added earlier this session
(accurate_integration.py/finance.py/machine_health.py), not
@jwt_required().
"""
from datetime import datetime, timedelta
from calendar import monthrange

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db
from models.report_scheduler import ScheduledReport
from utils.auth_decorators import require_permission
from utils.cron_auth import require_cron_secret
from utils.timezone import get_local_now

report_scheduler_bp = Blueprint('report_scheduler', __name__, url_prefix='/api/reports/scheduler')


# ----------------------------------------------------------------------
# next_run calculation - mirrors the frontend's calculateNextRun() in
# ReportScheduler.tsx so both sides agree on what "daily at 08:00" means.
# ----------------------------------------------------------------------
def calculate_next_run(frequency, time_of_day, day_of_week=None, day_of_month=None, now=None):
    now = now or get_local_now()
    hours, minutes = (int(x) for x in time_of_day.split(':'))
    next_run = now.replace(hour=hours, minute=minutes, second=0, microsecond=0)

    if frequency == 'daily':
        if next_run <= now:
            next_run += timedelta(days=1)
    elif frequency == 'weekly':
        target_day = day_of_week if day_of_week is not None else 1
        # Python weekday(): Mon=0..Sun=6. Frontend uses Sun=0..Sat=6 (JS getDay()).
        current_day_js = (now.weekday() + 1) % 7
        days_until = (target_day - current_day_js + 7) % 7
        if days_until == 0 and next_run <= now:
            days_until = 7
        next_run += timedelta(days=days_until)
    elif frequency == 'monthly':
        dom = day_of_month if day_of_month else 1
        dom = min(dom, monthrange(next_run.year, next_run.month)[1])
        next_run = next_run.replace(day=dom)
        if next_run <= now:
            year = next_run.year + (1 if next_run.month == 12 else 0)
            month = 1 if next_run.month == 12 else next_run.month + 1
            dom = min(dom, monthrange(year, month)[1])
            next_run = next_run.replace(year=year, month=month, day=dom)
    elif frequency == 'quarterly':
        quarter_month = ((next_run.month - 1) // 3 + 1) * 3 + 1
        year = next_run.year + (1 if quarter_month > 12 else 0)
        month = quarter_month if quarter_month <= 12 else quarter_month - 12
        candidate = next_run.replace(year=year, month=month, day=1)
        if candidate <= now:
            month2 = month + 3
            year2 = year + (1 if month2 > 12 else 0)
            month2 = month2 if month2 <= 12 else month2 - 12
            candidate = candidate.replace(year=year2, month=month2, day=1)
        next_run = candidate
    else:
        raise ValueError(f'Unknown frequency: {frequency}')

    return next_run


# ----------------------------------------------------------------------
# CRUD
# ----------------------------------------------------------------------
@report_scheduler_bp.route('', methods=['GET'])
@jwt_required()
@require_permission('reports.view')
def list_scheduled_reports():
    try:
        reports = ScheduledReport.query.order_by(ScheduledReport.created_at.desc()).all()
        return jsonify({'scheduledReports': [r.to_dict() for r in reports]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@report_scheduler_bp.route('', methods=['POST'])
@jwt_required()
@require_permission('reports.create')
def create_scheduled_report():
    try:
        data = request.get_json() or {}
        user_id = get_jwt_identity()

        name = (data.get('name') or '').strip()
        report_type = data.get('reportType')
        schedule = data.get('schedule') or {}
        frequency = schedule.get('frequency')
        time_of_day = schedule.get('time')
        recipients = [e.strip() for e in (data.get('recipients') or []) if e and e.strip() and '@' in e]

        if not name:
            return jsonify({'error': 'name is required'}), 400
        if not report_type:
            return jsonify({'error': 'reportType is required'}), 400
        if frequency not in ('daily', 'weekly', 'monthly', 'quarterly'):
            return jsonify({'error': 'schedule.frequency must be daily/weekly/monthly/quarterly'}), 400
        if not time_of_day:
            return jsonify({'error': 'schedule.time is required'}), 400
        if not recipients:
            return jsonify({'error': 'At least one valid email recipient is required'}), 400

        day_of_week = schedule.get('dayOfWeek') if frequency == 'weekly' else None
        day_of_month = schedule.get('dayOfMonth') if frequency == 'monthly' else None

        next_run = calculate_next_run(frequency, time_of_day, day_of_week, day_of_month)

        report = ScheduledReport(
            name=name,
            report_type=report_type,
            frequency=frequency,
            time_of_day=time_of_day,
            day_of_week=day_of_week,
            day_of_month=day_of_month,
            recipients=','.join(recipients),
            format=data.get('format', 'pdf'),
            is_active=True,
            next_run=next_run,
            created_by=int(user_id) if user_id else None,
        )
        db.session.add(report)
        db.session.commit()

        return jsonify(report.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@report_scheduler_bp.route('/<int:report_id>', methods=['PUT'])
@jwt_required()
@require_permission('reports.create')
def update_scheduled_report(report_id):
    try:
        report = db.session.get(ScheduledReport, report_id)
        if not report:
            return jsonify({'error': 'Scheduled report not found'}), 404

        data = request.get_json() or {}

        if 'name' in data:
            report.name = data['name'].strip()
        if 'reportType' in data:
            report.report_type = data['reportType']
        if 'recipients' in data:
            recipients = [e.strip() for e in (data.get('recipients') or []) if e and e.strip() and '@' in e]
            if not recipients:
                return jsonify({'error': 'At least one valid email recipient is required'}), 400
            report.recipients = ','.join(recipients)
        if 'format' in data:
            report.format = data['format']
        if 'isActive' in data:
            report.is_active = bool(data['isActive'])

        schedule = data.get('schedule')
        if schedule:
            report.frequency = schedule.get('frequency', report.frequency)
            report.time_of_day = schedule.get('time', report.time_of_day)
            report.day_of_week = schedule.get('dayOfWeek') if report.frequency == 'weekly' else None
            report.day_of_month = schedule.get('dayOfMonth') if report.frequency == 'monthly' else None
            report.next_run = calculate_next_run(
                report.frequency, report.time_of_day, report.day_of_week, report.day_of_month
            )

        db.session.commit()
        return jsonify(report.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@report_scheduler_bp.route('/<int:report_id>/toggle', methods=['POST'])
@jwt_required()
@require_permission('reports.create')
def toggle_scheduled_report(report_id):
    try:
        report = db.session.get(ScheduledReport, report_id)
        if not report:
            return jsonify({'error': 'Scheduled report not found'}), 404
        report.is_active = not report.is_active
        db.session.commit()
        return jsonify(report.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@report_scheduler_bp.route('/<int:report_id>', methods=['DELETE'])
@jwt_required()
@require_permission('reports.create')
def delete_scheduled_report(report_id):
    try:
        report = db.session.get(ScheduledReport, report_id)
        if not report:
            return jsonify({'error': 'Scheduled report not found'}), 404
        db.session.delete(report)
        db.session.commit()
        return jsonify({'message': 'Scheduled report deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@report_scheduler_bp.route('/<int:report_id>/run-now', methods=['POST'])
@jwt_required()
@require_permission('reports.create')
def run_scheduled_report_now(report_id):
    """Manually trigger one report immediately (the 'Run now' button)."""
    try:
        report = db.session.get(ScheduledReport, report_id)
        if not report:
            return jsonify({'error': 'Scheduled report not found'}), 404
        result = _run_single_report(report, advance_next_run=False)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ----------------------------------------------------------------------
# Cron-triggered due-report runner
# ----------------------------------------------------------------------
def _run_single_report(report, advance_next_run=True):
    from routes.reports import REPORT_TYPE_DATA_FUNCS
    from utils.email_service import get_email_service

    data_func = REPORT_TYPE_DATA_FUNCS.get(report.report_type)
    if not data_func:
        return {'report_id': report.id, 'sent': False, 'error': f'Unknown report_type: {report.report_type}'}

    try:
        data = data_func()
    except Exception as e:
        return {'report_id': report.id, 'sent': False, 'error': f'Report generation failed: {e}'}

    html = _render_report_email(report.name, report.report_type, data)
    email_service = get_email_service()
    send_result = email_service.send_email(
        to=report.recipients_list(),
        subject=f'[SMITH ERP] {report.name}',
        html=html,
    )

    sent = 'error' not in send_result
    now = get_local_now()
    report.last_run = now
    if advance_next_run:
        report.next_run = calculate_next_run(
            report.frequency, report.time_of_day, report.day_of_week, report.day_of_month, now=now
        )
    db.session.commit()

    return {
        'report_id': report.id,
        'name': report.name,
        'sent': sent,
        'recipients': report.recipients_list(),
        'error': send_result.get('error'),
    }


def _render_report_email(name, report_type, data):
    """Plain summary table of the report's top-level scalar fields - not a
    full PDF/Excel attachment (that would need a dedicated rendering
    pipeline per report type, out of scope here), but a real rendering of
    real data, not a canned message."""
    rows = []
    for key, value in data.items():
        if isinstance(value, (list, dict)):
            continue
        rows.append(f'<tr><td style="padding:4px 12px;color:#666;">{key}</td>'
                     f'<td style="padding:4px 12px;font-weight:600;">{value}</td></tr>')
    table = f'<table>{"".join(rows)}</table>' if rows else '<p>No summary data.</p>'
    return f'''
<h2>{name}</h2>
<p style="color:#888;font-size:13px;">Report type: {report_type} &middot; Generated: {get_local_now().isoformat()}</p>
{table}
'''


@report_scheduler_bp.route('/run-due', methods=['POST'])
@require_cron_secret
def run_due_reports():
    """Cron endpoint: find every active ScheduledReport whose next_run has
    passed, generate + email it, advance next_run. Call hourly from
    crontab (finest schedule granularity offered is daily-at-a-specific-
    time, so hourly polling is enough to catch it within an hour)."""
    try:
        now = get_local_now()
        due = ScheduledReport.query.filter(
            ScheduledReport.is_active == True,
            ScheduledReport.next_run <= now,
        ).all()

        results = [_run_single_report(r, advance_next_run=True) for r in due]

        return jsonify({
            'checked_at': now.isoformat(),
            'due_count': len(due),
            'results': results,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
