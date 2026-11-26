"""Halaman pengawasan ethanol untuk Bea dan Cukai.

Diminta Bea Cukai 2026-11-25: mereka ingin melihat sendiri perjalanan ethanol,
bukan menunggu laporan dikirim. Yang dijaga tes ini: rantainya utuh dari
penerimaan sampai barang jadi, angkanya benar, harga TIDAK ikut, dan tautannya
tidak bisa dibuka sembarangan.
"""
from datetime import date, datetime

import pytest

from models import db


@pytest.fixture
def ethanol(db_session):
    from models.product import Material
    from models.warehouse import Inventory, WarehouseLocation, WarehouseZone
    from models.wms_advanced import InventoryTransaction

    m = Material(code='1050100013', name='CHEMICAL ETHANOL/ETHYL ALCOHOL',
                 material_type='raw_materials', category='BAHAN KIMIA',
                 primary_uom='LTR', is_active=True)
    z = WarehouseZone(code='WH-ETH-01', name='Gudang Ethanol', zone_type='storage', material_type='all')
    db_session.add_all([m, z])
    db_session.commit()
    lok = WarehouseLocation(zone_id=z.id, location_code='ETH-01', rack='R', level='L',
                            position='P', capacity=10000, capacity_uom='LTR')
    db_session.add(lok)
    db_session.commit()
    db_session.add(Inventory(material_id=m.id, location_id=lok.id, batch_number='TA-04/19112026',
                             quantity_on_hand=2253.56, quantity_available=2253.56,
                             stock_status='available', expiry_date=date(2028, 11, 18), is_active=True))
    for n, (tgl, arah, qty, rt, ref) in enumerate([
            (date(2026, 11, 20), 'in', 2400, 'purchase_order', 'BPB-26/11/005'),
            (date(2026, 11, 24), 'out', 146.44, 'material_issue', 'BON-26/11/001')], start=1):
        db_session.add(InventoryTransaction(
            transaction_number=f'TXN-UJI-{n}', transaction_type='stock_in' if arah == 'in' else 'fifo_deduction',
            transaction_date=datetime.combine(tgl, datetime.min.time()), material_id=m.id,
            quantity=qty, uom='LTR', direction=arah, batch_number='TA-04/19112026',
            reference_type=rt, reference_number=ref, status='completed'))
    db_session.commit()
    return m


@pytest.fixture
def token(app, db_session, ethanol):
    from routes.pengawasan_ethanol import token_pengawasan
    with app.app_context():
        return token_pengawasan()


def test_tautan_salah_ditolak_dan_tidak_membocorkan_apa_pun(client, token):
    r = client.get('/api/pengawasan/ethanol/tebak-tebakan')
    assert r.status_code == 403
    isi = r.get_json()
    assert 'ethanol' not in str(isi).lower() or 'tidak berlaku' in isi['error']
    assert 'mutasi' not in isi and 'ringkasan' not in isi


def test_tautan_benar_menampilkan_rantai_dari_penerimaan_sampai_barang_jadi(client, token):
    r = client.get(f'/api/pengawasan/ethanol/{token}')
    assert r.status_code == 200, r.get_json()
    d = r.get_json()

    assert d['barang']['kode'] == '1050100013' and d['barang']['satuan'] == 'LTR'
    assert d['ringkasan'] == {'saldo_awal': 0.0, 'masuk': 2400.0,
                              'keluar': 146.44, 'saldo_akhir': 2253.56}

    jenis = [m['jenis'] for m in d['mutasi']]
    assert jenis == ['penerimaan', 'pemakaian']
    assert d['mutasi'][0]['no_dokumen'] == 'BPB-26/11/005'
    assert d['mutasi'][1]['no_dokumen'] == 'BON-26/11/001'
    assert d['mutasi'][-1]['saldo'] == 2253.56
    assert d['stok_sekarang'][0]['batch'] == 'TA-04/19112026'
    assert d['data_per']


def test_harga_tidak_pernah_ikut_tampil(client, token):
    """Keputusan 2026-11-25: Bea Cukai mengawasi kuantitas, bukan nilai belanja."""
    isi = str(client.get(f'/api/pengawasan/ethanol/{token}').get_json()).lower()
    for kata in ('harga', 'price', 'unit_cost', 'total_cost', 'nilai_rupiah'):
        assert kata not in isi, f'"{kata}" bocor ke halaman pengawasan'


def test_periode_menyaring_dan_saldo_awal_ikut_bergeser(client, token):
    d = client.get(f'/api/pengawasan/ethanol/{token}?dari=2026-11-22').get_json()
    assert d['ringkasan']['saldo_awal'] == 2400.0      # penerimaan 20 Nov jadi saldo awal
    assert d['ringkasan']['masuk'] == 0.0
    assert d['ringkasan']['keluar'] == 146.44
    assert d['ringkasan']['saldo_akhir'] == 2253.56
    assert [m['jenis'] for m in d['mutasi']] == ['pemakaian']


def test_setiap_pembukaan_tercatat(client, token, db_session):
    from models.settings_extended import AuditLog
    sebelum = AuditLog.query.filter_by(resource_type='pengawasan_ethanol').count()
    client.get(f'/api/pengawasan/ethanol/{token}')
    client.get('/api/pengawasan/ethanol/salah')
    sesudah = AuditLog.query.filter_by(resource_type='pengawasan_ethanol').all()
    assert len(sesudah) == sebelum + 2
    assert {a.status for a in sesudah[-2:]} == {'success', 'ditolak'}


def test_tautan_bisa_dicabut_dan_yang_lama_langsung_mati(client, auth_headers, token):
    lama = token
    r = client.post('/api/pengawasan/ethanol/tautan/ganti', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    baru = r.get_json()['token']

    assert baru != lama
    assert client.get(f'/api/pengawasan/ethanol/{lama}').status_code == 403
    assert client.get(f'/api/pengawasan/ethanol/{baru}').status_code == 200


def test_mengganti_tautan_butuh_login(client, token):
    assert client.post('/api/pengawasan/ethanol/tautan/ganti').status_code in (401, 422)
    assert client.get('/api/pengawasan/ethanol/tautan').status_code in (401, 422)


def test_status_cukai_menempel_pada_batch_bukan_pada_barangnya(client, db_session, ethanol, token):
    """Satu batch bisa masuk dengan cukai dibayar sementara batch berikutnya
    memakai pembebasan - jadi statusnya harus per batch, dan batch yang belum
    diisi tetap punya keterangan (bawaan), bukan kosong."""
    from models.purchasing import GRNItem, GoodsReceivedNote, Supplier
    from models.warehouse import Inventory, WarehouseLocation

    sup = Supplier(code='SUP-UJI', company_name='PT Pemasok Uji', is_active=True)
    db_session.add(sup)
    db_session.commit()
    grn = GoodsReceivedNote(grn_number='BPB-26/11/005', supplier_id=sup.id,
                            receipt_date=datetime(2026, 11, 20), status='approved')
    db_session.add(grn)
    db_session.commit()
    db_session.add(GRNItem(grn_id=grn.id, material_id=ethanol.id, quantity_ordered=2400,
                           quantity_received=2400, quantity_accepted=2400, uom='LTR',
                           batch_number='TA-04/19112026',
                           cukai_status='Pembebasan cukai', cukai_dokumen='CK-5 No. 12/2026'))
    lok = WarehouseLocation.query.first()
    db_session.add(Inventory(material_id=ethanol.id, location_id=lok.id, batch_number='TB-99/01122026',
                             quantity_on_hand=500, quantity_available=500,
                             stock_status='available', is_active=True))
    db_session.commit()

    d = client.get(f'/api/pengawasan/ethanol/{token}').get_json()

    masuk = next(m for m in d['mutasi'] if m['jenis'] == 'penerimaan')
    assert masuk['cukai']['status'] == 'Pembebasan cukai'
    assert masuk['cukai']['dokumen'] == 'CK-5 No. 12/2026'
    # Pemakaian tidak punya status cukai sendiri - cukainya urusan saat masuk.
    assert next(m for m in d['mutasi'] if m['jenis'] == 'pemakaian')['cukai'] is None

    per_batch = {s['batch']: s['cukai']['status'] for s in d['stok_sekarang']}
    assert per_batch['TA-04/19112026'] == 'Pembebasan cukai'
    assert per_batch['TB-99/01122026'] == 'Pembebasan cukai'
    # Tidak ada lagi satu kalimat cukai untuk seluruh barang di kepala kartu.
    assert 'status_cukai' not in d['barang']


def test_pdf_memakai_tautan_yang_sama_dan_ikut_tercatat(client, db_session, token):
    from models.settings_extended import AuditLog

    salah = client.get('/api/pengawasan/ethanol/bukan-tautan/pdf')
    assert salah.status_code == 403
    assert b'%PDF' not in salah.data

    r = client.get(f'/api/pengawasan/ethanol/{token}/pdf')
    assert r.status_code == 200, r.data[:200]
    assert r.mimetype == 'application/pdf'
    assert r.data.startswith(b'%PDF')
    assert 'attachment' in r.headers.get('Content-Disposition', '')

    hasil = [a.status for a in AuditLog.query.filter_by(resource_type='pengawasan_ethanol')
             .order_by(AuditLog.id).all()]
    assert hasil[-2:] == ['ditolak', 'success']


def test_nilai_cukai_dihitung_per_batch_dari_tarifnya(client, db_session, ethanol, token):
    """Yang dilaporkan: cukai yang DIBEBASKAN atas barang yang diterima -
    jumlah diterima x tarif per liter. Tarifnya ikut batch supaya kartu batch
    lama tidak berubah waktu tarif cukai naik."""
    from models.purchasing import GRNItem, GoodsReceivedNote, Supplier

    sup = Supplier(code='SUP-CK', company_name='PT Pemasok Cukai', is_active=True)
    db_session.add(sup)
    db_session.commit()
    grn = GoodsReceivedNote(grn_number='BPB-26/11/005', supplier_id=sup.id,
                            receipt_date=datetime(2026, 11, 20), status='approved')
    db_session.add(grn)
    db_session.commit()
    db_session.add(GRNItem(grn_id=grn.id, material_id=ethanol.id, quantity_ordered=2400,
                           quantity_received=2400, quantity_accepted=2400, uom='LTR',
                           batch_number='TA-04/19112026', cukai_tarif=25000))
    db_session.commit()

    d = client.get(f'/api/pengawasan/ethanol/{token}').get_json()

    # Batch ini tarifnya sendiri 25.000, bukan bawaan 20.000.
    masuk = next(m for m in d['mutasi'] if m['jenis'] == 'penerimaan')
    assert masuk['cukai']['tarif'] == 25000.0
    assert masuk['nilai_dibebaskan'] == 2400 * 25000
    # Pemakaian tidak punya nilai sendiri - pembebasannya sudah dihitung saat masuk,
    # kalau ikut dihitung lagi di sini angkanya jadi dobel.
    pakai = next(m for m in d['mutasi'] if m['jenis'] == 'pemakaian')
    assert pakai['nilai_dibebaskan'] == 0

    assert d['cukai']['tarif_bawaan'] == 20000.0
    assert d['cukai']['dibebaskan'] == 2400 * 25000


def test_batch_tanpa_tarif_memakai_tarif_bawaan(client, token):
    """Tidak ada batch yang tampil tanpa nilai: yang belum diisi memakai tarif
    bawaan di setelan (Rp 20.000/LTR)."""
    d = client.get(f'/api/pengawasan/ethanol/{token}').get_json()
    assert d['cukai']['tarif_bawaan'] == 20000.0
    assert d['mutasi'][0]['nilai_dibebaskan'] == 2400 * 20000
    assert d['cukai']['dibebaskan'] == 2400 * 20000
