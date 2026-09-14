from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Customer, SalesOrder, SalesOrderItem, ForecastHeader, ForecastLine, ForecastLineConversion, ForecastLineMonth, Product, Notification
from utils.i18n import success_response, error_response, get_message
from utils.auth_decorators import require_permission
from models.sales import (
    Lead, Opportunity, SalesPipeline, PipelineStage, CustomerContact,
    Quotation, QuotationItem, SalesActivity, SalesTask, SalesMetrics
)
from models.user import User
from utils import generate_number, generate_number_v2
from utils.business_rules import BusinessRules, ValidationError, SALES_ORDER_TRANSITIONS
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import or_, func, and_
from sqlalchemy.orm import joinedload, selectinload
import json
from utils.timezone import get_local_now, get_local_today
import redis
import os

sales_bp = Blueprint('sales', __name__)

# Customers
@sales_bp.route('/customers', methods=['GET'])
@jwt_required()
@require_permission('customers.view')
def get_customers():
    """Get all customers"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        search = request.args.get('search', '')
        is_active = request.args.get('is_active')
        customer_type = request.args.get('customer_type')
        
        # Try cache
        cache_key = f'sales_customers_page{page}_per{per_page}_search{search}_active{is_active or "none"}_type{customer_type or "none"}'
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            cached_data = r.get(cache_key)
            if cached_data:
                return jsonify(json.loads(cached_data)), 200
        except Exception as cache_error:
            print(f"Redis cache error (using fallback): {cache_error}")
            
        query = Customer.query
        
        if search:
            query = query.filter(
                or_(
                    Customer.code.ilike(f'%{search}%'),
                    Customer.company_name.ilike(f'%{search}%')
                )
            )
        
        if is_active is not None:
            if is_active.lower() == 'true':
                query = query.filter_by(is_active=True)
            elif is_active.lower() == 'false':
                query = query.filter_by(is_active=False)
        else:
            # Default to active customers only
            query = query.filter_by(is_active=True)
            
        if customer_type:
            query = query.filter_by(customer_type=customer_type)
        
        customers = query.paginate(page=page, per_page=per_page, error_out=False)
        
        response_data = {
            'customers': [{
                'id': c.id,
                'code': c.code,
                'company_name': c.company_name,
                'contact_person': getattr(c, 'contact_person', ''),
                'email': getattr(c, 'email', ''),
                'phone': getattr(c, 'phone', ''),
                'city': getattr(c, 'billing_city', None) or getattr(c, 'city', ''),
                'state': getattr(c, 'billing_state', None) or getattr(c, 'state', ''),
                'country': getattr(c, 'billing_country', None) or getattr(c, 'country', ''),
                'postal_code': getattr(c, 'billing_postal_code', None) or getattr(c, 'postal_code', ''),
                'address': getattr(c, 'billing_address', None) or getattr(c, 'address', ''),
                'customer_type': getattr(c, 'customer_type', 'retail'),
                'credit_limit': float(c.credit_limit) if c.credit_limit else 0,
                'payment_terms': f"Net {getattr(c, 'payment_terms_days', 30)}",
                'tax_number': getattr(c, 'tax_id', ''),
                'website': getattr(c, 'website', ''),
                'industry': getattr(c, 'industry', ''),
                'is_active': getattr(c, 'is_active', True)
            } for c in customers.items],
            'total': customers.total,
            'pages': customers.pages
        }
        
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            r.setex(cache_key, 300, json.dumps(response_data))
        except Exception as cache_error:
            print(f"Redis cache set error (continuing without cache): {cache_error}")
            
        return jsonify(response_data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/customers', methods=['POST'])
@jwt_required()
@require_permission('customers.create')
def create_customer():
    """Create customer"""
    try:
        data = request.get_json()
        
        # Extract payment terms days from payment_terms string
        payment_terms = data.get('payment_terms', 'Net 30')
        if 'Net' in payment_terms:
            payment_terms_days = int(payment_terms.replace('Net ', ''))
        elif payment_terms == 'COD':
            payment_terms_days = 0
        else:
            payment_terms_days = 30
            
        customer = Customer(
            code=data['code'],
            company_name=data['company_name'],
            contact_person=data.get('contact_person'),
            email=data.get('email'),
            phone=data.get('phone'),
            mobile=data.get('mobile'),
            billing_address=data.get('address'),
            billing_city=data.get('city'),
            billing_state=data.get('state'),
            billing_country=data.get('country'),
            billing_postal_code=data.get('postal_code'),
            shipping_address=data.get('address'),  # Default same as billing
            shipping_city=data.get('city'),
            shipping_state=data.get('state'),
            shipping_country=data.get('country'),
            shipping_postal_code=data.get('postal_code'),
            tax_id=data.get('tax_number'),
            website=data.get('website'),
            industry=data.get('industry'),
            credit_limit=data.get('credit_limit', 0),
            payment_terms_days=payment_terms_days,
            customer_type=data.get('customer_type', 'retail'),
            is_active=data.get('is_active', True),
            created_by=get_jwt_identity()
        )
        
        db.session.add(customer)
        db.session.commit()
        
        # Invalidate cache
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            keys = r.keys('sales_customers_*')
            if keys:
                r.delete(*keys)
        except Exception as cache_error:
            print(f"Redis cache invalidation error (continuing): {cache_error}")
            
        return jsonify({'message': 'Customer created', 'customer_id': customer.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/customers/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('customers.view')
def get_customer(id):
    """Get customer details"""
    try:
        customer = db.session.get(Customer, id)
        if not customer:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        return jsonify({
            'id': customer.id,
            'code': customer.code,
            'company_name': customer.company_name,
            'contact_person': getattr(customer, 'contact_person', ''),
            'job_title': getattr(customer, 'job_title', ''),
            'email': getattr(customer, 'email', ''),
            'phone': getattr(customer, 'phone', ''),
            'mobile': getattr(customer, 'mobile', ''),
            'fax': getattr(customer, 'fax', ''),
            'website': getattr(customer, 'website', ''),
            'tax_id': getattr(customer, 'tax_id', ''),
            
            # Billing address (mapped to simple address for frontend compatibility)
            'address': getattr(customer, 'billing_address', ''),
            'city': getattr(customer, 'billing_city', ''),
            'state': getattr(customer, 'billing_state', ''),
            'country': getattr(customer, 'billing_country', ''),
            'postal_code': getattr(customer, 'billing_postal_code', ''),
            
            # Full billing address fields
            'billing_address': getattr(customer, 'billing_address', ''),
            'billing_city': getattr(customer, 'billing_city', ''),
            'billing_state': getattr(customer, 'billing_state', ''),
            'billing_country': getattr(customer, 'billing_country', ''),
            'billing_postal_code': getattr(customer, 'billing_postal_code', ''),
            
            # Shipping address fields
            'shipping_address': getattr(customer, 'shipping_address', ''),
            'shipping_city': getattr(customer, 'shipping_city', ''),
            'shipping_state': getattr(customer, 'shipping_state', ''),
            'shipping_country': getattr(customer, 'shipping_country', ''),
            'shipping_postal_code': getattr(customer, 'shipping_postal_code', ''),
            
            # Business information
            'credit_limit': float(customer.credit_limit) if customer.credit_limit else 0,
            'payment_terms_days': getattr(customer, 'payment_terms_days', 30),
            'customer_type': getattr(customer, 'customer_type', 'retail'),
            'industry': getattr(customer, 'industry', ''),
            'notes': getattr(customer, 'notes', ''),
            'is_active': getattr(customer, 'is_active', True),
            'created_at': customer.created_at.isoformat() if hasattr(customer, 'created_at') and customer.created_at else None,
            'updated_at': customer.updated_at.isoformat() if hasattr(customer, 'updated_at') and customer.updated_at else None
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/customers/<int:id>', methods=['PUT', 'OPTIONS'])
def update_customer(id):
    """Update customer"""
    if request.method == 'OPTIONS':
        return '', 200
    
    print(f"PUT request received for customer ID: {id}")
    
    # Apply JWT protection only for non-OPTIONS requests
    from flask_jwt_extended import verify_jwt_in_request
    verify_jwt_in_request()
    
    try:
        customer = db.session.get(Customer, id)
        if not customer:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        data = request.get_json()
        
        # Update customer fields
        if 'company_name' in data:
            customer.company_name = data['company_name']
        if 'contact_person' in data:
            customer.contact_person = data['contact_person']
        if 'job_title' in data:
            customer.job_title = data['job_title']
        if 'email' in data:
            customer.email = data['email']
        if 'phone' in data:
            customer.phone = data['phone']
        if 'mobile' in data:
            customer.mobile = data['mobile']
        if 'fax' in data:
            customer.fax = data['fax']
        if 'website' in data:
            customer.website = data['website']
        if 'tax_id' in data:
            customer.tax_id = data['tax_id']
        
        # Address fields - map frontend fields to backend model
        if 'address' in data:
            customer.billing_address = data['address']
        if 'billing_address' in data:
            customer.billing_address = data['billing_address']
        if 'city' in data:
            customer.billing_city = data['city']
        if 'billing_city' in data:
            customer.billing_city = data['billing_city']
        if 'state' in data:
            customer.billing_state = data['state']
        if 'billing_state' in data:
            customer.billing_state = data['billing_state']
        if 'country' in data:
            customer.billing_country = data['country']
        if 'billing_country' in data:
            customer.billing_country = data['billing_country']
        if 'postal_code' in data:
            customer.billing_postal_code = data['postal_code']
        if 'billing_postal_code' in data:
            customer.billing_postal_code = data['billing_postal_code']
            
        # Shipping address
        if 'shipping_address' in data:
            customer.shipping_address = data['shipping_address']
        if 'shipping_city' in data:
            customer.shipping_city = data['shipping_city']
        if 'shipping_state' in data:
            customer.shipping_state = data['shipping_state']
        if 'shipping_country' in data:
            customer.shipping_country = data['shipping_country']
        if 'shipping_postal_code' in data:
            customer.shipping_postal_code = data['shipping_postal_code']
            
        # Business fields
        if 'credit_limit' in data:
            customer.credit_limit = float(data['credit_limit'])
        if 'payment_terms_days' in data:
            customer.payment_terms_days = int(data['payment_terms_days'])
        if 'customer_type' in data:
            customer.customer_type = data['customer_type']
        if 'industry' in data:
            customer.industry = data['industry']
        if 'notes' in data:
            customer.notes = data['notes']
        if 'is_active' in data:
            customer.is_active = data['is_active']
        
        db.session.commit()
        
        # Invalidate cache
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            keys = r.keys('sales_customers_*')
            if keys:
                r.delete(*keys)
        except Exception as cache_error:
            print(f"Redis cache invalidation error (continuing): {cache_error}")
            
        return jsonify({
            'message': 'Customer updated successfully',
            'customer_id': customer.id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/customers/<int:id>', methods=['DELETE', 'OPTIONS'])
def delete_customer(id):
    """Delete customer"""
    if request.method == 'OPTIONS':
        return '', 200
    
    # Apply JWT protection only for non-OPTIONS requests
    from flask_jwt_extended import verify_jwt_in_request
    verify_jwt_in_request()
    
    try:
        customer = db.session.get(Customer, id)
        if not customer:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        # Check if customer has orders
        # For now, just soft delete by setting is_active to False
        customer.is_active = False
        db.session.commit()
        
        # Invalidate cache
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            r = redis.from_url(redis_url)
            keys = r.keys('sales_customers_*')
            if keys:
                r.delete(*keys)
        except Exception as cache_error:
            print(f"Redis cache invalidation error (continuing): {cache_error}")
            
        return jsonify({
            'message': 'Customer deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Sales Orders
@sales_bp.route('/orders', methods=['GET'])
@jwt_required()
@require_permission('sales_orders.view')
def get_orders():
    """Get all sales orders"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        status = request.args.get('status')
        customer_id = request.args.get('customer_id', type=int)
        
        # Check if SalesOrder table exists and has data
        try:
            count = SalesOrder.query.count()
            print(f"Total sales orders in database: {count}")
        except Exception as count_error:
            print(f"Error counting sales orders: {count_error}")
            return jsonify({
                'orders': [],
                'total': 0,
                'pages': 0,
                'message': 'Sales orders table not accessible'
            }), 200
        
        # Optimize query with eager loading to avoid N+1 problem
        query = SalesOrder.query.options(
            joinedload(SalesOrder.customer),
            selectinload(SalesOrder.items)
        )
        
        if status:
            query = query.filter_by(status=status)
        if customer_id:
            query = query.filter_by(customer_id=customer_id)
        
        # Use limit/offset instead of paginate to avoid potential issues
        try:
            total = query.count()
            offset = (page - 1) * per_page
            orders = query.order_by(SalesOrder.order_date.desc()).offset(offset).limit(per_page).all()
            
            orders_data = []
            for o in orders:
                try:
                    order_data = {
                        'id': o.id,
                        'order_number': o.order_number or f'SO-{o.id}',
                        'customer_id': o.customer_id,
                        'customer_name': 'Unknown Customer',
                        'order_date': None,
                        'required_date': None,
                        'status': o.status or 'pending',
                        'priority': o.priority or 'normal',
                        'total_amount': float(o.total_amount) if o.total_amount else 0.0,
                        'item_count': 0
                    }
                    
                    # Safely get customer name
                    try:
                        if o.customer:
                            order_data['customer_name'] = o.customer.company_name or 'Unknown Customer'
                    except Exception as customer_error:
                        print(f"Error getting customer for order {o.id}: {customer_error}")
                    
                    # Safely get dates
                    try:
                        if o.order_date:
                            order_data['order_date'] = o.order_date.isoformat()
                        if o.required_date:
                            order_data['required_date'] = o.required_date.isoformat()
                    except Exception as date_error:
                        print(f"Error getting dates for order {o.id}: {date_error}")
                    
                    # Safely get item count
                    try:
                        if hasattr(o, 'items') and o.items:
                            order_data['item_count'] = len(o.items)
                    except Exception as items_error:
                        print(f"Error getting items for order {o.id}: {items_error}")
                    
                    orders_data.append(order_data)
                    
                except Exception as order_error:
                    print(f"Error processing order {o.id}: {order_error}")
                    continue
            
            pages = (total + per_page - 1) // per_page
            
            return jsonify({
                'orders': orders_data,
                'total': total,
                'pages': pages
            }), 200
            
        except Exception as query_error:
            print(f"Error executing query: {query_error}")
            return jsonify({
                'orders': [],
                'total': 0,
                'pages': 0,
                'message': 'Error executing sales orders query'
            }), 200
            
    except Exception as e:
        print(f"Error in get_orders: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/orders', methods=['POST'])
@jwt_required()
@require_permission('sales_orders.create')
def create_order():
    """Create sales order"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # BUSINESS RULE: Validate customer credit limit
        customer_id = data.get('customer_id')
        if customer_id:
            try:
                # Calculate order total first
                order_total = 0
                for item_data in data.get('items', []):
                    order_total += item_data['quantity'] * item_data['unit_price']
                
                credit_check = BusinessRules.validate_credit_limit(customer_id, order_total)
                if not credit_check['approved']:
                    return jsonify({
                        'error': 'Credit limit exceeded',
                        'details': credit_check
                    }), 400
                
                # Validate payment terms
                payment_check = BusinessRules.validate_payment_terms(customer_id)
                if not payment_check['valid']:
                    return jsonify({
                        'error': 'Invalid payment terms',
                        'details': payment_check
                    }), 400
            except ValidationError as ve:
                print(f"Validation warning: {ve}")
        
        order_number = generate_number_v2('sales_order', 'SO', SalesOrder, 'order_number')
        
        order = SalesOrder(
            order_number=order_number,
            customer_id=data['customer_id'],
            order_date=datetime.fromisoformat(data['order_date']),
            required_date=datetime.fromisoformat(data['required_date']) if data.get('required_date') else None,
            status='draft',
            priority=data.get('priority', 'normal'),
            customer_po_number=data.get('customer_po_number'),
            payment_terms=data.get('payment_terms'),
            delivery_address=data.get('delivery_address'),
            notes=data.get('notes'),
            created_by=user_id
        )
        
        db.session.add(order)
        db.session.flush()
        
        # Add items
        subtotal = 0
        for idx, item_data in enumerate(data.get('items', []), 1):
            item_total = item_data['quantity'] * item_data['unit_price']
            
            item = SalesOrderItem(
                order_id=order.id,
                line_number=idx,
                product_id=item_data['product_id'],
                description=item_data.get('description'),
                quantity=item_data['quantity'],
                uom=item_data.get('uom', 'PCS'),  # Default to PCS if not provided
                unit_price=item_data['unit_price'],
                discount_percent=item_data.get('discount_percent', 0),
                tax_percent=item_data.get('tax_percent', 0),
                total_price=item_total
            )
            db.session.add(item)
            subtotal += item_total
        
        order.subtotal = subtotal
        order.total_amount = subtotal

        db.session.commit()

        # NOTE (2026-08-24): this used to also auto-create a generic ApprovalWorkflow
        # (transaction_type='sales_order') + PendingJournalEntry right here, immediately
        # pushed to 'pending_review' - dead legacy code from before the Confirm-based flow
        # (confirm_order() / confirm-and-start-production, SALES_ORDER_TRANSITIONS) existed.
        # It was a genuine bug, not just unwanted UX: if that workflow was ever approved via
        # the generic Approval Dashboard, it set SalesOrder.status='approved' - a status that
        # doesn't exist in SALES_ORDER_TRANSITIONS (draft->confirmed->in_progress->completed/
        # cancelled), so the order could never be confirmed normally afterward. It also staged
        # a pending sales journal entry for revenue before the order was even confirmed. Removed
        # - draft/status wiring now goes exclusively through confirm_order()/
        # confirm_and_start_production(). See SO_LIST_MODAL_AUDIT_REPORT.md.

        # CREATE NOTIFICATION: Sales Order Created - Send to all active users
        try:
            from models.user import User
            all_users = User.query.filter(User.is_active == True).all()
            for u in all_users:
                notification = Notification(
                    user_id=u.id,
                    notification_type='success',
                    category='sales',
                    title='Sales Order Created',
                    message=f'Sales Order {order_number} created successfully for {order.customer.company_name if order.customer else "customer"}',
                    reference_type='sales_order',
                    reference_id=order.id,
                    priority='normal',
                    action_url=f'/app/sales/orders/{order.id}'
                )
                db.session.add(notification)
            db.session.commit()
        except Exception as notif_error:
            print(f"Notification creation failed: {notif_error}")

        return jsonify({
            'message': 'Order created successfully',
            'order_id': order.id,
            'order_number': order_number,
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/orders/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('sales_orders.view')
def get_order(id):
    """Get sales order details"""
    try:
        order = db.session.get(SalesOrder, id)
        if not order:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        return jsonify({
            'id': order.id,
            'order_number': order.order_number,
            'customer_id': order.customer_id,
            'customer': {
                'id': order.customer.id,
                'code': order.customer.code,
                'company_name': order.customer.company_name
            },
            'order_date': order.order_date.isoformat(),
            'required_date': order.required_date.isoformat() if order.required_date else None,
            'status': order.status,
            'priority': order.priority,
            'customer_po_number': order.customer_po_number,
            'payment_terms': order.payment_terms,
            'delivery_address': order.delivery_address,
            'subtotal': float(order.subtotal),
            'tax_amount': float(order.tax_amount),
            'total_amount': float(order.total_amount),
            'notes': order.notes,
            'items': [{
                'id': i.id,
                'line_number': i.line_number,
                'product_id': i.product_id,
                'product_code': i.product.code,
                'product_name': i.product.name,
                'description': i.description,
                'quantity': float(i.quantity),
                'quantity_shipped': float(i.quantity_shipped or 0),
                'uom': i.uom,
                'unit_price': float(i.unit_price),
                'discount_percent': float(i.discount_percent or 0),
                'tax_percent': float(i.tax_percent or 0),
                'total_price': float(i.total_price)
            } for i in order.items]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/orders/<int:id>/confirm', methods=['PUT'])
@jwt_required()
@require_permission('sales_orders.confirm')
def confirm_order(id):
    """Confirm sales order"""
    try:
        user_id = get_jwt_identity()
        order = db.session.get(SalesOrder, id)

        if not order:
            return jsonify(error_response('api.error', error_code=404)), 404

        from utils.sales_order_workflow import confirm_order_core, SOWorkflowError
        try:
            inventory_warnings = confirm_order_core(order, user_id)
        except SOWorkflowError as e:
            return jsonify({'error': e.message, **e.extra}), e.status

        db.session.commit()

        # AUTO-RESERVE (Bagian 1 / B): process the full FIFO-by-document-date
        # backlog now that this SO is confirmed. Never blocks confirmation —
        # failures here are logged, not raised.
        try:
            from utils.auto_reserve import process_auto_reserve_queue
            process_auto_reserve_queue()
        except Exception as auto_reserve_error:
            print(f"Auto-reserve queue warning: {auto_reserve_error}")

        # CREATE NOTIFICATION: Sales Order Confirmed - Send to all active users
        try:
            from models.user import User
            all_users = User.query.filter(User.is_active == True).all()
            for u in all_users:
                notification = Notification(
                    user_id=u.id,
                    notification_type='success',
                    category='sales',
                    title='Sales Order Confirmed',
                    message=f'Sales Order {order.order_number} confirmed successfully',
                    reference_type='sales_order',
                    reference_id=order.id,
                    priority='high',
                    action_url=f'/app/sales/orders/{order.id}'
                )
                db.session.add(notification)
                
                # If inventory warnings, create alert notification for all users
                if inventory_warnings:
                    warning_msg = f"Sales Order {order.order_number} confirmed with inventory shortages: "
                    warning_msg += ", ".join([f"{w['product_name']} (shortage: {w['shortage']})" for w in inventory_warnings[:3]])
                    
                    alert_notification = Notification(
                        user_id=u.id,
                        notification_type='warning',
                        category='inventory',
                        title='Inventory Shortage Alert',
                        message=warning_msg,
                        reference_type='sales_order',
                        reference_id=order.id,
                        priority='high',
                        action_url=f'/app/warehouse/inventory'
                    )
                    db.session.add(alert_notification)
            
            db.session.commit()
        except Exception as notif_error:
            print(f"Notification creation failed: {notif_error}")
        
        # NOTE (2026-08-24): WorkflowAutomation.trigger_mrp_from_sales_order() used to be
        # auto-fired here, but it duplicates routes/workflow_complete.py's
        # trigger_complete_workflow() (the "tombol workflow" flow), which is the real,
        # frontend-driven path that creates ProductionPlan+WorkOrder. Both firing on the
        # same SO produced two independent WorkOrders for one order. WorkflowAutomation's
        # MRPRequirement/WorkflowStep machinery also has no frontend UI reading it (see
        # CLAUDE.md known gotchas) - it's still callable directly via /api/workflow/* if
        # ever needed, just no longer auto-triggered from Confirm.

        response_data = {'message': 'Order confirmed successfully'}
        if inventory_warnings:
            response_data['warnings'] = inventory_warnings
        
        return jsonify(response_data), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/orders/<int:id>/production-capacity-preview', methods=['GET'])
@jwt_required()
@require_permission('sales_orders.view')
def production_capacity_preview(id):
    """Pratinjau beban mesin SEBELUM confirm-and-start-production dieksekusi - sinyal proaktif
    supaya user tahu kalau mesin default produk sudah padat minggu itu, sebelum WO dibuat.
    Tidak memblokir - keputusan tetap di user, cuma info. Dibangun untuk menyambungkan
    "2 pintu produksi paralel" (Forecast build-ahead vs SO langsung) yang sebelumnya buta
    satu sama lain - lihat memory project_spk_workorder_batch_planning untuk konteks audit.
    Beban dihitung dari WorkOrder aktif (bukan cancelled/completed) di mesin yang sama
    dengan required_date jatuh di minggu yang sama dengan required_date SO ini - tidak
    peduli WO itu asalnya dari Forecast atau SO lain, karena run_generate_replan() (Batch
    Planning) juga memperlakukan semuanya sebagai satu kolam per-mesin yang sama.
    """
    from models.production import Machine, WorkOrder
    from models.batch_scheduling import ProductionRecipe
    from datetime import timedelta

    order = db.session.get(SalesOrder, id)
    if not order:
        return jsonify(error_response('api.error', error_code=404)), 404

    items = SalesOrderItem.query.filter_by(order_id=order.id).all()
    ref_date = order.required_date or get_local_today()
    week_start = ref_date - timedelta(days=ref_date.weekday())
    week_end = week_start + timedelta(days=6)

    preview = []
    for item in items:
        recipe = ProductionRecipe.query.filter_by(
            product_id=item.product_id, is_default=True, is_active=True
        ).first()
        entry = {
            'product_id': item.product_id,
            'product_name': item.product.name if item.product else None,
            'machine_id': recipe.machine_id if recipe else None,
            'machine_name': None,
            'existing_wo_count': 0,
            'existing_wo_qty': 0,
        }
        if recipe:
            machine = db.session.get(Machine, recipe.machine_id)
            entry['machine_name'] = machine.name if machine else None
            existing = WorkOrder.query.filter(
                WorkOrder.machine_id == recipe.machine_id,
                WorkOrder.status.notin_(['cancelled', 'completed']),
                WorkOrder.required_date >= week_start,
                WorkOrder.required_date <= week_end,
            ).all()
            entry['existing_wo_count'] = len(existing)
            entry['existing_wo_qty'] = float(sum(float(w.quantity or 0) for w in existing))
        preview.append(entry)

    return jsonify({
        'week_start': week_start.isoformat(),
        'week_end': week_end.isoformat(),
        'items': preview,
    }), 200


@sales_bp.route('/orders/<int:id>/atp-preview', methods=['GET'])
@jwt_required()
@require_permission('sales_orders.view')
def atp_preview(id):
    """Pratinjau ATP (Available to Promise) SEBELUM confirm-and-start-production - sama pola
    dengan production_capacity_preview di atas. Per item, tampilkan stok on-hand, berapa yang
    sudah "dijanjikan" ke SO lain yang masih open (confirmed/in_production/ready), sisa yang
    benar-benar bisa dijanjikan, dan drill-down SO mana saja yang sedang memegang komitmen itu
    (lihat utils/atp_helper.py untuk penjelasan lengkap kenapa ini perlu dibangun - FG stock
    tidak pernah direservasi otomatis saat SO dikonfirmasi). Tidak memblokir, cuma info.
    """
    from utils.atp_helper import check_atp

    order = db.session.get(SalesOrder, id)
    if not order:
        return jsonify(error_response('api.error', error_code=404)), 404

    items = SalesOrderItem.query.filter_by(order_id=order.id).all()
    preview = []
    for item in items:
        atp = check_atp(product_id=item.product_id, quantity_needed=item.quantity, exclude_order_id=order.id)
        preview.append({
            'product_id': item.product_id,
            'product_name': item.product.name if item.product else None,
            'required': float(item.quantity or 0),
            **atp,
        })

    return jsonify({'items': preview}), 200


@sales_bp.route('/orders/<int:id>/confirm-and-start-production', methods=['POST'])
@jwt_required()
@require_permission('sales_orders.confirm')
def confirm_and_start_production(id):
    """Atomic version of Confirm + 'Trigger Complete Workflow' combined into 1 call,
    1 DB transaction (single commit) - added 2026-08-24 so the frontend can offer a
    single confirmation modal instead of 2 separate page-hopping actions (SalesOrderDetails
    -> WorkflowStatus). Reuses confirm_order_core() and trigger_production_from_so_core()
    (utils/sales_order_workflow.py) unchanged - same business logic as the 2 standalone
    endpoints below, just without their individual commits, so a mid-chain failure rolls
    back BOTH steps instead of leaving the SO stuck 'confirmed' with no WorkOrder.

    The 2 standalone endpoints (PUT .../confirm and POST /workflow-complete/.../trigger-complete)
    are NOT removed - kept as fallback / for any other caller not yet identified.
    """
    from utils.sales_order_workflow import confirm_order_core, trigger_production_from_so_core, SOWorkflowError

    try:
        user_id = get_jwt_identity()
        order = db.session.get(SalesOrder, id)
        if not order:
            return jsonify(error_response('api.error', error_code=404)), 404

        try:
            inventory_warnings = confirm_order_core(order, user_id)
            created, failed = trigger_production_from_so_core(order, int(user_id))
        except SOWorkflowError as e:
            db.session.rollback()
            return jsonify({'error': e.message, **e.extra}), e.status

        order.status = 'in_production'
        db.session.commit()

        # Same best-effort side effects as the 2 standalone endpoints - failures here
        # are logged, not raised, and never roll back the confirm+production steps above.
        try:
            from utils.auto_reserve import process_auto_reserve_queue
            process_auto_reserve_queue()
        except Exception as auto_reserve_error:
            print(f"Auto-reserve queue warning: {auto_reserve_error}")

        try:
            from models.user import User
            all_users = User.query.filter(User.is_active == True).all()
            for u in all_users:
                db.session.add(Notification(
                    user_id=u.id,
                    notification_type='success',
                    category='sales',
                    title='Sales Order Confirmed & Production Started',
                    message=f'Sales Order {order.order_number} dikonfirmasi dan {len(created)} Work Order dibuat',
                    reference_type='sales_order',
                    reference_id=order.id,
                    priority='high',
                    action_url=f'/app/sales/orders/{order.id}'
                ))
                if inventory_warnings:
                    warning_msg = f"Sales Order {order.order_number} confirmed with inventory shortages: "
                    warning_msg += ", ".join([f"{w['product_name']} (shortage: {w['shortage']})" for w in inventory_warnings[:3]])
                    db.session.add(Notification(
                        user_id=u.id,
                        notification_type='warning',
                        category='inventory',
                        title='Inventory Shortage Alert',
                        message=warning_msg,
                        reference_type='sales_order',
                        reference_id=order.id,
                        priority='high',
                        action_url='/app/warehouse/inventory'
                    ))
            db.session.commit()
        except Exception as notif_error:
            print(f"Notification creation failed: {notif_error}")

        response_data = {
            'message': f'Order confirmed - {len(created)} Production Plan(s) dan Work Order(s) dibuat',
            'status': order.status,
            'created': created,
            'failed_items': failed,
        }
        if inventory_warnings:
            response_data['warnings'] = inventory_warnings
        return jsonify(response_data), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def _find_locked_wo_conflicts(order, new_items_data):
    """Check whether editing this SO's items would silently change a
    WorkOrder that has already progressed past the point of being safely
    re-planned.

    "Locked" = WO status 'completed' (FG already exists - never editable),
    or WO status 'released'/'in_progress' AND there's physical evidence work
    already started (quantity_produced > 0, or a linked MaterialIssue item
    already has status='issued' i.e. material physically left the warehouse).
    A WO that's merely 'released' with nothing issued yet is NOT locked -
    material was only reserved, not taken, so it's still safe to re-plan.

    Returns a list of conflict dicts (empty if nothing is locked) - the
    caller uses this to block the specific product lines involved while
    leaving the rest of the edit to proceed.
    """
    from models.production import WorkOrder
    from models.material_issue import MaterialIssue, MaterialIssueItem

    new_qty_by_product = {}
    for it in new_items_data:
        pid = it['product_id']
        new_qty_by_product[pid] = new_qty_by_product.get(pid, 0) + float(it['quantity'])

    conflicts = []
    wos = WorkOrder.query.filter_by(sales_order_id=order.id).filter(
        WorkOrder.status.in_(['released', 'in_progress', 'completed'])
    ).all()

    for wo in wos:
        locked = False
        if wo.status == 'completed':
            locked = True
        elif float(wo.quantity_produced or 0) > 0:
            locked = True
        else:
            issued = MaterialIssueItem.query.join(
                MaterialIssue, MaterialIssueItem.material_issue_id == MaterialIssue.id
            ).filter(
                MaterialIssue.work_order_id == wo.id,
                MaterialIssueItem.status == 'issued'
            ).first()
            if issued:
                locked = True

        if not locked:
            continue

        new_qty = new_qty_by_product.get(wo.product_id)
        if new_qty is None or abs(new_qty - float(wo.quantity)) > 0.0001:
            conflicts.append({
                'product_id': wo.product_id,
                'wo_number': wo.wo_number,
                'wo_status': wo.status,
            })

    return conflicts


def _release_so_reservations(order):
    """Undo the FIFO stock reservation previously made for this SO (via
    process_auto_reserve_queue / _create_auto_reserve_issue), so the items
    can be safely re-reserved against the edited quantities. Reuses
    fifo_release_reservation() - no new reservation logic. Marks the old
    auto_reserve MaterialIssue 'cancelled' (kept for audit trail, not
    deleted) rather than mutating it in place."""
    from utils.fifo_helper import fifo_release_reservation
    from models.material_issue import MaterialIssue

    mi = MaterialIssue.query.filter_by(
        sales_order_id=order.id, trigger_source='auto_reserve'
    ).filter(MaterialIssue.status.in_(['approved', 'partial'])).first()
    if not mi:
        return

    for item in mi.items:
        qty = float(item.reserved_quantity or 0)
        if qty > 0 and item.material_id:
            fifo_release_reservation(material_id=item.material_id, quantity_to_release=qty)
        item.reservation_status = 'none'
        item.reserved_quantity = 0

    mi.status = 'cancelled'


def _sync_sales_order_journal(order, old_total, new_total, user_id):
    """Keep the GL in sync with an edited SO total.

    - Workflow not yet approved: the journal is still a PendingJournalEntry
      (nothing posted) - just overwrite its lines/totals with the new amount.
    - Workflow already approved (AccountingEntry rows are permanent): never
      edit those rows. Instead post a separate correction entry pair for the
      delta, tagged reference_type='sales_order_correction' so it's easy to
      filter/audit apart from the original posting and from other
      PendingJournalEntry-sourced entries.
    """
    from models.approval_workflow import ApprovalWorkflow, PendingJournalEntry
    from models.finance import AccountingEntry, Account
    from utils.account_config import create_journal_entry_lines

    delta = round(float(new_total) - float(old_total), 2)
    if delta == 0:
        return

    workflow = ApprovalWorkflow.query.filter_by(
        transaction_type='sales_order', transaction_id=order.id
    ).order_by(ApprovalWorkflow.created_at.desc()).first()
    if not workflow:
        return

    if workflow.status == 'approved':
        is_increase = delta > 0
        lines = create_journal_entry_lines(
            'sales', amount=abs(delta),
            description=f'Koreksi Sales Order {order.order_number} - edit item'
        )
        if not is_increase:
            for line in lines:
                line['debit'], line['credit'] = line['credit'], line['debit']

        base = f'JE-CORR-{order.order_number}'
        existing_pairs = AccountingEntry.query.filter(
            AccountingEntry.entry_number.like(f'{base}%')
        ).count()
        seq = (existing_pairs // 2) + 1

        for idx, line in enumerate(lines, 1):
            account = db.session.get(Account, line['account_id'])
            entry = AccountingEntry(
                entry_number=f'{base}-{seq:02d}-{idx:02d}',
                entry_date=get_local_now().date(),
                entry_type='general',
                reference_type='sales_order_correction',
                reference_id=order.id,
                reference_number=order.order_number,
                account_id=line['account_id'],
                account_code=account.account_code if account else '',
                account_name=account.account_name if account else '',
                debit_amount=line['debit'],
                credit_amount=line['credit'],
                description=f'Koreksi Sales Order {order.order_number} - edit item (selisih Rp {abs(delta):,.0f})',
                status='posted',
                posted_by=user_id,
                posted_at=get_local_now(),
            )
            db.session.add(entry)
    else:
        pending = PendingJournalEntry.query.filter_by(workflow_id=workflow.id).first()
        if pending:
            pending.lines = create_journal_entry_lines(
                'sales', amount=new_total,
                description=f'Sales - {order.customer.company_name if order.customer else "Customer"}'
            )
            pending.total_debit = new_total
            pending.total_credit = new_total


@sales_bp.route('/orders/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('sales_orders.edit')
def update_order(id):
    """Update sales order"""
    try:
        order = db.session.get(SalesOrder, id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        data = request.get_json()
        user_id = get_jwt_identity()

        # Handle status update (including cancel)
        if 'status' in data:
            new_status = data['status']

            # Validate status transition
            valid_transitions = {
                'draft': ['confirmed', 'cancelled'],
                'confirmed': ['in_production', 'cancelled'],
                'in_production': ['ready', 'cancelled'],
                'ready': ['shipped', 'cancelled'],
                'shipped': ['delivered'],
                'delivered': [],
                'cancelled': []
            }

            current_status = order.status
            if new_status not in valid_transitions.get(current_status, []):
                return jsonify({
                    'error': f'Cannot change status from {current_status} to {new_status}'
                }), 400

            order.status = new_status

        # Update other fields if provided
        if 'priority' in data:
            order.priority = data['priority']
        if 'notes' in data:
            order.notes = data['notes']
        if 'required_date' in data and data['required_date']:
            order.required_date = datetime.fromisoformat(data['required_date'].replace('Z', '+00:00'))
        if 'customer_id' in data and data['customer_id']:
            order.customer_id = data['customer_id']

        items_changed = False
        old_total = float(order.total_amount or 0)

        if 'items' in data:
            new_items_data = data['items']

            conflicts = _find_locked_wo_conflicts(order, new_items_data)
            if conflicts:
                conflict_desc = '; '.join(
                    f"produk ID {c['product_id']} terkait WO {c['wo_number']} (status {c['wo_status']})"
                    for c in conflicts
                )
                return jsonify({
                    'error': (
                        f'Tidak bisa mengubah item ini karena sudah terkait Work Order yang berjalan: '
                        f'{conflict_desc}. Selesaikan atau batalkan Work Order tersebut dulu sebelum '
                        f'mengedit baris item ini.'
                    ),
                    'blocked_items': conflicts
                }), 409

            items_changed = True
            _release_so_reservations(order)

            SalesOrderItem.query.filter_by(order_id=order.id).delete()
            subtotal = 0
            for idx, item_data in enumerate(new_items_data, 1):
                item_total = float(item_data['quantity']) * float(item_data['unit_price'])
                item = SalesOrderItem(
                    order_id=order.id,
                    line_number=idx,
                    product_id=item_data['product_id'],
                    description=item_data.get('description'),
                    quantity=item_data['quantity'],
                    uom=item_data.get('uom', 'PCS'),
                    unit_price=item_data['unit_price'],
                    discount_percent=item_data.get('discount_percent', 0),
                    tax_percent=item_data.get('tax_percent', 0),
                    total_price=item_total
                )
                db.session.add(item)
                subtotal += item_total

            order.subtotal = subtotal
            order.total_amount = subtotal
            db.session.flush()

        if items_changed:
            new_total = float(order.total_amount or 0)
            try:
                _sync_sales_order_journal(order, old_total, new_total, user_id)
            except Exception as journal_err:
                # Never let journal sync block the actual order edit - log and continue.
                print(f'[update_order] journal sync failed for SO {order.id}: {journal_err}')

        db.session.commit()

        if items_changed:
            try:
                from utils.auto_reserve import _get_bom_requirements, _create_auto_reserve_issue
                requirements = []
                for so_item in order.items:
                    requirements.extend(_get_bom_requirements(so_item.product_id, so_item.quantity))
                if requirements:
                    _create_auto_reserve_issue(
                        requirements,
                        sales_order_id=order.id,
                        requested_by=user_id,
                        notes=f'Auto-reserved (re-created after edit) from Sales Order {order.order_number}'
                    )
                    db.session.commit()
            except Exception as reserve_err:
                db.session.rollback()
                print(f'[update_order] re-reserve failed for SO {order.id}: {reserve_err}')

        return jsonify({
            'message': 'Order updated successfully',
            'order': {
                'id': order.id,
                'order_number': order.order_number,
                'status': order.status,
                'total_amount': float(order.total_amount) if order.total_amount else 0.0
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/orders/<int:id>/cancel', methods=['PUT'])
@jwt_required()
@require_permission('sales_orders.edit')
def cancel_order(id):
    """Cancel sales order"""
    try:
        order = db.session.get(SalesOrder, id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        # Check if order can be cancelled - 'shipped' must also be blocked,
        # otherwise a physically-shipped (and possibly already-invoiced)
        # order can be cancelled, leaving its ShippingOrder/Invoice orphaned
        # with no active SO behind them.
        non_cancellable = ['shipped', 'delivered', 'cancelled']
        if order.status in non_cancellable:
            return jsonify({
                'error': f'Cannot cancel order with status: {order.status}'
            }), 400

        # order.status alone isn't reliable - create_shipping_from_qc() never
        # updates SalesOrder.status, so an SO can already have a real
        # ShippingOrder while still reading 'confirmed'/'in_production'/
        # 'ready'. Check the actual shipment record directly.
        from models.shipping import ShippingOrder
        existing_shipment = ShippingOrder.query.filter(
            ShippingOrder.sales_order_id == id,
            ShippingOrder.status != 'cancelled'
        ).first()
        if existing_shipment:
            return jsonify({
                'error': f'Order sudah memiliki pengiriman aktif ({existing_shipment.shipping_number}) - tidak bisa dibatalkan'
            }), 400

        order.status = 'cancelled'
        db.session.commit()
        
        return jsonify({
            'message': 'Order cancelled successfully',
            'order': {
                'id': order.id,
                'order_number': order.order_number,
                'status': order.status
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ===============================
# LEAD MANAGEMENT ROUTES
# ===============================

@sales_bp.route('/leads', methods=['GET'])
@jwt_required()
@require_permission('leads.view')
def get_leads():
    """Get all leads with filtering and pagination"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search', '')
        status = request.args.get('status', '')
        source = request.args.get('source', '')
        assigned_to = request.args.get('assigned_to', type=int)
        
        query = Lead.query
        
        if search:
            query = query.filter(or_(
                Lead.company_name.ilike(f'%{search}%'),
                Lead.contact_person.ilike(f'%{search}%'),
                Lead.email.ilike(f'%{search}%')
            ))
        
        if status:
            query = query.filter(Lead.lead_status == status)
        
        if source:
            query = query.filter(Lead.lead_source == source)
            
        if assigned_to:
            query = query.filter(Lead.assigned_to == assigned_to)
        
        leads = query.order_by(Lead.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'leads': [{
                'id': lead.id,
                'lead_number': lead.lead_number,
                'company_name': lead.company_name,
                'contact_person': lead.contact_person,
                'email': lead.email,
                'phone': lead.phone,
                'lead_source': lead.lead_source,
                'lead_status': lead.lead_status,
                'lead_score': lead.lead_score,
                'industry': lead.industry,
                'company_size': lead.company_size,
                'budget': float(lead.budget) if lead.budget else None,
                'assigned_to': lead.assigned_to,
                'assigned_user_name': lead.assigned_user.full_name if lead.assigned_user else None,
                'created_at': lead.created_at.isoformat(),
                'last_contacted': lead.last_contacted.isoformat() if lead.last_contacted else None,
                'next_followup': lead.next_followup.isoformat() if lead.next_followup else None
            } for lead in leads.items],
            'total': leads.total,
            'pages': leads.pages,
            'current_page': leads.page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/leads', methods=['POST'])
@jwt_required()
@require_permission('leads.create')
def create_lead():
    """Create a new lead"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # Generate lead number
        last_lead = Lead.query.order_by(Lead.id.desc()).first()
        lead_number = f"LEAD{str((last_lead.id if last_lead else 0) + 1).zfill(6)}"
        
        lead = Lead(
            lead_number=lead_number,
            company_name=data['company_name'],
            contact_person=data['contact_person'],
            job_title=data.get('job_title'),
            email=data.get('email'),
            phone=data.get('phone'),
            mobile=data.get('mobile'),
            website=data.get('website'),
            address=data.get('address'),
            city=data.get('city'),
            state=data.get('state'),
            country=data.get('country'),
            postal_code=data.get('postal_code'),
            lead_source=data.get('lead_source'),
            lead_status=data.get('lead_status', 'new'),
            industry=data.get('industry'),
            company_size=data.get('company_size'),
            annual_revenue=data.get('annual_revenue'),
            budget=data.get('budget'),
            decision_maker=data.get('decision_maker', False),
            purchase_timeline=data.get('purchase_timeline'),
            assigned_to=data.get('assigned_to'),
            notes=data.get('notes'),
            created_by=user_id
        )
        
        db.session.add(lead)
        db.session.commit()
        
        return jsonify({
            'message': 'Lead created successfully',
            'lead_id': lead.id,
            'lead_number': lead.lead_number
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/leads/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('leads.view')
def get_lead(id):
    """Get a single lead"""
    try:
        lead = db.session.get(Lead, id) or abort(404)

        return jsonify({
            'id': lead.id,
            'lead_number': lead.lead_number,
            'company_name': lead.company_name,
            'contact_person': lead.contact_person,
            'job_title': lead.job_title,
            'email': lead.email,
            'phone': lead.phone,
            'mobile': lead.mobile,
            'website': lead.website,
            'address': lead.address,
            'city': lead.city,
            'state': lead.state,
            'country': lead.country,
            'postal_code': lead.postal_code,
            'lead_source': lead.lead_source,
            'lead_status': lead.lead_status,
            'lead_score': lead.lead_score,
            'industry': lead.industry,
            'company_size': lead.company_size,
            'annual_revenue': float(lead.annual_revenue) if lead.annual_revenue else None,
            'budget': float(lead.budget) if lead.budget else None,
            'decision_maker': lead.decision_maker,
            'purchase_timeline': lead.purchase_timeline,
            'assigned_to': lead.assigned_to,
            'notes': lead.notes,
            'created_at': lead.created_at.isoformat() if lead.created_at else None
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/leads/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('leads.edit')
def update_lead(id):
    """Update a lead"""
    try:
        lead = db.session.get(Lead, id) or abort(404)
        data = request.get_json() or {}

        updatable_fields = [
            'company_name', 'contact_person', 'job_title', 'email', 'phone',
            'mobile', 'website', 'address', 'city', 'state', 'country',
            'postal_code', 'lead_source', 'lead_status', 'industry',
            'company_size', 'annual_revenue', 'budget', 'decision_maker',
            'purchase_timeline', 'assigned_to', 'notes'
        ]
        for field in updatable_fields:
            if field in data:
                setattr(lead, field, data[field])

        db.session.commit()

        return jsonify({
            'message': 'Lead updated successfully',
            'lead_id': lead.id
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/leads/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('leads.delete')
def delete_lead(id):
    """Delete a lead"""
    try:
        lead = db.session.get(Lead, id) or abort(404)

        if lead.lead_status == 'converted':
            return jsonify({'error': 'Cannot delete a lead that has already been converted to a customer'}), 400

        db.session.delete(lead)
        db.session.commit()

        return jsonify({'message': 'Lead deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/leads/bulk-action', methods=['POST'])
@jwt_required()
@require_permission('leads.create')
def bulk_lead_action():
    """Perform a bulk action (delete/export) on multiple leads"""
    try:
        data = request.get_json() or {}
        action = data.get('action')
        lead_ids = data.get('lead_ids', [])

        if not lead_ids:
            return jsonify({'error': 'No leads selected'}), 400

        if action == 'delete':
            leads = Lead.query.filter(Lead.id.in_(lead_ids)).all()
            deletable = [l for l in leads if l.lead_status != 'converted']
            skipped = len(leads) - len(deletable)
            for lead in deletable:
                db.session.delete(lead)
            db.session.commit()
            return jsonify({
                'message': f'{len(deletable)} lead(s) deleted',
                'skipped': skipped
            }), 200

        elif action == 'export':
            leads = Lead.query.filter(Lead.id.in_(lead_ids)).all()
            return jsonify({
                'leads': [{
                    'lead_number': lead.lead_number,
                    'company_name': lead.company_name,
                    'contact_person': lead.contact_person,
                    'email': lead.email,
                    'phone': lead.phone,
                    'lead_status': lead.lead_status,
                    'lead_source': lead.lead_source
                } for lead in leads]
            }), 200

        else:
            return jsonify({'error': f'Unknown bulk action: {action}'}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/leads/<int:lead_id>/convert', methods=['POST'])
@jwt_required()
@require_permission('leads.convert')
def convert_lead(lead_id):
    """Convert lead to customer and create opportunity"""
    try:
        lead = db.session.get(Lead, lead_id) or abort(404)
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # Create customer from lead
        last_customer = Customer.query.order_by(Customer.id.desc()).first()
        customer_code = f"CUST{str((last_customer.id if last_customer else 0) + 1).zfill(6)}"
        
        customer = Customer(
            code=customer_code,
            company_name=lead.company_name,
            contact_person=lead.contact_person,
            job_title=lead.job_title,
            email=lead.email,
            phone=lead.phone,
            mobile=lead.mobile,
            website=lead.website,
            billing_address=lead.address,
            billing_city=lead.city,
            billing_state=lead.state,
            billing_country=lead.country,
            billing_postal_code=lead.postal_code,
            industry=lead.industry,
            company_size=lead.company_size,
            annual_revenue=lead.annual_revenue,
            assigned_to=lead.assigned_to,
            lifecycle_stage='prospect',
            created_by=user_id
        )
        
        db.session.add(customer)
        db.session.flush()  # Get customer ID
        
        # Update lead status
        lead.lead_status = 'converted'
        lead.converted_to_customer_id = customer.id
        lead.converted_at = get_local_now()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Lead converted successfully',
            'customer_id': customer.id,
            'customer_code': customer.code
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ===============================
# OPPORTUNITY/PIPELINE ROUTES
# ===============================

@sales_bp.route('/pipelines', methods=['GET'])
@jwt_required()
@require_permission('sales.view')
def get_pipelines():
    """Get all sales pipelines"""
    try:
        pipelines = SalesPipeline.query.filter_by(is_active=True).all()
        
        return jsonify({
            'pipelines': [{
                'id': pipeline.id,
                'name': pipeline.name,
                'description': pipeline.description,
                'is_default': pipeline.is_default,
                'stages': [{
                    'id': stage.id,
                    'name': stage.name,
                    'order': stage.order,
                    'probability': stage.probability,
                    'color_code': stage.color_code,
                    'is_closed_won': stage.is_closed_won,
                    'is_closed_lost': stage.is_closed_lost
                } for stage in sorted(pipeline.stages, key=lambda x: x.order)]
            } for pipeline in pipelines]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/opportunities', methods=['GET'])
@jwt_required()
@require_permission('sales.view')
def get_opportunities():
    """Get opportunities with filtering"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search', '')
        pipeline_id = request.args.get('pipeline_id', type=int)
        stage_id = request.args.get('stage_id', type=int)
        assigned_to = request.args.get('assigned_to', type=int)
        status = request.args.get('status', '')
        
        query = Opportunity.query
        
        if search:
            query = query.filter(or_(
                Opportunity.name.ilike(f'%{search}%'),
                Opportunity.opportunity_number.ilike(f'%{search}%')
            ))
        
        if pipeline_id:
            query = query.filter(Opportunity.pipeline_id == pipeline_id)
        
        if stage_id:
            query = query.filter(Opportunity.stage_id == stage_id)
            
        if assigned_to:
            query = query.filter(Opportunity.assigned_to == assigned_to)
            
        if status:
            query = query.filter(Opportunity.status == status)
        
        opportunities = query.order_by(Opportunity.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'opportunities': [{
                'id': opp.id,
                'opportunity_number': opp.opportunity_number,
                'name': opp.name,
                'description': opp.description,
                'value': float(opp.value),
                'probability': opp.probability,
                'expected_close_date': opp.expected_close_date.isoformat() if opp.expected_close_date else None,
                'status': opp.status,
                'pipeline_name': opp.pipeline.name if opp.pipeline else None,
                'stage_name': opp.stage.name if opp.stage else None,
                'stage_color': opp.stage.color_code if opp.stage else None,
                'customer_name': opp.customer.company_name if opp.customer else None,
                'lead_name': opp.lead.company_name if opp.lead else None,
                'assigned_to': opp.assigned_to,
                'assigned_user_name': opp.assigned_user.full_name if opp.assigned_user else None,
                'created_at': opp.created_at.isoformat(),
                'last_activity_date': opp.last_activity_date.isoformat() if opp.last_activity_date else None
            } for opp in opportunities.items],
            'total': opportunities.total,
            'pages': opportunities.pages,
            'current_page': opportunities.page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/opportunities/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('sales.view')
def get_opportunity(id):
    """Get a single opportunity by id (for edit forms)"""
    try:
        opp = Opportunity.query.get_or_404(id)

        return jsonify({
            'id': opp.id,
            'opportunity_number': opp.opportunity_number,
            'name': opp.name,
            'description': opp.description,
            'lead_id': opp.lead_id,
            'customer_id': opp.customer_id,
            'pipeline_id': opp.pipeline_id,
            'stage_id': opp.stage_id,
            'value': float(opp.value) if opp.value is not None else 0,
            'probability': opp.probability,
            'expected_close_date': opp.expected_close_date.isoformat() if opp.expected_close_date else None,
            'assigned_to': opp.assigned_to,
            'source': opp.source,
            'status': opp.status,
            'competitors': opp.competitors,
            'decision_criteria': opp.decision_criteria,
            'decision_process': opp.decision_process,
            'budget_confirmed': opp.budget_confirmed,
            'authority_identified': opp.authority_identified,
            'need_identified': opp.need_identified,
            'timeline_identified': opp.timeline_identified,
            'lost_reason': opp.lost_reason,
            'next_step': opp.next_step,
            'created_at': opp.created_at.isoformat() if opp.created_at else None,
            'last_activity_date': opp.last_activity_date.isoformat() if opp.last_activity_date else None
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/opportunities', methods=['POST'])
@jwt_required()
@require_permission('sales.create')
def create_opportunity():
    """Create new opportunity"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # Generate opportunity number
        last_opp = Opportunity.query.order_by(Opportunity.id.desc()).first()
        opp_number = f"OPP{str((last_opp.id if last_opp else 0) + 1).zfill(6)}"
        
        opportunity = Opportunity(
            opportunity_number=opp_number,
            name=data['name'],
            description=data.get('description'),
            lead_id=data.get('lead_id'),
            customer_id=data.get('customer_id'),
            pipeline_id=data['pipeline_id'],
            stage_id=data['stage_id'],
            value=data.get('value', 0),
            probability=data.get('probability', 0),
            expected_close_date=datetime.strptime(data['expected_close_date'], '%Y-%m-%d').date() if data.get('expected_close_date') else None,
            assigned_to=data.get('assigned_to'),
            source=data.get('source'),
            created_by=user_id
        )
        
        db.session.add(opportunity)
        db.session.commit()
        
        return jsonify({
            'message': 'Opportunity created successfully',
            'opportunity_id': opportunity.id,
            'opportunity_number': opportunity.opportunity_number
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/opportunities/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('sales.edit')
def update_opportunity(id):
    """Update opportunity (also used to change pipeline stage / mark won/lost)"""
    try:
        opportunity = Opportunity.query.get_or_404(id)
        data = request.get_json() or {}

        updatable_fields = [
            'name', 'description', 'lead_id', 'customer_id', 'pipeline_id',
            'stage_id', 'value', 'probability', 'assigned_to', 'source',
            'competitors', 'decision_criteria', 'decision_process',
            'budget_confirmed', 'authority_identified', 'need_identified',
            'timeline_identified', 'status', 'lost_reason', 'next_step'
        ]
        for field in updatable_fields:
            if field in data:
                setattr(opportunity, field, data[field])

        if 'expected_close_date' in data and data['expected_close_date']:
            opportunity.expected_close_date = datetime.strptime(data['expected_close_date'], '%Y-%m-%d').date()

        if data.get('status') in ('won', 'lost'):
            opportunity.actual_close_date = get_local_today()

        opportunity.last_activity_date = get_local_now()

        db.session.commit()

        return jsonify({
            'message': 'Opportunity updated successfully',
            'opportunity_id': opportunity.id
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/opportunities/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('sales.delete')
def delete_opportunity(id):
    """Delete an opportunity"""
    try:
        opportunity = Opportunity.query.get_or_404(id)

        # Don't allow deleting an opportunity that already has a quotation attached
        existing_quote = Quotation.query.filter_by(opportunity_id=id).first()
        if existing_quote:
            return jsonify({'error': 'Cannot delete opportunity with existing quotations'}), 400

        db.session.delete(opportunity)
        db.session.commit()

        return jsonify({'message': 'Opportunity deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ===============================
# QUOTATION ROUTES
# ===============================

@sales_bp.route('/quotations', methods=['GET'])
@jwt_required()
@require_permission('quotations.view')
def get_quotations():
    """Get quotations with filtering"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search', '')
        status = request.args.get('status', '')
        customer_id = request.args.get('customer_id', type=int)
        
        query = Quotation.query
        
        if search:
            query = query.filter(or_(
                Quotation.quote_number.ilike(f'%{search}%')
            ))
        
        if status:
            query = query.filter(Quotation.status == status)
            
        if customer_id:
            query = query.filter(Quotation.customer_id == customer_id)
        
        quotations = query.order_by(Quotation.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'quotations': [{
                'id': quote.id,
                'quote_number': quote.quote_number,
                'revision': quote.revision,
                'customer_name': quote.customer.company_name if quote.customer else None,
                'quote_date': quote.quote_date.isoformat(),
                'valid_until': quote.valid_until.isoformat(),
                'total_amount': float(quote.total_amount),
                'status': quote.status,
                'created_at': quote.created_at.isoformat()
            } for quote in quotations.items],
            'total': quotations.total,
            'pages': quotations.pages,
            'current_page': quotations.page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/quotations', methods=['POST'])
@jwt_required()
@require_permission('quotations.create')
def create_quotation():
    """Create new quotation"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # Generate quotation number
        last_quote = Quotation.query.order_by(Quotation.id.desc()).first()
        quote_number = f"QUO{str((last_quote.id if last_quote else 0) + 1).zfill(6)}"
        
        quotation = Quotation(
            quote_number=quote_number,
            opportunity_id=data.get('opportunity_id'),
            customer_id=data['customer_id'],
            quote_date=datetime.strptime(data['quote_date'], '%Y-%m-%d').date(),
            valid_until=datetime.strptime(data['valid_until'], '%Y-%m-%d').date(),
            delivery_date=datetime.strptime(data['delivery_date'], '%Y-%m-%d').date() if data.get('delivery_date') else None,
            payment_terms=data.get('payment_terms'),
            delivery_terms=data.get('delivery_terms'),
            notes=data.get('notes'),
            terms_conditions=data.get('terms_conditions'),
            prepared_by=user_id
        )
        
        db.session.add(quotation)
        db.session.flush()
        
        # Add items
        subtotal = 0
        for idx, item_data in enumerate(data.get('items', []), 1):
            item_total = float(item_data['quantity']) * float(item_data['unit_price'])
            
            item = QuotationItem(
                quotation_id=quotation.id,
                line_number=idx,
                product_id=item_data['product_id'],
                description=item_data.get('description'),
                quantity=item_data['quantity'],
                uom=item_data.get('uom', 'PCS'),
                unit_price=item_data['unit_price'],
                discount_percent=item_data.get('discount_percent', 0),
                tax_percent=item_data.get('tax_percent', 0),
                total_price=item_total
            )
            db.session.add(item)
            subtotal += item_total
        
        quotation.subtotal = subtotal
        quotation.total_amount = subtotal
        
        db.session.commit()
        
        return jsonify({
            'message': 'Quotation created successfully',
            'quotation_id': quotation.id,
            'quote_number': quote_number
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/quotations/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('quotations.view')
def get_quotation(id):
    """Get quotation details with items"""
    try:
        quotation = Quotation.query.get_or_404(id)

        return jsonify({
            'quotation': {
                'id': quotation.id,
                'quote_number': quotation.quote_number,
                'revision': quotation.revision,
                'opportunity_id': quotation.opportunity_id,
                'customer_id': quotation.customer_id,
                'customer_name': quotation.customer.company_name if quotation.customer else None,
                'quote_date': quotation.quote_date.isoformat() if quotation.quote_date else None,
                'valid_until': quotation.valid_until.isoformat() if quotation.valid_until else None,
                'delivery_date': quotation.delivery_date.isoformat() if quotation.delivery_date else None,
                'payment_terms': quotation.payment_terms,
                'delivery_terms': quotation.delivery_terms,
                'subtotal': float(quotation.subtotal or 0),
                'discount_percent': float(quotation.discount_percent or 0),
                'discount_amount': float(quotation.discount_amount or 0),
                'tax_percent': float(quotation.tax_percent or 0),
                'tax_amount': float(quotation.tax_amount or 0),
                'shipping_cost': float(quotation.shipping_cost or 0),
                'total_amount': float(quotation.total_amount or 0),
                'status': quotation.status,
                'notes': quotation.notes,
                'terms_conditions': quotation.terms_conditions,
                'converted_to_order_id': quotation.converted_to_order_id,
                'items': [{
                    'id': item.id,
                    'line_number': item.line_number,
                    'product_id': item.product_id,
                    'product_name': item.product.name if item.product else None,
                    'description': item.description,
                    'quantity': float(item.quantity),
                    'uom': item.uom,
                    'unit_price': float(item.unit_price),
                    'discount_percent': float(item.discount_percent or 0),
                    'tax_percent': float(item.tax_percent or 0),
                    'total_amount': float(item.total_price)
                } for item in quotation.items]
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/quotations/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('quotations.edit')
def update_quotation(id):
    """Update an existing quotation (only allowed while not yet converted)"""
    try:
        quotation = Quotation.query.get_or_404(id)

        if quotation.status == 'converted':
            return jsonify({'error': 'Cannot edit a quotation that has been converted to a sales order'}), 400

        data = request.get_json() or {}

        if 'customer_id' in data:
            quotation.customer_id = data['customer_id']
        if data.get('quote_date'):
            quotation.quote_date = datetime.strptime(data['quote_date'], '%Y-%m-%d').date()
        if data.get('valid_until'):
            quotation.valid_until = datetime.strptime(data['valid_until'], '%Y-%m-%d').date()
        if data.get('delivery_date'):
            quotation.delivery_date = datetime.strptime(data['delivery_date'], '%Y-%m-%d').date()
        for field in ('payment_terms', 'delivery_terms', 'notes', 'terms_conditions', 'opportunity_id'):
            if field in data:
                setattr(quotation, field, data[field])

        if 'items' in data:
            # Replace all items
            QuotationItem.query.filter_by(quotation_id=quotation.id).delete()

            subtotal = 0
            for idx, item_data in enumerate(data.get('items', []), 1):
                item_total = float(item_data['quantity']) * float(item_data['unit_price'])
                item = QuotationItem(
                    quotation_id=quotation.id,
                    line_number=idx,
                    product_id=item_data['product_id'],
                    description=item_data.get('description'),
                    quantity=item_data['quantity'],
                    uom=item_data.get('uom', 'PCS'),
                    unit_price=item_data['unit_price'],
                    discount_percent=item_data.get('discount_percent', 0),
                    tax_percent=item_data.get('tax_percent', 0),
                    total_price=item_total
                )
                db.session.add(item)
                subtotal += item_total

            quotation.subtotal = subtotal
            quotation.total_amount = subtotal

        db.session.commit()

        return jsonify({
            'message': 'Quotation updated successfully',
            'quotation_id': quotation.id
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/quotations/<int:id>/convert', methods=['POST'])
@jwt_required()
@require_permission('quotations.convert')
def convert_quotation_to_order(id):
    """Convert an accepted quotation into a draft sales order.

    Mirrors Accurate Online's Penawaran Penjualan -> Pesanan Penjualan flow:
    the quotation's customer and line items are copied into a new draft
    Sales Order, and the quotation is marked as converted with a reference
    to the resulting order (see Quotation.converted_to_order_id).
    """
    try:
        quotation = Quotation.query.get_or_404(id)
        user_id = get_jwt_identity()

        if quotation.status == 'converted':
            return jsonify({'error': 'Quotation has already been converted to a sales order'}), 400

        order_number = generate_number_v2('sales_order', 'SO', SalesOrder, 'order_number')

        order = SalesOrder(
            order_number=order_number,
            customer_id=quotation.customer_id,
            order_date=get_local_now(),
            status='draft',
            priority='normal',
            payment_terms=quotation.payment_terms,
            notes=f'Converted from Quotation {quotation.quote_number}',
            created_by=user_id
        )
        db.session.add(order)
        db.session.flush()

        subtotal = 0
        for idx, qitem in enumerate(quotation.items, 1):
            item_total = float(qitem.quantity) * float(qitem.unit_price)
            item = SalesOrderItem(
                order_id=order.id,
                line_number=idx,
                product_id=qitem.product_id,
                description=qitem.description,
                quantity=qitem.quantity,
                uom=qitem.uom,
                unit_price=qitem.unit_price,
                discount_percent=qitem.discount_percent,
                tax_percent=qitem.tax_percent,
                total_price=item_total
            )
            db.session.add(item)
            subtotal += item_total

        order.subtotal = subtotal
        order.total_amount = subtotal

        quotation.status = 'converted'
        quotation.converted_to_order_id = order.id

        db.session.commit()

        return jsonify({
            'message': 'Quotation converted to sales order successfully',
            'order_id': order.id,
            'order_number': order_number,
            'quotation_id': quotation.id
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ===============================
# ACTIVITY ROUTES
# ===============================

@sales_bp.route('/activities', methods=['GET'])
@jwt_required()
@require_permission('sales.view')
def get_activities():
    """Get sales activities"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        activity_type = request.args.get('activity_type', '')
        status = request.args.get('status', '')
        assigned_to = request.args.get('assigned_to', type=int)
        
        query = SalesActivity.query
        
        if activity_type:
            query = query.filter(SalesActivity.activity_type == activity_type)
        
        if status:
            query = query.filter(SalesActivity.status == status)
            
        if assigned_to:
            query = query.filter(SalesActivity.assigned_to == assigned_to)
        
        activities = query.order_by(SalesActivity.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'activities': [{
                'id': activity.id,
                'activity_number': activity.activity_number,
                'subject': activity.subject,
                'activity_type': activity.activity_type,
                'status': activity.status,
                'priority': activity.priority,
                'start_date': activity.start_date.isoformat() if activity.start_date else None,
                'due_date': activity.due_date.isoformat() if activity.due_date else None,
                'assigned_to': activity.assigned_to,
                'assigned_user_name': activity.assigned_user.full_name if activity.assigned_user else None,
                'lead_name': activity.lead.company_name if activity.lead else None,
                'customer_name': activity.customer.company_name if activity.customer else None,
                'opportunity_name': activity.opportunity.name if activity.opportunity else None,
                'created_at': activity.created_at.isoformat()
            } for activity in activities.items],
            'total': activities.total,
            'pages': activities.pages,
            'current_page': activities.page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/activities', methods=['POST'])
@jwt_required()
@require_permission('sales.create')
def create_activity():
    """Create new sales activity"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # Generate activity number
        last_activity = SalesActivity.query.order_by(SalesActivity.id.desc()).first()
        activity_number = f"ACT{str((last_activity.id if last_activity else 0) + 1).zfill(6)}"
        
        activity = SalesActivity(
            activity_number=activity_number,
            subject=data['subject'],
            description=data.get('description'),
            activity_type=data['activity_type'],
            status=data.get('status', 'planned'),
            priority=data.get('priority', 'normal'),
            start_date=datetime.fromisoformat(data['start_date'].replace('Z', '+00:00')) if data.get('start_date') else None,
            due_date=datetime.fromisoformat(data['due_date'].replace('Z', '+00:00')) if data.get('due_date') else None,
            lead_id=data.get('lead_id'),
            customer_id=data.get('customer_id'),
            opportunity_id=data.get('opportunity_id'),
            assigned_to=data['assigned_to'],
            location=data.get('location'),
            created_by=user_id
        )
        
        db.session.add(activity)
        db.session.commit()
        
        return jsonify({
            'message': 'Activity created successfully',
            'activity_id': activity.id,
            'activity_number': activity_number
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ===============================
# ANALYTICS ROUTES
# ===============================

@sales_bp.route('/analytics/dashboard', methods=['GET'])
@jwt_required()
@require_permission('sales.view')
def get_sales_dashboard():
    """Get sales dashboard analytics"""
    try:
        user_id = get_jwt_identity()
        
        # Get lead metrics
        total_leads = Lead.query.count()
        new_leads = Lead.query.filter(Lead.lead_status == 'new').count()
        qualified_leads = Lead.query.filter(Lead.lead_status == 'qualified').count()
        converted_leads = Lead.query.filter(Lead.lead_status == 'converted').count()
        
        # Get opportunity metrics
        total_opportunities = Opportunity.query.filter(Opportunity.status == 'open').count()
        opportunity_value = db.session.query(func.sum(Opportunity.value)).filter(
            Opportunity.status == 'open'
        ).scalar() or 0
        
        won_opportunities = Opportunity.query.filter(Opportunity.status == 'won').count()
        won_value = db.session.query(func.sum(Opportunity.value)).filter(
            Opportunity.status == 'won'
        ).scalar() or 0
        
        # Get quotation metrics
        total_quotations = Quotation.query.count()
        pending_quotations = Quotation.query.filter(Quotation.status == 'sent').count()
        accepted_quotations = Quotation.query.filter(Quotation.status == 'accepted').count()
        
        # Get activity metrics
        total_activities = SalesActivity.query.count()
        pending_activities = SalesActivity.query.filter(
            SalesActivity.status.in_(['planned', 'in_progress'])
        ).count()
        overdue_activities = SalesActivity.query.filter(
            and_(
                SalesActivity.due_date < get_local_now(),
                SalesActivity.status != 'completed'
            )
        ).count()
        
        return jsonify({
            'lead_metrics': {
                'total_leads': total_leads,
                'new_leads': new_leads,
                'qualified_leads': qualified_leads,
                'converted_leads': converted_leads,
                'conversion_rate': round((converted_leads / total_leads * 100) if total_leads else 0, 2)
            },
            'opportunity_metrics': {
                'total_opportunities': total_opportunities,
                'total_value': float(opportunity_value),
                'won_opportunities': won_opportunities,
                'won_value': float(won_value),
                'win_rate': round((won_opportunities / (won_opportunities + Opportunity.query.filter(Opportunity.status == 'lost').count()) * 100) if (won_opportunities + Opportunity.query.filter(Opportunity.status == 'lost').count()) else 0, 2)
            },
            'quotation_metrics': {
                'total_quotations': total_quotations,
                'pending_quotations': pending_quotations,
                'accepted_quotations': accepted_quotations,
                'acceptance_rate': round((accepted_quotations / total_quotations * 100) if total_quotations else 0, 2)
            },
            'activity_metrics': {
                'total_activities': total_activities,
                'pending_activities': pending_activities,
                'overdue_activities': overdue_activities
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ===============================
# SALES FORECAST MATRIX ROUTES (2026-08-24)
# Replaces the old 1-row-per-product-per-period SalesForecast CRUD. See
# SALES_FORECAST_MATRIX_RENCANA_TEKNIS.md for the full design (§7 = UI decisions
# this backend serves: modal create -> single grid page -> inline approve).
# ===============================

def _parse_window():
    """Shared by get_forecast/add_forecast_line/update_forecast_line - `window` (YYYY-MM,
    optional query param) = bulan pertama grid, default bulan kalender berjalan (rolling).
    `count` (optional, default 12) = berapa bulan. Returns (window_start: date, periods: list[date])."""
    from dateutil.relativedelta import relativedelta
    window_raw = request.args.get('window')
    if window_raw:
        parts = str(window_raw).split('-')
        window_start = date(int(parts[0]), int(parts[1]), 1)
    else:
        window_start = get_local_now().date().replace(day=1)
    count = min(max(request.args.get('count', 12, type=int), 1), 36)
    return window_start, [window_start + relativedelta(months=k) for k in range(count)]


def _forecast_header_summary(h):
    line_ids = [l.id for l in h.lines]
    total_qty = 0.0
    if line_ids:
        total_qty = float(db.session.query(db.func.coalesce(db.func.sum(ForecastLineMonth.quantity), 0)).filter(
            ForecastLineMonth.line_id.in_(line_ids)
        ).scalar() or 0)
    total_converted = sum(float(c.quantity or 0) for line in h.lines for c in line.conversions)
    return {
        'id': h.id,
        'period_start': h.period_start.isoformat(),
        'period_end': h.period_end.isoformat(),
        'name': h.name,
        'status': h.status,
        'line_count': len(h.lines),
        'total_qty': total_qty,
        'total_converted_qty': total_converted,
        'approved_by': h.approved_by,
        'approved_at': h.approved_at.isoformat() if h.approved_at else None,
        'created_at': h.created_at.isoformat(),
        'updated_at': h.updated_at.isoformat(),
    }


def _converted_qty_by_period(line):
    """Sum of ForecastLineConversion.quantity per calendar period (Date) for this line -
    a cell can have multiple conversion rows now (partial realizations over time)."""
    by_period: dict = {}
    for c in line.conversions:
        by_period[c.period] = by_period.get(c.period, 0) + float(c.quantity or 0)
    return by_period


def _forecast_line_detail(line, periods):
    """periods: list[date] (day=1) - the calendar months currently shown in the grid
    window (rolling putaran 6, 2026-08-25). Returns qty_by_period keyed 'YYYY-MM' for
    exactly those months (0 if no ForecastLineMonth row yet for that month)."""
    converted = _converted_qty_by_period(line)
    months_by_period = {m.period: m for m in line.months}
    qty_by_period = {}
    converted_by_period_out = {}
    so_bumped_by_period_out = {}
    for p in periods:
        key = p.strftime('%Y-%m')
        month_row = months_by_period.get(p)
        qty_by_period[key] = float(month_row.quantity) if month_row else 0.0
        if p in converted:
            converted_by_period_out[key] = converted[p]
        if month_row and month_row.so_bumped_at:
            so_bumped_by_period_out[key] = month_row.so_bumped_at.isoformat()
    return {
        'id': line.id,
        'product_id': line.product_id,
        'product_name': line.product.name if line.product else None,
        'product_code': line.product.code if line.product else None,
        'qty_by_period': qty_by_period,
        # Tracking realisasi vs forecast (manajemen, 2026-08-24): per bulan kalender, qty
        # yang sudah benar-benar jadi Work Order - frontend membandingkan ini terhadap
        # qty_by_period untuk tampilkan status sisa (oranye) / pas (abu-abu) / lebih (hijau).
        'converted_qty_by_period': converted_by_period_out,
        # "Grid forecast harus hidup" (2026-08-26): bulan-bulan yang qty-nya naik OTOMATIS
        # karena demand SO real melampaui target (lihat _bump_forecast_for_so_item di
        # utils/sales_order_workflow.py) - frontend pakai ini buat kasih keterangan visual
        # di sel itu (bukan notifikasi terpisah, cukup penanda di grid-nya sendiri).
        'so_bumped_periods': so_bumped_by_period_out,
    }


@sales_bp.route('/forecasts', methods=['GET'])
@jwt_required()
@require_permission('sales.view')
def get_forecasts():
    """List forecast headers (1 per rolling 12-month window) - §7.3 List page."""
    try:
        headers = ForecastHeader.query.order_by(ForecastHeader.period_start.desc()).all()
        return jsonify({'forecasts': [_forecast_header_summary(h) for h in headers]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/forecasts', methods=['POST'])
@jwt_required()
@require_permission('sales.create')
def create_forecast():
    """Create a new forecast header - §7.1 modal. Rombak 2026-08-25 (keputusan manajemen):
    forecast tidak lagi terkunci ke tahun kalender - staf pilih BULAN MULAI bebas (mis.
    Agustus 2026), berlaku 12 bulan berturut-turut dari situ (sampai Juli 2027)."""
    try:
        data = request.get_json() or {}
        user_id = get_jwt_identity()
        period_start_raw = data.get('period_start')  # "YYYY-MM" atau "YYYY-MM-DD"
        if not period_start_raw:
            return jsonify({'error': 'period_start wajib diisi (bulan mulai forecast)'}), 400
        try:
            parts = str(period_start_raw).split('-')
            period_start = date(int(parts[0]), int(parts[1]), 1)
        except (ValueError, IndexError):
            return jsonify({'error': 'Format period_start tidak valid, pakai YYYY-MM'}), 400

        # 2026-08-25 (masukan manajemen, putaran 4): boleh ada BANYAK forecast yang mulai
        # di bulan yang sama (mis. beberapa skenario/versi forecast Agustus 2026 sekaligus)
        # - dulu diblokir 1 per period_start, ternyata itu bukan yang diinginkan. Header
        # dibedakan lewat `name`, bukan period_start.

        # 2026-08-25 (rombak putaran 3): tombol Approve dihapus - manajemen bilang simpan
        # saja sudah cukup, tidak ada langkah approve terpisah lagi. status tetap disimpan
        # 'approved' langsung supaya Safety Stock/MRP (utils/forecast_helper.py,
        # utils/mrp_time_phased.py) yang hanya membaca status='approved' tetap jalan tanpa
        # perubahan di sisi mereka.
        header = ForecastHeader(
            period_start=period_start,
            name=data.get('name') or None,
            status='approved',
            approved_by=user_id,
            approved_at=datetime.utcnow(),
            created_by=user_id,
        )
        # default_name butuh header.period_end (property, aman dipanggil sebelum commit)
        if not header.name:
            header.name = f'{period_start.strftime("%b %Y")} - {header.period_end.strftime("%b %Y")}'
        db.session.add(header)
        db.session.commit()
        return jsonify({'message': 'Forecast header dibuat', 'id': header.id, 'period_start': header.period_start.isoformat()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/forecasts/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('sales.view')
def get_forecast(id):
    """Full grid for 1 header - §7.2 single grid page (list + edit + approve all here).

    Rombak putaran 6 (2026-08-25, keputusan manajemen - rolling + bisa geser lihat
    histori): grid TIDAK lagi terikat ke header.period_start yang tetap. Query param
    `window` (YYYY-MM, opsional) = bulan pertama yang ditampilkan - default ke bulan
    KALENDER BERJALAN (hari ini) supaya "rolling" otomatis maju tiap bulan berganti kalau
    tidak di-geser manual. `count` (opsional, default 12) = berapa bulan ditampilkan
    sekaligus. Frontend geser window dengan mengirim `window` yang berbeda (mundur =
    lihat histori, maju = lihat depan) - lihat SalesForecastGrid.tsx.
    """
    try:
        header = db.session.get(ForecastHeader, id) or abort(404)
        window_start, periods = _parse_window()

        # Rentang data sebenarnya yang PERNAH diisi utk header ini - dipakai frontend
        # buat tahu batas kalau digeser terus mundur/maju (tombol "geser" dinonaktifkan
        # kalau sudah di ujung data + window sekarang, bukan dibatasi keras di backend).
        line_ids = [l.id for l in header.lines]
        earliest = latest = None
        if line_ids:
            bounds = db.session.query(db.func.min(ForecastLineMonth.period), db.func.max(ForecastLineMonth.period)).filter(
                ForecastLineMonth.line_id.in_(line_ids)
            ).first()
            earliest, latest = bounds if bounds else (None, None)

        return jsonify({
            **_forecast_header_summary(header),
            'window_start': window_start.isoformat(),
            'window_months': [p.strftime('%Y-%m') for p in periods],
            'earliest_period': earliest.isoformat() if earliest else None,
            'latest_period': latest.isoformat() if latest else None,
            'lines': [_forecast_line_detail(l, periods) for l in header.lines],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/forecasts/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('sales.delete')
def delete_forecast(id):
    """Delete a whole forecast header (and its lines, cascade)."""
    try:
        header = db.session.get(ForecastHeader, id) or abort(404)
        db.session.delete(header)
        db.session.commit()
        return jsonify(success_response('api.success'))
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/forecasts/<int:id>/approve', methods=['POST'])
@jwt_required()
@require_permission('sales.approve')
def approve_forecast(id):
    """Approve a header inline from the grid page itself (§7.2) - no separate Approval
    Dashboard redirect, matching the pattern already recommended for Stock Opname/SO."""
    try:
        header = db.session.get(ForecastHeader, id) or abort(404)
        user_id = get_jwt_identity()
        header.status = 'approved'
        header.approved_by = user_id
        header.approved_at = get_local_now()
        db.session.commit()
        return jsonify({'message': f'Forecast {header.period_start.strftime("%b %Y")} approved', 'status': header.status}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/forecasts/<int:id>/lines', methods=['POST'])
@jwt_required()
@require_permission('sales.create')
def add_forecast_line(id):
    """Add 1 product row to the grid - inline search-and-add (§7.2), qty all start at 0."""
    try:
        header = db.session.get(ForecastHeader, id) or abort(404)
        data = request.get_json() or {}
        product_id = data.get('product_id')
        if not product_id:
            return jsonify({'error': 'product_id wajib diisi'}), 400

        if ForecastLine.query.filter_by(header_id=header.id, product_id=product_id).first():
            return jsonify({'error': 'Produk ini sudah ada di grid tahun ini'}), 400

        line = ForecastLine(header_id=header.id, product_id=product_id)
        db.session.add(line)
        db.session.commit()
        _, periods = _parse_window()
        return jsonify({'message': 'Baris produk ditambahkan', 'line': _forecast_line_detail(line, periods)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/forecast-lines/<int:line_id>', methods=['PUT'])
@jwt_required()
@require_permission('sales.edit')
def update_forecast_line(line_id):
    """Update qty cells for 1 product row.

    Rombak putaran 6 (2026-08-25): payload sekarang `{updates: [{period: 'YYYY-MM',
    quantity}, ...]}` (bulan kalender asli, bebas berapa banyak sekaligus - tidak lagi
    qty_m1..qty_m12 tetap) - upsert ke ForecastLineMonth per baris.

    2026-08-24 (proteksi realisasi, keputusan manajemen):
    - Menurunkan qty sebuah bulan di BAWAH qty yang sudah nyata jadi Work Order
      (converted_qty) DIBLOKIR total (400) - forecast tidak boleh lebih kecil dari yang
      sudah direalisasi.
    """
    try:
        line = db.session.get(ForecastLine, line_id) or abort(404)
        data = request.get_json() or {}
        updates = data.get('updates') or []

        converted = _converted_qty_by_period(line)
        parsed = []  # (period: date, quantity: float)
        blocked = []
        for u in updates:
            period_raw = u.get('period')
            if not period_raw:
                continue
            parts = str(period_raw).split('-')
            period = date(int(parts[0]), int(parts[1]), 1)
            new_qty = float(u.get('quantity') or 0)
            already_converted = converted.get(period, 0)
            if new_qty < already_converted:
                blocked.append({'period': period.strftime('%Y-%m'), 'new_qty': new_qty, 'converted_qty': already_converted})
            parsed.append((period, new_qty))
        if blocked:
            return jsonify({
                'error': 'Qty tidak boleh lebih kecil dari yang sudah dikonversi jadi Work Order untuk bulan tersebut',
                'blocked_periods': blocked,
            }), 400

        existing = {m.period: m for m in line.months}
        for period, new_qty in parsed:
            if period in existing:
                existing[period].quantity = new_qty
                # Edit manual menggantikan angka otomatis - keterangan "naik otomatis dari
                # SO" tidak berlaku lagi buat sel ini, PPIC yang barusan set angkanya sendiri.
                existing[period].so_bumped_at = None
            else:
                db.session.add(ForecastLineMonth(line_id=line.id, period=period, quantity=new_qty))

        db.session.commit()
        _, periods = _parse_window()
        return jsonify({'message': 'Baris diperbarui', 'line': _forecast_line_detail(line, periods)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/forecast-lines/<int:line_id>', methods=['DELETE'])
@jwt_required()
@require_permission('sales.delete')
def delete_forecast_line(line_id):
    """Remove 1 product row from the grid."""
    try:
        line = db.session.get(ForecastLine, line_id) or abort(404)
        db.session.delete(line)
        db.session.commit()
        return jsonify(success_response('api.success'))
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/forecast-lines/<int:line_id>/inventory', methods=['GET'])
@jwt_required()
@require_permission('sales.view')
def get_forecast_line_inventory(line_id):
    """FG + WIP + kecukupan bahan baku (BOM) untuk produk baris ini - §7.2 expand-row
    panel (rombak 2026-08-25, keputusan manajemen: awalnya cuma stok FG per gudang,
    ternyata yang dibutuhkan justru 3 hal ini sekaligus supaya staf bisa lihat apakah
    forecast bulan ini bisa dipenuhi).

    Query param opsional `qty` = forecast qty bulan yang sedang dilihat di frontend -
    dipakai untuk hitung kebutuhan bahan baku (BOM item qty x qty ini). Tanpa `qty`,
    bagian bom tetap dikirim tapi shortage tidak dihitung (qty_needed = None).
    """
    try:
        from models.warehouse import Inventory, WarehouseLocation, WarehouseZone
        from models.production import WorkOrder, BillOfMaterials, BOMItem, ShiftProduction
        from sqlalchemy import func
        line = db.session.get(ForecastLine, line_id) or abort(404)
        product_id = line.product_id

        # --- FG: stok jadi per zona gudang ---
        fg_rows = db.session.query(Inventory, WarehouseZone).join(
            WarehouseLocation, Inventory.location_id == WarehouseLocation.id
        ).join(
            WarehouseZone, WarehouseLocation.zone_id == WarehouseZone.id
        ).filter(
            Inventory.product_id == product_id,
            Inventory.is_active == True
        ).all()
        by_zone: dict = {}
        for inv, zone in fg_rows:
            z = by_zone.setdefault(zone.id, {'location_id': zone.id, 'location_name': zone.name,
                                              'quantity_on_hand': 0.0, 'quantity_reserved': 0.0, 'quantity_available': 0.0})
            z['quantity_on_hand'] += float(inv.quantity_on_hand or 0)
            z['quantity_reserved'] += float(inv.quantity_reserved or 0)
            z['quantity_available'] += float(inv.quantity_available or 0)

        # --- WIP: dari Shift Input (ShiftProduction.good_quantity), BUKAN
        # WorkOrder.quantity_produced - kolom itu diisi jalur lain (ProductionRecord,
        # routes/production.py) yang datanya jauh lebih jarang terisi dibanding shift
        # input harian staf produksi (routes/production_input.py). Sisa WO = target
        # dikurangi total good_quantity shift input yang tertaut ke WO tsb.
        active_wos = WorkOrder.query.filter(
            WorkOrder.product_id == product_id,
            WorkOrder.status.in_(['released', 'in_progress']),
        ).all()
        wip_orders = []
        wip_total = 0.0
        for wo in active_wos:
            produced = db.session.query(func.sum(ShiftProduction.good_quantity)).filter(
                ShiftProduction.work_order_id == wo.id
            ).scalar() or 0
            remaining = max(float(wo.quantity or 0) - float(produced), 0)
            wip_total += remaining
            wip_orders.append({
                'wo_number': wo.wo_number,
                'status': wo.status,
                'target_quantity': float(wo.quantity or 0),
                'produced_quantity': float(produced),
                'remaining_quantity': remaining,
            })

        # --- BOM: kecukupan bahan baku untuk qty forecast bulan ini ---
        qty_param = request.args.get('qty')
        forecast_qty = float(qty_param) if qty_param else None
        bom = BillOfMaterials.query.filter_by(product_id=product_id, bom_level='finished_goods', is_active=True).first()
        bom_materials = []
        if bom:
            batch_size = float(bom.batch_size or 1)
            items = BOMItem.query.filter_by(bom_id=bom.id).filter(BOMItem.material_id.isnot(None)).all()
            for item in items:
                material = item.material
                per_unit = float(item.quantity or 0) / batch_size if batch_size else 0
                stock = db.session.query(func.sum(Inventory.quantity_available)).filter(
                    Inventory.material_id == item.material_id,
                    Inventory.is_active == True,
                ).scalar() or 0
                needed = per_unit * forecast_qty if forecast_qty is not None else None
                bom_materials.append({
                    'material_id': item.material_id,
                    'material_name': material.name if material else None,
                    'material_code': material.code if material else None,
                    'uom': item.uom,
                    'qty_per_unit': per_unit,
                    'qty_needed': needed,
                    'qty_available': float(stock),
                    'shortage': (needed - float(stock)) if needed is not None and needed > float(stock) else 0,
                })

        # --- Perbandingan Target vs SO Real vs Converted per bulan (masukan user 2026-08-26,
        # "tabel kecil untuk perbandingan di forecast") - taruh di panel expand-row ini,
        # bukan kolom baru di grid utama. `periods` (opsional, CSV "YYYY-MM,YYYY-MM,...")
        # dikirim frontend supaya kolomnya sama persis dengan window bulan yang lagi
        # ditampilkan di grid; tanpa itu, fallback ke semua bulan yang punya baris target.
        from dateutil.relativedelta import relativedelta
        periods_param = request.args.get('periods')
        if periods_param:
            period_list = []
            for token in periods_param.split(','):
                token = token.strip()
                if not token:
                    continue
                y, m = token.split('-')
                period_list.append(date(int(y), int(m), 1))
        else:
            period_list = sorted({m.period for m in line.months})

        converted = _converted_qty_by_period(line)
        months_by_period_cmp = {m.period: m for m in line.months}
        period_col = func.coalesce(SalesOrder.required_date, SalesOrder.order_date)
        comparison = []
        for p in period_list:
            target = float(months_by_period_cmp[p].quantity) if p in months_by_period_cmp else 0.0
            next_month = p + relativedelta(months=1)
            so_real = db.session.query(func.coalesce(func.sum(SalesOrderItem.quantity), 0)).join(
                SalesOrder, SalesOrder.id == SalesOrderItem.order_id
            ).filter(
                SalesOrderItem.product_id == product_id,
                SalesOrder.status.notin_(['draft', 'cancelled']),
                period_col >= p,
                period_col < next_month,
            ).scalar()
            comparison.append({
                'period': p.strftime('%Y-%m'),
                'target': target,
                'so_real': float(so_real or 0),
                'converted': converted.get(p, 0),
            })

        return jsonify({
            'product_id': product_id,
            'product_name': line.product.name if line.product else None,
            'fg': list(by_zone.values()),
            'wip': {'total': wip_total, 'work_orders': wip_orders},
            'bom': {'forecast_qty': forecast_qty, 'materials': bom_materials},
            'comparison': comparison,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/forecasts/<int:header_id>/bulk-convert-to-order', methods=['POST'])
@jwt_required()
@require_permission('sales_orders.create')
def bulk_convert_forecast_to_order(header_id):
    """Convert several (product, this-1-month) cells into Monthly Schedule rows
    (build-ahead production PLANNING, bukan langsung Work Order) - §4, rombak putaran 7
    (keputusan manajemen 2026-08-26): forecast itu agregat SEMUA customer, jadi hasil
    convert-nya TIDAK boleh jadi Sales Order (butuh customer tunggal), dan TIDAK boleh
    langsung jadi Work Order juga (skip review PPIC). Alur yang benar: Forecast ->
    Monthly Schedule (routes/schedule_grid.py, SUDAH ADA modul lengkapnya - CRUD +
    approval) -> PPIC pecah ke Weekly Planning per minggu (fitur "add to weekly" SUDAH
    ADA) -> approve -> generate Work Order (SUDAH ADA) -> Batch Planning. Endpoint ini
    cuma titik masuknya - modul-modul setelahnya sudah lengkap, tidak dibangun ulang.

    Endpoint name (URL) sengaja dipertahankan "bulk-convert-to-order" untuk kompatibilitas
    frontend - "order" di sini sekarang berarti rencana produksi (Monthly Schedule).

    target_ctn dihitung dari quantity (satuan dasar produk) dibagi pack_per_karton produk
    itu - Monthly Schedule bekerja dalam satuan karton, forecast dalam satuan dasar.
    Kalau baris Monthly Schedule untuk (produk, bulan, mesin) itu sudah ada dari
    konversi sebelumnya, target_ctn-nya DITAMBAH (bukan bikin baris baru) - forecast
    boleh dikonversi bertahap (partial), sama seperti model realisasi yang sudah ada.

    machine_id diambil dari ProductionRecipe.is_default produk itu (kalau ada) - PPIC
    tetap bisa ganti manual di halaman Monthly Production Plan sebelum di-approve.

    Body: { period: 'YYYY-MM', items: [{line_id, quantity}] }
    """
    try:
        from routes.schedule_grid import MonthlySchedule
        from models.batch_scheduling import ProductionRecipe
        from models.product import Product
        header = db.session.get(ForecastHeader, header_id) or abort(404)
        user_id = get_jwt_identity()
        data = request.get_json() or {}

        period_raw = data.get('period')
        if not period_raw:
            return jsonify({'error': 'period wajib diisi (YYYY-MM)'}), 400
        parts = str(period_raw).split('-')
        period = date(int(parts[0]), int(parts[1]), 1)

        items_data = data.get('items') or []
        if not items_data:
            return jsonify({'error': 'Pilih minimal 1 produk untuk di-convert'}), 400

        lines_by_id = {}
        for item_data in items_data:
            line_id = item_data.get('line_id')
            line = db.session.get(ForecastLine, line_id) if line_id else None
            if not line or line.header_id != header.id:
                return jsonify({'error': f'Forecast line {line_id} tidak valid untuk header ini'}), 400
            quantity = item_data.get('quantity')
            if not quantity or float(quantity) <= 0:
                return jsonify({'error': f'Quantity wajib diisi dan lebih dari 0 untuk {line.product.name if line.product else line_id}'}), 400
            lines_by_id[line_id] = (line, quantity)

        result_schedules = []
        for line, quantity in lines_by_id.values():
            product = line.product or db.session.get(Product, line.product_id)
            default_recipe = ProductionRecipe.query.filter_by(product_id=line.product_id, is_default=True, is_active=True).first()
            machine_id = default_recipe.machine_id if default_recipe else None

            try:
                pack_per_ctn = int(product.pack_per_karton) if product and product.pack_per_karton else 1
            except (ValueError, TypeError):
                pack_per_ctn = 1
            if pack_per_ctn <= 0:
                pack_per_ctn = 1
            target_ctn_delta = Decimal(str(quantity)) / pack_per_ctn

            schedule = MonthlySchedule.query.filter_by(
                year=period.year, month=period.month, product_id=line.product_id, machine_id=machine_id
            ).first()
            if schedule:
                schedule.target_ctn = (schedule.target_ctn or 0) + target_ctn_delta
                schedule.remaining_ctn = (schedule.remaining_ctn or 0) + target_ctn_delta
            else:
                schedule = MonthlySchedule(
                    year=period.year,
                    month=period.month,
                    product_id=line.product_id,
                    machine_id=machine_id,
                    target_ctn=target_ctn_delta,
                    remaining_ctn=target_ctn_delta,
                    scheduled_ctn=0,
                    status='draft',
                    notes=f'Dari Forecast {header.name}',
                    created_by=user_id,
                )
                db.session.add(schedule)
            db.session.flush()

            db.session.add(ForecastLineConversion(
                line_id=line.id,
                period=period,
                quantity=quantity,
                monthly_schedule_id=schedule.id,
                converted_by=user_id,
            ))
            result_schedules.append({
                'id': schedule.id, 'product_name': product.name if product else None,
                'quantity': float(quantity), 'target_ctn': float(target_ctn_delta),
                'has_recipe': default_recipe is not None,
            })

        db.session.commit()

        # Produk yang belum ada Production Recipe default (mesin) - baris Monthly
        # Schedule-nya tetap dibuat, tapi PPIC perlu pilih mesin manual di halaman
        # Monthly Production Plan sebelum lanjut di-approve/generate WO.
        no_recipe = [w['product_name'] for w in result_schedules if not w['has_recipe']]
        message = f'{len(result_schedules)} produk dikirim ke Monthly Planning ({period.strftime("%b %Y")}) - tinggal direview PPIC di halaman Monthly Production Plan'
        if no_recipe:
            message += f'. Perhatian: {len(no_recipe)} produk belum ada Production Recipe default ({", ".join(no_recipe)}) - pilih mesin manual dulu di Monthly Production Plan.'

        return jsonify({
            'message': message,
            'schedules': result_schedules,
            'period': period.strftime('%Y-%m'),
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# Shipping Integration
@sales_bp.route('/orders/<int:order_id>/create-shipment', methods=['POST'])
@jwt_required()
@require_permission('sales_orders.ship')
def create_shipment_from_order(order_id):
    """Create shipping order from sales order"""
    try:
        from utils.shipping_integration import create_shipping_from_sales_order
        
        data = request.get_json() or {}
        logistics_provider_id = data.get('logistics_provider_id')
        service_type = data.get('service_type', 'regular')
        
        shipping_order = create_shipping_from_sales_order(
            order_id, 
            logistics_provider_id, 
            service_type
        )
        
        return jsonify({
            'message': 'Shipping order created successfully',
            'shipping_id': shipping_order.id,
            'shipping_number': shipping_order.shipping_number,
            'tracking_number': shipping_order.tracking_number
        }), 201
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/orders/<int:order_id>/confirm-with-shipment', methods=['POST'])
@jwt_required()
@require_permission('sales_orders.confirm')
def confirm_order_with_shipment(order_id):
    """Confirm sales order and optionally create shipment"""
    try:
        order = db.session.get(SalesOrder, order_id) or abort(404)
        data = request.get_json() or {}
        
        # Update order status
        order.status = 'confirmed'

        # AUTO-RESERVE (Bagian 1 / B): process the full FIFO-by-document-date
        # backlog now that this SO is confirmed. Never blocks confirmation.
        try:
            from utils.auto_reserve import process_auto_reserve_queue
            process_auto_reserve_queue()
        except Exception as auto_reserve_error:
            print(f"Auto-reserve queue warning: {auto_reserve_error}")

        # Auto-create shipment if requested
        auto_create_shipment = data.get('auto_create_shipment', False)
        shipping_order = None
        
        if auto_create_shipment:
            from utils.shipping_integration import create_shipping_from_sales_order
            
            logistics_provider_id = data.get('logistics_provider_id')
            service_type = data.get('service_type', 'regular')
            
            shipping_order = create_shipping_from_sales_order(
                order_id, 
                logistics_provider_id, 
                service_type
            )
        
        db.session.commit()
        
        response = {
            'message': 'Order confirmed successfully',
            'order_id': order.id,
            'status': order.status
        }
        
        if shipping_order:
            response.update({
                'shipping_created': True,
                'shipping_id': shipping_order.id,
                'shipping_number': shipping_order.shipping_number,
                'tracking_number': shipping_order.tracking_number
            })
        
        return jsonify(response)
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ===============================
# SALES REPORTS
# ===============================

@sales_bp.route('/reports/sales-per-customer', methods=['GET'])
@jwt_required()
@require_permission('customers.view')
def report_sales_per_customer():
    """
    Sales report per customer
    ---
    tags:
      - Sales Reports
    summary: Sales per customer report
    description: Generate sales report grouped by customer with order count, total sales, and average order value
    security:
      - BearerAuth: []
    parameters:
      - name: date_from
        in: query
        type: string
        format: date
        description: Filter sales from this date (YYYY-MM-DD)
      - name: date_to
        in: query
        type: string
        format: date
        description: Filter sales until this date (YYYY-MM-DD)
    responses:
      200:
        description: Sales report generated successfully
        schema:
          type: object
          properties:
            sales_by_customer:
              type: array
              items:
                type: object
                properties:
                  customer_id:
                    type: integer
                  customer_name:
                    type: string
                  order_count:
                    type: integer
                  total_sales:
                    type: number
                  avg_order_value:
                    type: number
    """
    try:
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        query = db.session.query(
            Customer.id.label('customer_id'),
            Customer.company_name.label('customer_name'),
            func.count(SalesOrder.id).label('order_count'),
            func.sum(SalesOrder.total_amount).label('total_sales'),
            func.avg(SalesOrder.total_amount).label('avg_order_value')
        ).join(
            SalesOrder, Customer.id == SalesOrder.customer_id
        ).group_by(
            Customer.id, Customer.company_name
        )
        
        if date_from:
            query = query.filter(SalesOrder.order_date >= date_from)
        if date_to:
            query = query.filter(SalesOrder.order_date <= date_to)
            
        results = query.all()
        
        return jsonify({
            'sales_by_customer': [{
                'customer_id': row.customer_id,
                'customer_name': row.customer_name,
                'order_count': row.order_count,
                'total_sales': float(row.total_sales) if row.total_sales else 0,
                'avg_order_value': float(row.avg_order_value) if row.avg_order_value else 0
            } for row in results]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/reports/sales-per-item', methods=['GET'])
@jwt_required()
@require_permission('sales.view')
def report_sales_per_item():
    """
    Sales report per item/product
    ---
    tags:
      - Sales Reports
    summary: Sales per item report
    description: Generate sales report grouped by product/item with total quantity sold, total sales, and order count
    security:
      - BearerAuth: []
    parameters:
      - name: date_from
        in: query
        type: string
        format: date
        description: Filter sales from this date (YYYY-MM-DD)
      - name: date_to
        in: query
        type: string
        format: date
        description: Filter sales until this date (YYYY-MM-DD)
    responses:
      200:
        description: Sales report generated successfully
        schema:
          type: object
          properties:
            sales_by_item:
              type: array
              items:
                type: object
                properties:
                  product_id:
                    type: integer
                  product_name:
                    type: string
                  sku:
                    type: string
                  total_quantity:
                    type: number
                  total_sales:
                    type: number
                  order_item_count:
                    type: integer
    """
    try:
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        query = db.session.query(
            Product.id.label('product_id'),
            Product.name.label('product_name'),
            Product.sku.label('sku'),
            func.sum(SalesOrderItem.quantity).label('total_quantity'),
            func.sum(SalesOrderItem.total_price).label('total_sales'),
            func.count(SalesOrderItem.id).label('order_item_count')
        ).join(
            SalesOrderItem, Product.id == SalesOrderItem.product_id
        ).join(
            SalesOrder, SalesOrderItem.order_id == SalesOrder.id
        ).group_by(
            Product.id, Product.name, Product.sku
        )
        
        if date_from:
            query = query.filter(SalesOrder.order_date >= date_from)
        if date_to:
            query = query.filter(SalesOrder.order_date <= date_to)
            
        results = query.all()
        
        return jsonify({
            'sales_by_item': [{
                'product_id': row.product_id,
                'product_name': row.product_name,
                'sku': row.sku,
                'total_quantity': float(row.total_quantity) if row.total_quantity else 0,
                'total_sales': float(row.total_sales) if row.total_sales else 0,
                'order_item_count': row.order_item_count
            } for row in results]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/reports/sales-per-warehouse', methods=['GET'])
@jwt_required()
@require_permission('sales.view')
def report_sales_per_warehouse():
    """
    Sales report per warehouse
    ---
    tags:
      - Sales Reports
    summary: Sales per warehouse report
    description: Generate sales report grouped by warehouse location with movement count and total quantity
    security:
      - BearerAuth: []
    parameters:
      - name: date_from
        in: query
        type: string
        format: date
        description: Filter sales from this date (YYYY-MM-DD)
      - name: date_to
        in: query
        type: string
        format: date
        description: Filter sales until this date (YYYY-MM-DD)
    responses:
      200:
        description: Sales report generated successfully
        schema:
          type: object
          properties:
            sales_by_warehouse:
              type: array
              items:
                type: object
                properties:
                  location_id:
                    type: integer
                  location_name:
                    type: string
                  zone_id:
                    type: integer
                  movement_count:
                    type: integer
                  total_quantity:
                    type: number
    """
    try:
        from models.warehouse import WarehouseLocation, InventoryMovement
        
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        query = db.session.query(
            WarehouseLocation.id.label('location_id'),
            WarehouseLocation.name.label('location_name'),
            WarehouseLocation.zone_id.label('zone_id'),
            func.count(InventoryMovement.id).label('movement_count'),
            func.sum(InventoryMovement.quantity).label('total_quantity')
        ).join(
            InventoryMovement, WarehouseLocation.id == InventoryMovement.location_id
        ).filter(
            InventoryMovement.movement_type == 'out'
        ).group_by(
            WarehouseLocation.id, WarehouseLocation.name, WarehouseLocation.zone_id
        )
        
        if date_from:
            query = query.filter(InventoryMovement.movement_date >= date_from)
        if date_to:
            query = query.filter(InventoryMovement.movement_date <= date_to)
            
        results = query.all()
        
        return jsonify({
            'sales_by_warehouse': [{
                'location_id': row.location_id,
                'location_name': row.location_name,
                'zone_id': row.zone_id,
                'movement_count': row.movement_count,
                'total_quantity': float(row.total_quantity) if row.total_quantity else 0
            } for row in results]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/reports/sales-process-history', methods=['GET'])
@jwt_required()
@require_permission('sales.view')
def report_sales_process_history():
    """
    Sales process history
    ---
    tags:
      - Sales Reports
    summary: Sales process history report
    description: Generate sales process history with order details, status tracking, and timestamps
    security:
      - BearerAuth: []
    parameters:
      - name: date_from
        in: query
        type: string
        format: date
        description: Filter sales from this date (YYYY-MM-DD)
      - name: date_to
        in: query
        type: string
        format: date
        description: Filter sales until this date (YYYY-MM-DD)
      - name: customer_id
        in: query
        type: integer
        description: Filter by specific customer ID
    responses:
      200:
        description: Sales history retrieved successfully
        schema:
          type: object
          properties:
            sales_history:
              type: array
              items:
                type: object
                properties:
                  order_id:
                    type: integer
                  order_number:
                    type: string
                  customer_id:
                    type: integer
                  customer_name:
                    type: string
                  order_date:
                    type: string
                    format: date
                  status:
                    type: string
                  total_amount:
                    type: number
                  created_at:
                    type: string
                    format: date-time
                  updated_at:
                    type: string
                    format: date-time
    """
    try:
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        customer_id = request.args.get('customer_id', type=int)
        
        query = db.session.query(
            SalesOrder.id.label('order_id'),
            SalesOrder.order_number.label('order_number'),
            SalesOrder.customer_id.label('customer_id'),
            Customer.company_name.label('customer_name'),
            SalesOrder.order_date.label('order_date'),
            SalesOrder.status.label('status'),
            SalesOrder.created_at.label('created_at'),
            SalesOrder.updated_at.label('updated_at'),
            SalesOrder.total_amount.label('total_amount')
        ).join(
            Customer, SalesOrder.customer_id == Customer.id
        )
        
        if date_from:
            query = query.filter(SalesOrder.order_date >= date_from)
        if date_to:
            query = query.filter(SalesOrder.order_date <= date_to)
        if customer_id:
            query = query.filter(SalesOrder.customer_id == customer_id)
            
        results = query.order_by(SalesOrder.order_date.desc()).all()
        
        return jsonify({
            'sales_history': [{
                'order_id': row.order_id,
                'order_number': row.order_number,
                'customer_id': row.customer_id,
                'customer_name': row.customer_name,
                'order_date': row.order_date.isoformat() if row.order_date else None,
                'status': row.status,
                'created_at': row.created_at.isoformat() if row.created_at else None,
                'updated_at': row.updated_at.isoformat() if row.updated_at else None,
                'total_amount': float(row.total_amount) if row.total_amount else 0
            } for row in results]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sales_bp.route('/reports/sales-charts', methods=['GET'])
@jwt_required()
@require_permission('sales.view')
def report_sales_charts():
    """
    Sales charts/graphs for proportion and trends
    ---
    tags:
      - Sales Reports
    summary: Sales charts and trends
    description: Generate sales chart data for trend analysis (monthly) or proportion analysis (by customer)
    security:
      - BearerAuth: []
    parameters:
      - name: chart_type
        in: query
        type: string
        enum: [trend, proportion]
        default: trend
        description: Type of chart: trend (monthly sales) or proportion (by customer)
      - name: date_from
        in: query
        type: string
        format: date
        description: Filter sales from this date (YYYY-MM-DD)
      - name: date_to
        in: query
        type: string
        format: date
        description: Filter sales until this date (YYYY-MM-DD)
    responses:
      200:
        description: Chart data generated successfully
        schema:
          type: object
          properties:
            chart_type:
              type: string
            data:
              type: array
              items:
                type: object
            total_sales:
              type: number
      400:
        description: Invalid chart_type parameter
    """
    try:
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        chart_type = request.args.get('chart_type', 'trend')  # trend, proportion
        
        if chart_type == 'trend':
            # Sales trend over time (monthly)
            query = db.session.query(
                func.strftime('%Y-%m', SalesOrder.order_date).label('month'),
                func.count(SalesOrder.id).label('order_count'),
                func.sum(SalesOrder.total_amount).label('total_sales')
            ).group_by(
                func.strftime('%Y-%m', SalesOrder.order_date)
            ).order_by(
                func.strftime('%Y-%m', SalesOrder.order_date)
            )
            
            if date_from:
                query = query.filter(SalesOrder.order_date >= date_from)
            if date_to:
                query = query.filter(SalesOrder.order_date <= date_to)
                
            results = query.all()
            
            return jsonify({
                'chart_type': 'trend',
                'data': [{
                    'month': row.month,
                    'order_count': row.order_count,
                    'total_sales': float(row.total_sales) if row.total_sales else 0
                } for row in results]
            }), 200
            
        elif chart_type == 'proportion':
            # Sales proportion by customer
            query = db.session.query(
                Customer.company_name.label('customer_name'),
                func.sum(SalesOrder.total_amount).label('total_sales')
            ).join(
                SalesOrder, Customer.id == SalesOrder.customer_id
            ).group_by(
                Customer.company_name
            )
            
            if date_from:
                query = query.filter(SalesOrder.order_date >= date_from)
            if date_to:
                query = query.filter(SalesOrder.order_date <= date_to)
                
            results = query.all()
            total_sales = sum(float(row.total_sales) if row.total_sales else 0 for row in results)
            
            return jsonify({
                'chart_type': 'proportion',
                'total_sales': total_sales,
                'data': [{
                    'customer_name': row.customer_name,
                    'total_sales': float(row.total_sales) if row.total_sales else 0,
                    'percentage': (float(row.total_sales) if row.total_sales else 0) / total_sales * 100 if total_sales > 0 else 0
                } for row in results]
            }), 200
            
        else:
            return jsonify({'error': 'Invalid chart_type. Use "trend" or "proportion"'}), 400

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===============================
# SD GAP-CLOSING: PRICING PROCEDURE + CUSTOMER-MATERIAL INFO RECORD (2026-09-14)
# ===============================

@sales_bp.route('/pricing/calculate', methods=['GET'])
@jwt_required()
@require_permission('sales_orders.view')
def calculate_pricing():
    """Pricing Procedure (SAP SD concept) - computes unit_price/discount_percent/
    tax_percent for a product+customer+quantity combo from the active
    PricingCondition stack (+ CustomerMaterialInfo.special_price as base if one
    exists). See utils/pricing_procedure.py for the calculation. Does not write
    anything - the frontend applies the result onto its own SalesOrderItem fields."""
    try:
        from utils.pricing_procedure import calculate_price
        product_id = request.args.get('product_id', type=int)
        customer_id = request.args.get('customer_id', type=int)
        quantity = request.args.get('quantity', 1, type=float)
        if not product_id:
            return jsonify({'error': 'product_id wajib diisi'}), 400
        return jsonify(calculate_price(product_id, customer_id, quantity)), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/pricing-conditions', methods=['GET'])
@jwt_required()
@require_permission('sales_orders.view')
def get_pricing_conditions():
    try:
        from models.sales import PricingCondition
        customer_id = request.args.get('customer_id', type=int)
        product_id = request.args.get('product_id', type=int)
        query = PricingCondition.query
        if customer_id:
            query = query.filter_by(customer_id=customer_id)
        if product_id:
            query = query.filter_by(product_id=product_id)
        rows = query.order_by(PricingCondition.sequence).all()
        return jsonify({
            'pricing_conditions': [{
                'id': c.id,
                'name': c.name,
                'condition_type': c.condition_type,
                'calculation_type': c.calculation_type,
                'value': float(c.value),
                'sequence': c.sequence,
                'customer_id': c.customer_id,
                'customer_name': c.customer.company_name if c.customer else None,
                'product_id': c.product_id,
                'product_name': c.product.name if c.product else None,
                'valid_from': c.valid_from.isoformat() if c.valid_from else None,
                'valid_to': c.valid_to.isoformat() if c.valid_to else None,
                'is_active': c.is_active,
                'notes': c.notes,
            } for c in rows]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/pricing-conditions', methods=['POST'])
@jwt_required()
@require_permission('sales_orders.create')
def create_pricing_condition():
    try:
        from models.sales import PricingCondition
        data = request.get_json() or {}
        if not data.get('name') or not data.get('condition_type') or data.get('value') is None:
            return jsonify({'error': 'name, condition_type, dan value wajib diisi'}), 400
        user_id = get_jwt_identity()
        row = PricingCondition(
            name=data['name'],
            condition_type=data['condition_type'],
            calculation_type=data.get('calculation_type', 'percentage'),
            value=data['value'],
            sequence=data.get('sequence', 10),
            customer_id=data.get('customer_id'),
            product_id=data.get('product_id'),
            valid_from=datetime.strptime(data['valid_from'], '%Y-%m-%d').date() if data.get('valid_from') else None,
            valid_to=datetime.strptime(data['valid_to'], '%Y-%m-%d').date() if data.get('valid_to') else None,
            notes=data.get('notes'),
            created_by=user_id,
        )
        db.session.add(row)
        db.session.commit()
        return jsonify({'message': 'Pricing condition ditambahkan', 'id': row.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/pricing-conditions/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('sales_orders.create')
def update_pricing_condition(id):
    try:
        from models.sales import PricingCondition
        row = db.session.get(PricingCondition, id)
        if not row:
            return jsonify({'error': 'Not found'}), 404
        data = request.get_json() or {}
        for field in ('name', 'condition_type', 'calculation_type', 'value', 'sequence', 'notes', 'is_active'):
            if field in data:
                setattr(row, field, data[field])
        if 'valid_from' in data:
            row.valid_from = datetime.strptime(data['valid_from'], '%Y-%m-%d').date() if data['valid_from'] else None
        if 'valid_to' in data:
            row.valid_to = datetime.strptime(data['valid_to'], '%Y-%m-%d').date() if data['valid_to'] else None
        db.session.commit()
        return jsonify({'message': 'Pricing condition diupdate'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/pricing-conditions/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('sales_orders.create')
def delete_pricing_condition(id):
    try:
        from models.sales import PricingCondition
        row = db.session.get(PricingCondition, id)
        if not row:
            return jsonify({'error': 'Not found'}), 404
        db.session.delete(row)
        db.session.commit()
        return jsonify({'message': 'Pricing condition dihapus'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/customer-material-info', methods=['GET'])
@jwt_required()
@require_permission('sales_orders.view')
def get_customer_material_info():
    try:
        from models.sales import CustomerMaterialInfo
        customer_id = request.args.get('customer_id', type=int)
        product_id = request.args.get('product_id', type=int)
        query = CustomerMaterialInfo.query
        if customer_id:
            query = query.filter_by(customer_id=customer_id)
        if product_id:
            query = query.filter_by(product_id=product_id)
        rows = query.all()
        return jsonify({
            'customer_material_info': [{
                'id': r.id,
                'customer_id': r.customer_id,
                'customer_name': r.customer.company_name if r.customer else None,
                'product_id': r.product_id,
                'product_name': r.product.name if r.product else None,
                'customer_material_code': r.customer_material_code,
                'special_price': float(r.special_price) if r.special_price is not None else None,
                'min_order_qty': float(r.min_order_qty) if r.min_order_qty is not None else None,
                'lead_time_days': r.lead_time_days,
                'is_active': r.is_active,
                'notes': r.notes,
            } for r in rows]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/customer-material-info', methods=['POST'])
@jwt_required()
@require_permission('sales_orders.create')
def create_customer_material_info():
    try:
        from models.sales import CustomerMaterialInfo
        data = request.get_json() or {}
        customer_id = data.get('customer_id')
        product_id = data.get('product_id')
        if not customer_id or not product_id:
            return jsonify({'error': 'customer_id dan product_id wajib diisi'}), 400

        existing = CustomerMaterialInfo.query.filter_by(customer_id=customer_id, product_id=product_id).first()
        if existing:
            existing.is_active = True
            existing.customer_material_code = data.get('customer_material_code', existing.customer_material_code)
            existing.special_price = data.get('special_price', existing.special_price)
            existing.min_order_qty = data.get('min_order_qty', existing.min_order_qty)
            existing.lead_time_days = data.get('lead_time_days', existing.lead_time_days)
            db.session.commit()
            return jsonify({'message': 'Customer material info diaktifkan kembali', 'id': existing.id}), 200

        user_id = get_jwt_identity()
        row = CustomerMaterialInfo(
            customer_id=customer_id,
            product_id=product_id,
            customer_material_code=data.get('customer_material_code'),
            special_price=data.get('special_price'),
            min_order_qty=data.get('min_order_qty'),
            lead_time_days=data.get('lead_time_days'),
            notes=data.get('notes'),
            created_by=user_id,
        )
        db.session.add(row)
        db.session.commit()
        return jsonify({'message': 'Customer material info ditambahkan', 'id': row.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/customer-material-info/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('sales_orders.create')
def update_customer_material_info(id):
    try:
        from models.sales import CustomerMaterialInfo
        row = db.session.get(CustomerMaterialInfo, id)
        if not row:
            return jsonify({'error': 'Not found'}), 404
        data = request.get_json() or {}
        for field in ('customer_material_code', 'special_price', 'min_order_qty', 'lead_time_days', 'notes', 'is_active'):
            if field in data:
                setattr(row, field, data[field])
        db.session.commit()
        return jsonify({'message': 'Customer material info diupdate'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@sales_bp.route('/customer-material-info/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('sales_orders.create')
def delete_customer_material_info(id):
    try:
        from models.sales import CustomerMaterialInfo
        row = db.session.get(CustomerMaterialInfo, id)
        if not row:
            return jsonify({'error': 'Not found'}), 404
        db.session.delete(row)
        db.session.commit()
        return jsonify({'message': 'Customer material info dihapus'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
