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
