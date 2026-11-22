"""Laporan Produksi per Produk harus bisa dibuka.

Endpoint ini memakai ProductionRecord.quantity_reject dan .waste_kg - dua
kolom yang tidak pernah ada di model (yang ada quantity_scrap dan
quantity_rework), jadi sejak ditulis halamannya selalu menjawab 500.
Nama bulannya juga ikut locale server sehingga keluar "October".
"""
from datetime import date, datetime, timedelta

import pytest


@pytest.fixture
def catatan_produksi(db_session, test_product):
    from models.production import WorkOrder, ProductionRecord

    wo = WorkOrder(wo_number='WO-LPP-1', product_id=test_product.id,
                   quantity=100, uom='PCS', status='completed')
    db_session.add(wo)
    db_session.commit()

    db_session.add(ProductionRecord(
        work_order_id=wo.id, product_id=test_product.id,
        production_date=datetime.combine(date.today() - timedelta(days=1), datetime.min.time()),
        quantity_produced=100, quantity_good=90, quantity_scrap=10, quantity_rework=2,
        uom='PCS'))
    db_session.commit()
    return wo


def test_laporan_tidak_lagi_500(client, auth_headers, catatan_produksi):
    awal = (date.today() - timedelta(days=7)).isoformat()
    akhir = date.today().isoformat()

    r = client.get(f'/api/reports/production-by-product?start_date={awal}&end_date={akhir}&period_type=monthly',
                   headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    d = r.get_json()

    periode = d['periods'][0]
    assert periode['total_produced'] == 100
    assert periode['total_good'] == 90
    # quantity_scrap dilaporkan sebagai "tidak lolos".
    assert periode['total_reject'] == 10


def test_nama_bulan_berbahasa_indonesia(client, auth_headers, catatan_produksi):
    awal = (date.today() - timedelta(days=7)).isoformat()
    akhir = date.today().isoformat()

    r = client.get(f'/api/reports/production-by-product?start_date={awal}&end_date={akhir}&period_type=monthly',
                   headers=auth_headers)
    label = r.get_json()['periods'][0]['period_label']

    # 'November' sama persis di kedua bahasa, jadi tidak dipakai sebagai bukti.
    bulan_inggris = ('January', 'February', 'March', 'May', 'June', 'July',
                     'August', 'October', 'December')
    assert not any(b in label for b in bulan_inggris), label
    assert str(date.today().year) in label
