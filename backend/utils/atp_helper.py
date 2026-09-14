"""ATP (Available to Promise) - SAP SD concept, added 2026-09-14.

Real gap found while auditing SO confirmation: BusinessRules.validate_inventory_availability()
checks Inventory.quantity_available, but nothing ever reserves finished-goods stock when a
Sales Order is confirmed (quantity_reserved is only ever mutated by utils/fifo_helper.py for
raw-material issue, never for FG/product stock on SO confirm). So two SOs for the same product
confirmed minutes apart both see the same full quantity_available, unaware of each other's
claim - a real double-promise blind spot, not just a theoretical one (see
project_accurate_vs_custom_erp_scope memory: Sales already has real live usage, unlike
Purchasing, so this was fixed as an information upgrade to the existing warning rather than a
new hard block - see confirm_order_core in sales_order_workflow.py).

committed_by_open_orders = sum(quantity - quantity_shipped) across every OTHER SalesOrderItem
for the same product on an order whose status is still an open commitment (confirmed,
in_production, ready) - not draft (not yet promised) and not shipped/delivered/cancelled
(already fulfilled or moot).
"""
from models import db
from models.warehouse import Inventory
from models.sales import SalesOrder, SalesOrderItem
from sqlalchemy import func

OPEN_COMMITMENT_STATUSES = ('confirmed', 'in_production', 'ready')


def check_atp(product_id, quantity_needed, exclude_order_id=None, location_id=None):
    """Returns dict: available (bool), on_hand, committed_elsewhere, free_to_promise,
    shortage, competing_orders (list of {order_id, order_number, customer_name, quantity})."""
    query = db.session.query(func.sum(Inventory.quantity_available)).filter(
        Inventory.product_id == product_id,
        Inventory.is_active == True
    )
    if location_id:
        query = query.filter(Inventory.location_id == location_id)
    on_hand = float(query.scalar() or 0)

    competing_q = db.session.query(SalesOrderItem, SalesOrder).join(
        SalesOrder, SalesOrderItem.order_id == SalesOrder.id
    ).filter(
        SalesOrderItem.product_id == product_id,
        SalesOrder.status.in_(OPEN_COMMITMENT_STATUSES),
    )
    if exclude_order_id:
        competing_q = competing_q.filter(SalesOrder.id != exclude_order_id)

    competing_orders = []
    committed_elsewhere = 0.0
    for item, order in competing_q.all():
        remaining = float(item.quantity or 0) - float(item.quantity_shipped or 0)
        if remaining <= 0:
            continue
        committed_elsewhere += remaining
        competing_orders.append({
            'order_id': order.id,
            'order_number': order.order_number,
            'customer_name': order.customer.company_name if order.customer else None,
            'quantity': remaining,
        })

    free_to_promise = on_hand - committed_elsewhere
    quantity_needed = float(quantity_needed or 0)
    shortage = max(0.0, quantity_needed - free_to_promise)

    return {
        'available': shortage <= 0,
        'on_hand': on_hand,
        'committed_elsewhere': committed_elsewhere,
        'free_to_promise': free_to_promise,
        'required': quantity_needed,
        'shortage': shortage,
        'competing_orders': competing_orders,
    }
