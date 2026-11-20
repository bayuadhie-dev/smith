"""Laporan selisih stok fisik vs buku stok.

Dipicu temuan di server kantor: 81 dari 152 barang saldonya beda antara tabel
stok dan jumlah mutasinya, dan 203 baris stok tidak punya riwayat sama sekali.
Sebelumnya tidak ada cara melihat barang MANA yang bermasalah.
"""


def _barang_dengan_selisih(db_session, test_material, stok_fisik, mutasi_masuk):
    from models.warehouse import Inventory, WarehouseLocation, WarehouseZone
    from models.wms_advanced import InventoryTransaction
    from datetime import datetime

    zona = WarehouseZone(code='Z-SVL', name='Zona Uji Selisih', material_type='raw_materials')
    db_session.add(zona)
    db_session.commit()
    lok = WarehouseLocation(zone_id=zona.id, location_code='LOC-SVL', rack='R1', level='L1',
                            position='P1', capacity=1000, capacity_uom='kg')
    db_session.add(lok)
    db_session.commit()
    db_session.add(Inventory(material_id=test_material.id, location_id=lok.id,
                             quantity_on_hand=stok_fisik, quantity_available=stok_fisik,
                             stock_status='available', is_active=True))
    if mutasi_masuk:
        db_session.add(InventoryTransaction(
            material_id=test_material.id, transaction_type='receipt', direction='in',
            quantity=mutasi_masuk, to_location_id=lok.id, transaction_date=datetime(2026, 11, 1),
            transaction_number='TRX-SVL-1'))
    db_session.commit()


def test_selisih_terbaca_dan_barang_tanpa_riwayat_ditandai(client, auth_headers, db_session, test_material):
    _barang_dengan_selisih(db_session, test_material, stok_fisik=120, mutasi_masuk=100)

    r = client.get('/api/finance/reports/stock-vs-ledger', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    data = r.get_json()
    baris = [x for x in data['rows'] if x['code'] == test_material.code]
    assert len(baris) == 1
    assert baris[0]['ledger_qty'] == 100 and baris[0]['stock_qty'] == 120
    assert baris[0]['diff'] == 20 and baris[0]['no_history'] is False
    assert data['summary']['items_differ'] >= 1


def test_stok_tanpa_riwayat_mutasi(client, auth_headers, db_session, test_material):
    _barang_dengan_selisih(db_session, test_material, stok_fisik=55, mutasi_masuk=0)

    r = client.get('/api/finance/reports/stock-vs-ledger', headers=auth_headers)
    baris = [x for x in r.get_json()['rows'] if x['code'] == test_material.code][0]
    assert baris['ledger_qty'] == 0 and baris['stock_qty'] == 55
    assert baris['no_history'] is True
    assert r.get_json()['summary']['items_no_history'] >= 1


def test_barang_yang_cocok_tidak_ikut_tampil(client, auth_headers, db_session, test_material):
    _barang_dengan_selisih(db_session, test_material, stok_fisik=100, mutasi_masuk=100)

    r = client.get('/api/finance/reports/stock-vs-ledger', headers=auth_headers)
    assert not [x for x in r.get_json()['rows'] if x['code'] == test_material.code]

    r2 = client.get('/api/finance/reports/stock-vs-ledger?hide_zero=false', headers=auth_headers)
    assert [x for x in r2.get_json()['rows'] if x['code'] == test_material.code]
