"""Halaman Isi Gudang: daftar barang per gudang menurut kelompoknya.

Daftarnya dulu dibangun dari baris stok, jadi hanya memuat barang yang kebetulan
ada isinya. Untuk menjawab "bahan kimia kita apa saja di gudang ini", yang nol
justru yang dicari - itulah yang belum pernah diterima. Di Fengsheng 75 dari 76
bahan kimia tidak punya baris stok sama sekali.
"""
import pytest

from models import db
from models.product import Material, Product
from models.warehouse import Inventory, WarehouseLocation, WarehouseZone


@pytest.fixture
def gudang(db_session):
    z = WarehouseZone(code='WH-CMW', name='Gudang Chemical', material_type='mixed', is_active=True)
    db_session.add(z)
    db_session.flush()
    loc = WarehouseLocation(location_code='WH-CMW-01', zone_id=z.id, rack='R1', level='1',
                            position='A', capacity_uom='KG', is_active=True)
    db_session.add(loc)
    db_session.commit()
    return z, loc


def _bahan(db_session, code, name, kategori, jenis):
    m = Material(code=code, name=name, category=kategori, material_type=jenis,
                 primary_uom='KG', is_active=True)
    db_session.add(m)
    db_session.commit()
    return m


def _isi(client, headers, zone_id, **q):
    sisa = '&'.join(f'{k}={v}' for k, v in q.items())
    r = client.get(f'/api/stock-transfers/zone-stock/{zone_id}?{sisa}', headers=headers)
    assert r.status_code == 200, r.get_json()
    return r.get_json()


@pytest.fixture
def isi_gudang(db_session, gudang):
    _, loc = gudang
    ada = _bahan(db_session, 'KIM-ADA', 'CHEMICAL ETHANOL', 'BAHAN KIMIA', 'chemical_materials')
    _bahan(db_session, 'KIM-NOL', 'CHEMICAL ALLANTOIN', 'BAHAN KIMIA', 'chemical_materials')
    _bahan(db_session, 'BB-NOL', 'VISCOSE RAYON', 'BAHAN BAKU', 'raw_materials')
    db_session.add(Inventory(material_id=ada.id, location_id=loc.id, quantity_on_hand=2400,
                             quantity_available=2400, is_active=True))
    db_session.commit()


class TestDaftarBarangPerGudang:
    def test_bawaannya_hanya_yang_ada_stoknya(self, client, auth_headers, gudang, isi_gudang):
        d = _isi(client, auth_headers, gudang[0].id)
        assert [i['code'] for i in d['items']] == ['KIM-ADA']

    def test_barang_tanpa_stok_ikut_tampil_kalau_diminta(self, client, auth_headers, gudang, isi_gudang):
        d = _isi(client, auth_headers, gudang[0].id, include_empty='1')
        assert sorted(i['code'] for i in d['items']) == ['BB-NOL', 'KIM-ADA', 'KIM-NOL']
        nol = next(i for i in d['items'] if i['code'] == 'KIM-NOL')
        assert nol['on_hand'] == 0 and nol['available'] == 0
        assert nol['uom'] == 'KG'      # satuannya tetap terbaca, bukan kosong

    def test_disaring_per_kelompok(self, client, auth_headers, gudang, isi_gudang):
        d = _isi(client, auth_headers, gudang[0].id, include_empty='1', category_group='chemical')
        assert sorted(i['code'] for i in d['items']) == ['KIM-ADA', 'KIM-NOL']

    def test_kelompok_juga_menyaring_yang_sudah_ada_stoknya(self, client, auth_headers, gudang, isi_gudang):
        """Tanpa include_empty pun kelompoknya harus dihormati."""
        d = _isi(client, auth_headers, gudang[0].id, category_group='bahan_baku')
        assert d['items'] == []

    def test_yang_ada_stoknya_tetap_di_atas(self, client, auth_headers, gudang, isi_gudang):
        d = _isi(client, auth_headers, gudang[0].id, include_empty='1', category_group='chemical')
        assert d['items'][0]['code'] == 'KIM-ADA'

    def test_produk_tidak_ikut_di_kelompok_bahan(self, client, auth_headers, db_session, gudang, isi_gudang):
        db_session.add(Product(code='FG-001', name='Tisu Basah', material_type='finished_goods',
                               primary_uom='PCS', is_active=True))
        db_session.commit()
        d = _isi(client, auth_headers, gudang[0].id, include_empty='1', category_group='chemical')
        assert 'FG-001' not in [i['code'] for i in d['items']]


class TestTidakNPlusSatu:
    def test_nama_barang_diambil_sekali_untuk_semuanya(self, client, auth_headers, db_session, gudang):
        """Daftar yang memuat barang nol bisa ratusan baris. Kalau namanya
        diambil satu query per baris, halaman ini berhenti bisa dibuka."""
        from sqlalchemy import event
        _, loc = gudang

        def hitung(mulai, n):
            for i in range(mulai, mulai + n):
                _bahan(db_session, f'KIM-{i:03d}', f'Chemical {i}', 'BAHAN KIMIA', 'chemical_materials')
            jumlah = []
            def catat(conn, cursor, statement, params, context, executemany):
                jumlah.append(statement)
            event.listen(db.engine, 'before_cursor_execute', catat)
            try:
                client.get(f'/api/stock-transfers/zone-stock/{gudang[0].id}?include_empty=1', headers=auth_headers)
            finally:
                event.remove(db.engine, 'before_cursor_execute', catat)
            return len(jumlah)

        sedikit = hitung(0, 3)
        banyak = hitung(3, 30)
        assert banyak <= sedikit + 1, f'{sedikit} query untuk 3 barang, {banyak} untuk 33'
