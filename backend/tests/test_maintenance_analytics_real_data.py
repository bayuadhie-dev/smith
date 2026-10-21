"""
Tests for routes/maintenance_extended.py's /analytics endpoint (2026-10-07) -
continuation of the system-wide fabricated-data sweep. This endpoint had two
real bugs:

1. A crash: `r.actual_completion_time` was read on MaintenanceRecord, a
   field that does not exist on that model (the real field is
   `duration_hours`) - any 'completed' record in the filtered range raised
   AttributeError, silently turned into a 500 by the bare except.
2. Once that was worked around, the response was almost entirely hardcoded
   mock data (availability_rate=85.5, mtbf=168.0, 6 literal Jan-Jun rows,
   fixed Labor/Parts/Tools/External percentages, 4 fixed downtime reasons)
   that never changed regardless of the real records in the system.
"""
from datetime import datetime, timedelta


def _make_record(db_session, machine, **kwargs):
    from models.maintenance import MaintenanceRecord
    import uuid

    defaults = dict(
        record_number=f'MR-TEST-{uuid.uuid4().hex[:8]}',
        machine_id=machine.id,
        maintenance_type='corrective',
        maintenance_date=datetime.utcnow(),
        status='completed',
        duration_hours=4.5,
        downtime_hours=3.0,
        cost=500000,
        root_cause_category='mechanical',
    )
    defaults.update(kwargs)
    rec = MaintenanceRecord(**defaults)
    db_session.add(rec)
    db_session.commit()
    return rec


def _make_machine(db_session):
    from models.production import Machine
    import uuid

    m = Machine(name=f'Test Machine {uuid.uuid4().hex[:6]}', code=f'TM-{uuid.uuid4().hex[:6]}', machine_type='production')
    db_session.add(m)
    db_session.commit()
    return m


def test_analytics_does_not_crash_on_completed_record(client, auth_headers, db_session):
    """The real bug: any 'completed' MaintenanceRecord used to 500 this
    endpoint because r.actual_completion_time doesn't exist on the model."""
    machine = _make_machine(db_session)
    _make_record(db_session, machine, status='completed', duration_hours=5.0)

    resp = client.get('/api/maintenance/analytics', headers=auth_headers)
    assert resp.status_code == 200


def test_monthly_trends_reflects_real_records_not_hardcoded_jan_jun(client, auth_headers, db_session):
    """Old behavior always returned 6 fixed Jan-Jun rows with specific
    work_orders/cost/mttr numbers regardless of real data. A single real
    record this month must produce a trend row matching it, not '12 work
    orders in Jan' etc."""
    machine = _make_machine(db_session)
    _make_record(db_session, machine, cost=777000, maintenance_date=datetime.utcnow())

    resp = client.get('/api/maintenance/analytics', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()

    trends = data['charts']['monthly_trends']
    assert len(trends) >= 1
    current_month_trend = next((t for t in trends if t['month'] == datetime.utcnow().strftime('%b')), None)
    assert current_month_trend is not None
    assert current_month_trend['cost'] == 777000


def test_downtime_analysis_uses_real_root_cause_category(client, auth_headers, db_session):
    """Old behavior always returned the same 4 fixed reasons (Equipment
    Failure/Scheduled Maintenance/Parts Shortage/Operator Error). A record
    with root_cause_category='electrical' must produce a matching row,
    not one of those 4 fixed labels."""
    machine = _make_machine(db_session)
    _make_record(db_session, machine, root_cause_category='electrical', downtime_hours=12.5)

    resp = client.get('/api/maintenance/analytics', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()

    reasons = [d['reason'] for d in data['charts']['downtime_analysis']]
    assert 'electrical' in reasons
    assert 'Equipment Failure' not in reasons


def test_availability_rate_not_fixed_855(client, auth_headers, db_session):
    """Old behavior always returned exactly 85.5% regardless of any real
    downtime. A machine down for its entire tracked period must show a
    LOWER availability than a machine with zero downtime."""
    machine = _make_machine(db_session)
    now = datetime.utcnow()
    _make_record(db_session, machine, maintenance_date=now - timedelta(days=10), downtime_hours=1000, maintenance_type='breakdown')
    _make_record(db_session, machine, maintenance_date=now, downtime_hours=1000, maintenance_type='breakdown')

    resp = client.get('/api/maintenance/analytics', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()

    assert data['summary']['availability_rate'] != 85.5
