"""Masukan Finance 2026-11-17: batch wajib di faktur tanpa SO/SJ, tutup PO, mutasi karantina."""
from datetime import date

from models import db
from models.finance import Invoice, InvoiceItem
from models.product import Product
from models.purchasing import PurchaseOrder, Supplier
from models.sales import Customer


def _akun_wajib(db_session):
    """Akun minimal supaya faktur penjualan bisa menjurnal (piutang dan penjualan)."""
    from models.finance import Account, GlobalAccountDefault
    def acc(code, name, typ, normal):
        a = Account.query.filter_by(account_code=code).first()
        if not a:
            a = Account(account_code=code, account_name=name, account_type=typ, normal_balance=normal, is_active=True)
            db_session.add(a)
            db_session.commit()
        return a
    piutang = acc('120101', 'Piutang Usaha', 'asset', 'debit')
    penjualan = acc('410101', 'Penjualan', 'revenue', 'credit')
    ppn = acc('210301', 'PPN Keluaran', 'liability', 'credit')
    for key, a in (('accounts_receivable', piutang), ('akun_penjualan_id', penjualan), ('akun_ppn_keluaran_id', ppn)):
        if not GlobalAccountDefault.query.filter_by(transaction_key=key).first():
            db_session.add(GlobalAccountDefault(transaction_key=key, account_id=a.id))
    db_session.commit()


def _pelanggan(db_session):
    c = Customer(code='C-FB', company_name='PT Uji Faktur', is_active=True)
    db_session.add(c)
    db_session.commit()
    return c


def _produk(db_session):
    p = Product(code='FG-FB', name='Tisu Basah 50s', material_type='finished_goods',
                primary_uom='PCK', secondary_uom='CTN', is_active=True)
    db_session.add(p)
    db_session.commit()
    return p


def _faktur(client, auth_headers, cust, prod, **extra):
    body = {
        'invoice_type': 'sales', 'customer_id': cust.id, 'invoice_date': date.today().isoformat(),
        'items': [{'product_id': prod.id, 'description': prod.name, 'uom': 'PCK',
                   'quantity': 10, 'unit_price': 1000, **extra}],
    }
    return client.post('/api/finance/invoices', json=body, headers=auth_headers)


def test_faktur_tanpa_so_dan_surat_jalan_wajib_nomor_batch(client, auth_headers, db_session):
    _akun_wajib(db_session)
    cust, prod = _pelanggan(db_session), _produk(db_session)
    kosong = _faktur(client, auth_headers, cust, prod)
    assert kosong.status_code == 400 and 'nomor batch' in kosong.get_json()['error']

    isi = _faktur(client, auth_headers, cust, prod, batch_number='BATCH-01')
    assert isi.status_code == 201, isi.get_json()
    item = InvoiceItem.query.filter_by(invoice_id=isi.get_json()['invoice_id']).first()
    assert item.batch_number == 'BATCH-01' and item.uom == 'PCK'


def test_satuan_produk_ikut_dikirim_ke_form(client, auth_headers, db_session):
    prod = _produk(db_session)
    r = client.get('/api/products-new/', headers=auth_headers)
    assert r.status_code == 200
    row = next(p for p in r.get_json()['products'] if p['id'] == prod.id)
    assert row['primary_uom'] == 'PCK' and row['secondary_uom'] == 'CTN'


def _po(db_session, status='partial'):
    sup = Supplier(code='S-FB', company_name='PT Pemasok Uji', is_active=True)
    db_session.add(sup)
    db_session.commit()
    po = PurchaseOrder(po_number='PO-FB-001', supplier_id=sup.id, order_date=date.today(),
                       status=status, total_amount=1000000, created_by=1)
    db_session.add(po)
    db_session.commit()
    return po


def test_po_diterima_sebagian_bisa_ditutup(client, auth_headers, db_session):
    po = _po(db_session)
    tanpa_alasan = client.post(f'/api/purchasing/purchase-orders/{po.id}/close', json={}, headers=auth_headers)
    assert tanpa_alasan.status_code == 400

    ok = client.post(f'/api/purchasing/purchase-orders/{po.id}/close',
                     json={'reason': 'sisa dibatalkan pemasok'}, headers=auth_headers)
    assert ok.status_code == 200
    db.session.refresh(po)
    assert po.status == 'closed' and po.close_reason == 'sisa dibatalkan pemasok' and po.closed_at

    lagi = client.post(f'/api/purchasing/purchase-orders/{po.id}/close', json={'reason': 'x'}, headers=auth_headers)
    assert lagi.status_code == 409


def test_po_draft_tidak_ditutup_tapi_dibatalkan(client, auth_headers, db_session):
    po = _po(db_session, status='draft')
    r = client.post(f'/api/purchasing/purchase-orders/{po.id}/close', json={'reason': 'x'}, headers=auth_headers)
    assert r.status_code == 409 and 'dibatalkan' in r.get_json()['error']
