"""
Auto-Reserve queue processor — Bagian 1 (B) of WAREHOUSE_FOLLOW_THE_GOODS_DESIGN.md.

When a SalesOrder is confirmed, a ProductionPlan is approved, or a WorkOrder is
released, materials should be auto-reserved (FIFO) against BOM requirements and
a MaterialIssue (trigger_source='auto_reserve') created/kept as the "follow the
goods" record for that document.

IMPORTANT — FIFO-BY-DOCUMENT-DATE ordering:
If 2+ documents compete for the same material at roughly the same time, reserving
strictly in the order HTTP requests happen to arrive is NOT acceptable (that's an
accident of request timing, not a business decision). Instead, every trigger point
calls `process_auto_reserve_queue()`, which:
  1. Builds the FULL backlog of confirmed/approved/released documents that do not
     yet have an auto_reserve MaterialIssue (not just the one that just changed).
  2. Sorts that backlog by document date (SO.order_date / Plan.created_at /
     WO.created_at) ascending — oldest document first.
  3. Reserves in that order, calling fifo_reserve_stock() per material, which
     itself takes a SELECT FOR UPDATE lock on the relevant Inventory rows in
     created_at (batch-age) order.

This keeps reservation priority deterministic and tied to when the document was
created, regardless of which document's status happened to flip last or which
HTTP request reached the server first. Once a document has an auto_reserve
MaterialIssue (even if reservation was only partial/insufficient), it is
considered "processed" and is not reprocessed automatically — a shortfall
surfaces via GET /api/material-issues/shortages for a human to act on.
Automatically re-queuing a still-short document when new stock arrives is
Bagian 2 territory and intentionally out of scope here.
"""
from datetime import datetime, date
from models import db
from models.material_issue import MaterialIssue, MaterialIssueItem
from models.sales import SalesOrder
from models.production import ProductionPlan, WorkOrder, BillOfMaterials
from utils import generate_number
from utils.timezone import get_local_now
from utils.fifo_helper import fifo_reserve_stock


def _to_datetime(value):
    """Normalize a Date or DateTime column value into a datetime for sorting."""
    if value is None:
        return datetime.min
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    return datetime.min


def _get_bom_requirements(product_id, quantity):
    """Return [(material_id, required_qty, uom, material_name)] for a product's
    active BOM - now exploded multi-layer (Tahap 4, 2026-08-20): a BOM line
    that references another product_id (a semi-finished/WIP sub-assembly)
    is, if that sub-assembly is short on physical stock AND has its own
    active BOM, recursively exploded down to raw materials instead of being
    silently dropped (the old behavior — this function used to skip
    `product_id` lines entirely with `if not bom_item.material_id: continue`,
    losing that requirement's material need altogether).

    Deliberately narrow scope: a sub-assembly line that's short but has NO
    BOM of its own is still left alone here (same as before) rather than
    also becoming a reservable "product requirement" — doing that would mean
    extending MaterialIssueItem/fifo_reserve_stock plumbing in
    _create_auto_reserve_issue() and requeue_insufficient_items() too, well
    beyond "explode the BOM deeper". That's a related but separate decision,
    not made here.

    Per-line quantity formula (bom_item.quantity * parent_qty, no batch_size/
    scrap%) is kept byte-for-byte identical to before for material_id leaves -
    this is the exact formula validated against Bagian 1's FIFO reservation
    regression tests. See utils/bom_explosion.py for the shared tree-walker."""
    from utils.bom_explosion import explode_bom_requirements, CircularBOMError, MaxDepthExceededError

    bom = BillOfMaterials.query.filter_by(product_id=product_id, is_active=True).first()
    if not bom:
        return []

    def scale_fn(bom_item, parent_qty, bom):
        return float(bom_item.quantity) * float(parent_qty)

    try:
        exploded = explode_bom_requirements(product_id, quantity, scale_fn)
    except (CircularBOMError, MaxDepthExceededError):
        # Same fallback as a missing BOM - don't crash the SO/Plan/WO trigger
        # this is called from; the shortage will simply surface as
        # 'insufficient' via the normal reservation-failure path instead.
        return []

    return [
        (m['material_id'], m['required_quantity'], m['uom'], m['material_name'])
        for m in exploded['materials']
    ]


def _create_auto_reserve_issue(requirements, *, work_order_id=None, sales_order_id=None,
                                production_plan_id=None, production_batch_id=None,
                                requested_by=None, notes=None, trigger_source='auto_reserve'):
    """Create one MaterialIssue + items, attempting FIFO reservation per material
    immediately. Always creates the record (even if some/all items end up
    'insufficient') so the document is marked as processed and the shortage is
    visible via the shortage report.

    Reused by 2 callers (2026-08-24): process_auto_reserve_queue() (trigger_source=
    'auto_reserve', the default) and the SPK-issuance hook in
    routes/batch_scheduling.py's approve_batches() (trigger_source='spk',
    production_batch_id set) - same creation+reservation logic, different trigger
    and link column. See SPK_STAGING_BAHAN_BAKU_RENCANA_TEKNIS.md."""
    issue_number = generate_number('MI', MaterialIssue, 'issue_number')

    mi = MaterialIssue(
        issue_number=issue_number,
        work_order_id=work_order_id,
        sales_order_id=sales_order_id,
        production_plan_id=production_plan_id,
        production_batch_id=production_batch_id,
        issue_date=get_local_now(),
        requested_by=requested_by,
        status='approved',  # reservation attempted immediately, no manual 'pending' step
        priority='normal',
        issue_type='production',
        trigger_source=trigger_source,
        notes=notes,
        approved_date=get_local_now(),
    )
    db.session.add(mi)
    db.session.flush()

    any_full = False
    any_partial_or_insufficient = False

    for idx, (material_id, required_qty, uom, material_name) in enumerate(requirements, 1):
        item = MaterialIssueItem(
            material_issue_id=mi.id,
            line_number=idx,
            material_id=material_id,
            description=material_name or '',
            required_quantity=required_qty,
            uom=uom,
            status='pending',
        )
        db.session.add(item)

        if required_qty <= 0:
            item.reservation_status = 'none'
            continue

        result = fifo_reserve_stock(material_id=material_id, quantity_needed=required_qty)

        if result['success'] and result['reserved'] >= required_qty:
            item.reservation_status = 'full'
            item.reserved_quantity = result['reserved']
            any_full = True
            if result['reservations']:
                item.warehouse_location_id = result['reservations'][0]['location_id']
                item.batch_number = result['reservations'][0]['batch_number']
        elif result.get('reserved', 0) and result['reserved'] > 0:
            # Partial success shouldn't normally happen since fifo_reserve_stock fails
            # atomically below the total, but handle defensively.
            item.reservation_status = 'partial'
            item.reserved_quantity = result['reserved']
            any_partial_or_insufficient = True
        else:
            item.reservation_status = 'insufficient'
            item.reserved_quantity = 0
            any_partial_or_insufficient = True

    if any_full and any_partial_or_insufficient:
        mi.status = 'approved'  # mixed — still "approved" tier, shortage report shows the gap
    elif any_partial_or_insufficient and not any_full:
        mi.status = 'approved'  # nothing reserved yet, still visible via shortage report

    return mi


def _material_issue_doc_date(mi):
    """Same document-date resolution used by process_auto_reserve_queue(),
    factored out so requeue_insufficient_items() can sort MaterialIssue rows
    by the same FIFO principle without duplicating the SO/Plan/WO lookup."""
    if mi.sales_order_id and mi.sales_order:
        return _to_datetime(mi.sales_order.order_date)
    if mi.production_plan_id and mi.production_plan:
        return _to_datetime(mi.production_plan.created_at)
    if mi.work_order_id and mi.work_order:
        return _to_datetime(mi.work_order.created_at)
    return _to_datetime(mi.created_at)


def requeue_insufficient_items():
    """Retry FIFO reservation for MaterialIssueItem rows still stuck at
    reservation_status='insufficient', after new stock has become available
    (GRN received, InventoryAdjustment approved, StockOpname approved).

    Scope is intentionally narrow: only 'insufficient' items (zero reserved
    so far) are retried here, not 'partial' — matches the approved design,
    not silently widening it. FIFO-by-document-date ordering is preserved by
    processing MaterialIssue rows (not raw items) sorted by the same
    document-date resolution as process_auto_reserve_queue().

    Safe/cheap to call after every stock-increasing event — each call just
    re-scans for whatever is still outstanding. Commits per MaterialIssue so
    one bad row doesn't roll back progress on the others. Sends one in-app
    notification per MaterialIssue that had at least one item resolved.
    """
    from utils.send_notification import send_notification

    items = MaterialIssueItem.query.join(
        MaterialIssue, MaterialIssueItem.material_issue_id == MaterialIssue.id
    ).filter(
        MaterialIssueItem.reservation_status == 'insufficient',
        MaterialIssue.status.in_(['approved', 'partial'])
    ).all()

    by_mi = {}
    for item in items:
        by_mi.setdefault(item.material_issue_id, []).append(item)

    mi_list = [db.session.get(MaterialIssue, mi_id) for mi_id in by_mi.keys()]
    mi_list = [mi for mi in mi_list if mi is not None]
    mi_list.sort(key=_material_issue_doc_date)

    resolved_summary = []

    for mi in mi_list:
        mi_items = sorted(by_mi[mi.id], key=lambda it: it.line_number)
        any_resolved = False
        resolved_names = []

        try:
            for item in mi_items:
                result = fifo_reserve_stock(material_id=item.material_id, quantity_needed=float(item.required_quantity))

                if result['success'] and result['reserved'] >= float(item.required_quantity):
                    item.reservation_status = 'full'
                    item.reserved_quantity = result['reserved']
                    if result['reservations']:
                        item.warehouse_location_id = result['reservations'][0]['location_id']
                        item.batch_number = result['reservations'][0]['batch_number']
                    any_resolved = True
                    resolved_names.append(item.description or (item.material.name if item.material else f'item #{item.line_number}'))
                elif result.get('reserved', 0) and result['reserved'] > 0:
                    item.reservation_status = 'partial'
                    item.reserved_quantity = result['reserved']
                    any_resolved = True
                    resolved_names.append(item.description or (item.material.name if item.material else f'item #{item.line_number}'))
                # else: still insufficient, leave untouched

            db.session.commit()

            if any_resolved:
                send_notification(
                    user_id=mi.requested_by,
                    title=f'Stok tersedia — {mi.issue_number}',
                    message=f'Material yang tadinya kurang sekarang bisa dipenuhi sebagian/seluruhnya: {", ".join(resolved_names)}.',
                    category='inventory',
                    notification_type='success',
                    reference_type='material_issue',
                    reference_id=mi.id,
                    action_url=f'/app/production/material-issues/{mi.id}',
                )
                resolved_summary.append({'material_issue_id': mi.id, 'issue_number': mi.issue_number, 'items_resolved': resolved_names})
        except Exception:
            db.session.rollback()
            continue

    return {'resolved': resolved_summary}


def process_auto_reserve_queue():
    """Process the FULL backlog of confirmed/approved/released SO/Plan/WO that do
    not yet have an auto_reserve MaterialIssue, in document-date ASC order.

    Safe/cheap to call from every trigger point (SO confirm, Plan approve, WO
    release) — each call just re-scans for anything still outstanding.

    Returns a summary dict for logging/response purposes.
    """
    queue = []  # list of (doc_date, kind, obj)

    # --- Sales Orders confirmed, no auto_reserve MaterialIssue yet ---
    already_so_ids = {
        r[0] for r in db.session.query(MaterialIssue.sales_order_id).filter(
            MaterialIssue.trigger_source == 'auto_reserve',
            MaterialIssue.sales_order_id.isnot(None)
        ).all()
    }
    sos = SalesOrder.query.filter(SalesOrder.status == 'confirmed').all()
    for so in sos:
        if so.id in already_so_ids:
            continue
        queue.append((_to_datetime(so.order_date), 'sales_order', so))

    # --- Production Plans approved, no auto_reserve MaterialIssue yet ---
    already_pp_ids = {
        r[0] for r in db.session.query(MaterialIssue.production_plan_id).filter(
            MaterialIssue.trigger_source == 'auto_reserve',
            MaterialIssue.production_plan_id.isnot(None)
        ).all()
    }
    plans = ProductionPlan.query.filter(ProductionPlan.status == 'approved').all()
    for plan in plans:
        if plan.id in already_pp_ids:
            continue
        queue.append((_to_datetime(plan.created_at), 'production_plan', plan))

    # --- Work Orders released, no auto_reserve MaterialIssue yet ---
    already_wo_ids = {
        r[0] for r in db.session.query(MaterialIssue.work_order_id).filter(
            MaterialIssue.trigger_source == 'auto_reserve',
            MaterialIssue.work_order_id.isnot(None)
        ).all()
    }
    wos = WorkOrder.query.filter(WorkOrder.status == 'released').all()
    for wo in wos:
        if wo.id in already_wo_ids:
            continue
        queue.append((_to_datetime(wo.created_at), 'work_order', wo))

    # Sort the WHOLE backlog by document date ASC — oldest document gets first
    # crack at whatever stock is available, independent of processing order.
    queue.sort(key=lambda t: t[0])

    processed = []
    for doc_date, kind, obj in queue:
        try:
            if kind == 'sales_order':
                requirements = []
                for so_item in obj.items:
                    requirements.extend(_get_bom_requirements(so_item.product_id, so_item.quantity))
                if not requirements:
                    continue
                mi = _create_auto_reserve_issue(
                    requirements,
                    sales_order_id=obj.id,
                    requested_by=obj.created_by,
                    notes=f'Auto-reserved from Sales Order {obj.order_number}'
                )
            elif kind == 'production_plan':
                requirements = _get_bom_requirements(obj.product_id, obj.planned_quantity)
                if not requirements:
                    continue
                mi = _create_auto_reserve_issue(
                    requirements,
                    production_plan_id=obj.id,
                    requested_by=obj.created_by,
                    notes=f'Auto-reserved from Production Plan {obj.plan_number}'
                )
            elif kind == 'work_order':
                requirements = _get_bom_requirements(obj.product_id, obj.quantity)
                if not requirements:
                    continue
                mi = _create_auto_reserve_issue(
                    requirements,
                    work_order_id=obj.id,
                    requested_by=obj.created_by,
                    notes=f'Auto-reserved from Work Order {obj.wo_number}'
                )
            else:
                continue

            db.session.commit()
            processed.append({'kind': kind, 'id': obj.id, 'material_issue_id': mi.id,
                               'issue_number': mi.issue_number})
        except Exception as e:
            db.session.rollback()
            processed.append({'kind': kind, 'id': obj.id, 'error': str(e)})

    return {'processed': processed, 'queue_size': len(queue)}
