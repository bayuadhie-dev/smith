"""
Fase 13 (fix_report_3.md, 2026-10-02): update_work_order()
(PUT /api/production/work-orders/<id>, routes/production.py) silently
dropped the 'batch_number' field - returned 200 "Work order updated" but
never persisted it. Same pattern as the Asset.machine_id bug
(fix_report_2.md Fase 11). Found while trying to disambiguate which
Inventory row create_shipping_from_qc() should deduct from (it matches
on WorkOrder.batch_number) during a real end-to-end production test.
"""
from datetime import date


def test_update_work_order_persists_batch_number(client, auth_headers, db_session, test_product):
    from models.production import WorkOrder

    wo = WorkOrder(
        wo_number='WO-F13-BATCHNUM-001', product_id=test_product.id, quantity=10,
        uom='PCS', status='planned',
    )
    db_session.add(wo)
    db_session.commit()
    assert wo.batch_number in (None, '')

    resp = client.put(f'/api/production/work-orders/{wo.id}', json={
        'batch_number': 'WO-F13-BATCHNUM-001',
    }, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    db_session.refresh(wo)
    assert wo.batch_number == 'WO-F13-BATCHNUM-001'
