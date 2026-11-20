"""Perpindahan karantina QC tetap tercatat di buku stok.

Sempat dihentikan 2026-11-20 karena dikira baris sampah, padahal yang
mengganggu Finance hanyalah dua baris data contoh di Fengsheng. Pencatatannya
dikembalikan: perpindahan antar gudang memang harus punya jejak.
"""
from datetime import date


def _grn_diperiksa(client, auth_headers, db_session, test_material, diterima, ditolak):
    from models.purchasing import Supplier, PurchaseOrder, PurchaseOrderItem, GoodsReceivedNote
    from models.warehouse import WarehouseLocation, WarehouseZone

    zona = WarehouseZone(code='Z-QC', name='Gudang Bahan Baku', material_type='raw_materials')
    karantina = WarehouseZone(code='Z-KAR', name='Gudang Reject/Karantina', material_type='raw_materials')
    db_session.add_all([zona, karantina])
    db_session.commit()
    db_session.add(WarehouseLocation(zone_id=karantina.id, location_code='LOC-KAR', rack='R1',
                                     level='L1', position='P1', capacity=10000, capacity_uom='kg'))
    db_session.commit()
    lok = WarehouseLocation(zone_id=zona.id, location_code='LOC-QC', rack='R1', level='L1',
                            position='P1', capacity=10000, capacity_uom='kg')
    sup = Supplier(code='SUP-QC', company_name='PT Uji QC')
    db_session.add_all([lok, sup])
    db_session.commit()

    po = PurchaseOrder(po_number='PO-QC-1', supplier_id=sup.id, order_date=date.today(),
                       status='approved', currency='IDR', subtotal=1000, total_amount=1000)
    db_session.add(po)
    db_session.commit()
    poi = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=test_material.id,
                            description=test_material.name, quantity=100, unit_price=10,
                            total_price=1000, uom='KG')
    db_session.add(poi)
    db_session.commit()

    r = client.post('/api/purchasing/grn', headers=auth_headers, json={
        'po_id': po.id, 'receipt_date': date.today().isoformat(),
        'items': [{'po_item_id': poi.id, 'material_id': test_material.id,
                   'quantity_received': 100, 'quantity_accepted': 100, 'uom': 'KG',
                   'batch_number': 'B-QC-1', 'location_id': lok.id}],
    })
    assert r.status_code in (200, 201), r.get_json()
    grn = GoodsReceivedNote.query.order_by(GoodsReceivedNote.id.desc()).first()

    r2 = client.post(f'/api/purchasing/grn/{grn.id}/inspect', headers=auth_headers, json={
        'items': [{'id': grn.items[0].id, 'quantity_accepted': diterima, 'quantity_rejected': ditolak}],
    })
    assert r2.status_code in (200, 201), r2.get_json()
    return grn


def _mutasi(grn_id):
    from models.wms_advanced import InventoryTransaction
    return InventoryTransaction.query.filter(
        InventoryTransaction.reference_id == grn_id,
        InventoryTransaction.reference_type.in_(('grn_inspection', 'grn_inspection_reject'))).all()


def test_pindah_karantina_tercatat_berpasangan(client, auth_headers, db_session, test_material):
    """20 KG ditolak: keluar dari gudang bahan baku, masuk ke karantina."""
    grn = _grn_diperiksa(client, auth_headers, db_session, test_material, diterima=80, ditolak=20)

    jenis = sorted(t.transaction_type for t in _mutasi(grn.id))
    assert jenis == ['transfer_in', 'transfer_out'], jenis
    assert all(float(t.quantity) == 20 for t in _mutasi(grn.id))


def test_selisih_jumlah_dicatat_sebagai_penyesuaian(client, auth_headers, db_session, test_material):
    """Jumlah totalnya ikut berubah (bukan sekadar pindah) - itu penyesuaian, bukan transfer."""
    grn = _grn_diperiksa(client, auth_headers, db_session, test_material, diterima=90, ditolak=0)

    assert [t.transaction_type for t in _mutasi(grn.id)] == ['adjustment']


def test_zona_karantina_ketemu_walau_namanya_gudang_waste(db_session):
    """Gudang Reject berganti nama jadi Gudang Waste - pencarian lokasinya jangan ikut patah."""
    from models.warehouse import WarehouseZone, WarehouseLocation
    from routes.purchasing import _resolve_grn_quarantine_location

    z = WarehouseZone(code='WH-WASTE-UJI', name='Gudang Waste', material_type='all',
                      zone_type='quarantine', is_active=True)
    db_session.add(z)
    db_session.commit()
    db_session.add(WarehouseLocation(zone_id=z.id, location_code='WH-WASTE-UJI-01', rack='R1',
                                     level='L1', position='P1', capacity=1000, capacity_uom='kg'))
    db_session.commit()

    lok = _resolve_grn_quarantine_location()
    assert lok is not None and lok.location_code == 'WH-WASTE-UJI-01'
