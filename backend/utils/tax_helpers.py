"""PPN (Indonesian VAT) code -> rate mapping, from the standard Accurate
"Barang & Jasa" item template's PPN column. Confirmed by user 2026-09-09:
  Y = 11%, A = 1.1%, B = 1.2%, L = 12%
A/B are reduced "nilai lain" rates used for specific goods/service categories
(not the standard rate), L is the newer 12% rate."""

PPN_RATE_MAP = {
    'Y': 11.0,
    'A': 1.1,
    'B': 1.2,
    'L': 12.0,
}


def ppn_rate_for_code(ppn_code):
    """Returns the tax rate percentage for a PPN code, or None if unknown/blank."""
    if not ppn_code:
        return None
    return PPN_RATE_MAP.get(str(ppn_code).strip().upper())


def resolve_item_tax_percent(explicit_percent, product_id=None, material_id=None):
    """Auto-derives a line item's PPN rate from its Product/Material's
    ppn_code master-data field, when the caller didn't explicitly send one.

    Before this helper existed, ppn_code was stored on every item's master
    data but never actually consulted anywhere - Sales Order/Invoice items
    defaulted tax_percent to 0 (or a flat manually-typed 11% on the Invoice
    form), regardless of whether that specific item's real PPN code was
    Y/A/B/L (11%/1.1%/1.2%/12%). This only kicks in when the caller hasn't
    already provided a real rate, so explicit manual entries are never
    silently overridden.
    """
    if explicit_percent:
        return explicit_percent

    ppn_code = None
    if product_id:
        from models.product import Product
        product = Product.query.get(product_id)
        ppn_code = product.ppn_code if product else None
    elif material_id:
        from models.product import Material
        material = Material.query.get(material_id)
        ppn_code = material.ppn_code if material else None

    rate = ppn_rate_for_code(ppn_code)
    return rate if rate is not None else (explicit_percent or 0)
