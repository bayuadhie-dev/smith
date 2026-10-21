"""
Fase 13 (fix_report_3.md, 2026-10-02): _check_batch_closing_requirements()
(routes/production.py, gate for PUT /batches/<id>/close - "Tutup Batch")
only checked that WorkOrderBOMItem.quantity_actual was FILLED IN, never
whether the material was actually physically issued from the warehouse
(MaterialIssue/MaterialIssueItem). Found via a real end-to-end production
test: a Work Order was fully completed, shipped and invoice-paid while
every one of its 13 BOM materials sat at MaterialIssue.status='approved'
with issued_quantity=0 the entire time - nothing was ever physically
pulled from stock.

Fix: the gate now also requires every MaterialIssueItem tied to this
batch (via MaterialIssue.production_batch_id) to have issued_quantity
covering required_quantity (small tolerance for float accumulation
rounding - see issue_materials()'s own float arithmetic).
"""
from datetime import date


def _setup_batch_with_bom_item(db_session, test_product, test_material, quantity_actual=10):
    from models.production import WorkOrder
    from models.batch_scheduling import ProductionBatch, ProductionRecipe
    from models.work_order_bom import WorkOrderBOMItem
    from models.production import Machine

    machine = Machine(code='MC-F13A', name='Test Machine F13A', machine_type='test', status='active')
    db_session.add(machine)
    db_session.commit()

    wo = WorkOrder(
        wo_number='WO-F13-CLOSE-001', product_id=test_product.id, quantity=10, uom='PCS',
        status='in_progress', machine_id=machine.id,
    )
    db_session.add(wo)
    db_session.commit()

    recipe = ProductionRecipe(product_id=test_product.id, machine_id=machine.id, batch_size=10, rate_per_hour=10, is_default=True, is_active=True)
    db_session.add(recipe)
    db_session.commit()

    batch = ProductionBatch(
        batch_number='TEST-F13-001', work_order_id=wo.id, machine_id=machine.id, recipe_id=recipe.id,
        scheduled_date=date.today(), shift_number=1, sequence_in_shift=1, planned_qty=10, status='approved',
    )
    db_session.add(batch)
    db_session.commit()

    bom_item = WorkOrderBOMItem(
        work_order_id=wo.id, production_batch_id=batch.id, line_number=1,
        material_id=test_material.id, item_name=test_material.name, item_type='material',
        quantity_per_unit=1, uom='KG', quantity_planned=10, quantity_actual=quantity_actual,
        unit_cost=1000, total_cost_planned=10000,
    )
    db_session.add(bom_item)
    db_session.commit()

    return wo, batch, bom_item


def _make_material_issue(db_session, batch, test_material, test_user, required=10, issued=0):
    from models.material_issue import MaterialIssue, MaterialIssueItem

    mi = MaterialIssue(
        issue_number=f'MI-TEST-{batch.id}', work_order_id=batch.work_order_id,
        production_batch_id=batch.id, trigger_source='spk', status='approved',
        requested_by=test_user.id,
    )
    db_session.add(mi)
    db_session.flush()

    item = MaterialIssueItem(
        material_issue_id=mi.id, line_number=1, material_id=test_material.id,
        description=test_material.name, required_quantity=required, issued_quantity=issued,
        uom='KG', status='issued' if issued >= required else 'pending',
    )
    db_session.add(item)
    db_session.commit()
    return mi, item


def test_close_batch_blocked_when_material_never_issued(client, auth_headers, db_session, test_product, test_material, test_user):
    wo, batch, bom_item = _setup_batch_with_bom_item(db_session, test_product, test_material)
    _make_material_issue(db_session, batch, test_material, test_user, required=10, issued=0)

    resp = client.put(f'/api/production/batches/{batch.id}/close', headers=auth_headers)
    assert resp.status_code == 400, resp.get_json()
    assert any('belum benar-benar dikeluarkan' in m for m in resp.get_json()['missing'])


def test_close_batch_blocked_when_no_material_issue_at_all(client, auth_headers, db_session, test_product, test_material):
    wo, batch, bom_item = _setup_batch_with_bom_item(db_session, test_product, test_material)
    # No MaterialIssue created for this batch at all.

    resp = client.put(f'/api/production/batches/{batch.id}/close', headers=auth_headers)
    assert resp.status_code == 400, resp.get_json()
    assert any('Belum ada Material Issue' in m for m in resp.get_json()['missing'])


def test_close_batch_succeeds_when_material_fully_issued(client, auth_headers, db_session, test_product, test_material, test_user):
    wo, batch, bom_item = _setup_batch_with_bom_item(db_session, test_product, test_material)
    _make_material_issue(db_session, batch, test_material, test_user, required=10, issued=10)

    resp = client.put(f'/api/production/batches/{batch.id}/close', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()


def test_close_batch_succeeds_with_tiny_float_rounding_short(client, auth_headers, db_session, test_product, test_material, test_user):
    """issued_quantity landing a hair below required_quantity from float
    accumulation (not an actual shortfall) must not block closing."""
    wo, batch, bom_item = _setup_batch_with_bom_item(db_session, test_product, test_material)
    _make_material_issue(db_session, batch, test_material, test_user, required=10, issued=9.9999)

    resp = client.put(f'/api/production/batches/{batch.id}/close', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
