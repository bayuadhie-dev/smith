"""Kolom Stok di Daftar Barang & Material.

Halaman ini dulu hanya daftar master tanpa jumlah sama sekali, jadi untuk tahu
ada berapa harus mengklik barangnya satu per satu. Sementara Ringkasan Stok per
Gudang menyembunyikan baris nol dan tidak pernah menampilkan barang yang belum
pernah punya baris stok - di Fengsheng itu 75 dari 76 bahan kimia. Akibatnya
tidak ada satu layar pun yang menjawab "bahan kimia kita apa saja dan ada
berapa".
"""
import pytest

from models import db
from models.product import Material
from models.warehouse import Inventory, WarehouseLocation, WarehouseZone


@pytest.fixture
def lokasi(db_session):
    z = WarehouseZone(code='WH-T', name='Gudang Uji', material_type='mixed', is_active=True)
    db_session.add(z)
    db_session.flush()
    loc = WarehouseLocation(location_code='WH-T-01', zone_id=z.id, rack='R1', level='1',
                            position='A', capacity_uom='KG', is_active=True)
    db_session.add(loc)
    db_session.commit()
    return loc


def _material(db_session, code, name, min_stock=0):
    m = Material(code=code, name=name, category='BAHAN KIMIA', material_type='chemical_materials',
                 primary_uom='KG', min_stock_level=min_stock, is_active=True)
    db_session.add(m)
    db_session.commit()
    return m


def _daftar(client, headers, **q):
    sisa = '&'.join(f'{k}={v}' for k, v in q.items())
    r = client.get(f'/api/materials?per_page=100&{sisa}', headers=headers)
    assert r.status_code == 200, r.get_json()
    return {m['code']: m for m in r.get_json()['materials']}


class TestKolomStok:
    def test_barang_tanpa_baris_stok_tetap_tampil_dengan_nol(self, client, auth_headers, db_session, lokasi):
        """Belum pernah ada penerimaan bukan berarti tidak diketahui - itu nol."""
        _material(db_session, 'KIM-001', 'CHEMICAL ALLANTOIN')

        m = _daftar(client, auth_headers)['KIM-001']
        assert m['current_stock'] == 0
        assert m['reserved_stock'] == 0

    def test_stok_dijumlah_dari_semua_lokasi(self, client, auth_headers, db_session, lokasi):
        mat = _material(db_session, 'KIM-002', 'CHEMICAL ETHANOL')
        loc2 = WarehouseLocation(location_code='WH-T-02', zone_id=lokasi.zone_id, rack='R1',
                                 level='2', position='A', capacity_uom='KG', is_active=True)
        db_session.add(loc2)
        db_session.flush()
        db_session.add_all([
            Inventory(material_id=mat.id, location_id=lokasi.id, quantity_on_hand=1500,
                      quantity_reserved=100, is_active=True),
            Inventory(material_id=mat.id, location_id=loc2.id, quantity_on_hand=900,
                      quantity_reserved=0, is_active=True),
        ])
        db_session.commit()

        m = _daftar(client, auth_headers)['KIM-002']
        assert m['current_stock'] == 2400
        assert m['reserved_stock'] == 100

    def test_baris_stok_nonaktif_tidak_ikut_dihitung(self, client, auth_headers, db_session, lokasi):
        mat = _material(db_session, 'KIM-003', 'CHEMICAL LAMA')
        db_session.add(Inventory(material_id=mat.id, location_id=lokasi.id, quantity_on_hand=500,
                                 is_active=False))
        db_session.commit()

        assert _daftar(client, auth_headers)['KIM-003']['current_stock'] == 0

    def test_batas_minimum_ikut_dikirim(self, client, auth_headers, db_session, lokasi):
        """Dipakai halaman untuk menandai yang di bawah minimum."""
        _material(db_session, 'KIM-004', 'CHEMICAL TIPIS', min_stock=50)
        assert _daftar(client, auth_headers)['KIM-004']['min_stock_level'] == 50

    def test_stok_barang_lain_tidak_tertukar(self, client, auth_headers, db_session, lokasi):
        a = _material(db_session, 'KIM-005', 'A')
        _material(db_session, 'KIM-006', 'B')
        db_session.add(Inventory(material_id=a.id, location_id=lokasi.id, quantity_on_hand=7, is_active=True))
        db_session.commit()

        hasil = _daftar(client, auth_headers)
        assert hasil['KIM-005']['current_stock'] == 7
        assert hasil['KIM-006']['current_stock'] == 0


class TestTidakNPlusSatu:
    def test_jumlah_query_tidak_tumbuh_mengikuti_jumlah_barang(self, client, auth_headers, db_session, lokasi, app):
        """Stok diambil sekali untuk seluruh halaman. Kalau per baris, 100 bahan
        kimia jadi 100 query tambahan dan halaman ini berhenti bisa dibuka."""
        from sqlalchemy import event

        dibuat = [0]
        def hitung(n):
            for i in range(dibuat[0], dibuat[0] + n):
                mat = _material(db_session, f'BNY-{i:03d}', f'Barang {i}')
                db_session.add(Inventory(material_id=mat.id, location_id=lokasi.id,
                                         quantity_on_hand=i, is_active=True))
            db_session.commit()

            jumlah = []
            def catat(conn, cursor, statement, params, context, executemany):
                jumlah.append(statement)
            event.listen(db.engine, 'before_cursor_execute', catat)
            try:
                client.get('/api/materials?per_page=100', headers=auth_headers)
            finally:
                event.remove(db.engine, 'before_cursor_execute', catat)
            dibuat[0] += n
            return len(jumlah)

        sedikit = hitung(3)
        banyak = hitung(30)
        assert banyak <= sedikit + 1, f'{sedikit} query untuk 3 barang, {banyak} untuk 33'
