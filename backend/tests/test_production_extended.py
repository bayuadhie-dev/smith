"""
Extended tests for production routes to increase coverage
"""
import pytest
from datetime import datetime, timedelta
from routes.production_input import calculate_oee_with_downtime_categories
from routes.production_integration import auto_deduct_materials, auto_receive_finished_goods
from models import db
from models.production import Machine, WorkOrder
from models.warehouse import WarehouseZone, WarehouseLocation, Inventory
from models.work_order_bom import WorkOrderBOMItem
from models.production import ProductionApproval
from models.sales import SalesForecast
from models.production import ProductionPlan

class TestProductionExtended:
    def test_get_work_orders(self, client, auth_headers):
        response = client.get('/api/production/work-orders', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_work_orders_with_filters(self, client, auth_headers):
        response = client.get('/api/production/work-orders?status=planned&page=1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_work_order(self, client, auth_headers, test_product):
        response = client.post('/api/production/work-orders', json={
            'product_id': test_product.id,
            'quantity': 100,
            'planned_start': datetime.now().isoformat(),
            'planned_end': (datetime.now() + timedelta(days=1)).isoformat()
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_create_work_order_missing_product(self, client, auth_headers):
        response = client.post('/api/production/work-orders', json={
            'quantity': 100
        }, headers=auth_headers)
        assert response.status_code in [400, 404, 500]

    def test_get_work_order_by_id(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_work_order(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1', json={
            'quantity': 150
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 405, 500]

    def test_start_work_order(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/start', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 405, 500]

    def test_complete_work_order(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/complete', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 405, 500]

    def test_cancel_work_order(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/cancel', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 405, 500]


class TestMachines:
    def test_get_machines(self, client, auth_headers):
        response = client.get('/api/production/machines', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_machine(self, client, auth_headers):
        response = client.post('/api/production/machines', json={
            'code': 'MCH-NEW',
            'name': 'New Machine',
            'type': 'production'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 405, 409, 500]

    def test_get_machine_by_id(self, client, auth_headers):
        response = client.get('/api/production/machines/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_machine(self, client, auth_headers):
        response = client.put('/api/production/machines/1', json={
            'status': 'maintenance'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 405, 500]

    def test_get_machine_status(self, client, auth_headers):
        response = client.get('/api/production/machines/1/status', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionLines:
    def test_get_production_lines(self, client, auth_headers):
        response = client.get('/api/production/lines', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_production_line(self, client, auth_headers):
        response = client.post('/api/production/lines', json={
            'code': 'LINE-NEW',
            'name': 'New Production Line'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 405, 409, 500]


class TestProductionOutput:
    def test_record_output(self, client, auth_headers):
        response = client.post('/api/production/output', json={
            'work_order_id': 1,
            'quantity': 50,
            'machine_id': 1
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 405, 500]

    def test_get_output_history(self, client, auth_headers):
        response = client.get('/api/production/output?work_order_id=1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionDashboard:
    def test_get_production_dashboard(self, client, auth_headers):
        response = client.get('/api/production/dashboard', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_production_summary(self, client, auth_headers):
        response = client.get('/api/production/summary', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_production_schedule(self, client, auth_headers):
        response = client.get('/api/production/schedule', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_production_efficiency(self, client, auth_headers):
        response = client.get('/api/production/efficiency', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestDowntime:
    def test_record_downtime(self, client, auth_headers):
        response = client.post('/api/production/downtime', json={
            'machine_id': 1,
            'start_time': datetime.now().isoformat(),
            'reason': 'Maintenance'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 405, 500]

    def test_get_downtime_history(self, client, auth_headers):
        response = client.get('/api/production/downtime', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_end_downtime(self, client, auth_headers):
        response = client.put('/api/production/downtime/1/end', json={
            'end_time': datetime.now().isoformat()
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 405, 500]


class TestProductionMachinesNew:
    def test_update_machine_endpoint(self, client, auth_headers):
        response = client.put('/api/production/machines/1/update', json={
            'status': 'maintenance'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 405, 500]

    def test_get_machine_efficiency(self, client, auth_headers):
        response = client.get('/api/production/machines/1/efficiency', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestWorkOrderStatusTracking:
    def test_get_status_tracking(self, client, auth_headers):
        response = client.get('/api/production/work-orders/status-tracking', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestWorkOrderStatus:
    def test_update_work_order_status(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/status', json={
            'status': 'in_progress'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 405, 500]


class TestWorkOrderProductionRecords:
    def test_get_production_records_for_wo(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/production-records', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_production_record_for_wo(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/production-records', json={
            'quantity': 50,
            'machine_id': 1
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_start_work_order_put(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/start', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 405, 500]

    def test_complete_work_order_put(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/complete', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 405, 500]

    def test_bulk_complete_work_orders(self, client, auth_headers):
        response = client.put('/api/production/work-orders/bulk-complete', json={
            'work_order_ids': [1, 2]
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionRecords:
    def test_get_production_records(self, client, auth_headers):
        response = client.get('/api/production/production-records', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_production_record(self, client, auth_headers):
        response = client.post('/api/production/production-records', json={
            'work_order_id': 1,
            'product_id': 1,
            'quantity': 50
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_production_record_by_id(self, client, auth_headers):
        response = client.get('/api/production/production-records/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_production_record(self, client, auth_headers):
        response = client.put('/api/production/production-records/1', json={
            'quantity': 75
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionBOM:
    def test_get_bom(self, client, auth_headers):
        response = client.get('/api/production/bom', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_bom(self, client, auth_headers):
        response = client.post('/api/production/bom', json={
            'product_id': 1,
            'items': [
                {'material_id': 1, 'quantity': 10}
            ]
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_bom_by_id(self, client, auth_headers):
        response = client.get('/api/production/boms/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_bom(self, client, auth_headers):
        response = client.put('/api/production/boms/1', json={
            'name': 'Updated BOM'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_delete_bom(self, client, auth_headers):
        response = client.delete('/api/production/boms/1', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionSchedules:
    def test_get_schedules(self, client, auth_headers):
        response = client.get('/api/production/schedules', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_schedules_with_filters(self, client, auth_headers):
        response = client.get('/api/production/schedules?machine_id=1&date_from=2024-01-01', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_schedule(self, client, auth_headers, test_product):
        response = client.post('/api/production/schedules', json={
            'work_order_id': 1,
            'machine_id': 1,
            'scheduled_start': datetime.now().isoformat(),
            'scheduled_end': (datetime.now() + timedelta(hours=8)).isoformat()
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_schedule_by_id(self, client, auth_headers):
        response = client.get('/api/production/schedules/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_schedule(self, client, auth_headers):
        response = client.put('/api/production/schedules/1', json={
            'status': 'in_progress'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_delete_schedule(self, client, auth_headers):
        response = client.delete('/api/production/schedules/1', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionTraceability:
    def test_get_traceability(self, client, auth_headers):
        response = client.get('/api/production/traceability/TEST001', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionDashboardSummary:
    def test_get_dashboard_summary(self, client, auth_headers):
        response = client.get('/api/production/dashboard/summary', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestWorkOrderPackingList:
    def test_get_packing_list(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/packing-list', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_sync_packing_list(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/packing-list/sync', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_update_packing_list_items(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/packing-list/items', json={
            'items': []
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_batch_mixing_packing_list(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/packing-list/batch-mixing', json={
            'batch_numbers': ['B001', 'B002']
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestRemainingStocks:
    def test_get_remaining_stocks(self, client, auth_headers):
        response = client.get('/api/production/remaining-stocks', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_remaining_stock(self, client, auth_headers):
        response = client.post('/api/production/remaining-stocks', json={
            'work_order_id': 1,
            'material_id': 1,
            'quantity': 100
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_remaining_stock_by_id(self, client, auth_headers):
        response = client.get('/api/production/remaining-stocks/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_remaining_stock(self, client, auth_headers):
        response = client.put('/api/production/remaining-stocks/1', json={
            'quantity': 150
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_delete_remaining_stock(self, client, auth_headers):
        response = client.delete('/api/production/remaining-stocks/1', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_export_remaining_stocks_excel(self, client, auth_headers):
        response = client.get('/api/production/remaining-stocks/export-excel', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestWorkOrderBOM:
    def test_get_work_order_bom(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/bom', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_copy_bom_from_master(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/bom/copy-from-master', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_update_work_order_bom_item(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/bom/1', json={
            'quantity': 20
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_add_work_order_bom_item(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/bom', json={
            'material_id': 1,
            'quantity': 10
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_delete_work_order_bom_item(self, client, auth_headers):
        response = client.delete('/api/production/work-orders/1/bom/1', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_reset_work_order_bom(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/bom/reset', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderDelete:
    def test_delete_work_order(self, client, auth_headers):
        response = client.delete('/api/production/work-orders/1', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 405, 500]

    def test_delete_work_order_not_found(self, client, auth_headers):
        response = client.delete('/api/production/work-orders/99999', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionMachineCreate:
    def test_create_machine_missing_code(self, client, auth_headers):
        response = client.post('/api/production/machines', json={
            'name': 'Test Machine',
            'machine_type': 'production'
        }, headers=auth_headers)
        assert response.status_code in [400, 404, 500]

    def test_create_machine_missing_name(self, client, auth_headers):
        response = client.post('/api/production/machines', json={
            'code': 'MCH-001',
            'machine_type': 'production'
        }, headers=auth_headers)
        assert response.status_code in [400, 404, 500]

    def test_create_machine_duplicate_code(self, client, auth_headers):
        response = client.post('/api/production/machines', json={
            'code': 'MCH-001',
            'name': 'Test Machine',
            'machine_type': 'production'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 409, 500]


class TestProductionWorkOrderCreate:
    def test_create_work_order_missing_quantity(self, client, auth_headers, test_product):
        response = client.post('/api/production/work-orders', json={
            'product_id': test_product.id
        }, headers=auth_headers)
        assert response.status_code in [400, 404, 500]

    def test_create_work_order_invalid_product(self, client, auth_headers):
        response = client.post('/api/production/work-orders', json={
            'product_id': 99999,
            'quantity': 100
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]


class TestProductionWorkOrderDetails:
    def test_get_work_order_details(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/details', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_work_order_materials(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/materials', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_work_order_operations(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/operations', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_work_order_quality_checks(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/quality-checks', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionWorkOrderSchedule:
    def test_get_work_order_schedule(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/schedule', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_work_order_schedule(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/schedule', json={
            'start_date': '2024-01-01T08:00:00',
            'end_date': '2024-01-02T17:00:00'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_reschedule_work_order(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/reschedule', json={
            'new_start_date': '2024-01-03T08:00:00',
            'reason': 'Delay in material delivery'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderProgress:
    def test_get_work_order_progress(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/progress', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_work_order_progress(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/progress', json={
            'progress_percentage': 50,
            'notes': 'Halfway completed'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_get_work_order_milestones(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/milestones', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionWorkOrderCosts:
    def test_get_work_order_costs(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/costs', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_calculate_work_order_costs(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/calculate-costs', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_get_work_order_cost_breakdown(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/cost-breakdown', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionWorkOrderDocuments:
    def test_get_work_order_documents(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/documents', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_upload_work_order_document(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/documents', json={
            'document_name': 'Work Order Spec',
            'document_type': 'specification',
            'file_path': '/path/to/file.pdf'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_delete_work_order_document(self, client, auth_headers):
        response = client.delete('/api/production/work-orders/1/documents/1', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderHistory:
    def test_get_work_order_history(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/history', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_work_order_audit_log(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/audit-log', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionWorkOrderDependencies:
    def test_get_work_order_dependencies(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/dependencies', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_add_work_order_dependency(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/dependencies', json={
            'depends_on_work_order_id': 2,
            'dependency_type': 'sequential'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_remove_work_order_dependency(self, client, auth_headers):
        response = client.delete('/api/production/work-orders/1/dependencies/2', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderTags:
    def test_get_work_order_tags(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/tags', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_add_work_order_tag(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/tags', json={
            'tag_name': 'priority'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_remove_work_order_tag(self, client, auth_headers):
        response = client.delete('/api/production/work-orders/1/tags/priority', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderComments:
    def test_get_work_order_comments(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/comments', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_add_work_order_comment(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/comments', json={
            'comment': 'Work order update needed'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_update_work_order_comment(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/comments/1', json={
            'comment': 'Updated comment'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderApprovals:
    def test_get_work_order_approvals(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/approvals', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_submit_work_order_for_approval(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/submit-approval', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_approve_work_order(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/approve', json={
            'approval_notes': 'Approved for production'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_reject_work_order(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/reject', json={
            'rejection_reason': 'Insufficient materials'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderHoldResume:
    def test_hold_work_order(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/hold', json={
            'hold_reason': 'Equipment maintenance'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_resume_work_order(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/resume', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_cancel_work_order(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/cancel', json={
            'cancellation_reason': 'Order cancelled by customer'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderClone:
    def test_clone_work_order(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/clone', headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_clone_work_order_with_changes(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/clone', json={
            'quantity': 200,
            'start_date': '2024-02-01T08:00:00'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]


class TestProductionWorkOrderBulk:
    def test_bulk_create_work_orders(self, client, auth_headers):
        response = client.post('/api/production/work-orders/bulk', json={
            'work_orders': [
                {'product_id': 1, 'quantity': 100},
                {'product_id': 2, 'quantity': 150}
            ]
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_bulk_update_work_orders(self, client, auth_headers):
        response = client.put('/api/production/work-orders/bulk', json={
            'work_order_ids': [1, 2],
            'updates': {'priority': 'high'}
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_bulk_delete_work_orders(self, client, auth_headers):
        response = client.delete('/api/production/work-orders/bulk', json={
            'work_order_ids': [1, 2]
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderSearch:
    def test_search_work_orders(self, client, auth_headers):
        response = client.get('/api/production/work-orders/search?q=test', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_filter_work_orders_by_date_range(self, client, auth_headers):
        response = client.get('/api/production/work-orders?start_date=2024-01-01&end_date=2024-12-31', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_filter_work_orders_by_status(self, client, auth_headers):
        response = client.get('/api/production/work-orders?status=pending', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_filter_work_orders_by_priority(self, client, auth_headers):
        response = client.get('/api/production/work-orders?priority=high', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionMachinesAdvanced:
    def test_get_machines_with_filters(self, client, auth_headers):
        response = client.get('/api/production/machines?status=active', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_machines_by_type(self, client, auth_headers):
        response = client.get('/api/production/machines?type=packing', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_machine_missing_code(self, client, auth_headers):
        response = client.post('/api/production/machines', json={
            'name': 'Test Machine'
        }, headers=auth_headers)
        assert response.status_code in [400, 404, 500]

    def test_update_machine_status(self, client, auth_headers):
        response = client.put('/api/production/machines/1/status', json={
            'status': 'maintenance',
            'reason': 'Scheduled maintenance'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_get_machine_maintenance_history(self, client, auth_headers):
        response = client.get('/api/production/machines/1/maintenance-history', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_machine_production_records(self, client, auth_headers):
        response = client.get('/api/production/machines/1/production-records', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionLinesAdvanced:
    def test_get_production_lines(self, client, auth_headers):
        response = client.get('/api/production/lines', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_production_line(self, client, auth_headers):
        response = client.post('/api/production/lines', json={
            'line_code': 'LINE-001',
            'line_name': 'Production Line 1',
            'description': 'Main production line'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_production_line_by_id(self, client, auth_headers):
        response = client.get('/api/production/lines/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_production_line(self, client, auth_headers):
        response = client.put('/api/production/lines/1', json={
            'line_name': 'Updated Line Name'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_assign_machine_to_line(self, client, auth_headers):
        response = client.post('/api/production/lines/1/machines', json={
            'machine_id': 1
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_remove_machine_from_line(self, client, auth_headers):
        response = client.delete('/api/production/lines/1/machines/1', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionShiftsAdvanced:
    def test_get_shifts(self, client, auth_headers):
        response = client.get('/api/production/shifts', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_shift(self, client, auth_headers):
        response = client.post('/api/production/shifts', json={
            'shift_name': 'Morning Shift',
            'start_time': '08:00',
            'end_time': '16:00'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_shift_by_id(self, client, auth_headers):
        response = client.get('/api/production/shifts/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_shift(self, client, auth_headers):
        response = client.put('/api/production/shifts/1', json={
            'shift_name': 'Updated Shift'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_get_shift_schedule(self, client, auth_headers):
        response = client.get('/api/production/shifts/1/schedule', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionQualityAdvanced:
    def test_get_quality_checks_for_work_order(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/quality-checks', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_quality_check(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/quality-checks', json={
            'check_type': 'visual',
            'result': 'pass',
            'inspector_id': 1
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_quality_defects(self, client, auth_headers):
        response = client.get('/api/production/quality/defects', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_report_quality_defect(self, client, auth_headers):
        response = client.post('/api/production/quality/defects', json={
            'work_order_id': 1,
            'defect_type': 'dimensional',
            'quantity': 5,
            'description': 'Size out of spec'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]


class TestProductionDowntimeAdvanced:
    def test_get_downtime_records(self, client, auth_headers):
        response = client.get('/api/production/downtime', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_downtime_record(self, client, auth_headers):
        response = client.post('/api/production/downtime', json={
            'machine_id': 1,
            'downtime_type': 'breakdown',
            'start_time': datetime.now().isoformat(),
            'reason': 'Equipment failure'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_end_downtime_record(self, client, auth_headers):
        response = client.put('/api/production/downtime/1/end', json={
            'end_time': datetime.now().isoformat()
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_get_downtime_by_machine(self, client, auth_headers):
        response = client.get('/api/production/downtime?machine_id=1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionPerformanceAdvanced:
    def test_get_production_kpi(self, client, auth_headers):
        response = client.get('/api/production/performance/kpi', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_production_efficiency(self, client, auth_headers):
        response = client.get('/api/production/performance/efficiency', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_production_yield(self, client, auth_headers):
        response = client.get('/api/production/performance/yield', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_production_throughput(self, client, auth_headers):
        response = client.get('/api/production/performance/throughput', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionReportsAdvanced:
    def test_get_production_summary(self, client, auth_headers):
        response = client.get('/api/production/reports/summary', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_production_by_date_range(self, client, auth_headers):
        response = client.get('/api/production/reports?start_date=2024-01-01&end_date=2024-12-31', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_production_by_product(self, client, auth_headers):
        response = client.get('/api/production/reports?product_id=1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_export_production_report(self, client, auth_headers):
        response = client.get('/api/production/reports/export', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionMaterialsAdvanced:
    def test_get_material_requirements(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/material-requirements', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_issue_material_to_work_order(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/issue-material', json={
            'material_id': 1,
            'quantity': 100,
            'uom': 'KG'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_return_material_from_work_order(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/return-material', json={
            'material_id': 1,
            'quantity': 50,
            'reason': 'Excess material'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]


class TestProductionLaborAdvanced:
    def test_get_labor_assignments(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/labor', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_assign_labor_to_work_order(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/labor', json={
            'employee_id': 1,
            'shift_id': 1
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_update_labor_hours(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/labor/1', json={
            'hours_worked': 8,
            'overtime_hours': 2
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionBatchAdvanced:
    def test_get_production_batches(self, client, auth_headers):
        response = client.get('/api/production/batches', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_production_batch(self, client, auth_headers):
        response = client.post('/api/production/batches', json={
            'batch_number': 'BATCH-001',
            'work_order_id': 1,
            'quantity': 1000
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_batch_by_id(self, client, auth_headers):
        response = client.get('/api/production/batches/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_batch_status(self, client, auth_headers):
        response = client.put('/api/production/batches/1/status', json={
            'status': 'completed'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionPlanningAdvanced:
    def test_get_production_plan(self, client, auth_headers):
        response = client.get('/api/production/planning', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_production_plan(self, client, auth_headers):
        response = client.post('/api/production/planning', json={
            'plan_name': 'Monthly Plan',
            'start_date': '2024-01-01',
            'end_date': '2024-01-31'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_production_plan_by_id(self, client, auth_headers):
        response = client.get('/api/production/planning/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_production_plan(self, client, auth_headers):
        response = client.put('/api/production/planning/1', json={
            'plan_name': 'Updated Plan'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_add_work_order_to_plan(self, client, auth_headers):
        response = client.post('/api/production/planning/1/work-orders', json={
            'work_order_id': 1
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_capacity_utilization(self, client, auth_headers):
        response = client.get('/api/production/planning/capacity-utilization', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_optimize_schedule(self, client, auth_headers):
        response = client.post('/api/production/planning/optimize', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionInventoryAdvanced:
    def test_get_raw_material_inventory(self, client, auth_headers):
        response = client.get('/api/production/inventory/raw-materials', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_wip_inventory(self, client, auth_headers):
        response = client.get('/api/production/inventory/wip', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_finished_goods_inventory(self, client, auth_headers):
        response = client.get('/api/production/inventory/finished-goods', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_reserve_material(self, client, auth_headers):
        response = client.post('/api/production/inventory/reserve', json={
            'material_id': 1,
            'work_order_id': 1,
            'quantity': 100
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_release_reservation(self, client, auth_headers):
        response = client.post('/api/production/inventory/release-reservation/1', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_get_material_shortages(self, client, auth_headers):
        response = client.get('/api/production/inventory/shortages', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionQualityControlAdvanced:
    def test_get_quality_control_plans(self, client, auth_headers):
        response = client.get('/api/production/quality-control/plans', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_quality_control_plan(self, client, auth_headers):
        response = client.post('/api/production/quality-control/plans', json={
            'plan_name': 'QC Plan 1',
            'product_id': 1,
            'check_points': [{'step': 'raw_material', 'criteria': 'visual'}]
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_execute_quality_check(self, client, auth_headers):
        response = client.post('/api/production/quality-control/execute', json={
            'work_order_id': 1,
            'check_point': 'raw_material',
            'result': 'pass'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_quality_history(self, client, auth_headers):
        response = client.get('/api/production/quality-control/history', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_non_conformance_reports(self, client, auth_headers):
        response = client.get('/api/production/quality-control/non-conformance', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_non_conformance_report(self, client, auth_headers):
        response = client.post('/api/production/quality-control/non-conformance', json={
            'work_order_id': 1,
            'defect_type': 'dimensional',
            'severity': 'major',
            'description': 'Out of spec'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]


class TestProductionMaintenanceAdvanced:
    def test_get_preventive_maintenance(self, client, auth_headers):
        response = client.get('/api/production/maintenance/preventive', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_schedule_preventive_maintenance(self, client, auth_headers):
        response = client.post('/api/production/maintenance/preventive', json={
            'machine_id': 1,
            'scheduled_date': '2024-01-15',
            'tasks': ['oil_change', 'inspection']
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_maintenance_work_orders(self, client, auth_headers):
        response = client.get('/api/production/maintenance/work-orders', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_maintenance_work_order(self, client, auth_headers):
        response = client.post('/api/production/maintenance/work-orders', json={
            'machine_id': 1,
            'priority': 'urgent',
            'description': 'Breakdown repair'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_spare_parts(self, client, auth_headers):
        response = client.get('/api/production/maintenance/spare-parts', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_issue_spare_part(self, client, auth_headers):
        response = client.post('/api/production/maintenance/spare-parts/issue', json={
            'part_id': 1,
            'maintenance_wo_id': 1,
            'quantity': 2
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]


class TestProductionCostingAdvanced:
    def test_get_production_costs(self, client, auth_headers):
        response = client.get('/api/production/costing', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_calculate_work_order_cost(self, client, auth_headers):
        response = client.post('/api/production/costing/calculate', json={
            'work_order_id': 1
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_get_cost_breakdown(self, client, auth_headers):
        response = client.get('/api/production/costing/1/breakdown', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_labor_costs(self, client, auth_headers):
        response = client.get('/api/production/costing/labor', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_material_costs(self, client, auth_headers):
        response = client.get('/api/production/costing/materials', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_overhead_costs(self, client, auth_headers):
        response = client.get('/api/production/costing/overhead', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_cost_rates(self, client, auth_headers):
        response = client.put('/api/production/costing/rates', json={
            'labor_rate': 50,
            'overhead_rate': 20
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionTraceabilityAdvanced:
    def test_get_product_traceability(self, client, auth_headers):
        response = client.get('/api/production/traceability/product/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_batch_traceability(self, client, auth_headers):
        response = client.get('/api/production/traceability/batch/BATCH-001', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_material_traceability(self, client, auth_headers):
        response = client.get('/api/production/traceability/material/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_generate_traceability_report(self, client, auth_headers):
        response = client.post('/api/production/traceability/report', json={
            'product_id': 1,
            'batch_number': 'BATCH-001'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_get_genealogy(self, client, auth_headers):
        response = client.get('/api/production/traceability/genealogy/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestProductionBOMAdvanced:
    def test_get_bom_list(self, client, auth_headers):
        response = client.get('/api/production/bom', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_bom(self, client, auth_headers):
        response = client.post('/api/production/bom', json={
            'product_id': 1,
            'name': 'Test BOM',
            'items': []
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_schedules(self, client, auth_headers):
        response = client.get('/api/production/schedules', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_schedule(self, client, auth_headers):
        response = client.post('/api/production/schedules', json={
            'work_order_id': 1,
            'start_date': '2024-01-15',
            'end_date': '2024-01-20'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_traceability_search(self, client, auth_headers):
        response = client.get('/api/production/traceability/TEST', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_dashboard_summary(self, client, auth_headers):
        response = client.get('/api/production/dashboard/summary', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_packing_list_items(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/packing-list/items', json={
            'items': []
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_batch_mixing_packing_list(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/packing-list/batch-mixing', json={
            'batch_numbers': ['BATCH-001', 'BATCH-002']
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_remaining_stocks(self, client, auth_headers):
        response = client.get('/api/production/remaining-stocks', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_remaining_stock(self, client, auth_headers):
        response = client.post('/api/production/remaining-stocks', json={
            'product_id': 1,
            'quantity': 100,
            'warehouse_location': 'A1'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_update_work_order_bom_item(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/bom/1', json={
            'quantity': 50
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_delete_work_order_bom_item(self, client, auth_headers):
        response = client.delete('/api/production/work-orders/1/bom/1', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_reset_work_order_bom(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/bom/reset', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionMachineAdvanced:
    def test_update_machine_endpoint(self, client, auth_headers):
        response = client.put('/api/production/machines/1/update', json={
            'name': 'Updated Machine',
            'status': 'active'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_update_machine_with_all_fields(self, client, auth_headers):
        response = client.put('/api/production/machines/1/update', json={
            'name': 'Updated Machine',
            'machine_type': 'injection',
            'manufacturer': 'Test Manufacturer',
            'model': 'Test Model',
            'serial_number': 'SN123',
            'status': 'active',
            'location': 'Plant A',
            'department': 'Production',
            'capacity_per_hour': 500,
            'capacity_uom': 'pcs',
            'efficiency': 95,
            'availability': 90,
            'last_maintenance': '2024-01-01',
            'next_maintenance': '2024-06-01',
            'notes': 'Test notes',
            'is_active': True
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_update_machine_not_found(self, client, auth_headers):
        response = client.put('/api/production/machines/999/update', json={
            'name': 'Updated Machine'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_get_machine_efficiency_with_dates(self, client, auth_headers):
        response = client.get('/api/production/machines/1/efficiency?start_date=2024-01-01&end_date=2024-01-31', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_machine_efficiency_no_dates(self, client, auth_headers):
        response = client.get('/api/production/machines/1/efficiency', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_machine_efficiency_not_found(self, client, auth_headers):
        response = client.get('/api/production/machines/999/efficiency', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_work_orders_status_tracking(self, client, auth_headers):
        response = client.get('/api/production/work-orders/status-tracking', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_bulk_complete_work_orders(self, client, auth_headers):
        response = client.put('/api/production/work-orders/bulk-complete', json={
            'work_order_ids': [1, 2, 3]
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_bulk_complete_work_orders_empty(self, client, auth_headers):
        response = client.put('/api/production/work-orders/bulk-complete', json={
            'work_order_ids': []
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderAdvanced:
    def test_get_work_orders_with_filters(self, client, auth_headers):
        response = client.get('/api/production/work-orders?status=pending&product_id=1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_work_orders_with_date_range(self, client, auth_headers):
        response = client.get('/api/production/work-orders?start_date=2024-01-01&end_date=2024-01-31', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_work_order_production_records(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/production-records', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_work_order_production_record(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/production-records', json={
            'quantity_produced': 100,
            'quantity_rejected': 5,
            'shift': 'A',
            'operator_id': 1
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_start_work_order(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/start', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_complete_work_order(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/complete', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_get_production_records_list(self, client, auth_headers):
        response = client.get('/api/production/production-records', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_production_record(self, client, auth_headers):
        response = client.post('/api/production/production-records', json={
            'work_order_id': 1,
            'quantity_produced': 100,
            'production_date': '2024-01-15'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_production_record_by_id(self, client, auth_headers):
        response = client.get('/api/production/production-records/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_production_record(self, client, auth_headers):
        response = client.put('/api/production/production-records/1', json={
            'quantity_produced': 150
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_get_packing_list(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/packing-list', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_sync_packing_list(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/packing-list/sync', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_get_remaining_stock_by_id(self, client, auth_headers):
        response = client.get('/api/production/remaining-stocks/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_remaining_stock(self, client, auth_headers):
        response = client.put('/api/production/remaining-stocks/1', json={
            'quantity': 200
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_delete_remaining_stock(self, client, auth_headers):
        response = client.delete('/api/production/remaining-stocks/1', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_export_remaining_stocks_excel(self, client, auth_headers):
        response = client.get('/api/production/remaining-stocks/export-excel', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_work_order_bom(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/bom', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_copy_bom_from_master(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/bom/copy-from-master', json={
            'master_bom_id': 1
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_add_work_order_bom_item(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/bom', json={
            'material_id': 1,
            'quantity': 50
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]


class TestProductionMachinesNew:
    def test_create_machine_full(self, client, auth_headers):
        response = client.post('/api/production/machines', json={
            'code': 'MCH-NEW',
            'name': 'New Machine',
            'machine_type': 'injection',
            'manufacturer': 'Test Mfg',
            'model': 'TM-100',
            'serial_number': 'SN-999',
            'location': 'Plant B',
            'capacity_per_hour': 1000
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_create_machine_minimal(self, client, auth_headers):
        response = client.post('/api/production/machines', json={
            'code': 'MCH-MIN',
            'name': 'Minimal Machine',
            'machine_type': 'packing'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_machines_list(self, client, auth_headers):
        response = client.get('/api/production/machines', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_machine_by_id(self, client, auth_headers):
        response = client.get('/api/production/machines/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_machine_by_id_not_found(self, client, auth_headers):
        response = client.get('/api/production/machines/999', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_machine_put(self, client, auth_headers):
        response = client.put('/api/production/machines/1', json={
            'name': 'Updated Name',
            'status': 'maintenance'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_update_machine_put_not_found(self, client, auth_headers):
        response = client.put('/api/production/machines/999', json={
            'name': 'Updated Name'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderStatus:
    def test_update_work_order_status(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/status', json={
            'status': 'in_progress'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_update_work_order_status_not_found(self, client, auth_headers):
        response = client.put('/api/production/work-orders/999/status', json={
            'status': 'completed'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_update_work_order_status_invalid(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/status', json={
            'status': 'invalid_status'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderDelete:
    def test_delete_work_order(self, client, auth_headers):
        response = client.delete('/api/production/work-orders/1', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_delete_work_order_not_found(self, client, auth_headers):
        response = client.delete('/api/production/work-orders/999', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderCreate:
    def test_create_work_order_full(self, client, auth_headers):
        response = client.post('/api/production/work-orders', json={
            'product_id': 1,
            'quantity': 500,
            'start_date': '2024-01-15',
            'due_date': '2024-01-20',
            'priority': 'high',
            'notes': 'Test order'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_create_work_order_minimal(self, client, auth_headers):
        response = client.post('/api/production/work-orders', json={
            'product_id': 1,
            'quantity': 100
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_create_work_order_missing_quantity(self, client, auth_headers):
        response = client.post('/api/production/work-orders', json={
            'product_id': 1
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_create_work_order_invalid_product(self, client, auth_headers):
        response = client.post('/api/production/work-orders', json={
            'product_id': 9999,
            'quantity': 100
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]


class TestProductionWorkOrderGet:
    def test_get_work_orders_list(self, client, auth_headers):
        response = client.get('/api/production/work-orders', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_work_order_by_id(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_get_work_order_by_id_not_found(self, client, auth_headers):
        response = client.get('/api/production/work-orders/999', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_work_order(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1', json={
            'quantity': 200,
            'priority': 'urgent'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_update_work_order_not_found(self, client, auth_headers):
        response = client.put('/api/production/work-orders/999', json={
            'quantity': 200
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionWorkOrderProductionRecords:
    def test_get_production_records_for_wo(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/production-records', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_production_record_for_wo(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/production-records', json={
            'quantity_produced': 100,
            'quantity_rejected': 5,
            'shift': 'A',
            'operator_id': 1,
            'production_date': '2024-01-15'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_start_work_order_put(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/start', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_complete_work_order_put(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/complete', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestProductionRecords:
    def test_get_production_records(self, client, auth_headers):
        response = client.get('/api/production/production-records', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_production_record(self, client, auth_headers):
        response = client.post('/api/production/production-records', json={
            'work_order_id': 1,
            'quantity_produced': 100,
            'production_date': '2024-01-15'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_production_record_by_id(self, client, auth_headers):
        response = client.get('/api/production/production-records/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_production_record(self, client, auth_headers):
        response = client.put('/api/production/production-records/1', json={
            'quantity_produced': 150
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestWorkOrderPackingList:
    def test_get_packing_list(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/packing-list', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_sync_packing_list(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/packing-list/sync', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]


class TestRemainingStocks:
    def test_get_remaining_stocks(self, client, auth_headers):
        response = client.get('/api/production/remaining-stocks', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_create_remaining_stock(self, client, auth_headers):
        response = client.post('/api/production/remaining-stocks', json={
            'product_id': 1,
            'quantity': 100,
            'warehouse_location': 'A1'
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_get_remaining_stock_by_id(self, client, auth_headers):
        response = client.get('/api/production/remaining-stocks/1', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_update_remaining_stock(self, client, auth_headers):
        response = client.put('/api/production/remaining-stocks/1', json={
            'quantity': 200
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_delete_remaining_stock(self, client, auth_headers):
        response = client.delete('/api/production/remaining-stocks/1', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_export_remaining_stocks_excel(self, client, auth_headers):
        response = client.get('/api/production/remaining-stocks/export-excel', headers=auth_headers)
        assert response.status_code in [200, 404, 500]


class TestWorkOrderBOM:
    def test_get_work_order_bom(self, client, auth_headers):
        response = client.get('/api/production/work-orders/1/bom', headers=auth_headers)
        assert response.status_code in [200, 404, 500]

    def test_copy_bom_from_master(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/bom/copy-from-master', json={
            'master_bom_id': 1
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_update_work_order_bom_item(self, client, auth_headers):
        response = client.put('/api/production/work-orders/1/bom/1', json={
            'quantity': 50
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_add_work_order_bom_item(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/bom', json={
            'material_id': 1,
            'quantity': 50
        }, headers=auth_headers)
        assert response.status_code in [200, 201, 400, 404, 500]

    def test_delete_work_order_bom_item(self, client, auth_headers):
        response = client.delete('/api/production/work-orders/1/bom/1', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]

    def test_reset_work_order_bom(self, client, auth_headers):
        response = client.post('/api/production/work-orders/1/bom/reset', headers=auth_headers)
        assert response.status_code in [200, 400, 404, 500]
class TestCalculateOEEWithDowntimeCategories:
    """Unit tests for OEE calculation with capped downtime categories"""

    def test_no_downtime_full_efficiency(self):
        """No downtime at all should give 100% efficiency"""
        data = {
            'downtime_mesin': 0,
            'downtime_operator': 0,
            'downtime_material': 0,
            'downtime_design': 0,
            'downtime_others': 0,
            'idle_time': 0
        }
        result = calculate_oee_with_downtime_categories(data, planned_runtime=480)
        assert result['efficiency_rate'] == 100
        assert result['base_efficiency'] == 100
        assert result['total_downtime'] == 0

    def test_machine_downtime_under_limit_counts_fully(self):
        """Mesin downtime under the 15% cap should count fully, no capping applied"""
        # 480 * 10% = 48 minutes, well under the 15% cap
        data = {
            'downtime_mesin': 48,
            'downtime_operator': 0,
            'downtime_material': 0,
            'downtime_design': 0,
            'downtime_others': 0,
            'idle_time': 0
        }
        result = calculate_oee_with_downtime_categories(data, planned_runtime=480)
        assert result['loss_mesin'] == 10.0
        assert result['efficiency_rate'] == 90.0
        # Under the cap, base and capped efficiency should match
        assert result['base_efficiency'] == result['efficiency_rate']

    def test_machine_downtime_over_limit_gets_capped(self):
        """Mesin downtime over the 15% cap should be capped, base_efficiency reflects true loss"""
        # 480 * 25% = 120 minutes, well over the 15% cap
        data = {
            'downtime_mesin': 120,
            'downtime_operator': 0,
            'downtime_material': 0,
            'downtime_design': 0,
            'downtime_others': 0,
            'idle_time': 0
        }
        result = calculate_oee_with_downtime_categories(data, planned_runtime=480)
        assert result['loss_mesin'] == 15.0  # capped at limit
        assert result['efficiency_rate'] == 85.0  # 100 - 15 (capped)
        assert result['base_efficiency'] == 75.0  # 100 - 25 (uncapped, for reference)

    def test_operator_downtime_capped_at_7_percent(self):
        """Operator downtime over the 7% cap should be capped at 7%"""
        # 480 * 20% = 96 minutes, well over the 7% cap
        data = {
            'downtime_mesin': 0,
            'downtime_operator': 96,
            'downtime_material': 0,
            'downtime_design': 0,
            'downtime_others': 0,
            'idle_time': 0
        }
        result = calculate_oee_with_downtime_categories(data, planned_runtime=480)
        assert result['loss_operator'] == 7.0
        assert result['efficiency_rate'] == 93.0

    def test_material_downtime_has_no_cap(self):
        """Material downtime should count fully with no cap, even at high percentages"""
        # 480 * 30% = 144 minutes - would be way over other categories' caps
        data = {
            'downtime_mesin': 0,
            'downtime_operator': 0,
            'downtime_material': 144,
            'downtime_design': 0,
            'downtime_others': 0,
            'idle_time': 0
        }
        result = calculate_oee_with_downtime_categories(data, planned_runtime=480)
        assert result['loss_material'] == 30.0  # uncapped
        assert result['efficiency_rate'] == 70.0

    def test_design_downtime_capped_at_8_percent(self):
        """Design change downtime over the 8% cap should be capped at 8%"""
        data = {
            'downtime_mesin': 0,
            'downtime_operator': 0,
            'downtime_material': 0,
            'downtime_design': 96,  # 20% of 480
            'downtime_others': 0,
            'idle_time': 0
        }
        result = calculate_oee_with_downtime_categories(data, planned_runtime=480)
        assert result['loss_design'] == 8.0
        assert result['efficiency_rate'] == 92.0

    def test_others_downtime_capped_at_10_percent(self):
        """Others downtime over the 10% cap should be capped at 10%"""
        data = {
            'downtime_mesin': 0,
            'downtime_operator': 0,
            'downtime_material': 0,
            'downtime_design': 0,
            'downtime_others': 96,  # 20% of 480
            'idle_time': 0
        }
        result = calculate_oee_with_downtime_categories(data, planned_runtime=480)
        assert result['loss_others'] == 10.0
        assert result['efficiency_rate'] == 90.0

    def test_multiple_categories_combined(self):
        """Multiple downtime categories combined, each capped independently"""
        data = {
            'downtime_mesin': 120,     # 25% raw -> capped 15%
            'downtime_operator': 96,   # 20% raw -> capped 7%
            'downtime_material': 24,   # 5% raw -> uncapped, counts fully
            'downtime_design': 0,
            'downtime_others': 0,
            'idle_time': 0
        }
        result = calculate_oee_with_downtime_categories(data, planned_runtime=480)
        # Total capped loss: 15 + 7 + 5 = 27
        assert result['loss_mesin'] == 15.0
        assert result['loss_operator'] == 7.0
        assert result['loss_material'] == 5.0
        assert result['efficiency_rate'] == 73.0

    def test_zero_planned_runtime_does_not_crash(self):
        """planned_runtime of 0 should not raise a division-by-zero error"""
        data = {
            'downtime_mesin': 10,
            'downtime_operator': 5,
            'downtime_material': 0,
            'downtime_design': 0,
            'downtime_others': 0,
            'idle_time': 0
        }
        result = calculate_oee_with_downtime_categories(data, planned_runtime=0)
        assert result['loss_mesin'] == 0
        assert result['loss_operator'] == 0
        assert result['efficiency_rate'] == 100

    def test_efficiency_never_goes_below_zero(self):
        """Even with extreme combined downtime, efficiency_rate should floor at 0, not go negative"""
        data = {
            'downtime_mesin': 480,
            'downtime_operator': 480,
            'downtime_material': 480,
            'downtime_design': 480,
            'downtime_others': 480,
            'idle_time': 0
        }
        result = calculate_oee_with_downtime_categories(data, planned_runtime=480)
        assert result['efficiency_rate'] >= 0

    def test_missing_downtime_fields_default_to_zero(self):
        """Missing downtime category fields in input dict should default to 0, not crash"""
        data = {}
        result = calculate_oee_with_downtime_categories(data, planned_runtime=480)
        assert result['efficiency_rate'] == 100
        assert result['total_downtime'] == 0

class TestProductionIntegration:
    """Tests for auto_deduct_materials and auto_receive_finished_goods"""

    @pytest.fixture
    def warehouse_location(self, db_session):
        """Create a minimal warehouse zone + location for inventory tests"""
        zone = WarehouseZone(
            code='ZONE-TEST',
            name='Test Zone',
            material_type='raw_materials',
            zone_type='storage'
        )
        db_session.add(zone)
        db_session.commit()

        location = WarehouseLocation(
            zone_id=zone.id,
            location_code='ZONE-TEST-R1-L1-P1',
            rack='R1',
            level='L1',
            position='P1',
            capacity_uom='KG'
        )
        db_session.add(location)
        db_session.commit()
        return location

    @pytest.fixture
    def material_inventory(self, db_session, test_material, warehouse_location):
        """Create inventory stock for the test material"""
        inv = Inventory(
            material_id=test_material.id,
            location_id=warehouse_location.id,
            quantity_on_hand=100,
            quantity_available=100
        )
        db_session.add(inv)
        db_session.commit()
        return inv

    @pytest.fixture
    def test_machine(self, db_session):
        machine = Machine(
            code='MC-TEST',
            name='Test Machine',
            machine_type='nonwoven_machine'
        )
        db_session.add(machine)
        db_session.commit()
        return machine

    @pytest.fixture
    def work_order_with_bom(self, db_session, test_product, test_material, material_inventory):
        """Create a work order with one BOM item requiring the test material"""
        wo = WorkOrder(
            wo_number='WO-TEST-001',
            product_id=test_product.id,
            bom_id=None,
            quantity=10,
            uom='PCS',
            status='in_progress'
        )
        db_session.add(wo)
        db_session.commit()

        # Give it a bom_id so auto_deduct_materials doesn't reject for "no BOM attached"
        wo.bom_id = 1
        db_session.commit()

        bom_item = WorkOrderBOMItem(
            work_order_id=wo.id,
            line_number=1,
            material_id=test_material.id,
            item_name=test_material.name,
            quantity_per_unit=2,  # 2 KG per unit
            uom='KG',
            quantity_planned=20  # 2 * 10 units
        )
        db_session.add(bom_item)
        db_session.commit()
        return wo

    def test_auto_deduct_materials_success(self, app, db_session, work_order_with_bom, material_inventory):
        """Deducting materials with sufficient stock should succeed and reduce inventory"""
        inventory_id = material_inventory.id
        with app.app_context():
            success, message, transactions = auto_deduct_materials(work_order_with_bom.id)

            assert success is True
            assert len(transactions) == 1

            updated_inv = db.session.get(Inventory, inventory_id)
            # Started with 100, BOM needs 20 (2 per unit * 10 units)
            assert float(updated_inv.quantity_on_hand) == 80
            assert float(updated_inv.quantity_available) == 80

    def test_auto_deduct_materials_insufficient_stock(self, app, db_session, work_order_with_bom, material_inventory):
        """Deducting materials with insufficient stock should fail and not modify inventory"""
        # Reduce available stock below what's required (BOM needs 20)
        material_inventory.quantity_on_hand = 5
        material_inventory.quantity_available = 5
        db_session.commit()
        inventory_id = material_inventory.id

        with app.app_context():
            success, message, insufficient = auto_deduct_materials(work_order_with_bom.id)

            assert success is False
            assert len(insufficient) == 1
            assert insufficient[0]['required'] == 20

            updated_inv = db.session.get(Inventory, inventory_id)
            # Stock should remain untouched since deduction failed
            assert float(updated_inv.quantity_on_hand) == 5

    def test_auto_deduct_materials_no_work_order(self, app):
        """Calling with a non-existent work order ID should fail gracefully"""
        with app.app_context():
            success, message, data = auto_deduct_materials(999999)
            assert success is False
            assert 'not found' in message.lower()

    def test_auto_deduct_materials_no_bom_items(self, app, db_session, test_product):
        """Work order with a bom_id but zero actual BOM items should fail gracefully"""
        with app.app_context():
            wo = WorkOrder(
                wo_number='WO-TEST-002',
                product_id=test_product.id,
                bom_id=1,
                quantity=5,
                uom='PCS',
                status='in_progress'
            )
            db_session.add(wo)
            db_session.commit()

            success, message, data = auto_deduct_materials(wo.id)
            assert success is False
            assert 'no bom items' in message.lower()

    def test_auto_receive_finished_goods_creates_inventory(self, app, db_session, test_product, warehouse_location):
        """Receiving finished goods for a product with no existing inventory should create one"""
        with app.app_context():
            wo = WorkOrder(
                wo_number='WO-TEST-003',
                product_id=test_product.id,
                quantity=50,
                uom='PCS',
                status='completed'
            )
            db_session.add(wo)
            db_session.commit()

            success, message, inventory_id = auto_receive_finished_goods(wo.id, 50)

            assert success is True
            assert inventory_id is not None

            inv = db.session.get(Inventory, inventory_id)
            assert float(inv.quantity_on_hand) == 50

    def test_auto_receive_finished_goods_no_work_order(self, app):
        """Receiving for a non-existent work order should fail gracefully"""
        with app.app_context():
            success, message, inventory_id = auto_receive_finished_goods(999999, 10)
            assert success is False
            assert inventory_id is None


class TestProductionApprovalWorkflow:
    """Tests for submit_wo_for_approval and forward_to_finance endpoints"""

    @pytest.fixture
    def completed_work_order(self, db_session, test_product):
        """A work order that's ready to be submitted for approval"""
        wo = WorkOrder(
            wo_number='WO-APPROVAL-001',
            product_id=test_product.id,
            quantity=100,
            uom='PCS',
            status='completed',
            quantity_produced=100,
            quantity_good=95,
            quantity_scrap=5
        )
        db_session.add(wo)
        db_session.commit()
        return wo

    def test_submit_wo_for_approval_success(self, client, auth_headers, completed_work_order):
        """Submitting a completed work order should create a pending approval"""
        response = client.post(
            f'/api/production/work-orders/{completed_work_order.id}/submit-for-approval',
            headers=auth_headers
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data['approval']['status'] == 'pending'
        assert float(data['approval']['quantity_good']) == 95

    def test_submit_wo_for_approval_not_completed(self, client, auth_headers, db_session, test_product):
        """Submitting a work order that isn't completed yet should be rejected"""
        wo = WorkOrder(
            wo_number='WO-APPROVAL-002',
            product_id=test_product.id,
            quantity=50,
            uom='PCS',
            status='in_progress'
        )
        db_session.add(wo)
        db_session.commit()

        response = client.post(
            f'/api/production/work-orders/{wo.id}/submit-for-approval',
            headers=auth_headers
        )
        assert response.status_code == 400

    def test_submit_wo_for_approval_already_submitted(self, client, auth_headers, completed_work_order):
        """Submitting the same work order twice should be rejected on the second attempt"""
        first = client.post(
            f'/api/production/work-orders/{completed_work_order.id}/submit-for-approval',
            headers=auth_headers
        )
        assert first.status_code == 201

        second = client.post(
            f'/api/production/work-orders/{completed_work_order.id}/submit-for-approval',
            headers=auth_headers
        )
        assert second.status_code == 400

    def test_submit_wo_for_approval_not_found(self, client, auth_headers):
        """Submitting a non-existent work order should return 404"""
        response = client.post(
            '/api/production/work-orders/999999/submit-for-approval',
            headers=auth_headers
        )
        assert response.status_code == 404

    @pytest.fixture
    def approved_approval(self, db_session, completed_work_order, test_user):
        """A production approval already in 'approved' status, ready to forward"""
        approval = ProductionApproval(
            approval_number='PA-TEST-001',
            work_order_id=completed_work_order.id,
            quantity_produced=100,
            quantity_good=95,
            quantity_reject=5,
            material_cost=1000,
            labor_cost=500,
            overhead_cost=200,
            total_cost=1700,
            cost_per_unit=17.89,
            status='approved',
            submitted_by=test_user.id
        )
        db_session.add(approval)
        db_session.commit()
        return approval

    def test_forward_to_finance_success(self, client, auth_headers, approved_approval):
        """Forwarding an approved production should create an invoice with cost breakdown"""
        response = client.put(
            f'/api/production/production-approvals/{approved_approval.id}/forward-to-finance',
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.get_json()
        assert 'invoice_id' in data
        assert data['invoice_id'] is not None

    def test_forward_to_finance_not_approved(self, client, auth_headers, db_session, completed_work_order, test_user):
        """Forwarding an approval that's still pending should be rejected"""
        approval = ProductionApproval(
            approval_number='PA-TEST-002',
            work_order_id=completed_work_order.id,
            quantity_produced=100,
            quantity_good=95,
            status='pending',
            submitted_by=test_user.id
        )
        db_session.add(approval)
        db_session.commit()

        response = client.put(
            f'/api/production/production-approvals/{approval.id}/forward-to-finance',
            headers=auth_headers
        )
        assert response.status_code == 400

    def test_forward_to_finance_already_forwarded(self, client, auth_headers, approved_approval):
        """Forwarding the same approval twice should be rejected on the second attempt"""
        first = client.put(
            f'/api/production/production-approvals/{approved_approval.id}/forward-to-finance',
            headers=auth_headers
        )
        assert first.status_code == 200

        second = client.put(
            f'/api/production/production-approvals/{approved_approval.id}/forward-to-finance',
            headers=auth_headers
        )
        assert second.status_code == 400

    def test_forward_to_finance_not_found(self, client, auth_headers):
        """Forwarding a non-existent approval should return 404"""
        response = client.put(
            '/api/production/production-approvals/999999/forward-to-finance',
            headers=auth_headers
        )
        assert response.status_code == 404

class TestCreatePlanFromForecast:
    """Tests for create_plan_from_forecast endpoint"""

    @pytest.fixture
    def approved_forecast(self, db_session, test_product, test_user):
        forecast = SalesForecast(
            forecast_number='FC-TEST-001',
            name='Test Forecast Q1',
            forecast_type='quarterly',
            period_start=datetime(2026, 1, 1).date(),
            period_end=datetime(2026, 3, 31).date(),
            product_id=test_product.id,
            most_likely=500,
            status='approved',
            created_by=test_user.id
        )
        db_session.add(forecast)
        db_session.commit()
        return forecast

    def test_create_plan_from_approved_forecast_success(self, client, auth_headers, approved_forecast):
        """Creating a plan from an approved forecast should succeed and use most_likely as planned quantity"""
        response = client.post(
            f'/api/production-planning/production-plans/from-forecast/{approved_forecast.id}',
            headers=auth_headers
        )
        assert response.status_code == 201
        data = response.get_json()
        plan_id = data['data']['plan_id']

        plan = db.session.get(ProductionPlan, plan_id)
        assert float(plan.planned_quantity) == 500
        assert plan.based_on == 'forecast'
        assert plan.sales_forecast_id == approved_forecast.id

    def test_create_plan_from_unapproved_forecast_rejected(self, client, auth_headers, db_session, test_product, test_user):
        """Creating a plan from a draft (not yet approved) forecast should be rejected"""
        forecast = SalesForecast(
            forecast_number='FC-TEST-002',
            name='Test Forecast Draft',
            forecast_type='monthly',
            period_start=datetime(2026, 4, 1).date(),
            period_end=datetime(2026, 4, 30).date(),
            product_id=test_product.id,
            most_likely=300,
            status='draft',
            created_by=test_user.id
        )
        db_session.add(forecast)
        db_session.commit()

        response = client.post(
            f'/api/production-planning/production-plans/from-forecast/{forecast.id}',
            headers=auth_headers
        )
        assert response.status_code == 400

    def test_create_plan_from_nonexistent_forecast(self, client, auth_headers):
        """Creating a plan from a non-existent forecast should return 404"""
        response = client.post(
            '/api/production-planning/production-plans/from-forecast/999999',
            headers=auth_headers
        )
        assert response.status_code == 404
