"""Pencatatan roll spunlace (routes/production_roll.py)."""
from datetime import date

import pytest

from models import db
from models.product import Product
from models.production_roll import ProductionRoll


@pytest.fixture
def kain(db_session):
    p = Product(code='FN-50-76H', name='FN 50 - 76 H', material_type='finished_goods',
                primary_uom='KG', is_active=True)
    db_session.add(p)
    db_session.commit()
    return p


def _body(kain, **kw):
    b = {'roll_number': 500, 'product_id': kain.id, 'produced_at': date.today().isoformat(),
         'gross_weight_kg': 130, 'net_weight_kg': 125, 'grade': 'A', 'shift': 'Pagi'}
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
