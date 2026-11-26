"""Angka rupiah di dasbor utama tidak untuk semua orang.

Sampai 2026-11-26 rupiah di dasbor ikut izin `<modul>.view` yang dipegang hampir
semua peran: nilai stok fisik terbaca sampai helper gudang (21 peran), omzet dan
piutang terbaca staf PPIC (12 peran). Yang dijaga tes ini: yang tidak berhak
TIDAK menerima satu pun angka berformat rupiah - dan tetap dapat gantinya dalam
bentuk kuantitas, bukan baris kosong.
"""
import pytest

from models import db


def _izin(nama):
    from models.user import Permission
    p = Permission.query.filter_by(name=nama).first()
    if not p:
        modul, aksi = nama.split('.', 1)
        p = Permission(name=nama, resource=modul, module=modul, action=aksi, is_active=True)
        db.session.add(p)
        db.session.commit()
    return p


def _peran(nama, daftar_izin):
    from models.user import Role, RolePermission
    r = Role(name=nama, is_active=True)
    db.session.add(r)
    db.session.commit()
    for n in daftar_izin:
        db.session.add(RolePermission(role_id=r.id, permission_id=_izin(n).id))
    db.session.commit()
    return r


def _pengguna(app, username, peran):
    from models.user import User, UserRole
    u = User(username=username, email=f'{username}@uji.local', full_name=username,
             password_hash=app.bcrypt.generate_password_hash('ujicoba123').decode('utf-8'),
             is_active=True)
    db.session.add(u)
    db.session.commit()
    db.session.add(UserRole(user_id=u.id, role_id=peran.id))
    db.session.commit()
    return u


def _dasbor(client, username):
    r = client.post('/api/auth/login', json={'username': username, 'password': 'ujicoba123'})
    h = {'Authorization': f"Bearer {r.json['access_token']}"}
    d = client.get('/api/dashboard/modules', headers=h)
    assert d.status_code == 200, d.get_json()
    return d.get_json()


def _rupiah(dasbor):
    """Semua baris berformat rupiah yang ikut terkirim ke browser."""
    keluar = [i['key'] for m in dasbor['modules'] for i in m['items'] if i.get('format') == 'currency']
    keluar += [h['key'] for h in dasbor.get('headline', []) if h.get('format') == 'currency']
    return keluar


@pytest.fixture
def staf_gudang(app, db_session):
    peran = _peran('Uji Helper Gudang Dasbor',
                   ['dashboard.view', 'warehouse.view', 'sales.view', 'purchasing.view', 'finance.view'])
    return _pengguna(app, 'ujihelper', peran)


@pytest.fixture
def orang_keuangan(app, db_session):
    peran = _peran('Uji Manager Finance Dasbor',
                   ['dashboard.view', 'dashboard.finance', 'warehouse.view', 'sales.view',
                    'purchasing.view', 'finance.view'])
    return _pengguna(app, 'ujifinansial', peran)


def test_staf_tidak_menerima_satu_pun_angka_rupiah(client, staf_gudang):
    d = _dasbor(client, 'ujihelper')
    assert _rupiah(d) == [], f'rupiah masih terkirim: {_rupiah(d)}'
    # Blok Keuangan (kas, piutang usaha, utang usaha) tidak ikut dikirim sama sekali.
    assert 'finance' not in [m['key'] for m in d['modules']]


def test_staf_tetap_dapat_gantinya_dalam_kuantitas(client, staf_gudang):
    d = _dasbor(client, 'ujihelper')
    per_modul = {m['key']: [i['key'] for i in m['items']] for m in d['modules']}
    assert 'batch' in per_modul.get('warehouse', []), 'nilai stok hilang tanpa pengganti'
    assert 'so_bulan' in per_modul.get('sales', []), 'omzet hilang tanpa pengganti'
    assert 'hutang_n' in per_modul.get('purchasing', []), 'utang hilang tanpa pengganti'
    # Angka operasionalnya tidak ikut hilang.
    assert 'so_open' in per_modul.get('sales', [])
    assert 'po_open' in per_modul.get('purchasing', [])


def test_pemegang_izin_tetap_melihat_rupiahnya(client, orang_keuangan):
    d = _dasbor(client, 'ujifinansial')
    rupiah = _rupiah(d)
    for kunci in ('nilai', 'omzet', 'hutang', 'kas', 'ar', 'ap'):
        assert kunci in rupiah, f'{kunci} hilang untuk pemegang dashboard.finance'
