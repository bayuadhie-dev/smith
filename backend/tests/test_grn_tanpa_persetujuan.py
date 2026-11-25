"""Saklar "penerimaan langsung disetujui" selama QC belum jalan.

Diputuskan manajemen 2026-11-25: QC belum dilatih dan semua divisi baru mulai
memakai sistem, sementara stok tertahan karantina (53.800 unit di Fengsheng) dan
fakturnya tidak bisa dibuat karena tombolnya mati sampai penerimaan disetujui.
Saklarnya di Pengaturan > Konfigurasi Sistem Lanjutan, hanya boleh diubah akun
pemilik sistem, dan dimatikan lagi begitu QC jalan.
"""
from datetime import date

import pytest

from models import db


def _setel(db_session, nyala):
    from models.settings import SystemSetting
    row = SystemSetting.query.filter_by(setting_key='purchasing.grn_tanpa_persetujuan').first()
    if not row:
        row = SystemSetting(setting_key='purchasing.grn_tanpa_persetujuan',
                            setting_category='purchasing', setting_name='Penerimaan langsung disetujui',
                            data_type='boolean', is_editable=True)
        db_session.add(row)
    row.setting_value = 'true' if nyala else 'false'
    db_session.commit()


@pytest.fixture
def siap(db_session):
    from models.product import Material
    from models.purchasing import PurchaseOrder, PurchaseOrderItem, Supplier
    from models.warehouse import WarehouseLocation, WarehouseZone

    sup = Supplier(code='SUP-QC', company_name='Pemasok QC', is_active=True)
    zona = WarehouseZone(code='Z-QC', name='Gudang QC', zone_type='all', material_type='all')
    # erp_approval = wajib persetujuan, persis seperti seluruh master Fengsheng
    m = Material(code='BHN-QC', name='Bahan QC', material_type='raw_materials', category='Bahan Baku',
                 primary_uom='KG', is_active=True, erp_approval=True)
    db_session.add_all([sup, zona, m])
    db_session.commit()
    lok = WarehouseLocation(zone_id=zona.id, location_code='LOC-QC', rack='R', level='L',
                            position='P', capacity=100000, capacity_uom='kg')
    po = PurchaseOrder(po_number='PO-QC-1', supplier_id=sup.id, order_date=date.today(),
                       status='approved', total_amount=100000)
    db_session.add_all([lok, po])
    db_session.commit()
    item = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=m.id, description=m.name,
                             quantity=100, uom='KG', unit_price=1000, total_price=100000)
    db_session.add(item)
    db_session.commit()
    return {'supplier': sup, 'lokasi': lok, 'material': m, 'po': po, 'item': item}


def _terima(client, headers, siap, qty):
    r = client.post('/api/purchasing/grn', headers=headers, json={
        'po_id': siap['po'].id, 'supplier_id': siap['supplier'].id,
        'received_date': date.today().isoformat(),
        'items': [{'po_item_id': siap['item'].id, 'material_id': siap['material'].id,
                   'quantity_ordered': 100, 'quantity_received': qty, 'uom': 'KG',
                   'location_id': siap['lokasi'].id}]})
    assert r.status_code in (200, 201), r.get_json()
    return r.get_json()['grn_id']


def _grn(grn_id):
    from models.purchasing import GoodsReceivedNote
    return db.session.get(GoodsReceivedNote, grn_id)


def _status_stok(siap):
    from models.warehouse import Inventory
    return [i.stock_status for i in Inventory.query.filter_by(material_id=siap['material'].id).all()]


def test_saklar_mati_penerimaan_tetap_lewat_karantina(client, auth_headers, db_session, siap):
    _setel(db_session, False)
    g = _grn(_terima(client, auth_headers, siap, 10))
    assert g.status == 'pending' and g.approved_at is None
    assert _status_stok(siap) == ['quarantine']


def test_saklar_nyala_penerimaan_langsung_disetujui_dan_stok_langsung_tersedia(
        client, auth_headers, db_session, siap):
    _setel(db_session, True)
    g = _grn(_terima(client, auth_headers, siap, 40))

    assert g.status == 'approved'
    assert g.approved_at is not None and g.approved_by is not None
    assert g.quality_status is None                   # tidak mengaku lulus QC - tidak ada yang memeriksa
    assert _status_stok(siap) == ['available']          # tidak lewat karantina
    assert 'dinonaktifkan' in (g.notes or '')           # alasannya tercatat di dokumen


def test_penerimaan_sebagian_tetap_jalan_saat_saklar_nyala(client, auth_headers, db_session, siap):
    """Syarat dari user: input partial harus tetap bisa."""
    from models.purchasing import PurchaseOrderItem

    _setel(db_session, True)
    _terima(client, auth_headers, siap, 40)
    db_session.refresh(siap['item'])
    assert float(siap['item'].quantity_received) == 40

    _terima(client, auth_headers, siap, 35)             # sisanya menyusul
    db_session.refresh(siap['item'])
    assert float(siap['item'].quantity_received) == 75
    assert float(siap['item'].quantity) == 100          # pesanannya tidak berubah


def test_saklar_hanya_bisa_diubah_akun_pemilik(client, auth_headers, db_session, test_user):
    """Super Admin lain pun tidak boleh - yang menyalakan dan mematikan harus satu
    orang yang tahu konsekuensinya."""
    _setel(db_session, False)
    test_user.is_super_admin = True
    test_user.username = 'internalaudit'
    db_session.commit()

    r = client.post('/api/config/api/configs', headers=auth_headers,
                    json={'updates': [{'key': 'purchasing.grn_tanpa_persetujuan', 'value': 'true'}]})
    assert r.status_code == 403, r.get_json()
    assert 'admin' in r.get_json()['message']

    test_user.username = 'admin'
    db_session.commit()
    ok = client.post('/api/config/api/configs', headers=auth_headers,
                     json={'updates': [{'key': 'purchasing.grn_tanpa_persetujuan', 'value': 'true'}]})
    assert ok.status_code == 200, ok.get_json()
