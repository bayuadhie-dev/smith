import io

PO_TEXT = """MERCHANDISING INDOMARCO GROUP                                FALMACO NONWOVEN INDUSTRI PT.
NO.PO : 6HBQ92208 DIV : 8 TOP : 30                         (34445)(PKP)(0226866808)
TGL : 06-NOV-26
20142611 INDOMARET WET TISSUE ALCOHOL 75% FOOD GRADE BDD 2X10S                               CTN/54
20142611 5 0                280,800.00 351,000.00                   115,830.00 1,168,830.00
DISC: 04:25.0000%
KRM KE: DC MEDAN                                  W.P : PT. INDOMARCO PRISMATAMA
"""


def test_parse_indomaret_po():
    from utils.customer_po_import import parse_customer_po
    po = parse_customer_po(PO_TEXT)
    assert po['po_number'] == '6HBQ92208' and po['po_date'] == '2026-11-06' and po['terms_days'] == 30 and po['ship_to'] == 'DC MEDAN'
    it = po['items'][0]
    assert it['plu'] == '20142611' and it['uom'] == 'CTN' and it['pack'] == 54 and it['quantity'] == 5
    assert it['unit_price'] == 280800 and it['discount_percent'] == 25.0 and it['total'] == 1168830


def test_import_preview_and_create_saves_customer_code(client, auth_headers, db_session, test_product, monkeypatch):
    from models import Customer, SalesOrder
    from models.sales import CustomerMaterialInfo
    c1 = Customer(code='C-MDN', company_name='PT INDOMARCO PRISMATAMA - MEDAN', is_active=True)
    c2 = Customer(code='C-BDG', company_name='PT INDOMARCO PRISMATAMA - BANDUNG', is_active=True)
    db_session.add_all([c1, c2]); db_session.commit()
    monkeypatch.setattr('utils.customer_po_import.pdf_to_text', lambda b: PO_TEXT)
    r = client.post('/api/sales/orders/import-po/preview', data={'file': (io.BytesIO(b'%PDF-x'), 'po.pdf')}, headers=auth_headers, content_type='multipart/form-data')
    assert r.status_code == 200, r.get_json()
    j = r.get_json()
    assert j['customer_id'] == c1.id and j['customers'][0]['name'].endswith('MEDAN')
    body = {'customer_id': c1.id, 'po_number': '6HBQ92208', 'po_date': '2026-11-06', 'terms_days': 30,
            'items': [{'plu': '20142611', 'product_id': test_product.id, 'quantity': 270, 'unit_price': 5200, 'discount_percent': 25, 'uom': 'PCK'}]}
    r2 = client.post('/api/sales/orders/import-po/create', json=body, headers=auth_headers)
    assert r2.status_code == 201, r2.get_json()
    so = db_session.get(SalesOrder, r2.get_json()['order_id'])
    assert so.status == 'draft' and so.customer_po_number == '6HBQ92208' and len(so.items) == 1
    assert CustomerMaterialInfo.query.filter_by(customer_id=c1.id, product_id=test_product.id, customer_material_code='20142611').count() == 1
    assert client.post('/api/sales/orders/import-po/create', json=body, headers=auth_headers).status_code == 400   # PO yang sama ditolak


def test_delete_draft_sales_order_removes_it(client, auth_headers, db_session, test_product):
    from models import Customer, SalesOrder
    c = Customer(code='C-DEL', company_name='Cust Del', is_active=True); db_session.add(c); db_session.commit()
    r = client.post('/api/sales/orders/import-po/create', headers=auth_headers, json={'customer_id': c.id, 'po_number': 'X1', 'items': [
        {'plu': '1', 'product_id': test_product.id, 'quantity': 1, 'unit_price': 10, 'uom': 'PCS'}]})
    oid = r.get_json()['order_id']
    d = client.delete(f'/api/sales/orders/{oid}', headers=auth_headers)
    assert d.status_code == 200 and d.get_json()['deleted'] is True
    db_session.expire_all()
    assert db_session.get(SalesOrder, oid) is None


def test_branch_match_prefers_exact_dc_name(client, auth_headers, db_session, monkeypatch):
    from models import Customer
    db_session.add_all([Customer(code='J1', company_name='PT INDOMARCO PRISMATAMA - JAKARTA', is_active=True),
                        Customer(code='J2', company_name='PT INDOMARCO PRISMATAMA - JAKARTA 2', is_active=True)]); db_session.commit()
    from routes.sales import _match_customers
    assert _match_customers('PT. INDOMARCO PRISMATAMA', 'DC JAKARTA 2')[0]['name'].endswith('JAKARTA 2')
    assert _match_customers('PT. INDOMARCO PRISMATAMA', 'DC JAKARTA')[0]['name'].endswith('- JAKARTA')
