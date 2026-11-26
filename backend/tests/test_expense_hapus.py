"""Siapa yang boleh menghapus draf biaya.

Sebelum 2026-11-26 siapa pun yang punya `expense.delete` bisa menghapus draf
biaya SIAPA PUN - dan izin itu tersemai ke 38 dari 39 peran, termasuk Helper
Gudang dan Viewer. Yang dijaga tes ini: draf orang lain hanya boleh dihapus
bagian keuangan (pemegang `expense.payment`), draf sendiri tetap bisa
dibereskan sendiri, dan biaya yang sudah lewat draf tidak bisa dihapus siapa pun.
"""
from datetime import date

import pytest

from models import db


def _peran(nama, izin):
    from models.user import Permission, Role, RolePermission
    r = Role(name=nama, is_active=True)
    db.session.add(r)
    db.session.commit()
    for n in izin:
        p = Permission.query.filter_by(name=n).first()
        if not p:
            modul, aksi = n.split('.')
            p = Permission(name=n, resource=modul, module=modul, action=aksi, is_active=True)
            db.session.add(p)
            db.session.commit()
        db.session.add(RolePermission(role_id=r.id, permission_id=p.id))
    db.session.commit()
    return r


def _pengguna(app, username, peran):
    from models.user import User, UserRole
    u = User(username=username, email=f'{username}@uji.local', full_name=username.title(),
             password_hash=app.bcrypt.generate_password_hash('ujicoba123').decode('utf-8'),
             is_active=True)
    db.session.add(u)
    db.session.commit()
    db.session.add(UserRole(user_id=u.id, role_id=peran.id))
    db.session.commit()
    return u


def _masuk(client, username):
    r = client.post('/api/auth/login', json={'username': username, 'password': 'ujicoba123'})
    return {'Authorization': f"Bearer {r.json['access_token']}"}


def _biaya(pemilik_id, status='draft'):
    from models.expense import Expense
    from models.hr import Employee
    peg = Employee.query.first()
    if not peg:
        peg = Employee(employee_number='EMP-UJI', first_name='Pegawai', last_name='Uji',
                       full_name='Pegawai Uji', hire_date=date(2026, 1, 1))
        db.session.add(peg)
        db.session.commit()
    e = Expense(expense_number=f'EXP-UJI-{pemilik_id}-{status}', employee_id=peg.id,
                expense_date=date(2026, 11, 26), expense_category='travel', expense_type='Cash',
                description='Uji hapus',
                amount=100000, status=status, created_by=pemilik_id, submitted_by=pemilik_id)
    db.session.add(e)
    db.session.commit()
    return e


@pytest.fixture
def dua_pengguna(app, db_session):
    gudang = _peran('Uji Helper Gudang', ['expense.view', 'expense.create', 'expense.delete'])
    keuangan = _peran('Uji Finance', ['expense.view', 'expense.delete', 'expense.payment'])
    return (_pengguna(app, 'ujigudang', gudang), _pengguna(app, 'ujifinance', keuangan))


def test_draf_orang_lain_tidak_bisa_dihapus_pemegang_izin_biasa(client, db_session, dua_pengguna):
    gudang, keuangan = dua_pengguna
    punya_keuangan = _biaya(keuangan.id)

    r = client.delete(f'/api/expenses/{punya_keuangan.id}', headers=_masuk(client, 'ujigudang'))

    assert r.status_code == 403
    assert 'keuangan' in r.get_json()['error'].lower()
    from models.expense import Expense
    assert db.session.get(Expense, punya_keuangan.id) is not None


def test_draf_sendiri_tetap_bisa_dibereskan_sendiri(client, db_session, dua_pengguna):
    gudang, _ = dua_pengguna
    punya_sendiri = _biaya(gudang.id)

    r = client.delete(f'/api/expenses/{punya_sendiri.id}', headers=_masuk(client, 'ujigudang'))

    assert r.status_code == 200, r.get_json()
    from models.expense import Expense
    assert db.session.get(Expense, punya_sendiri.id) is None


def test_keuangan_boleh_menghapus_draf_orang_lain(client, db_session, dua_pengguna):
    gudang, _ = dua_pengguna
    punya_gudang = _biaya(gudang.id)

    r = client.delete(f'/api/expenses/{punya_gudang.id}', headers=_masuk(client, 'ujifinance'))

    assert r.status_code == 200, r.get_json()


def test_biaya_yang_sudah_disetujui_tidak_bisa_dihapus_siapa_pun(client, db_session, dua_pengguna):
    _, keuangan = dua_pengguna
    disetujui = _biaya(keuangan.id, status='approved')

    r = client.delete(f'/api/expenses/{disetujui.id}', headers=_masuk(client, 'ujifinance'))

    assert r.status_code == 400
    from models.expense import Expense
    assert db.session.get(Expense, disetujui.id) is not None


def test_penyetuju_bukan_super_admin_tetap_bisa_menyetujui_dan_menolak(client, db_session, app):
    """Sampai 2026-11-26 syarat menyetujui biaya adalah SUPER ADMIN, bukan izin -
    jadi Manager Finance memegang `expense.approve` tapi selalu ditolak, dan
    tidak ada satu pun pengajuan yang bisa diproses. Yang dijaga: pemegang izin
    bisa memproses, dan yang hanya bisa melihat tetap tidak bisa."""
    from routes.expense import boleh_proses_semua

    penyetuju = _peran('Uji Manager Finance', ['expense.view', 'expense.approve', 'expense.payment'])
    pelihat = _peran('Uji Pelihat Biaya', ['expense.view'])
    orang_keuangan = _pengguna(app, 'ujiapprove', penyetuju)
    orang_biasa = _pengguna(app, 'ujilihat', pelihat)

    assert boleh_proses_semua(orang_keuangan.id) is True
    assert boleh_proses_semua(orang_biasa.id) is False

    # Menolak butuh izin menyetujui, bukan izin membuat.
    biaya = _biaya(orang_biasa.id, status='submitted')
    r = client.post(f'/api/expenses/{biaya.id}/reject',
                    json={'rejection_reason': 'Nota tidak terbaca'},
                    headers=_masuk(client, 'ujiapprove'))
    assert r.status_code == 200, r.get_json()
    from models.expense import Expense
    assert db.session.get(Expense, biaya.id).status == 'rejected'


def test_akun_tanpa_data_karyawan_tidak_melihat_biaya_siapa_pun(client, db_session, app):
    """Akun yang belum ditautkan ke data karyawan: daftarnya kosong (dulu 404
    sehingga halamannya gagal dibuka) dan dasbornya nol - dulu justru
    menampilkan rekap seluruh pabrik karena penyaringnya kosong."""
    pelihat = _peran('Uji Pelihat Dasbor', ['expense.view'])
    orang = _pengguna(app, 'ujitanpakaryawan', pelihat)
    _biaya(orang.id, status='submitted')   # dicatat atas nama pegawai lain

    h = _masuk(client, 'ujitanpakaryawan')
    daftar = client.get('/api/expenses', headers=h)
    assert daftar.status_code == 200, daftar.get_json()
    assert daftar.get_json()['expenses'] == []

    dasbor = client.get('/api/expenses/dashboard', headers=h)
    assert dasbor.status_code == 200, dasbor.get_json()
    ringkas = dasbor.get_json()
    ringkas = ringkas.get('dashboard', ringkas)
    assert float(ringkas.get('total_expenses') or 0) == 0
