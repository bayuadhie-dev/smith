"""Memo internal (FRM-DCC-07).

Fiturnya sudah ada sejak lama tapi tidak pernah benar-benar bisa dipakai:
menandai sudah membaca justru minta izin MEMBUAT memo, penerima dicari lewat
daftar departemen yang ditulis tetap di kode sehingga tidak cocok dengan
siapa pun, dan departemen tanpa akun diam-diam dicatat sebagai satu penerima
palsu atas nama si pengirim. Tes ini menjaga ketiganya.
"""
import pytest

from models import db, User
from models.dcc import InternalMemo, InternalMemoDistribution


def _buat_memo(client, headers, subject='Perubahan jadwal produksi'):
    r = client.post('/api/dcc/memos', headers=headers, json={
        'subject': subject,
        'content': 'Isi memo percobaan.',
        'category': 'jadwal_produksi',
    })
    assert r.status_code == 201, r.get_json()
    return r.get_json()['id']


class TestMemoValidasi:
    def test_subjek_kosong_ditolak(self, client, auth_headers):
        r = client.post('/api/dcc/memos', headers=auth_headers,
                        json={'subject': '   ', 'content': 'ada isinya'})
        assert r.status_code == 400
        assert 'Subjek' in r.get_json()['error']

    def test_isi_kosong_ditolak(self, client, auth_headers):
        r = client.post('/api/dcc/memos', headers=auth_headers,
                        json={'subject': 'Ada subjek', 'content': ''})
        assert r.status_code == 400

    def test_memo_baru_berstatus_draf(self, client, auth_headers, app):
        memo_id = _buat_memo(client, auth_headers)
        with app.app_context():
            assert db.session.get(InternalMemo, memo_id).status == 'draft'


class TestKirimMemo:
    def test_departemen_tanpa_akun_tidak_bikin_penerima_palsu(self, client, auth_headers, app):
        """Dulu departemen kosong dicatat sebagai 1 penerima atas nama pengirim,
        sehingga penghitung 'sudah baca' jadi tidak ada artinya."""
        memo_id = _buat_memo(client, auth_headers)

        r = client.post(f'/api/dcc/memos/{memo_id}/publish', headers=auth_headers,
                        json={'departments': ['Departemen Yang Tidak Ada']})
        assert r.status_code == 200
        data = r.get_json()
        assert data['distributed_count'] == 0
        assert 'Departemen Yang Tidak Ada' in data['departments_without_users']

        with app.app_context():
            assert InternalMemoDistribution.query.filter_by(memo_id=memo_id).count() == 0

    def test_bisa_tunjuk_orang_langsung(self, client, auth_headers, app):
        """Jalan yang selalu bisa diandalkan kalau kolom department akun kosong."""
        memo_id = _buat_memo(client, auth_headers)
        with app.app_context():
            penerima = User.query.filter_by(is_active=True).first()
            penerima_id = penerima.id

        r = client.post(f'/api/dcc/memos/{memo_id}/publish', headers=auth_headers,
                        json={'departments': [], 'user_ids': [penerima_id]})
        assert r.status_code == 200
        assert r.get_json()['distributed_count'] == 1

        with app.app_context():
            assert db.session.get(InternalMemo, memo_id).status == 'published'
            d = InternalMemoDistribution.query.filter_by(memo_id=memo_id).one()
            assert d.user_id == penerima_id
            assert d.is_read is False

    def test_kirim_dua_kali_tidak_menggandakan_penerima(self, client, auth_headers, app):
        memo_id = _buat_memo(client, auth_headers)
        with app.app_context():
            penerima_id = User.query.filter_by(is_active=True).first().id

        for _ in range(2):
            client.post(f'/api/dcc/memos/{memo_id}/publish', headers=auth_headers,
                        json={'user_ids': [penerima_id]})

        with app.app_context():
            assert InternalMemoDistribution.query.filter_by(memo_id=memo_id).count() == 1


class TestTandaBaca:
    def test_penerima_bisa_menandai_sudah_baca(self, client, auth_headers, app):
        memo_id = _buat_memo(client, auth_headers)
        with app.app_context():
            penerima_id = User.query.filter_by(is_active=True).first().id

        client.post(f'/api/dcc/memos/{memo_id}/publish', headers=auth_headers,
                    json={'user_ids': [penerima_id]})

        r = client.post(f'/api/dcc/memos/{memo_id}/acknowledge', headers=auth_headers)
        assert r.status_code == 200

        with app.app_context():
            d = InternalMemoDistribution.query.filter_by(memo_id=memo_id).one()
            assert d.is_read is True
            assert d.read_at is not None

    def test_rincian_memuat_daftar_penerima(self, client, auth_headers, app):
        memo_id = _buat_memo(client, auth_headers)
        with app.app_context():
            penerima_id = User.query.filter_by(is_active=True).first().id
        client.post(f'/api/dcc/memos/{memo_id}/publish', headers=auth_headers,
                    json={'user_ids': [penerima_id]})

        r = client.get(f'/api/dcc/memos/{memo_id}', headers=auth_headers)
        assert r.status_code == 200
        data = r.get_json()
        assert data['memo']['status'] == 'published'
        assert len(data['distributions']) == 1


class TestHapusMemo:
    def test_draf_bisa_dihapus(self, client, auth_headers, app):
        memo_id = _buat_memo(client, auth_headers)
        r = client.delete(f'/api/dcc/memos/{memo_id}', headers=auth_headers)
        assert r.status_code == 200
        with app.app_context():
            assert db.session.get(InternalMemo, memo_id) is None

    def test_memo_terbit_tidak_bisa_dihapus(self, client, auth_headers, app):
        """Tanda terimanya catatan siapa sudah baca apa - tidak boleh hilang."""
        memo_id = _buat_memo(client, auth_headers)
        with app.app_context():
            penerima_id = User.query.filter_by(is_active=True).first().id
        client.post(f'/api/dcc/memos/{memo_id}/publish', headers=auth_headers,
                    json={'user_ids': [penerima_id]})

        r = client.delete(f'/api/dcc/memos/{memo_id}', headers=auth_headers)
        assert r.status_code == 400
        with app.app_context():
            assert db.session.get(InternalMemo, memo_id) is not None


class TestCalonPenerima:
    def test_departemen_dari_master_bukan_daftar_tetap(self, client, auth_headers):
        r = client.get('/api/dcc/memos/recipients', headers=auth_headers)
        assert r.status_code == 200
        data = r.get_json()
        assert 'departments' in data and 'users' in data
        for d in data['departments']:
            assert 'name' in d and 'user_count' in d
