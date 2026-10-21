"""
Tests for routes/products.py's /product-categories endpoint (2026-10-07) -
continuation of the system-wide fabricated-data sweep. The real, routed
"Kategori Produk" CRUD page (ProductCategories.tsx) used to call
GET /api/products/categories, which collides with an UNRELATED static
nonwoven spec-range lookup registered at the same path (gsm/width/length
ranges, not a category CRUD list at all) - this rendered as "Products: NaN"
/ "Total Value: RpNaN" on every category card live in production. The real
endpoint is /product-categories, which previously only returned
id/code/name/description - missing the is_active/parent_id/parent_name/
product_count/total_value/created_at/updated_at fields the frontend needs.
"""
from datetime import date


def test_product_categories_includes_fields_frontend_needs(client, auth_headers, db_session):
    from models.product import ProductCategory

    cat = ProductCategory(code='CAT-TEST-01', name='Test Category', is_active=True)
    db_session.add(cat)
    db_session.commit()

    resp = client.get('/api/products/product-categories', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()

    row = next((c for c in data['categories'] if c['code'] == 'CAT-TEST-01'), None)
    assert row is not None
    assert row['product_count'] == 0
    assert row['total_value'] == 0
    assert row['is_active'] is True
    assert 'created_at' in row


def test_product_categories_product_count_is_real(client, auth_headers, db_session, test_product):
    from models.product import ProductCategory

    cat = ProductCategory(code='CAT-TEST-02', name='Test Category 2', is_active=True)
    db_session.add(cat)
    db_session.commit()

    test_product.category_id = cat.id
    db_session.commit()

    resp = client.get('/api/products/product-categories', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()

    row = next((c for c in data['categories'] if c['code'] == 'CAT-TEST-02'), None)
    assert row is not None
    assert row['product_count'] == 1


def test_categories_url_still_serves_nonwoven_spec_lookup(client):
    """The OLD url (/api/products/categories, no auth required) must keep
    serving the unrelated nonwoven spec-range lookup unchanged - other
    callers (GSM calculator etc) depend on it; only the frontend's CRUD
    page needed to move to the correct URL, not the endpoint itself."""
    resp = client.get('/api/products/categories')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'categories' in data
    if data['categories']:
        assert 'gsm_range' in data['categories'][0]
