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
