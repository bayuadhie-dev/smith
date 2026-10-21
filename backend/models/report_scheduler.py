"""
Report Scheduler (2026-10-06) - replaces the frontend-only
`mockScheduledReports` fabricated array (3 fake entries with
non-existent falmaco.com emails) with a real persisted model. See
routes/report_scheduler.py for the CRUD endpoints and the cron-triggered
due-report runner that actually emails reports via utils/email_service.py.
"""
from datetime import datetime
from models import db


class ScheduledReport(db.Model):
    __tablename__ = 'scheduled_reports'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    report_type = db.Column(db.String(50), nullable=False)  # matches REPORT_TYPE_DATA_FUNCS keys in routes/reports.py
    frequency = db.Column(db.String(20), nullable=False)  # daily, weekly, monthly, quarterly
    time_of_day = db.Column(db.String(5), nullable=False)  # 'HH:MM'
    day_of_week = db.Column(db.Integer, nullable=True)  # 0=Sunday..6=Saturday, for weekly
    day_of_month = db.Column(db.Integer, nullable=True)  # 1-28, for monthly
    recipients = db.Column(db.Text, nullable=False)  # comma-separated emails
    format = db.Column(db.String(10), default='pdf')  # pdf, excel, csv - stored for intent; actual delivery is an HTML email body (see routes/report_scheduler.py)
    is_active = db.Column(db.Boolean, default=True)
    last_run = db.Column(db.DateTime, nullable=True)
    next_run = db.Column(db.DateTime, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def recipients_list(self):
        return [r.strip() for r in (self.recipients or '').split(',') if r.strip()]

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'reportType': self.report_type,
            'schedule': {
                'frequency': self.frequency,
                'time': self.time_of_day,
                'dayOfWeek': self.day_of_week,
                'dayOfMonth': self.day_of_month,
            },
            'recipients': self.recipients_list(),
            'format': self.format,
            'isActive': self.is_active,
            'lastRun': self.last_run.isoformat() if self.last_run else None,
            'nextRun': self.next_run.isoformat() if self.next_run else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }
