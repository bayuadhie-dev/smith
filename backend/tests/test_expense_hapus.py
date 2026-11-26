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
