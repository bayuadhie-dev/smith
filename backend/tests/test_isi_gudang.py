"""Halaman Isi Gudang: daftar barang satu gudang, menurut kategori gudang itu.

Daftarnya dulu dibangun dari baris stok, jadi hanya memuat barang yang kebetulan
ada isinya. Untuk menjawab "bahan kimia kita apa saja di gudang ini", yang nol
justru yang dicari - itulah yang belum pernah diterima. Di Fengsheng 75 dari 76
bahan kimia tidak punya baris stok sama sekali.

Kategorinya datang dari `warehouse_zones.material_type`, BUKAN pilihan bebas
pemakai: Gudang Chemical memang untuk bahan kimia dan Gudang Bahan Kemas untuk
bahan kemas. Menampilkan 76 bahan kimia di Gudang Bahan Kemas itu mencampur lagi
yang sudah susah payah dipisahkan.
"""
import pytest

from models import db
from models.product import Material, Product
from models.warehouse import Inventory, WarehouseLocation, WarehouseZone


@pytest.fixture
def gudang(db_session):
    """Gudang Chemical - kategorinya bahan kimia, bukan serbaguna."""
    z = WarehouseZone(code='WH-CMW', name='Gudang Chemical', material_type='chemical_materials', is_active=True)
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
        # BB-NOL bahan baku, bukan urusan Gudang Chemical - lihat tes berikutnya.
        assert sorted(i['code'] for i in d['items']) == ['KIM-ADA', 'KIM-NOL']
        nol = next(i for i in d['items'] if i['code'] == 'KIM-NOL')
        assert nol['on_hand'] == 0 and nol['available'] == 0
        assert nol['uom'] == 'KG'      # satuannya tetap terbaca, bukan kosong

    def test_hanya_kategori_gudangnya_yang_ditarik(self, client, auth_headers, gudang, isi_gudang):
        """Gudang Chemical hanya memunculkan bahan kimia. Bahan baku tidak ikut,
        meski sama-sama belum pernah masuk ke sini."""
        d = _isi(client, auth_headers, gudang[0].id, include_empty='1')
        assert sorted(i['code'] for i in d['items']) == ['KIM-ADA', 'KIM-NOL']

    def test_kategori_tidak_bisa_dipaksa_dari_luar(self, client, auth_headers, db_session, gudang, isi_gudang):
        """Gudang yang sudah punya kategori mengabaikan parameter kelompok -
        kalau tidak, Gudang Chemical bisa disuruh memajang seluruh bahan kemas."""
        _bahan(db_session, 'PM-NOL', 'KARTON BOX', 'BAHAN PEMBANTU', 'packaging_materials')
        d = _isi(client, auth_headers, gudang[0].id, include_empty='1', group='packaging_materials')
        assert 'PM-NOL' not in [i['code'] for i in d['items']]
        assert sorted(i['code'] for i in d['items']) == ['KIM-ADA', 'KIM-NOL']

    def test_gudang_serbaguna_baru_boleh_dipilihkan(self, client, auth_headers, db_session, isi_gudang):
        """Area Produksi dan Gudang Waste memang tidak punya kategori tetap."""
        z = WarehouseZone(code='PROD', name='Area Produksi', material_type='all', is_active=True)
        db_session.add(z)
        db_session.commit()
        d = _isi(client, auth_headers, z.id, include_empty='1', group='chemical_materials')
        assert sorted(i['code'] for i in d['items']) == ['KIM-ADA', 'KIM-NOL']
        kosong = _isi(client, auth_headers, z.id, include_empty='1')
        assert kosong['items'] == []

    def test_barang_salah_gudang_ditandai_bukan_disembunyikan(self, client, auth_headers, db_session, gudang):
        """Bahan kemas yang nyata-nyata ada di Gudang Chemical tetap ditampilkan -
        itu kenyataan di lapangan - tapi diberi tanda supaya salah taruh kelihatan."""
        _, loc = gudang
        asing = _bahan(db_session, 'PM-ADA', 'KARTON BOX', 'BAHAN PEMBANTU', 'packaging_materials')
        db_session.add(Inventory(material_id=asing.id, location_id=loc.id, quantity_on_hand=5,
                                 quantity_available=5, is_active=True))
        db_session.commit()

        d = _isi(client, auth_headers, gudang[0].id)
        baris = {i['code']: i for i in d['items']}
        assert baris['PM-ADA']['luar_kelompok'] is True

    def test_barang_sekategori_tidak_ditandai(self, client, auth_headers, gudang, isi_gudang):
        d = _isi(client, auth_headers, gudang[0].id)
        assert d['items'][0]['luar_kelompok'] is False

    def test_kategori_gudang_ikut_dikirim(self, client, auth_headers, gudang, isi_gudang):
        """Dipakai halaman untuk menulis "Gudang ini untuk bahan kimia"."""
        d = _isi(client, auth_headers, gudang[0].id)
        assert d['zone']['material_type'] == 'chemical_materials'


class TestWaste:
    """Gudang Waste berisi produk reject MAUPUN material sisa (waste ex slitting,
    waste packaging). Kalau tabelnya ditebak dari nama jenis, separuh daftarnya
    hilang."""

    @pytest.fixture
    def gudang_waste(self, db_session):
        z = WarehouseZone(code='WH-REJECT', name='Gudang Waste', material_type='waste', is_active=True)
        db_session.add(z)
        db_session.commit()
        return z

    def test_produk_dan_material_waste_dua_duanya_tampil(self, client, auth_headers, db_session, gudang_waste):
        db_session.add_all([
            Product(code='7000000016', name='WASTE WETKINS BABY BLUE 50S',
                    material_type='waste', primary_uom='PCS', is_active=True),
            Material(code='7000000001', name='WASTE EX SLITTING', category='BAHAN PEMBANTU',
                     material_type='waste', primary_uom='KG', is_active=True),
            Material(code='2010101001', name='KARTON BOX', category='BAHAN PEMBANTU',
                     material_type='packaging_materials', primary_uom='PCS', is_active=True),
        ])
        db_session.commit()

        d = _isi(client, auth_headers, gudang_waste.id, include_empty='1')
        assert sorted(i['code'] for i in d['items']) == ['7000000001', '7000000016']


class TestHurufBesarKecil:
    """Falmaco menulis sebagian material_type huruf besar ('RAW_MATERIALS').
    Kalau dicocokkan apa adanya, Gudang Bahan Baku di sana tidak memunculkan
    apa pun, dan bahan bakunya malah ditandai beda kategori di gudangnya sendiri."""

    @pytest.fixture
    def gudang_bb(self, db_session):
        z = WarehouseZone(code='WH-RM', name='Gudang Bahan Baku', material_type='raw_materials', is_active=True)
        db_session.add(z)
        db_session.flush()
        loc = WarehouseLocation(location_code='WH-RM-01', zone_id=z.id, rack='R1', level='1',
                                position='A', capacity_uom='KG', is_active=True)
        db_session.add(loc)
        db_session.commit()
        return z, loc

    def test_jenis_huruf_besar_tetap_terjaring(self, client, auth_headers, db_session, gudang_bb):
        _bahan(db_session, 'BB-HURUF', 'VISCOSE RAYON', 'BAHAN BAKU', 'RAW_MATERIALS')
        d = _isi(client, auth_headers, gudang_bb[0].id, include_empty='1')
        assert [i['code'] for i in d['items']] == ['BB-HURUF']

    def test_tidak_ditandai_beda_kategori_di_gudangnya_sendiri(self, client, auth_headers, db_session, gudang_bb):
        z, loc = gudang_bb
        m = _bahan(db_session, 'BB-HURUF', 'VISCOSE RAYON', 'BAHAN BAKU', 'RAW_MATERIALS')
        db_session.add(Inventory(material_id=m.id, location_id=loc.id, quantity_on_hand=10,
                                 quantity_available=10, is_active=True))
        db_session.commit()
        d = _isi(client, auth_headers, z.id)
        assert d['items'][0]['luar_kelompok'] is False


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
