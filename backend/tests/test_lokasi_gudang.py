"""Daftar Lokasi Gudang.

Halaman master lokasi memajang status aktif tiap lokasi, tapi `is_active` tidak
pernah ikut dikirim - jadi ke-16 lokasi Fengsheng terbaca "Nonaktif" padahal 11
di antaranya aktif, dan penghitung "Active Locations" selalu 0.
"""
import pytest

from models.warehouse import WarehouseLocation, WarehouseZone


@pytest.fixture
def lokasi(db_session):
    hidup = WarehouseZone(code='WH-ETH', name='Gudang Ethanol', material_type='chemical_materials', is_active=True)
    mati = WarehouseZone(code='WIP-01', name='Gudang WIP Lama', material_type='wip', is_active=False)
    db_session.add_all([hidup, mati])
    db_session.flush()
    db_session.add_all([
        WarehouseLocation(location_code='WH-ETH-01', zone_id=hidup.id, rack='R1', level='1',
                          position='A', capacity_uom='LTR', is_active=True, is_available=True),
        WarehouseLocation(location_code='WIP-R01', zone_id=mati.id, rack='R1', level='1',
                          position='A', capacity_uom='LTR', is_active=False, is_available=False),
    ])
    db_session.commit()


def _daftar(client, headers, **q):
    sisa = '&'.join(f'{k}={v}' for k, v in q.items())
    r = client.get(f'/api/warehouse/locations?{sisa}', headers=headers)
    assert r.status_code == 200, r.get_json()
    return {l['location_code']: l for l in r.get_json()['locations']}


class TestStatusLokasi:
    def test_status_aktif_ikut_dikirim(self, client, auth_headers, lokasi):
        d = _daftar(client, auth_headers, include_inactive=1, per_page=500)
        assert d['WH-ETH-01']['is_active'] is True
        assert d['WIP-R01']['is_active'] is False

    def test_status_gudangnya_ikut_dikirim(self, client, auth_headers, lokasi):
        """Lokasi bisa aktif sementara gudangnya sudah dinonaktifkan."""
        d = _daftar(client, auth_headers, include_inactive=1, per_page=500)
        assert d['WH-ETH-01']['zone_is_active'] is True
        assert d['WIP-R01']['zone_is_active'] is False

    def test_tanpa_include_inactive_yang_mati_tidak_ikut(self, client, auth_headers, lokasi):
        d = _daftar(client, auth_headers, per_page=500)
        assert list(d) == ['WH-ETH-01']


class TestIsiLokasiBelumPernahMasuk:
    """Lokasi yang belum pernah diisi tampil "Tidak ada inventory di lokasi ini".
    Benar, tapi tidak menjawab "jadi isinya nanti apa saja" - dan untuk Gudang
    Chemical Fengsheng itu seluruh 76 bahan kimianya."""

    @pytest.fixture
    def kimia(self, db_session, lokasi):
        from models.product import Material
        db_session.add_all([
            Material(code='KIM-001', name='CHEMICAL ALLANTOIN', category='BAHAN KIMIA',
                     material_type='chemical_materials', primary_uom='KG', is_active=True),
            Material(code='BB-001', name='VISCOSE', category='BAHAN BAKU',
                     material_type='raw_materials', primary_uom='KG', is_active=True),
        ])
        db_session.commit()

    def _lokasi_id(self, client, headers, kode):
        return _daftar(client, headers, include_inactive=1, per_page=500)[kode]['id']

    def test_bawaannya_tetap_kosong(self, client, auth_headers, kimia):
        lid = self._lokasi_id(client, auth_headers, 'WH-ETH-01')
        r = client.get(f'/api/warehouse/locations/{lid}', headers=auth_headers)
        assert r.get_json()['inventory_items'] == []

    def test_barang_sekategori_gudangnya_tampil_dengan_nol(self, client, auth_headers, kimia):
        lid = self._lokasi_id(client, auth_headers, 'WH-ETH-01')
        r = client.get(f'/api/warehouse/locations/{lid}?include_empty=1', headers=auth_headers)
        items = r.get_json()['inventory_items']
        assert [i['item_code'] for i in items] == ['KIM-001']
        assert items[0]['quantity_on_hand'] == 0
        assert items[0]['belum_pernah_masuk'] is True
        assert items[0]['uom'] == 'KG'

    def test_kategori_lain_tidak_ikut(self, client, auth_headers, kimia):
        """Gudang Ethanol untuk bahan kimia - bahan baku bukan urusannya."""
        lid = self._lokasi_id(client, auth_headers, 'WH-ETH-01')
        r = client.get(f'/api/warehouse/locations/{lid}?include_empty=1', headers=auth_headers)
        assert 'BB-001' not in [i['item_code'] for i in r.get_json()['inventory_items']]

    def test_yang_sudah_ada_stoknya_tidak_digandakan(self, client, auth_headers, db_session, kimia):
        from models.product import Material
        from models.warehouse import Inventory
        lid = self._lokasi_id(client, auth_headers, 'WH-ETH-01')
        m = Material.query.filter_by(code='KIM-001').one()
        db_session.add(Inventory(material_id=m.id, location_id=lid, quantity_on_hand=5,
                                 quantity_available=5, is_active=True))
        db_session.commit()

        r = client.get(f'/api/warehouse/locations/{lid}?include_empty=1', headers=auth_headers)
        items = r.get_json()['inventory_items']
        assert [i['item_code'] for i in items] == ['KIM-001']
        assert items[0]['quantity_on_hand'] == 5
