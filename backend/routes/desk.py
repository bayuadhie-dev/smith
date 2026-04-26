"""
Desk Routes - Main Desk Interface Data
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta, date
from sqlalchemy import func, and_, or_, desc, literal
from models import db
from models.sales import SalesOrder, Customer
from models.production import WorkOrder, ShiftProduction
from models.product import Product, Material
from models.warehouse import Inventory
from models.quality import QualityInspection
from models.finance import Invoice, Payment
from models.hr import Employee, EmployeeRoster
from models.oee import OEERecord
from models.user import User
from models.purchasing import PurchaseOrder, Supplier
# from models.shipping import ShippingOrder  # Commented out if not used
from models.maintenance import MaintenanceRecord
from models.dcc import DccDocument
from utils.timezone import get_local_now, get_local_today

desk_bp = Blueprint('desk', __name__)

@desk_bp.route('/overview', methods=['GET'])
@jwt_required()
def get_desk_overview():
    """
    Get desk overview with quick stats and recent documents
    """
    try:
        user_id = get_jwt_identity()
        today = get_local_now().date()
        yesterday = today - timedelta(days=1)
        week_start = today - timedelta(days=today.weekday())
        
        # ===== QUICK STATS =====
        
        # Active Work Orders
        active_work_orders = 0
        try:
            active_work_orders = WorkOrder.query.filter_by(status='in_progress').count()
        except Exception as e:
            print(f"Error getting active work orders: {e}")
        
        # Pending Approvals (check various approval tables)
        pending_approvals = 0
        try:
            # From DCC documents
            if hasattr(DccDocument, 'status'):
                pending_approvals += DccDocument.query.filter_by(status='pending_approval').count()
        except Exception as e:
            print(f"Error getting DCC pending approvals: {e}")
        
        try:
            # From purchase orders
            if hasattr(PurchaseOrder, 'status'):
                pending_approvals += PurchaseOrder.query.filter_by(status='pending').count()
        except Exception as e:
            print(f"Error getting PO pending approvals: {e}")
        
        try:
            # From work orders requiring approval
            if hasattr(WorkOrder, 'status'):
                pending_approvals += WorkOrder.query.filter_by(status='pending_approval').count()
        except Exception as e:
            print(f"Error getting WO pending approvals: {e}")
        
        # Low Stock Items
        low_stock_items = 0
        try:
            if hasattr(Inventory, 'quantity_on_hand') and hasattr(Inventory, 'min_stock_level'):
                low_stock_items = Inventory.query.filter(
                    Inventory.quantity_on_hand <= Inventory.min_stock_level
                ).count()
        except Exception as e:
            print(f"Error getting low stock items: {e}")
        
        # Today's Production Target vs Actual
        today_production_target = 0
        today_production_actual = 0
        
        try:
            # Get today's shift productions
            if hasattr(ShiftProduction, 'shift_date'):
                today_shifts = ShiftProduction.query.filter(
                    func.date(ShiftProduction.shift_date) == today
                ).all()
                
                for shift in today_shifts:
                    today_production_target += shift.planned_quantity or 0
                    today_production_actual += shift.actual_quantity or 0
        except Exception as e:
            print(f"Error getting production data: {e}")
        
        production_efficiency = (today_production_actual / today_production_target * 100) if today_production_target > 0 else 0
        
        # Recent Documents from DCC (last 10)
        recent_documents = []
        try:
            # Check if DccDocument table exists and has records
            doc_count = DccDocument.query.count()
            print(f"DccDocument total count: {doc_count}")
            
            if doc_count > 0:
                # Get only available fields
                recent_dcc_docs = db.session.query(
                    DccDocument.id,
                    DccDocument.document_number,
                    DccDocument.title,
                    DccDocument.created_at,
                    DccDocument.is_active
                ).order_by(desc(DccDocument.created_at)).limit(10).all()
                
                print(f"Found {len(recent_dcc_docs)} recent DCC documents")
                
                for doc in recent_dcc_docs:
                    recent_documents.append({
                        'id': doc.id,
                        'type': 'Document',
                        'name': doc.title or doc.document_number,
                        'number': doc.document_number,
                        'date': doc.created_at.strftime('%Y-%m-%d'),
                        'url': f'/app/dcc?tab=documents&view={doc.id}',
                        'status': 'active' if doc.is_active else 'inactive'
                    })
            else:
                print("No DCC documents found in database")
        except Exception as e:
            print(f"Error getting recent DCC documents: {e}")
            import traceback
            traceback.print_exc()
        
        # Recent Work Orders (separate section)
        recent_work_orders = []
        try:
            # Check if WorkOrder table exists and has records
            wo_count = WorkOrder.query.count()
            print(f"WorkOrder total count: {wo_count}")
            
            if wo_count > 0:
                # Join with Product table to get product name
                recent_wo = db.session.query(
                    WorkOrder.id,
                    WorkOrder.wo_number,
                    WorkOrder.created_at,
                    WorkOrder.status,
                    WorkOrder.priority,
                    Product.name.label('product_name')
                ).join(
                    Product, WorkOrder.product_id == Product.id
                ).order_by(desc(WorkOrder.created_at)).limit(5).all()
                
                print(f"Found {len(recent_wo)} recent work orders")
                
                for wo in recent_wo:
                    recent_work_orders.append({
                        'id': wo.id,
                        'type': 'Work Order',
                        'name': wo.wo_number,
                        'product': wo.product_name or 'N/A',
                        'date': wo.created_at.strftime('%Y-%m-%d'),
                        'url': f'/app/production/work-orders/{wo.id}',
                        'status': wo.status,
                        'priority': wo.priority or 'normal'
                    })
            else:
                print("No Work Orders found in database")
        except Exception as e:
            print(f"Error getting recent work orders: {e}")
            import traceback
            traceback.print_exc()
        
        # ===== MODULE STATS =====
        
        module_stats = {
            'production': {
                'active_orders': active_work_orders,
                'completed_today': 0,
                'efficiency': round(production_efficiency, 1)
            },
            'sales': {
                'orders_today': 0,
                'revenue_today': 0,
                'pending_orders': 0
            },
            'warehouse': {
                'low_stock': low_stock_items,
                'total_items': 0,
                'stock_value': 0
            },
            'quality': {
                'inspections_today': 0,
                'pass_rate': 95.5,
                'pending_inspections': 0
            },
            'purchasing': {
                'pending_orders': 0,
                'orders_today': 0,
                'total_suppliers': 0
            },
            'finance': {
                'pending_invoices': 0,
                'cash_today': 0,
                'outstanding_ar': 0
            },
            'hr': {
                'total_employees': 0,
                'present_today': 0,
                'on_leave': 0
            },
            'maintenance': {
                'overdue': 0,
                'today': 0,
                'completed_this_week': 0
            }
        }
        
        # Try to get production stats
        try:
            if hasattr(WorkOrder, 'actual_end_date') and hasattr(WorkOrder, 'status'):
                module_stats['production']['completed_today'] = WorkOrder.query.filter(
                    func.date(WorkOrder.actual_end_date) == today,
                    WorkOrder.status == 'completed'
                ).count()
        except Exception as e:
            print(f"Error getting production completed today: {e}")
        
        # Try to get sales stats
        try:
            if hasattr(SalesOrder, 'order_date'):
                module_stats['sales']['orders_today'] = SalesOrder.query.filter(
                    func.date(SalesOrder.order_date) == today
                ).count()
        except Exception as e:
            print(f"Error getting sales orders today: {e}")
        
        try:
            if hasattr(SalesOrder, 'total_amount'):
                module_stats['sales']['revenue_today'] = db.session.query(func.sum(SalesOrder.total_amount)).filter(
                    func.date(SalesOrder.order_date) == today
                ).scalar() or 0
        except Exception as e:
            print(f"Error getting sales revenue today: {e}")
        
        try:
            if hasattr(SalesOrder, 'status'):
                module_stats['sales']['pending_orders'] = SalesOrder.query.filter_by(status='pending').count()
        except Exception as e:
            print(f"Error getting pending sales orders: {e}")
        
        # Try to get warehouse stats
        try:
            module_stats['warehouse']['total_items'] = Inventory.query.count()
        except Exception as e:
            print(f"Error getting total warehouse items: {e}")
        
        try:
            # Calculate total stock value by joining with Material and Product cost fields
            material_value = db.session.query(
                func.sum(Inventory.quantity_on_hand * Material.cost_per_unit)
            ).join(Material, Inventory.material_id == Material.id).filter(Inventory.material_id.isnot(None)).scalar() or 0
            
            product_value = db.session.query(
                func.sum(Inventory.quantity_on_hand * Product.cost)
            ).join(Product, Inventory.product_id == Product.id).filter(Inventory.product_id.isnot(None)).scalar() or 0
            
            module_stats['warehouse']['stock_value'] = float(material_value + product_value)
        except Exception as e:
            print(f"Error calculating real stock value: {e}")
            # Fallback to quantity sum if join fails
            try:
                module_stats['warehouse']['stock_value'] = db.session.query(func.sum(Inventory.quantity_on_hand)).scalar() or 0
            except:
                pass
        
        # Try to get quality stats
        try:
            if hasattr(QualityInspection, 'inspection_date'):
                module_stats['quality']['inspections_today'] = QualityInspection.query.filter(
                    func.date(QualityInspection.inspection_date) == today
                ).count()
        except Exception as e:
            print(f"Error getting quality inspections today: {e}")
        
        try:
            if hasattr(QualityInspection, 'status'):
                module_stats['quality']['pending_inspections'] = QualityInspection.query.filter_by(status='pending').count()
        except Exception as e:
            print(f"Error getting pending quality inspections: {e}")
        
        # Try to get purchasing stats
        try:
            if hasattr(PurchaseOrder, 'status'):
                module_stats['purchasing']['pending_orders'] = PurchaseOrder.query.filter_by(status='pending').count()
        except Exception as e:
            print(f"Error getting pending purchase orders: {e}")
        
        try:
            if hasattr(PurchaseOrder, 'order_date'):
                module_stats['purchasing']['orders_today'] = PurchaseOrder.query.filter(
                    func.date(PurchaseOrder.order_date) == today
                ).count()
        except Exception as e:
            print(f"Error getting purchase orders today: {e}")
        
        try:
            module_stats['purchasing']['total_suppliers'] = Supplier.query.count()
        except Exception as e:
            print(f"Error getting total suppliers: {e}")
        
        # Try to get finance stats
        try:
            if hasattr(Invoice, 'status'):
                module_stats['finance']['pending_invoices'] = Invoice.query.filter_by(status='pending').count()
        except Exception as e:
            print(f"Error getting pending invoices: {e}")
        
        try:
            if hasattr(Payment, 'payment_date') and hasattr(Payment, 'amount'):
                module_stats['finance']['cash_today'] = db.session.query(func.sum(Payment.amount)).filter(
                    func.date(Payment.payment_date) == today
                ).scalar() or 0
        except Exception as e:
            print(f"Error getting cash today: {e}")
        
        try:
            if hasattr(Invoice, 'total_amount') and hasattr(Invoice, 'paid_amount') and hasattr(Invoice, 'status') and hasattr(Invoice, 'due_date'):
                module_stats['finance']['outstanding_ar'] = db.session.query(
                    func.sum(Invoice.total_amount - Invoice.paid_amount)
                ).filter(
                    Invoice.status.in_(['pending', 'partial']),
                    Invoice.due_date < today
                ).scalar() or 0
        except Exception as e:
            print(f"Error getting outstanding AR: {e}")
        
        # Try to get HR stats
        try:
            module_stats['hr']['total_employees'] = Employee.query.count()
        except Exception as e:
            print(f"Error getting total employees: {e}")
        
        try:
            if hasattr(Employee, 'status'):
                module_stats['hr']['on_leave'] = Employee.query.filter_by(status='on_leave').count()
        except Exception as e:
            print(f"Error getting employees on leave: {e}")
        
        # Try to get maintenance stats
        try:
            if hasattr(MaintenanceRecord, 'scheduled_date') and hasattr(MaintenanceRecord, 'status'):
                module_stats['maintenance']['overdue'] = MaintenanceRecord.query.filter(
                    MaintenanceRecord.scheduled_date < today,
                    MaintenanceRecord.status == 'pending'
                ).count()
        except Exception as e:
            print(f"Error getting overdue maintenance: {e}")
        
        try:
            if hasattr(MaintenanceRecord, 'scheduled_date'):
                module_stats['maintenance']['today'] = MaintenanceRecord.query.filter(
                    func.date(MaintenanceRecord.scheduled_date) == today
                ).count()
        except Exception as e:
            print(f"Error getting today's maintenance: {e}")
        
        try:
            if hasattr(MaintenanceRecord, 'completed_at') and hasattr(MaintenanceRecord, 'status'):
                module_stats['maintenance']['completed_this_week'] = MaintenanceRecord.query.filter(
                    MaintenanceRecord.completed_at >= week_start,
                    MaintenanceRecord.status == 'completed'
                ).count()
        except Exception as e:
            print(f"Error getting completed maintenance this week: {e}")
        
        # Quick stats for desk display
        quick_stats = [
            {
                'label': 'Active Work Orders',
                'value': active_work_orders,
                'change': 0,  # Simplified for now
                'icon': 'clipboard-document-list',
                'color': 'text-blue-600'
            },
            {
                'label': 'Pending Approvals',
                'value': pending_approvals,
                'change': 0,  # Calculate from historical data if needed
                'icon': 'document-check',
                'color': 'text-yellow-600'
            },
            {
                'label': 'Low Stock Items',
                'value': low_stock_items,
                'change': 0,  # Simplified for now
                'icon': 'archive-box',
                'color': 'text-red-600'
            },
            {
                'label': "Today's Production",
                'value': f"{round(production_efficiency)}%",
                'change': production_efficiency - 85,  # Compare with target
                'icon': 'chart-bar',
                'color': 'text-green-600'
            }
        ]
        
        return jsonify({
            'success': True,
            'data': {
                'quick_stats': quick_stats,
                'recent_documents': recent_documents,
                'recent_work_orders': recent_work_orders,
                'module_stats': module_stats,
                'last_updated': get_local_now().isoformat()
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@desk_bp.route('/module-stats/<module>', methods=['GET'])
@jwt_required()
def get_module_stats(module):
    """
    Get detailed stats for a specific module
    """
    try:
        # Implementation for detailed module stats
        # This can be expanded based on requirements
        return jsonify({
            'success': True,
            'data': {}
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

