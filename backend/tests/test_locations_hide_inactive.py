"""Gudang yang sudah dinonaktifkan tidak boleh muncul di pilihan lokasi.

Dari situlah barang nyangkut: form penerimaan menampilkan zona lama (Raw
Materials Zone, Gudang WIP) berdampingan dengan gudang Fengsheng yang baru, dan
sekali salah pilih, stoknya duduk di gudang yang sudah mati.
"""


def _zona(db_session, code, aktif=True):
    from models.warehouse import WarehouseZone, WarehouseLocation
    z = WarehouseZone(code=code, name=f'Zona {code}', material_type='raw_materials', is_active=aktif)
    db_session.add(z)
    db_session.commit()
    l = WarehouseLocation(zone_id=z.id, location_code=f'{code}-01', rack='R1', level='L1',
                          position='P1', capacity=100, capacity_uom='kg')
    db_session.add(l)
    db_session.commit()
    return l


def test_lokasi_di_gudang_mati_tidak_ikut(client, auth_headers, db_session):
    hidup = _zona(db_session, 'Z-HIDUP', True)
    mati = _zona(db_session, 'Z-MATI', False)

    r = client.get('/api/warehouse/locations?per_page=500', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    kode = [l['location_code'] for l in r.get_json()['locations']]
    assert hidup.location_code in kode
    assert mati.location_code not in kode


def test_halaman_master_masih_bisa_melihat_semuanya(client, auth_headers, db_session):
    mati = _zona(db_session, 'Z-MATI2', False)

    r = client.get('/api/warehouse/locations?per_page=500&include_inactive=1', headers=auth_headers)
    kode = [l['location_code'] for l in r.get_json()['locations']]
    assert mati.location_code in kode
