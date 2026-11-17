"""Ubah pembayaran: riwayat perubahannya tidak boleh menjatuhkan permintaan.

Keluhan Finance 2026-11-17 "name 'Decimal' is not defined": `_record_payment_edit_history()`
di routes/finance.py memakai Decimal, padahal impornya ada di dalam fungsi LAIN
(create_payment_core), jadi setiap kali pembayaran diubah muncul NameError.
"""
import inspect
from datetime import date

import routes.finance as finance_routes


def test_decimal_tersedia_di_tingkat_modul():
    assert getattr(finance_routes, 'Decimal', None) is not None, 'Decimal harus diimpor di tingkat modul'
    sumber = inspect.getsource(finance_routes._record_payment_edit_history)
    assert 'Decimal' in sumber        # memang dipakai di sini


def test_ubah_pembayaran_tercatat_di_riwayat(client, auth_headers, db_session):
    from models.finance import Account, GlobalAccountDefault, Payment
    from models.sales import Customer

    def acc(code, name, typ, normal):
        a = Account.query.filter_by(account_code=code).first()
        if not a:
            a = Account(account_code=code, account_name=name, account_type=typ,
                        normal_balance=normal, is_active=True, is_cash_bank=(typ == 'asset' and code.startswith('11')))
            db_session.add(a)
            db_session.commit()
        return a

    kas = acc('110101', 'Kas', 'asset', 'debit')
    pendapatan = acc('410101', 'Pendapatan Lain', 'revenue', 'credit')
    piutang = acc('120101', 'Piutang Usaha', 'asset', 'debit')
    for key, a in (('accounts_receivable', piutang),):
        if not GlobalAccountDefault.query.filter_by(transaction_key=key).first():
            db_session.add(GlobalAccountDefault(transaction_key=key, account_id=a.id))
    cust = Customer(code='C-EDIT', company_name='PT Uji Ubah', is_active=True)
    db_session.add(cust)
    db_session.commit()

    body = {
        'payment_type': 'receipt', 'payment_date': date.today().isoformat(), 'payment_method': 'cash',
        'customer_id': cust.id, 'bank_account_id': kas.id,
        'lines': [{'account_id': pendapatan.id, 'amount': 250000, 'description': 'Penerimaan lain'}],
    }
    dibuat = client.post('/api/finance/payments', json=body, headers=auth_headers)
    assert dibuat.status_code in (200, 201), dibuat.get_json()
    nomor = Payment.query.order_by(Payment.id.desc()).first().payment_number

    # Ubah = batalkan yang lama lalu buat ulang; di sinilah riwayat perubahan ditulis
    ubah = client.post('/api/finance/payments', json={**body, 'edit_of_number': nomor,
                                                      'lines': [{'account_id': pendapatan.id, 'amount': 300000,
                                                                 'description': 'Penerimaan lain'}]},
                       headers=auth_headers)
    assert ubah.status_code in (200, 201), ubah.get_json()
    assert float(Payment.query.order_by(Payment.id.desc()).first().amount) == 300000
