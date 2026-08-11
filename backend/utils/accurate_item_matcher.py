"""
Exact-name matching antara item Accurate dan SMITH (materials + products).

Strategi: exact match pada nama yang di-uppercase + trim. Kalau ada duplikat
nama di sisi SMITH (materials punya beberapa baris duplikat), pilih yang
created_at paling baru.
"""
from models import db
from models.product import Material, Product


def find_smith_match(item_name: str):
    """
    Cari baris SMITH (materials atau products) yang namanya exact match
    (uppercase + trim) dengan item_name dari Accurate.

    Jika ada >1 match di tabel yang sama, pilih created_at paling baru.
    materials dicek duluan, lalu products.

    Returns:
        dict {'table': 'materials'|'products', 'id': int} atau None kalau
        tidak ada match sama sekali.
    """
    name_norm = (item_name or '').strip().upper()
    if not name_norm:
        return None

    mat_matches = (
        Material.query
        .filter(db.func.upper(db.func.trim(Material.name)) == name_norm)
        .order_by(Material.created_at.desc())
        .all()
    )
    if mat_matches:
        return {'table': 'materials', 'id': mat_matches[0].id}

    prod_matches = (
        Product.query
        .filter(db.func.upper(db.func.trim(Product.name)) == name_norm)
        .order_by(Product.created_at.desc())
        .all()
    )
    if prod_matches:
        return {'table': 'products', 'id': prod_matches[0].id}

    return None
