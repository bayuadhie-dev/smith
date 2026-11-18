"""Pencatatan roll spunlace (routes/production_roll.py)."""
from datetime import date

import pytest

from models import db
from models.product import Product
from models.production import WorkOrder
from models.production_roll import ProductionRoll


@pytest.fixture
def kain(db_session):
    p = Product(code='FN-50-76H', name='FN 50 - 76 H', material_type='finished_goods',
                primary_uom='KG', is_active=True)
    db_session.add(p)
    db_session.commit()
    # Setiap roll wajib menunjuk SPK (NJO) sejak 2026-11-18, jadi fixture kain
    # sekalian menyiapkan satu NJO aktif yang dipakai _body() sebagai bawaan.
    db_session.add(WorkOrder(wo_number='NJO-UJI-1', product_id=p.id, quantity=1000, uom='KG', status='released'))
    db_session.commit()
    return p


def _njo():
    return WorkOrder.query.filter_by(wo_number='NJO-UJI-1').first()


def _body(kain, **kw):
    b = {'roll_number': 500, 'product_id': kain.id, 'produced_at': date.today().isoformat(),
         'gross_weight_kg': 130, 'net_weight_kg': 125, 'grade': 'A', 'shift': 'Pagi',
         'work_order_id': _njo().id}
    b.update(kw)
    return b


def _post(client, headers, kain, **kw):
    return client.post('/api/production/rolls', json=_body(kain, **kw), headers=headers)


def test_catat_roll_dan_aturannya(client, auth_headers, kain):
    r = _post(client, auth_headers, kain)
    assert r.status_code == 201, r.get_json()
    roll = r.get_json()
    assert roll['display_number'] == '500' and roll['cycle'] == 1 and roll['status'] == 'available'

    assert _post(client, auth_headers, kain, roll_number=10001).status_code == 400          # di luar deret
    assert _post(client, auth_headers, kain, roll_number=0).status_code == 400
    berat = _post(client, auth_headers, kain, roll_number=501, net_weight_kg=140)
    assert berat.status_code == 400 and 'berat kotor' in berat.get_json()['error']           # bersih > kotor
    assert _post(client, auth_headers, kain, roll_number=502, grade='D').status_code == 400


def test_nomor_bentrok_diperingatkan_lalu_boleh_dilanjutkan(client, auth_headers, kain):
    _post(client, auth_headers, kain)
    ulang = _post(client, auth_headers, kain)
    assert ulang.status_code == 409
    pesan = ulang.get_json()
    assert pesan['needs_confirmation'] is True and 'masih ada di stok' in pesan['error']
    assert pesan['duplicate_of']['roll_number'] == 500

    lanjut = _post(client, auth_headers, kain, confirm_duplicate=True)
    assert lanjut.status_code == 201
    assert lanjut.get_json()['cycle'] == 2          # putaran berikutnya, bukan menimpa yang lama
    assert ProductionRoll.query.filter_by(roll_number=500).count() == 2


def test_kain_berbeda_boleh_bernomor_sama(client, auth_headers, kain, db_session):
    lain = Product(code='FN-45-76H', name='FN 45 - 76 H', material_type='finished_goods', primary_uom='KG', is_active=True)
    db_session.add(lain)
    db_session.commit()
    assert _post(client, auth_headers, kain).status_code == 201
    r = client.post('/api/production/rolls', json=_body(lain), headers=auth_headers)
    assert r.status_code == 201 and r.get_json()['cycle'] == 1    # pembedanya jenis kain


def test_daftar_ringkasan_dan_pembatalan(client, auth_headers, kain):
    a = _post(client, auth_headers, kain, roll_number=1, net_weight_kg=120, gross_weight_kg=126).get_json()
    _post(client, auth_headers, kain, roll_number=2, net_weight_kg=100, gross_weight_kg=105, grade='B')
    _post(client, auth_headers, kain, roll_number=3, net_weight_kg=80, gross_weight_kg=85, grade='C')

    daftar = client.get('/api/production/rolls?q=1', headers=auth_headers).get_json()
    assert daftar['total'] == 1 and daftar['rolls'][0]['roll_number'] == 1

    ringkas = client.get('/api/production/rolls/summary', headers=auth_headers).get_json()
    assert ringkas['rolls'] == 3 and ringkas['net_kg'] == 300
    assert {g['grade']: g['rolls'] for g in ringkas['by_grade']} == {'A': 1, 'B': 1, 'C': 1}

    batal = client.post(f"/api/production/rolls/{a['id']}/cancel", json={'reason': 'salah timbang'}, headers=auth_headers)
    assert batal.status_code == 200 and batal.get_json()['status'] == 'cancelled'
    assert client.get('/api/production/rolls/summary', headers=auth_headers).get_json()['rolls'] == 2
    # nomor yang sudah dibatalkan boleh dipakai lagi tanpa peringatan
    assert _post(client, auth_headers, kain, roll_number=1).status_code == 201


def test_ubah_roll_dan_mesin_spunlace_tersedia(client, auth_headers, kain, db_session):
    from models.production import Machine
    db_session.add(Machine(code='SPUNLACE-01', name='Mesin Spunlace', machine_type='spunlace',
                           department='Spunlace', status='idle', is_active=True))
    db_session.commit()
    meta = client.get('/api/production/rolls/meta', headers=auth_headers).get_json()
    assert [m['code'] for m in meta['machines']] == ['SPUNLACE-01']
    assert [g['value'] for g in meta['grades']] == ['A', 'B', 'C']

    roll = _post(client, auth_headers, kain, machine_id=meta['machines'][0]['id']).get_json()
    ubah = client.put(f"/api/production/rolls/{roll['id']}", json={'net_weight_kg': 123, 'grade': 'B'}, headers=auth_headers)
    assert ubah.status_code == 200
    assert ubah.get_json()['net_weight_kg'] == 123 and ubah.get_json()['grade'] == 'B'


# --- Tahap 2: roll masuk stok kain ---

def _gudang_kain(db_session):
    from models.warehouse import WarehouseLocation, WarehouseZone
    z = WarehouseZone.query.filter_by(code='WH-KAIN').first()
    if not z:
        z = WarehouseZone(code='WH-KAIN', name='Gudang Kain', material_type='wip', is_active=True)
        db_session.add(z)
        db_session.commit()
        db_session.add(WarehouseLocation(zone_id=z.id, location_code='KAIN-01', rack='R1', level='L1',
                                         position='P1', capacity=100000, capacity_uom='kg', is_active=True))
        db_session.commit()
    return z


def _stok(product_id, batch):
    from models.warehouse import Inventory
    rows = Inventory.query.filter_by(product_id=product_id, batch_number=batch).all()
    return sum(float(r.quantity_on_hand or 0) for r in rows)


def test_roll_yang_dicatat_langsung_jadi_stok_kain(client, auth_headers, db_session, kain):
    from models.wms_advanced import InventoryTransaction
    _gudang_kain(db_session)
    r = _post(client, auth_headers, kain, roll_number=701, net_weight_kg=118)
    assert r.status_code == 201, r.get_json()
    d = r.get_json()
    assert d['batch_number'] == '701'
    assert _stok(kain.id, '701') == 118

    mv = InventoryTransaction.query.filter_by(reference_type='production_roll', reference_id=d['id']).one()
    assert mv.direction == 'in' and float(mv.quantity) == 118 and mv.batch_number == '701'

    daftar = client.get('/api/production/rolls', headers=auth_headers).get_json()
    baris = next(x for x in daftar['rolls'] if x['id'] == d['id'])
    assert baris['stock_remaining_kg'] == 118


def test_roll_putaran_kedua_dapat_nomor_batch_sendiri(client, auth_headers, db_session, kain):
    _gudang_kain(db_session)
    _post(client, auth_headers, kain, roll_number=702, net_weight_kg=100)
    kedua = _post(client, auth_headers, kain, roll_number=702, net_weight_kg=90, confirm_duplicate=True)
    assert kedua.status_code == 201
    assert kedua.get_json()['batch_number'] == '702/P2'      # stok lama tidak tertimpa
    assert _stok(kain.id, '702') == 100 and _stok(kain.id, '702/P2') == 90


def test_pembatalan_menarik_stoknya_lagi(client, auth_headers, db_session, kain):
    _gudang_kain(db_session)
    rid = _post(client, auth_headers, kain, roll_number=703, net_weight_kg=120).get_json()['id']
    assert _stok(kain.id, '703') == 120
    batal = client.post(f'/api/production/rolls/{rid}/cancel', json={'reason': 'salah timbang'}, headers=auth_headers)
    assert batal.status_code == 200
    assert _stok(kain.id, '703') == 0


def test_koreksi_berat_ikut_memperbaiki_stok(client, auth_headers, db_session, kain):
    _gudang_kain(db_session)
    rid = _post(client, auth_headers, kain, roll_number=704, net_weight_kg=120).get_json()['id']
    ubah = client.put(f'/api/production/rolls/{rid}', json={'net_weight_kg': 115}, headers=auth_headers)
    assert ubah.status_code == 200
    assert _stok(kain.id, '704') == 115


def test_stok_yang_sudah_dipakai_tidak_bisa_ditarik(client, auth_headers, db_session, kain):
    from models.warehouse import Inventory
    _gudang_kain(db_session)
    rid = _post(client, auth_headers, kain, roll_number=705, net_weight_kg=120).get_json()['id']
    inv = Inventory.query.filter_by(product_id=kain.id, batch_number='705').first()
    inv.quantity_on_hand = 20          # sebagian sudah terkirim
    inv.quantity_available = 20
    db_session.commit()

    batal = client.post(f'/api/production/rolls/{rid}/cancel', json={}, headers=auth_headers)
    assert batal.status_code == 409 and 'sudah dipakai' in batal.get_json()['error']


# --- Tahap 3: sliting main roll jadi jumbo roll ---

def _slit(client, headers, rid, rolls, **kw):
    return client.post(f'/api/production/rolls/{rid}/slit', json={'rolls': rolls, **kw}, headers=headers)


def test_sliting_memecah_main_roll_jadi_jumbo_roll_bernomor_turunan(client, auth_headers, db_session, kain):
    _gudang_kain(db_session)
    induk = _post(client, auth_headers, kain, roll_number=801, net_weight_kg=120, gross_weight_kg=126).get_json()

    r = _slit(client, auth_headers, induk['id'], [
        {'net_weight_kg': 50, 'gross_weight_kg': 52},
        {'net_weight_kg': 40, 'gross_weight_kg': 42, 'grade': 'B'},
    ])
    assert r.status_code == 201, r.get_json()
    d = r.get_json()
    assert [c['display_number'] for c in d['children']] == ['801-1', '801-2']
    assert [c['batch_number'] for c in d['children']] == ['801-1', '801-2']
    assert all(c['roll_type'] == 'jumbo' and c['parent_roll_id'] == induk['id'] for c in d['children'])
    assert d['children'][1]['grade'] == 'B'

    # stok pindah: main roll berkurang 90, jumbo roll bertambah
    assert _stok(kain.id, '801') == 30
    assert _stok(kain.id, '801-1') == 50 and _stok(kain.id, '801-2') == 40
    assert d['remaining_kg'] == 30 and d['parent']['status'] == 'available'


def test_sliting_habis_menutup_main_roll_dan_waste_ikut_dihitung(client, auth_headers, db_session, kain):
    _gudang_kain(db_session)
    induk = _post(client, auth_headers, kain, roll_number=802, net_weight_kg=100).get_json()
    d = _slit(client, auth_headers, induk['id'], [{'net_weight_kg': 95}], waste_kg=5).get_json()
    assert d['remaining_kg'] == 0 and d['parent']['status'] == 'consumed'
    assert _stok(kain.id, '802') == 0 and _stok(kain.id, '802-1') == 95


def test_potongan_tidak_boleh_melebihi_sisa_main_roll(client, auth_headers, db_session, kain):
    _gudang_kain(db_session)
    induk = _post(client, auth_headers, kain, roll_number=803, net_weight_kg=100).get_json()
    r = _slit(client, auth_headers, induk['id'], [{'net_weight_kg': 80}, {'net_weight_kg': 30}])
    assert r.status_code == 400 and 'melebihi sisa' in r.get_json()['error']
    assert _stok(kain.id, '803') == 100          # tidak ada yang berubah


def test_sliting_lanjutan_memakai_nomor_repeat_berikutnya(client, auth_headers, db_session, kain):
    _gudang_kain(db_session)
    induk = _post(client, auth_headers, kain, roll_number=804, net_weight_kg=120).get_json()
    _slit(client, auth_headers, induk['id'], [{'net_weight_kg': 40}])
    lanjut = _slit(client, auth_headers, induk['id'], [{'net_weight_kg': 30}]).get_json()
    assert lanjut['children'][0]['display_number'] == '804-2'

    detail = client.get(f"/api/production/rolls/{induk['id']}", headers=auth_headers).get_json()
    assert sorted(c['display_number'] for c in detail['children']) == ['804-1', '804-2']


def test_waste_sliting_bisa_dikembalikan_ke_gudang_bahan_baku(client, auth_headers, db_session, kain, test_material):
    from models.warehouse import Inventory, WarehouseLocation, WarehouseZone
    _gudang_kain(db_session)
    zona = WarehouseZone(code='RM-WASTE', name='Gudang Bahan Baku', material_type='raw_materials',
                         zone_type='storage', is_active=True)
    db_session.add(zona)
    db_session.commit()
    db_session.add(WarehouseLocation(zone_id=zona.id, location_code='RM-01', rack='R1', level='L1',
                                     position='P1', capacity=10000, capacity_uom='kg', is_active=True))
    db_session.commit()

    induk = _post(client, auth_headers, kain, roll_number=805, net_weight_kg=100).get_json()
    r = _slit(client, auth_headers, induk['id'], [{'net_weight_kg': 90}],
              waste_kg=10, waste_material_id=test_material.id)
    assert r.status_code == 201, r.get_json()
    masuk = Inventory.query.filter_by(material_id=test_material.id, batch_number='805').first()
    assert masuk and float(masuk.quantity_on_hand) == 10


def test_jumbo_roll_tidak_bisa_dipotong_lagi(client, auth_headers, db_session, kain):
    _gudang_kain(db_session)
    induk = _post(client, auth_headers, kain, roll_number=806, net_weight_kg=100).get_json()
    anak = _slit(client, auth_headers, induk['id'], [{'net_weight_kg': 50}]).get_json()['children'][0]
    lagi = _slit(client, auth_headers, anak['id'], [{'net_weight_kg': 10}])
    assert lagi.status_code == 409 and 'main roll' in lagi.get_json()['error']


# --- Status roll mengikuti sisa stoknya ---

def _kosongkan_stok(db_session, product_id, batch, reference_type):
    """Tiru pengiriman atau pemakaian: stok batch habis, dengan mutasi keluarnya."""
    from models.warehouse import Inventory
    from utils.inventory_helpers import record_inventory_transaction
    inv = Inventory.query.filter_by(product_id=product_id, batch_number=batch).first()
    qty = float(inv.quantity_on_hand)
    inv.quantity_on_hand = 0
    inv.quantity_available = 0
    record_inventory_transaction(transaction_type='stock_out', direction='out', quantity=qty,
                                 product_id=product_id, from_location_id=inv.location_id,
                                 batch_number=batch, reference_type=reference_type, created_by=1)
    db_session.commit()


def test_roll_yang_habis_terkirim_otomatis_berstatus_terkirim(client, auth_headers, db_session, kain):
    _gudang_kain(db_session)
    roll = _post(client, auth_headers, kain, roll_number=901, net_weight_kg=126).get_json()
    _kosongkan_stok(db_session, kain.id, '901', 'sales_order')

    daftar = client.get('/api/production/rolls', headers=auth_headers).get_json()
    baris = next(r for r in daftar['rolls'] if r['id'] == roll['id'])
    assert baris['status'] == 'shipped' and baris['stock_remaining_kg'] == 0


def test_roll_yang_habis_dipakai_produksi_berstatus_terpakai(client, auth_headers, db_session, kain):
    _gudang_kain(db_session)
    roll = _post(client, auth_headers, kain, roll_number=902, net_weight_kg=100).get_json()
    _kosongkan_stok(db_session, kain.id, '902', 'material_issue')

    detail = client.get(f"/api/production/rolls/{roll['id']}", headers=auth_headers).get_json()
    assert detail['status'] == 'consumed'


def test_roll_yang_baru_terkirim_sebagian_tetap_di_stok(client, auth_headers, db_session, kain):
    from models.warehouse import Inventory
    _gudang_kain(db_session)
    roll = _post(client, auth_headers, kain, roll_number=903, net_weight_kg=120).get_json()
    inv = Inventory.query.filter_by(product_id=kain.id, batch_number='903').first()
    inv.quantity_on_hand = 40
    inv.quantity_available = 40
    db_session.commit()

    daftar = client.get('/api/production/rolls', headers=auth_headers).get_json()
    baris = next(r for r in daftar['rolls'] if r['id'] == roll['id'])
    assert baris['status'] == 'available' and baris['stock_remaining_kg'] == 40


def test_roll_wajib_menunjuk_spk(client, auth_headers, kain):
    """Keputusan produksi 2026-11-18: wajib mutlak, tidak ada roll tanpa job order."""
    tanpa = client.post('/api/production/rolls', json=_body(kain, work_order_id=None), headers=auth_headers)
    assert tanpa.status_code == 400 and 'SPK' in tanpa.get_json()['error']

    njo = _njo()
    njo.status = 'completed'
    db.session.commit()
    tutup = _post(client, auth_headers, kain)
    assert tutup.status_code == 400 and 'sudah completed' in tutup.get_json()['error']


def test_realisasi_spk_dijumlah_dari_berat_roll(client, auth_headers, kain):
    """Grade A+B jadi hasil baik, grade C masuk waste - jawaban produksi 2026-11-18."""
    _post(client, auth_headers, kain, roll_number=11, gross_weight_kg=130, net_weight_kg=125)
    _post(client, auth_headers, kain, roll_number=12, gross_weight_kg=105, net_weight_kg=100, grade='B')
    c = _post(client, auth_headers, kain, roll_number=13, gross_weight_kg=85, net_weight_kg=80, grade='C').get_json()

    njo = _njo()
    assert float(njo.quantity_good) == 225 and float(njo.quantity_scrap) == 80
    assert float(njo.quantity_produced) == 305

    client.post(f"/api/production/rolls/{c['id']}/cancel", json={'reason': 'salah catat'}, headers=auth_headers)
    db.session.refresh(njo)
    assert float(njo.quantity_scrap) == 0 and float(njo.quantity_produced) == 225


def test_ringkasan_spk_membandingkan_bahan_keluar_dengan_berat_roll(client, auth_headers, kain, db_session, test_user):
    from models.product import Material
    from models.material_issue import MaterialIssue, MaterialIssueItem

    _post(client, auth_headers, kain, roll_number=21, gross_weight_kg=130, net_weight_kg=125)
    _post(client, auth_headers, kain, roll_number=22, gross_weight_kg=85, net_weight_kg=80, grade='C')

    fiber = Material(code='RAYON-A2', name='RAYON A2', material_type='raw_materials',
                     category='fiber', primary_uom='KG')
    db_session.add(fiber)
    db_session.commit()
    issue = MaterialIssue(issue_number='MI-UJI-1', work_order_id=_njo().id, status='issued',
                          issue_date=date.today(), requested_by=test_user.id)
    db_session.add(issue)
    db_session.commit()
    db_session.add(MaterialIssueItem(material_issue_id=issue.id, line_number=1, material_id=fiber.id,
                                     description='RAYON A2', required_quantity=250, issued_quantity=250,
                                     returned_quantity=20, uom='KG'))
    db_session.commit()

    r = client.get(f'/api/production/rolls/spk/{_njo().id}/summary', headers=auth_headers)
    assert r.status_code == 200
    d = r.get_json()
    assert d['is_spunlace'] is True and d['rolls'] == 2
    assert d['net_kg'] == 205 and d['net_good_kg'] == 125 and d['net_reject_kg'] == 80
    assert d['fiber_kg'] == 230                      # 250 keluar - 20 dikembalikan
    assert d['susut_kg'] == 25 and d['materials'][0]['name'] == 'RAYON A2'


def test_tutup_spk_spunlace_butuh_roll_dan_tidak_menggandakan_stok(client, auth_headers, kain, db_session):
    """SPK spunlace tidak lewat batch/packing list; stoknya sudah masuk per roll."""
    from models.production import Machine
    from models.warehouse import Inventory

    mesin = Machine(code='SPUNLACE-UJI', name='Mesin Spunlace', machine_type='spunlace',
                    department='Spunlace', is_active=True)
    db_session.add(mesin)
    db_session.commit()
    kosong = WorkOrder(wo_number='NJO-UJI-KOSONG', product_id=kain.id, quantity=500, uom='KG',
                       status='released', machine_id=mesin.id)
    db_session.add(kosong)
    db_session.commit()

    gagal = client.put(f'/api/production/work-orders/{kosong.id}/complete', json={}, headers=auth_headers)
    assert gagal.status_code == 400
    assert 'Belum ada roll' in ' '.join(gagal.get_json()['missing'])

    _post(client, auth_headers, kain, roll_number=31, gross_weight_kg=130, net_weight_kg=125)
    sebelum = sum(float(i.quantity_on_hand or 0) for i in Inventory.query.filter_by(product_id=kain.id).all())
    ok = client.put(f'/api/production/work-orders/{_njo().id}/complete', json={}, headers=auth_headers)
    assert ok.status_code == 200, ok.get_json()
    sesudah = sum(float(i.quantity_on_hand or 0) for i in Inventory.query.filter_by(product_id=kain.id).all())
    assert sesudah == sebelum          # tidak ada penerimaan barang jadi kedua kali


def test_batal_tutup_spk_spunlace_tidak_mengutak_atik_stok_roll(client, auth_headers, kain):
    from models.warehouse import Inventory

    _post(client, auth_headers, kain, roll_number=41, gross_weight_kg=130, net_weight_kg=125)
    assert client.put(f'/api/production/work-orders/{_njo().id}/complete', json={}, headers=auth_headers).status_code == 200
    sebelum = sum(float(i.quantity_on_hand or 0) for i in Inventory.query.filter_by(product_id=kain.id).all())

    r = client.put(f'/api/production/work-orders/{_njo().id}/revert-to-released', json={}, headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    assert _njo().status == 'released'
    sesudah = sum(float(i.quantity_on_hand or 0) for i in Inventory.query.filter_by(product_id=kain.id).all())
    assert sesudah == sebelum
