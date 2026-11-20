"""Ubah faktur penjualan: jurnal lama dibalik, nomornya dipakai ulang.

Rute /sales/invoices/:id/edit sudah lama ada di frontend tapi menembak PUT yang
tidak pernah dibuat, jadi tombolnya tidak pernah dipasang. Sekarang alurnya sama
dengan faktur pembelian: POST faktur baru dengan replace_invoice_id.
"""
from datetime import date


def _customer(db_session):
    from models.sales import Customer
    from tests.test_void_gl import _setup_accounts
    _setup_accounts(db_session)
    c = Customer(code='CUST-EDIT', company_name='PT Uji Ubah Faktur')
    db_session.add(c)
    db_session.commit()
    return c


def _buat(client, headers, cust_id, jumlah, batch='B-1'):
    return client.post('/api/finance/invoices', headers=headers, json={
        'invoice_type': 'sales', 'customer_id': cust_id,
        'invoice_date': date.today().isoformat(), 'due_date': date.today().isoformat(),
        'items': [{'description': 'Tisu basah', 'quantity': 1, 'unit_price': jumlah, 'batch_number': batch}],
    })


def _jurnal(invoice_id):
    from models.finance import AccountingEntry
    return AccountingEntry.query.filter_by(reference_type='sales_invoice', reference_id=invoice_id).all()


def test_ubah_faktur_memakai_nomor_lama_dan_membalik_jurnal(client, auth_headers, db_session):
    cust = _customer(db_session)
    r = _buat(client, auth_headers, cust.id, 1_000_000)
    assert r.status_code in (200, 201), r.get_json()
    lama_id = r.get_json()['invoice_id']
    nomor = r.get_json()['invoice_number']
    assert _jurnal(lama_id), 'faktur pertama harus punya jurnal'

    r2 = client.post('/api/finance/invoices', headers=auth_headers, json={
        'invoice_type': 'sales', 'customer_id': cust.id, 'replace_invoice_id': lama_id,
        'invoice_date': date.today().isoformat(), 'due_date': date.today().isoformat(),
        'items': [{'description': 'Tisu basah', 'quantity': 2, 'unit_price': 1_000_000, 'batch_number': 'B-1'}],
    })
    assert r2.status_code in (200, 201), r2.get_json()
    assert r2.get_json()['invoice_number'] == nomor, 'faktur pengganti memakai nomor lama'

    from models.finance import Invoice
    baru = db_session.get(Invoice, r2.get_json()['invoice_id'])
    assert float(baru.total_amount) == 2_000_000

    lama = db_session.get(Invoice, lama_id)
    if lama is not None:            # faktur batal yang belum dibayar boleh dihapus
        assert lama.invoice_number.startswith(f'{nomor}-V')
        assert lama.status == 'cancelled'
        d = sum(float(e.debit_amount or 0) for e in _jurnal(lama_id))
        k = sum(float(e.credit_amount or 0) for e in _jurnal(lama_id))
        assert abs(d - k) < 0.01, 'jurnal lama + pembaliknya harus saling meniadakan'


def test_faktur_yang_sudah_dibayar_tidak_bisa_diubah(client, auth_headers, db_session):
    from models.finance import Payment
    cust = _customer(db_session)
    r = _buat(client, auth_headers, cust.id, 500_000, batch='B-2')
    inv_id = r.get_json()['invoice_id']
    db_session.add(Payment(payment_number='PAY-EDIT-1', payment_type='receipt', invoice_id=inv_id,
                           customer_id=cust.id, payment_date=date.today(), amount=500_000, status='completed', payment_method='transfer'))
    db_session.commit()

    r2 = client.post('/api/finance/invoices', headers=auth_headers, json={
        'invoice_type': 'sales', 'customer_id': cust.id, 'replace_invoice_id': inv_id,
        'invoice_date': date.today().isoformat(), 'due_date': date.today().isoformat(),
        'items': [{'description': 'Tisu basah', 'quantity': 3, 'unit_price': 500_000, 'batch_number': 'B-2'}],
    })
    assert r2.status_code == 400
    assert 'pembayaran' in r2.get_json()['error'].lower()
