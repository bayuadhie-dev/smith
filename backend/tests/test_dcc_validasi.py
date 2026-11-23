"""Isian wajib di modul DCC (FRM-DCC-03/05/06/08/10).

Enam endpoint pembuatan di `routes/dcc.py` dulu tidak memeriksa apa pun:
kunci yang HILANG jadi 500 (KeyError di `data['x']`) dan kunci yang KOSONG
lolos tersimpan. Buktinya masih ada di basis data kantor - satu rekaman mutu
tersimpan tanpa nomor dan tanpa judul, menyangkut di daftar tanpa bisa
dikenali dan tanpa endpoint untuk menghapusnya.
"""
from datetime import date

import pytest

from models import db

from routes.dcc import wajib, _WajibKosong
from models.dcc import DccQualityRecord, CapaRequest, DccDestructionLog


class TestPembantuWajib:
    def test_kolom_hilang_dan_kosong_sama_sama_ditolak(self):
        for data in ({}, {'title': ''}, {'title': '   '}, {'title': None}, None):
            with pytest.raises(_WajibKosong):
                wajib(data, 'title')

    def test_pesannya_pakai_nama_yang_dikenal_pemakai(self):
        with pytest.raises(_WajibKosong) as e:
            wajib({}, 'record_number', 'title')
        assert str(e.value) == 'Nomor rekaman, Judul wajib diisi'

    def test_yang_terisi_lolos(self):
        wajib({'title': 'Ada isinya', 'department': 'QC'}, 'title', 'department')


class TestRekamanMutu:
    def test_tanpa_nomor_dan_judul_ditolak(self, client, auth_headers, app):
        with app.app_context():
            sebelum = DccQualityRecord.query.count()

        r = client.post('/api/dcc/quality-records', headers=auth_headers,
                        json={'record_number': '', 'title': '', 'department': ''})
        assert r.status_code == 400
        assert r.get_json()['error'] == 'Nomor rekaman, Judul, Departemen wajib diisi'

        with app.app_context():
            assert DccQualityRecord.query.count() == sebelum

    def test_body_kosong_tidak_jadi_500(self, client, auth_headers):
        r = client.post('/api/dcc/quality-records', headers=auth_headers, json={})
        assert r.status_code == 400


class TestCapa:
    def test_tanpa_deskripsi_masalah_ditolak(self, client, auth_headers, app):
        with app.app_context():
            sebelum = CapaRequest.query.count()

        r = client.post('/api/dcc/capa', headers=auth_headers,
                        json={'capa_type': 'CPAR'})
        assert r.status_code == 400
        assert 'Deskripsi masalah' in r.get_json()['error']

        with app.app_context():
            assert CapaRequest.query.count() == sebelum


class TestPemusnahan:
    def test_tanpa_alasan_dan_tanggal_ditolak(self, client, auth_headers, app):
        with app.app_context():
            sebelum = DccDestructionLog.query.count()

        r = client.post('/api/dcc/destructions', headers=auth_headers,
                        json={'document_type': 'SOP', 'document_form': 'physical'})
        assert r.status_code == 400
        assert 'Alasan' in r.get_json()['error']

        with app.app_context():
            assert DccDestructionLog.query.count() == sebelum


class TestHapusRekamanMutu:
    """Sebelum ini tidak ada endpoint DELETE sama sekali, jadi baris sampah
    dari masa sebelum isian wajib diperiksa menyangkut selamanya di daftar."""

    def _buat(self, client, headers):
        r = client.post('/api/dcc/quality-records', headers=headers, json={
            'record_number': 'FRM-QAS-99', 'title': 'Rekaman percobaan', 'department': 'QAS',
        })
        assert r.status_code == 201, r.get_json()
        return r.get_json()['id']

    def test_rekaman_bisa_dihapus(self, client, auth_headers, app):
        rec_id = self._buat(client, auth_headers)
        r = client.delete(f'/api/dcc/quality-records/{rec_id}', headers=auth_headers)
        assert r.status_code == 200
        with app.app_context():
            assert db.session.get(DccQualityRecord, rec_id) is None

    def test_yang_sudah_ada_berita_acara_pemusnahan_ditolak(self, client, auth_headers, app):
        """Berita acara pemusnahan itu jejak audit - rekamannya tidak boleh hilang."""
        rec_id = self._buat(client, auth_headers)
        with app.app_context():
            db.session.add(DccDestructionLog(
                destruction_number='BAP/TEST/001', document_type='quality_record',
                quality_record_id=rec_id, document_form='physical',
                reason='expired_retention', destruction_date=date.today(),
            ))
            db.session.commit()

        r = client.delete(f'/api/dcc/quality-records/{rec_id}', headers=auth_headers)
        assert r.status_code == 400
        assert 'berita acara' in r.get_json()['error']
        with app.app_context():
            assert db.session.get(DccQualityRecord, rec_id) is not None
