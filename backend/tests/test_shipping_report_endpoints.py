import io
from datetime import date, timedelta

import openpyxl


def _order(db_session, test_user, status='preparing', days_ago=3, expected_offset=1, delivered=False):
    from models import ShippingOrder, Customer, LogisticsProvider
    cust = Customer.query.first() or Customer(code='C-SHP', company_name='Pelanggan Ship', is_active=True)
    db_session.add(cust); db_session.flush()
    prov = LogisticsProvider.query.first() or LogisticsProvider(code='LP1', company_name='Ekspedisi A', service_type='land')
    db_session.add(prov); db_session.flush()
    d0 = date.today() - timedelta(days=days_ago)
    n = ShippingOrder.query.count() + 1
    o = ShippingOrder(shipping_number=f'SHP-T-{n:04d}', customer_id=cust.id, shipping_date=d0, expected_delivery_date=d0 + timedelta(days=expected_offset),
                      status=status, delivery_method='expedition', logistics_provider_id=prov.id, shipping_cost=100000, total_weight=50,
                      actual_delivery_date=(d0 + timedelta(days=2)) if delivered else None)
    db_session.add(o); db_session.commit()
    return o


def test_carriers_and_report(client, auth_headers, db_session, test_user):
    _order(db_session, test_user, status='delivered', delivered=True, expected_offset=3)
    _order(db_session, test_user, status='delivered', delivered=True, expected_offset=1)
    _order(db_session, test_user)
    assert client.get('/api/shipping/carriers', headers=auth_headers).get_json()['carriers'] == ['Ekspedisi A']
    rep = client.get('/api/shipping/reports', headers=auth_headers).get_json()
    assert rep['summary']['total_shipments'] == 3
    assert rep['summary']['on_time_delivery_rate'] == 50.0 and rep['summary']['average_delivery_time'] == 2.0
    assert {c['name'] for c in rep['charts']['shipments_by_status']} == {'delivered', 'preparing'}
    assert len(rep['details']) == 3
    assert client.get('/api/shipping/reports?status=preparing', headers=auth_headers).get_json()['summary']['total_shipments'] == 1
    assert client.get('/api/shipping/reports?date_from=bukan', headers=auth_headers).status_code == 400


def test_report_export_xlsx_and_pdf(client, auth_headers, db_session, test_user):
    _order(db_session, test_user)
    r = client.get('/api/shipping/reports/export?format=excel', headers=auth_headers)
    assert r.status_code == 200 and r.data[:2] == b'PK'
    assert openpyxl.load_workbook(io.BytesIO(r.data))['Rincian'].max_row == 2
    r = client.get('/api/shipping/reports/export?format=pdf', headers=auth_headers)
    assert r.status_code == 200 and r.data[:4] == b'%PDF'


def test_status_flow_and_guards(client, auth_headers, db_session, test_user):
    o = _order(db_session, test_user)
    put = lambda s: client.put(f'/api/shipping/orders/{o.id}/status', json={'status': s}, headers=auth_headers)
    assert put('shipped').status_code == 400            # shipping goes through the ship workflow (stock + journal)
    assert put('delivered').status_code == 400          # cannot skip packing/transit
    assert put('confirmed').status_code == 200          # alias for packed
    assert put('in_transit').status_code == 200
    assert put('cancelled').status_code == 400          # already left
    assert put('delivered').status_code == 200
    from models import ShippingOrder
    db_session.expire_all()
    got = db_session.get(ShippingOrder, o.id)
    assert got.status == 'delivered' and got.actual_delivery_date is not None
    assert put('ngawur').status_code == 400


def test_pod_pdf(client, auth_headers, db_session, test_user):
    o = _order(db_session, test_user)
    r = client.get(f'/api/shipping/orders/{o.id}/pod', headers=auth_headers)
    assert r.status_code == 200 and r.data[:4] == b'%PDF'
    assert client.get('/api/shipping/orders/999999/pod', headers=auth_headers).status_code == 404
