"""Shared "snapshot BOM into a Work Order" logic (2026-10-16).

Before this, a WO's BOM was only frozen into WorkOrderBOMItem rows when
staff manually clicked "Copy BOM" (routes/production.py::copy_bom_to_work_order).
Until that click, /work-orders/<id>/bom fell through to reading the LIVE
master BOM directly - so if the master BOM got edited between WO creation
and that click (or if staff never clicked it, e.g. until Tutup SPK), the WO
silently showed whatever the master BOM happens to be *right now*, not what
was in effect when the WO was planned/released. Two WOs created the same
day against the "same" BOM could end up with different frozen recipes
purely based on when each happened to be copied.

Fix: snapshot automatically, synchronously, at WO-creation time - no more
window where the WO's effective recipe is undefined. The manual "Copy BOM"
endpoint is kept (now a thin wrapper around this) for the rare case a WO
was created before this fix, or its BOM was deliberately cleared.
"""
import math
from models import db
from models.production import BillOfMaterials
from models.work_order_bom import WorkOrderBOMItem


def snapshot_bom_to_work_order(wo):
    """Copy the WO's active master BOM into WorkOrderBOMItem rows.

    Resolves the BOM the same way copy_bom_to_work_order always has:
    wo.bom_id first, else the product's active BOM. Does NOT check for
    pre-existing WorkOrderBOMItem rows - callers that care (the manual
    re-copy endpoint) check that themselves before calling this.

    Returns (bom_or_None, items_copied). A WO for a product with no active
    BOM yet (e.g. a brand-new product) gets bom=None, items_copied=0 - not
    an error here, since WO creation itself doesn't require a BOM to exist
    (same as before this fix: the live-read fallback also returned nothing
    in that case).
    """
    bom = None
    if wo.bom_id:
        bom = db.session.get(BillOfMaterials, wo.bom_id)
    if not bom and wo.product_id:
        bom = BillOfMaterials.query.filter_by(product_id=wo.product_id, is_active=True).first()
    if not bom:
        return None, 0

    wo_quantity = float(wo.quantity) if wo.quantity else 0
    bom_ppc = float(bom.pack_per_carton) if bom.pack_per_carton else float(wo.pack_per_carton or 1)
    total_cartons = math.ceil(wo_quantity / bom_ppc) if bom_ppc > 0 else 0

    for bom_item in bom.items:
        qty_per_ctn = float(bom_item.quantity) if bom_item.quantity else 0
        conversion_factor = float(bom_item.conversion_factor or 1)
        scrap_factor = 1 + (float(bom_item.scrap_percent or 0) / 100)
        # quantity_planned is consumed downstream (start_work_order's
        # auto-issue, WIP costing) as a quantity in the MATERIAL's own
        # stock-tracking UOM, not necessarily this BOM line's `uom` - apply
        # the conversion here, once, at snapshot time (2026-10-20), so every
        # later reader of quantity_planned can trust it's already correct.
        # scrap_percent is included too (2026-10-21 live-test caught this
        # missing) - create_work_order's shortage-check preview already
        # included scrap, so a snapshot without it silently under-issued
        # material relative to what staff were shown at WO creation.
        qty_planned = qty_per_ctn * total_cartons * scrap_factor * conversion_factor

        unit_cost = float(bom_item.unit_cost) if bom_item.unit_cost else 0.0
        db.session.add(WorkOrderBOMItem(
            work_order_id=wo.id,
            original_bom_id=bom.id,
            original_bom_item_id=bom_item.id,
            line_number=bom_item.line_number,
            material_id=bom_item.material_id,
            product_id=bom_item.product_id,
            item_name=bom_item.item_name,
            item_code=bom_item.item_code,
            item_type=bom_item.item_type,
            quantity_per_unit=bom_item.quantity,
            uom=bom_item.uom,
            conversion_factor=bom_item.conversion_factor,
            scrap_percent=bom_item.scrap_percent,
            quantity_planned=qty_planned,
            unit_cost=bom_item.unit_cost,
            total_cost_planned=qty_planned * unit_cost,
            is_modified=False,
            is_added=False,
            notes=bom_item.notes,
        ))

    return bom, len(bom.items)
