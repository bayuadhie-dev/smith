"""Perpindahan karantina QC tidak lagi ditulis ke buku stok.

Masukan Finance 2026-11-20: satu penerimaan yang diperiksa QC memunculkan
sepasang baris transfer_out + transfer_in dengan jumlah sama di detik yang sama.
Barangnya tidak pernah benar-benar keluar masuk gudang - cuma pindah rak - jadi
barisnya dihapus, bukan disembunyikan. Selisih jumlah yang sebenarnya tetap
dicatat sebagai adjustment.
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
    item = grn.items[0]

    r2 = client.post(f'/api/purchasing/grn/{grn.id}/inspect', headers=auth_headers, json={
        'items': [{'id': item.id, 'quantity_accepted': diterima, 'quantity_rejected': ditolak}],
    })
    assert r2.status_code in (200, 201), r2.get_json()
    return grn


def _mutasi(grn_id, *refs):
    from models.wms_advanced import InventoryTransaction
    return InventoryTransaction.query.filter(InventoryTransaction.reference_id == grn_id,
                                             InventoryTransaction.reference_type.in_(refs)).all()


def test_pindah_karantina_tidak_menulis_mutasi(client, auth_headers, db_session, test_material):
    """100 diterima -> 20 ditolak: 20 cuma pindah ke karantina, bukan keluar gudang."""
    grn = _grn_diperiksa(client, auth_headers, db_session, test_material, diterima=80, ditolak=20)

    rows = _mutasi(grn.id, 'grn_inspection', 'grn_inspection_reject')
    assert not [t for t in rows if t.transaction_type in ('transfer_in', 'transfer_out')], \
        'perpindahan karantina tidak boleh menghasilkan baris mutasi'


def test_selisih_jumlah_sebenarnya_tetap_dicatat(client, auth_headers, db_session, test_material):
    """Kalau jumlah totalnya ikut berubah (bukan sekadar pindah), itu mutasi beneran."""
    grn = _grn_diperiksa(client, auth_headers, db_session, test_material, diterima=90, ditolak=0)

    rows = _mutasi(grn.id, 'grn_inspection')
    assert [t for t in rows if t.transaction_type == 'adjustment'], \
        'pengurangan 10 KG tanpa karantina harus tercatat sebagai penyesuaian'
