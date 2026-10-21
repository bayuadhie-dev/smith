"""
Fase 16 (fix_report_3.md, 2026-10-02): GET /api/warehouse/inventory's
`stock_status` query param's own code comment always said "released,
quarantine, reject" but the implementation only ever checked 3
quantity-derived pseudo-values ('available'/'out_of_stock'/'low_stock') -
there was no way to filter by the REAL Inventory.stock_status field
(quarantine/reject/released) at all. Found while making sure the new
production-reject Inventory rows (Fase 15) are actually reachable/
drill-down-able from the frontend inventory list.
"""
from models.warehouse import WarehouseZone, WarehouseLocation, Inventory


def _setup_items(db_session, test_product):
    zone = WarehouseZone(code='Z-F16', name='Zone F16', material_type='finished_goods')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(zone_id=zone.id, location_code='LOC-F16', rack='R1', level='L1', position='P1', capacity=1000, capacity_uom='pcs')
    db_session.add(location)
    db_session.commit()

    released = Inventory(product_id=test_product.id, location_id=location.id, quantity_on_hand=10, quantity_available=10, stock_status='released')
    quarantine = Inventory(product_id=test_product.id, location_id=location.id, batch_number='Q1', quantity_on_hand=5, quantity_available=5, stock_status='quarantine')
    reject = Inventory(product_id=test_product.id, location_id=location.id, batch_number='R1', quantity_on_hand=2, quantity_available=2, stock_status='reject')
    db_session.add_all([released, quarantine, reject])
    db_session.commit()
    return released, quarantine, reject


def test_filter_by_reject_status_finds_only_reject_rows(client, auth_headers, db_session, test_product):
    released, quarantine, reject = _setup_items(db_session, test_product)

    resp = client.get('/api/warehouse/inventory', query_string={'stock_status': 'reject', 'product_id': test_product.id}, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    items = resp.get_json()['inventory']
    ids = {i['id'] for i in items}
    assert reject.id in ids
    assert released.id not in ids
    assert quarantine.id not in ids


def test_filter_by_quarantine_status_finds_only_quarantine_rows(client, auth_headers, db_session, test_product):
    released, quarantine, reject = _setup_items(db_session, test_product)

    resp = client.get('/api/warehouse/inventory', query_string={'stock_status': 'quarantine', 'product_id': test_product.id}, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    items = resp.get_json()['inventory']
    ids = {i['id'] for i in items}
    assert quarantine.id in ids
    assert released.id not in ids
    assert reject.id not in ids


def test_quantity_based_pseudo_filters_still_work(client, auth_headers, db_session, test_product):
    """Regression guard: the 3 quantity-based filters already relied on by
    existing callers must keep working exactly as before."""
    from models.warehouse import WarehouseZone, WarehouseLocation, Inventory

    zone = WarehouseZone(code='Z-F16B', name='Zone F16B', material_type='finished_goods')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(zone_id=zone.id, location_code='LOC-F16B', rack='R1', level='L1', position='P1', capacity=1000, capacity_uom='pcs')
    db_session.add(location)
    db_session.commit()
    out_of_stock = Inventory(product_id=test_product.id, location_id=location.id, quantity_on_hand=0, quantity_available=0, stock_status='released')
    db_session.add(out_of_stock)
    db_session.commit()

    resp = client.get('/api/warehouse/inventory', query_string={'stock_status': 'out_of_stock', 'product_id': test_product.id}, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    ids = {i['id'] for i in resp.get_json()['inventory']}
    assert out_of_stock.id in ids
