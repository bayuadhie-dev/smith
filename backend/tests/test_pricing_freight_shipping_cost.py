"""SAP-equivalence plan item #3 (2026-10-05): freight/KF00-equivalent gap-closing.

Audit found `shipping_cost` already existed as a real column on Quotation/
SalesOrder, but was dead - never set by any create/update route, never in
any create/edit form, and never rolled into total_amount. Separately,
PricingCondition.condition_type only supported discount/surcharge/tax (no
freight), even though utils.pricing_procedure.calculate_price() is a real
sequential pipeline that could support it.

These tests cover: (1) 'freight' flowing correctly through the per-item
pricing pipeline (tax applies on top of it, like surcharge); (2) the
header-level shipping_cost field now actually rolling into
SalesOrder/Quotation.total_amount on create, item-replace update, and
shipping-cost-only update; (3) quotation->order conversion carrying
shipping_cost across; (4) a zero/absent shipping_cost case behaving
exactly as before (no regression for existing orders that never set it).

Follow-up round (same day): shipping_cost was initially rolled in as a
raw UNTAXED additive - user pointed out the existing Product/Material
ppn_code mechanism (Y=11%/A=1.1%/B=1.2%/L=12%, utils.tax_helpers) should
be reused rather than inventing a separate freight tax policy, since
freight billed to a customer is generally taxable in Indonesia and the
code to resolve a rate from a plain code string already exists and
doesn't require a Product. Added shipping_ppn_code (defaults to 'Y',
same default as Product.ppn_code) + shipping_tax_amount. This means
total_amount tests below now expect shipping_cost to carry its own tax
by default - that's the fix, not a regression.
"""
from datetime import datetime, timedelta

from models import db
from models.sales import PricingCondition, SalesOrder, Quotation


class TestFreightInPricingPipeline:
    def test_freight_condition_adds_before_tax(self, app, db_session, test_customer, test_product):
        with app.app_context():
            cond = PricingCondition(
                name='Ongkir Standar',
                condition_type='freight',
                calculation_type='fixed_amount',
                value=5000,
                sequence=20,
                is_active=True,
            )
            tax = PricingCondition(
                name='PPN',
                condition_type='tax',
                calculation_type='percentage',
                value=11,
                sequence=90,
                is_active=True,
            )
            db_session.add_all([cond, tax])
            db_session.commit()

            from utils.pricing_procedure import calculate_price
            result = calculate_price(test_product.id, customer_id=test_customer.id, quantity=1)

            # base_price (150) + freight (5000) = 5150, then 11% tax on that.
            assert result['unit_price'] == 5150.0
            assert result['tax_percent'] == 11.0
            assert round(result['tax_amount'], 2) == round(5150.0 * 0.11, 2)
            freight_entries = [b for b in result['breakdown'] if b['type'] == 'freight']
            assert len(freight_entries) == 1
            assert freight_entries[0]['amount'] == 5000.0

    def test_no_freight_condition_unchanged_behavior(self, app, db_session, test_customer, test_product):
        with app.app_context():
            from utils.pricing_procedure import calculate_price
            result = calculate_price(test_product.id, customer_id=test_customer.id, quantity=1)
            assert result['unit_price'] == float(test_product.price)
            assert result['tax_percent'] == 0


class TestSalesOrderShippingCostRollup:
    def test_create_sales_order_rolls_shipping_cost_into_total(self, client, auth_headers, db_session, test_customer, test_product):
        resp = client.post('/api/sales/orders', json={
            'customer_id': test_customer.id,
            'order_date': datetime.now().strftime('%Y-%m-%d'),
            'shipping_cost': 25000,
            'items': [{'product_id': test_product.id, 'quantity': 2, 'unit_price': 100}],
        }, headers=auth_headers)
        assert resp.status_code == 201, resp.get_json()
        data = resp.get_json()
        order = db.session.get(SalesOrder, data['order_id'])
        assert float(order.shipping_cost) == 25000.0
        # Defaults to shipping_ppn_code='Y' (11%) when not specified.
        assert order.shipping_ppn_code == 'Y'
        assert float(order.shipping_tax_amount) == round(25000.0 * 0.11, 2)
        # 2 * 100 = 200 item total (no discount/tax configured for this product)
        # + 25000 freight + 2750 PPN on freight.
        assert float(order.total_amount) == 200.0 + 25000.0 + 2750.0

    def test_create_sales_order_without_shipping_cost_defaults_zero(self, client, auth_headers, db_session, test_customer, test_product):
        resp = client.post('/api/sales/orders', json={
            'customer_id': test_customer.id,
            'order_date': datetime.now().strftime('%Y-%m-%d'),
            'items': [{'product_id': test_product.id, 'quantity': 1, 'unit_price': 100}],
        }, headers=auth_headers)
        assert resp.status_code == 201, resp.get_json()
        data = resp.get_json()
        order = db.session.get(SalesOrder, data['order_id'])
        assert float(order.shipping_cost or 0) == 0.0
        assert float(order.total_amount) == 100.0

    def test_update_shipping_cost_only_recalculates_total_without_touching_items(self, client, auth_headers, db_session, test_customer, test_product):
        create_resp = client.post('/api/sales/orders', json={
            'customer_id': test_customer.id,
            'order_date': datetime.now().strftime('%Y-%m-%d'),
            'items': [{'product_id': test_product.id, 'quantity': 3, 'unit_price': 100}],
        }, headers=auth_headers)
        order_id = create_resp.get_json()['order_id']

        update_resp = client.put(f'/api/sales/orders/{order_id}', json={
            'shipping_cost': 15000,
        }, headers=auth_headers)
        assert update_resp.status_code == 200, update_resp.get_json()

        order = db.session.get(SalesOrder, order_id)
        assert float(order.shipping_cost) == 15000.0
        assert float(order.total_amount) == 300.0 + 15000.0 + round(15000.0 * 0.11, 2)
        # Items themselves must be untouched (still 1 line, same qty) - this
        # update path must not go through the items-replace/reservation-reset
        # branch just because shipping_cost changed.
        assert len(order.items) == 1
        assert float(order.items[0].quantity) == 3.0


class TestQuotationShippingCostRollup:
    def test_create_quotation_rolls_shipping_cost_into_total(self, client, auth_headers, db_session, test_customer, test_product):
        resp = client.post('/api/sales/quotations', json={
            'customer_id': test_customer.id,
            'quote_date': datetime.now().strftime('%Y-%m-%d'),
            'valid_until': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
            'shipping_cost': 10000,
            'items': [{'product_id': test_product.id, 'quantity': 1, 'unit_price': 100}],
        }, headers=auth_headers)
        assert resp.status_code == 201, resp.get_json()
        data = resp.get_json()
        quotation_id = data['quotation_id']
        quotation = db.session.get(Quotation, quotation_id)
        assert float(quotation.shipping_cost) == 10000.0
        assert float(quotation.total_amount) == 100.0 + 10000.0 + round(10000.0 * 0.11, 2)

    def test_convert_quotation_to_order_carries_shipping_cost(self, client, auth_headers, db_session, test_customer, test_product):
        q_resp = client.post('/api/sales/quotations', json={
            'customer_id': test_customer.id,
            'quote_date': datetime.now().strftime('%Y-%m-%d'),
            'valid_until': (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d'),
            'shipping_cost': 7500,
            'items': [{'product_id': test_product.id, 'quantity': 1, 'unit_price': 100}],
        }, headers=auth_headers)
        q_data = q_resp.get_json()
        quotation_id = q_data['quotation_id']

        convert_resp = client.post(f'/api/sales/quotations/{quotation_id}/convert', headers=auth_headers)
        assert convert_resp.status_code == 201, convert_resp.get_json()
        order_id = convert_resp.get_json()['order_id']

        order = db.session.get(SalesOrder, order_id)
        assert float(order.shipping_cost) == 7500.0
        assert order.shipping_ppn_code == 'Y'
        assert float(order.total_amount) == 100.0 + 7500.0 + round(7500.0 * 0.11, 2)


class TestShippingCostPpnCode:
    """SAP-equivalence plan item #3 follow-up: shipping_ppn_code reuses the
    same Y/A/B/L code set as Product/Material.ppn_code (utils.tax_helpers.
    PPN_RATE_MAP) rather than a hardcoded freight tax policy."""

    def test_each_ppn_code_taxes_shipping_correctly(self, client, auth_headers, db_session, test_customer, test_product):
        expected_rates = {'Y': 11.0, 'A': 1.1, 'B': 1.2, 'L': 12.0}
        for code, rate in expected_rates.items():
            resp = client.post('/api/sales/orders', json={
                'customer_id': test_customer.id,
                'order_date': datetime.now().strftime('%Y-%m-%d'),
                'shipping_cost': 10000,
                'shipping_ppn_code': code,
                'items': [{'product_id': test_product.id, 'quantity': 1, 'unit_price': 100}],
            }, headers=auth_headers)
            assert resp.status_code == 201, resp.get_json()
            order = db.session.get(SalesOrder, resp.get_json()['order_id'])
            expected_tax = round(10000.0 * (rate / 100), 2)
            assert float(order.shipping_tax_amount) == expected_tax, f'code={code}'
            assert float(order.total_amount) == 100.0 + 10000.0 + expected_tax, f'code={code}'

    def test_null_ppn_code_means_zero_tax_on_shipping(self, client, auth_headers, db_session, test_customer, test_product):
        resp = client.post('/api/sales/orders', json={
            'customer_id': test_customer.id,
            'order_date': datetime.now().strftime('%Y-%m-%d'),
            'shipping_cost': 10000,
            'shipping_ppn_code': None,
            'items': [{'product_id': test_product.id, 'quantity': 1, 'unit_price': 100}],
        }, headers=auth_headers)
        assert resp.status_code == 201, resp.get_json()
        order = db.session.get(SalesOrder, resp.get_json()['order_id'])
        assert float(order.shipping_tax_amount or 0) == 0.0
        assert float(order.total_amount) == 100.0 + 10000.0

    def test_update_shipping_ppn_code_only_recalculates_without_touching_items(self, client, auth_headers, db_session, test_customer, test_product):
        create_resp = client.post('/api/sales/orders', json={
            'customer_id': test_customer.id,
            'order_date': datetime.now().strftime('%Y-%m-%d'),
            'shipping_cost': 10000,
            'items': [{'product_id': test_product.id, 'quantity': 1, 'unit_price': 100}],
        }, headers=auth_headers)
        order_id = create_resp.get_json()['order_id']

        update_resp = client.put(f'/api/sales/orders/{order_id}', json={
            'shipping_ppn_code': 'L',
        }, headers=auth_headers)
        assert update_resp.status_code == 200, update_resp.get_json()

        order = db.session.get(SalesOrder, order_id)
        assert order.shipping_ppn_code == 'L'
        expected_tax = round(10000.0 * 0.12, 2)
        assert float(order.shipping_tax_amount) == expected_tax
        assert float(order.total_amount) == 100.0 + 10000.0 + expected_tax
        assert len(order.items) == 1
