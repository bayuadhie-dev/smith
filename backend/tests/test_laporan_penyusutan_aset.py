"""Angka aset harus benar dan penyusutan tidak boleh melewati batas.

Dua hal yang diperbaiki 2026-11-22:
- /assets/reports/summary mengirim nilai buku bersih 0 begitu akumulasi
  penyusutannya 0 (ekspresi `and totals[2]` menganggapnya kosong), jadi
  dashboard memajang Rp 0 padahal asetnya puluhan miliar;
- penyusutan bulanan terus dibebankan walau nilai yang bisa disusutkan sudah
  habis, sehingga nilai buku bisa minus.
"""
from datetime import date

import pytest


@pytest.fixture
def aset(db_session):
    from models.asset_management import Asset
    a = Asset(
        asset_code='AST-UJI-1', asset_name='Mesin Uji', asset_type='machinery',
        category='Mesin & Peralatan', status='active',
        purchase_date=date(2024, 1, 1), purchase_cost=120_000_000,
        salvage_value=0, depreciation_method='straight_line', useful_life_years=10,
        accumulated_depreciation=0,
    )
    db_session.add(a)
    db_session.commit()
    return a


def test_nilai_buku_bersih_tidak_nol_saat_penyusutan_nol(client, auth_headers, aset):
    r = client.get('/api/assets/reports/summary', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    t = r.get_json()['totals']

    assert t['total_acquisition_cost'] == 120_000_000
    assert t['total_depreciation'] == 0
    # Inti bugnya: dulu nilai ini 0.
    assert t['total_net_book_value'] == 120_000_000


def test_laporan_penyusutan_menyebut_aset_yang_tertinggal(client, auth_headers, aset):
    r = client.get('/api/assets/reports/depreciation', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    d = r.get_json()

    baris = next(b for b in d['assets'] if b['asset_code'] == 'AST-UJI-1')
    assert baris['monthly_depreciation'] == pytest.approx(1_000_000)
    assert baris['net_book_value'] == 120_000_000
    # Dibeli Januari 2024 dan belum pernah disusutkan sama sekali.
    assert baris['months_behind'] > 12
    assert d['totals']['never_depreciated'] >= 1


def test_penyusutan_berhenti_di_nilai_yang_bisa_disusutkan(client, auth_headers, db_session, aset):
    from models.asset_management import Asset

    # Tinggal Rp 200.000 lagi, padahal beban sebulan Rp 1.000.000.
    aset.accumulated_depreciation = 119_800_000
    db_session.commit()

    r = client.post('/api/assets/batch-depreciation', headers=auth_headers)
    assert r.status_code in (200, 400), r.get_json()

    segar = db_session.get(Asset, aset.id)
    assert float(segar.accumulated_depreciation) <= 120_000_000
    assert segar.net_book_value >= 0
