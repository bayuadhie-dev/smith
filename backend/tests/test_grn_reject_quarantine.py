"""
Fase 4 (audit 29 Sept 2026): inspect_grn() di routes/purchasing.py hanya
mengubah quantity_on_hand sebesar delta accepted. Barang yang ditolak
(quantity_rejected) hanya dicatat sebagai angka di GRNItem, tidak ada baris
Inventory berstatus quarantine/reject di lokasi karantina - stok fisik
yang ditolak hilang dari sistem.

Keputusan pemilik (dikonfirmasi sebelum kode ditulis): pakai zona
'Gudang Reject' yang sudah ada (dari warehouse restructure), dicari lewat
zone_type='quarantine' ATAU nama mengandung 'reject'.

Diverifikasi lewat endpoint HTTP asli (POST /api/purchasing/grn/<id>/inspect).
GRN/PO/Supplier disiapkan langsung lewat db_session (bukan lewat endpoint
create GRN, supaya tes ini fokus ke logika inspect_grn, bukan ikut menguji
ulang alur pembuatan GRN yang sudah dites di tempat lain).
"""
from datetime import date


def _setup_warehouse(db_session, with_quarantine=True):
    from models.warehouse import WarehouseZone, WarehouseLocation

    main_zone = WarehouseZone(code='Z-MAIN', name='Gudang Bahan Baku', material_type='raw_materials')
    db_session.add(main_zone)
    db_session.commit()
    main_location = WarehouseLocation(
        zone_id=main_zone.id, location_code='MAIN-01', rack='R1', level='L1', position='P1',
        capacity=10000, capacity_uom='kg',
    )
    db_session.add(main_location)
    db_session.commit()

    quarantine_location = None
    if with_quarantine:
        reject_zone = WarehouseZone(code='Z-REJECT', name='Gudang Reject', material_type='raw_materials')
        db_session.add(reject_zone)
        db_session.commit()
        quarantine_location = WarehouseLocation(
            zone_id=reject_zone.id, location_code='REJECT-01', rack='R1', level='L1', position='P1',
            capacity=10000, capacity_uom='kg',
        )
        db_session.add(quarantine_location)
        db_session.commit()

    return main_location, quarantine_location


def _setup_grn(db_session, main_location, material):
    from models.purchasing import Supplier, PurchaseOrder, PurchaseOrderItem, GoodsReceivedNote, GRNItem

    supplier = Supplier(code='SUP-GRN-01', company_name='Test Supplier GRN')
    db_session.add(supplier)
    db_session.commit()

    po = PurchaseOrder(
        po_number='PO-GRN-TEST-001', supplier_id=supplier.id, order_date=date.today(), status='confirmed',
    )
    db_session.add(po)
    db_session.commit()

    po_item = PurchaseOrderItem(
        po_id=po.id, line_number=1, material_id=material.id, quantity=100, uom='KG',
        unit_price=10000, total_price=1000000,
    )
    db_session.add(po_item)
    db_session.commit()

    grn = GoodsReceivedNote(
        grn_number='GRN-TEST-001', po_id=po.id, supplier_id=supplier.id, receipt_date=date.today(), status='pending',
    )
    db_session.add(grn)
    db_session.commit()

    grn_item = GRNItem(
        grn_id=grn.id, po_item_id=po_item.id, material_id=material.id,
        quantity_ordered=100, quantity_received=100, quantity_accepted=0, quantity_rejected=0,
        uom='KG', batch_number='BATCH-001', location_id=main_location.id,
    )
    db_session.add(grn_item)
    db_session.commit()

    # Barang diterima di lokasi utama saat receipt (sebelum inspeksi) -
    # existing code inspect_grn() hanya menambah/mengurangi delta ke baris
    # Inventory yang SUDAH ADA di lokasi item, tidak membuat baru (ini
    # perilaku lama, tidak diubah oleh Fase 4).
    from models.warehouse import Inventory
    main_inv = Inventory(
        location_id=main_location.id, material_id=material.id, batch_number='BATCH-001',
        quantity_on_hand=100, quantity_available=100, stock_status='available',
    )
    db_session.add(main_inv)
    db_session.commit()

    return grn, grn_item


def test_grn_reject_creates_quarantine_inventory(client, auth_headers, db_session, test_material):
    main_location, quarantine_location = _setup_warehouse(db_session)
    grn, grn_item = _setup_grn(db_session, main_location, test_material)

    resp = client.post(f'/api/purchasing/grn/{grn.id}/inspect', json={
        'items': [{'id': grn_item.id, 'quantity_accepted': 80, 'quantity_rejected': 20}],
    }, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    from models.warehouse import Inventory
    quarantine_inv = Inventory.query.filter_by(
        location_id=quarantine_location.id, material_id=test_material.id, batch_number='BATCH-001',
    ).first()
    assert quarantine_inv is not None, "Barang reject tidak masuk ke Inventory karantina"
    assert float(quarantine_inv.quantity_on_hand) == 20
    assert quarantine_inv.stock_status == 'rejected'

    # Perhitungan stok barang yang DITERIMA (accepted) sengaja tidak diubah
    # di Fase 4 ("Jangan mengubah perhitungan stok barang yang diterima") -
    # baris ini cuma memastikan baris Inventory utama itu masih ada dan
    # delta accepted (0 -> 80) tetap diterapkan seperti sebelumnya (di atas
    # baseline 100 yang sudah ada dari setup "penerimaan").
    main_inv = Inventory.query.filter_by(
        location_id=main_location.id, material_id=test_material.id, batch_number='BATCH-001',
    ).first()
    assert main_inv is not None
    assert float(main_inv.quantity_on_hand) == 180  # 100 (setup) + 80 (delta accepted)

    # Inspeksi ulang dengan nilai SAMA tidak boleh menggandakan stok karantina
    resp2 = client.post(f'/api/purchasing/grn/{grn.id}/inspect', json={
        'items': [{'id': grn_item.id, 'quantity_accepted': 80, 'quantity_rejected': 20}],
    }, headers=auth_headers)
    assert resp2.status_code == 200, resp2.get_json()

    db_session.refresh(quarantine_inv)
    assert float(quarantine_inv.quantity_on_hand) == 20, "Inspeksi ulang menggandakan stok karantina"


def test_grn_reject_without_quarantine_zone_returns_clear_error(client, auth_headers, db_session, test_material):
    main_location, _ = _setup_warehouse(db_session, with_quarantine=False)
    grn, grn_item = _setup_grn(db_session, main_location, test_material)

    resp = client.post(f'/api/purchasing/grn/{grn.id}/inspect', json={
        'items': [{'id': grn_item.id, 'quantity_accepted': 80, 'quantity_rejected': 20}],
    }, headers=auth_headers)
    assert resp.status_code == 500
    assert 'karantina' in resp.get_json()['error'].lower() or 'reject' in resp.get_json()['error'].lower()


def test_po_item_quantity_received_follows_accepted_grn_quantities(client, auth_headers, db_session, test_material):
    from models.purchasing import PurchaseOrderItem
    main_location, _ = _setup_warehouse(db_session)
    grn, grn_item = _setup_grn(db_session, main_location, test_material)
    po_item = db_session.get(PurchaseOrderItem, grn_item.po_item_id)
    assert float(po_item.quantity_received or 0) == 0
    resp = client.post(f'/api/purchasing/grn/{grn.id}/inspect', json={
        'items': [{'id': grn_item.id, 'quantity_accepted': 80, 'quantity_rejected': 20}]}, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    db_session.refresh(po_item)
    assert float(po_item.quantity_received) == 80
    d = client.get(f'/api/purchasing/purchase-orders/{po_item.po_id}', headers=auth_headers).get_json()
    assert d['items'][0]['quantity_received'] == 80.0
