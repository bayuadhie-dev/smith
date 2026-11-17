"""Peran yang mengurus dokumen transaksi harus bisa membaca master barang.

Keluhan Finance 2026-11-17: dropdown produk dan material di PO kosong dan satuan
terkunci di PCS, karena peran Finance hanya punya izin dokumen (purchase_orders.view,
finance.view) tanpa products.view/materials.view, dan daftar satuan pun dijaga
materials.view.
"""
from models.user import Permission, Role, RolePermission, User, UserRole


def _user_peran(app, db_session, username, izin):
    pw = app.bcrypt.generate_password_hash('pw12345678').decode('utf-8')
    u = User(username=username, email=f'{username}@example.com', full_name=username,
             password_hash=pw, is_active=True, is_super_admin=False, is_admin=False)
    role = Role(name=f'peran_{username}', description='uji', is_active=True)
    db_session.add_all([u, role])
    db_session.flush()
    for name in izin:
        p = Permission.query.filter_by(name=name).first()
        if not p:
            modul, aksi = name.split('.')
            p = Permission(name=name, resource=modul, module=modul, action=aksi, is_active=True)
            db_session.add(p)
            db_session.flush()
        db_session.add(RolePermission(role_id=role.id, permission_id=p.id))
    db_session.add(UserRole(user_id=u.id, role_id=role.id))
    db_session.commit()
    return u


def _login(client, username):
    r = client.post('/api/auth/login', json={'username': username, 'password': 'pw12345678'})
    return {'Authorization': 'Bearer ' + r.json['access_token']}


def test_daftar_satuan_terbuka_untuk_yang_mengurus_dokumen(client, app, db_session):
    _user_peran(app, db_session, 'orangfinance', ['finance.view', 'purchase_orders.view'])
    h = _login(client, 'orangfinance')
    assert client.get('/api/uom/units', headers=h).status_code == 200


def test_tanpa_izin_apa_pun_daftar_satuan_tetap_tertutup(client, app, db_session):
    _user_peran(app, db_session, 'orangluar', ['dashboard.view'])
    h = _login(client, 'orangluar')
    assert client.get('/api/uom/units', headers=h).status_code == 403
