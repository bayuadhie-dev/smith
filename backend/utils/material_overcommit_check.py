"""Soft overcommit warning for Work Order creation (2026-10-20).

Gap found during a SAP-gap audit (project memory, 2026-09-14): creating a
Work Order never checked material availability at all - not against raw
on-hand stock, and not against what OTHER still-open WOs already need from
the same scarce material. Two draft WOs could each "claim" the full stock
of a material that only physically exists once, with no warning to either
PPIC or purchasing until someone actually tried to issue material and found
it short.

Real reservation (Inventory.quantity_reserved, via utils/fifo_helper.py)
only kicks in once a Material Issue document exists for a WO - typically
created much later, at/near production start. This module closes the gap
in the window BETWEEN those two points with a non-blocking warning, not a
hard reservation - deliberately: a hard reservation at WO-creation time
would need its own release-on-cancel lifecycle and a decision about how it
interacts with Material Issue's existing reservation (double-booking risk),
which is a bigger, separate change. This gives visibility now without that
redesign.
"""
from models import db
from models.production import BillOfMaterials, WorkOrder
from models.product import Material
from models.warehouse import Inventory

# WOs in these statuses still represent open material demand that hasn't
# been locked in yet by a Material Issue (which would already show up via
# Inventory.quantity_reserved instead). 'in_progress' is excluded - by then
# the BOM should already count as issued/dealt with one way or another.
OPEN_WO_STATUSES = ('planned', 'released')


def _explode_material_needs(product_id, quantity):
    """Material-line-only BOM explosion for one product+quantity: {material_id: qty_needed}.
    Mirrors BOMItem.effective_quantity (includes scrap%), scaled by quantity/batch_size
    the same way snapshot_bom_to_work_order does for the real WO.quantity -> bom.batch_size ratio."""
    bom = BillOfMaterials.query.filter_by(product_id=product_id, is_active=True).first()
    if not bom or not quantity:
        return {}
    batch_size = float(bom.batch_size) if bom.batch_size else 1.0
    if batch_size <= 0:
        batch_size = 1.0
    scale = float(quantity) / batch_size

    needs = {}
    for item in bom.items:
        if not item.material_id:
            continue  # product-type (WIP) sub-lines aren't a stock-overcommit concern here
        # effective_quantity_in_stock_uom (2026-10-20), not effective_quantity -
        # this gets compared directly against Inventory below, which is
        # always in the material's own stock UOM, not necessarily this BOM
        # line's uom.
        qty = float(item.effective_quantity_in_stock_uom) * scale
        needs[item.material_id] = needs.get(item.material_id, 0.0) + qty
    return needs


def check_material_overcommit(product_id, quantity, exclude_wo_id=None):
    """Returns a list of warning dicts for materials where this new WO's need,
    combined with every OTHER open WO's need for the same material, would
    exceed currently available stock. Empty list = no warning, including
    when the product has no active BOM (nothing to check)."""
    this_wo_needs = _explode_material_needs(product_id, quantity)
    if not this_wo_needs:
        return []

    other_wos = WorkOrder.query.filter(
        WorkOrder.status.in_(OPEN_WO_STATUSES),
        WorkOrder.id != (exclude_wo_id or -1),
    ).all()

    other_demand = {}
    for wo in other_wos:
        for material_id, qty in _explode_material_needs(wo.product_id, wo.quantity).items():
            other_demand[material_id] = other_demand.get(material_id, 0.0) + qty

    warnings = []
    for material_id, need_qty in this_wo_needs.items():
        combined_demand = need_qty + other_demand.get(material_id, 0.0)

        available = db.session.query(
            db.func.coalesce(db.func.sum(Inventory.quantity_available), 0)
        ).filter(
            Inventory.material_id == material_id,
            Inventory.stock_status.in_(['available', 'released']),
            Inventory.is_active == True,
        ).scalar()
        available = float(available or 0)

        if combined_demand > available:
            material = db.session.get(Material, material_id)
            warnings.append({
                'material_id': material_id,
                'material_code': material.code if material else None,
                'material_name': material.name if material else f'Material #{material_id}',
                'needed_this_wo': round(need_qty, 4),
                'other_open_wo_demand': round(other_demand.get(material_id, 0.0), 4),
                'combined_demand': round(combined_demand, 4),
                'available_stock': round(available, 4),
                'deficit': round(combined_demand - available, 4),
            })

    return warnings
