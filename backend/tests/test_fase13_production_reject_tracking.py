"""
Fase 13 (fix_report_3.md, 2026-10-02): create_work_order_production_record()
(POST /api/production/work-orders/<id>/production-records) recorded
quantity_reject as a pure number (ShiftProduction.reject_quantity,
WorkOrder.quantity_scrap) with no physical trace at all - no Inventory
row, no WasteRecord, nothing to point to for where rejected goods
actually went. Found via a real end-to-end production test (800 rejected
pieces across 2 shifts, completely untracked).

Business rule (confirmed with owner 2026-10-02):
1. quantity_reject above 2% of quantity_produced triggers a warning.
2. waste_reason is mandatory whenever quantity_reject > 0.
3. Reject qty now lands in real Inventory (stock_status='reject') at the
   warehouse's reject zone, same pattern already used for GRN reject.

CORRECTED 2026-10-05 (fix_report_3.md Fase 20, found via live E2E
verification): rule 1 was originally a HARD BLOCK (400, nothing
persisted) - but real production shifts genuinely do sometimes exceed 2%
reject, and this made the ENTIRE shift's data (not just the reject
figure) silently unsaveable whenever that happened. Re-confirmed with
owner: downgraded to a non-blocking warning - the record (and its reject
Inventory) is now always saved; exceeding 2% only adds a
`warnings` entry in the response and a note on the record, it never
rejects the submission. test_reject_over_2_percent_rejected below is
renamed/rewritten accordingly.
"""
from models.production import Machine


def _setup_wo(db_session, test_product, quantity=1000):
    from models.production import WorkOrder
    machine = Machine(code='MC-F13-REJECT', name='Test Machine F13 Reject', machine_type='test', status='active')
    db_session.add(machine)
    db_session.commit()
    wo = WorkOrder(
        wo_number='WO-F13-REJECT-001', product_id=test_product.id, quantity=quantity, uom='PCS',
        status='in_progress', machine_id=machine.id,
    )
    db_session.add(wo)
    db_session.commit()
    return wo


def test_reject_without_reason_rejected(client, auth_headers, db_session, test_product):
    wo = _setup_wo(db_session, test_product)
    resp = client.post(f'/api/production/work-orders/{wo.id}/production-records', json={
        'quantity_produced': 100, 'quantity_good': 99, 'quantity_reject': 1, 'shift': '1',
    }, headers=auth_headers)
    assert resp.status_code == 400
    assert 'waste_reason' in resp.get_json()['error']


def test_reject_over_2_percent_warns_but_still_saves(client, auth_headers, db_session, test_product):
    """Was a hard 400 block that silently discarded the ENTIRE shift's
    production data (not just the reject figure) whenever real reject
    exceeded 2% - a genuine production scenario (machine fault, bad raw
    material lot). Corrected: always saves, just flags a warning."""
    from models.warehouse import Inventory, WarehouseZone, WarehouseLocation

    reject_zone = WarehouseZone(code='Z-F20-REJECT', name='Gudang Reject F20', zone_type='reject', material_type='all')
    db_session.add(reject_zone)
    db_session.commit()
    db_session.add(WarehouseLocation(
        zone_id=reject_zone.id, location_code='LOC-F20-REJECT', rack='R1', level='L1', position='P1',
        capacity=1000, capacity_uom='pcs',
    ))
    db_session.commit()

    wo = _setup_wo(db_session, test_product)
    resp = client.post(f'/api/production/work-orders/{wo.id}/production-records', json={
        'quantity_produced': 100, 'quantity_good': 95, 'quantity_reject': 5, 'shift': '1',
        'waste_reason': 'Mesin macet',
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()
    data = resp.get_json()
    assert len(data['warnings']) == 1
    assert '2%' in data['warnings'][0]

    # The full shift's data was actually persisted, not discarded.
    assert data['work_order_progress']['quantity_produced'] == 100.0
    assert data['work_order_progress']['quantity_good'] == 95.0

    reject_inv = Inventory.query.filter_by(
        product_id=test_product.id, stock_status='reject',
    ).order_by(Inventory.id.desc()).first()
    assert reject_inv is not None
    assert float(reject_inv.quantity_on_hand) == 5.0


def test_reject_within_2_percent_creates_reject_inventory(client, auth_headers, db_session, test_product):
    from models.warehouse import Inventory, WarehouseZone, WarehouseLocation

    reject_zone = WarehouseZone(code='Z-F13-REJECT', name='Gudang Reject F13', zone_type='reject', material_type='all')
    db_session.add(reject_zone)
    db_session.commit()
    db_session.add(WarehouseLocation(
        zone_id=reject_zone.id, location_code='LOC-F13-REJECT', rack='R1', level='L1', position='P1',
        capacity=1000, capacity_uom='pcs',
    ))
    db_session.commit()

    wo = _setup_wo(db_session, test_product)
    resp = client.post(f'/api/production/work-orders/{wo.id}/production-records', json={
        'quantity_produced': 100, 'quantity_good': 98, 'quantity_reject': 2, 'shift': '1',
        'waste_reason': 'Cacat cetak',
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    reject_inv = Inventory.query.filter_by(
        product_id=test_product.id, stock_status='reject',
    ).order_by(Inventory.id.desc()).first()
    assert reject_inv is not None
    assert float(reject_inv.quantity_on_hand) == 2.0


def test_zero_reject_does_not_require_reason(client, auth_headers, db_session, test_product):
    wo = _setup_wo(db_session, test_product)
    resp = client.post(f'/api/production/work-orders/{wo.id}/production-records', json={
        'quantity_produced': 100, 'quantity_good': 100, 'quantity_reject': 0, 'shift': '1',
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()
