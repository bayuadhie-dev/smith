"""
Fase 13 (fix_report_3.md, 2026-10-02): requeue_insufficient_items()
(utils/auto_reserve.py) already retries FIFO reservation for
MaterialIssueItem rows stuck at reservation_status='insufficient', but was
only wired into the GRN-receipt and approval-workflow paths - the manual
warehouse stock-in endpoint (POST /warehouse/inventory/add) never called
it, and there was no on-demand API trigger either. Found via a real
production test: a material issue stayed stuck at 'approved'/
reservation_status='insufficient' even after adding enough raw material
stock manually through that endpoint.

Fixed: POST /warehouse/inventory/add now calls requeue_insufficient_items()
(best-effort), and a new dedicated endpoint
POST /production/material-issues/retry-insufficient exposes it directly.
"""
from datetime import date


def _setup_insufficient_material_issue(db_session, test_material, test_user):
    from models.material_issue import MaterialIssue, MaterialIssueItem

    mi = MaterialIssue(
        issue_number='MI-TEST-F13-RETRY', trigger_source='manual', status='approved',
        requested_by=test_user.id,
    )
    db_session.add(mi)
    db_session.flush()
    item = MaterialIssueItem(
        material_issue_id=mi.id, line_number=1, material_id=test_material.id,
        description=test_material.name, required_quantity=50, issued_quantity=0,
        uom='KG', status='pending', reservation_status='insufficient', reserved_quantity=0,
    )
    db_session.add(item)
    db_session.commit()
    return mi, item


def test_add_to_inventory_retries_insufficient_material_issue_for_existing_available_row(client, auth_headers, db_session, test_material, test_user):
    """add_to_inventory()'s retry wiring matters for topping up a row that's
    ALREADY 'available' (e.g. stock correction/opname-adjacent manual add) -
    a brand-new row is quarantine by default (erp_approval defaults True,
    see the QC-release test below for that path) so wouldn't exercise this."""
    from models.warehouse import WarehouseZone, WarehouseLocation, Inventory

    mi, item = _setup_insufficient_material_issue(db_session, test_material, test_user)
    assert item.reservation_status == 'insufficient'

    zone = WarehouseZone(code='Z-F13-RETRY', name='Zone Retry F13', material_type='raw_materials')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code='LOC-F13-RETRY', rack='R1', level='L1', position='P1',
        capacity=10000, capacity_uom='kg',
    )
    db_session.add(location)
    db_session.commit()
    existing_inv = Inventory(
        material_id=test_material.id, location_id=location.id,
        quantity_on_hand=10, quantity_available=10, quantity_reserved=0,
        stock_status='available',
    )
    db_session.add(existing_inv)
    db_session.commit()

    response = client.post('/api/warehouse/inventory/add', json={
        'material_id': test_material.id,
        'location_id': location.id,
        'quantity': 100,
    }, headers=auth_headers)
    assert response.status_code == 201, response.get_json()

    db_session.refresh(item)
    assert item.reservation_status == 'full'
    assert float(item.reserved_quantity) == 50.0


def test_qc_release_retries_insufficient_material_issue(client, auth_headers, db_session, test_material, test_user):
    """The realistic path for brand-new stock: erp_approval defaults True
    so it's born 'quarantine' - the retry must fire when QC releases it,
    not just when it's added."""
    from models.warehouse import WarehouseZone, WarehouseLocation, Inventory

    mi, item = _setup_insufficient_material_issue(db_session, test_material, test_user)
    assert item.reservation_status == 'insufficient'

    zone = WarehouseZone(code='Z-F13-QCRETRY', name='Zone QC Retry F13', material_type='raw_materials')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code='LOC-F13-QCRETRY', rack='R1', level='L1', position='P1',
        capacity=10000, capacity_uom='kg',
    )
    db_session.add(location)
    db_session.commit()
    inv = Inventory(
        material_id=test_material.id, location_id=location.id,
        quantity_on_hand=100, quantity_available=100, quantity_reserved=0,
        stock_status='quarantine',
    )
    db_session.add(inv)
    db_session.commit()

    response = client.put(f'/api/qc-batch-status/batches/{inv.id}/status', json={
        'new_status': 'available',
        'reason': 'QC lolos',
    }, headers=auth_headers)
    assert response.status_code == 200, response.get_json()

    db_session.refresh(item)
    assert item.reservation_status == 'full'
    assert float(item.reserved_quantity) == 50.0


def test_manual_retry_endpoint_resolves_insufficient_item(client, auth_headers, db_session, test_material, test_user):
    from models.warehouse import WarehouseZone, WarehouseLocation, Inventory

    mi, item = _setup_insufficient_material_issue(db_session, test_material, test_user)

    zone = WarehouseZone(code='Z-F13-RETRY2', name='Zone Retry F13 B', material_type='raw_materials')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code='LOC-F13-RETRY2', rack='R1', level='L1', position='P1',
        capacity=10000, capacity_uom='kg',
    )
    db_session.add(location)
    db_session.commit()
    # Stock added directly to the model (bypassing the warehouse endpoint,
    # which already auto-retries) to prove the DEDICATED retry endpoint
    # itself works independently.
    inv = Inventory(
        material_id=test_material.id, location_id=location.id,
        quantity_on_hand=100, quantity_available=100, quantity_reserved=0,
        stock_status='available',
    )
    db_session.add(inv)
    db_session.commit()

    response = client.post('/api/production/material-issues/retry-insufficient', json={}, headers=auth_headers)
    assert response.status_code == 200, response.get_json()
    data = response.get_json()['data']
    assert any(r['issue_number'] == mi.issue_number for r in data['resolved'])

    db_session.refresh(item)
    assert item.reservation_status == 'full'
