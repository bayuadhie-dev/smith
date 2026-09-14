"""Pricing Procedure (SAP SD concept), added 2026-09-14 during the SD gap-closing
work (see project_sap_alignment_survey memory - SalesOrderItem had flat unit_price/
discount/tax fields with no condition-type stack, and unit_price was manually typed
with zero server-side calculation or lookup at all).

Simplified condition-type stack: starts from a base price (CustomerMaterialInfo.
special_price if a record exists for this customer+product, else Product.price),
then applies every active PricingCondition whose scope matches (customer/product/
both/all) and whose validity window covers today, in `sequence` order. Discounts/
surcharges compound onto a running price; tax is computed last, as a percentage of
the running price, and kept separate (matching SalesOrderItem's existing
tax_percent/tax_amount fields - this does NOT fold tax into unit_price).

Does not write to SalesOrderItem - callers (the /sales/pricing/calculate endpoint,
consumed by the frontend) take the returned unit_price/discount_percent/tax_percent/
breakdown and populate the existing fields themselves.
"""
from models import db
from models.sales import PricingCondition, CustomerMaterialInfo
from models.product import Product
from utils.timezone import get_local_today


def calculate_price(product_id, customer_id=None, quantity=1):
    product = db.session.get(Product, product_id)
    if not product:
        raise ValueError(f'Product {product_id} not found')

    info_record = None
    if customer_id:
        info_record = CustomerMaterialInfo.query.filter_by(
            customer_id=customer_id, product_id=product_id, is_active=True
        ).first()

    base_price = float(info_record.special_price) if (info_record and info_record.special_price is not None) else float(product.price or 0)

    today = get_local_today()
    query = PricingCondition.query.filter_by(is_active=True).filter(
        db.or_(PricingCondition.customer_id.is_(None), PricingCondition.customer_id == customer_id),
        db.or_(PricingCondition.product_id.is_(None), PricingCondition.product_id == product_id),
        db.or_(PricingCondition.valid_from.is_(None), PricingCondition.valid_from <= today),
        db.or_(PricingCondition.valid_to.is_(None), PricingCondition.valid_to >= today),
    ).order_by(PricingCondition.sequence)
    conditions = query.all()

    breakdown = [{'name': 'Harga Dasar', 'type': 'base_price', 'amount': round(base_price, 2)}]
    running_price = base_price
    total_discount = 0.0
    total_surcharge = 0.0
    tax_percent = 0.0

    for cond in conditions:
        value = float(cond.value)
        if cond.condition_type == 'discount':
            delta = running_price * value / 100 if cond.calculation_type == 'percentage' else value
            running_price -= delta
            total_discount += delta
            breakdown.append({'name': cond.name, 'type': 'discount', 'amount': round(-delta, 2)})
        elif cond.condition_type == 'surcharge':
            delta = running_price * value / 100 if cond.calculation_type == 'percentage' else value
            running_price += delta
            total_surcharge += delta
            breakdown.append({'name': cond.name, 'type': 'surcharge', 'amount': round(delta, 2)})
        elif cond.condition_type == 'tax':
            # Tax is reported separately (percentage + amount), not folded into
            # running_price/unit_price - matches SalesOrderItem's existing
            # tax_percent/tax_amount fields being distinct from unit_price.
            tax_percent += value if cond.calculation_type == 'percentage' else (value / running_price * 100 if running_price else 0)
            breakdown.append({'name': cond.name, 'type': 'tax', 'amount': round(running_price * value / 100 if cond.calculation_type == 'percentage' else value, 2)})

    unit_price = round(running_price, 2)
    discount_percent = round((total_discount / base_price * 100) if base_price else 0, 2)
    tax_amount = round(unit_price * tax_percent / 100 * float(quantity or 1), 2)

    result = {
        'product_id': product_id,
        'customer_id': customer_id,
        'base_price': round(base_price, 2),
        'unit_price': unit_price,
        'discount_percent': discount_percent,
        'total_discount': round(total_discount, 2),
        'total_surcharge': round(total_surcharge, 2),
        'tax_percent': round(tax_percent, 2),
        'tax_amount': tax_amount,
        'breakdown': breakdown,
    }
    if info_record:
        result['customer_material_code'] = info_record.customer_material_code
        result['min_order_qty'] = float(info_record.min_order_qty) if info_record.min_order_qty is not None else None
        result['lead_time_days'] = info_record.lead_time_days
        if info_record.min_order_qty is not None and float(quantity or 0) < float(info_record.min_order_qty):
            result['moq_warning'] = (
                f"Qty {quantity} di bawah MOQ khusus customer ini ({float(info_record.min_order_qty)})."
            )
    return result
