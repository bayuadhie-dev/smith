"""Laporan batch segera kedaluwarsa.

Sistem tidak memilihkan batch mana yang keluar (sama seperti Accurate), jadi
yang menjaga barang lama tidak tertinggal di gudang adalah laporan ini.
"""
from datetime import timedelta

from utils.timezone import get_local_today


def _stok_batch(db_session, test_product, batch, hari_lagi, qty=10):
    from models.warehouse import Inventory, WarehouseLocation, WarehouseZone

    zona = WarehouseZone.query.filter_by(code='Z-EXP').first()
    if not zona:
        zona = WarehouseZone(code='Z-EXP', name='Gudang Barang Jadi Uji', material_type='finished_goods')
        db_session.add(zona)
        db_session.commit()
    lok = WarehouseLocation.query.filter_by(location_code='LOC-EXP').first()
    if not lok:
        lok = WarehouseLocation(zone_id=zona.id, location_code='LOC-EXP', rack='R1', level='L1',
                                position='P1', capacity=1000, capacity_uom='pcs')
        db_session.add(lok)
        db_session.commit()
    db_session.add(Inventory(product_id=test_product.id, location_id=lok.id, batch_number=batch,
                             expiry_date=get_local_today() + timedelta(days=hari_lagi),
                             quantity_on_hand=qty, quantity_available=qty,
                             stock_status='available', is_active=True))
    db_session.commit()


def test_batch_lewat_dan_mendekati_tanggal(client, auth_headers, db_session, test_product):
    _stok_batch(db_session, test_product, 'B-LEWAT', -5)
    _stok_batch(db_session, test_product, 'B-DEKAT', 20)
    _stok_batch(db_session, test_product, 'B-JAUH', 400)

    r = client.get('/api/finance/reports/near-expiry?days=90', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    data = r.get_json()
    batches = {x['batch_number']: x for x in data['rows']}
    assert 'B-LEWAT' in batches and 'B-DEKAT' in batches
    assert 'B-JAUH' not in batches, 'di luar rentang hari tidak boleh ikut'
    assert batches['B-LEWAT']['bucket'] == 'kedaluwarsa' and batches['B-LEWAT']['days_left'] == -5
    assert batches['B-DEKAT']['bucket'] == '30'
    assert data['summary']['expired'] == 1 and data['summary']['within_30'] == 1
    # yang paling mendesak di urutan pertama
    assert data['rows'][0]['batch_number'] == 'B-LEWAT'


def test_rentang_hari_bisa_diperlebar(client, auth_headers, db_session, test_product):
    _stok_batch(db_session, test_product, 'B-JAUH2', 300)
    r = client.get('/api/finance/reports/near-expiry?days=365', headers=auth_headers)
    assert [x for x in r.get_json()['rows'] if x['batch_number'] == 'B-JAUH2']


def test_stok_habis_tidak_ikut(client, auth_headers, db_session, test_product):
    _stok_batch(db_session, test_product, 'B-KOSONG', 10, qty=0)
    r = client.get('/api/finance/reports/near-expiry', headers=auth_headers)
    assert not [x for x in r.get_json()['rows'] if x['batch_number'] == 'B-KOSONG']
