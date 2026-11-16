"""Transfer Kas/Bank (routes/bank_transfer.py): jurnal, biaya transfer, pembatalan."""
from datetime import date

import pytest

from models import db
from models.finance import Account, AccountingEntry
from tests.test_finance_reports import _acc


@pytest.fixture
def akun(db_session):
    return {
        'bca': _acc('110101', 'Bank BCA', 'asset', 'debit', cash=True),
        'kas_pbg': _acc('110201', 'Kas Purbalingga', 'asset', 'debit', cash=True),
        'biaya': _acc('610101', 'Biaya Administrasi Bank', 'expense', 'debit'),
        'piutang': _acc('120101', 'Piutang Usaha', 'asset', 'debit'),
        'usd': _acc('110301', 'Bank USD', 'asset', 'debit', cash=True),
    }


def _post(client, headers, **body):
    body.setdefault('transfer_date', date.today().isoformat())
    return client.post('/api/finance/bank-transfers', json=body, headers=headers)


def _journal(transfer_id):
    rows = AccountingEntry.query.filter_by(reference_type='bank_transfer', reference_id=transfer_id).all()
    return {(r.account_code, float(r.debit_amount or 0), float(r.credit_amount or 0)) for r in rows}


def test_transfer_biasa_membuat_jurnal_seimbang(client, auth_headers, akun):
    r = _post(client, auth_headers, from_account_id=akun['bca'].id, to_account_id=akun['kas_pbg'].id,
              amount=5_000_000, notes='Kirim ke pabrik')
    assert r.status_code == 201, r.get_json()
    t = r.get_json()
    assert t['number'].startswith('TRF-') and t['status'] == 'posted' and t['journal_number']
    assert _journal(t['id']) == {('110201', 5_000_000.0, 0.0), ('110101', 0.0, 5_000_000.0)}


def test_biaya_transfer_dibebankan_ke_pengirim_atau_penerima(client, auth_headers, akun):
    kirim = _post(client, auth_headers, from_account_id=akun['bca'].id, to_account_id=akun['kas_pbg'].id,
                  amount=1_000_000, fee_amount=6_500, fee_account_id=akun['biaya'].id, fee_charged_to='from').get_json()
    assert _journal(kirim['id']) == {
        ('110201', 1_000_000.0, 0.0), ('110101', 0.0, 1_000_000.0),
        ('610101', 6_500.0, 0.0), ('110101', 0.0, 6_500.0),       # saldo pengirim berkurang 1.006.500
    }
    terima = _post(client, auth_headers, from_account_id=akun['bca'].id, to_account_id=akun['kas_pbg'].id,
                   amount=1_000_000, fee_amount=6_500, fee_account_id=akun['biaya'].id, fee_charged_to='to').get_json()
    assert ('110201', 0.0, 6_500.0) in _journal(terima['id'])      # kali ini saldo penerima yang dipotong


def test_tolak_akun_sama_bukan_kas_bank_dan_nilai_nol(client, auth_headers, akun):
    sama = _post(client, auth_headers, from_account_id=akun['bca'].id, to_account_id=akun['bca'].id, amount=1000)
    assert sama.status_code == 400 and 'tidak boleh sama' in sama.get_json()['error']

    bukan_kas = _post(client, auth_headers, from_account_id=akun['bca'].id, to_account_id=akun['piutang'].id, amount=1000)
    assert bukan_kas.status_code == 400 and 'bukan akun kas/bank' in bukan_kas.get_json()['error']

    nol = _post(client, auth_headers, from_account_id=akun['bca'].id, to_account_id=akun['kas_pbg'].id, amount=0)
    assert nol.status_code == 400 and 'lebih dari 0' in nol.get_json()['error']

    bukan_beban = _post(client, auth_headers, from_account_id=akun['bca'].id, to_account_id=akun['kas_pbg'].id,
                        amount=1000, fee_amount=5000, fee_account_id=akun['kas_pbg'].id)
    assert bukan_beban.status_code == 400 and 'bukan akun beban' in bukan_beban.get_json()['error']


def test_beda_mata_uang_wajib_isi_nilai_diterima_dan_selisih_kurs_masuk_jurnal(client, auth_headers, akun):
    akun['usd'].currency = 'USD'
    db.session.commit()

    kurang = _post(client, auth_headers, from_account_id=akun['usd'].id, to_account_id=akun['kas_pbg'].id,
                   amount=100, exchange_rate=16_000)
    assert kurang.status_code == 400 and 'nilai yang diterima' in kurang.get_json()['error']

    t = _post(client, auth_headers, from_account_id=akun['usd'].id, to_account_id=akun['kas_pbg'].id,
              amount=100, amount_received=1_590_000, exchange_rate=16_000).get_json()
    jurnal = _journal(t['id'])
    assert ('110201', 1_590_000.0, 0.0) in jurnal                  # rupiah yang benar-benar masuk
    assert ('110301', 0.0, 1_600_000.0) in jurnal                  # 100 USD x 16.000
    assert sum(d for _, d, _ in jurnal) == sum(c for _, _, c in jurnal)   # selisih 10.000 masuk akun selisih kurs


def test_pembatalan_membuat_jurnal_pembalik(client, auth_headers, akun):
    t = _post(client, auth_headers, from_account_id=akun['bca'].id, to_account_id=akun['kas_pbg'].id,
              amount=2_000_000).get_json()
    r = client.post(f"/api/finance/bank-transfers/{t['id']}/cancel", json={'reason': 'salah akun'}, headers=auth_headers)
    assert r.status_code == 200 and r.get_json()['status'] == 'cancelled'

    balik = AccountingEntry.query.filter_by(reference_type='void_bank_transfer', reference_id=t['id']).all()
    assert {(e.account_code, float(e.debit_amount or 0), float(e.credit_amount or 0)) for e in balik} == {
        ('110101', 2_000_000.0, 0.0), ('110201', 0.0, 2_000_000.0),
    }
    lagi = client.post(f"/api/finance/bank-transfers/{t['id']}/cancel", json={}, headers=auth_headers)
    assert lagi.status_code == 409


def test_daftar_transfer_bisa_disaring(client, auth_headers, akun):
    _post(client, auth_headers, from_account_id=akun['bca'].id, to_account_id=akun['kas_pbg'].id,
          amount=750_000, notes='Operasional pabrik')
    data = client.get('/api/finance/bank-transfers?q=operasional', headers=auth_headers).get_json()
    assert data['total'] == 1 and data['transfers'][0]['from_account']['code'] == '110101'
    kosong = client.get(f"/api/finance/bank-transfers?account_id={akun['piutang'].id}", headers=auth_headers).get_json()
    assert kosong['total'] == 0
