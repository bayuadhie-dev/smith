"""Halaman "Stok & Mutasi Barang" harus menjawab semuanya dalam satu layar.

User: "detail material per gudang bisa diklik untuk menampilkan detail yg sangat
lengkap beserta mutasinya".
"""
from datetime import date, datetime, timedelta


def _stok_dan_mutasi(db_session, test_material):
    from models.warehouse import Inventory, WarehouseLocation, WarehouseZone
    from models.wms_advanced import InventoryTransaction

    z = WarehouseZone(code='Z-DET', name='Gudang Bahan Baku', material_type='raw_materials')
    db_session.add(z)
    db_session.commit()
    l = WarehouseLocation(zone_id=z.id, location_code='LOC-DET', rack='R1', level='L1',
                          position='P1', capacity=0, capacity_uom='KG')
    db_session.add(l)
    db_session.commit()
    db_session.add(Inventory(material_id=test_material.id, location_id=l.id, batch_number='B-1',
                             quantity_on_hand=60, quantity_available=50, quantity_reserved=10,
                             expiry_date=date.today() + timedelta(days=30),
                             stock_status='available', is_active=True))
    for i, (jenis, arah, qty) in enumerate([('receipt', 'in', 100), ('stock_out', 'out', 40)], start=1):
        db_session.add(InventoryTransaction(
            material_id=test_material.id, transaction_number=f'TRX-DET-{i}', transaction_type=jenis,
            direction=arah, quantity=qty, transaction_date=datetime(2026, 11, 10 + i),
            to_location_id=l.id if arah == 'in' else None,
            from_location_id=l.id if arah == 'out' else None, batch_number='B-1'))
    db_session.commit()
    return l


def test_detail_lengkap_dengan_saldo_berjalan(client, auth_headers, db_session, test_material):
    _stok_dan_mutasi(db_session, test_material)

    r = client.get(f'/api/stock-transfers/item-stock?material_id={test_material.id}', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    d = r.get_json()

    assert d['item']['code'] == test_material.code and d['item']['uom'] == 'KG'
    assert d['summary']['total_on_hand'] == 60
    assert d['summary']['total_reserved'] == 10
    assert d['summary']['batches'] == 1 and d['summary']['locations'] == 1
    assert d['summary']['nearest_expiry'] is not None

    baris = d['stock'][0]
    assert baris['expiry_date'] and baris['reserved'] == 10

    # mutasi terbaru di atas, saldo berjalan dihitung dari yang tertua
    assert [m['quantity'] for m in d['movements']] == [40, 100]
    assert [m['balance'] for m in d['movements']] == [60, 100]


def test_saring_periode_mutasi(client, auth_headers, db_session, test_material):
    _stok_dan_mutasi(db_session, test_material)

    r = client.get(f'/api/stock-transfers/item-stock?material_id={test_material.id}'
                   '&date_from=2026-11-12&date_to=2026-11-12', headers=auth_headers)
    moves = r.get_json()['movements']
    assert len(moves) == 1 and moves[0]['quantity'] == 40
