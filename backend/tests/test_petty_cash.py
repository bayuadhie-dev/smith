from models.petty_cash import PettyCashFund


def _fund(db_session, custodian=None, approver=None):
    PettyCashFund.query.delete()
    f = PettyCashFund(code='KK-HR', name='Kas Kecil HR', fixed_amount=1000000, per_txn_limit=500000, min_balance=100000,
                      custodian_user_id=custodian, approver_user_id=approver)
    db_session.add(f)
    db_session.commit()
    return f


def _body(**kw):
    b = {'requester_name': 'Rina', 'department': 'HRD', 'purpose': 'Beli galon', 'category': 'Konsumsi', 'amount': 250000,
         'receipt_number': 'NOTA-001', 'request_date': '2026-11-13'}
    b.update(kw)
    return b


def test_validasi_aturan(client, auth_headers, db_session):
    _fund(db_session)
    assert client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(amount=500001)).status_code == 400
    assert client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(receipt_number='')).status_code == 400
    assert client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(purpose=' ')).status_code == 400
    assert client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(requester_name='')).status_code == 400
    assert client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(category='Lain')).status_code == 400
    ok = client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(amount=500000))
    assert ok.status_code == 201, ok.get_json()
    dup = client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(receipt_number='nota-001'))
    assert dup.status_code == 400 and 'sudah dipakai' in dup.get_json()['error']


def test_alur_persetujuan_pencairan_dan_pengisian(client, auth_headers, db_session):
    _fund(db_session)
    t = client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(amount=450000, receipt_number='N1')).get_json()
    assert client.post(f"/api/petty-cash/transactions/{t['id']}/pay", headers=auth_headers).status_code == 409  # belum disetujui
    assert client.post(f"/api/petty-cash/transactions/{t['id']}/approve", headers=auth_headers, json={}).status_code == 200
    assert client.post(f"/api/petty-cash/transactions/{t['id']}/pay", headers=auth_headers).status_code == 200
    f = client.get('/api/petty-cash/fund', headers=auth_headers).get_json()
    assert f['balance'] == 550000 and f['total_paid'] == 450000 and not f['needs_replenishment']
    t2 = client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(amount=450000, receipt_number='N2', purpose='ATK', category='ATK dan fotokopi')).get_json()
    client.post(f"/api/petty-cash/transactions/{t2['id']}/approve", headers=auth_headers, json={})
    assert client.post(f"/api/petty-cash/transactions/{t2['id']}/pay", headers=auth_headers).status_code == 200
    f = client.get('/api/petty-cash/fund', headers=auth_headers).get_json()
    assert f['balance'] == 100000 and f['needs_replenishment'] and f['replenishment_reason'] == 'min_balance'
    assert f['suggested_replenishment'] == 900000
    # saldo tidak cukup untuk transaksi baru
    t3 = client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(amount=200000, receipt_number='N3')).get_json()
    client.post(f"/api/petty-cash/transactions/{t3['id']}/approve", headers=auth_headers, json={})
    assert client.post(f"/api/petty-cash/transactions/{t3['id']}/pay", headers=auth_headers).status_code == 409
    r = client.post('/api/petty-cash/replenishments', headers=auth_headers, json={})
    assert r.status_code == 201, r.get_json()
    rid = r.get_json()['id']
    assert sorted(r.get_json()['transaction_numbers']) == sorted([t['number'], t2['number']])
    assert client.post('/api/petty-cash/replenishments', headers=auth_headers, json={}).status_code == 409  # sudah ada yang terbuka
    assert client.post(f'/api/petty-cash/replenishments/{rid}/receive', headers=auth_headers, json={}).status_code == 409  # belum disetujui Finance
    assert client.post(f'/api/petty-cash/replenishments/{rid}/approve', headers=auth_headers).status_code == 200
    assert client.post(f'/api/petty-cash/replenishments/{rid}/receive', headers=auth_headers, json={}).status_code == 200
    f = client.get('/api/petty-cash/fund', headers=auth_headers).get_json()
    assert f['balance'] == 1000000 and not f['needs_replenishment']
    assert client.post(f"/api/petty-cash/transactions/{t3['id']}/pay", headers=auth_headers).status_code == 200


def test_tolak_dan_laporan(client, auth_headers, db_session):
    _fund(db_session)
    a = client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(receipt_number='A1', amount=100000)).get_json()
    b = client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(receipt_number='B1', amount=200000, category='ATK dan fotokopi')).get_json()
    assert client.post(f"/api/petty-cash/transactions/{a['id']}/reject", headers=auth_headers, json={}).status_code == 400  # alasan wajib
    assert client.post(f"/api/petty-cash/transactions/{a['id']}/reject", headers=auth_headers, json={'reason': 'tidak perlu'}).status_code == 200
    client.post(f"/api/petty-cash/transactions/{b['id']}/approve", headers=auth_headers, json={})
    client.post(f"/api/petty-cash/transactions/{b['id']}/pay", headers=auth_headers)
    # nota yang ditolak boleh dipakai lagi
    assert client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(receipt_number='A1', amount=50000)).status_code == 201
    rep = client.get('/api/petty-cash/report?date_from=2026-11-01&date_to=2026-11-30', headers=auth_headers).get_json()
    assert rep['count'] == 3 and rep['total_counted'] == 250000  # 200000 dibayar + 50000 baru, yang ditolak tidak dihitung
    assert {c['name']: c['amount'] for c in rep['by_category']}['ATK dan fotokopi'] == 200000


def test_pengaturan(client, auth_headers, db_session):
    _fund(db_session)
    assert client.put('/api/petty-cash/fund', headers=auth_headers, json={'min_balance': 2000000}).status_code == 400
    r = client.put('/api/petty-cash/fund', headers=auth_headers, json={'fixed_amount': 2000000, 'per_txn_limit': 700000, 'min_balance': 200000})
    assert r.status_code == 200 and r.get_json()['fixed_amount'] == 2000000


def _user_with(app, db_session, username, perms):
    from models.user import User, Role, Permission, RolePermission, UserRole
    pw = app.bcrypt.generate_password_hash('pw12345678').decode('utf-8')
    u = User(username=username, email=f'{username}@example.com', full_name=username.title(), password_hash=pw, is_active=True)
    db_session.add(u)
    role = Role(name=f'role_{username}', description='uji')
    db_session.add(role)
    db_session.flush()
    for name in perms:
        p = Permission.query.filter_by(name=name).first() or Permission(name=name, resource='petty_cash', action=name.split('.')[1], is_active=True)
        db_session.add(p)
        db_session.flush()
        db_session.add(RolePermission(role_id=role.id, permission_id=p.id))
    db_session.add(UserRole(user_id=u.id, role_id=role.id))
    db_session.commit()
    return u


def _login(client, username):
    return {'Authorization': 'Bearer ' + client.post('/api/auth/login', json={'username': username, 'password': 'pw12345678'}).json['access_token']}


def test_hanya_penyetuju_dan_pemegang_kas_yang_ditunjuk(client, auth_headers, db_session, app):
    pm = _user_with(app, db_session, 'plantmgr', ['petty_cash.view', 'petty_cash.approve'])
    other = _user_with(app, db_session, 'managerlain', ['petty_cash.view', 'petty_cash.approve'])
    kas = _user_with(app, db_session, 'pemegangkas', ['petty_cash.view', 'petty_cash.pay', 'petty_cash.create'])
    lain = _user_with(app, db_session, 'stafflain', ['petty_cash.view', 'petty_cash.pay'])
    _fund(db_session, custodian=kas.id, approver=pm.id)
    t = client.post('/api/petty-cash/transactions', headers=_login(client, 'pemegangkas'), json=_body(receipt_number='Z1')).get_json()
    assert client.post(f"/api/petty-cash/transactions/{t['id']}/approve", headers=_login(client, 'managerlain'), json={}).status_code == 403
    assert client.post(f"/api/petty-cash/transactions/{t['id']}/approve", headers=_login(client, 'plantmgr'), json={}).status_code == 200
    assert client.post(f"/api/petty-cash/transactions/{t['id']}/pay", headers=_login(client, 'stafflain')).status_code == 403
    assert client.post(f"/api/petty-cash/transactions/{t['id']}/pay", headers=_login(client, 'pemegangkas')).status_code == 200


def test_banyak_kas_kecil_dan_akun_kas(client, auth_headers, db_session):
    from models.finance import Account
    _fund(db_session)
    kas = Account(account_code='100001', account_name='Kas Operasional', account_type='asset', normal_balance='debit', is_cash_bank=True)
    beban = Account(account_code='620001', account_name='Beban Umum', account_type='expense', normal_balance='debit', is_cash_bank=False)
    db_session.add_all([kas, beban])
    db_session.commit()
    assert client.post('/api/petty-cash/funds', headers=auth_headers, json={'code': 'KK-HR', 'name': 'Dobel'}).status_code == 400
    r = client.post('/api/petty-cash/funds', headers=auth_headers, json={'code': 'kk-pbg', 'name': 'Kas Kecil Purbalingga', 'fixed_amount': 2000000,
                                                                          'per_txn_limit': 500000, 'min_balance': 200000, 'cash_account_id': kas.id})
    assert r.status_code == 201, r.get_json()
    pbg = r.get_json()
    assert pbg['code'] == 'KK-PBG' and pbg['cash_account_name'] == '100001 Kas Operasional' and pbg['balance'] == 2000000
    assert client.post('/api/petty-cash/funds', headers=auth_headers, json={'code': 'KK-X', 'name': 'X', 'cash_account_id': beban.id}).status_code == 400  # bukan akun kas/bank
    assert [f['code'] for f in client.get('/api/petty-cash/funds', headers=auth_headers).get_json()['funds']] == ['KK-HR', 'KK-PBG']
    # transaksi di Purbalingga tidak memengaruhi kas HR
    t = client.post(f"/api/petty-cash/transactions?fund_id={pbg['id']}", headers=auth_headers, json=_body(receipt_number='P1', amount=300000)).get_json()
    client.post(f"/api/petty-cash/transactions/{t['id']}/approve", headers=auth_headers, json={})
    client.post(f"/api/petty-cash/transactions/{t['id']}/pay", headers=auth_headers)
    assert client.get(f"/api/petty-cash/fund?fund_id={pbg['id']}", headers=auth_headers).get_json()['balance'] == 1700000
    assert client.get('/api/petty-cash/fund', headers=auth_headers).get_json()['balance'] == 1000000
    assert client.get(f"/api/petty-cash/transactions?fund_id={pbg['id']}", headers=auth_headers).get_json()['total'] == 1
    assert client.get('/api/petty-cash/transactions', headers=auth_headers).get_json()['total'] == 0
    # nota yang sama boleh dipakai di kas kecil lain, tapi tidak di kas kecil yang sama
    assert client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(receipt_number='P1')).status_code == 201
    assert client.post(f"/api/petty-cash/transactions?fund_id={pbg['id']}", headers=auth_headers, json=_body(receipt_number='P1')).status_code == 400
    assert client.get('/api/petty-cash/accounts', headers=auth_headers).get_json()['accounts'][0]['code'] == '100001'
