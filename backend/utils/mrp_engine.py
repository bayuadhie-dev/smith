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
from sqlalchemy import func
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


def _lookup_lot_sizing(material_id):
    """SAP-equivalence plan item #4 (2026-10-05): the configured lot-sizing
    procedure for a material - EX/FX/WB/MB, see Material.lot_sizing_procedure
    docstring on the model. Only materials have this (same scope as
    _lookup_min_order_qty - sub-assemblies/Products don't get a lot-sizing
    config field, matching the pre-existing MOQ limitation). Returns
    ('EX', None) for anything without an explicit procedure set, or for an
    FX material missing its fixed_lot_size (treated as EX rather than
    erroring, since a planner may switch the dropdown before filling the
    size in)."""
    material = db.session.get(Material, material_id)
    if not material:
        return 'EX', None
    procedure = (material.lot_sizing_procedure or 'EX').upper()
    if procedure == 'FX':
        size = float(material.fixed_lot_size) if material.fixed_lot_size else None
        if not size or size <= 0:
            return 'EX', None
        return 'FX', size
    if procedure in ('WB', 'MB'):
        return procedure, None
    return 'EX', None


def _round_up_to_multiple(qty, multiple):
    """Rounds qty UP to the next multiple of `multiple` (SAP FX convention -
    always orders in whole lots, never a partial one). qty<=0 or
    multiple<=0 returns qty unchanged (caller already guards against this,
    kept here too for safety)."""
    if multiple <= 0 or qty <= 0:
        return qty
    import math
    return math.ceil(qty / multiple) * multiple


def _pool_planned_orders(planned_orders, procedure_by_entity):
    """SAP-equivalence plan item #4 (2026-10-05): WB/MB lot sizing.

    The core engine below (step 6) nets and rounds per WEEKLY BUCKET - but
    those buckets are a rolling window from today (start_date + 7*i), not
    calendar-aligned, so they are NOT the same thing as SAP's WB (weekly)
    lot-sizing procedure, which pools demand by real ISO calendar week
    (Mon-Sun), and MB pools by real calendar month. This pass runs AFTER
    the per-bucket planned orders already exist (generated using the same
    EX/MOQ-or-FX rounding as any other procedure) and merges, for any
    material configured as WB or MB, every planned order whose need_date
    falls in the same real calendar week/month into ONE consolidated
    order - summed quantity, earliest need_date in the group, order_date
    recomputed from that need_date's own lead time offset.

    procedure_by_entity: {(kind, entity_id): ('EX'|'FX'|'WB'|'MB', extra)}
    as returned by _lookup_lot_sizing/default, keyed the same way as the
    engine's internal `state` dict.
    """
    from datetime import date as _date

    def _group_key(procedure, need_date_iso):
        d = _date.fromisoformat(need_date_iso)
        if procedure == 'WB':
            iso_year, iso_week, _ = d.isocalendar()
            return ('WB', iso_year, iso_week)
        else:  # MB
            return ('MB', d.year, d.month)

    pooled = []
    groups = {}  # (kind, entity_id, group_key) -> list of planned_order dicts
    passthrough = []

    for po in planned_orders:
        key = (po['entity_kind'], po['material_id'])
        procedure, _extra = procedure_by_entity.get(key, ('EX', None))
        if procedure not in ('WB', 'MB'):
            passthrough.append(po)
            continue
        gkey = (po['entity_kind'], po['material_id']) + _group_key(procedure, po['need_date'])
        groups.setdefault(gkey, []).append(po)

    for gkey, members in groups.items():
        if len(members) == 1:
            pooled.append(members[0])
            continue
        members_sorted = sorted(members, key=lambda m: m['need_date'])
        earliest = members_sorted[0]
        total_qty = round(sum(m['quantity'] for m in members), 4)
        merged = dict(earliest)
        merged['quantity'] = total_qty
        merged['covered_by_moq'] = any(m.get('covered_by_moq') for m in members)
        merged['covered_by_fixed_lot'] = any(m.get('covered_by_fixed_lot') for m in members)
        merged['pooled_from_weeks'] = sorted({m['week_index'] for m in members})
        merged['lot_sizing_procedure'] = earliest.get('lot_sizing_procedure')
        pooled.append(merged)

    result = passthrough + pooled
    result.sort(key=lambda p: p['order_date'])
    return result


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
            # "Firm" netting: if a WorkOrder already exists for this SO's
            # product (planner already released it to the floor), don't
            # re-explode the full quantity as gross demand every re-run -
            # SAP firms a planned/production order the same way so MRP
            # stops treating already-committed demand as open. Only the
            # uncovered remainder (if the WO is partial, or none exists yet)
            # still generates material demand.
            firmed_qty = db.session.query(func.coalesce(func.sum(WorkOrder.quantity), 0)).filter(
                WorkOrder.sales_order_id == order.id,
                WorkOrder.product_id == item.product_id,
                WorkOrder.status.in_(['planned', 'released', 'in_progress', 'completed']),
            ).scalar()
            remaining_qty = max(0.0, float(item.quantity) - float(firmed_qty or 0))
            if remaining_qty <= 0:
                continue
            _explode_one_level(item.product_id, remaining_qty, need_date)

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
    procedure_by_entity = {}  # key -> (lot_sizing_procedure, fixed_lot_size), for the WB/MB pooling pass below
    for key, entry in state.items():
        kind, entity_id = key
        is_material = kind == 'material'
        material = db.session.get(Material, entity_id) if is_material else None
        lead_time = (material.lead_time_days if material else 0) or 0
        procurement_type = 'buy' if (is_material or not entry['has_own_bom']) else 'make'
        moq = _lookup_min_order_qty(entity_id) if is_material else None
        lot_procedure, fixed_lot_size = _lookup_lot_sizing(entity_id) if is_material else ('EX', None)
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
                covered_by_fixed_lot = False
                if lot_procedure == 'FX' and fixed_lot_size:
                    # FX ignores MOQ - a fixed lot size IS the ordering rule,
                    # not an additional floor on top of it.
                    order_qty = _round_up_to_multiple(order_qty, fixed_lot_size)
                    covered_by_fixed_lot = True
                elif moq and order_qty < moq:
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
                    'covered_by_fixed_lot': covered_by_fixed_lot,
                    'lot_sizing_procedure': lot_procedure,
                    'is_overdue': order_date < start_date,
                    'procurement_type': procurement_type,
                })
                balance += order_qty

        entry['buckets'] = buckets_out
        entry['procurement_type'] = procurement_type
        procedure_by_entity[key] = (lot_procedure, fixed_lot_size)

    planned_orders = _pool_planned_orders(planned_orders, procedure_by_entity)

    # 7. Exception messages (MD05-equivalent): reschedule-in / reschedule-out
    #    / cancel, for receipts ALREADY committed (open PO items, in-progress
    #    WOs) that this run's own netting (step 6's per-entity `buckets`,
    #    specifically `net_requirement`) says are scheduled at the wrong
    #    time relative to when they're actually needed. Reuses the same
    #    open_po_items/in_progress_wos querysets steps 3/4 already built -
    #    by the time step 6 runs, `receipts[idx]` has summed away which PO/WO
    #    contributed what, so this re-walks those two lists independently
    #    rather than trying to recover source attribution out of `state`.
    exceptions = []

    def _earliest_need_idx(entry):
        for b in entry.get('buckets', []):
            if b['net_requirement'] > 0:
                return b['index']
        return None

    for item, po in open_po_items:
        if not item.material_id:
            continue
        entry = state.get(('material', item.material_id))
        if not entry:
            continue
        po_idx = _week_bucket(po.delivery_date, start_date)
        need_idx = _earliest_need_idx(entry)
        remaining = float(item.quantity or 0) - float(item.quantity_received or 0)
        if remaining <= 0:
            continue
        if need_idx is None:
            exceptions.append({
                'type': 'cancel', 'source': 'purchase_order', 'source_id': po.id, 'source_number': po.po_number,
                'material_id': item.material_id, 'material_code': entry['code'], 'material_name': entry['name'],
                'quantity': remaining, 'scheduled_date': po.delivery_date.isoformat() if hasattr(po.delivery_date, 'isoformat') else str(po.delivery_date),
                'scheduled_week_index': po_idx, 'needed_week_index': None,
                'message': f"PO {po.po_number} dijadwalkan terima {entry['name']}, tapi tidak ada kebutuhan untuk material ini dalam horizon - pertimbangkan batalkan/tunda.",
            })
        elif need_idx < po_idx:
            exceptions.append({
                'type': 'reschedule_in', 'source': 'purchase_order', 'source_id': po.id, 'source_number': po.po_number,
                'material_id': item.material_id, 'material_code': entry['code'], 'material_name': entry['name'],
                'quantity': remaining, 'scheduled_date': po.delivery_date.isoformat() if hasattr(po.delivery_date, 'isoformat') else str(po.delivery_date),
                'scheduled_week_index': po_idx, 'needed_week_index': need_idx,
                'message': f"PO {po.po_number} ({entry['name']}) dijadwalkan minggu ke-{po_idx}, tapi sudah dibutuhkan minggu ke-{need_idx} - percepat kedatangan.",
            })
        elif need_idx > po_idx:
            exceptions.append({
                'type': 'reschedule_out', 'source': 'purchase_order', 'source_id': po.id, 'source_number': po.po_number,
                'material_id': item.material_id, 'material_code': entry['code'], 'material_name': entry['name'],
                'quantity': remaining, 'scheduled_date': po.delivery_date.isoformat() if hasattr(po.delivery_date, 'isoformat') else str(po.delivery_date),
                'scheduled_week_index': po_idx, 'needed_week_index': need_idx,
                'message': f"PO {po.po_number} ({entry['name']}) dijadwalkan minggu ke-{po_idx}, baru dibutuhkan minggu ke-{need_idx} - bisa ditunda.",
            })

    for wo in in_progress_wos:
        entry = state.get(('product', wo.product_id))
        if not entry:
            continue
        wo_idx = _week_bucket(wo.scheduled_end_date.date() if hasattr(wo.scheduled_end_date, 'date') else wo.scheduled_end_date, start_date)
        need_idx = _earliest_need_idx(entry)
        qty = float(wo.quantity_good) if wo.quantity_good else float(wo.quantity or 0)
        if qty <= 0:
            continue
        if need_idx is None:
            exceptions.append({
                'type': 'cancel', 'source': 'work_order', 'source_id': wo.id, 'source_number': wo.wo_number,
                'material_id': wo.product_id, 'material_code': entry['code'], 'material_name': entry['name'],
                'quantity': qty, 'scheduled_date': wo.scheduled_end_date.isoformat() if hasattr(wo.scheduled_end_date, 'isoformat') else str(wo.scheduled_end_date),
                'scheduled_week_index': wo_idx, 'needed_week_index': None,
                'message': f"SPK {wo.wo_number} ({entry['name']}) dijadwalkan selesai, tapi tidak ada kebutuhan untuk produk ini dalam horizon - cek relevansinya.",
            })
        elif need_idx < wo_idx:
            exceptions.append({
                'type': 'reschedule_in', 'source': 'work_order', 'source_id': wo.id, 'source_number': wo.wo_number,
                'material_id': wo.product_id, 'material_code': entry['code'], 'material_name': entry['name'],
                'quantity': qty, 'scheduled_date': wo.scheduled_end_date.isoformat() if hasattr(wo.scheduled_end_date, 'isoformat') else str(wo.scheduled_end_date),
                'scheduled_week_index': wo_idx, 'needed_week_index': need_idx,
                'message': f"SPK {wo.wo_number} ({entry['name']}) dijadwalkan selesai minggu ke-{wo_idx}, tapi sudah dibutuhkan minggu ke-{need_idx} - percepat produksi.",
            })
        elif need_idx > wo_idx:
            exceptions.append({
                'type': 'reschedule_out', 'source': 'work_order', 'source_id': wo.id, 'source_number': wo.wo_number,
                'material_id': wo.product_id, 'material_code': entry['code'], 'material_name': entry['name'],
                'quantity': qty, 'scheduled_date': wo.scheduled_end_date.isoformat() if hasattr(wo.scheduled_end_date, 'isoformat') else str(wo.scheduled_end_date),
                'scheduled_week_index': wo_idx, 'needed_week_index': need_idx,
                'message': f"SPK {wo.wo_number} ({entry['name']}) dijadwalkan selesai minggu ke-{wo_idx}, baru dibutuhkan minggu ke-{need_idx} - bisa ditunda.",
            })

    # Keep the 'materials' output dict shape backward-compatible with the
    # frontend (keyed by id, kind kept internally on each entry so a
    # material_id and a product_id landing on the same numeric id can't collide).
    materials_out = {f"{k[0]}:{k[1]}": v for k, v in state.items()}

    return {
        'buckets': [{'index': b['index'], 'start_date': b['start_date'].isoformat(), 'end_date': b['end_date'].isoformat()} for b in bucket_defs],
        'materials': materials_out,
        'planned_orders': planned_orders,
        'exceptions': exceptions,
    }
