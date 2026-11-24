"""Laporan Kuantitas Barang per Gudang.

Dua hal yang dilaporkan pemakai 2026-11-24 saat memilih kelompok Bahan Kimia:
hanya 1 barang muncul dari 76 yang terdaftar, dan barang yang muncul itu
menulis total 2.400 di atas sambil semua kolom gudangnya bergaris datar.
"""
import pytest

from models import db
from models.product import Material
from models.warehouse import WarehouseLocation, WarehouseZone


@pytest.fixture
def gudang(db_session):
    """Satu gudang aktif, dan satu gudang NONAKTIF peninggalan penataan lama."""
    aktif = WarehouseZone(code='WH-ETH', name='Gudang Ethanol', material_type='mixed', is_active=True)
    mati = WarehouseZone(code='WIP-01', name='Gudang WIP Lama', material_type='mixed', is_active=False)
    db_session.add_all([aktif, mati])
    db_session.flush()
    loc_aktif = WarehouseLocation(location_code='WH-ETH-01', zone_id=aktif.id, rack='R1', level='1',
                                  position='A', capacity_uom='LTR', is_active=True)
    loc_mati = WarehouseLocation(location_code='WIP-R01', zone_id=mati.id, rack='R1', level='1',
                                 position='A', capacity_uom='LTR', is_active=False)
    db_session.add_all([loc_aktif, loc_mati])
    db_session.commit()
    return aktif, loc_aktif, loc_mati


def _kimia(db_session, code, name):
    m = Material(code=code, name=name, category='BAHAN KIMIA', material_type='chemical_materials',
                 primary_uom='LTR', is_active=True)
    db_session.add(m)
    db_session.commit()
    return m


def _masuk(db_session, material, lokasi, qty, biaya):
    db_session.execute(db.text('''
        INSERT INTO inventory_transactions
            (transaction_number, transaction_type, transaction_date, material_id, quantity, uom,
             direction, to_location_id, total_cost, status, created_at)
        VALUES (:no, 'stock_in', :tgl, :mid, :qty, 'LTR', 'in', :loc, :biaya, 'completed', :tgl)'''),
        {'no': f'IN-{material.code}-{lokasi.id}', 'tgl': '2026-01-01', 'mid': material.id,
         'qty': qty, 'loc': lokasi.id, 'biaya': biaya})
    db_session.commit()


def _laporan(client, headers, **q):
    sisa = '&'.join(f'{k}={v}' for k, v in q.items())
    r = client.get(f'/api/finance/reports/inventory-by-warehouse?group=chemical_materials&{sisa}', headers=headers)
    assert r.status_code == 200, r.get_json()
    return r.get_json()


class TestBarangTanpaMutasi:
    def test_hanya_yang_ada_mutasinya_saat_disembunyikan(self, client, auth_headers, db_session, gudang):
        _, loc, _ = gudang
        ada = _kimia(db_session, 'KIM-ADA', 'CHEMICAL ETHANOL')
        _kimia(db_session, 'KIM-KOSONG', 'CHEMICAL ALLANTOIN')
        _masuk(db_session, ada, loc, 2400, 88800000)

        d = _laporan(client, auth_headers, hide_zero='true')
        assert [r['code'] for r in d['rows']] == ['KIM-ADA']

    def test_barang_tanpa_mutasi_ikut_tampil_saat_ditampilkan(self, client, auth_headers, db_session, gudang):
        """Dulu mencentangnya percuma: barang tanpa mutasi tidak pernah punya
        baris sama sekali, jadi 75 dari 76 bahan kimia tidak pernah kelihatan."""
        _, loc, _ = gudang
        ada = _kimia(db_session, 'KIM-ADA', 'CHEMICAL ETHANOL')
        _kimia(db_session, 'KIM-KOSONG', 'CHEMICAL ALLANTOIN')
        _masuk(db_session, ada, loc, 2400, 88800000)

        d = _laporan(client, auth_headers, hide_zero='false')
        assert sorted(r['code'] for r in d['rows']) == ['KIM-ADA', 'KIM-KOSONG']
        kosong = next(r for r in d['rows'] if r['code'] == 'KIM-KOSONG')
        assert kosong['total_qty'] == 0 and kosong['total_value'] == 0

    def test_kelompok_lain_tidak_ikut_terseret(self, client, auth_headers, db_session, gudang):
        _kimia(db_session, 'KIM-KOSONG', 'CHEMICAL ALLANTOIN')
        db_session.add(Material(code='BB-001', name='VISCOSE', category='BAHAN BAKU',
                                material_type='raw_materials', primary_uom='KG', is_active=True))
        db_session.commit()

        d = _laporan(client, auth_headers, hide_zero='false')
        assert [r['code'] for r in d['rows']] == ['KIM-KOSONG']


class TestGudangNonaktif:
    def test_stok_di_gudang_nonaktif_punya_kolomnya_sendiri(self, client, auth_headers, db_session, gudang):
        """Ethanol 2.400 LTR tercatat masuk ke lokasi WIP lama yang gudangnya
        sudah dinonaktifkan. Dulu angkanya menambah total tapi tidak muncul di
        kolom mana pun - barisnya terbaca 2.400 dengan semua gudang bergaris."""
        _, _, loc_mati = gudang
        m = _kimia(db_session, 'KIM-ADA', 'CHEMICAL ETHANOL')
        _masuk(db_session, m, loc_mati, 2400, 88800000)

        d = _laporan(client, auth_headers, hide_zero='true')
        baris = d['rows'][0]
        assert baris['total_qty'] == 2400
        assert baris['by_zone']['luar']['qty'] == 2400
        assert any(z['id'] == 'luar' for z in d['zones'])
        # total per kolom harus menjumlah persis jadi total baris
        assert round(sum(z['qty'] for z in baris['by_zone'].values()), 3) == baris['total_qty']

    def test_kolom_gudang_lain_tidak_muncul_kalau_tidak_perlu(self, client, auth_headers, db_session, gudang):
        _, loc, _ = gudang
        m = _kimia(db_session, 'KIM-ADA', 'CHEMICAL ETHANOL')
        _masuk(db_session, m, loc, 2400, 88800000)

        d = _laporan(client, auth_headers, hide_zero='true')
        assert not any(z['id'] == 'luar' for z in d['zones'])
        assert 'luar' not in d['rows'][0]['by_zone']

    def test_total_kolom_dan_total_laporan_tidak_bertengkar(self, client, auth_headers, db_session, gudang):
        zona, loc, loc_mati = gudang
        m = _kimia(db_session, 'KIM-ADA', 'CHEMICAL ETHANOL')
        _masuk(db_session, m, loc, 1000, 10000)
        _masuk(db_session, m, loc_mati, 2400, 88800000)

        d = _laporan(client, auth_headers, hide_zero='true')
        jumlah_kolom = sum(v['qty'] for v in d['zone_totals'].values())
        assert round(jumlah_kolom, 3) == d['totals']['qty'] == 3400
