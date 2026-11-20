"""Mengubah gudang di form Ubah GRN memindahkan stoknya juga.

Sebelumnya kolom gudang di mode ubah hanya teks: barang sudah terlanjur masuk ke
rak lama dan satu-satunya jalan adalah Transfer Stok. User minta bisa langsung
diubah di form, dengan stok ikut pindah.
"""
from datetime import date


def _siapkan(client, auth_headers, db_session, test_material, qty=100):
    from models.purchasing import Supplier, PurchaseOrder, PurchaseOrderItem, GoodsReceivedNote
    from models.warehouse import WarehouseLocation, WarehouseZone

    z1 = WarehouseZone(code='Z-A', name='Gudang Bahan Baku', material_type='raw_materials')
    z2 = WarehouseZone(code='Z-B', name='Gudang Chemical', material_type='chemical_materials')
    db_session.add_all([z1, z2])
    db_session.commit()
    l1 = WarehouseLocation(zone_id=z1.id, location_code='LOC-A', rack='R1', level='L1', position='P1',
                           capacity=0, capacity_uom='KG')
    l2 = WarehouseLocation(zone_id=z2.id, location_code='LOC-B', rack='R1', level='L1', position='P1',
                           capacity=0, capacity_uom='KG')
    sup = Supplier(code='SUP-MOVE', company_name='PT Uji Pindah')
    db_session.add_all([l1, l2, sup])
    db_session.commit()

    po = PurchaseOrder(po_number='PO-MOVE-1', supplier_id=sup.id, order_date=date.today(),
                       status='approved', currency='IDR', subtotal=1000, total_amount=1000)
    db_session.add(po)
    db_session.commit()
    poi = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=test_material.id,
                            description=test_material.name, quantity=qty, unit_price=10,
                            total_price=1000, uom='KG')
    db_session.add(poi)
    db_session.commit()

    r = client.post('/api/purchasing/grn', headers=auth_headers, json={
        'po_id': po.id, 'receipt_date': date.today().isoformat(),
        'items': [{'po_item_id': poi.id, 'material_id': test_material.id,
                   'quantity_received': qty, 'quantity_accepted': qty, 'uom': 'KG',
                   'batch_number': 'B-MOVE', 'location_id': l1.id}],
    })
    assert r.status_code in (200, 201), r.get_json()
    grn = GoodsReceivedNote.query.order_by(GoodsReceivedNote.id.desc()).first()
    return grn, l1, l2


def _stok(material_id, location_id):
    from models.warehouse import Inventory
    inv = Inventory.query.filter_by(material_id=material_id, location_id=location_id).first()
    return float(inv.quantity_on_hand) if inv else 0.0


def test_ubah_gudang_memindahkan_stok(client, auth_headers, db_session, test_material):
    grn, l1, l2 = _siapkan(client, auth_headers, db_session, test_material, qty=100)
    assert _stok(test_material.id, l1.id) == 100

    r = client.put(f'/api/purchasing/grn/{grn.id}', headers=auth_headers, json={
        'items': [{'id': grn.items[0].id, 'location_id': l2.id}],
    })
    assert r.status_code == 200, r.get_json()

    assert _stok(test_material.id, l1.id) == 0
    assert _stok(test_material.id, l2.id) == 100
    db_session.refresh(grn.items[0])
    assert grn.items[0].location_id == l2.id

    from models.wms_advanced import InventoryTransaction
    mutasi = InventoryTransaction.query.filter_by(reference_type='grn_location_change').all()
    assert sorted(m.transaction_type for m in mutasi) == ['transfer_in', 'transfer_out']


def test_tolak_kalau_stoknya_sudah_terpakai(client, auth_headers, db_session, test_material):
    """Barang yang sudah keluar tidak bisa ikut pindah - jangan diam-diam pindah sisanya."""
    from models.warehouse import Inventory

    grn, l1, l2 = _siapkan(client, auth_headers, db_session, test_material, qty=100)
    inv = Inventory.query.filter_by(material_id=test_material.id, location_id=l1.id).first()
    inv.quantity_on_hand = 40          # 60 sudah dipakai produksi
    db_session.commit()

    r = client.put(f'/api/purchasing/grn/{grn.id}', headers=auth_headers, json={
        'items': [{'id': grn.items[0].id, 'location_id': l2.id}],
    })
    assert r.status_code == 400
    assert 'tinggal' in r.get_json()['error']
    assert _stok(test_material.id, l2.id) == 0


def test_detail_grn_menyebut_gudangnya(client, auth_headers, db_session, test_material):
    """Detail GRN harus menjawab "barangnya ditaruh di mana" tanpa membuka form ubah."""
    grn, l1, _ = _siapkan(client, auth_headers, db_session, test_material, qty=25)

    r = client.get(f'/api/purchasing/grn/{grn.id}', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    item = r.get_json()['items'][0]
    assert item['location_code'] == l1.location_code
    assert item['zone_name'] == 'Gudang Bahan Baku'


def test_persetujuan_grn_melepas_stok_dari_karantina(client, auth_headers, db_session, test_material):
    """Semua barang di master bertanda erp_approval, jadi stok lahir karantina.
    Tanpa pelepasan di persetujuan GRN, barang yang sudah diperiksa tetap terkunci."""
    from models.warehouse import Inventory

    test_material.erp_approval = True
    db_session.commit()
    grn, l1, _ = _siapkan(client, auth_headers, db_session, test_material, qty=50)

    inv = Inventory.query.filter_by(material_id=test_material.id, location_id=l1.id).first()
    inv.stock_status = 'quarantine'
    inv.grn_id = grn.id
    grn.quality_status = 'passed'
    grn.status = 'inspected'
    db_session.commit()

    r = client.post(f'/api/purchasing/grn/{grn.id}/approve', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    assert r.get_json()['stok_dilepas_dari_karantina'] == 1

    db_session.refresh(inv)
    assert inv.stock_status == 'available'


def test_grn_gagal_qc_tidak_melepas_karantina(client, auth_headers, db_session, test_material):
    from models.warehouse import Inventory

    grn, l1, _ = _siapkan(client, auth_headers, db_session, test_material, qty=50)
    inv = Inventory.query.filter_by(material_id=test_material.id, location_id=l1.id).first()
    inv.stock_status = 'quarantine'
    inv.grn_id = grn.id
    grn.quality_status = 'failed'
    grn.status = 'inspected'
    db_session.commit()

    r = client.post(f'/api/purchasing/grn/{grn.id}/approve', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    db_session.refresh(inv)
    assert inv.stock_status == 'quarantine'
