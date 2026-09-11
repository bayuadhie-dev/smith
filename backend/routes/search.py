"""
Global Search Routes - Search across all modules
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_, and_, func
from models import db, User
from models.product import Product
from models.sales import SalesOrder, Customer
from models.production import WorkOrder
from models.purchasing import PurchaseOrder, Supplier
from models.warehouse import Inventory
from models.quality import QualityInspection
from models.hr import Employee
from models.dcc import DccDocument
from models.maintenance import MaintenanceRecord
from utils.auth_decorators import _get_user_permissions

search_bp = Blueprint('search', __name__)


def _can_view(module, perms, bypass):
    """A search section is only included if the current user can view that module."""
    return bypass or f'{module}.view' in perms


@search_bp.route('/global', methods=['GET'])
@jwt_required()
def global_search():
    """
    Global search across all modules - each section is filtered by the
    caller's own module permissions, so a user only ever sees results from
    modules they're actually allowed to view.
    """
    try:
        current_user_id = get_jwt_identity()
        current_user = db.session.get(User, int(current_user_id))
        bypass = bool(current_user and (current_user.is_admin or getattr(current_user, 'is_super_admin', False)))
        perms = _get_user_permissions(current_user) if current_user and not bypass else set()

        query = request.args.get('q', '').strip()
        module_filter = request.args.get('module', 'all')
        limit = int(request.args.get('limit', 50))

        if not query:
            return jsonify({
                'success': True,
                'data': {
                    'results': [],
                    'total': 0,
                    'query': query
                }
            })

        results = []

        # Search Products
        if module_filter in ['all', 'products'] and _can_view('products', perms, bypass):
            try:
                products = Product.query.filter(
                    or_(
                        Product.name.ilike(f'%{query}%'),
                        Product.code.ilike(f'%{query}%'),
                        Product.description.ilike(f'%{query}%')
                    )
                ).limit(limit).all()
                
                for product in products:
                    results.append({
                        'id': product.id,
                        'type': 'Product',
                        'module': 'products',
                        'title': product.name,
                        'subtitle': product.code,
                        'description': product.description or '',
                        'url': f'/app/products/{product.id}',
                        'icon': 'cube',
                        'color': 'purple',
                        'metadata': {
                            'category': product.category or 'N/A',
                            'status': 'active' if product.is_active else 'inactive'
                        }
                    })
            except Exception as e:
                print(f"Error searching products: {e}")
        
        # Search Work Orders
        if module_filter in ['all', 'production'] and _can_view('production', perms, bypass):
            try:
                work_orders = WorkOrder.query.filter(
                    or_(
                        WorkOrder.wo_number.ilike(f'%{query}%'),
                        WorkOrder.notes.ilike(f'%{query}%')
                    )
                ).limit(limit).all()
                
                for wo in work_orders:
                    results.append({
                        'id': wo.id,
                        'type': 'Work Order',
                        'module': 'production',
                        'title': wo.wo_number,
                        'subtitle': f'Status: {wo.status}',
                        'description': wo.notes or '',
                        'url': f'/app/production/work-orders/{wo.id}',
                        'icon': 'clipboard-document-list',
                        'color': 'blue',
                        'metadata': {
                            'status': wo.status,
                            'priority': wo.priority or 'normal',
                            'date': wo.created_at.strftime('%Y-%m-%d') if wo.created_at else ''
                        }
                    })
            except Exception as e:
                print(f"Error searching work orders: {e}")
        
        # Search Sales Orders
        if module_filter in ['all', 'sales'] and _can_view('sales_orders', perms, bypass):
            try:
                sales_orders = SalesOrder.query.filter(
                    or_(
                        SalesOrder.order_number.ilike(f'%{query}%'),
                        SalesOrder.notes.ilike(f'%{query}%')
                    )
                ).limit(limit).all()
                
                for so in sales_orders:
                    results.append({
                        'id': so.id,
                        'type': 'Sales Order',
                        'module': 'sales',
                        'title': so.order_number,
                        'subtitle': f'Status: {so.status}',
                        'description': so.notes or '',
                        'url': f'/app/sales/orders/{so.id}',
                        'icon': 'shopping-cart',
                        'color': 'green',
                        'metadata': {
                            'status': so.status,
                            'total': f'Rp {so.total_amount:,.0f}' if so.total_amount else 'N/A',
                            'date': so.order_date.strftime('%Y-%m-%d') if so.order_date else ''
                        }
                    })
            except Exception as e:
                print(f"Error searching sales orders: {e}")
        
        # Search Customers
        if module_filter in ['all', 'sales'] and _can_view('customers', perms, bypass):
            try:
                customers = Customer.query.filter(
                    or_(
                        Customer.company_name.ilike(f'%{query}%'),
                        Customer.email.ilike(f'%{query}%'),
                        Customer.phone.ilike(f'%{query}%')
                    )
                ).limit(limit).all()
                
                for customer in customers:
                    results.append({
                        'id': customer.id,
                        'type': 'Customer',
                        'module': 'sales',
                        'title': customer.company_name,
                        'subtitle': customer.email or customer.phone or '',
                        'description': customer.billing_address or '',
                        'url': f'/app/sales/customers/{customer.id}',
                        'icon': 'user',
                        'color': 'green',
                        'metadata': {
                            'type': customer.customer_type or 'N/A',
                            'status': 'active' if customer.is_active else 'inactive'
                        }
                    })
            except Exception as e:
                print(f"Error searching customers: {e}")
        
        # Search Purchase Orders
        if module_filter in ['all', 'purchasing'] and _can_view('purchase_orders', perms, bypass):
            try:
                purchase_orders = PurchaseOrder.query.filter(
                    or_(
                        PurchaseOrder.po_number.ilike(f'%{query}%'),
                        PurchaseOrder.notes.ilike(f'%{query}%')
                    )
                ).limit(limit).all()
                
                for po in purchase_orders:
                    results.append({
                        'id': po.id,
                        'type': 'Purchase Order',
                        'module': 'purchasing',
                        'title': po.po_number,
                        'subtitle': f'Status: {po.status}',
                        'description': po.notes or '',
                        'url': f'/app/purchasing/orders/{po.id}',
                        'icon': 'shopping-bag',
                        'color': 'orange',
                        'metadata': {
                            'status': po.status,
                            'total': f'Rp {po.total_amount:,.0f}' if po.total_amount else 'N/A',
                            'date': po.order_date.strftime('%Y-%m-%d') if po.order_date else ''
                        }
                    })
            except Exception as e:
                print(f"Error searching purchase orders: {e}")
        
        # Search Suppliers
        if module_filter in ['all', 'purchasing'] and _can_view('suppliers', perms, bypass):
            try:
                suppliers = Supplier.query.filter(
                    or_(
                        Supplier.company_name.ilike(f'%{query}%'),
                        Supplier.email.ilike(f'%{query}%'),
                        Supplier.phone.ilike(f'%{query}%')
                    )
                ).limit(limit).all()
                
                for supplier in suppliers:
                    results.append({
                        'id': supplier.id,
                        'type': 'Supplier',
                        'module': 'purchasing',
                        'title': supplier.company_name,
                        'subtitle': supplier.email or supplier.phone or '',
                        'description': supplier.address or '',
                        'url': f'/app/purchasing/suppliers/{supplier.id}',
                        'icon': 'building-storefront',
                        'color': 'orange',
                        'metadata': {
                            'status': 'active' if supplier.is_active else 'inactive'
                        }
                    })
            except Exception as e:
                print(f"Error searching suppliers: {e}")
        
        # Search Employees
        if module_filter in ['all', 'hr'] and _can_view('employees', perms, bypass):
            try:
                employees = Employee.query.filter(
                    or_(
                        Employee.full_name.ilike(f'%{query}%'),
                        Employee.email.ilike(f'%{query}%'),
                        Employee.employee_number.ilike(f'%{query}%')
                    )
                ).limit(limit).all()
                
                for employee in employees:
                    results.append({
                        'id': employee.id,
                        'type': 'Employee',
                        'module': 'hr',
                        'title': employee.full_name,
                        'subtitle': employee.employee_number or '',
                        'description': employee.position or '',
                        'url': f'/app/hr/employees/{employee.id}',
                        'icon': 'user',
                        'color': 'indigo',
                        'metadata': {
                            'department': employee.department or 'N/A',
                            'status': employee.status or 'active'
                        }
                    })
            except Exception as e:
                print(f"Error searching employees: {e}")
        
        # Search DCC Documents
        if module_filter in ['all', 'dcc'] and _can_view('dcc', perms, bypass):
            try:
                documents = DccDocument.query.filter(
                    or_(
                        DccDocument.document_number.ilike(f'%{query}%'),
                        DccDocument.title.ilike(f'%{query}%')
                    )
                ).limit(limit).all()
                
                for doc in documents:
                    results.append({
                        'id': doc.id,
                        'type': 'Document',
                        'module': 'dcc',
                        'title': doc.title or doc.document_number,
                        'subtitle': doc.document_number,
                        'description': doc.document_level or '',
                        'url': f'/app/dcc?tab=documents&view={doc.id}',
                        'icon': 'document-text',
                        'color': 'red',
                        'metadata': {
                            'status': 'active' if doc.is_active else 'inactive',
                            'date': doc.created_at.strftime('%Y-%m-%d') if doc.created_at else ''
                        }
                    })
            except Exception as e:
                print(f"Error searching documents: {e}")
        
        # Sort results by relevance (exact matches first)
        def relevance_score(result):
            title_lower = result['title'].lower()
            query_lower = query.lower()
            if title_lower == query_lower:
                return 0
            elif title_lower.startswith(query_lower):
                return 1
            elif query_lower in title_lower:
                return 2
            else:
                return 3
        
        results.sort(key=relevance_score)
        
        return jsonify({
            'success': True,
            'data': {
                'results': results[:limit],
                'total': len(results),
                'query': query,
                'module_filter': module_filter
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@search_bp.route('/suggestions', methods=['GET'])
@jwt_required()
def search_suggestions():
    """
    Get search suggestions based on partial query - filtered by the caller's
    own module permissions, same rule as /global.
    """
    try:
        current_user_id = get_jwt_identity()
        current_user = db.session.get(User, int(current_user_id))
        bypass = bool(current_user and (current_user.is_admin or getattr(current_user, 'is_super_admin', False)))
        perms = _get_user_permissions(current_user) if current_user and not bypass else set()

        query = request.args.get('q', '').strip()
        limit = int(request.args.get('limit', 10))

        if len(query) < 2:
            return jsonify({
                'success': True,
                'data': []
            })

        suggestions = []

        # Get suggestions from various sources
        try:
            # Products
            if _can_view('products', perms, bypass):
                products = Product.query.filter(
                    Product.name.ilike(f'%{query}%')
                ).limit(5).all()
                suggestions.extend([p.name for p in products])

            # Work Orders
            if _can_view('production', perms, bypass):
                work_orders = WorkOrder.query.filter(
                    WorkOrder.wo_number.ilike(f'%{query}%')
                ).limit(5).all()
                suggestions.extend([wo.wo_number for wo in work_orders])

            # Customers
            if _can_view('customers', perms, bypass):
                customers = Customer.query.filter(
                    Customer.company_name.ilike(f'%{query}%')
                ).limit(5).all()
                suggestions.extend([c.company_name for c in customers])

        except Exception as e:
            print(f"Error getting suggestions: {e}")
        
        # Remove duplicates and limit
        suggestions = list(set(suggestions))[:limit]
        
        return jsonify({
            'success': True,
            'data': suggestions
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
