"""
Fase 11 (fix_report_2.md, ditemukan lewat testing nyata ke produksi
2026-10-02): Asset.machine_id (kolom "Asset linkage" ke mesin produksi,
ditambah migrasi 2026-09-28, dibaca oleh
utils.maintenance_helpers.resolve_asset_for_machine() untuk mengisi
MaintenanceRecord.asset_id otomatis saat jadwal maintenance di-generate)
TIDAK PERNAH ditangani oleh create_asset() (POST /api/assets) maupun
update_asset() (PUT /api/assets/<id>) di routes/asset_management.py -
field ini diam-diam diabaikan walau endpoint mengembalikan 200/201 sukses.
Akibatnya fitur auto-link Asset<->MaintenanceRecord tidak pernah bisa
berfungsi di produksi (0 Asset punya machine_id terisi), bukan karena
belum sempat diisi tapi karena API-nya memang tidak bisa menyimpannya.

Diverifikasi lewat endpoint HTTP asli di produksi sebelum fix (PUT sukses
tapi machine_id tetap NULL di DB), lalu dikonfirmasi lagi setelah fix.
"""
from datetime import datetime, date


def _create_machine(db_session, code='MC-F11A'):
    from models.production import Machine
    machine = Machine(code=code, name=f'Test Machine {code}', machine_type='test', status='active')
    db_session.add(machine)
    db_session.commit()
    return machine


def test_create_asset_persists_machine_id(client, auth_headers, db_session):
    machine = _create_machine(db_session, code='MC-F11A')

    resp = client.post('/api/assets', json={
        'asset_name': 'Test Asset dengan machine_id saat create',
        'asset_type': 'machine',
        'machine_id': machine.id,
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()
    asset_id = resp.get_json()['asset_id']

    from models.asset_management import Asset
    asset = db_session.get(Asset, asset_id)
    assert asset.machine_id == machine.id, (
        f"machine_id harus tersimpan saat create, dapat {asset.machine_id}"
    )


def test_update_asset_persists_machine_id(client, auth_headers, db_session):
    """Sebelum fix: PUT mengembalikan 200 sukses tapi machine_id diam-diam
    tidak pernah ditulis ke DB - inilah bug intinya."""
    machine = _create_machine(db_session, code='MC-F11B')

    from models.asset_management import Asset
    asset = Asset(asset_code='AST-F11B-001', asset_name='Test Asset tanpa machine_id', asset_type='machine', status='active')
    db_session.add(asset)
    db_session.commit()
    assert asset.machine_id is None

    resp = client.put(f'/api/assets/{asset.id}', json={'machine_id': machine.id}, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    db_session.refresh(asset)
    assert asset.machine_id == machine.id, (
        f"machine_id harus tersimpan setelah PUT, dapat {asset.machine_id} "
        "(bug: field ini sebelumnya diam-diam diabaikan oleh update_asset())"
    )


def test_maintenance_record_auto_links_asset_via_machine_id(client, auth_headers, db_session):
    """End-to-end: Asset.machine_id yang benar tersimpan harus membuat
    generate_maintenance_from_schedule() otomatis mengisi
    MaintenanceRecord.asset_id lewat resolve_asset_for_machine()."""
    machine = _create_machine(db_session, code='MC-F11C')

    from models.asset_management import Asset
    asset = Asset(asset_code='AST-F11C-001', asset_name='Test Asset linked', asset_type='machine', status='active')
    db_session.add(asset)
    db_session.commit()

    resp = client.put(f'/api/assets/{asset.id}', json={'machine_id': machine.id}, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    resp2 = client.post('/api/maintenance/schedules', json={
        'machine_id': machine.id,
        'maintenance_type': 'preventive',
        'frequency': 'monthly',
        'frequency_value': 1,
        'next_maintenance_date': datetime.now().isoformat(),
    }, headers=auth_headers)
    assert resp2.status_code == 201, resp2.get_json()
    schedule_id = resp2.get_json()['schedule_id']

    resp3 = client.post(f'/api/maintenance/schedules/{schedule_id}/generate', json={}, headers=auth_headers)
    assert resp3.status_code == 201, resp3.get_json()
    record_id = resp3.get_json()['record_id']

    from models.maintenance import MaintenanceRecord
    record = db_session.get(MaintenanceRecord, record_id)
    assert record.asset_id == asset.id, (
        f"MaintenanceRecord.asset_id harus otomatis ter-link ke Asset {asset.id} "
        f"lewat machine_id, dapat {record.asset_id}"
    )
