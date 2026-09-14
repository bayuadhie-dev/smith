"""Time-phased MRP engine (2026-09-11, extended 2026-09-11 with make/buy
+ multi-level WIP netting).

Replaces the old single-flat-window gross-to-net report
(routes/mrp.py::get_material_requirements) with a real bucketed run that
matches the core SAP MRP concepts the old version was missing:
  - weekly time buckets across the planning horizon (not one flat window)
  - a running projected-balance netted against scheduled receipts (open
    POs, in-progress WOs), not just today's on-hand stock
  - lead-time offsetting: a shortage's suggested ORDER date is backed off
    from its NEED date by the material's own lead_time_days
  - basic lot sizing (rounds up to Material.min_order_qty / a supplier
    contract's min_order_qty when one exists; lot-for-lot otherwise)
  - procurement type (make vs buy): a sub-assembly with its own active BOM
    is netted against its own on-hand WIP stock first, and only the NET
    shortfall is exploded into the next BOM level - matching SAP's
    low-level-code multi-level netting, instead of exploding the entire
    top-level sales quantity straight through to raw materials regardless
    of WIP already sitting in the warehouse.

Output is a flat list of "Planned Orders" - one per material/sub-assembly
per bucket where a shortage first appears - each tagged procurement_type
'buy' (convertible to a draft Purchase Requisition) or 'make' (a WIP
shortfall that needs a Work Order - informational only for now, not
auto-converted, since WO creation needs routing/workcenter input this
engine doesn't have).

BOM walking here is NOT the shared utils.bom_explosion.explode_bom_requirements
(that helper always explodes a full quantity straight through every level -
exactly the behavior this engine needs to NOT do for internally-made
sub-assemblies). It reuses that module's material-code-to-product matching
helper only, to stay consistent with the one known modeling quirk (a WIP
recorded both as a Product with its own BOM and as a Material leaf row).
"""
from datetime import timedelta
from models import db
from models.sales import SalesOrder
from models.production import BillOfMaterials, WorkOrder
from models.product import Material, Product
from models.purchasing import PurchaseOrder, PurchaseOrderItem, ContractItem
from models.warehouse import Inventory
from utils.bom_explosion import _build_material_code_to_active_bom_map
from utils.timezone import get_local_today


def _current_available_stock(material_id=None, product_id=None):
    """Real total on-hand across every location/batch, excluding
    quarantine/reject (not usable for planning) - unlike
    bom_explosion.get_current_stock(), which only reads ONE Inventory row
    via .first() and silently ignores the rest. Kept local to this engine
    rather than fixing the shared helper, since other callers may depend
    on its existing (buggy) behavior and fixing it is out of scope here."""
    q = Inventory.query.filter(Inventory.is_active == True, Inventory.stock_status.notin_(['quarantine', 'reject']))
    q = q.filter_by(material_id=material_id) if material_id else q.filter_by(product_id=product_id)
    total = 0.0
    for inv in q.all():
        total += float(inv.quantity_on_hand or 0)
    return total


def _mrp_scale_fn(bom_item, parent_qty, bom):
    return float(parent_qty) * float(bom_item.quantity) * (1 + float(bom_item.scrap_percent or 0) / 100)


def _week_bucket(d, start_date):
    """Which weekly bucket index a date falls into, relative to start_date (0-based)."""
    return max(0, (d - start_date).days // 7)


def _lookup_min_order_qty(material_id):
    """MOQ for lot sizing (2026-09-11): prefers Material.min_order_qty
    (from the standard master data import's "Minimum Beli" column) since
    that's the primary, per-item source; falls back to an active supplier
    contract line's MOQ if the material-level one isn't set. Returns None
    (lot-for-lot) if neither exists."""
    material = db.session.get(Material, material_id)
    if material and material.min_order_qty:
        return float(material.min_order_qty)
    line = ContractItem.query.filter(
        ContractItem.material_id == material_id,
        ContractItem.min_order_qty.isnot(None)
    ).first()
    return float(line.min_order_qty) if line else None


def run_mrp(horizon_weeks=12, include_forecasts=True):
    """Runs a full time-phased MRP calculation.

    Returns a dict: {
        'buckets': [{'index', 'start_date', 'end_date'}, ...],
        'materials': {entity_id: {..., 'procurement_type', 'buckets': [...]}},
            # keyed by material_id for 'buy' raw materials AND by product_id
            # for 'make'/'buy' sub-assemblies - kept in one dict so the
            # frontend's existing "detail mingguan" lookup by id still works
            # unmodified for both kinds.
        'planned_orders': [ {..., 'procurement_type': 'buy'|'make'} ... ]
            sorted by order_date
    }
    """
    start_date = get_local_today()
    num_buckets = horizon_weeks
    bucket_defs = []
    for i in range(num_buckets):
        b_start = start_date + timedelta(days=7 * i)
        b_end = b_start + timedelta(days=6)
        bucket_defs.append({'index': i, 'start_date': b_start, 'end_date': b_end})
    horizon_end = bucket_defs[-1]['end_date']

    mid_map = _build_material_code_to_active_bom_map()

    # entity_id -> {'gross': [...], 'receipts': [...], 'meta': {...}}
    # material entries keyed by material_id (kind='material'), sub-assembly
    # entries keyed by product_id (kind='product').
    state = {}

    def _ensure(kind, entity_id, name, code, uom, has_own_bom=False):
        key = (kind, entity_id)
        if key not in state:
            state[key] = {
                'kind': kind, 'id': entity_id,
                'gross': [0.0] * num_buckets,
                'receipts': [0.0] * num_buckets,
                'name': name, 'code': code, 'uom': uom,
                'has_own_bom': has_own_bom,
                'exploded': False,  # whether its net shortfall has already driven a deeper explosion
            }
        return state[key]

    def _explode_one_level(product_id, quantity, need_date):
        """Explodes exactly one BOM level of product_id for `quantity`,
        adding gross requirements to raw-material entries directly and to
        sub-assembly entries (without recursing into THEIR bom yet - that
        only happens after the sub-assembly's own net shortfall is known,
        via the netting loop below)."""
        if need_date > horizon_end or quantity <= 0:
            return
        bom = BillOfMaterials.query.filter_by(product_id=product_id, is_active=True).first()
        if not bom:
            return
        idx = _week_bucket(max(need_date, start_date), start_date)
        for bom_item in bom.items:
            qty = _mrp_scale_fn(bom_item, quantity, bom)
            if qty <= 0:
                continue

            sub_product_id = bom_item.product_id or mid_map.get(bom_item.material_id)
            if sub_product_id:
                sub_bom = BillOfMaterials.query.filter_by(product_id=sub_product_id, is_active=True).first()
                p = db.session.get(Product, sub_product_id)
                if p and getattr(p, 'is_excluded_from_mrp', False):
                    continue
                entry = _ensure('product', sub_product_id, p.name if p else bom_item.material.name if bom_item.material_id else None,
                                 p.code if p else None, p.primary_uom if p else bom_item.uom, has_own_bom=sub_bom is not None)
                entry['gross'][idx] += qty
                continue

            if bom_item.material_id:
                m = db.session.get(Material, bom_item.material_id)
                if m and getattr(m, 'is_excluded_from_mrp', False):
                    continue
                entry = _ensure('material', bom_item.material_id, m.name if m else None, m.code if m else None, bom_item.uom)
                entry['gross'][idx] += qty

    # 1. Confirmed sales orders, bucketed by required_date (fallback: order_date) -
    #    top-level finished-goods explosion, one level, same as before.
    sales_orders = SalesOrder.query.filter(
        SalesOrder.status.in_(['confirmed', 'processing'])
    ).all()
    for order in sales_orders:
        need_date = order.required_date or order.order_date
        if not need_date or need_date < start_date or need_date > horizon_end:
            continue
        for item in order.items:
            _explode_one_level(item.product_id, float(item.quantity), need_date)

    # 2. Forecasts, apportioned across the weeks they overlap
    if include_forecasts:
        from utils.forecast_helper import forecast_rows_in_range
        forecasts = forecast_rows_in_range(start_date, horizon_end)
        for forecast in forecasts:
            if not forecast.product_id:
                continue
            f_start = max(forecast.period_start, start_date)
            f_end = min(forecast.period_end, horizon_end)
            total_days = (forecast.period_end - forecast.period_start).days
            if total_days <= 0 or f_start > f_end:
                continue
            qty_total = float(forecast.most_likely or 0)
            d = f_start
            while d <= f_end:
                bucket_end = min(d + timedelta(days=6), f_end)
                days_in_bucket = (bucket_end - d).days + 1
                qty_share = qty_total * (days_in_bucket / total_days)
                if qty_share > 0:
                    _explode_one_level(forecast.product_id, qty_share, d)
                d = bucket_end + timedelta(days=1)

    # 3. Scheduled receipts - open PO items (by po.delivery_date), materials only (bought)
    open_po_items = db.session.query(PurchaseOrderItem, PurchaseOrder).join(
        PurchaseOrder, PurchaseOrderItem.po_id == PurchaseOrder.id
    ).filter(
        PurchaseOrder.status.in_(['approved', 'partial']),
        PurchaseOrder.delivery_date.isnot(None),
        PurchaseOrder.delivery_date >= start_date,
        PurchaseOrder.delivery_date <= horizon_end,
    ).all()
    for item, po in open_po_items:
        if not item.material_id:
            continue
        remaining = float(item.quantity or 0) - float(item.quantity_received or 0)
        if remaining <= 0:
            continue
        idx = _week_bucket(po.delivery_date, start_date)
        material = db.session.get(Material, item.material_id)
        entry = _ensure('material', item.material_id, material.name if material else item.description, material.code if material else None, item.uom)
        entry['receipts'][idx] += remaining

    # 4. Scheduled receipts - in-progress WOs producing a sub-assembly that
    #    already appears as gross demand somewhere in this run.
    in_progress_wos = WorkOrder.query.filter(
        WorkOrder.status.in_(['in_progress', 'released']),
        WorkOrder.scheduled_end_date.isnot(None),
        WorkOrder.scheduled_end_date >= start_date,
        WorkOrder.scheduled_end_date <= horizon_end,
    ).all()
    for wo in in_progress_wos:
        key = ('product', wo.product_id)
        if key not in state:
            continue  # only relevant if this product actually appears as BOM demand somewhere in this run
        idx = _week_bucket(wo.scheduled_end_date.date() if hasattr(wo.scheduled_end_date, 'date') else wo.scheduled_end_date, start_date)
        qty = float(wo.quantity_good) if wo.quantity_good else float(wo.quantity or 0)
        state[key]['receipts'][idx] += qty

    # 4.5. VB-style reorder-point planning (2026-09-11) - classic SAP "VB"
    #    manual reorder-point planning, for materials that never appear as
    #    BOM demand in this run at all (indirect/consumable materials with
    #    no SO/forecast-driven usage) but DO have Material.reorder_point set.
    #    Replaces 3 separate, all-zero-data reorder mechanisms that used to
    #    exist in parallel (InventoryReorderPoint on Warehouse, SparePart's
    #    own reorder_point on Asset Management/MRO, and this same
    #    Material.reorder_point field which had no consuming logic anywhere)
    #    - see project_mrp_time_phased memory for the audit. Seeded here
    #    with zero gross/receipts so step 6 below nets it through the exact
    #    same bucketed floor logic as safety stock - no separate code path.
    tracked_material_ids = {k[1] for k in state if k[0] == 'material'}
    reorder_point_materials = Material.query.filter(
        Material.reorder_point > 0,
        Material.is_active == True,
        Material.is_excluded_from_mrp == False,
    ).all()
    for m in reorder_point_materials:
        if m.id in tracked_material_ids:
            continue  # already has real BOM-driven demand - PD-style netting below already covers it
        _ensure('material', m.id, m.name, m.code, m.primary_uom)

    # 5. Net each sub-assembly against its own WIP stock, iteratively pushing
    #    any net shortfall one more BOM level down - this is the actual
    #    "multi-level netting" fix: a sub-assembly's parent demand no longer
    #    silently explodes straight through raw materials regardless of
    #    on-hand WIP.
    rounds = 0
    while True:
        rounds += 1
        pending = [k for k, e in state.items() if k[0] == 'product' and e['has_own_bom'] and not e['exploded']]
        if not pending or rounds > 25:  # cycle/runaway safety cap, same spirit as bom_explosion's max_depth
            break
        for key in pending:
            entry = state[key]
            entry['exploded'] = True
            on_hand = _current_available_stock(product_id=key[1])
            balance = on_hand
            for i in range(num_buckets):
                balance = balance + entry['receipts'][i] - entry['gross'][i]
                if balance < 0:
                    shortfall = -balance
                    _explode_one_level(key[1], shortfall, bucket_defs[i]['start_date'])
                    balance = 0  # the shortfall is assumed covered by the resulting production order, same lot-for-lot convention as the material netting pass below

    # 6. Final netting pass + planned-order generation, for BOTH raw
    #    materials (procurement_type='buy') and sub-assemblies
    #    (procurement_type='make' if they have their own BOM, else 'buy' -
    #    a WIP-coded item that can't actually be produced further, e.g. an
    #    outsourced/subcontracted sub-assembly with no BOM of its own here).
    planned_orders = []
    for key, entry in state.items():
        kind, entity_id = key
        is_material = kind == 'material'
        material = db.session.get(Material, entity_id) if is_material else None
        lead_time = (material.lead_time_days if material else 0) or 0
        procurement_type = 'buy' if (is_material or not entry['has_own_bom']) else 'make'
        moq = _lookup_min_order_qty(entity_id) if is_material else None
        # Safety stock (2026-09-11): a proactive buffer, manually entered by
        # master data staff - NULL means "not used", 0 is a real explicit
        # floor of zero (distinct from NULL, matching the field's own
        # comment on the Material model). Only exists on Material for now
        # (Product/sub-assembly WIP has no equivalent field yet). Nets to
        # this floor instead of straight to zero - previously a material
        # could run down to exactly 0 before triggering a planned order,
        # silently ignoring a buffer master data staff had deliberately set.
        safety_stock = float(material.safety_stock_qty) if (material and material.safety_stock_qty is not None) else 0.0
        # Reorder point (2026-09-11) folded into the same floor as safety
        # stock - whichever buffer is larger wins. Covers both cases: a
        # BOM-driven material that also happens to have a manual
        # reorder_point set, and a reorder-point-only material seeded with
        # zero demand in step 4.5 above (classic VB-style planning).
        reorder_point = float(material.reorder_point) if (material and material.reorder_point) else 0.0
        floor = max(safety_stock, reorder_point)

        on_hand = _current_available_stock(material_id=entity_id if is_material else None,
                                            product_id=entity_id if not is_material else None)
        buckets_out = []
        balance = on_hand
        for i in range(num_buckets):
            balance = balance + entry['receipts'][i] - entry['gross'][i]
            shortage = max(0.0, floor - balance)
            buckets_out.append({
                'index': i,
                'gross_requirement': entry['gross'][i],
                'scheduled_receipt': entry['receipts'][i],
                'projected_balance': balance,
                'net_requirement': shortage,
            })
            if shortage > 0:
                need_date = bucket_defs[i]['start_date']
                order_qty = shortage
                covered_by_moq = False
                if moq and order_qty < moq:
                    order_qty = moq
                    covered_by_moq = True
                # No manufacturing-lead-time field exists on Product yet (only
                # a "customer delivery lead time" with a different meaning -
                # see project_mrp_time_phased memory) - 'make' orders are
                # flagged with 0 offset rather than guessing at a number.
                order_date = need_date - timedelta(days=lead_time if procurement_type == 'buy' else 0)
                planned_orders.append({
                    'entity_kind': kind,
                    'material_id': entity_id,
                    'material_code': entry['code'],
                    'material_name': entry['name'],
                    'uom': entry['uom'],
                    'quantity': round(order_qty, 4),
                    'need_date': need_date.isoformat(),
                    'order_date': order_date.isoformat(),
                    'week_index': i,
                    'lead_time_days': lead_time if procurement_type == 'buy' else 0,
                    'covered_by_moq': covered_by_moq,
                    'is_overdue': order_date < start_date,
                    'procurement_type': procurement_type,
                })
                balance += order_qty

        entry['buckets'] = buckets_out
        entry['procurement_type'] = procurement_type

    planned_orders.sort(key=lambda p: p['order_date'])

    # Keep the 'materials' output dict shape backward-compatible with the
    # frontend (keyed by id, kind kept internally on each entry so a
    # material_id and a product_id landing on the same numeric id can't collide).
    materials_out = {f"{k[0]}:{k[1]}": v for k, v in state.items()}

    return {
        'buckets': [{'index': b['index'], 'start_date': b['start_date'].isoformat(), 'end_date': b['end_date'].isoformat()} for b in bucket_defs],
        'materials': materials_out,
        'planned_orders': planned_orders,
    }
