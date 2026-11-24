from datetime import date

from models.petty_cash import PettyCashFund


def _fund(db_session, custodian=None, approver=None, mode='app', opening=1000000):
    """Dana uji. Mode bawaan modul sekarang 'paper' (bon kertas, langsung tercatat);
    tes alur persetujuan memakai mode 'app' dengan saldo awal supaya hitungannya tetap."""
    PettyCashFund.query.delete()
    f = PettyCashFund(code='KK-HR', name='Kas Kecil HR', fixed_amount=1000000, per_txn_limit=500000, min_balance=100000,
                      custodian_user_id=custodian, approver_user_id=approver, approval_mode=mode, opening_balance=opening)
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
    lebih = client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(amount=500001, receipt_number='NOTA-LEBIH'))
    assert lebih.status_code == 201 and lebih.get_json()['over_limit'] is True   # uang sudah keluar: dicatat, ditandai
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
    assert pbg['code'] == 'KK-PBG' and pbg['cash_account_name'] == '100001 Kas Operasional' and pbg['balance'] == 0
    assert client.post('/api/petty-cash/funds', headers=auth_headers, json={'code': 'KK-X', 'name': 'X', 'cash_account_id': beban.id}).status_code == 400  # bukan akun kas/bank
    assert [f['code'] for f in client.get('/api/petty-cash/funds', headers=auth_headers).get_json()['funds']] == ['KK-HR', 'KK-PBG']
    # transaksi di Purbalingga tidak memengaruhi kas HR
    t = client.post(f"/api/petty-cash/transactions?fund_id={pbg['id']}", headers=auth_headers, json=_body(receipt_number='P1', amount=300000)).get_json()
    client.post(f"/api/petty-cash/transactions/{t['id']}/approve", headers=auth_headers, json={})
    client.post(f"/api/petty-cash/transactions/{t['id']}/pay", headers=auth_headers)
    assert client.get(f"/api/petty-cash/fund?fund_id={pbg['id']}", headers=auth_headers).get_json()['balance'] == -300000
    assert client.get('/api/petty-cash/fund', headers=auth_headers).get_json()['balance'] == 1000000
    assert client.get(f"/api/petty-cash/transactions?fund_id={pbg['id']}", headers=auth_headers).get_json()['total'] == 1
    assert client.get('/api/petty-cash/transactions', headers=auth_headers).get_json()['total'] == 0
    # nota yang sama boleh dipakai di kas kecil lain, tapi tidak di kas kecil yang sama
    assert client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(receipt_number='P1')).status_code == 201
    assert client.post(f"/api/petty-cash/transactions?fund_id={pbg['id']}", headers=auth_headers, json=_body(receipt_number='P1')).status_code == 400
    assert client.get('/api/petty-cash/accounts', headers=auth_headers).get_json()['accounts'][0]['code'] == '100001'


# --- mode pembukuan (bon kertas) + jurnal + sambungan ke Transfer Kas/Bank ---

def _akun(db_session):
    from models.finance import Account
    def mk(code, name, typ, cash=False):
        a = Account.query.filter_by(account_code=code).first()
        if not a:
            a = Account(account_code=code, account_name=name, account_type=typ, normal_balance='debit',
                        is_cash_bank=cash, is_active=True, is_header=False)
            db_session.add(a)
            db_session.commit()
        return a
    return {'kas': mk('100001', 'Kas Purbalingga', 'asset', True), 'bca': mk('100101', 'Bank BCA', 'asset', True),
            'konsumsi': mk('620133', 'Biaya Konsumsi', 'expense'), 'umum': mk('620118', 'Biaya Umum', 'expense')}


def _jurnal(tid, ref='petty_cash'):
    from models.finance import AccountingEntry
    return {(e.account_code, float(e.debit_amount or 0), float(e.credit_amount or 0))
            for e in AccountingEntry.query.filter_by(reference_type=ref, reference_id=tid).all()}


def test_bon_kertas_langsung_tercatat_dan_menjurnal(client, auth_headers, db_session):
    a = _akun(db_session)
    f = _fund(db_session, mode='paper', opening=1000000)
    f.cash_account_id, f.expense_account_id = a['kas'].id, a['umum'].id
    db_session.commit()
    client.put('/api/petty-cash/category-accounts', headers=auth_headers,
               json={'category_accounts': {'Konsumsi': a['konsumsi'].id}})

    t = client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(receipt_number='K1', amount=150000)).get_json()
    assert t['status'] == 'paid' and t['journal_number'] and t['expense_account_name'] == '620133 Biaya Konsumsi'
    assert _jurnal(t['id']) == {('620133', 150000.0, 0.0), ('100001', 0.0, 150000.0)}

    # kategori yang belum dipetakan jatuh ke akun bawaan dana
    t2 = client.post('/api/petty-cash/transactions', headers=auth_headers,
                     json=_body(receipt_number='K2', amount=50000, category='Lainnya')).get_json()
    assert _jurnal(t2['id']) == {('620118', 50000.0, 0.0), ('100001', 0.0, 50000.0)}
    assert client.get('/api/petty-cash/fund', headers=auth_headers).get_json()['balance'] == 800000


def test_nota_tercatat_dibatalkan_lewat_jurnal_pembalik(client, auth_headers, db_session):
    a = _akun(db_session)
    f = _fund(db_session, mode='paper', opening=500000)
    f.cash_account_id, f.expense_account_id = a['kas'].id, a['umum'].id
    db_session.commit()
    t = client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(receipt_number='B9', amount=100000)).get_json()
    r = client.post(f"/api/petty-cash/transactions/{t['id']}/cancel", headers=auth_headers, json={})
    assert r.status_code == 200 and r.get_json()['status'] == 'cancelled'
    assert _jurnal(t['id'], 'void_petty_cash') == {('620118', 0.0, 100000.0), ('100001', 100000.0, 0.0)}
    assert client.get('/api/petty-cash/fund', headers=auth_headers).get_json()['balance'] == 500000


def test_tanpa_akun_tetap_boleh_mencatat_tapi_belum_masuk_buku_besar(client, auth_headers, db_session):
    _fund(db_session, mode='paper', opening=0)
    t = client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(receipt_number='X1', amount=75000)).get_json()
    assert t['status'] == 'paid' and t['journal_number'] is None
    f = client.get('/api/petty-cash/fund', headers=auth_headers).get_json()
    assert f['gl_ready'] is False and f['balance'] == -75000 and f['negative_balance'] is True


def test_transfer_bank_mengisi_kas_kecil_dan_menutup_pengajuan(client, auth_headers, db_session):
    a = _akun(db_session)
    f = _fund(db_session, mode='paper', opening=0)
    f.cash_account_id, f.expense_account_id = a['kas'].id, a['umum'].id
    db_session.commit()
    fid = f.id

    daftar = client.get('/api/finance/bank-transfers/petty-cash-funds', headers=auth_headers).get_json()['funds']
    assert [x['code'] for x in daftar] == ['KK-HR'] and daftar[0]['open_request_id'] is None

    client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(receipt_number='M1', amount=400000))
    rep = client.post('/api/petty-cash/replenishments', headers=auth_headers, json={'amount': 400000}).get_json()

    trf = client.post('/api/finance/bank-transfers', headers=auth_headers, json={
        'transfer_date': '2026-11-13', 'from_account_id': a['bca'].id, 'to_account_id': a['kas'].id,
        'amount': 400000, 'petty_cash_fund_id': fid})
    assert trf.status_code == 201, trf.get_json()
    assert trf.get_json()['petty_cash_replenishment_id'] == rep['id']

    f2 = client.get('/api/petty-cash/fund', headers=auth_headers).get_json()
    assert f2['balance'] == 0 and f2['total_transfer_in'] == 400000      # 400.000 masuk, 400.000 keluar
    rep2 = client.get('/api/petty-cash/replenishments', headers=auth_headers).get_json()['replenishments'][0]
    assert rep2['status'] == 'received' and rep2['amount_received'] == 400000

    salah = client.post('/api/finance/bank-transfers', headers=auth_headers, json={
        'transfer_date': '2026-11-13', 'from_account_id': a['bca'].id, 'to_account_id': a['bca'].id,
        'amount': 100000, 'petty_cash_fund_id': fid})
    assert salah.status_code == 400


def test_mutasi_menampilkan_masuk_keluar_dan_saldo_berjalan(client, auth_headers, db_session):
    """Buku kas kecil mengikuti buku besar akun kasnya, termasuk urutannya."""
    a = _akun(db_session)
    f = _fund(db_session, mode='paper', opening=0)
    f.cash_account_id, f.expense_account_id = a['kas'].id, a['umum'].id
    db_session.commit()
    client.post('/api/finance/bank-transfers', headers=auth_headers, json={
        'transfer_date': '2026-11-10', 'from_account_id': a['bca'].id, 'to_account_id': a['kas'].id,
        'amount': 1000000, 'petty_cash_fund_id': f.id})
    client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(receipt_number='MU1', amount=250000))

    m = client.get('/api/petty-cash/mutations', headers=auth_headers).get_json()['mutations']
    assert [(x['kind'], x['in_amount'], x['out_amount'], x['balance']) for x in m] == [
        ('transfer', 1000000.0, 0.0, 1000000.0),
        ('expense', 0.0, 250000.0, 750000.0),
    ]
    # urutannya urutan pembukuan: tanggal, lalu urutan pencatatan di hari itu
    client.post('/api/finance/bank-transfers', headers=auth_headers, json={
        'transfer_date': '2026-11-13', 'from_account_id': a['bca'].id, 'to_account_id': a['kas'].id, 'amount': 500000})
    m2 = client.get('/api/petty-cash/mutations', headers=auth_headers).get_json()['mutations']
    assert [x['kind'] for x in m2] == ['transfer', 'expense', 'transfer']
    assert m2[-1]['balance'] == 1250000.0


def test_uang_keluar_lewat_pembayaran_kas_bank_ikut_terlihat(client, auth_headers, db_session):
    """Keluhan Finance Fengsheng 2026-11-24: pemakaian kas kecil 13-21 Nov dicatat
    sebagai satu Pembayaran Kas/Bank (klaim), bukan nota per lembar. Buku besarnya
    benar, tapi halaman kas kecil dulu hanya membaca transfer + nota - jadi saldonya
    tertinggal 878.600 lebih besar dari akuntansi."""
    from models.finance import AccountingEntry

    a = _akun(db_session)
    f = _fund(db_session, mode='paper', opening=0)
    f.cash_account_id, f.expense_account_id = a['kas'].id, a['umum'].id
    db_session.commit()
    client.post('/api/finance/bank-transfers', headers=auth_headers, json={
        'transfer_date': '2026-11-13', 'from_account_id': a['bca'].id, 'to_account_id': a['kas'].id,
        'amount': 1000000, 'petty_cash_fund_id': f.id})

    # klaim pemakaian dicatat di luar modul kas kecil, langsung ke akun kasnya
    for akun, debit, kredit in ((a['konsumsi'], 878600, 0), (a['kas'], 0, 878600)):
        db_session.add(AccountingEntry(
            entry_number=f'JE-UJI-{akun.account_code}', entry_date=date(2026, 11, 21), entry_type='payment',
            reference_type='payment', reference_number='PAY-UJI-00019', account_id=akun.id,
            account_code=akun.account_code, account_name=akun.account_name,
            debit_amount=debit, credit_amount=kredit, status='posted',
            description='Pembayaran - PAY-UJI-00019'))
    db_session.commit()

    d = client.get('/api/petty-cash/mutations', headers=auth_headers).get_json()
    assert [(x['kind'], x['number'], x['out_amount']) for x in d['mutations'] if x['out_amount']] == [
        ('payment', 'PAY-UJI-00019', 878600.0)]
    assert d['mutations'][-1]['balance'] == 121400.0
    assert d['summary']['balance'] == 121400.0        # bukan 1.000.000 seperti hitungan lama
    assert d['summary']['total_paid'] == 878600.0


def test_nota_yang_belum_terjurnal_tetap_mengurangi_saldo(client, auth_headers, db_session):
    """Akun beban kategorinya belum disetel -> notanya tidak bisa dijurnal. Uangnya
    tetap sudah keluar, jadi tidak boleh hilang dari saldo hanya karena buku besar
    belum menerimanya."""
    a = _akun(db_session)
    f = _fund(db_session, mode='paper', opening=0)
    f.cash_account_id, f.expense_account_id = a['kas'].id, None      # tanpa akun beban
    db_session.commit()
    client.post('/api/finance/bank-transfers', headers=auth_headers, json={
        'transfer_date': '2026-11-13', 'from_account_id': a['bca'].id, 'to_account_id': a['kas'].id,
        'amount': 1000000, 'petty_cash_fund_id': f.id})
    client.post('/api/petty-cash/transactions', headers=auth_headers, json=_body(receipt_number='NJ1', amount=300000))

    d = client.get('/api/petty-cash/mutations', headers=auth_headers).get_json()
    baris = [x for x in d['mutations'] if x['out_amount']]
    assert len(baris) == 1 and baris[0]['unposted'] is True
    assert 'belum terjurnal' in baris[0]['description']
    assert d['summary']['balance'] == 700000.0
