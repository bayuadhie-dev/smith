"""
Fase 5 (audit 29 Sept 2026): WIPWorkflowIntegration.create_material_cost_entry()
di models/wip_job_costing.py menghitung estimated_material_cost = qty WO x
SystemSetting 'job_costing.material_cost_per_unit' (fallback hardcoded
50.000), tidak pernah query BOM sama sekali.

Keputusan pemilik (dikonfirmasi sebelum kode ditulis): sumber BOM yang
otoritatif adalah WorkOrderBOMItem (dipakai alur produksi riil), BUKAN
tabel BOM master (BillOfMaterials/BOMItem).

Diverifikasi lewat endpoint HTTP asli
(POST /api/wip/wip-batches/create-from-work-order).
"""
from datetime import date


def _create_work_order(db_session, product, quantity=10):
    from models.production import WorkOrder
    wo = WorkOrder(
        wo_number=f'WO-JC-TEST-{product.id}-{quantity}', product_id=product.id,
        quantity=quantity, uom='PCS', status='released', required_date=date.today(),
    )
    db_session.add(wo)
    db_session.commit()
    return wo


def test_job_costing_uses_bom_when_fully_costed(client, auth_headers, db_session, test_product, test_material):
    wo = _create_work_order(db_session, test_product, quantity=10)

    from models.work_order_bom import WorkOrderBOMItem
    bom_item = WorkOrderBOMItem(
        work_order_id=wo.id, line_number=1, material_id=test_material.id,
        item_name=test_material.name, quantity_per_unit=2, uom='KG',
        quantity_planned=20, unit_cost=5000, total_cost_planned=100000,
    )
    db_session.add(bom_item)
    db_session.commit()

    resp = client.post('/api/wip/wip-batches/create-from-work-order', json={
        'work_order_id': wo.id,
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    from models.wip_job_costing import JobCostEntry
    job_cost = JobCostEntry.query.filter_by(work_order_id=wo.id, cost_type='material').first()
    assert job_cost is not None
    assert float(job_cost.total_cost) == 100000.0, "Biaya material harus dari BOM (100.000), bukan angka tetap"
    assert job_cost.is_cost_incomplete is False


def test_job_costing_flags_incomplete_when_bom_has_no_cost(client, auth_headers, db_session, test_product, test_material):
    wo = _create_work_order(db_session, test_product, quantity=10)

    from models.work_order_bom import WorkOrderBOMItem
    bom_item = WorkOrderBOMItem(
        work_order_id=wo.id, line_number=1, material_id=test_material.id,
        item_name=test_material.name, quantity_per_unit=2, uom='KG',
        quantity_planned=20, unit_cost=0, total_cost_planned=None,
    )
    db_session.add(bom_item)
    db_session.commit()

    resp = client.post('/api/wip/wip-batches/create-from-work-order', json={
        'work_order_id': wo.id,
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    from models.wip_job_costing import JobCostEntry
    job_cost = JobCostEntry.query.filter_by(work_order_id=wo.id, cost_type='material').first()
    assert job_cost is not None
    assert job_cost.is_cost_incomplete is True, "BOM ada tapi unit_cost 0 - harus ditandai tidak lengkap"
    assert 'PERINGATAN' in job_cost.description


def test_job_costing_flags_incomplete_when_no_bom(client, auth_headers, db_session, test_product):
    wo = _create_work_order(db_session, test_product, quantity=10)

    resp = client.post('/api/wip/wip-batches/create-from-work-order', json={
        'work_order_id': wo.id,
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    from models.wip_job_costing import JobCostEntry
    job_cost = JobCostEntry.query.filter_by(work_order_id=wo.id, cost_type='material').first()
    assert job_cost is not None
    assert job_cost.is_cost_incomplete is True, "Tidak ada BOM sama sekali - harus ditandai tidak lengkap"
    assert 'PERINGATAN' in job_cost.description
