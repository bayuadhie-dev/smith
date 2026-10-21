"""
Tests for Report Scheduler (2026-10-06) - external-audit mock-data
cleanup, category 3. Replaces the frontend's hardcoded
mockScheduledReports fake array with a real model + CRUD + a
cron-triggered due-report email runner.
"""
from datetime import timedelta
from unittest.mock import patch

from utils.timezone import get_local_now


def _create_payload(**overrides):
    payload = {
        'name': 'Test Daily Sales',
        'reportType': 'sales-summary',
        'schedule': {'frequency': 'daily', 'time': '08:00'},
        'recipients': ['test@example.com'],
        'format': 'pdf',
    }
    payload.update(overrides)
    return payload


class TestScheduledReportCRUD:
    def test_create_and_list(self, client, auth_headers, db_session):
        resp = client.post('/api/reports/scheduler', json=_create_payload(), headers=auth_headers)
        assert resp.status_code == 201, resp.get_json()
        body = resp.get_json()
        assert body['name'] == 'Test Daily Sales'
        assert body['reportType'] == 'sales-summary'
        assert body['recipients'] == ['test@example.com']
        assert body['isActive'] is True
        assert body['nextRun'] is not None

        resp2 = client.get('/api/reports/scheduler', headers=auth_headers)
        assert resp2.status_code == 200
        names = [r['name'] for r in resp2.get_json()['scheduledReports']]
        assert 'Test Daily Sales' in names

    def test_create_rejects_missing_recipient(self, client, auth_headers, db_session):
        resp = client.post('/api/reports/scheduler', json=_create_payload(recipients=[]), headers=auth_headers)
        assert resp.status_code == 400

    def test_create_rejects_invalid_frequency(self, client, auth_headers, db_session):
        payload = _create_payload()
        payload['schedule']['frequency'] = 'yearly'
        resp = client.post('/api/reports/scheduler', json=payload, headers=auth_headers)
        assert resp.status_code == 400

    def test_toggle_flips_is_active(self, client, auth_headers, db_session):
        created = client.post('/api/reports/scheduler', json=_create_payload(), headers=auth_headers).get_json()
        rid = created['id']
        assert created['isActive'] is True

        resp = client.post(f'/api/reports/scheduler/{rid}/toggle', headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()['isActive'] is False

        resp2 = client.post(f'/api/reports/scheduler/{rid}/toggle', headers=auth_headers)
        assert resp2.get_json()['isActive'] is True

    def test_update_changes_schedule(self, client, auth_headers, db_session):
        created = client.post('/api/reports/scheduler', json=_create_payload(), headers=auth_headers).get_json()
        rid = created['id']

        resp = client.put(f'/api/reports/scheduler/{rid}', json={
            'schedule': {'frequency': 'weekly', 'time': '09:00', 'dayOfWeek': 1}
        }, headers=auth_headers)
        assert resp.status_code == 200
        body = resp.get_json()
        assert body['schedule']['frequency'] == 'weekly'
        assert body['schedule']['dayOfWeek'] == 1

    def test_delete_removes_report(self, client, auth_headers, db_session):
        created = client.post('/api/reports/scheduler', json=_create_payload(), headers=auth_headers).get_json()
        rid = created['id']

        resp = client.delete(f'/api/reports/scheduler/{rid}', headers=auth_headers)
        assert resp.status_code == 200

        resp2 = client.get('/api/reports/scheduler', headers=auth_headers)
        ids = [r['id'] for r in resp2.get_json()['scheduledReports']]
        assert rid not in ids

    def test_requires_auth(self, client, db_session):
        resp = client.get('/api/reports/scheduler')
        assert resp.status_code == 401


class TestCalculateNextRun:
    def test_daily_next_run_is_tomorrow_if_time_passed(self):
        from routes.report_scheduler import calculate_next_run
        now = get_local_now().replace(hour=12, minute=0, second=0, microsecond=0)
        next_run = calculate_next_run('daily', '08:00', now=now)
        assert next_run.date() == (now + timedelta(days=1)).date()
        assert next_run.hour == 8

    def test_daily_next_run_is_today_if_time_not_passed(self):
        from routes.report_scheduler import calculate_next_run
        now = get_local_now().replace(hour=6, minute=0, second=0, microsecond=0)
        next_run = calculate_next_run('daily', '08:00', now=now)
        assert next_run.date() == now.date()

    def test_monthly_clamps_day_to_month_length(self):
        from routes.report_scheduler import calculate_next_run
        now = get_local_now().replace(year=2026, month=2, day=1, hour=0, minute=0, second=0, microsecond=0)
        next_run = calculate_next_run('monthly', '08:00', day_of_month=31, now=now)
        # Feb 2026 has 28 days - must not raise, must clamp.
        assert next_run.day <= 28


class TestRunDueReports:
    def test_cron_endpoint_requires_secret(self, client, db_session):
        resp = client.post('/api/reports/scheduler/run-due')
        assert resp.status_code == 401

    def test_cron_endpoint_with_correct_secret_runs_due_reports(self, client, app, db_session):
        from models.report_scheduler import ScheduledReport

        app.config['CRON_SECRET_TOKEN'] = 'test-secret-123'

        past = get_local_now() - timedelta(hours=1)
        report = ScheduledReport(
            name='Due Report', report_type='sales-summary', frequency='daily',
            time_of_day='08:00', recipients='test@example.com', is_active=True,
            next_run=past,
        )
        db_session.add(report)
        db_session.commit()

        with patch('utils.email_service.get_email_service') as mock_get_email:
            mock_get_email.return_value.send_email.return_value = {'success': True}
            resp = client.post(
                '/api/reports/scheduler/run-due',
                headers={'X-Cron-Secret': 'test-secret-123'},
            )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body['due_count'] == 1
        assert body['results'][0]['report_id'] == report.id

        db_session.refresh(report)
        assert report.last_run is not None
        assert report.next_run > past

    def test_cron_endpoint_skips_inactive_and_not_yet_due(self, client, app, db_session):
        from models.report_scheduler import ScheduledReport

        app.config['CRON_SECRET_TOKEN'] = 'test-secret-123'

        future = get_local_now() + timedelta(days=1)
        past = get_local_now() - timedelta(hours=1)

        inactive = ScheduledReport(
            name='Inactive', report_type='sales-summary', frequency='daily',
            time_of_day='08:00', recipients='test@example.com', is_active=False,
            next_run=past,
        )
        not_due = ScheduledReport(
            name='Not due yet', report_type='sales-summary', frequency='daily',
            time_of_day='08:00', recipients='test@example.com', is_active=True,
            next_run=future,
        )
        db_session.add_all([inactive, not_due])
        db_session.commit()

        resp = client.post(
            '/api/reports/scheduler/run-due',
            headers={'X-Cron-Secret': 'test-secret-123'},
        )
        assert resp.status_code == 200
        assert resp.get_json()['due_count'] == 0
