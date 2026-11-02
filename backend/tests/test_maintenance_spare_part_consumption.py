import json

from models import MaintenanceRecord, SparePart
from models.production import Machine


def _setup(client, headers, db_session, stock=10):
    m = Machine(code='MC-CONS', name='Mesin Konsumsi', machine_type='nonwoven_machine', status='idle')
    db_session.add(m); db_session.commit()
    pid = client.post('/api/spare-parts', headers=headers, json={'part_number': 'SEAL-1', 'part_name': 'Seal', 'uom': 'pcs', 'opening_stock': stock}).get_json()['id']
    rec = MaintenanceRecord(record_number='MR-CONS-1', machine_id=m.id, maintenance_type='preventive', status='in_progress',
                            parts_used=json.dumps([{'spare_part_id': pid, 'part_name': 'Seal', 'quantity': 4}]))
    db_session.add(rec); db_session.commit()
    return m, pid, rec


def _stock(db_session, pid):
    db_session.expire_all()
    return float(db_session.get(SparePart, pid).current_stock)


def test_completion_deducts_spare_part_stock(client, auth_headers, db_session):
    m, pid, rec = _setup(client, auth_headers, db_session)
    r = client.patch(f'/api/maintenance/records/{rec.id}', headers=auth_headers, json={'status': 'completed'})
    assert r.status_code == 200, r.get_json()
    assert _stock(db_session, pid) == 6


def test_completion_does_not_double_deduct_after_approved_request(client, auth_headers, db_session):
    m, pid, rec = _setup(client, auth_headers, db_session)
    rq = client.post('/api/spare-parts/requests', headers=auth_headers, json={'maintenance_record_id': rec.id, 'items': [{'spare_part_id': pid, 'qty_requested': 3}]}).get_json()
    assert client.post(f"/api/spare-parts/requests/{rq['request_id']}/approve", headers=auth_headers, json={}).status_code == 200
    assert _stock(db_session, pid) == 7
    r = client.patch(f'/api/maintenance/records/{rec.id}', headers=auth_headers, json={'status': 'completed'})
    assert r.status_code == 200
    assert _stock(db_session, pid) == 6  # dipakai 4, sudah keluar 3, tambah 1


def test_completion_blocked_when_stock_insufficient(client, auth_headers, db_session):
    m, pid, rec = _setup(client, auth_headers, db_session, stock=2)
    r = client.patch(f'/api/maintenance/records/{rec.id}', headers=auth_headers, json={'status': 'completed'})
    assert r.status_code == 400 and 'tidak cukup' in r.get_json()['error']
    db_session.expire_all()
    assert db_session.get(MaintenanceRecord, rec.id).status == 'in_progress'
    assert _stock(db_session, pid) == 2


def test_record_roundtrip_keeps_parts_and_tasks_and_work_order_put_cannot_complete(client, auth_headers, db_session):
    m, pid, rec = _setup(client, auth_headers, db_session)
    r = client.patch(f'/api/maintenance/records/{rec.id}', headers=auth_headers, json={
        'required_parts': [{'spare_part_id': pid, 'part_name': 'Seal', 'quantity': 2}],
        'tasks': [{'task_name': 'Ganti seal', 'description': 'unit A'}, {'task_name': 'Tes tekanan'}]})
    assert r.status_code == 200, r.get_json()
    d = client.get(f'/api/maintenance/records/{rec.id}', headers=auth_headers).get_json()['record']
    assert d['required_parts'][0]['quantity'] == 2 and [t['task_name'] for t in d['tasks']] == ['Ganti seal', 'Tes tekanan']
    bad = client.put(f'/api/maintenance/work-orders/{rec.id}', headers=auth_headers, json={'status': 'completed'})
    assert bad.status_code == 400
    db_session.expire_all()
    assert db_session.get(MaintenanceRecord, rec.id).status == 'in_progress'


def test_analytics_counts_record_scheduled_on_end_date(client, auth_headers, db_session):
    from datetime import date
    m, pid, rec = _setup(client, auth_headers, db_session)
    rec.maintenance_date = __import__('datetime').datetime.combine(date.today(), __import__('datetime').time(14, 30))
    rec.status = 'scheduled'
    db_session.commit()
    d = date.today().isoformat()
    r = client.get(f'/api/maintenance/analytics?date_from={d}&date_to={d}', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    txt = str(r.get_json())
    assert "'total_work_orders': 1" in txt or "'total_work_orders': 1," in txt, txt[:400]
