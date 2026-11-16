"""Status mesin: hanya nilai yang sah yang boleh masuk (routes/production.py)."""
from models import db
from models.production import Machine
from routes.production import MACHINE_STATUSES


def _machine(db_session, status='idle'):
    m = Machine(code='MC-UJI', name='Mesin Uji', machine_type='wet_wipes', status=status, is_active=True)
    db_session.add(m)
    db_session.commit()
    return m


def test_status_di_luar_daftar_ditolak(client, auth_headers, db_session):
    m = _machine(db_session)
    r = client.put(f'/api/production/machines/{m.id}', json={'status': 'active'}, headers=auth_headers)
    assert r.status_code == 400 and 'Status mesin' in r.get_json()['error']
    db.session.refresh(m)
    assert m.status == 'idle'


def test_status_sah_diterima_dan_tidak_peduli_huruf_besar(client, auth_headers, db_session):
    m = _machine(db_session)
    assert client.put(f'/api/production/machines/{m.id}', json={'status': 'BREAKDOWN'}, headers=auth_headers).status_code == 200
    db.session.refresh(m)
    assert m.status == 'breakdown'
    assert set(MACHINE_STATUSES) == {'idle', 'running', 'maintenance', 'breakdown', 'offline'}
