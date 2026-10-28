"""Pusat Impor: Faktur Penjualan & Faktur Pembelian (imports/invoices.py)."""
import io
from datetime import date

import openpyxl

from tests.test_fase11_purchase_invoice_total_price_fallback import _setup_po
from tests.test_void_gl import _setup_accounts

SALES = ['No. Faktur', 'Tanggal', 'Pelanggan', 'Jatuh Tempo', 'Kode Barang', 'Deskripsi', 'Qty', 'Satuan', 'Harga Satuan',
         'Diskon %', 'Kode Pajak', 'Keterangan', 'No. Pesanan']
PURCH = ['No. Faktur Pemasok', 'Tanggal', 'Tanggal Faktur Pemasok', 'No. PO', 'Jatuh Tempo', 'Kode Barang', 'Qty', 'Harga Satuan',
         'Kode Pajak', 'Keterangan']


def _xlsx(headers, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(headers)
    for r in rows:
        ws.append(r)
    b = io.BytesIO()
    wb.save(b)
    b.seek(0)
    return b


def _post(client, headers, kind, buf, commit):
    return client.post(f'/api/imports/{kind}', headers=headers, content_type='multipart/form-data',
                       data={'file': (buf, 'x.xlsx'), 'commit': '1' if commit else '0'}).get_json()


def _journal_totals():
    from models.finance import AccountingEntry
    rows = AccountingEntry.query.all()
    return len(rows), round(sum(float(r.debit_amount or 0) for r in rows), 2), round(sum(float(r.credit_amount or 0) for r in rows), 2)


def test_sales_preview_saves_nothing_and_commit_posts_balanced_journal(client, auth_headers, db_session, test_customer, test_product):
    from models.finance import Invoice
    _setup_accounts(db_session)
    today = date.today().isoformat()
    rows = [
        ['A1', today, test_customer.code, '', test_product.code, '', 2, '', 100000, 0, '', 'dua barang', ''],
        ['A1', today, test_customer.code, '', '', 'Jasa kirim', 1, '', 50000, 10, 'Y', '', ''],
        ['', today, 'TIDAK-ADA', '', test_product.code, '', 1, '', 1000, '', '', '', ''],
        ['B2', today, test_customer.code, '', 'KODE-SALAH', '', 1, '', 1000, '', '', '', ''],
    ]
    before_inv, before_j = Invoice.query.count(), _journal_totals()
    prev = _post(client, auth_headers, 'sales_invoice', _xlsx(SALES, rows), False)
    assert prev['committed'] is False and prev['summary']['total'] == 3 and prev['summary']['ok'] == 1 and prev['summary']['error'] == 2
    errors = ' '.join(e for t in prev['transactions'] for e in t['errors'])
    assert 'TIDAK-ADA' in errors and 'KODE-SALAH' in errors
    assert Invoice.query.count() == before_inv and _journal_totals() == before_j        # pratinjau tidak menyimpan apa pun

    done = _post(client, auth_headers, 'sales_invoice', _xlsx(SALES, rows), True)
    ok = [t for t in done['transactions'] if not t['errors']]
    assert len(ok) == 1 and ok[0]['created'].startswith('INV-')
    inv = Invoice.query.filter_by(invoice_number=ok[0]['created']).first()
    assert len(inv.items) == 2                                           # dua item satu faktur
    assert float(inv.subtotal) == 2 * 100000 + 50000 * 0.9
    assert 'No. asal: A1' in (inv.notes or '')
    n, deb, cred = _journal_totals()
    assert n > before_j[0] and abs(deb - cred) < 0.01


def test_sales_rejects_mixed_customers_in_one_invoice_and_bad_values(client, auth_headers, db_session, test_customer, test_product):
    _setup_accounts(db_session)
    today = date.today().isoformat()
    rows = [
        ['M1', today, test_customer.code, '', test_product.code, '', 1, '', 1000, '', '', '', ''],
        ['M1', today, 'Lain', '', test_product.code, '', 1, '', 1000, '', '', '', ''],
        ['Q1', today, test_customer.code, '', test_product.code, '', 0, '', 1000, '', '', '', ''],
        ['D1', today, test_customer.code, '', test_product.code, '', 1, '', 1000, 150, '', '', ''],
        ['T1', today, test_customer.code, '', test_product.code, '', 1, '', 1000, '', 'Z', '', ''],
    ]
    res = _post(client, auth_headers, 'sales_invoice', _xlsx(SALES, rows), False)
    assert res['summary']['ok'] == 0 and res['summary']['error'] == 4
    text = ' '.join(e for t in res['transactions'] for e in t['errors'])
    assert 'berbeda' in text or 'Pelanggan' in text
    assert 'Qty' in text and 'Diskon' in text and 'Kode pajak' in text


def test_purchase_invoice_import_links_po_lines_and_posts(client, auth_headers, db_session):
    from models.finance import Invoice
    supplier, material, po, po_item = _setup_po(db_session, unit_price=10000, quantity=50)
    today = date.today().isoformat()
    rows = [
        ['SUP-1', today, today, po.po_number, '', material.code, 20, '', '', 'sebagian'],
        ['SUP-2', today, today, po.po_number, '', material.code, 40, '', '', 'melebihi sisa'],
        ['SUP-3', today, today, 'PO-TIDAK-ADA', '', material.code, 1, '', '', ''],
        ['SUP-4', today, today, po.po_number, '', 'KODE-LAIN', 1, '', '', ''],
    ]
    before_j = _journal_totals()
    prev = _post(client, auth_headers, 'purchase_invoice', _xlsx(PURCH, rows), False)
    assert prev['summary']['ok'] == 2 and prev['summary']['error'] == 2   # SUP-1 dan SUP-2 valid sendiri-sendiri, dua lainnya salah
    assert _journal_totals() == before_j and Invoice.query.filter_by(invoice_type='purchase').count() == 0

    done = _post(client, auth_headers, 'purchase_invoice', _xlsx(PURCH, rows), True)
    created = [t['created'] for t in done['transactions'] if t['created']]
    assert created and created[0].startswith('PI-')
    inv = Invoice.query.filter_by(invoice_number=created[0]).first()
    assert inv.supplier_invoice_number == 'SUP-1' and inv.purchase_order_id == po.id and float(inv.total_amount) == 200000
    n, deb, cred = _journal_totals()
    assert n > before_j[0] and abs(deb - cred) < 0.01
    from models.purchasing import PurchaseOrderItem
    assert float(PurchaseOrderItem.query.get(po_item.id).quantity_invoiced) >= 20


def test_template_and_kinds_listed(client, auth_headers, db_session):
    kinds = {k['key'] for k in client.get('/api/imports/kinds', headers=auth_headers).get_json()['kinds']}
    assert {'sales_invoice', 'purchase_invoice'} <= kinds
    for k in ('sales_invoice', 'purchase_invoice'):
        r = client.get(f'/api/imports/{k}/template', headers=auth_headers)
        assert r.status_code == 200 and r.data[:2] == b'PK'
