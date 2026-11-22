"""Dashboard dan daur hidup produk harus menghitung, bukan mengarang.

Sebelum 2026-11-22:
- /products/dashboard/kpis mengirim nilai persediaan dan peringatan stok
  hardcoded 0;
- /products/lifecycle/timeline mengirim deret buatan (introduction = 2 + i,
  growth = 5 + i, dan seterusnya) yang tidak berasal dari data mana pun;
- /products/lifecycle/products menempelkan omzet qty x Rp15.000 dan
  pertumbuhan tetap per tahap.
"""
from datetime import timedelta

from utils.timezone import get_local_now


def _lokasi(db_session):
    from models.warehouse import WarehouseZone, WarehouseLocation
    z = WarehouseZone(code='Z-PRD', name='Z-PRD', material_type='finished_goods')
    db_session.add(z); db_session.commit()
    l = WarehouseLocation(zone_id=z.id, location_code='LOC-PRD', rack='R1', level='L1',
                          position='P1', capacity=1000, capacity_uom='pcs')
    db_session.add(l); db_session.commit()
    return l


def test_kpi_menghitung_nilai_persediaan_dan_ambang(client, auth_headers, db_session, test_product):
    from models.warehouse import Inventory

    lok = _lokasi(db_session)
    test_product.cost = 2500
    test_product.min_stock_level = 50
    db_session.add(Inventory(product_id=test_product.id, location_id=lok.id,
                             quantity_on_hand=20, quantity_available=20, is_active=True))
    db_session.commit()

    r = client.get('/api/products/dashboard/kpis', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    k = r.get_json()['kpis']

    # 20 x Rp2.500 - bukan 0 seperti versi lama.
    assert k['total_value'] == 50000
    # Stok 20 di bawah ambang 50, jadi dihitung menipis (bukan habis).
    assert k['low_stock_products'] == 1
    assert k['out_of_stock_products'] == 0
    assert k['products_with_threshold'] == 1


def test_peringatan_stok_hanya_untuk_produk_yang_punya_ambang(client, auth_headers, db_session, test_product):
    # Tanpa ambang minimum, "stok habis" tidak berarti apa-apa untuk ratusan
    # baris master data yang belum pernah diproduksi.
    test_product.min_stock_level = 0
    db_session.commit()

    r = client.get('/api/products/dashboard/kpis', headers=auth_headers)
    k = r.get_json()['kpis']
    assert k['products_with_threshold'] == 0
    assert k['low_stock_products'] == 0
    assert k['out_of_stock_products'] == 0

    r = client.get('/api/products/dashboard/stock-alerts', headers=auth_headers)
    assert r.status_code == 200
    assert r.get_json()['alerts'] == []


def test_timeline_daur_hidup_berasal_dari_spk(client, auth_headers, db_session, test_product):
    from models.production import WorkOrder

    db_session.add(WorkOrder(
        wo_number='WO-DAUR-1', product_id=test_product.id, quantity=100, uom='PCS',
        quantity_produced=80, status='completed',
        created_at=get_local_now() - timedelta(days=10)))
    db_session.commit()

    r = client.get('/api/products/lifecycle/timeline?period=6months', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    baris = r.get_json()['timeline']

    # Kunci lama (introduction/growth/maturity/decline) adalah angka karangan
    # dan tidak boleh muncul lagi.
    assert all('introduction' not in b for b in baris)
    assert sum(b['produced'] for b in baris) == 80
    assert sum(b['active_products'] for b in baris) == 1
    assert sum(b['new_products'] for b in baris) == 1


def test_daur_hidup_tidak_mengarang_omzet_dan_pertumbuhan(client, auth_headers, db_session, test_product):
    from models.production import WorkOrder

    db_session.add(WorkOrder(
        wo_number='WO-DAUR-2', product_id=test_product.id, quantity=100, uom='PCS',
        quantity_produced=80, status='completed',
        created_at=get_local_now() - timedelta(days=10)))
    db_session.commit()

    r = client.get('/api/products/lifecycle/products?period=6months', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    produk = r.get_json()['products']
    assert len(produk) == 1
    p = produk[0]

    # Tidak ada faktur penjualan -> omzetnya nol, bukan 80 x Rp15.000.
    assert p['total_revenue'] == 0
    # Tidak ada produksi di periode sebelumnya -> tidak ada yang dibandingkan.
    assert p['growth_rate'] is None
    assert p['total_produced'] == 80
    assert p['work_order_count'] == 1
