"""
Recursive multi-layer BOM explosion — Tahap 4 (2026-08-20).

Before this, every shortage-check call site explored exactly ONE level of
a product's BOM: if a BOM line referenced another product_id (a semi-
finished/WIP sub-assembly, e.g. bom_level='mixing'/'wip') instead of a
material_id (raw material), that line was either treated as a leaf
without checking whether the sub-assembly itself needs producing, or
(in utils/auto_reserve.py's case) silently skipped entirely. Production
data has 0 BOMItem rows using product_id today (all 266 active BOMs are
flat 'finished_goods'), so this never surfaced - but the schema
(BOMItem.product_id, BillOfMaterials.bom_level) was clearly designed for
nested BOMs from the start.

This module is the single shared tree-walker. It does NOT hardcode the
per-line quantity formula - each of the 3 call sites (routes/mrp.py
check_and_create_po, routes/mrp.py get_material_requirements,
utils/auto_reserve.py _get_bom_requirements) has its own existing
quantity-scaling convention (batch_size/pack_per_carton/scrap% handling
differs between them), so callers pass a `scale_fn(bom_item, parent_qty,
bom) -> float` callback. This module only owns the tree-walk: finding the
active BOM, deciding leaf vs recurse based on sub-assembly stock, cycle
detection, and merging results - not the arithmetic.
"""
import logging
from models.production import BillOfMaterials

logger = logging.getLogger(__name__)


class CircularBOMError(Exception):
    """Raised when a BOM references itself, directly or through a chain
    of sub-assemblies. `path` is the full product_id chain that closed
    the loop, e.g. [10, 25, 10] - shown to the user, never silently
    truncated."""
    def __init__(self, path):
        self.path = path
        names = ' → '.join(str(p) for p in path)
        super().__init__(f'BOM sirkular terdeteksi: {names}')


class MaxDepthExceededError(Exception):
    """Safety net behind cycle detection - shouldn't normally trigger if
    cycle detection is working, but guards against any path that evades
    it (e.g. a bug in the visited-set logic)."""
    def __init__(self, product_id, max_depth):
        self.product_id = product_id
        super().__init__(
            f'BOM untuk produk ID {product_id} terlalu dalam (>{max_depth} level) - '
            f'kemungkinan ada masalah struktur BOM, bukan sekadar BOM berlapis wajar.'
        )


def get_current_stock(material_id=None, product_id=None):
    from models.warehouse import Inventory
    q = Inventory.query.filter_by(is_active=True)
    q = q.filter_by(material_id=material_id) if material_id else q.filter_by(product_id=product_id)
    inv = q.first()
    return float(inv.quantity_on_hand) if inv else 0.0


def _build_material_code_to_active_bom_map():
    """Some BOMs reference a sub-assembly through material_id instead of
    product_id, where the Material's code happens to match the code of a
    Product that has its own active BOM (e.g. a WIP recorded both as a
    Product with a real production-backed BOM, and separately as a
    Material row used as a leaf ingredient in a parent BOM - confirmed
    2026-08-20 for the ALFAMART WET WIPES case and 46 other pairs found
    via a full-catalog scan). Built once per root explode_bom_requirements
    call and threaded through recursion - never re-queried per BOM line,
    to avoid N+1 queries on BOMs with many lines.
    """
    from models.product import Product, Material
    rows = (
        Product.query
        .join(BillOfMaterials, BillOfMaterials.product_id == Product.id)
        .filter(BillOfMaterials.is_active == True, Product.code.isnot(None))
        .with_entities(Product.code, Product.id)
        .distinct()
        .all()
    )
    code_to_product = {code: pid for code, pid in rows}
    if not code_to_product:
        return {}
    material_codes = {m.code: m.id for m in Material.query.filter(Material.code.in_(code_to_product.keys())).all()}
    return {mid: code_to_product[code] for code, mid in material_codes.items()}


def explode_bom_requirements(product_id, quantity, scale_fn, extra_fn=None, path=None, max_depth=10, _material_id_to_product_id=None):
    """Explode a product's active BOM recursively.

    Args:
        product_id: the product whose BOM to explode.
        quantity: how much of `product_id` is needed (same unit basis the
            caller's `scale_fn` expects - e.g. cartons for check_and_create_po,
            raw quantity for auto_reserve.py - this module doesn't convert units).
        scale_fn(bom_item, parent_quantity, bom) -> float: caller-supplied
            per-line quantity formula, preserves each call site's existing
            scaling convention exactly (batch_size/pack_per_carton/scrap%
            handling differs between sites - not this module's concern).
        extra_fn(bom_item) -> dict, optional: caller-supplied per-line
            metadata (e.g. unit_cost/supplier_id/is_critical) merged into
            each material's dict. If the same material_id is reached via
            more than one bom_item (merged/summed), the first occurrence's
            extra_fn output wins - matches the fact that required_quantity
            is already being summed across occurrences, not kept separate.
        path: internal - the product_id chain from the root call to here,
            used for cycle detection. Callers should never pass this.
        max_depth: safety cap behind cycle detection.

    Returns:
        {
            'materials': [{material_id, uom, material_name, required_quantity, path}],
                # merged/summed by material_id across all branches
            'sub_assemblies': [{product_id, product_name, required_quantity,
                                 current_stock, shortage_quantity, has_own_bom, path}],
                # every product_id line encountered, whether or not it needed
                # further explosion - lets callers report "WIP X is short by Y"
                # separately from the raw-material shortage
        }

    Raises:
        CircularBOMError, MaxDepthExceededError - never silently swallowed.
    """
    if path is None:
        path = []
        _material_id_to_product_id = _build_material_code_to_active_bom_map()
    if product_id in path:
        raise CircularBOMError(path + [product_id])
    if len(path) > max_depth:
        raise MaxDepthExceededError(product_id, max_depth)

    current_path = path + [product_id]

    bom = BillOfMaterials.query.filter_by(product_id=product_id, is_active=True).first()

    materials_by_id = {}
    sub_assemblies = []

    if not bom:
        # No BOM for this product at all. At the root call this means the
        # top-level product itself has no BOM - callers already handle that
        # as an explicit error before calling this function. At any deeper
        # level it just means this sub-assembly is a leaf (bought/stocked
        # as-is, not manufactured here) - nothing more to explode.
        return {'materials': [], 'sub_assemblies': []}

    for bom_item in bom.items:
        required_qty = scale_fn(bom_item, quantity, bom)

        if bom_item.material_id and bom_item.material_id in (_material_id_to_product_id or {}):
            # This line is stored as a material_id, but its Material.code
            # matches a Product that has its own active BOM - treat it as a
            # nested sub-assembly too, not a raw-material leaf. Stock is
            # checked on the Product side (product_id), since that's where
            # the real, movement-backed production stock lives - the
            # Material-side row for these is dummy seed data (deleted
            # 2026-08-20, had zero InventoryMovement/grn_id/created_by).
            mid = bom_item.material_id
            matched_product_id = _material_id_to_product_id[mid]
            current_stock = get_current_stock(product_id=matched_product_id)
            shortage = max(0.0, required_qty - current_stock)
            sub_bom = BillOfMaterials.query.filter_by(product_id=matched_product_id, is_active=True).first()

            sub_assemblies.append({
                'product_id': matched_product_id,
                'product_name': bom_item.material.name if bom_item.material else None,
                'required_quantity': required_qty,
                'current_stock': current_stock,
                'shortage_quantity': shortage,
                'has_own_bom': sub_bom is not None,
                'path': current_path,
                'matched_via': 'material_code',
                'children': None,
            })

            if sub_bom is not None:
                # Composition breakdown for tree-shaped callers (e.g. the
                # MRP shortage card) - always shown for a WIP that has its
                # own BOM, regardless of whether it's short, so the full
                # "what's this WIP made of" is visible, not just the parts
                # that are missing. Exploded against the full required_qty
                # (not just the shortfall) so it reflects the WIP's real
                # composition, not a procurement list.
                children_full = explode_bom_requirements(
                    matched_product_id, required_qty, scale_fn, extra_fn=extra_fn,
                    path=current_path, max_depth=max_depth, _material_id_to_product_id=_material_id_to_product_id
                )
                sub_assemblies[-1]['children'] = children_full

            if shortage > 0:
                logger.warning(
                    f"BOM explosion: material_id={mid} (code={bom_item.material.code if bom_item.material else '?'}) "
                    f"matched Product id={matched_product_id} via code - treated as nested sub-assembly (matched_via=material_code)"
                )
                if sub_bom is not None:
                    # Separate call against just the shortfall - only the
                    # shortfall needs producing, so this is what the 3 flat
                    # callers (auto-PO, dashboard, reservation) merge up.
                    nested = explode_bom_requirements(
                        matched_product_id, shortage, scale_fn, extra_fn=extra_fn,
                        path=current_path, max_depth=max_depth, _material_id_to_product_id=_material_id_to_product_id
                    )
                    for m in nested['materials']:
                        nmid = m['material_id']
                        if nmid not in materials_by_id:
                            materials_by_id[nmid] = {**m, 'required_quantity': 0.0}
                        materials_by_id[nmid]['required_quantity'] += m['required_quantity']
                    sub_assemblies.extend(nested['sub_assemblies'])

        elif bom_item.material_id:
            mid = bom_item.material_id
            if mid not in materials_by_id:
                materials_by_id[mid] = {
                    'material_id': mid,
                    'uom': bom_item.uom,
                    'material_name': bom_item.material.name if bom_item.material else None,
                    'required_quantity': 0.0,
                    'path': current_path,
                    **(extra_fn(bom_item) if extra_fn else {}),
                }
            materials_by_id[mid]['required_quantity'] += required_qty

        elif bom_item.product_id:
            sub_id = bom_item.product_id
            current_stock = get_current_stock(product_id=sub_id)
            shortage = max(0.0, required_qty - current_stock)
            sub_bom = BillOfMaterials.query.filter_by(product_id=sub_id, is_active=True).first()

            sub_assemblies.append({
                'product_id': sub_id,
                'product_name': bom_item.product.name if bom_item.product else None,
                'required_quantity': required_qty,
                'current_stock': current_stock,
                'shortage_quantity': shortage,
                'has_own_bom': sub_bom is not None,
                'path': current_path,
                'matched_via': None,
                'children': None,
            })

            if sub_bom is not None:
                # Always show the WIP's own composition (see comment on the
                # material_code-matched branch above), regardless of shortage.
                children_full = explode_bom_requirements(
                    sub_id, required_qty, scale_fn, extra_fn=extra_fn,
                    path=current_path, max_depth=max_depth, _material_id_to_product_id=_material_id_to_product_id
                )
                sub_assemblies[-1]['children'] = children_full

            if shortage > 0 and sub_bom is not None:
                # Only the shortfall needs producing - stock already on
                # hand covers the rest, don't over-explode. Separate call,
                # merged into the flat materials/sub_assemblies the other
                # 3 callers rely on.
                nested = explode_bom_requirements(sub_id, shortage, scale_fn, extra_fn=extra_fn, path=current_path, max_depth=max_depth, _material_id_to_product_id=_material_id_to_product_id)
                for m in nested['materials']:
                    mid = m['material_id']
                    if mid not in materials_by_id:
                        materials_by_id[mid] = {**m, 'required_quantity': 0.0}
                    materials_by_id[mid]['required_quantity'] += m['required_quantity']
                sub_assemblies.extend(nested['sub_assemblies'])
            elif shortage > 0 and sub_bom is None:
                # No BOM to explode further - treat the shortfall itself as
                # something to procure, same as a raw material leaf. Callers
                # that want this reflected in 'materials' can read
                # sub_assemblies where has_own_bom=False and shortage_quantity>0.
                pass

    return {
        'materials': list(materials_by_id.values()),
        'sub_assemblies': sub_assemblies,
    }
