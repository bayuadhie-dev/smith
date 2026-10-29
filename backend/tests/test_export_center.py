import io
from datetime import date

import openpyxl


def _download(client, headers, key, qs=''):
    r = client.get(f'/api/imports/{key}/export{qs}', headers=headers)
    assert r.status_code == 200, (key, r.get_json())
    return list(openpyxl.load_workbook(io.BytesIO(r.data))['Data'].iter_rows(values_only=True))


def test_every_kind_exports_with_template_columns(client, auth_headers, db_session):
    from utils.import_center import REGISTRY
    for key, kind in REGISTRY.items():
        rows = _download(client, auth_headers, key, '?date_from=2020-01-01&date_to=2030-12-31')
        assert list(rows[0]) == [c.label for c in kind.columns], key


def test_export_rows_roundtrip_shape_and_date_range(client, auth_headers, db_session, test_customer, test_product, test_user):
    from models.sales import SalesOrder, SalesOrderItem
    from utils.import_center import REGISTRY
    inside = SalesOrder(order_number='SO-EXP-1', customer_id=test_customer.id, order_date=date(2026, 10, 5), status='confirmed', subtotal=0, total_amount=0, created_by=test_user.id)
    outside = SalesOrder(order_number='SO-EXP-2', customer_id=test_customer.id, order_date=date(2025, 1, 5), status='confirmed', subtotal=0, total_amount=0, created_by=test_user.id)
    db_session.add_all([inside, outside]); db_session.commit()
    for so in (inside, outside):
        db_session.add(SalesOrderItem(order_id=so.id, line_number=1, product_id=test_product.id, quantity=3, uom='KG', unit_price=1000, total_price=3000, tax_percent=11, discount_tiers='10+5', discount_percent=14.5))
    db_session.commit()
    rows = _download(client, auth_headers, 'sales_order', '?date_from=2026-10-01&date_to=2026-10-31')
    assert [r[0] for r in rows[1:]] == ['SO-EXP-1']
    assert len(rows[1]) == len(REGISTRY['sales_order'].columns)
    assert rows[1][7] == 'KG' and rows[1][9] == '10+5' and rows[1][10] == 'Y'
    assert len(_download(client, auth_headers, 'sales_order')) == 3
    bad = client.get('/api/imports/sales_order/export?date_from=2026-12-01&date_to=2026-01-01', headers=auth_headers)
    assert bad.status_code == 400
    assert client.get('/api/imports/tidak_ada/export', headers=auth_headers).status_code == 404


def test_master_export_includes_data(client, auth_headers, db_session, test_customer, test_product):
    rows = _download(client, auth_headers, 'customer')
    assert test_customer.code in [r[0] for r in rows[1:]]
    rows = _download(client, auth_headers, 'item')
    assert test_product.code in [r[1] for r in rows[1:]]


def test_payment_and_invoice_exports_roundtrip(client, auth_headers, db_session, test_customer, test_product):
    from tests.test_finance_sync_regressions import _acc, _bank
    from tests.test_void_gl import _setup_accounts
    bank = _bank(db_session); a = _acc(db_session, '9-1000'); b = _acc(db_session, '6-6000')
    r = client.post('/api/finance/payments', headers=auth_headers, json={
        'payment_date': '2026-10-31T15:30:00', 'payment_type': 'payment', 'payment_method': 'bank_transfer', 'amount': 800,
        'bank_account_id': bank.id, 'payment_number': 'PAY-EXP-1', 'reference_number': 'TRF-9',
        'lines': [{'account_id': a.id, 'amount': 1000, 'description': 'biaya'}, {'account_id': b.id, 'amount': -200}]})
    assert r.status_code == 201, r.get_json()
    rows = _download(client, auth_headers, 'payment_kas', '?date_from=2026-10-01&date_to=2026-10-31')
    assert [(x[1], x[3], x[4]) for x in rows[1:]] == [('PAY-EXP-1', '9-1000', 1000.0), ('PAY-EXP-1', '6-6000', -200.0)]
    assert rows[1][2] == '1-1010' and rows[1][7] == 'TRF-9'
    assert len(_download(client, auth_headers, 'payment_kas', '?date_from=2026-11-01&date_to=2026-11-30')) == 1
    assert len(_download(client, auth_headers, 'receipt_kas')) == 1

    _setup_accounts(db_session)
    inv = client.post('/api/finance/invoices', headers=auth_headers, json={
        'invoice_type': 'sales', 'invoice_date': '2026-10-15', 'customer_id': test_customer.id, 'payment_terms': 'net_30',
        'items': [{'product_id': test_product.id, 'description': 'Barang X', 'uom': 'KG', 'quantity': 2, 'unit_price': 5000, 'discount_tiers': '10+5'}]})
    assert inv.status_code in (200, 201), inv.get_json()
    rows = _download(client, auth_headers, 'sales_invoice', '?date_from=2026-10-01&date_to=2026-10-31')
    assert len(rows) == 2 and rows[1][2] == test_customer.code and rows[1][5] == 'Barang X' and rows[1][7] == 'KG' and rows[1][9] == 14.5


def test_journal_list_flags_voided_pairs_and_excludes_them_from_summary(client, auth_headers, db_session):
    from tests.test_finance_sync_regressions import _acc, _bank
    bank = _bank(db_session); a = _acc(db_session, '9-1000')
    mk = lambda n, amt: client.post('/api/finance/payments', headers=auth_headers, json={
        'payment_date': '2026-10-20', 'payment_type': 'payment', 'payment_method': 'cash', 'amount': amt, 'bank_account_id': bank.id,
        'payment_number': n, 'lines': [{'account_id': a.id, 'amount': amt}]}).get_json()['payment_id']
    keep, gone = mk('PAY-K', 100), mk('PAY-V', 250)
    assert client.post(f'/api/finance/payments/{gone}/void', headers=auth_headers, json={}).status_code == 200
    d = client.get('/api/finance/accounting/journal-entries?hide_voided=0', headers=auth_headers).get_json()
    assert sorted(e['kind'] for e in d['entries']) == ['normal', 'reversal', 'voided']
    assert d['summary'] == {'journals': 1, 'total_debit': 100.0, 'total_credit': 100.0, 'hidden': 2}
    d = client.get('/api/finance/accounting/journal-entries', headers=auth_headers).get_json()
    assert [e['kind'] for e in d['entries']] == ['normal'] and d['total'] == 1
    for page in (1, 2):
        r = client.get(f'/api/finance/accounting/journal-entries?hide_voided=0&per_page=2&page={page}', headers=auth_headers).get_json()
        assert len(r['entries']) == (2 if page == 1 else 1)


def test_journal_list_and_detail_link_to_source_transaction(client, auth_headers, db_session):
    from tests.test_finance_sync_regressions import _acc, _bank
    bank = _bank(db_session); a = _acc(db_session, '9-1000')
    pid = client.post('/api/finance/payments', headers=auth_headers, json={
        'payment_date': '2026-10-20', 'payment_type': 'payment', 'payment_method': 'cash', 'amount': 50, 'bank_account_id': bank.id,
        'lines': [{'account_id': a.id, 'amount': 50}]}).get_json()['payment_id']
    row = client.get('/api/finance/accounting/journal-entries', headers=auth_headers).get_json()['entries'][0]
    assert row['document_url'] == f'/app/finance/payments/{pid}'
    det = client.get(f"/api/finance/accounting/journal-entries/{row['entry_number']}", headers=auth_headers).get_json()
    assert det['document_url'] == f'/app/finance/payments/{pid}'


def test_edit_manual_journal_keeps_number_and_rejects_auto_journals(client, auth_headers, db_session):
    from tests.test_finance_sync_regressions import _acc, _bank
    from models.finance import AccountingEntry
    bank = _bank(db_session); a = _acc(db_session, '9-1000'); b = _acc(db_session, '6-6000')
    body = lambda amt, d='2026-10-10': {'entry_date': d, 'description': 'Koreksi', 'reference_number': 'REF-1',
                                        'lines': [{'account_id': a.id, 'debit': amt, 'credit': 0}, {'account_id': b.id, 'debit': 0, 'credit': amt}]}
    assert client.post('/api/finance/general-ledger', headers=auth_headers, json=body(100)).status_code == 201
    row = client.get('/api/finance/accounting/journal-entries', headers=auth_headers).get_json()['entries'][0]
    r = client.put(f"/api/finance/general-ledger/{row['id']}", headers=auth_headers, json=body(250, '2026-10-12'))
    assert r.status_code == 200, r.get_json()
    rows = AccountingEntry.query.filter(AccountingEntry.entry_number.like(f"{row['entry_number']}-%")).all()
    assert len(rows) == 2 and sorted(float(x.debit_amount) for x in rows) == [0.0, 250.0] and all(str(x.entry_date) == '2026-10-12' for x in rows)
    assert AccountingEntry.query.filter_by(reference_type='manual_journal').count() == 2
    unbalanced = body(5); unbalanced['lines'][1]['credit'] = 4
    assert client.put(f"/api/finance/general-ledger/{row['id']}", headers=auth_headers, json=unbalanced).status_code == 400
    assert AccountingEntry.query.filter(AccountingEntry.entry_number.like(f"{row['entry_number']}-%")).count() == 2
    pid = client.post('/api/finance/payments', headers=auth_headers, json={'payment_date': '2026-10-20', 'payment_type': 'payment', 'payment_method': 'cash',
        'amount': 50, 'bank_account_id': bank.id, 'lines': [{'account_id': a.id, 'amount': 50}]}).get_json()['payment_id']
    auto = AccountingEntry.query.filter_by(reference_type='payment', reference_id=pid).first()
    assert client.put(f'/api/finance/general-ledger/{auto.id}', headers=auth_headers, json=body(1)).status_code == 400


def test_doc_url_covers_automatic_journal_sources():
    from routes.finance_reports import _doc_url
    assert _doc_url('material_issue', 7) == '/app/production/material-issues/7'
    assert _doc_url('fg_conversion', 3) == '/app/production/fg-conversion/3'
    assert _doc_url('inventory_destruction', 9) == '/app/waste/9/edit'
    assert _doc_url('payroll_period', 2) == '/app/hr/payroll/periods/2/records'
    assert _doc_url('pending_journal', None) is None and _doc_url('payment', None) is None


def test_general_ledger_hides_cancelled_pairs_and_links_to_source(client, auth_headers, db_session):
    from tests.test_finance_sync_regressions import _acc, _bank
    bank = _bank(db_session); a = _acc(db_session, '9-1000')
    mk = lambda n, amt: client.post('/api/finance/payments', headers=auth_headers, json={
        'payment_date': '2026-10-20', 'payment_type': 'payment', 'payment_method': 'cash', 'amount': amt, 'bank_account_id': bank.id,
        'payment_number': n, 'lines': [{'account_id': a.id, 'amount': amt}]}).get_json()['payment_id']
    keep, gone = mk('PAY-GK', 100), mk('PAY-GV', 250)
    assert client.post(f'/api/finance/payments/{gone}/void', headers=auth_headers, json={}).status_code == 200
    d = client.get('/api/finance/general-ledger?start_date=2026-10-01&end_date=2026-10-31&per_page=100', headers=auth_headers).get_json()
    assert d['total'] == 2 and {e['document_url'] for e in d['entries']} == {f'/app/finance/payments/{keep}'}
    assert sum(e['debit_amount'] - e['credit_amount'] for e in d['entries']) == 0
    d = client.get('/api/finance/general-ledger?include_voided=1&per_page=100', headers=auth_headers).get_json()
    assert d['total'] == 6


def test_purchase_requisition_import_export_roundtrip(client, auth_headers, db_session):
    import io
    import openpyxl
    from models.product import Material
    from models.purchasing import PurchaseRequisition
    db_session.add(Material(code='RM-PR1', name='Bahan PR', material_type='raw_materials', category='RM', primary_uom='KG', is_active=True))
    db_session.commit()
    wb = openpyxl.Workbook(); ws = wb.active
    ws.append(['No. PR', 'Tanggal', 'Tanggal Dibutuhkan', 'Departemen', 'Prioritas', 'Tujuan', 'Kode Barang', 'Qty', 'Satuan', 'Estimasi Harga Satuan', 'Pemasok Usulan', 'Keterangan'])
    ws.append(['PR-IMP-1', '2026-10-05', '2026-10-20', 'Produksi', 'high', 'Uji', 'RM-PR1', 10, '', 1500, '', 'a'])
    ws.append(['PR-IMP-1', '2026-10-05', '', '', '', '', 'RM-PR1', 5, 'KG', '', '', 'b'])
    ws.append(['PR-BAD', '2026-10-05', '', '', '', '', 'TIDAK-ADA', 1, '', '', '', ''])
    def book():
        b = io.BytesIO(); wb.save(b); b.seek(0); return b
    post = lambda c: client.post('/api/imports/purchase_requisition', headers=auth_headers, content_type='multipart/form-data', data={'file': (book(), 'p.xlsx'), 'commit': c}).get_json()
    prev = post('0')
    assert prev['summary']['ok'] == 1 and prev['summary']['error'] == 1 and prev['summary']['amount'] == 15000.0
    assert PurchaseRequisition.query.count() == 0
    assert post('1')['committed'] and PurchaseRequisition.query.filter_by(pr_number='PR-IMP-1').count() == 1
    assert post('1')['summary']['ok'] == 0       # same number again is refused
    rows = _download(client, auth_headers, 'purchase_requisition', '?date_from=2026-10-01&date_to=2026-10-31')
    assert [(r[0], r[6], r[7], r[8]) for r in rows[1:]] == [('PR-IMP-1', 'RM-PR1', 10.0, 'KG'), ('PR-IMP-1', 'RM-PR1', 5.0, 'KG')]
