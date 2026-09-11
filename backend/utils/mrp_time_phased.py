"""
MRP Time-Phased Check with Cross-SO Aggregation.

Triggered when a Sales Forecast is converted to a Sales Order
(routes/sales.py convert_forecast_to_order()). Unlike the existing
check_and_create_po() (which checks ONE sales order's material needs in
isolation), this checks the NEW order's materials against the COMBINED
demand of every other CONFIRMED Sales Order whose required_date falls in
the same rolling 2-month window - because two unrelated orders due the
same month compete for the same raw material, and checking them in
isolation misses that.

Reuses (does not reimplement):
- utils.bom_explosion.explode_bom_requirements() - the shared BOM tree-walker,
  called once per SO item, in a loop, exactly like every other caller does.
- utils.bom_explosion.get_current_stock() - the SAME stock source
  check_and_create_po() uses. Do NOT use routes/mrp.py's own
  get_current_stock() - that one sums Inventory.quantity_available
  filtered by product_id=<material_id> (a confirmed pre-existing bug,
  wrong column, left un-fixed - out of scope here) and would silently
  return 0 for every material queried this way.

No new table/cache: computed fresh on every call. SO volume at SMITH's
scale doesn't warrant persisting an intermediate explosion result, and a
snapshot would go stale the moment another order changes - PPIC should
always see the CURRENT picture, not a frozen one from trigger time.
"""
from datetime import date, timedelta
from calendar import monthrange
from models import db
from models.sales import SalesOrder
from utils.forecast_helper import iter_forecast_month_rows
from models.production import BillOfMaterials
from models.product import Material
from utils.bom_explosion import explode_bom_requirements, get_current_stock, CircularBOMError, MaxDepthExceededError
from utils.timezone import get_local_today


def _scale_fn(bom_item, parent_qty, bom):
    """Same per-line quantity formula as check_and_create_po() - preserved
    exactly so the two features agree on what "required_quantity" means."""
    pack_per_carton = bom.pack_per_carton or 1
    cartons_needed = parent_qty / pack_per_carton
    required_qty = float(bom_item.quantity) * cartons_needed / float(bom.batch_size)
    required_qty *= (1 + float(bom_item.scrap_percent or 0) / 100)
    return required_qty


def _rolling_window(anchor_date):
    """Rolling 2-month window: the anchor's month + the next month,
    as [window_start, window_end] dates (inclusive)."""
    window_start = anchor_date.replace(day=1)
    next_month = anchor_date.month + 1
    next_year = anchor_date.year
    if next_month > 12:
        next_month = 1
        next_year += 1
    last_day = monthrange(next_year, next_month)[1]
    window_end = date(next_year, next_month, last_day)
    return window_start, window_end


def _explode_so_materials(so):
    """Explode every item on one Sales Order, return {material_id: qty},
    skipping items whose product has no active BOM (nothing to explode -
    same "skip silently" behavior check_and_create_po() already has for
    this exact case, not a new decision introduced here)."""
    materials = {}
    for item in so.items:
        bom = BillOfMaterials.query.filter_by(product_id=item.product_id, is_active=True).first()
        if not bom:
            continue
        try:
            exploded = explode_bom_requirements(item.product_id, float(item.quantity), _scale_fn)
        except (CircularBOMError, MaxDepthExceededError):
            continue
        for m in exploded['materials']:
            materials[m['material_id']] = materials.get(m['material_id'], 0) + m['required_quantity']
    return materials


def get_incoming_po_quantity(material_id):
    """Sum of not-yet-received quantity on active Purchase Orders for this
    material. 'draft' POs are excluded (not yet committed to a supplier,
    may never be sent); 'received'/'cancelled' are excluded (received
    stock is already in Inventory.quantity_on_hand, cancelled never
    arrives). New logic - nothing in the codebase combines stock +
    incoming PO into one shortage comparison today."""
    from models.purchasing import PurchaseOrder, PurchaseOrderItem

    total = db.session.query(
        db.func.sum(PurchaseOrderItem.quantity - db.func.coalesce(PurchaseOrderItem.quantity_received, 0))
    ).join(PurchaseOrder, PurchaseOrderItem.po_id == PurchaseOrder.id).filter(
        PurchaseOrderItem.material_id == material_id,
        PurchaseOrder.status.in_(['sent', 'confirmed', 'partial'])
    ).scalar()

    return float(total or 0)


def _anchor_week(period_start):
    """Safety Stock (S4): forecast bulanan di-anchor ke MINGGU PERTAMA BULAN
    dari period_start - bukan period_start apa adanya. period_start bebas
    (tidak dijamin selalu tanggal 1 - investigasi mendapati data forecast
    yang ada saat rencana ditulis punya period_start tanggal 20), jadi
    anchor diambil dari bulan-kalendernya saja: tanggal 1-7 bulan itu.
    period_end sengaja tidak dipakai sama sekali untuk anchor ini."""
    month_start = period_start.replace(day=1)
    month_first_week_end = month_start + timedelta(days=6)
    return month_start, month_first_week_end


def _forecast_material_demand(forecast):
    """Explode 1 forecast month-cell punya produk -> {material_id: qty}. Reuse
    _scale_fn yang sama dipakai sisi Sales Order di file ini (bukan
    _mrp_scale_fn punya routes/mrp.py /requirements) supaya angka dari 2
    sisi (SO vs forecast) dihitung dengan formula yang sama sebelum
    dibandingkan MAX() (S5) - kalau beda formula, MAX() jadi bandingkan
    dua angka yang tidak apple-to-apple.

    Pakai forecast.qty (2026-08-24: dulu forecast.committed, sebelum Sales
    Forecast Matrix - field committed sudah dinonaktifkan dari alur aktif
    per §3.1(a), Matrix cuma simpan 1 angka qty polos per bulan, jadi tidak
    ada lagi bedanya committed vs most_likely untuk dibaca terpisah)."""
    if not forecast.product_id:
        return {}
    bom = BillOfMaterials.query.filter_by(product_id=forecast.product_id, is_active=True).first()
    if not bom:
        return {}
    qty = float(forecast.qty or 0)
    if qty <= 0:
        return {}
    try:
        exploded = explode_bom_requirements(forecast.product_id, qty, _scale_fn)
    except (CircularBOMError, MaxDepthExceededError):
        return {}
    return {m['material_id']: m['required_quantity'] for m in exploded['materials']}


def _safety_stock_layer(today):
    """Safety Stock (S1-S4): buffer proaktif dari Rolling Forecast, per
    material yang punya safety_stock_days terisi (S1 fallback: NULL =
    skip total, material itu MRP-only seperti sekarang). Materials dengan
    is_excluded_from_mrp = True dikecualikan total (S2).

    Return {material_id: {'shortage_qty', 'contributors': [...]}} - HANYA
    untuk material yang benar-benar punya kontribusi forecast (tidak
    dimasukkan kalau tidak ada forecast yang overlap horizon-nya)."""
    candidates = Material.query.filter(
        Material.safety_stock_days.isnot(None),
        Material.is_excluded_from_mrp.is_(False),
    ).all()
    if not candidates:
        return {}

    # iter_forecast_month_rows() replaces SalesForecast.query - only 'approved' status
    # exists as a source here (Matrix has no 'submitted' status, §3.3). Anchor-week logic
    # below is completely unchanged, only the data source changed (SALES_FORECAST_MATRIX_
    # RENCANA_TEKNIS.md §4).
    forecasts = list(iter_forecast_month_rows(status_filter=('approved',)))
    if not forecasts:
        return {}

    forecast_anchor = {(f.line_id, f.month): _anchor_week(f.period_start) for f in forecasts}
    forecast_demand_cache = {}  # lazily filled per (line_id, month), shared across materials

    layer = {}
    for material in candidates:
        horizon_start = today
        horizon_end = today + timedelta(days=material.safety_stock_days)

        total_forecast_demand = 0
        contributors = []
        for f in forecasts:
            key = (f.line_id, f.month)
            aw_start, aw_end = forecast_anchor[key]
            if aw_end < horizon_start or aw_start > horizon_end:
                continue  # anchor week forecast ini tidak overlap horizon material ini

            if key not in forecast_demand_cache:
                forecast_demand_cache[key] = _forecast_material_demand(f)
            qty = forecast_demand_cache[key].get(material.id, 0)
            if qty <= 0:
                continue

            total_forecast_demand += qty
            contributors.append({
                'type': 'safety_stock_forecast',
                'forecast_id': f.line_id,
                'forecast_number': f.forecast_number,
                'product_name': f.product.name if f.product else None,
                'quantity': round(qty, 2),
                'month': f.period_start.strftime('%Y-%m'),
            })

        if not contributors:
            continue  # material punya safety_stock_days tapi tidak ada forecast relevan - tidak perlu dilaporkan

        available_stock = get_current_stock(material_id=material.id)
        incoming_po_qty = get_incoming_po_quantity(material.id)
        safety_stock_shortage = max(0, total_forecast_demand - available_stock - incoming_po_qty)

        layer[material.id] = {
            'shortage_qty': safety_stock_shortage,
            'contributors': contributors,
        }

    return layer


def check_time_phased_aggregate(sales_order_id):
    """Returns a list of dicts, one per material relevant to this report -
    the union of (a) materials the triggering SO itself needs (combined
    demand across every confirmed SO in the rolling 2-month window, exactly
    as before) and (b) materials with a Safety Stock buffer configured that
    have relevant forecast demand (Safety Stock layer, S1-S5), even if the
    triggering SO never touches them - a material can be flagged purely
    because its forecast demand is high, with no SO involved at all (S5).

    For a material present in BOTH sources, shortage_qty is MAX(SO-side,
    Safety-Stock-side) - never summed (S5) - and shortage_source says which
    side produced the larger number. Materials with is_excluded_from_mrp
    are skipped entirely from both sides (S2)."""
    trigger_so = db.session.get(SalesOrder, sales_order_id)
    if not trigger_so:
        raise ValueError(f'Sales Order {sales_order_id} not found')

    anchor_date = trigger_so.required_date or trigger_so.order_date
    window_start, window_end = _rolling_window(anchor_date)

    # Materials relevant to the SO side of THIS report = only what the
    # triggering SO itself needs. Deliberately NOT early-returning when this
    # is empty (unlike before Safety Stock existed) - the Safety Stock layer
    # below must still run even if the triggering SO has no BOM-backed
    # materials at all, since it's proactive and forecast-driven, not scoped
    # to the trigger SO's own content.
    trigger_materials = _explode_so_materials(trigger_so)

    aggregate = {}  # material_id -> {total_required, contributors: [...]}
    if trigger_materials:
        # Every OTHER confirmed SO whose required_date (fallback order_date)
        # falls in the window. The trigger SO itself is always included
        # below regardless of its own status - it was just created by the
        # convert endpoint (starts as 'draft'), and the spec explicitly
        # calls it out as always counted ("termasuk SO yang baru dibuat ini
        # sendiri").
        candidates = SalesOrder.query.filter(
            SalesOrder.status == 'confirmed',
            SalesOrder.id != trigger_so.id,
            db.or_(
                db.and_(SalesOrder.required_date.isnot(None), SalesOrder.required_date.between(window_start, window_end)),
                db.and_(SalesOrder.required_date.is_(None), SalesOrder.order_date.between(window_start, window_end)),
            )
        ).all()
        candidates.append(trigger_so)

        for so in candidates:
            so_materials = _explode_so_materials(so)
            so_month = (so.required_date or so.order_date).strftime('%Y-%m')
            for material_id, qty in so_materials.items():
                if material_id not in trigger_materials:
                    continue  # out of scope for this report - not one of the trigger SO's own materials
                material = db.session.get(Material, material_id)
                if material and material.is_excluded_from_mrp:
                    continue  # S2 - excluded entirely, never surfaced anywhere
                bucket = aggregate.setdefault(material_id, {'total_required': 0, 'contributors': []})
                bucket['total_required'] += qty
                product_names = ', '.join(sorted({i.product.name for i in so.items if i.product}))
                bucket['contributors'].append({
                    'type': 'sales_order',
                    'sales_order_id': so.id,
                    'order_number': so.order_number,
                    'product_name': product_names or None,
                    'quantity': round(qty, 2),
                    'month': so_month,
                })

    safety_stock_layer = _safety_stock_layer(get_local_today())

    all_material_ids = set(aggregate.keys()) | set(safety_stock_layer.keys())
    if not all_material_ids:
        return []

    results = []
    for material_id in all_material_ids:
        material = db.session.get(Material, material_id)
        available_stock = get_current_stock(material_id=material_id)
        incoming_po_qty = get_incoming_po_quantity(material_id)

        so_bucket = aggregate.get(material_id)
        so_total_required = so_bucket['total_required'] if so_bucket else 0
        so_shortage = max(0, so_total_required - available_stock - incoming_po_qty) if so_bucket else 0

        ss_bucket = safety_stock_layer.get(material_id)
        ss_shortage = ss_bucket['shortage_qty'] if ss_bucket else 0

        shortage_qty = max(so_shortage, ss_shortage)  # S5 - MAX(), never summed
        shortage_source = 'safety_stock_forecast' if ss_shortage > so_shortage else 'sales_order'

        contributors = list(so_bucket['contributors']) if so_bucket else []
        if ss_bucket:
            contributors.extend(ss_bucket['contributors'])

        results.append({
            'material_id': material_id,
            'material_name': material.name if material else None,
            'uom': material.primary_uom if material else None,
            'total_required': round(so_total_required, 2),
            'available_stock': round(available_stock, 2),
            'incoming_po_qty': round(incoming_po_qty, 2),
            'shortage_qty': round(shortage_qty, 2),
            'shortage_source': shortage_source,
            'contributors': sorted(contributors, key=lambda c: c['month']),
        })

    results.sort(key=lambda r: r['shortage_qty'], reverse=True)
    return results
