from datetime import datetime

from models.product import Product
from models.warehouse import WarehouseLocation, WarehouseZone
from utils.inventory_helpers import record_inventory_transaction


def _setup(db_session):
    z1 = WarehouseZone(code='GD1', name='Gudang 1', material_type='finished_goods')
    z2 = WarehouseZone(code='GD2', name='Gudang 2', material_type='finished_goods')
    db_session.add_all([z1, z2])
    db_session.flush()
    l1 = WarehouseLocation(zone_id=z1.id, location_code='GD1-A-1-1', rack='A', level='1', position='1', capacity_uom='PCS')
    l2 = WarehouseLocation(zone_id=z2.id, location_code='GD2-A-1-1', rack='A', level='1', position='1', capacity_uom='PCS')
    p = Product(code='RPT-1', name='Barang Laporan', material_type='finished_goods', primary_uom='PCS', is_active=True)
    db_session.add_all([l1, l2, p])
    db_session.commit()

    def tx(ttype, direction, qty, total, when, frm=None, to=None):
        t = record_inventory_transaction(ttype, direction, qty, product_id=p.id, from_location_id=frm, to_location_id=to,
                                         unit_cost=total / qty, total_cost=total)
        t.transaction_date = datetime.fromisoformat(when)
        return t

    tx('goods_receipt', 'in', 100, 1000, '2026-10-01T09:00:00', to=l1.id)
    tx('sales_delivery', 'out', 30, 300, '2026-10-15T09:00:00', frm=l1.id)
    tx('transfer_out', 'out', 20, 200, '2026-10-20T09:00:00', frm=l1.id)
    tx('transfer_in', 'in', 20, 200, '2026-10-20T09:00:01', to=l2.id)
    tx('goods_receipt', 'in', 50, 600, '2026-11-02T09:00:00', to=l1.id)
    tx('qc_disposition', 'in', 7, 70, '2026-11-03T09:00:00', frm=l1.id, to=l1.id)       # ubah status: netral
    tx('qc_disposition_out', 'out', 7, 70, '2026-11-03T09:00:01', frm=l1.id, to=l1.id)  # pasangannya
    db_session.commit()
    return z1, z2, p


def test_mutasi_persediaan_semua_gudang(client, auth_headers, db_session):
    _setup(db_session)
    r = client.get('/api/finance/reports/inventory-mutation?date_from=2026-11-01&date_to=2026-11-30', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    d = r.get_json()
    assert len(d['rows']) == 1
    row = d['rows'][0]
    # transfer antar gudang dan ubah status tidak dihitung sebagai masuk/keluar
    assert (row['opening_qty'], row['opening_value']) == (70, 700)
    assert (row['in_qty'], row['in_value'], row['out_qty'], row['out_value']) == (50, 600, 0, 0)
    assert (row['closing_qty'], row['closing_value']) == (120, 1300)
    assert d['totals']['closing_qty'] == 120 and d['unvalued_rows'] == 0


def test_mutasi_persediaan_per_gudang_dan_ekspor(client, auth_headers, db_session):
    z1, z2, _ = _setup(db_session)
    d2 = client.get(f'/api/finance/reports/inventory-mutation?date_from=2026-11-01&date_to=2026-11-30&zone_id={z2.id}', headers=auth_headers).get_json()
    assert d2['rows'][0]['opening_qty'] == 20 and d2['rows'][0]['closing_qty'] == 20 and d2['rows'][0]['in_qty'] == 0
    d1 = client.get(f'/api/finance/reports/inventory-mutation?date_from=2026-10-01&date_to=2026-10-31&zone_id={z1.id}', headers=auth_headers).get_json()['rows'][0]
    assert (d1['in_qty'], d1['out_qty'], d1['closing_qty']) == (100, 50, 50)  # keluar 30 penjualan + 20 transfer keluar
    x = client.get('/api/finance/reports/inventory-mutation?date_from=2026-11-01&date_to=2026-11-30&format=xlsx', headers=auth_headers)
    assert x.status_code == 200 and 'spreadsheet' in x.content_type
    p = client.get('/api/finance/reports/inventory-mutation?date_from=2026-11-01&date_to=2026-11-30&format=pdf', headers=auth_headers)
    assert p.status_code == 200 and p.data[:4] == b'%PDF'
    assert client.get('/api/finance/reports/inventory-mutation?date_from=2026-11-30&date_to=2026-11-01', headers=auth_headers).status_code == 400


def test_kuantitas_per_gudang(client, auth_headers, db_session):
    z1, z2, _ = _setup(db_session)
    d = client.get('/api/finance/reports/inventory-by-warehouse?date_to=2026-11-30', headers=auth_headers).get_json()
    assert [z['code'] for z in d['zones']] == ['GD1', 'GD2']
    row = d['rows'][0]
    assert row['by_zone'][str(z1.id)] == {'qty': 100, 'value': 1100} and row['by_zone'][str(z2.id)] == {'qty': 20, 'value': 200}
    assert (row['total_qty'], row['total_value']) == (120, 1300)
    old = client.get('/api/finance/reports/inventory-by-warehouse?date_to=2026-10-10', headers=auth_headers).get_json()['rows'][0]
    assert old['by_zone'][str(z1.id)]['qty'] == 100 and old['by_zone'][str(z2.id)]['qty'] == 0
    assert client.get('/api/finance/reports/inventory-by-warehouse?date_to=2026-11-30&format=xlsx', headers=auth_headers).status_code == 200
    assert client.get('/api/finance/reports/inventory-by-warehouse?date_to=2026-11-30&group=raw_materials', headers=auth_headers).get_json()['rows'] == []


def test_kuantitas_per_gudang_sumber_stok_saat_ini(client, auth_headers, db_session):
    from datetime import date
    from models.warehouse import Inventory
    z1, z2, p = _setup(db_session)
    loc = WarehouseLocation.query.filter_by(zone_id=z1.id).first()
    db_session.add(Inventory(product_id=p.id, location_id=loc.id, quantity_on_hand=40, quantity_available=40, stock_status='available'))
    db_session.commit()
    today = date.today().isoformat()
    d = client.get(f'/api/finance/reports/inventory-by-warehouse?date_to={today}&source=stock', headers=auth_headers).get_json()
    assert d['source'] == 'stock'
    row = d['rows'][0]
    assert row['by_zone'][str(z1.id)]['qty'] == 40 and row['by_zone'][str(z2.id)]['qty'] == 0
    assert abs(row['total_value'] - 40 * 1600 / 150) < 0.01  # rata-rata tertimbang dua penerimaan (transfer tidak dihitung)
    assert client.get('/api/finance/reports/inventory-by-warehouse?date_to=2026-01-01&source=stock', headers=auth_headers).status_code == 400
