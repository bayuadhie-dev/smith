"""Pilihan satuan penerimaan hanya milik barang itu sendiri.

Dilaporkan 2026-11-25 ("Satuan plastik cryo koq inner"): pilihan satuan PLASTIK
CRYOPACK - bahan bersatuan dasar PCS tanpa konversi apa pun - memuat INR. INR itu
milik FALMED ALCOHOL SWAB (1 INR = 100 PCS), sebuah PRODUK. Penyaringnya dulu
berbunyi "material_id cocok ATAU material_id kosong", padahal konversi milik
produk juga punya material_id kosong. Kalau INR sampai terpilih, 53.800 yang
diterima tersimpan jadi 5.380.000 PCS - seratus kali lipat.
"""
import pytest

from models import db


def _uom(db_session, kode):
    from models.uom import UnitOfMeasure
    u = UnitOfMeasure.query.filter_by(code=kode).first()
    if not u:
        u = UnitOfMeasure(code=kode, name=kode, is_active=True)
        db_session.add(u)
        db_session.commit()
    return u


@pytest.fixture
def barang(db_session):
    from models.product import Material, Product
    from models.uom import UoMConversion

    bahan = Material(code='PLASTIK-CRYO', name='Plastik Cryopack', material_type='packaging_materials',
                     category='BAHAN PEMBANTU', primary_uom='PCS', is_active=True)
    produk = Product(code='SWAB-100', name='Alcohol Swab', material_type='finished_goods',
                     primary_uom='PCS', is_active=True)
    db_session.add_all([bahan, produk])
    db_session.commit()

    pcs, inr, rol = _uom(db_session, 'PCS'), _uom(db_session, 'INR'), _uom(db_session, 'ROL')
    # konversi milik PRODUK saja
    db_session.add(UoMConversion(from_uom_id=inr.id, to_uom_id=pcs.id, conversion_factor=100,
                                 product_id=produk.id, is_active=True))
    # konversi milik BAHAN saja
    db_session.add(UoMConversion(from_uom_id=rol.id, to_uom_id=pcs.id, conversion_factor=500,
                                 material_id=bahan.id, is_active=True))
    db_session.commit()
    return {'bahan': bahan, 'produk': produk}


def _pilihan(client, headers, **params):
    r = client.get('/api/purchasing/uom-options', headers=headers, query_string=params)
    assert r.status_code == 200, r.get_json()
    d = r.get_json()
    return d['base'], {o['code']: o['factor'] for o in d['options']}


def test_satuan_produk_tidak_bocor_ke_bahan(client, auth_headers, barang):
    base, opsi = _pilihan(client, auth_headers, material_id=barang['bahan'].id)
    assert base == 'PCS'
    assert 'INR' not in opsi, opsi          # INR milik produk, bukan bahan ini
    assert opsi['ROL'] == 500               # konversinya sendiri tetap ada
    assert opsi['PCS'] == 1


def test_satuan_bahan_tidak_bocor_ke_produk(client, auth_headers, barang):
    base, opsi = _pilihan(client, auth_headers, product_id=barang['produk'].id)
    assert base == 'PCS'
    assert 'ROL' not in opsi, opsi
    assert opsi['INR'] == 100


def test_konversi_umum_tetap_berlaku_untuk_keduanya(client, auth_headers, db_session, barang):
    """Konversi yang memang tidak menyebut barang apa pun tetap ikut."""
    from models.uom import UoMConversion
    lsn, pcs = _uom(db_session, 'LSN'), _uom(db_session, 'PCS')
    db_session.add(UoMConversion(from_uom_id=lsn.id, to_uom_id=pcs.id, conversion_factor=12,
                                 is_active=True))
    db_session.commit()

    _, bahan = _pilihan(client, auth_headers, material_id=barang['bahan'].id)
    _, produk = _pilihan(client, auth_headers, product_id=barang['produk'].id)
    assert bahan['LSN'] == 12 and produk['LSN'] == 12
