from datetime import date, timedelta

from models.production import Machine
from models import SparePartRequest, MaintenanceSchedule


def _machines(db_session, n=2):
    ms = [Machine(code=f'MC-PM-{i}', name=f'Mesin PM {i}', machine_type='nonwoven_machine', status='idle') for i in range(n)]
    db_session.add_all(ms); db_session.commit()
    return ms


def test_bulk_schedule_with_parts_and_auto_request(client, auth_headers, db_session):
    ms = _machines(db_session)
    p = client.post('/api/spare-parts', headers=auth_headers, json={'part_number': 'OIL-68', 'part_name': 'Oli hidrolik 68', 'uom': 'liter', 'opening_stock': 50}).get_json()['id']
    due = (date.today() - timedelta(days=2)).isoformat()
    r = client.post('/api/maintenance/schedules/bulk', headers=auth_headers, json={
        'machine_ids': [m.id for m in ms], 'maintenance_type': 'preventive', 'frequency': 'monthly', 'frequency_value': 1,
        'next_maintenance_date': due, 'estimated_duration_hours': 2, 'parts': [{'spare_part_id': p, 'qty': 4}]})
    assert r.status_code == 201, r.get_json()
    ids = r.get_json()['schedule_ids']
    assert len(ids) == 2

    lst = client.get('/api/maintenance/schedules', headers=auth_headers).get_json()
    assert lst['summary']['total'] == 2 and lst['summary']['overdue'] == 2
    assert lst['schedules'][0]['parts'][0]['qty'] == 4 and lst['schedules'][0]['machine_code'].startswith('MC-PM')
    assert client.get('/api/maintenance/schedules?overdue=1', headers=auth_headers).get_json()['summary']['total'] == 2

    g = client.post(f'/api/maintenance/schedules/{ids[0]}/generate', headers=auth_headers)
    assert g.status_code in (200, 201), g.get_json()
    req = SparePartRequest.query.filter_by(machine_id=ms[0].id).one()
    assert req.status == 'pending' and float(req.items[0].qty_requested) == 4 and req.maintenance_record_id
    nxt = client.get(f'/api/maintenance/schedules/{ids[0]}', headers=auth_headers).get_json()
    assert nxt['next_maintenance_date'] > due and nxt['last_maintenance_date'] == due


def test_schedule_validation_update_and_deactivate(client, auth_headers, db_session):
    m = _machines(db_session, 1)[0]
    bad = client.post('/api/maintenance/schedules', headers=auth_headers, json={'machine_id': m.id, 'maintenance_type': 'preventive', 'frequency': 'tiap-kamis', 'frequency_value': 1, 'next_maintenance_date': '2026-12-01'})
    assert bad.status_code == 400
    ok = client.post('/api/maintenance/schedules', headers=auth_headers, json={'machine_id': m.id, 'maintenance_type': 'preventive', 'frequency': 'weekly', 'frequency_value': 2, 'next_maintenance_date': '2026-12-01'})
    sid = ok.get_json()['schedule_id']
    assert client.put(f'/api/maintenance/schedules/{sid}', headers=auth_headers, json={'frequency_value': 0}).status_code == 400
    assert client.put(f'/api/maintenance/schedules/{sid}', headers=auth_headers, json={'frequency': 'monthly', 'frequency_value': 3, 'notes': 'cek oli'}).status_code == 200
    d = client.get(f'/api/maintenance/schedules/{sid}', headers=auth_headers).get_json()
    assert d['frequency'] == 'monthly' and d['frequency_value'] == 3 and d['notes'] == 'cek oli'
    assert client.delete(f'/api/maintenance/schedules/{sid}', headers=auth_headers).status_code == 200
    assert client.get('/api/maintenance/schedules', headers=auth_headers).get_json()['summary']['total'] == 0
    assert client.get('/api/maintenance/schedules?include_inactive=1', headers=auth_headers).get_json()['summary']['total'] == 1
