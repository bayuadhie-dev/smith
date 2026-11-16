"""Pencarian global: ketik NAMA jenis dokumen, bukan cuma nomornya (routes/search.py)."""
from datetime import date, datetime

import pytest

from models.product import Product
from models.sales import Customer
from models.shipping import ShippingOrder
from routes.search import _type_hints


def _search(client, auth_headers, q):
    r = client.get(f'/api/search/global?q={q}', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    return r.get_json()['data']['results']


@pytest.fixture
def world(db_session, test_user):
    cust = Customer(code='C-SRC', company_name='PT Pelanggan Cari', is_active=True)
    prod = Product(code='PRD-SRC', name='Kain Spunlace', material_type='finished_goods', primary_uom='KG', is_active=True)
    db_session.add_all([cust, prod])
    db_session.commit()
    for n in ('SHP-26/11/001', 'SHP-26/11/002'):
        db_session.add(ShippingOrder(shipping_number=n, customer_id=cust.id, shipping_date=datetime.combine(date.today(), datetime.min.time()),
                                     status='delivered', prepared_by=test_user.id))
    db_session.commit()
    return {'customer': cust, 'product': prod}


def test_alias_cocok_persis_atau_awalan_minimal_empat_huruf():
    assert 'shipping' in _type_hints('surat jalan')
    assert 'shipping' in _type_hints('SURAT')          # awalan, sebelum kata kedua diketik
    assert 'shipping' in _type_hints('sj')             # singkatan, harus cocok persis
    assert 'grn' in _type_hints('penerimaan barang')
    assert _type_hints('sj1') == set()                 # bukan alias, jangan ikut
    assert _type_hints('') == set()
    # singkatan dua huruf tidak boleh kena lewat aturan awalan
    assert 'sales_orders' in _type_hints('so') and 'sales_orders' not in _type_hints('s')


def test_nama_jenis_memunculkan_dokumen_terbaru(client, auth_headers, world):
    hasil = _search(client, auth_headers, 'surat jalan')
    nomor = [r['title'] for r in hasil if r['type'] == 'Surat Jalan']
    assert nomor == ['SHP-26/11/002', 'SHP-26/11/001']   # terbaru dulu
    assert hasil[0]['type'] == 'Surat Jalan'             # jenis yang diketik naik ke atas


def test_pencarian_nomor_tetap_jalan(client, auth_headers, world):
    hasil = _search(client, auth_headers, 'SHP-26/11/001')
    assert [r['title'] for r in hasil if r['type'] == 'Surat Jalan'] == ['SHP-26/11/001']


def test_kata_biasa_tidak_ikut_memunculkan_semua_dokumen(client, auth_headers, world):
    hasil = _search(client, auth_headers, 'spunlace')
    assert [r['title'] for r in hasil] == ['Kain Spunlace']


def test_hak_akses_per_pengguna_tetap_dipakai_walau_jenis_yang_diketik(client, app, db_session, world):
    """Nama jenis dokumen tidak boleh menembus izin: tanpa shipping.view, mengetik
    "surat jalan" tetap tidak memunculkan satu pun Surat Jalan."""
    from models.user import User
    from models.user import Role, Permission, RolePermission, UserRole

    hash_ = app.bcrypt.generate_password_hash('gudang123').decode('utf-8')
    u = User(username='gudangsaja', email='gudang@example.com', full_name='Staf Gudang',
             password_hash=hash_, is_admin=False, is_super_admin=False, is_active=True)
    role = Role(name='gudang_saja', description='hanya produk', is_active=True)
    perm = Permission(name='products.view', resource='products', module='products', action='view', is_active=True)
    db_session.add_all([u, role, perm])
    db_session.commit()
    db_session.add_all([RolePermission(role_id=role.id, permission_id=perm.id), UserRole(user_id=u.id, role_id=role.id)])
    db_session.commit()

    token = client.post('/api/auth/login', json={'username': 'gudangsaja', 'password': 'gudang123'}).json['access_token']
    headers = {'Authorization': f'Bearer {token}'}

    hasil = _search(client, headers, 'surat jalan')
    assert [r for r in hasil if r['type'] == 'Surat Jalan'] == []
    # tapi modul yang diizinkan tetap terbuka
    assert [r['title'] for r in _search(client, headers, 'produk')] != []
