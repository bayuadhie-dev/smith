"""
Tests for Custom Report Builder (2026-10-06) - external-audit mock-data
cleanup, category 3. Replaces CustomReportBuilder.tsx's
Math.random()-fabricated preview rows and never-persisted saveReport()
with a real whitelist-based query engine (utils/custom_report_registry.py)
+ real CRUD persistence.
"""
from datetime import date


def _make_sales_order(db_session, order_number='SO-TEST-001', total_amount=500000, status='confirmed'):
    from models.sales import SalesOrder, Customer

    customer = Customer(code=f'CUST-{order_number}', company_name='Test Customer Co', is_active=True)
    db_session.add(customer)
    db_session.commit()

    order = SalesOrder(
        order_number=order_number, customer_id=customer.id, order_date=date.today(),
        status=status, total_amount=total_amount,
    )
    db_session.add(order)
    db_session.commit()
    return order


class TestDataSourceRegistry:
    def test_list_data_sources_exposes_whitelist(self, client, auth_headers, db_session):
        resp = client.get('/api/reports/custom/data-sources', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'sales' in data['dataSources']
        assert 'order_number' in data['dataSources']['sales']['fields']
        assert 'total_amount' in data['dataSources']['sales']['numericFields']


class TestPreviewQuery:
    def test_preview_returns_real_rows_not_random(self, client, auth_headers, db_session):
        _make_sales_order(db_session, order_number='SO-PREVIEW-001', total_amount=777000)

        resp = client.post('/api/reports/custom/preview', json={
            'dataSources': ['sales'],
            'fields': [
                {'source': 'sales', 'field': 'order_number'},
                {'source': 'sales', 'field': 'total_amount'},
            ],
            'filters': [],
            'groupBy': [],
            'orderBy': [],
        }, headers=auth_headers)
        assert resp.status_code == 200
        rows = resp.get_json()['results']['sales']
        match = next(r for r in rows if r['order_number'] == 'SO-PREVIEW-001')
        assert match['total_amount'] == 777000.0

    def test_preview_applies_filter(self, client, auth_headers, db_session):
        _make_sales_order(db_session, order_number='SO-FILT-A', status='confirmed')
        _make_sales_order(db_session, order_number='SO-FILT-B', status='draft')

        resp = client.post('/api/reports/custom/preview', json={
            'dataSources': ['sales'],
            'fields': [{'source': 'sales', 'field': 'order_number'}],
            'filters': [{'field': 'status', 'operator': 'equals', 'value': 'draft'}],
            'groupBy': [],
            'orderBy': [],
        }, headers=auth_headers)
        assert resp.status_code == 200
        order_numbers = [r['order_number'] for r in resp.get_json()['results']['sales']]
        assert 'SO-FILT-B' in order_numbers
        assert 'SO-FILT-A' not in order_numbers

    def test_preview_rejects_unknown_field(self, client, auth_headers, db_session):
        resp = client.post('/api/reports/custom/preview', json={
            'dataSources': ['sales'],
            'fields': [{'source': 'sales', 'field': 'super_secret_password_column'}],
            'filters': [],
            'groupBy': [],
            'orderBy': [],
        }, headers=auth_headers)
        assert resp.status_code == 400

    def test_preview_rejects_unknown_data_source(self, client, auth_headers, db_session):
        resp = client.post('/api/reports/custom/preview', json={
            'dataSources': ['users'],  # not a real whitelisted source - would be a real data leak if allowed
            'fields': [{'source': 'users', 'field': 'password_hash'}],
            'filters': [],
            'groupBy': [],
            'orderBy': [],
        }, headers=auth_headers)
        assert resp.status_code == 400

    def test_preview_rejects_sql_injection_attempt_in_filter_value(self, client, auth_headers, db_session):
        _make_sales_order(db_session, order_number='SO-INJ-001')
        # The value is just data to a parameterized query - this must not
        # error, crash, or return unrelated rows, it should just find no
        # match (proving it's never concatenated into raw SQL).
        resp = client.post('/api/reports/custom/preview', json={
            'dataSources': ['sales'],
            'fields': [{'source': 'sales', 'field': 'order_number'}],
            'filters': [{'field': 'order_number', 'operator': 'equals', 'value': "'; DROP TABLE sales_orders; --"}],
            'groupBy': [],
            'orderBy': [],
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()['results']['sales'] == []

    def test_preview_aggregation_sum(self, client, auth_headers, db_session):
        _make_sales_order(db_session, order_number='SO-AGG-A', total_amount=100000, status='confirmed')
        _make_sales_order(db_session, order_number='SO-AGG-B', total_amount=200000, status='confirmed')

        resp = client.post('/api/reports/custom/preview', json={
            'dataSources': ['sales'],
            'fields': [
                {'source': 'sales', 'field': 'status'},
                {'source': 'sales', 'field': 'total_amount', 'aggregation': 'sum'},
            ],
            'filters': [{'field': 'status', 'operator': 'equals', 'value': 'confirmed'}],
            'groupBy': ['status'],
            'orderBy': [],
        }, headers=auth_headers)
        assert resp.status_code == 200
        rows = resp.get_json()['results']['sales']
        confirmed_row = next(r for r in rows if r['status'] == 'confirmed')
        assert confirmed_row['total_amount'] == 300000.0

    def test_preview_rejects_aggregation_on_non_numeric_field(self, client, auth_headers, db_session):
        resp = client.post('/api/reports/custom/preview', json={
            'dataSources': ['sales'],
            'fields': [{'source': 'sales', 'field': 'order_number', 'aggregation': 'sum'}],
            'filters': [],
            'groupBy': [],
            'orderBy': [],
        }, headers=auth_headers)
        assert resp.status_code == 400

    def test_preview_requires_auth(self, client, db_session):
        resp = client.post('/api/reports/custom/preview', json={'dataSources': ['sales'], 'fields': []})
        assert resp.status_code == 401


class TestCustomReportCRUD:
    def test_save_and_list(self, client, auth_headers, db_session):
        payload = {
            'name': 'My Sales Report',
            'description': 'test',
            'dataSources': ['sales'],
            'fields': [{'source': 'sales', 'field': 'order_number', 'label': 'Order Number'}],
            'filters': [],
            'groupBy': [],
            'orderBy': [],
            'chartType': 'table',
        }
        resp = client.post('/api/reports/custom', json=payload, headers=auth_headers)
        assert resp.status_code == 201, resp.get_json()
        body = resp.get_json()
        assert body['name'] == 'My Sales Report'
        assert body['dataSources'] == ['sales']

        resp2 = client.get('/api/reports/custom', headers=auth_headers)
        names = [r['name'] for r in resp2.get_json()['reports']]
        assert 'My Sales Report' in names

    def test_save_rejects_unknown_field(self, client, auth_headers, db_session):
        payload = {
            'name': 'Bad Report',
            'dataSources': ['sales'],
            'fields': [{'source': 'sales', 'field': 'not_a_real_field'}],
        }
        resp = client.post('/api/reports/custom', json=payload, headers=auth_headers)
        assert resp.status_code == 400

    def test_save_requires_name(self, client, auth_headers, db_session):
        resp = client.post('/api/reports/custom', json={
            'dataSources': ['sales'], 'fields': [{'source': 'sales', 'field': 'order_number'}],
        }, headers=auth_headers)
        assert resp.status_code == 400

    def test_get_and_delete(self, client, auth_headers, db_session):
        created = client.post('/api/reports/custom', json={
            'name': 'To Delete',
            'dataSources': ['sales'],
            'fields': [{'source': 'sales', 'field': 'order_number'}],
        }, headers=auth_headers).get_json()
        rid = created['id']

        resp = client.get(f'/api/reports/custom/{rid}', headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()['name'] == 'To Delete'

        resp2 = client.delete(f'/api/reports/custom/{rid}', headers=auth_headers)
        assert resp2.status_code == 200

        resp3 = client.get(f'/api/reports/custom/{rid}', headers=auth_headers)
        assert resp3.status_code == 404
