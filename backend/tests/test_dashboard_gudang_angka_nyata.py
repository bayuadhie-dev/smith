"""Dashboard Gudang harus menghitung, bukan memajang nol.

Sebelum 2026-11-22 endpoint ini mengirim mutasi dari tabel mati
(inventory_movements), tidak punya kunci yang dibaca halamannya
(location_utilization, expiring_soon, active_alerts), dan "barang teratas"
diurutkan dari banyaknya mutasi, bukan nilai stok yang dipegang.
"""
from datetime import timedelta

from utils.timezone import get_local_now, get_local_today


def _gudang(db_session, kode='Z-DSB', lokasi='LOC-DSB', kapasitas=1000):
    from models.warehouse import WarehouseZone, WarehouseLocation
    z = WarehouseZone(code=kode, name=kode, material_type='raw_materials')
    db_session.add(z); db_session.commit()
    l = WarehouseLocation(zone_id=z.id, location_code=lokasi, rack='R1', level='L1',
                          position='P1', capacity=kapasitas, capacity_uom='kg')
    db_session.add(l); db_session.commit()
    return l


def test_ringkasan_memakai_angka_yang_dihitung(client, auth_headers, db_session, test_material):
    from models.warehouse import Inventory
    from models.wms_advanced import InventoryTransaction

    lok = _gudang(db_session)
    test_material.cost_per_unit = 1000
    test_material.min_stock_level = 500
    db_session.add(Inventory(material_id=test_material.id, location_id=lok.id, batch_number='B-DSB',
                             quantity_on_hand=100, quantity_available=100, is_active=True,
                             expiry_date=get_local_today() + timedelta(days=10)))
    db_session.add_all([
        InventoryTransaction(transaction_number='IT-D1', transaction_type='stock_in',
                             transaction_date=get_local_now(), material_id=test_material.id,
                             quantity=60, direction='in', to_location_id=lok.id, status='completed'),
        InventoryTransaction(transaction_number='IT-D2', transaction_type='material_issue',
                             transaction_date=get_local_now(), material_id=test_material.id,
                             quantity=10, direction='out', from_location_id=lok.id, status='completed'),
    ])
    db_session.commit()

    r = client.get('/api/warehouse/dashboard', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    d = r.get_json()
    s = d['summary']

    # Kunci yang dibaca halaman harus ada semua
    for kunci in ('location_utilization', 'expiring_soon', 'active_alerts', 'critical_alerts', 'low_stock_items'):
        assert kunci in s, f'{kunci} hilang dari ringkasan'

    assert s['expiring_soon'] >= 1, 'batch kedaluwarsa 10 hari lagi harus terhitung'
    assert s['low_stock_items'] >= 1, 'stok 100 di bawah minimum 500 harus terhitung'
    # 100 dari kapasitas 1000 = 10%
    assert s['location_utilization'] == 10.0, s['location_utilization']

    m = d['movements']
    assert m['receipts'] >= 1 and m['issues'] >= 1, m
    assert m['total_movements'] >= 2

    assert any(x['product'] == test_material.name for x in d['recent_movements']), d['recent_movements']
    teratas = d['top_products']
    assert teratas and teratas[0]['value'] > 0, teratas


def test_utilisasi_null_kalau_tidak_ada_kapasitas(client, auth_headers, db_session, test_material):
    """Kapasitas 0 = tidak dibatasi. Melaporkannya sebagai 0% itu menyesatkan."""
    from models.warehouse import Inventory

    lok = _gudang(db_session, kode='Z-NOCAP', lokasi='LOC-NOCAP', kapasitas=0)
    db_session.add(Inventory(material_id=test_material.id, location_id=lok.id,
                             quantity_on_hand=250, quantity_available=250, is_active=True))
    db_session.commit()

    d = client.get('/api/warehouse/dashboard', headers=auth_headers).get_json()
    assert d['summary']['location_utilization'] is None
