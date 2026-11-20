"""Baris stok 0 tidak ikut tampil di "Barang per Gudang".

Keluhan Finance 2026-11-20: VISCOSE RAYON masih terdaftar di Gudang Reject
dengan stok 0 - sisa batch yang sudah keluar dari karantina.
"""


def _lokasi(db_session, kode_zona, kode_lokasi, tipe='raw_materials'):
    from models.warehouse import WarehouseLocation, WarehouseZone
    z = WarehouseZone(code=kode_zona, name=kode_zona, material_type=tipe)
    db_session.add(z)
    db_session.commit()
    l = WarehouseLocation(zone_id=z.id, location_code=kode_lokasi, rack='R1', level='L1',
                          position='P1', capacity=1000, capacity_uom='kg')
    db_session.add(l)
    db_session.commit()
    return l


def test_baris_kosong_tidak_tampil(client, auth_headers, db_session, test_material):
    from models.warehouse import Inventory

    isi = _lokasi(db_session, 'Z-ISI', 'WH-RM-99')
    kosong = _lokasi(db_session, 'Z-REJ', 'WH-REJECT-99')
    db_session.add_all([
        Inventory(material_id=test_material.id, location_id=isi.id, batch_number='B-ADA',
                  quantity_on_hand=50, quantity_available=50, is_active=True),
        Inventory(material_id=test_material.id, location_id=kosong.id, batch_number='B-HABIS',
                  quantity_on_hand=0, quantity_available=0, quantity_reserved=0, is_active=True),
    ])
    db_session.commit()

    r = client.get('/api/warehouse/inventory?per_page=100', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    batches = [i.get('batch_number') for i in (r.get_json().get('inventory') or r.get_json().get('items') or [])]
    assert 'B-ADA' in batches
    assert 'B-HABIS' not in batches

    r2 = client.get('/api/warehouse/inventory?per_page=100&include_empty=1', headers=auth_headers)
    batches2 = [i.get('batch_number') for i in (r2.get_json().get('inventory') or r2.get_json().get('items') or [])]
    assert 'B-HABIS' in batches2


def test_stok_yang_dipesan_tetap_tampil_walau_fisiknya_nol(client, auth_headers, db_session, test_material):
    """Qty 0 tapi ada yang di-reserve bukan baris sisa - itu barang yang sudah dijanjikan."""
    from models.warehouse import Inventory

    lok = _lokasi(db_session, 'Z-RSV', 'WH-RSV-99')
    db_session.add(Inventory(material_id=test_material.id, location_id=lok.id, batch_number='B-RESERVED',
                             quantity_on_hand=0, quantity_available=0, quantity_reserved=5, is_active=True))
    db_session.commit()

    r = client.get('/api/warehouse/inventory?per_page=100', headers=auth_headers)
    batches = [i.get('batch_number') for i in (r.get_json().get('inventory') or r.get_json().get('items') or [])]
    assert 'B-RESERVED' in batches


def test_detail_lokasi_memakai_isi_stok_sungguhan(client, auth_headers, db_session, test_material):
    """Kolom `occupied` tidak pernah terawat - pemakaian lokasi dihitung dari tabel stok."""
    from models.warehouse import Inventory

    lok = _lokasi(db_session, 'Z-KAP', 'WH-KAP-01')
    lok.capacity = 0            # 0 = tidak dibatasi
    db_session.add(Inventory(material_id=test_material.id, location_id=lok.id, batch_number='B-KAP',
                             quantity_on_hand=1200, quantity_available=1200, is_active=True))
    db_session.commit()

    r = client.get(f'/api/warehouse/locations/{lok.id}', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    d = r.get_json()['location']
    assert d['occupied'] == 1200, 'isi lokasi harus dari tabel stok, bukan kolom occupied'
    assert d['unlimited'] is True
    assert d['available'] is None and d['current_utilization'] is None


def test_riwayat_lokasi_dibaca_dari_tabel_yang_benar(client, auth_headers, db_session, test_material):
    """Tab "Riwayat Pergerakan" dulu membaca inventory_movements yang tidak pernah terisi."""
    from models.wms_advanced import InventoryTransaction
    from utils.timezone import get_local_now

    lok = _lokasi(db_session, 'Z-MUT', 'WH-MUT-01')
    db_session.add_all([
        InventoryTransaction(transaction_number='IT-MASUK', transaction_type='stock_in',
                             transaction_date=get_local_now(), material_id=test_material.id,
                             quantity=100, direction='in', to_location_id=lok.id,
                             batch_number='B-MUT', status='completed'),
        InventoryTransaction(transaction_number='IT-KELUAR', transaction_type='material_issue',
                             transaction_date=get_local_now(), material_id=test_material.id,
                             quantity=40, direction='out', from_location_id=lok.id,
                             batch_number='B-MUT', status='completed'),
    ])
    db_session.commit()

    r = client.get(f'/api/warehouse/locations/{lok.id}', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    mut = r.get_json()['recent_movements']
    assert len(mut) == 2, 'kedua arah harus ikut terbaca'
    arah = {m['reference_number'] or m['movement_type']: m['direction'] for m in mut}
    assert arah['stock_in'] == 'in' and arah['material_issue'] == 'out'
    assert all(m['item_name'] for m in mut), 'nama barang harus ikut'
