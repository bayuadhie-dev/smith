"""Supplier/customer lists: zero-day payment terms stay zero, customer categories are discoverable."""
from models import db


def test_cod_terms_are_not_shown_as_30_days(client, auth_headers, db_session):
    from models.purchasing import Supplier
    from models.sales import Customer
    s = Supplier(code='S-COD', company_name='Pemasok COD', payment_terms_days=0, supplier_type='LAIN-LAIN', is_active=True)
    c = Customer(code='C-COD', company_name='Pelanggan COD', payment_terms_days=0, customer_type='MODERN MARKET', is_active=True)
    c30 = Customer(code='C-30', company_name='Pelanggan 30', payment_terms_days=30, customer_type='DISTRIBUTOR', is_active=True)
    db_session.add_all([s, c, c30])
    db_session.commit()
    sup = client.get('/api/purchasing/suppliers?per_page=100', headers=auth_headers).get_json()['suppliers']
    assert [x['payment_terms'] for x in sup if x['code'] == 'S-COD'] == ['0']
    cust = {x['code']: x['payment_terms'] for x in client.get('/api/sales/customers?per_page=100', headers=auth_headers).get_json()['customers']}
    assert cust['C-COD'] == 'C.O.D' and cust['C-30'] == 'Net 30'


def test_customer_types_endpoint_lists_real_categories(client, auth_headers, db_session):
    from models.sales import Customer
    db_session.add_all([Customer(code='C-1', company_name='A', customer_type='DISTRIBUTOR', is_active=True),
                        Customer(code='C-2', company_name='B', customer_type='MODERN MARKET', is_active=True),
                        Customer(code='C-3', company_name='C', customer_type='DISTRIBUTOR', is_active=True),
                        Customer(code='C-4', company_name='D', customer_type=None, is_active=True)])
    db_session.commit()
    r = client.get('/api/sales/customers/types', headers=auth_headers)
    assert r.status_code == 200 and r.get_json()['types'] == ['DISTRIBUTOR', 'MODERN MARKET']
    only = client.get('/api/sales/customers?customer_type=DISTRIBUTOR&per_page=100', headers=auth_headers).get_json()
    assert only['total'] == 2
