import io
from datetime import date

import openpyxl

SO_HEAD = ['No. Pesanan', 'Tanggal', 'Pelanggan', 'Tanggal Kirim', 'No. PO Pelanggan', 'Kode Barang', 'Qty', 'Satuan',
           'Harga Satuan', 'Diskon %', 'Kode Pajak', 'Keterangan', 'Alamat Kirim']
PO_HEAD = ['No. Pesanan', 'Tanggal', 'Pemasok', 'Tanggal Dibutuhkan', 'Mata Uang', 'Kode Barang', 'Qty', 'Satuan',
           'Harga Satuan', 'Jadwal Kedatangan', 'Keterangan']


def _xlsx(head, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Data'
    ws.append(head)
    for r in rows:
        ws.append(r)
    b = io.BytesIO()
    wb.save(b)
    b.seek(0)
    return b


def _post(client, headers, kind, buf, commit):
    return client.post(f'/api/imports/{kind}', headers=headers, content_type='multipart/form-data',
                       data={'file': (buf, 'x.xlsx'), 'commit': '1' if commit else '0'})


def _supplier(db_session, code='SUP-IMP', active=True):
    from models.purchasing import Supplier
    s = Supplier(code=code, company_name='Pemasok Impor', is_active=active)
    db_session.add(s)
    db_session.commit()
    return s


def test_so_preview_does_not_save_or_consume_numbers_and_commit_saves_multi_item(client, auth_headers, db_session, test_customer, test_product):
    from models.sales import SalesOrder
    today = date.today().isoformat()
    rows = [['SO-IMP-1', today, 'CUST-001', '', '', 'TEST-001', 10, '', 1000, 10, '', 'a', 'Jl. A'],
            ['SO-IMP-1', today, 'CUST-001', '', '', 'TEST-001', 5, 'BOX', 2000, 0, 'Y', 'b', ''],
            ['', today, 'Test Company', '', '', 'TEST-001', 1, '', 500, 0, '', '', '']]
    before = SalesOrder.query.count()
    prev = _post(client, auth_headers, 'sales_order', _xlsx(SO_HEAD, rows), False).get_json()
    assert prev['summary']['ok'] == 2 and prev['summary']['error'] == 0
    assert SalesOrder.query.count() == before
    done = _post(client, auth_headers, 'sales_order', _xlsx(SO_HEAD, rows), True).get_json()
    assert done['summary']['ok'] == 2
    so = SalesOrder.query.filter_by(order_number='SO-IMP-1').one()
    assert so.status == 'draft' and len(so.items) == 2 and so.delivery_address == 'Jl. A'
    assert [i.uom for i in so.items] == ['PCS', 'BOX']
    assert float(so.items[0].quantity) * float(so.items[0].unit_price) == 10000
    assert float(so.total_amount) > 19000                       # 9000 setelah diskon + 10000 + PPN 11% pada item kedua
    auto = [t['created'] for t in done['transactions'] if t['number'] is None]
    assert auto and SalesOrder.query.filter_by(order_number=auto[0]).count() == 1
    again = _post(client, auth_headers, 'sales_order', _xlsx(SO_HEAD, rows[:2]), True).get_json()
    assert any('sudah ada' in e for t in again['transactions'] for e in t['errors'])


def test_so_unknown_party_item_and_bad_values(client, auth_headers, db_session, test_customer, test_product):
    today = date.today().isoformat()
    rows = [['A', today, 'TIDAK-ADA', '', '', 'TEST-001', 1, '', 1, 0, '', '', ''],
            ['B', today, 'CUST-001', '', '', 'XXX', 1, '', 1, 0, '', '', ''],
            ['C', today, 'CUST-001', '', '', 'TEST-001', 0, '', 1, 0, '', '', ''],
            ['D', today, 'CUST-001', '', '', 'TEST-001', 1, '', 1, 150, '', '', ''],
            ['E', today, 'CUST-001', '', '', 'TEST-001', 1, '', 1, 0, 'Q', '', '']]
    res = _post(client, auth_headers, 'sales_order', _xlsx(SO_HEAD, rows), True).get_json()
    assert res['summary'] == {'total': 5, 'ok': 0, 'error': 5, 'amount': 0.0}
    msgs = ' | '.join(e for t in res['transactions'] for e in t['errors'])
    for part in ('Pelanggan "TIDAK-ADA" tidak ditemukan', 'Barang "XXX"', 'lebih dari 0', 'antara 0 dan 100', 'tidak dikenal'):
        assert part in msgs


def test_po_commit_with_schedules_material_and_supplier_rules(client, auth_headers, db_session, test_material, test_product):
    from models.purchasing import PurchaseOrder
    _supplier(db_session)
    _supplier(db_session, 'SUP-OFF', active=False)
    today = date.today().isoformat()
    rows = [['PO-IMP-1', today, 'SUP-IMP', '2026-12-31', '', 'MAT-001', 100, '', 50, '2026-11-10:40;2026-11-25:60', 'Bertahap'],
            ['PO-IMP-1', today, 'SUP-IMP', '', '', 'TEST-001', 3, '', 10, '', ''],
            ['PO-BAD1', today, 'SUP-IMP', '', '', 'MAT-001', 10, '', 5, '2026-11-10:11', ''],
            ['PO-BAD2', today, 'SUP-OFF', '', '', 'MAT-001', 10, '', 5, '', ''],
            ['PO-BAD3', today, 'SUP-IMP', '', 'XYZ', 'MAT-001', 10, '', 5, '', ''],
            ['PO-BAD4', today, 'SUP-IMP', '', '', 'MAT-001', 10, '', 5, 'rusak', '']]
    prev = _post(client, auth_headers, 'purchase_order', _xlsx(PO_HEAD, rows), False).get_json()
    assert prev['summary']['ok'] == 1 and prev['summary']['error'] == 4
    assert PurchaseOrder.query.count() == 0
    done = _post(client, auth_headers, 'purchase_order', _xlsx(PO_HEAD, rows), True).get_json()
    po = PurchaseOrder.query.filter_by(po_number='PO-IMP-1').one()
    assert po.status == 'draft' and po.currency == 'IDR' and len(po.items) == 2
    assert float(po.subtotal) == 100 * 50 + 3 * 10
    mat_item = [i for i in po.items if i.material_id][0]
    assert [(s.expected_date.isoformat(), float(s.quantity)) for s in mat_item.schedules] == [('2026-11-10', 40.0), ('2026-11-25', 60.0)]
    assert mat_item.uom == 'KG'
    errs = ' | '.join(e for t in done['transactions'] for e in t['errors'])
    for part in ('melebihi jumlah pesanan', 'tidak aktif', 'rusak'):
        assert part in errs


def test_po_ambiguous_code_and_permissions_listed(client, auth_headers, db_session, test_material):
    from models.product import Product
    _supplier(db_session)
    db_session.add(Product(code='MAT-001', name='Kembar', material_type='finished_goods', primary_uom='PCS', is_active=True))
    db_session.commit()
    today = date.today().isoformat()
    res = _post(client, auth_headers, 'purchase_order', _xlsx(PO_HEAD, [['', today, 'SUP-IMP', '', '', 'MAT-001', 1, '', 1, '', '']]), True).get_json()
    assert any('ambigu' in e for t in res['transactions'] for e in t['errors'])
    kinds = {k['key'] for k in client.get('/api/imports/kinds', headers=auth_headers).get_json()['kinds']}
    assert {'sales_order', 'purchase_order'} <= kinds
