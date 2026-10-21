"""
SAP-equivalence plan item #4 (fix_report_3.md Fase 23, 2026-10-05):
utils/mrp_engine.py::run_mrp() previously only supported lot-for-lot (SAP
'EX') with optional MOQ rounding. Added Material.lot_sizing_procedure
(EX/FX/WB/MB) + Material.fixed_lot_size, consumed by:
- _lookup_lot_sizing() / _round_up_to_multiple() for FX (fixed lot size).
- _pool_planned_orders() for WB/MB (pool planned orders by real ISO
  calendar week/month, not the engine's internal rolling-from-today
  bucket, which is NOT the same thing - see that function's docstring).

EX/FX are tested end-to-end through run_mrp() (SO -> BOM -> Material),
since their behavior only depends on quantity math, not calendar
alignment. WB/MB pooling is tested directly against
_pool_planned_orders() with hand-built planned-order dicts, so the test
is deterministic regardless of what real-world date it happens to run on
(an end-to-end SO-based WB/MB test would need to hit a specific
rolling-bucket-vs-real-week misalignment that depends on today's weekday,
which isn't worth chasing for a unit test).
"""
from datetime import date


def _setup_product_with_bom(db_session, material_kwargs=None, required_qty_per_unit=1):
    from models.product import Product, Material
    from models.production import BillOfMaterials, BOMItem

    product = Product(code='PROD-LOTSIZE-001', name='Test Product LotSize', material_type='finished_goods',
                       primary_uom='PCS', is_producible=True, is_active=True)
    db_session.add(product)
    db_session.commit()

    material = Material(
        code='MAT-LOTSIZE-001', name='Test Material LotSize', material_type='raw_materials',
        category='Raw', primary_uom='KG', cost_per_unit=10, is_active=True,
        **(material_kwargs or {}),
    )
    db_session.add(material)
    db_session.commit()

    bom = BillOfMaterials(bom_number='BOM-LOTSIZE-001', product_id=product.id, bom_level='finished_goods',
                           version='1.0', is_active=True, batch_size=1, batch_uom='PCS')
    db_session.add(bom)
    db_session.commit()
    bom_item = BOMItem(bom_id=bom.id, line_number=1, material_id=material.id, quantity=required_qty_per_unit, uom='KG')
    db_session.add(bom_item)
    db_session.commit()

    return product, material


def _confirmed_so(db_session, test_user, product, quantity, order_number='SO-LOTSIZE-001'):
    from models.sales import Customer, SalesOrder, SalesOrderItem

    customer = Customer(code=f'CUST-{order_number}', company_name=f'Customer {order_number}', is_active=True)
    db_session.add(customer)
    db_session.commit()

    so = SalesOrder(order_number=order_number, customer_id=customer.id, order_date=date.today(),
                     required_date=date.today(), status='confirmed')
    db_session.add(so)
    db_session.commit()
    so_item = SalesOrderItem(order_id=so.id, line_number=1, product_id=product.id, quantity=quantity,
                              uom='PCS', unit_price=1000, total_price=quantity * 1000)
    db_session.add(so_item)
    db_session.commit()
    return so


def _planned_order_for(result, material_code):
    matches = [po for po in result['planned_orders'] if po['material_code'] == material_code]
    assert matches, f"No planned order found for {material_code} in {result['planned_orders']}"
    return matches[0]


def test_ex_default_still_uses_moq_unchanged(db_session, test_user):
    """Regression guard: a material left at the EX default (no explicit
    lot_sizing_procedure, or 'EX' set via the server_default) must
    round via Material.min_order_qty exactly as before this feature
    existed - not FX/pooling behavior creeping in uninvited."""
    from utils.mrp_engine import run_mrp

    product, material = _setup_product_with_bom(
        db_session, material_kwargs={'min_order_qty': 200}, required_qty_per_unit=1,
    )
    _confirmed_so(db_session, test_user, product, quantity=120, order_number='SO-LOTSIZE-EX')

    result = run_mrp(horizon_weeks=12, include_forecasts=False)
    po = _planned_order_for(result, material.code)

    assert po['lot_sizing_procedure'] == 'EX'
    assert po['covered_by_moq'] is True
    assert po['covered_by_fixed_lot'] is False
    assert po['quantity'] == 200.0  # MOQ wins over the raw 120 shortfall, same as pre-feature behavior


def test_fx_rounds_shortage_up_to_fixed_lot_size(db_session, test_user):
    """FX ignores MOQ entirely and rounds the net shortage UP to the
    nearest multiple of fixed_lot_size (SAP fixed-lot-size convention -
    never a partial lot)."""
    from utils.mrp_engine import run_mrp

    product, material = _setup_product_with_bom(
        db_session,
        material_kwargs={'min_order_qty': 10, 'lot_sizing_procedure': 'FX', 'fixed_lot_size': 50},
        required_qty_per_unit=1,
    )
    _confirmed_so(db_session, test_user, product, quantity=120, order_number='SO-LOTSIZE-FX')

    result = run_mrp(horizon_weeks=12, include_forecasts=False)
    po = _planned_order_for(result, material.code)

    assert po['lot_sizing_procedure'] == 'FX'
    assert po['covered_by_fixed_lot'] is True
    assert po['covered_by_moq'] is False
    assert po['quantity'] == 150.0  # ceil(120 / 50) * 50 = 150, MOQ(10) ignored


def test_fx_without_fixed_lot_size_falls_back_to_ex(db_session, test_user):
    """A material switched to FX but with no fixed_lot_size filled in yet
    must not crash or silently order zero - falls back to EX/MOQ."""
    from utils.mrp_engine import run_mrp

    product, material = _setup_product_with_bom(
        db_session,
        material_kwargs={'min_order_qty': 75, 'lot_sizing_procedure': 'FX', 'fixed_lot_size': None},
        required_qty_per_unit=1,
    )
    _confirmed_so(db_session, test_user, product, quantity=50, order_number='SO-LOTSIZE-FXFALLBACK')

    result = run_mrp(horizon_weeks=12, include_forecasts=False)
    po = _planned_order_for(result, material.code)

    assert po['lot_sizing_procedure'] == 'EX'
    assert po['covered_by_moq'] is True
    assert po['quantity'] == 75.0  # MOQ applied, FX silently treated as EX


def test_pool_planned_orders_wb_pools_same_iso_calendar_week():
    """WB must merge planned orders whose need_date falls in the same
    real ISO calendar week into one consolidated order, summing
    quantity and keeping the earliest need_date/order_date - even when
    they came from different engine week_index buckets (the whole point
    of WB vs. the engine's default rolling-bucket grain)."""
    from utils.mrp_engine import _pool_planned_orders

    # 2026-01-05 (Mon) and 2026-01-08 (Thu) are both ISO week 2 of 2026.
    planned_orders = [
        {
            'entity_kind': 'material', 'material_id': 1, 'material_code': 'MAT-WB',
            'material_name': 'WB Material', 'uom': 'KG', 'quantity': 30.0,
            'need_date': '2026-01-05', 'order_date': '2026-01-05', 'week_index': 0,
            'lead_time_days': 0, 'covered_by_moq': False, 'covered_by_fixed_lot': False,
            'lot_sizing_procedure': 'WB', 'is_overdue': False, 'procurement_type': 'buy',
        },
        {
            'entity_kind': 'material', 'material_id': 1, 'material_code': 'MAT-WB',
            'material_name': 'WB Material', 'uom': 'KG', 'quantity': 45.0,
            'need_date': '2026-01-08', 'order_date': '2026-01-08', 'week_index': 1,
            'lead_time_days': 0, 'covered_by_moq': True, 'covered_by_fixed_lot': False,
            'lot_sizing_procedure': 'WB', 'is_overdue': False, 'procurement_type': 'buy',
        },
        # Different material, same dates - must stay separate from MAT-WB's group.
        {
            'entity_kind': 'material', 'material_id': 2, 'material_code': 'MAT-OTHER',
            'material_name': 'Other Material', 'uom': 'KG', 'quantity': 10.0,
            'need_date': '2026-01-05', 'order_date': '2026-01-05', 'week_index': 0,
            'lead_time_days': 0, 'covered_by_moq': False, 'covered_by_fixed_lot': False,
            'lot_sizing_procedure': 'EX', 'is_overdue': False, 'procurement_type': 'buy',
        },
    ]
    procedure_by_entity = {
        ('material', 1): ('WB', None),
        ('material', 2): ('EX', None),
    }

    result = _pool_planned_orders(planned_orders, procedure_by_entity)

    wb_orders = [po for po in result if po['material_code'] == 'MAT-WB']
    assert len(wb_orders) == 1
    merged = wb_orders[0]
    assert merged['quantity'] == 75.0  # 30 + 45
    assert merged['need_date'] == '2026-01-05'  # earliest in the group
    assert merged['covered_by_moq'] is True  # True if ANY pooled member was
    assert sorted(merged['pooled_from_weeks']) == [0, 1]

    other_orders = [po for po in result if po['material_code'] == 'MAT-OTHER']
    assert len(other_orders) == 1
    assert other_orders[0]['quantity'] == 10.0  # untouched, different material/procedure


def test_pool_planned_orders_mb_pools_same_calendar_month():
    """MB must merge planned orders across an entire real calendar month,
    including ones in different ISO weeks (unlike WB)."""
    from utils.mrp_engine import _pool_planned_orders

    planned_orders = [
        {
            'entity_kind': 'material', 'material_id': 3, 'material_code': 'MAT-MB',
            'material_name': 'MB Material', 'uom': 'KG', 'quantity': 20.0,
            'need_date': '2026-03-02', 'order_date': '2026-03-02', 'week_index': 0,
            'lead_time_days': 0, 'covered_by_moq': False, 'covered_by_fixed_lot': False,
            'lot_sizing_procedure': 'MB', 'is_overdue': False, 'procurement_type': 'buy',
        },
        {
            'entity_kind': 'material', 'material_id': 3, 'material_code': 'MAT-MB',
            'material_name': 'MB Material', 'uom': 'KG', 'quantity': 15.0,
            'need_date': '2026-03-25', 'order_date': '2026-03-25', 'week_index': 3,
            'lead_time_days': 0, 'covered_by_moq': False, 'covered_by_fixed_lot': True,
            'lot_sizing_procedure': 'MB', 'is_overdue': False, 'procurement_type': 'buy',
        },
        # Different month - must NOT be pooled in.
        {
            'entity_kind': 'material', 'material_id': 3, 'material_code': 'MAT-MB',
            'material_name': 'MB Material', 'uom': 'KG', 'quantity': 99.0,
            'need_date': '2026-04-02', 'order_date': '2026-04-02', 'week_index': 4,
            'lead_time_days': 0, 'covered_by_moq': False, 'covered_by_fixed_lot': False,
            'lot_sizing_procedure': 'MB', 'is_overdue': False, 'procurement_type': 'buy',
        },
    ]
    procedure_by_entity = {('material', 3): ('MB', None)}

    result = _pool_planned_orders(planned_orders, procedure_by_entity)
    mb_orders = sorted([po for po in result if po['material_code'] == 'MAT-MB'], key=lambda p: p['need_date'])

    assert len(mb_orders) == 2  # March group merged, April stays separate
    march = mb_orders[0]
    assert march['quantity'] == 35.0  # 20 + 15
    assert march['need_date'] == '2026-03-02'
    assert march['covered_by_fixed_lot'] is True

    april = mb_orders[1]
    assert april['quantity'] == 99.0
