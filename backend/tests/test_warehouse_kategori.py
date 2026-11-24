"""Penyaring "Kategori" di Ringkasan Stok per Gudang.

Dulu penyaring ini hanya mencocokkan `Material.category` dengan kode kecil-kecil
peninggalan Falmaco ('chemical', 'spunbond', ...). Masterdata Fengsheng datang
dari Accurate dengan kategori huruf besar ('BAHAN KIMIA'), jadi tidak ada satu
pun yang cocok: memilih "Bahan Kimia" mengembalikan 0 baris padahal stoknya ada,
dan semua barang jatuh ke "Lainnya".
"""
import pytest

from models import db
from models.product import Material
from models.warehouse import Inventory, WarehouseLocation, WarehouseZone


@pytest.fixture
def gudang(db_session):
    z = WarehouseZone(code='WH-T', name='Gudang Uji', material_type='mixed', is_active=True)
    db_session.add(z)
    db_session.flush()
    loc = WarehouseLocation(location_code='WH-T-01', zone_id=z.id, rack='R1', level='1',
                            position='A', capacity_uom='KG', is_active=True)
    db_session.add(loc)
    db_session.commit()
    return loc


def _stok(db_session, loc, code, name, category, material_type, qty=10):
    m = Material(code=code, name=name, category=category, material_type=material_type,
                 primary_uom='KG', is_active=True)
    db_session.add(m)
    db_session.flush()
    db_session.add(Inventory(material_id=m.id, location_id=loc.id, quantity_on_hand=qty,
                             quantity_available=qty, is_active=True))
    db_session.commit()
    return m


def _kode(client, headers, kelompok):
    r = client.get(f'/api/warehouse/inventory?category_group={kelompok}&per_page=100', headers=headers)
    assert r.status_code == 200, r.get_json()
    return sorted(i['item_code'] for i in r.get_json()['inventory'])


@pytest.fixture
def dua_perusahaan(db_session, gudang):
    """Data Falmaco (kategori kode lama) dan Fengsheng (kategori Accurate) berdampingan."""
    # Falmaco: kategori kode lama, material_type-nya tidak bisa dipercaya
    _stok(db_session, gudang, 'FLM-CHEM', 'Parfum Lama', 'chemical', 'RAW_MATERIALS')
    _stok(db_session, gudang, 'FLM-PACK', 'Carton Lama', 'carton_box', 'packaging_materials')
    _stok(db_session, gudang, 'FLM-AKS', 'STC Lama', 'stc', 'packaging_materials')
    _stok(db_session, gudang, 'FSN-CHEM', 'CHEMICAL ETHANOL', 'BAHAN KIMIA', 'chemical_materials')
    _stok(db_session, gudang, 'FSN-RM', 'VISCOSE RAYON', 'BAHAN BAKU', 'raw_materials')
    _stok(db_session, gudang, 'FSN-PACK', 'PACKAGING HYGIENE', 'BAHAN PEMBANTU', 'packaging_materials')


class TestKategoriFengsheng:
    def test_bahan_kimia_fengsheng_ikut_terjaring(self, client, auth_headers, dua_perusahaan):
        assert _kode(client, auth_headers, 'chemical') == ['FLM-CHEM', 'FSN-CHEM']

    def test_bahan_kemas_fengsheng_ikut_terjaring(self, client, auth_headers, dua_perusahaan):
        assert _kode(client, auth_headers, 'packaging') == ['FLM-PACK', 'FSN-PACK']

    def test_barang_falmaco_tidak_muncul_di_dua_kelompok(self, client, auth_headers, dua_perusahaan):
        """FLM-AKS berkategori 'stc' tapi bertipe 'packaging_materials'. Kategori
        yang menang - kalau material_type ikut bicara, barang ini muncul di
        Aksesoris DAN Bahan Kemas sekaligus."""
        assert _kode(client, auth_headers, 'aksesoris') == ['FLM-AKS']
        assert 'FLM-AKS' not in _kode(client, auth_headers, 'packaging')

    def test_tipe_tak_dipercaya_tidak_menyeret_ke_bahan_baku(self, client, auth_headers, dua_perusahaan):
        """FLM-CHEM bertipe 'RAW_MATERIALS' (penampung umum Falmaco) tapi
        kategorinya 'chemical' - tetap bahan kimia, bukan bahan baku."""
        assert _kode(client, auth_headers, 'bahan_baku') == ['FSN-RM']

    def test_bahan_baku_punya_kelompok_sendiri(self, client, auth_headers, dua_perusahaan):
        assert _kode(client, auth_headers, 'bahan_baku') == ['FSN-RM']

    def test_lainnya_tidak_lagi_menampung_semuanya(self, client, auth_headers, dua_perusahaan):
        """Sebelum diperbaiki, kelima barang jatuh ke sini."""
        assert _kode(client, auth_headers, 'lainnya') == []


class TestKategoriFalmacoTidakBerubah:
    def test_kode_kategori_lama_tetap_dikenali(self, client, auth_headers, db_session, gudang):
        _stok(db_session, gudang, 'KAIN-1', 'Spunbond', 'spunbond', 'RAW_MATERIALS')
        _stok(db_session, gudang, 'AKS-1', 'Fliptop', 'fliptop', 'packaging_materials')
        assert _kode(client, auth_headers, 'kain') == ['KAIN-1']
        assert _kode(client, auth_headers, 'aksesoris') == ['AKS-1']

    def test_kategori_dan_jenis_tak_dikenal_masuk_lainnya(self, client, auth_headers, db_session, gudang):
        _stok(db_session, gudang, 'ENTAH', 'Barang Entah', 'KATEGORI BARU', 'consumables')
        assert _kode(client, auth_headers, 'lainnya') == ['ENTAH']

    def test_kelompok_yang_tidak_dikenal_tidak_menyaring_apa_pun(self, client, auth_headers, dua_perusahaan):
        """Nama kelompok ngawur jangan sampai mengosongkan daftar diam-diam."""
        assert len(_kode(client, auth_headers, 'ngawur')) == 6
