"""Tanggal kedaluwarsa terbawa sampai ke baris stok.

Tanpa ini laporan "Batch Segera Kedaluwarsa" dan urutan FEFO di faktur penjualan
tidak punya bahan: tanggalnya hanya tersimpan di baris penerimaan, tidak pernah
sampai ke stok gudang.
"""
from datetime import date, timedelta


def test_masa_simpan_dibaca_dari_master_yang_benar():
    from utils.expiry_helper import hitung_kedaluwarsa, masa_simpan_hari

    class Produk:
        self_life_days = 180

    class Bahan:
        expiry_days = 30

    assert masa_simpan_hari(product=Produk()) == 180
    assert masa_simpan_hari(material=Bahan()) == 30
    assert masa_simpan_hari() is None

    mulai = date(2026, 11, 20)
    assert hitung_kedaluwarsa(base_date=mulai, product=Produk()) == date(2027, 5, 19)
    # tanggal yang diketik selalu menang atas hitungan masa simpan
    assert hitung_kedaluwarsa('2026-12-31', mulai, product=Produk()) == date(2026, 12, 31)
    assert hitung_kedaluwarsa(base_date=mulai) is None


def test_tanggal_terpendek_yang_dipakai_pada_baris_stok_yang_sama():
    """Satu baris stok bisa menampung beberapa penerimaan batch yang sama."""
    from utils.expiry_helper import isi_kedaluwarsa_stok

    class Baris:
        expiry_date = date(2027, 1, 10)
        production_date = None

    b = Baris()
    isi_kedaluwarsa_stok(b, explicit='2027-06-01')
    assert b.expiry_date == date(2027, 1, 10), 'yang lebih panjang tidak boleh menimpa'
    isi_kedaluwarsa_stok(b, explicit='2026-12-01')
    assert b.expiry_date == date(2026, 12, 1), 'yang lebih pendek menang'


def test_penerimaan_barang_menurunkan_kedaluwarsa_ke_stok(client, auth_headers, db_session, test_material):
    """GRN dengan tanggal kedaluwarsa -> baris stok ikut punya tanggalnya."""
    from models.purchasing import Supplier, PurchaseOrder, PurchaseOrderItem
    from models.warehouse import Inventory, WarehouseLocation, WarehouseZone

    zona = WarehouseZone(code='Z-EXPF', name='Gudang Bahan Baku', material_type='raw_materials')
    db_session.add(zona)
    db_session.commit()
    lok = WarehouseLocation(zone_id=zona.id, location_code='LOC-EXPF', rack='R1', level='L1',
                            position='P1', capacity=10000, capacity_uom='kg')
    sup = Supplier(code='SUP-EXP', company_name='PT Pemasok Uji')
    db_session.add_all([lok, sup])
    db_session.commit()

    po = PurchaseOrder(po_number='PO-EXP-1', supplier_id=sup.id, order_date=date.today(),
                       status='approved', currency='IDR', subtotal=1000, total_amount=1000)
    db_session.add(po)
    db_session.commit()
    poi = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=test_material.id,
                            description=test_material.name, quantity=100, unit_price=10,
                            total_price=1000, uom='KG')
    db_session.add(poi)
    db_session.commit()

    kedaluwarsa = (date.today() + timedelta(days=45)).isoformat()
    r = client.post('/api/purchasing/grn', headers=auth_headers, json={
        'po_id': po.id,
        'receipt_date': date.today().isoformat(),
        'items': [{'po_item_id': poi.id, 'material_id': test_material.id,
                   'quantity_received': 100, 'quantity_accepted': 100,
                   'uom': 'KG', 'batch_number': 'B-EXP-1', 'expiry_date': kedaluwarsa,
                   'location_id': lok.id}],
    })
    assert r.status_code in (200, 201), r.get_json()
    inv = Inventory.query.filter_by(material_id=test_material.id, batch_number='B-EXP-1').first()
    assert inv is not None, 'stok harus terbentuk dari penerimaan'
    assert inv.expiry_date.isoformat() == kedaluwarsa


def test_hasil_produksi_dapat_batch_dan_kedaluwarsa(client, auth_headers, db_session, test_product, test_user):
    """Persetujuan produksi memindahkan barang jadi ke gudang: batch dan masa simpannya ikut."""
    from datetime import timedelta
    from models.production import WorkOrder, ProductionApproval, WIPStock
    from models.warehouse import Inventory, WarehouseLocation, WarehouseZone

    test_product.self_life_days = 120
    zona = WarehouseZone(code='Z-FG-EXP', name='Gudang Barang Jadi', material_type='finished_goods')
    db_session.add(zona)
    db_session.commit()
    # Rute memakai lokasi id 3 (gudang barang jadi bawaan)
    while WarehouseLocation.query.count() < 3:
        n = WarehouseLocation.query.count() + 1
        db_session.add(WarehouseLocation(zone_id=zona.id, location_code=f'LOC-FG-{n}', rack='R1',
                                         level='L1', position=f'P{n}', capacity=1000, capacity_uom='pcs'))
        db_session.commit()

    wo = WorkOrder(wo_number='WO-EXP-1', product_id=test_product.id, quantity=100, uom='PCS',
                   status='in_progress', batch_number='B-FG-77')
    db_session.add(wo)
    db_session.commit()
    db_session.add(WIPStock(product_id=test_product.id, quantity_pcs=100))
    approval = ProductionApproval(approval_number='PA-EXP-1', work_order_id=wo.id,
                                  quantity_produced=100, quantity_good=100, status='pending',
                                  submitted_by=test_user.id)
    db_session.add(approval)
    db_session.commit()

    r = client.put(f'/api/production/production-approvals/{approval.id}/approve',
                   headers=auth_headers, json={'manager_notes': 'uji'})
    assert r.status_code == 200, r.get_json()

    inv = Inventory.query.filter_by(product_id=test_product.id, batch_number='B-FG-77').first()
    assert inv is not None, 'stok barang jadi harus memakai nomor batch WO'
    assert inv.expiry_date == date.today() + timedelta(days=120)
