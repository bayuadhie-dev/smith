"""add critical indexes only

Revision ID: a1b2c3d4e5f6
Revises: f5a6b7c8d9e0
Create Date: 2024-04-14 12:52:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f5a6b7c8d9e0'
branch_labels = None
depends_on = None


def upgrade():
    """
    Add only critical indexes for performance improvement.
    This migration does NOT include any schema changes - only indexes.
    Uses try-except to handle indexes that may already exist.
    """

    # ===============================
    # USER MODULE INDEXES
    # ===============================
    try:
        op.create_index('idx_users_is_active', 'users', ['is_active'])
    except Exception:
        pass
    try:
        op.create_index('idx_users_created_at', 'users', ['created_at'])
    except Exception:
        pass
    try:
        op.create_index('idx_users_last_login', 'users', ['last_login'])
    except Exception:
        pass

    # ===============================
    # PRODUCTION MODULE INDEXES
    # ===============================
    try:
        op.create_index('idx_machines_status', 'machines', ['status'])
    except Exception:
        pass
    try:
        op.create_index('idx_machines_is_active', 'machines', ['is_active'])
    except Exception:
        pass
    try:
        op.create_index('idx_machines_machine_type', 'machines', ['machine_type'])
    except Exception:
        pass

    try:
        op.create_index('idx_bom_product_id', 'bill_of_materials', ['product_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_bom_created_by', 'bill_of_materials', ['created_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_bom_approved_by', 'bill_of_materials', ['approved_by'])
    except Exception:
        pass

    try:
        op.create_index('idx_bom_items_bom_id', 'bom_items', ['bom_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_bom_items_product_id', 'bom_items', ['product_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_bom_items_material_id', 'bom_items', ['material_id'])
    except Exception:
        pass

    try:
        op.create_index('idx_work_orders_machine_id', 'work_orders', ['machine_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_work_orders_product_id', 'work_orders', ['product_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_work_orders_status', 'work_orders', ['status'])
    except Exception:
        pass
    try:
        op.create_index('idx_work_orders_scheduled_start_date', 'work_orders', ['scheduled_start_date'])
    except Exception:
        pass
    try:
        op.create_index('idx_work_orders_scheduled_end_date', 'work_orders', ['scheduled_end_date'])
    except Exception:
        pass
    try:
        op.create_index('idx_work_orders_actual_start_date', 'work_orders', ['actual_start_date'])
    except Exception:
        pass
    try:
        op.create_index('idx_work_orders_actual_end_date', 'work_orders', ['actual_end_date'])
    except Exception:
        pass
    try:
        op.create_index('idx_work_orders_created_at', 'work_orders', ['created_at'])
    except Exception:
        pass

    # ===============================
    # WAREHOUSE MODULE INDEXES
    # ===============================
    try:
        op.create_index('idx_warehouse_locations_zone_id', 'warehouse_locations', ['zone_id'])
    except Exception:
        pass

    try:
        op.create_index('idx_inventory_stock_status', 'inventory', ['stock_status'])
    except Exception:
        pass
    try:
        op.create_index('idx_inventory_is_active', 'inventory', ['is_active'])
    except Exception:
        pass
    try:
        op.create_index('idx_inventory_qc_inspection_id', 'inventory', ['qc_inspection_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_inventory_work_order_id', 'inventory', ['work_order_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_inventory_grn_id', 'inventory', ['grn_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_inventory_created_by', 'inventory', ['created_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_inventory_expiry_date', 'inventory', ['expiry_date'])
    except Exception:
        pass

    try:
        op.create_index('idx_inventory_movements_product_id', 'inventory_movements', ['product_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_inventory_movements_material_id', 'inventory_movements', ['material_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_inventory_movements_location_id', 'inventory_movements', ['location_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_inventory_movements_created_by', 'inventory_movements', ['created_by'])
    except Exception:
        pass

    # ===============================
    # SALES MODULE INDEXES
    # ===============================
    try:
        op.create_index('idx_leads_assigned_to', 'leads', ['assigned_to'])
    except Exception:
        pass
    try:
        op.create_index('idx_leads_converted_to_customer_id', 'leads', ['converted_to_customer_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_leads_created_by', 'leads', ['created_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_leads_lead_status', 'leads', ['lead_status'])
    except Exception:
        pass
    try:
        op.create_index('idx_leads_created_at', 'leads', ['created_at'])
    except Exception:
        pass

    try:
        op.create_index('idx_opportunities_lead_id', 'opportunities', ['lead_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_opportunities_customer_id', 'opportunities', ['customer_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_opportunities_assigned_to', 'opportunities', ['assigned_to'])
    except Exception:
        pass
    try:
        op.create_index('idx_opportunities_stage_id', 'opportunities', ['stage_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_opportunities_created_by', 'opportunities', ['created_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_opportunities_created_at', 'opportunities', ['created_at'])
    except Exception:
        pass

    try:
        op.create_index('idx_sales_orders_customer_id', 'sales_orders', ['customer_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_sales_orders_created_by', 'sales_orders', ['created_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_sales_orders_status', 'sales_orders', ['status'])
    except Exception:
        pass
    try:
        op.create_index('idx_sales_orders_created_at', 'sales_orders', ['created_at'])
    except Exception:
        pass

    # ===============================
    # PURCHASING MODULE INDEXES
    # ===============================
    try:
        op.create_index('idx_suppliers_is_active', 'suppliers', ['is_active'])
    except Exception:
        pass
    try:
        op.create_index('idx_suppliers_created_at', 'suppliers', ['created_at'])
    except Exception:
        pass

    try:
        op.create_index('idx_purchase_orders_supplier_id', 'purchase_orders', ['supplier_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_purchase_orders_created_by', 'purchase_orders', ['created_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_purchase_orders_approved_by', 'purchase_orders', ['approved_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_purchase_orders_status', 'purchase_orders', ['status'])
    except Exception:
        pass
    try:
        op.create_index('idx_purchase_orders_created_at', 'purchase_orders', ['created_at'])
    except Exception:
        pass

    # ===============================
    # FINANCE MODULE INDEXES
    # ===============================
    try:
        op.create_index('idx_invoices_customer_id', 'invoices', ['customer_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_invoices_supplier_id', 'invoices', ['supplier_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_invoices_sales_order_id', 'invoices', ['sales_order_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_invoices_purchase_order_id', 'invoices', ['purchase_order_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_invoices_work_order_id', 'invoices', ['work_order_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_invoices_created_by', 'invoices', ['created_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_invoices_status', 'invoices', ['status'])
    except Exception:
        pass
    try:
        op.create_index('idx_invoices_created_at', 'invoices', ['created_at'])
    except Exception:
        pass

    try:
        op.create_index('idx_payments_customer_id', 'payments', ['customer_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_payments_supplier_id', 'payments', ['supplier_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_payments_invoice_id', 'payments', ['invoice_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_payments_created_by', 'payments', ['created_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_payments_status', 'payments', ['status'])
    except Exception:
        pass
    try:
        op.create_index('idx_payments_created_at', 'payments', ['created_at'])
    except Exception:
        pass

    # ===============================
    # HR MODULE INDEXES
    # ===============================
    try:
        op.create_index('idx_employees_department_id', 'employees', ['department_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_employees_is_active', 'employees', ['is_active'])
    except Exception:
        pass
    try:
        op.create_index('idx_employees_created_at', 'employees', ['created_at'])
    except Exception:
        pass

    try:
        op.create_index('idx_attendances_user_id', 'attendances', ['user_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_attendances_employee_id', 'attendances', ['employee_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_attendances_status', 'attendances', ['status'])
    except Exception:
        pass
    try:
        op.create_index('idx_attendances_created_at', 'attendances', ['created_at'])
    except Exception:
        pass

    try:
        op.create_index('idx_leaves_employee_id', 'leaves', ['employee_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_leaves_approved_by', 'leaves', ['approved_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_leaves_status', 'leaves', ['status'])
    except Exception:
        pass
    try:
        op.create_index('idx_leaves_created_at', 'leaves', ['created_at'])
    except Exception:
        pass

    # ===============================
    # MAINTENANCE MODULE INDEXES
    # ===============================
    try:
        op.create_index('idx_maintenance_records_machine_id', 'maintenance_records', ['machine_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_maintenance_records_created_by', 'maintenance_records', ['created_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_maintenance_records_assigned_to', 'maintenance_records', ['assigned_to'])
    except Exception:
        pass
    try:
        op.create_index('idx_maintenance_records_completed_by', 'maintenance_records', ['completed_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_maintenance_records_status', 'maintenance_records', ['status'])
    except Exception:
        pass
    try:
        op.create_index('idx_maintenance_records_scheduled_date', 'maintenance_records', ['scheduled_date'])
    except Exception:
        pass
    try:
        op.create_index('idx_maintenance_records_created_at', 'maintenance_records', ['created_at'])
    except Exception:
        pass

    # ===============================
    # QUALITY MODULE INDEXES
    # ===============================
    try:
        op.create_index('idx_quality_inspections_product_id', 'quality_inspections', ['product_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_quality_inspections_material_id', 'quality_inspections', ['material_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_quality_inspections_work_order_id', 'quality_inspections', ['work_order_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_quality_inspections_created_by', 'quality_inspections', ['created_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_quality_inspections_approved_by', 'quality_inspections', ['approved_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_quality_inspections_status', 'quality_inspections', ['status'])
    except Exception:
        pass
    try:
        op.create_index('idx_quality_inspections_inspection_date', 'quality_inspections', ['inspection_date'])
    except Exception:
        pass
    try:
        op.create_index('idx_quality_inspections_created_at', 'quality_inspections', ['created_at'])
    except Exception:
        pass

    # ===============================
    # RND MODULE INDEXES
    # ===============================
    try:
        op.create_index('idx_rnd_projects_created_by', 'rnd_projects', ['created_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_rnd_projects_approved_by', 'rnd_projects', ['approved_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_rnd_projects_status', 'rnd_projects', ['status'])
    except Exception:
        pass
    try:
        op.create_index('idx_rnd_projects_start_date', 'rnd_projects', ['start_date'])
    except Exception:
        pass
    try:
        op.create_index('idx_rnd_projects_created_at', 'rnd_projects', ['created_at'])
    except Exception:
        pass

    # ===============================
    # NOTIFICATION MODULE INDEXES
    # ===============================
    try:
        op.create_index('idx_notifications_related_user_id', 'notifications', ['related_user_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_notifications_notification_type', 'notifications', ['notification_type'])
    except Exception:
        pass
    try:
        op.create_index('idx_notifications_is_read', 'notifications', ['is_read'])
    except Exception:
        pass

    # ===============================
    # OEE MODULE INDEXES
    # ===============================
    try:
        op.create_index('idx_oee_records_machine_id', 'oee_records', ['machine_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_oee_records_created_by', 'oee_records', ['created_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_oee_records_status', 'oee_records', ['status'])
    except Exception:
        pass
    try:
        op.create_index('idx_oee_records_created_at', 'oee_records', ['created_at'])
    except Exception:
        pass

    # ===============================
    # MBF REPORT MODULE INDEXES
    # ===============================
    try:
        op.create_index('idx_mbf_reports_created_by', 'mbf_reports', ['created_by'])
    except Exception:
        pass
    try:
        op.create_index('idx_mbf_reports_supervisor_id', 'mbf_reports', ['supervisor_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_mbf_reports_manager_id', 'mbf_reports', ['manager_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_mbf_reports_created_at', 'mbf_reports', ['created_at'])
    except Exception:
        pass

    try:
        op.create_index('idx_mbf_report_details_report_id', 'mbf_report_details', ['report_id'])
    except Exception:
        pass

    # ===============================
    # COMPOSITE INDEXES (Priority 4)
    # ===============================
    try:
        op.create_index('idx_wo_machine_scheduled_start', 'work_orders', ['machine_id', 'scheduled_start_date'])
    except Exception:
        pass
    try:
        op.create_index('idx_wo_product_scheduled_start', 'work_orders', ['product_id', 'scheduled_start_date'])
    except Exception:
        pass
    try:
        op.create_index('idx_wo_status_scheduled_start', 'work_orders', ['status', 'scheduled_start_date'])
    except Exception:
        pass

    try:
        op.create_index('idx_so_customer_date', 'sales_orders', ['customer_id', 'order_date'])
    except Exception:
        pass
    try:
        op.create_index('idx_so_customer_status', 'sales_orders', ['customer_id', 'status'])
    except Exception:
        pass

    try:
        op.create_index('idx_invoice_customer_date', 'invoices', ['customer_id', 'invoice_date'])
    except Exception:
        pass
    try:
        op.create_index('idx_invoice_status_date', 'invoices', ['status', 'invoice_date'])
    except Exception:
        pass

    try:
        op.create_index('idx_inventory_product_status', 'inventory', ['product_id', 'stock_status'])
    except Exception:
        pass
    try:
        op.create_index('idx_inventory_material_status', 'inventory', ['material_id', 'stock_status'])
    except Exception:
        pass

    try:
        op.create_index('idx_maintenance_machine_status', 'maintenance_records', ['machine_id', 'status'])
    except Exception:
        pass
    try:
        op.create_index('idx_maintenance_machine_date', 'maintenance_records', ['machine_id', 'scheduled_date'])
    except Exception:
        pass


def downgrade():
    """
    Remove all indexes added in this migration.
    """

    # Composite indexes
    op.drop_index('idx_maintenance_machine_date', table_name='maintenance_records')
    op.drop_index('idx_maintenance_machine_status', table_name='maintenance_records')
    op.drop_index('idx_inventory_material_status', table_name='inventory')
    op.drop_index('idx_inventory_product_status', table_name='inventory')
    op.drop_index('idx_invoice_status_date', table_name='invoices')
    op.drop_index('idx_invoice_customer_date', table_name='invoices')
    op.drop_index('idx_so_customer_status', table_name='sales_orders')
    op.drop_index('idx_so_customer_date', table_name='sales_orders')
    op.drop_index('idx_wo_status_scheduled_start', table_name='work_orders')
    op.drop_index('idx_wo_product_scheduled_start', table_name='work_orders')
    op.drop_index('idx_wo_machine_scheduled_start', table_name='work_orders')

    # MBF Report
    op.drop_index('idx_mbf_report_details_report_id', table_name='mbf_report_details')
    op.drop_index('idx_mbf_reports_created_at', table_name='mbf_reports')
    op.drop_index('idx_mbf_reports_manager_id', table_name='mbf_reports')
    op.drop_index('idx_mbf_reports_supervisor_id', table_name='mbf_reports')
    op.drop_index('idx_mbf_reports_created_by', table_name='mbf_reports')

    # OEE
    op.drop_index('idx_oee_records_created_at', table_name='oee_records')
    op.drop_index('idx_oee_records_status', table_name='oee_records')
    op.drop_index('idx_oee_records_created_by', table_name='oee_records')
    op.drop_index('idx_oee_records_machine_id', table_name='oee_records')

    # Notifications
    op.drop_index('idx_notifications_is_read', table_name='notifications')
    op.drop_index('idx_notifications_notification_type', table_name='notifications')
    op.drop_index('idx_notifications_related_user_id', table_name='notifications')

    # RND
    op.drop_index('idx_rnd_projects_created_at', table_name='rnd_projects')
    op.drop_index('idx_rnd_projects_start_date', table_name='rnd_projects')
    op.drop_index('idx_rnd_projects_status', table_name='rnd_projects')
    op.drop_index('idx_rnd_projects_approved_by', table_name='rnd_projects')
    op.drop_index('idx_rnd_projects_created_by', table_name='rnd_projects')

    # Quality
    op.drop_index('idx_quality_inspections_created_at', table_name='quality_inspections')
    op.drop_index('idx_quality_inspections_inspection_date', table_name='quality_inspections')
    op.drop_index('idx_quality_inspections_status', table_name='quality_inspections')
    op.drop_index('idx_quality_inspections_approved_by', table_name='quality_inspections')
    op.drop_index('idx_quality_inspections_created_by', table_name='quality_inspections')
    op.drop_index('idx_quality_inspections_work_order_id', table_name='quality_inspections')
    op.drop_index('idx_quality_inspections_material_id', table_name='quality_inspections')
    op.drop_index('idx_quality_inspections_product_id', table_name='quality_inspections')

    # Maintenance
    op.drop_index('idx_maintenance_records_created_at', table_name='maintenance_records')
    op.drop_index('idx_maintenance_records_scheduled_date', table_name='maintenance_records')
    op.drop_index('idx_maintenance_records_status', table_name='maintenance_records')
    op.drop_index('idx_maintenance_records_completed_by', table_name='maintenance_records')
    op.drop_index('idx_maintenance_records_assigned_to', table_name='maintenance_records')
    op.drop_index('idx_maintenance_records_created_by', table_name='maintenance_records')
    op.drop_index('idx_maintenance_records_machine_id', table_name='maintenance_records')

    # HR
    op.drop_index('idx_leaves_created_at', table_name='leaves')
    op.drop_index('idx_leaves_status', table_name='leaves')
    op.drop_index('idx_leaves_approved_by', table_name='leaves')
    op.drop_index('idx_leaves_employee_id', table_name='leaves')
    op.drop_index('idx_attendances_created_at', table_name='attendances')
    op.drop_index('idx_attendances_status', table_name='attendances')
    op.drop_index('idx_attendances_employee_id', table_name='attendances')
    op.drop_index('idx_attendances_user_id', table_name='attendances')
    op.drop_index('idx_employees_created_at', table_name='employees')
    op.drop_index('idx_employees_is_active', table_name='employees')
    op.drop_index('idx_employees_department_id', table_name='employees')

    # Finance
    op.drop_index('idx_payments_created_at', table_name='payments')
    op.drop_index('idx_payments_status', table_name='payments')
    op.drop_index('idx_payments_created_by', table_name='payments')
    op.drop_index('idx_payments_invoice_id', table_name='payments')
    op.drop_index('idx_payments_supplier_id', table_name='payments')
    op.drop_index('idx_payments_customer_id', table_name='payments')
    op.drop_index('idx_invoices_created_at', table_name='invoices')
    op.drop_index('idx_invoices_status', table_name='invoices')
    op.drop_index('idx_invoices_created_by', table_name='invoices')
    op.drop_index('idx_invoices_work_order_id', table_name='invoices')
    op.drop_index('idx_invoices_purchase_order_id', table_name='invoices')
    op.drop_index('idx_invoices_sales_order_id', table_name='invoices')
    op.drop_index('idx_invoices_supplier_id', table_name='invoices')
    op.drop_index('idx_invoices_customer_id', table_name='invoices')

    # Purchasing
    op.drop_index('idx_purchase_orders_created_at', table_name='purchase_orders')
    op.drop_index('idx_purchase_orders_status', table_name='purchase_orders')
    op.drop_index('idx_purchase_orders_approved_by', table_name='purchase_orders')
    op.drop_index('idx_purchase_orders_created_by', table_name='purchase_orders')
    op.drop_index('idx_purchase_orders_supplier_id', table_name='purchase_orders')
    op.drop_index('idx_suppliers_created_at', table_name='suppliers')
    op.drop_index('idx_suppliers_is_active', table_name='suppliers')

    # Sales
    op.drop_index('idx_sales_orders_created_at', table_name='sales_orders')
    op.drop_index('idx_sales_orders_status', table_name='sales_orders')
    op.drop_index('idx_sales_orders_created_by', table_name='sales_orders')
    op.drop_index('idx_sales_orders_customer_id', table_name='sales_orders')
    op.drop_index('idx_opportunities_created_at', table_name='opportunities')
    op.drop_index('idx_opportunities_created_by', table_name='opportunities')
    op.drop_index('idx_opportunities_stage_id', table_name='opportunities')
    op.drop_index('idx_opportunities_assigned_to', table_name='opportunities')
    op.drop_index('idx_opportunities_customer_id', table_name='opportunities')
    op.drop_index('idx_opportunities_lead_id', table_name='opportunities')
    op.drop_index('idx_leads_created_at', table_name='leads')
    op.drop_index('idx_leads_lead_status', table_name='leads')
    op.drop_index('idx_leads_created_by', table_name='leads')
    op.drop_index('idx_leads_converted_to_customer_id', table_name='leads')
    op.drop_index('idx_leads_assigned_to', table_name='leads')

    # Warehouse
    op.drop_index('idx_inventory_movements_created_by', table_name='inventory_movements')
    op.drop_index('idx_inventory_movements_location_id', table_name='inventory_movements')
    op.drop_index('idx_inventory_movements_material_id', table_name='inventory_movements')
    op.drop_index('idx_inventory_movements_product_id', table_name='inventory_movements')
    op.drop_index('idx_inventory_expiry_date', table_name='inventory')
    op.drop_index('idx_inventory_created_by', table_name='inventory')
    op.drop_index('idx_inventory_grn_id', table_name='inventory')
    op.drop_index('idx_inventory_work_order_id', table_name='inventory')
    op.drop_index('idx_inventory_qc_inspection_id', table_name='inventory')
    op.drop_index('idx_inventory_is_active', table_name='inventory')
    op.drop_index('idx_inventory_stock_status', table_name='inventory')
    op.drop_index('idx_warehouse_locations_zone_id', table_name='warehouse_locations')

    # Production
    op.drop_index('idx_work_orders_created_at', table_name='work_orders')
    op.drop_index('idx_work_orders_actual_end_date', table_name='work_orders')
    op.drop_index('idx_work_orders_actual_start_date', table_name='work_orders')
    op.drop_index('idx_work_orders_scheduled_end_date', table_name='work_orders')
    op.drop_index('idx_work_orders_scheduled_start_date', table_name='work_orders')
    op.drop_index('idx_work_orders_status', table_name='work_orders')
    op.drop_index('idx_work_orders_product_id', table_name='work_orders')
    op.drop_index('idx_work_orders_machine_id', table_name='work_orders')
    op.drop_index('idx_bom_items_material_id', table_name='bom_items')
    op.drop_index('idx_bom_items_product_id', table_name='bom_items')
    op.drop_index('idx_bom_items_bom_id', table_name='bom_items')
    op.drop_index('idx_bom_approved_by', table_name='bill_of_materials')
    op.drop_index('idx_bom_created_by', table_name='bill_of_materials')
    op.drop_index('idx_bom_product_id', table_name='bill_of_materials')
    op.drop_index('idx_machines_machine_type', table_name='machines')
    op.drop_index('idx_machines_is_active', table_name='machines')
    op.drop_index('idx_machines_status', table_name='machines')

    # User-related
    op.drop_index('idx_users_last_login', table_name='users')
    op.drop_index('idx_users_created_at', table_name='users')
    op.drop_index('idx_users_is_active', table_name='users')
