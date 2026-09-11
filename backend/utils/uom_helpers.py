"""Helpers for populating models/uom.py's UoMConversion table from the
standard Excel item template's "Satuan #2/#3" + "Rasio Satuan #2/#3" columns.
Ratio direction confirmed against real Accurate data (see memory
project_uom_packaging_duplication): each ratio is independently relative to
the item's base/primary unit, not chained - "1 [satuan_besar] = rasio [satuan_dasar]"
(e.g. 1 ROL = 15000 PCS, 1 KRG = 25 KG)."""
from models import db
from models.uom import UnitOfMeasure, UoMConversion


def get_or_create_uom(code):
    """Find a UnitOfMeasure by code (case-insensitive), creating one if missing."""
    code = (code or '').strip().upper()
    if not code:
        return None
    unit = UnitOfMeasure.query.filter(db.func.upper(UnitOfMeasure.code) == code).first()
    if unit:
        return unit
    unit = UnitOfMeasure(code=code, name=code, category='unit')
    db.session.add(unit)
    db.session.flush()
    return unit


def upsert_item_uom_conversion(base_uom_code, big_uom_code, ratio, material_id=None, product_id=None):
    """1 [big_uom] = ratio [base_uom]. Creates both directions (matching
    routes/uom.py::create_conversion's own auto-reverse behavior), skips if
    an active conversion already exists for this exact (from, to, scope)."""
    if not big_uom_code or not ratio or float(ratio) <= 0:
        return None
    base_uom = get_or_create_uom(base_uom_code)
    big_uom = get_or_create_uom(big_uom_code)
    if not base_uom or not big_uom or base_uom.id == big_uom.id:
        return None

    existing = UoMConversion.query.filter_by(
        from_uom_id=big_uom.id, to_uom_id=base_uom.id,
        material_id=material_id, product_id=product_id,
    ).first()
    if existing:
        return existing

    conversion = UoMConversion(
        from_uom_id=big_uom.id, to_uom_id=base_uom.id,
        conversion_factor=float(ratio),
        material_id=material_id, product_id=product_id,
        notes='Diimpor dari Master Data Excel (Rasio Satuan)',
    )
    db.session.add(conversion)

    reverse_existing = UoMConversion.query.filter_by(
        from_uom_id=base_uom.id, to_uom_id=big_uom.id,
        material_id=material_id, product_id=product_id,
    ).first()
    if not reverse_existing:
        reverse = UoMConversion(
            from_uom_id=base_uom.id, to_uom_id=big_uom.id,
            conversion_factor=round(1.0 / float(ratio), 10),
            material_id=material_id, product_id=product_id,
            notes='Auto-reverse dari import Master Data Excel',
        )
        db.session.add(reverse)

    db.session.flush()
    return conversion


def upsert_item_uom_conversions_from_row(base_uom_code, satuan2, rasio2, satuan3, rasio3, material_id=None, product_id=None):
    """Convenience wrapper for the 2 optional (satuan/rasio) pairs the Excel
    template carries per item. Returns count of conversions created (0-2)."""
    created = 0
    if upsert_item_uom_conversion(base_uom_code, satuan2, rasio2, material_id, product_id):
        created += 1
    if upsert_item_uom_conversion(base_uom_code, satuan3, rasio3, material_id, product_id):
        created += 1
    return created
