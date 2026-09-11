from datetime import datetime
from . import db
from sqlalchemy import event
from .sales import SalesOrder, SalesOrderItem
from .production import WorkOrder, ProductionRecord, ShiftProduction
from .purchasing import PurchaseOrder, PurchaseOrderItem
from .warehouse import Inventory, InventoryMovement
from .quality import QualityInspection
from .shipping import ShippingOrder
from .finance import Invoice, InvoiceItem
from .returns import CustomerReturn
from .maintenance import MaintenanceRecord
from utils.timezone import get_local_now

# ===============================
# WORKFLOW INTEGRATION MODELS
# ===============================

class WorkflowStep(db.Model):
    """Track workflow steps for each business process"""
    __tablename__ = 'workflow_steps'
    
    id = db.Column(db.Integer, primary_key=True)
    workflow_type = db.Column(db.String(50), nullable=False)  # order_to_cash, procure_to_pay, etc.
    reference_type = db.Column(db.String(50), nullable=False)  # sales_order, purchase_order, etc.
    reference_id = db.Column(db.Integer, nullable=False)
    step_name = db.Column(db.String(100), nullable=False)
    step_order = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(50), nullable=False, default='pending')  # pending, in_progress, completed, failed
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

class MRPRequirement(db.Model):
    """MRP requirements generated from sales orders/forecasts"""
    __tablename__ = 'mrp_requirements'
    
    id = db.Column(db.Integer, primary_key=True)
    requirement_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    
    # Source
    source_type = db.Column(db.String(50), nullable=False)  # sales_order, sales_forecast
    source_id = db.Column(db.Integer, nullable=False)
    
    # Product Requirements
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    required_quantity = db.Column(db.Numeric(15, 2), nullable=False)
    required_date = db.Column(db.Date, nullable=False)
    
    # MRP Analysis Results
    current_stock = db.Column(db.Numeric(15, 2), default=0)
    reserved_stock = db.Column(db.Numeric(15, 2), default=0)
    available_stock = db.Column(db.Numeric(15, 2), default=0)
    shortage_quantity = db.Column(db.Numeric(15, 2), default=0)
    
    # Actions Required
    needs_purchase = db.Column(db.Boolean, default=False)
    needs_production = db.Column(db.Boolean, default=False)
    
    # Status
    status = db.Column(db.String(50), nullable=False, default='pending')  # pending, analyzed, action_taken
    analyzed_at = db.Column(db.DateTime, nullable=True)
    analyzed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    product = db.relationship('Product')
    analyzer = db.relationship('User')

class ProductionBuffer(db.Model):
    """Track excess production that goes to buffer stock"""
    __tablename__ = 'production_buffer'
    
    id = db.Column(db.Integer, primary_key=True)
    buffer_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    
    # Source Production
    work_order_id = db.Column(db.Integer, db.ForeignKey('work_orders.id'), nullable=True)
    shift_production_id = db.Column(db.Integer, db.ForeignKey('shift_productions.id'), nullable=True)
    
    # Product Info
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    target_quantity = db.Column(db.Numeric(15, 2), nullable=False)
    actual_quantity = db.Column(db.Numeric(15, 2), nullable=False)
    excess_quantity = db.Column(db.Numeric(15, 2), nullable=False)
    
    # Buffer Status
    status = db.Column(db.String(50), nullable=False, default='pending')  # pending, moved_to_warehouse, allocated
    moved_to_warehouse_at = db.Column(db.DateTime, nullable=True)
    warehouse_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    work_order = db.relationship('WorkOrder')
    shift_production = db.relationship('ShiftProduction')
    product = db.relationship('Product')
    warehouse_location = db.relationship('WarehouseLocation')

# ===============================
# WORKFLOW AUTOMATION FUNCTIONS
# ===============================

class WorkflowAutomation:
    """Main class for handling workflow automation"""
    
    @staticmethod
    def trigger_mrp_from_sales_order(sales_order_id):
        """Trigger MRP analysis when sales order is confirmed"""
        from .sales import SalesOrder, SalesOrderItem
        
        sales_order = SalesOrder.query.get(sales_order_id)
        if not sales_order:
            return False
            
        # Create MRP requirements for each sales order item
        for item in sales_order.items:
            mrp_req = MRPRequirement(
                requirement_number=f"MRP-{sales_order.order_number}-{item.id}",
                source_type='sales_order',
                source_id=sales_order.id,
                product_id=item.product_id,
                required_quantity=item.quantity,
                required_date=sales_order.delivery_date or sales_order.order_date
            )
            db.session.add(mrp_req)
        
        # Create workflow step
        workflow_step = WorkflowStep(
            workflow_type='order_to_cash',
            reference_type='sales_order',
            reference_id=sales_order.id,
            step_name='MRP Analysis',
            step_order=1,
            status='pending'
        )
        db.session.add(workflow_step)
        
        try:
            db.session.commit()
            # Trigger MRP analysis
            WorkflowAutomation.analyze_mrp_requirements(sales_order_id)
            return True
        except Exception as e:
            db.session.rollback()
            return False
    
    @staticmethod
    def analyze_mrp_requirements(sales_order_id):
        """Analyze MRP requirements and determine actions needed"""
        from .warehouse import Inventory
        
        mrp_requirements = MRPRequirement.query.filter_by(
            source_type='sales_order',
            source_id=sales_order_id,
            status='pending'
        ).all()
        
        for req in mrp_requirements:
            # Get current inventory - SUM across all locations/batches, not
            # just the first row, since a product can have several Inventory
            # rows (one per location). Column names are quantity_on_hand /
            # quantity_reserved / quantity_available on the real Inventory
            # model (models/warehouse.py) - this previously read .quantity /
            # .reserved_quantity / .available_quantity, which don't exist and
            # raised AttributeError on every call (see create_production_orders_from_mrp
            # fix note above - same root cause, this function's crash is what
            # actually made that one unreachable).
            inv_rows = Inventory.query.filter_by(product_id=req.product_id, is_active=True).all()
            if inv_rows:
                # Keep these as Decimal, not float - req.required_quantity below is Decimal
                # (Numeric column) and Decimal-float raises TypeError, which the outer
                # try/except silently swallows and rolls back, leaving status stuck at 'pending'.
                req.current_stock = sum((i.quantity_on_hand or 0) for i in inv_rows)
                req.reserved_stock = sum((i.quantity_reserved or 0) for i in inv_rows)
                req.available_stock = sum((i.quantity_available or 0) for i in inv_rows)

            # Calculate shortage
            shortage = req.required_quantity - (req.available_stock or 0)
            req.shortage_quantity = max(0, shortage)
            
            # Determine actions needed
            if req.shortage_quantity > 0:
                # Check if we can produce or need to purchase
                # For now, assume we can produce if it's our product
                req.needs_production = True
                req.needs_purchase = False  # Will be determined by BOM analysis
            
            req.status = 'analyzed'
            req.analyzed_at = get_local_now()
        
        try:
            db.session.commit()
            # Trigger next steps based on analysis
            WorkflowAutomation.create_production_orders_from_mrp(sales_order_id)
            return True
        except Exception as e:
            db.session.rollback()
            return False
    
    @staticmethod
    def create_production_orders_from_mrp(sales_order_id):
        """Create work orders based on MRP analysis"""
        from .production import WorkOrder
        from .sales import SalesOrder
        from .product import Product
        from utils import generate_number

        sales_order = SalesOrder.query.get(sales_order_id)
        mrp_requirements = MRPRequirement.query.filter_by(
            source_type='sales_order',
            source_id=sales_order_id,
            status='analyzed',
            needs_production=True
        ).all()
        
        for req in mrp_requirements:
            if req.shortage_quantity > 0:
                # Create work order for shortage quantity
                # MRPRequirement has no `product` relationship - look up Product directly.
                product = db.session.get(Product, req.product_id)
                # NOTE: wo_number/quantity are WorkOrder's real column names (see
                # models/production.py) - this previously used work_order_number/
                # quantity_to_produce, which don't exist on the model at all and
                # raised TypeError on every single call, silently swallowed by the
                # nested try/except chain in trigger_mrp_from_sales_order() /
                # analyze_mrp_requirements() above. No WorkOrder was ever actually
                # created via SO confirmation before this fix (2026-08-24).
                work_order = WorkOrder(
                    wo_number=generate_number('WO', WorkOrder, 'wo_number'),
                    product_id=req.product_id,
                    quantity=req.shortage_quantity,
                    uom=product.primary_uom if product else 'PCS',
                    required_date=req.required_date,
                    sales_order_id=sales_order_id,  # Link to sales order
                    # machine_id intentionally left unset - Batch Scheduling's own
                    # design (R2) requires PPIC to assign the machine manually per
                    # WorkOrder (Machine.code isn't guaranteed to be a clean number,
                    # so it can't be inferred automatically). This WO won't appear
                    # in Batch Planning's Generate/Re-plan until that's done - see
                    # utils/batch_scheduling_algorithm.py's WorkOrder.machine_id
                    # filter. Not a bug; matches the documented Batch Scheduling plan.
                    status='planned',
                    priority='normal'
                )
                db.session.add(work_order)
        
        # Update workflow step
        workflow_step = WorkflowStep.query.filter_by(
            workflow_type='order_to_cash',
            reference_type='sales_order',
            reference_id=sales_order_id,
            step_name='MRP Analysis'
        ).first()
        
        if workflow_step:
            workflow_step.status = 'completed'
            workflow_step.completed_at = get_local_now()
        
        # Create next workflow step
        next_step = WorkflowStep(
            workflow_type='order_to_cash',
            reference_type='sales_order',
            reference_id=sales_order_id,
            step_name='Production Planning',
            step_order=2,
            status='pending'
        )
        db.session.add(next_step)
        
        try:
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            return False
    
    @staticmethod
    def handle_production_completion(shift_production_id):
        """Handle production completion and buffer stock creation"""
        shift_production = ShiftProduction.query.get(shift_production_id)
        if not shift_production:
            return False
        
        work_order = shift_production.work_order
        if not work_order:
            return False
        
        # Check if production exceeded target
        if shift_production.actual_quantity > shift_production.target_quantity:
            excess_qty = shift_production.actual_quantity - shift_production.target_quantity
            
            # Create buffer stock record
            buffer = ProductionBuffer(
                buffer_number=f"BUF-{work_order.work_order_number}-{shift_production.id}",
                work_order_id=work_order.id,
                shift_production_id=shift_production.id,
                product_id=work_order.product_id,
                target_quantity=shift_production.target_quantity,
                actual_quantity=shift_production.actual_quantity,
                excess_quantity=excess_qty,
                status='pending'
            )
            db.session.add(buffer)
        
        # Move production to warehouse (both target and excess)
        WorkflowAutomation.move_production_to_warehouse(shift_production_id)
        
        # Trigger quality control
        WorkflowAutomation.trigger_quality_control(shift_production_id)
        
        try:
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            return False
    
    @staticmethod
    def move_production_to_warehouse(shift_production_id):
        """Move completed production to warehouse"""
        from .warehouse import InventoryMovement
        
        shift_production = ShiftProduction.query.get(shift_production_id)
        if not shift_production:
            return False
        
        # Create inventory movement for production completion
        movement = InventoryMovement(
            product_id=shift_production.product_id,
            movement_type='production_complete',
            quantity=shift_production.actual_quantity,
            reference_type='shift_production',
            reference_id=shift_production_id,
            movement_date=get_local_now().date(),
            created_by=shift_production.operator_id or 1,  # Default to system user
            notes=f"Production completion from {shift_production.work_order.wo_number}"
        )
        db.session.add(movement)
        
        return True
    
    @staticmethod
    def trigger_quality_control(shift_production_id):
        """Trigger quality control for completed production"""
        from .quality import QualityInspection
        from utils import generate_number
        
        shift_production = ShiftProduction.query.get(shift_production_id)
        if not shift_production:
            return False
        
        # Create quality inspection
        inspection = QualityInspection(
            inspection_number=generate_number('QI', QualityInspection, 'inspection_number'),
            product_id=shift_production.product_id,
            batch_number=f"BATCH-{shift_production.id}",
            quantity_inspected=shift_production.actual_quantity,
            inspection_type='production',
            reference_type='shift_production',
            reference_id=shift_production_id,
            status='pending',
            inspection_date=get_local_now().date()
        )
        db.session.add(inspection)
        
        return True

# ===============================
# DATABASE EVENT LISTENERS
# ===============================

# Disabled: same session-state bug as the ShiftProduction listener below —
# registering a new `after_commit` listener that synchronously queries/commits
# on the SAME session inside the `after_commit` dispatch fails with
# "sqlalchemy.exc.InvalidRequestError: This session is in 'committed' state;
# no further SQL can be emitted within this transaction" (confirmed live,
# 2026-08-19 — this broke EVERY `PUT /api/sales/orders/<id>/confirm` call,
# not just ones related to auto-reserve). The correct pattern (see
# utils/production_events.py `fire_pending_wa_notifications`) is to defer
# the actual work to a background thread with its own fresh app_context,
# not reuse the just-committed session synchronously.
#
# Also: WorkflowAutomation.analyze_mrp_requirements() reads
# Inventory.quantity/.reserved_quantity/.available_quantity, none of which
# exist on the Inventory model (real columns are quantity_on_hand /
# quantity_reserved / quantity_available) — this chain has never completed
# a single run (mrp_requirements/workflow_steps are both 0 rows in
# production) even setting the session-state bug aside. Left disabled
# rather than rewritten — this whole legacy MRP-automation subsystem is a
# candidate for its own review/decommission, out of scope here.
#
# @event.listens_for(SalesOrder, 'after_update')
# def sales_order_status_changed(mapper, connection, target):
#     """Trigger workflow when sales order status changes"""
#     if target.status == 'confirmed':
#         # Use after_commit to ensure transaction is complete
#         @event.listens_for(db.session, 'after_commit', once=True)
#         def trigger_mrp(session):
#             WorkflowAutomation.trigger_mrp_from_sales_order(target.id)

# Disabled: Causing session state issues in after_commit handler
# @event.listens_for(ShiftProduction, 'after_update')
# def production_completed(mapper, connection, target):
#     """Trigger workflow when production is completed"""
#     if target.status == 'completed':
#         @event.listens_for(db.session, 'after_commit', once=True)
#         def handle_completion(session):
#             WorkflowAutomation.handle_production_completion(target.id)
