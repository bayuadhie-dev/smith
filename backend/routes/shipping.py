from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db, ShippingOrder, ShippingItem, DeliveryTracking, LogisticsProvider
from utils.i18n import success_response, error_response, get_message
from utils import generate_number
from company_config.company import get_company_info
from datetime import datetime
from utils.timezone import get_local_now, get_local_today

shipping_bp = Blueprint('shipping', __name__)

@shipping_bp.route('/orders', methods=['GET'])
@shipping_bp.route('/orders/', methods=['GET'])
@jwt_required()
@require_permission('shipping.view')
def get_shipping_orders():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        orders = ShippingOrder.query.order_by(ShippingOrder.shipping_date.desc()).paginate(page=page, per_page=per_page)
        
        return jsonify({
            'shipping_orders': [{
                'id': o.id,
                'shipping_number': o.shipping_number,
                'customer_name': o.customer.company_name,
                'shipping_date': o.shipping_date.isoformat(),
                'status': o.status,
                'tracking_number': o.tracking_number
            } for o in orders.items],
            'total': orders.total
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@shipping_bp.route('/shipments', methods=['POST'])
@jwt_required()
@require_permission('shipping.create')
def create_shipment():
    try:
        data = request.get_json()
        user_id = int(get_jwt_identity())
        
        shipping_number = generate_number('SHP', ShippingOrder, 'shipping_number')
        
        order = ShippingOrder(
            shipping_number=shipping_number,
            customer_id=data.get('customer_id'),
            shipping_date=datetime.fromisoformat(data['shipping_date']),
            expected_delivery_date=datetime.fromisoformat(data['expected_delivery_date']) if data.get('expected_delivery_date') else None,
            delivery_method=data.get('delivery_method', 'expedition'),
            logistics_provider_id=data.get('logistics_provider_id'),
            tracking_number=data.get('tracking_number'),
            driver_name=data.get('driver_name'),
            driver_phone=data.get('driver_phone'),
            vehicle_number=data.get('vehicle_number'),
            vehicle_type=data.get('vehicle_type'),
            notes=data.get('notes'),
            status='preparing',
            prepared_by=user_id
        )
        
        db.session.add(order)
        db.session.flush()
        
        # Link sales orders if provided
        if data.get('sales_order_ids'):
            for so_id in data['sales_order_ids']:
                order.sales_order_id = so_id  # For now, take first one
                break
        
        # Add shipping items
        for item_data in data.get('items', []):
            item = ShippingItem(
                shipping_id=order.id,
                product_id=item_data['product_id'],
                quantity=item_data['quantity'],
                uom=item_data.get('uom', 'PCS'),
                batch_number=item_data.get('batch_number'),
                notes=item_data.get('notes'),
            )
            db.session.add(item)
        
        db.session.commit()
        return jsonify({'message': 'Shipment created successfully', 'shipping_id': order.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@shipping_bp.route('/orders', methods=['POST'])
@jwt_required()
@require_permission('shipping.create')
def create_shipping_order():
    try:
        data = request.get_json()
        user_id = int(get_jwt_identity())

        # Guard against OVER-shipping a sales order line, not against a
        # second shipment existing at all - a SO legitimately ships in
        # multiple partial deliveries (confirmed 2026-10-14; the previous
        # guard blocked ANY second shipment outright once one existed,
        # which also blocked ordinary partial shipping, not just accidental
        # double-submits). Checked per product line against
        # SalesOrderItem.quantity_shipped (already-shipped total across all
        # active shipments) so repeated partial shipments are fine as long
        # as the running total never exceeds what was actually ordered.
        from models.sales import SalesOrderItem
        for item_data in data.get('items', []):
            so_item = SalesOrderItem.query.filter_by(
                order_id=data['sales_order_id'], product_id=item_data['product_id']
            ).first()
            if so_item:
                already_shipped = float(so_item.quantity_shipped or 0)
                ordered = float(so_item.quantity or 0)
                requesting = float(item_data['quantity'])
                remaining = ordered - already_shipped
                if requesting > remaining + 0.01:
                    return jsonify({
                        'error': f'Kuantitas kirim untuk produk ini ({requesting}) melebihi sisa yang belum dikirim ({remaining} dari {ordered} dipesan, {already_shipped} sudah dikirim).'
                    }), 400

        shipping_number = generate_number('SHP', ShippingOrder, 'shipping_number')

        order = ShippingOrder(
            shipping_number=shipping_number,
            sales_order_id=data['sales_order_id'],
            customer_id=data['customer_id'],
            shipping_date=datetime.fromisoformat(data['shipping_date']),
            expected_delivery_date=datetime.fromisoformat(data['expected_delivery_date']) if data.get('expected_delivery_date') else None,
            logistics_provider_id=data.get('logistics_provider_id'),
            tracking_number=data.get('tracking_number'),
            vehicle_number=data.get('vehicle_number'),
            driver_name=data.get('driver_name'),
            shipping_address=data.get('shipping_address'),
            prepared_by=user_id
        )

        db.session.add(order)
        db.session.flush()

        from models import Inventory
        from utils.inventory_helpers import record_inventory_transaction
        from utils.fifo_helper import _get_inventory_unit_cost, fifo_deduct_stock
        from utils.finance_helpers import resolve_account

        stock_txns = []
        cogs_journal_lines = []
        total_cogs_amount = 0.0

        for item_data in data.get('items', []):
            quantity = float(item_data['quantity'])
            batch_number = item_data.get('batch_number')

            so_item = SalesOrderItem.query.filter_by(
                order_id=data['sales_order_id'], product_id=item_data['product_id']
            ).first()
            if so_item:
                so_item.quantity_shipped = float(so_item.quantity_shipped or 0) + quantity

            if batch_number:
                # Caller explicitly pinned one batch - keep the old
                # single-batch path (manual override, e.g. staff picked a
                # specific lot on purpose).
                item = ShippingItem(
                    shipping_id=order.id,
                    sales_order_item_id=so_item.id if so_item else None,
                    product_id=item_data['product_id'],
                    quantity=quantity,
                    uom=item_data['uom'],
                    batch_number=batch_number
                )
                db.session.add(item)

                inv = Inventory.query.filter_by(
                    product_id=item_data['product_id'],
                    batch_number=batch_number,
                    location_id=3
                ).first()
                if not inv:
                    inv = Inventory.query.filter_by(
                        product_id=item_data['product_id'],
                        batch_number=batch_number
                    ).first()

                if inv:
                    unit_cost = _get_inventory_unit_cost(inv)
                    inv.quantity_on_hand = float(inv.quantity_on_hand) - quantity
                    inv.quantity_available = float(inv.quantity_available) - quantity
                    inv.updated_at = get_local_now()

                    movement = record_inventory_transaction(
                        transaction_type='stock_out',
                        direction='out',
                        quantity=quantity,
                        product_id=item_data['product_id'],
                        from_location_id=inv.location_id,
                        reference_number=shipping_number,
                        reference_type='sales_order',
                        reference_id=order.id,
                        batch_number=batch_number,
                        unit_cost=unit_cost or None,
                        total_cost=(unit_cost * quantity) if unit_cost else None,
                        notes=f"Shipped via {shipping_number}",
                        created_by=user_id
                    )
                    stock_txns.append(movement)

                    if unit_cost and unit_cost > 0:
                        cogs_amount = unit_cost * quantity
                        try:
                            hpp_account_id = resolve_account('akun_hpp_id', product_id=item_data['product_id'], category_id=None)
                            persediaan_account_id = resolve_account('akun_persediaan_id', product_id=item_data['product_id'], category_id=None)
                            cogs_journal_lines.append({
                                'account_id': hpp_account_id, 'debit': cogs_amount, 'credit': 0,
                                'description': f'HPP pengiriman {shipping_number} - {batch_number or ""}',
                            })
                            cogs_journal_lines.append({
                                'account_id': persediaan_account_id, 'debit': 0, 'credit': cogs_amount,
                                'description': f'Persediaan barang jadi keluar {shipping_number} - {batch_number or ""}',
                            })
                            total_cogs_amount += cogs_amount
                        except ValueError:
                            pass
                continue

            # No batch pinned by the caller - auto-split across batches
            # FIFO (oldest first) via fifo_deduct_stock, same helper used by
            # material_issue/fg_conversion/waste. Previously this endpoint
            # only ever created ONE ShippingItem row per product line even
            # when the single oldest batch didn't have enough stock to
            # cover the requested quantity (the old code picked one
            # Inventory row via .first() and deducted the full requested
            # quantity from it regardless of what it actually held - could
            # even push quantity_on_hand negative). Now the line is split
            # into one ShippingItem per batch actually consumed, matching
            # SAP's batch-split-on-delivery behavior.
            result = fifo_deduct_stock(
                product_id=item_data['product_id'],
                quantity_needed=quantity,
                reference_number=shipping_number,
                reference_type='sales_order',
                reference_id=order.id,
                notes=f"Shipped via {shipping_number}",
                user_id=user_id,
            )
            if not result['success']:
                return jsonify({'error': result['error']}), 400

            for movement_info in result['movements']:
                batch_qty = movement_info['quantity_deducted']
                if movement_info.get('_transaction'):
                    stock_txns.append(movement_info['_transaction'])
                item = ShippingItem(
                    shipping_id=order.id,
                    sales_order_item_id=so_item.id if so_item else None,
                    product_id=item_data['product_id'],
                    quantity=batch_qty,
                    uom=item_data['uom'],
                    batch_number=movement_info['batch_number'],
                    notes=f'Auto-split FIFO dari batch {movement_info["batch_number"] or "-"}'
                )
                db.session.add(item)

                unit_cost = movement_info['unit_cost']
                if unit_cost and unit_cost > 0:
                    cogs_amount = unit_cost * batch_qty
                    try:
                        hpp_account_id = resolve_account('akun_hpp_id', product_id=item_data['product_id'], category_id=None)
                        persediaan_account_id = resolve_account('akun_persediaan_id', product_id=item_data['product_id'], category_id=None)
                        cogs_journal_lines.append({
                            'account_id': hpp_account_id, 'debit': cogs_amount, 'credit': 0,
                            'description': f'HPP pengiriman {shipping_number} - {movement_info["batch_number"] or ""}',
                        })
                        cogs_journal_lines.append({
                            'account_id': persediaan_account_id, 'debit': 0, 'credit': cogs_amount,
                            'description': f'Persediaan barang jadi keluar {shipping_number} - {movement_info["batch_number"] or ""}',
                        })
                        total_cogs_amount += cogs_amount
                    except ValueError:
                        pass

        if cogs_journal_lines and total_cogs_amount > 0:
            from models.approval_workflow import PendingJournalEntry
            from utils.finance_helpers import post_pending_journal

            pending = PendingJournalEntry(
                workflow_id=None,
                entry_date=get_local_now().date(),
                description=f'HPP Pengiriman {shipping_number}',
                reference=shipping_number,
                lines=cogs_journal_lines,
                total_debit=total_cogs_amount,
                total_credit=total_cogs_amount,
                created_by=user_id,
            )
            db.session.add(pending)
            db.session.flush()
            posted_entries = post_pending_journal(pending.id, posted_by_user_id=user_id, reference_type='sales_delivery', reference_id=order.id)
            if posted_entries:
                base_number = posted_entries[0].entry_number.rsplit('-', 1)[0]
                for txn in stock_txns:
                    txn.accounting_entry_number = base_number
                    txn.accounting_entry_status = 'posted'

        db.session.commit()
        return jsonify({'message': 'Shipping order created', 'shipping_id': order.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@shipping_bp.route('/tracking', methods=['GET'])
@jwt_required()
@require_permission('shipping.view')
def get_tracking():
    try:
        tracking_number = request.args.get('tracking_number')
        if not tracking_number:
            return jsonify(error_response('api.error', error_code=400)), 400
        
        # Find shipping order by tracking number
        shipping_order = ShippingOrder.query.filter_by(tracking_number=tracking_number).first()
        if not shipping_order:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        # Get tracking history
        tracking_history = DeliveryTracking.query.filter_by(shipping_id=shipping_order.id).order_by(DeliveryTracking.tracking_date.desc()).all()
        company_info = get_company_info()

        return jsonify({
            'tracking_number': tracking_number,
            'status': shipping_order.status,
            'shipping_order': {
                'id': shipping_order.id,
                'shipping_number': shipping_order.shipping_number,
                'customer_name': shipping_order.customer.company_name if shipping_order.customer else 'Unknown',
                'shipping_date': shipping_order.shipping_date.isoformat(),
                'expected_delivery_date': shipping_order.expected_delivery_date.isoformat() if shipping_order.expected_delivery_date else None,
                'sender_name': company_info['name'],
                'sender_address': company_info['address_line1'],
                'sender_phone': company_info['phone'],
                'recipient_name': shipping_order.customer.company_name if shipping_order.customer else 'Unknown',
                'recipient_address': shipping_order.shipping_address or 'Address not available',
                'recipient_phone': shipping_order.customer.phone if shipping_order.customer else 'Phone not available',
                'items': [{
                    'id': item.id,
                    'product_name': item.product.name if item.product else 'Unknown Product',
                    'quantity': float(item.quantity),
                    'weight': 1.0,  # Default weight
                    'length': 30,   # Default dimensions
                    'width': 20,
                    'height': 10
                } for item in shipping_order.items]
            },
            'logistics_provider': {
                'name': shipping_order.logistics_provider.company_name if shipping_order.logistics_provider else 'Unknown Provider'
            } if shipping_order.logistics_provider_id else None,
            'estimated_delivery': shipping_order.expected_delivery_date.isoformat() if shipping_order.expected_delivery_date else None,
            'tracking_history': [{
                'id': t.id,
                'status': t.status,
                'description': t.remarks or f"Status updated to {t.status}",
                'location': t.location or 'Unknown Location',
                'timestamp': t.tracking_date.isoformat()
            } for t in tracking_history]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@shipping_bp.route('/tracking', methods=['POST'])
@jwt_required()
@require_permission('shipping.create')
def add_tracking():
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        tracking = DeliveryTracking(
            shipping_id=data['shipping_id'],
            status=data['status'],
            location=data.get('location'),
            remarks=data.get('remarks'),
            updated_by=user_id
        )
        db.session.add(tracking)
        
        # Update shipping order status
        order = db.session.get(ShippingOrder, data['shipping_id'])
        order.status = data['status']
        
        db.session.commit()
        return jsonify(success_response('api.success'))
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@shipping_bp.route('/providers', methods=['GET'])
@jwt_required()
@require_permission('shipping.view')
def get_providers():
    try:
        providers = LogisticsProvider.query.all()
        return jsonify({
            'logistics_providers': [{
                'id': p.id,
                'name': p.company_name,
                'service_type': p.service_type or 'regular',
                'contact_info': p.email or p.phone or '',
                'pricing_model': 'weight_based',  # Default for now
                'is_active': p.is_active,
                'created_at': p.created_at.isoformat()
            } for p in providers]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@shipping_bp.route('/providers', methods=['POST'])
@jwt_required()
@require_permission('shipping.create')
def create_provider():
    try:
        data = request.get_json()
        
        # Generate provider code
        code = f"LP{get_local_now().strftime('%Y%m%d')}{LogisticsProvider.query.count() + 1:03d}"
        
        provider = LogisticsProvider(
            code=code,
            company_name=data['name'],
            service_type=data.get('service_type', 'regular'),
            phone=data.get('contact_info', '') if '@' not in data.get('contact_info', '') else None,
            email=data.get('contact_info', '') if '@' in data.get('contact_info', '') else None,
            is_active=data.get('is_active', True)
        )
        
        db.session.add(provider)
        db.session.commit()
        
        return jsonify({
            'message': 'Provider created successfully',
            'provider_id': provider.id
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@shipping_bp.route('/providers/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('shipping.edit')
def update_provider(id):
    try:
        provider = db.session.get(LogisticsProvider, id) or abort(404)
        data = request.get_json()
        
        provider.company_name = data.get('name', provider.company_name)
        provider.service_type = data.get('service_type', provider.service_type)
        provider.is_active = data.get('is_active', provider.is_active)
        
        contact_info = data.get('contact_info', '')
        if '@' in contact_info:
            provider.email = contact_info
            provider.phone = None
        else:
            provider.phone = contact_info
            provider.email = None
        
        db.session.commit()
        
        return jsonify(success_response('api.success'))
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@shipping_bp.route('/providers/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('shipping.delete')
def delete_provider(id):
    try:
        provider = db.session.get(LogisticsProvider, id) or abort(404)
        
        # Check if provider is used in any shipping orders
        if ShippingOrder.query.filter_by(logistics_provider_id=id).first():
            return jsonify(error_response('api.error', error_code=400)), 400
        
        db.session.delete(provider)
        db.session.commit()
        
        return jsonify(success_response('api.success'))
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@shipping_bp.route('/orders/<int:order_id>', methods=['GET'])
@jwt_required()
@require_permission('shipping.view')
def get_shipping_order(order_id):
    try:
        order = db.session.get(ShippingOrder, order_id) or abort(404)
        
        return jsonify({
            'shipping_order': {
                'id': order.id,
                'shipping_number': order.shipping_number,
                'customer_id': order.customer_id,
                'customer_name': order.customer.company_name if order.customer else None,
                'shipping_date': order.shipping_date.isoformat(),
                'expected_delivery_date': order.expected_delivery_date.isoformat() if order.expected_delivery_date else None,
                'actual_delivery_date': order.actual_delivery_date.isoformat() if order.actual_delivery_date else None,
                'delivery_method': order.delivery_method,
                'logistics_provider_id': order.logistics_provider_id,
                'logistics_provider_name': order.logistics_provider.company_name if order.logistics_provider else None,
                'tracking_number': order.tracking_number,
                'driver_name': order.driver_name,
                'driver_phone': order.driver_phone,
                'vehicle_number': order.vehicle_number,
                'vehicle_type': order.vehicle_type,
                'status': order.status,
                'shipping_cost': float(order.shipping_cost) if order.shipping_cost else 0,
                'total_weight': float(order.total_weight) if order.total_weight else 0,
                'total_volume': float(order.total_volume) if order.total_volume else 0,
                'number_of_packages': order.number_of_packages,
                'shipping_address': order.shipping_address,
                'notes': order.notes,
                'created_at': order.created_at.isoformat(),
                'updated_at': order.updated_at.isoformat(),
                'items': [{
                    'id': item.id,
                    'product_id': item.product_id,
                    'product_name': item.product.name if item.product else None,
                    'quantity': float(item.quantity),
                    'uom': item.uom,
                    'batch_number': item.batch_number,
                    'notes': item.notes
                } for item in order.items] if order.items else []
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@shipping_bp.route('/orders/<int:order_id>', methods=['PUT'])
@jwt_required()
@require_permission('shipping.edit')
def update_shipping_order(order_id):
    try:
        order = db.session.get(ShippingOrder, order_id) or abort(404)
        data = request.get_json()
        
        # Update order fields
        if 'customer_id' in data:
            order.customer_id = data['customer_id']
        if 'shipping_date' in data:
            order.shipping_date = datetime.fromisoformat(data['shipping_date'])
        if 'expected_delivery_date' in data:
            order.expected_delivery_date = datetime.fromisoformat(data['expected_delivery_date']) if data['expected_delivery_date'] else None
        if 'actual_delivery_date' in data:
            order.actual_delivery_date = datetime.fromisoformat(data['actual_delivery_date']) if data['actual_delivery_date'] else None
        if 'delivery_method' in data:
            order.delivery_method = data['delivery_method']
        if 'logistics_provider_id' in data:
            order.logistics_provider_id = data['logistics_provider_id']
        if 'tracking_number' in data:
            order.tracking_number = data['tracking_number']
        if 'driver_name' in data:
            order.driver_name = data['driver_name']
        if 'driver_phone' in data:
            order.driver_phone = data['driver_phone']
        if 'vehicle_number' in data:
            order.vehicle_number = data['vehicle_number']
        if 'vehicle_type' in data:
            order.vehicle_type = data['vehicle_type']
        if 'status' in data:
            order.status = data['status']
        if 'shipping_cost' in data:
            order.shipping_cost = data['shipping_cost']
        if 'total_weight' in data:
            order.total_weight = data['total_weight']
        if 'total_volume' in data:
            order.total_volume = data['total_volume']
        if 'number_of_packages' in data:
            order.number_of_packages = data['number_of_packages']
        if 'shipping_address' in data:
            order.shipping_address = data['shipping_address']
        if 'notes' in data:
            order.notes = data['notes']
        
        order.updated_at = get_local_now()
        
        db.session.commit()
        return jsonify(success_response('api.success')), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@shipping_bp.route('/orders/<int:order_id>', methods=['DELETE'])
@jwt_required()
@require_permission('shipping.delete')
def delete_shipping_order(order_id):
    try:
        order = db.session.get(ShippingOrder, order_id) or abort(404)
        
        # Check if order can be deleted (not shipped yet)
        if order.status in ['shipped', 'delivered']:
            return jsonify(error_response('api.error', error_code=400)), 400
        
        # Delete related items first
        ShippingItem.query.filter_by(shipping_order_id=order_id).delete()
        
        # Delete tracking records
        DeliveryTracking.query.filter_by(shipping_order_id=order_id).delete()
        
        # Delete the order
        db.session.delete(order)
        db.session.commit()
        
        return jsonify(success_response('api.success')), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@shipping_bp.route('/tracking/<tracking_number>', methods=['PUT'])
@jwt_required()
@require_permission('shipping.edit')
def update_tracking_status(tracking_number):
    try:
        # Find the shipping order by tracking number
        order = ShippingOrder.query.filter_by(tracking_number=tracking_number).first()
        if not order:
            return jsonify(error_response('api.error', error_code=404)), 404
        
        data = request.get_json()
        
        # Create new tracking record
        tracking = DeliveryTracking(
            shipping_order_id=order.id,
            tracking_number=tracking_number,
            status=data['status'],
            location=data.get('location'),
            timestamp=datetime.fromisoformat(data['timestamp']) if data.get('timestamp') else get_local_now(),
            notes=data.get('notes'),
            updated_by=get_jwt_identity()
        )
        
        db.session.add(tracking)
        
        # Update order status if needed
        if 'order_status' in data:
            order.status = data['order_status']
            
        # Update delivery date if delivered
        if data['status'] == 'delivered' and not order.actual_delivery_date:
            order.actual_delivery_date = tracking.timestamp
        
        order.updated_at = get_local_now()
        
        db.session.commit()
        return jsonify(success_response('api.success')), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Reports, carriers, status update, proof of delivery
# ---------------------------------------------------------------------------
STATUS_COLORS = {'preparing': '#F59E0B', 'packed': '#3B82F6', 'shipped': '#8B5CF6', 'in_transit': '#6366F1',
                 'delivered': '#10B981', 'cancelled': '#EF4444'}
# The status buttons on the order page use pending/confirmed; map them onto the real model statuses.
STATUS_ALIASES = {'pending': 'preparing', 'confirmed': 'packed'}
# Moving to shipped happens in the ship workflow (it deducts stock and posts the delivery journal), never here.
ALLOWED_STATUS_MOVES = {
    'preparing': {'packed', 'cancelled'},
    'packed': {'in_transit', 'cancelled'},
    'shipped': {'in_transit', 'delivered'},
    'in_transit': {'delivered'},
}


def _parse_date_arg(name):
    v = request.args.get(name)
    if not v:
        return None
    try:
        return datetime.fromisoformat(v[:10]).date()
    except ValueError:
        raise ValueError(f'{name} tidak valid')


def _report_orders():
    q = ShippingOrder.query
    d_from, d_to = _parse_date_arg('date_from'), _parse_date_arg('date_to')
    if d_from:
        q = q.filter(ShippingOrder.shipping_date >= d_from)
    if d_to:
        q = q.filter(ShippingOrder.shipping_date <= d_to)
    if request.args.get('customer_id', type=int):
        q = q.filter(ShippingOrder.customer_id == request.args.get('customer_id', type=int))
    if request.args.get('status'):
        q = q.filter(ShippingOrder.status == request.args['status'])
    if request.args.get('shipping_method'):
        q = q.filter(ShippingOrder.delivery_method == request.args['shipping_method'])
    carrier = request.args.get('carrier')
    if carrier:
        q = q.join(LogisticsProvider, LogisticsProvider.id == ShippingOrder.logistics_provider_id).filter(LogisticsProvider.company_name == carrier)
    return q.order_by(ShippingOrder.shipping_date.desc(), ShippingOrder.id.desc()).all()


def _order_value(order):
    from models import SalesOrderItem
    total = 0.0
    for it in order.items or []:
        price = None
        if order.sales_order_id:
            soi = SalesOrderItem.query.filter_by(sales_order_id=order.sales_order_id, product_id=it.product_id).first()
            price = float(soi.unit_price) if soi and soi.unit_price is not None else None
        if price is None:
            price = float(it.product.price or 0) if it.product else 0.0
        total += float(it.quantity or 0) * price
    return total


def _build_report(orders):
    from collections import Counter, defaultdict
    delivered = [o for o in orders if o.status == 'delivered' and o.actual_delivery_date]
    days = [(o.actual_delivery_date - o.shipping_date).days for o in delivered]
    judged = [o for o in delivered if o.expected_delivery_date]
    on_time = [o for o in judged if o.actual_delivery_date <= o.expected_delivery_date]
    damaged = 0
    if orders:
        damaged = db.session.query(DeliveryTracking.shipping_id).filter(
            DeliveryTracking.shipping_id.in_([o.id for o in orders]), DeliveryTracking.status.in_(['damaged', 'returned'])
        ).distinct().count()
    status_count = Counter(o.status for o in orders)
    method_count = Counter(o.delivery_method or '-' for o in orders)
    perf = defaultdict(lambda: [0, 0])
    for o in judged:
        perf[o.shipping_date.isoformat()][0 if o.actual_delivery_date <= o.expected_delivery_date else 1] += 1
    cost = defaultdict(float)
    for o in orders:
        cost[o.shipping_date.strftime('%Y-%m')] += float(o.shipping_cost or 0)
    carriers = defaultdict(lambda: [0, 0, 0])
    for o in orders:
        name = o.logistics_provider.company_name if o.logistics_provider else '-'
        carriers[name][0] += 1
    for o in judged:
        name = o.logistics_provider.company_name if o.logistics_provider else '-'
        carriers[name][1] += 1
        carriers[name][2] += 1 if o.actual_delivery_date <= o.expected_delivery_date else 0
    return {
        'summary': {
            'total_shipments': len(orders),
            'total_value': round(sum(_order_value(o) for o in orders), 2),
            'total_weight': round(sum(float(o.total_weight or 0) for o in orders), 3),
            'average_delivery_time': round(sum(days) / len(days), 1) if days else 0,
            'on_time_delivery_rate': round(len(on_time) * 100 / len(judged), 1) if judged else 0,
            'damaged_shipments': damaged,
        },
        'charts': {
            'shipments_by_status': [{'name': k, 'value': v, 'color': STATUS_COLORS.get(k, '#9CA3AF')} for k, v in status_count.items()],
            'shipments_by_method': [{'name': k, 'value': v} for k, v in method_count.items()],
            'delivery_performance': [{'date': d, 'on_time': v[0], 'delayed': v[1]} for d, v in sorted(perf.items())],
            'cost_analysis': [{'month': m, 'shipping_cost': c, 'insurance_cost': 0} for m, c in sorted(cost.items())],
            'carrier_performance': [{'carrier': k, 'shipments': v[0], 'on_time_rate': round(v[2] * 100 / v[1], 1) if v[1] else 0} for k, v in carriers.items()],
        },
        'details': [{
            'shipping_number': o.shipping_number,
            'customer_name': o.customer.company_name if o.customer else '',
            'shipping_date': o.shipping_date.isoformat(),
            'delivery_date': o.actual_delivery_date.isoformat() if o.actual_delivery_date else '',
            'status': o.status,
            'shipping_cost': float(o.shipping_cost or 0),
            'carrier': o.logistics_provider.company_name if o.logistics_provider else '',
        } for o in orders],
    }


@shipping_bp.route('/carriers', methods=['GET'])
@jwt_required()
@require_permission('shipping.view')
def get_carriers():
    names = [p.company_name for p in LogisticsProvider.query.filter_by(is_active=True).order_by(LogisticsProvider.company_name).all()]
    return jsonify({'carriers': names}), 200


@shipping_bp.route('/reports', methods=['GET'])
@jwt_required()
@require_permission('shipping.view')
def shipping_report():
    try:
        return jsonify(_build_report(_report_orders())), 200
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@shipping_bp.route('/reports/export', methods=['GET'])
@jwt_required()
@require_permission('shipping.view')
def export_shipping_report():
    import io
    from flask import send_file
    try:
        rep = _build_report(_report_orders())
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    fmt = request.args.get('format', 'excel')
    sm = rep['summary']
    summary_rows = [('Total Pengiriman', sm['total_shipments']), ('Total Nilai', sm['total_value']), ('Total Berat (kg)', sm['total_weight']),
                    ('Rata-rata Waktu Kirim (hari)', sm['average_delivery_time']), ('Tepat Waktu (%)', sm['on_time_delivery_rate']),
                    ('Pengiriman Rusak/Retur', sm['damaged_shipments'])]
    head = ['No. Pengiriman', 'Pelanggan', 'Tgl Kirim', 'Tgl Terima', 'Status', 'Biaya Kirim', 'Ekspedisi']
    rows = [[d['shipping_number'], d['customer_name'], d['shipping_date'], d['delivery_date'], d['status'], d['shipping_cost'], d['carrier']] for d in rep['details']]
    buf = io.BytesIO()
    if fmt == 'pdf':
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=24, rightMargin=24, topMargin=24, bottomMargin=24)
        st = getSampleStyleSheet()
        parts = [Paragraph('Laporan Pengiriman', st['Title']), Table([[a, str(b)] for a, b in summary_rows], colWidths=[220, 120]), Spacer(1, 12)]
        t = Table([head] + [[str(c) for c in r] for r in rows], repeatRows=1)
        t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                               ('GRID', (0, 0), (-1, -1), 0.3, colors.grey), ('FONTSIZE', (0, 0), (-1, -1), 8)]))
        parts.append(t)
        doc.build(parts)
        mime = 'application/pdf'
    else:
        import openpyxl
        from openpyxl.styles import Font
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Ringkasan'
        for a, b in summary_rows:
            ws.append([a, b])
        ws.column_dimensions['A'].width = 34
        wd = wb.create_sheet('Rincian')
        wd.append(head)
        for c in wd[1]:
            c.font = Font(bold=True)
        for r in rows:
            wd.append(r)
        for col, w in zip('ABCDEFG', (22, 34, 12, 12, 14, 14, 26)):
            wd.column_dimensions[col].width = w
        wb.save(buf)
        mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    buf.seek(0)
    return send_file(buf, mimetype=mime, as_attachment=True, download_name='shipping_report.pdf' if fmt == 'pdf' else 'shipping_report.xlsx')


@shipping_bp.route('/orders/<int:order_id>/status', methods=['PUT'])
@jwt_required()
@require_permission('shipping.edit')
def update_shipping_status(order_id):
    try:
        order = db.session.get(ShippingOrder, order_id) or abort(404)
        new = (request.get_json() or {}).get('status')
        new = STATUS_ALIASES.get(new, new)
        if new not in STATUS_COLORS:
            return jsonify({'error': f'Status "{new}" tidak dikenal'}), 400
        if new == order.status:
            return jsonify(success_response('api.success')), 200
        if new == 'shipped':
            return jsonify({'error': 'Status "shipped" diset lewat proses pengiriman (memotong stok dan menjurnal), bukan dari sini'}), 400
        if new not in ALLOWED_STATUS_MOVES.get(order.status, set()):
            return jsonify({'error': f'Tidak bisa mengubah status dari {order.status} ke {new}'}), 400
        order.status = new
        now = get_local_now()
        if new == 'delivered':
            order.actual_delivery_date = order.actual_delivery_date or now.date()
            order.received_at = order.received_at or now
        db.session.add(DeliveryTracking(shipping_id=order.id, status=new, remarks='Status diubah dari halaman detail', updated_by=int(get_jwt_identity()), tracking_date=now))
        order.updated_at = now
        db.session.commit()
        return jsonify(success_response('api.success')), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@shipping_bp.route('/orders/<int:order_id>/pod', methods=['GET'])
@jwt_required()
@require_permission('shipping.view')
def shipping_pod(order_id):
    """Proof of delivery (Tanda Terima) PDF generated from the order."""
    import io
    from flask import send_file
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    order = db.session.get(ShippingOrder, order_id) or abort(404)
    st = getSampleStyleSheet()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    info = [['No. Pengiriman', order.shipping_number], ['Pelanggan', order.customer.company_name if order.customer else '-'],
            ['Alamat', order.shipping_address or '-'], ['Tanggal Kirim', order.shipping_date.isoformat()],
            ['Tanggal Terima', order.actual_delivery_date.isoformat() if order.actual_delivery_date else '-'],
            ['Penerima', order.received_by or '-'], ['Sopir / Kendaraan', f'{order.driver_name or "-"} / {order.vehicle_number or "-"}'],
            ['Status', order.status]]
    items = [['No', 'Barang', 'Jumlah', 'Satuan', 'Batch']] + [
        [str(i), (it.product.name if it.product else '-'), f'{float(it.quantity):g}', it.uom or '', it.batch_number or ''] for i, it in enumerate(order.items or [], 1)]
    grid = [('GRID', (0, 0), (-1, -1), 0.3, colors.grey), ('FONTSIZE', (0, 0), (-1, -1), 9)]
    t_items = Table(items, repeatRows=1, colWidths=[24, 260, 60, 50, 110])
    t_items.setStyle(TableStyle(grid + [('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E5E7EB'))]))
    sign = Table([['Pengirim', 'Penerima'], ['\n\n\n', '\n\n\n'], ['(                    )', '(                    )']], colWidths=[250, 250])
    doc.build([Paragraph('TANDA TERIMA BARANG (POD)', st['Title']), Table(info, colWidths=[120, 400], style=TableStyle(grid)),
               Spacer(1, 12), t_items, Spacer(1, 24), sign])
    buf.seek(0)
    safe = ''.join(c for c in order.shipping_number if c.isalnum() or c in '-_')
    return send_file(buf, mimetype='application/pdf', as_attachment=True, download_name=f'POD_{safe}.pdf')

@shipping_bp.route('/available-sales-orders', methods=['GET'])
@jwt_required()
@require_permission('shipping.view')
def get_available_sales_orders():
    """Get sales orders that are ready for shipping"""
    try:
        from models.sales import SalesOrder
        
        # Get confirmed sales orders that don't have shipping yet or are ready for shipping
        available_orders = SalesOrder.query.filter(
            SalesOrder.status.in_(['confirmed', 'in_production', 'ready'])
        ).all()
        
        # Filter out orders that already have shipping
        orders_without_shipping = []
        for order in available_orders:
            # Check if order already has shipping
            has_shipping = any(shipping.status not in ['cancelled'] for shipping in order.shipping_orders)
            if not has_shipping:
                orders_without_shipping.append(order)
        
        orders_data = []
        for order in orders_without_shipping:
            orders_data.append({
                'id': order.id,
                'order_number': order.order_number,
                'customer_name': order.customer.company_name if order.customer else 'Unknown',
                'customer_id': order.customer_id,
                'order_date': order.order_date.isoformat(),
                'delivery_date': order.delivery_date.isoformat() if order.delivery_date else None,
                'total_amount': float(order.total_amount),
                'status': order.status,
                'delivery_address': order.delivery_address,
                'items': [{
                    'id': item.id,
                    'product_id': item.product_id,
                    'product_name': item.product.name if item.product else item.description,
                    'quantity': float(item.quantity),
                    'uom': item.uom,
                    'unit_price': float(item.unit_price)
                } for item in order.items]
            })
        
        return jsonify({
            'available_orders': orders_data,
            'total_count': len(orders_data)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@shipping_bp.route('/ready-for-shipping', methods=['GET'])
@jwt_required()
@require_permission('shipping.view')
def get_ready_for_shipping():
    """
    Get Work Orders that have passed QC and are ready for shipping.
    This is the main endpoint for the shipping module to get items to ship.
    """
    try:
        from models.production import WorkOrder
        from models.quality import QualityInspection
        from models.sales import SalesOrder
        
        # Get QC inspections that passed
        passed_inspections = QualityInspection.query.filter(
            QualityInspection.result == 'pass',
            QualityInspection.status == 'completed'
        ).all()
        
        ready_items = []
        
        for qc in passed_inspections:
            # Get the work order
            work_order = db.session.get(WorkOrder, qc.work_order_id) if qc.work_order_id else None
            if not work_order:
                continue
            
            # Check if already shipped
            existing_shipping = ShippingOrder.query.filter(
                ShippingOrder.work_order_id == work_order.id,
                ShippingOrder.status.notin_(['cancelled'])
            ).first()
            
            if existing_shipping:
                continue  # Already has shipping
            
            # Get sales order info if available
            sales_order = None
            customer = None
            if work_order.sales_order_id:
                sales_order = db.session.get(SalesOrder, work_order.sales_order_id)
                if sales_order:
                    customer = sales_order.customer
            
            # Get product info
            product = work_order.product
            
            ready_items.append({
                'work_order_id': work_order.id,
                'work_order_number': work_order.wo_number,
                'qc_inspection_id': qc.id,
                'qc_number': qc.inspection_number,
                'qc_date': qc.inspection_date.isoformat() if qc.inspection_date else None,
                'product_id': work_order.product_id,
                'product_code': product.code if product else None,
                'product_name': product.name if product else 'Unknown Product',
                'quantity_produced': float(work_order.quantity_produced or work_order.quantity),
                'quantity_passed': float(qc.quantity_passed or work_order.quantity_produced or 0),
                'uom': work_order.uom,
                'batch_number': qc.batch_number or work_order.batch_number,
                'sales_order_id': work_order.sales_order_id,
                'sales_order_number': sales_order.order_number if sales_order else None,
                'customer_id': customer.id if customer else None,
                'customer_name': customer.company_name if customer else 'Stock / No Customer',
                'delivery_address': sales_order.delivery_address if sales_order else None,
                'production_date': work_order.actual_end_date.isoformat() if work_order.actual_end_date else work_order.scheduled_end_date.isoformat() if work_order.scheduled_end_date else None,
                'notes': qc.notes
            })
        
        return jsonify({
            'ready_for_shipping': ready_items,
            'total_count': len(ready_items)
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@shipping_bp.route('/create-from-qc', methods=['POST'])
@jwt_required()
@require_permission('shipping.create')
def create_shipping_from_qc():
    """
    Create shipping order from QC passed work order.
    Supports both expedition and self-pickup delivery methods.
    """
    try:
        data = request.get_json()
        user_id = int(get_jwt_identity())
        
        from models.production import WorkOrder
        from models.quality import QualityInspection
        from models.sales import SalesOrder
        
        work_order_id = data.get('work_order_id')
        qc_inspection_id = data.get('qc_inspection_id')
        
        if not work_order_id:
            return jsonify({'error': 'Work order ID is required'}), 400
        
        work_order = db.session.get(WorkOrder, work_order_id)
        if not work_order:
            return jsonify({'error': 'Work order not found'}), 404

        # Guard against double-shipping the same WO (double-click, retry, race
        # condition) - this endpoint deducts Inventory.quantity_on_hand
        # unconditionally below, so a second call would double-deduct stock
        # for the same physical goods without this check.
        if work_order.status == 'shipped':
            return jsonify({'error': f'Work Order {work_order.wo_number} sudah berstatus shipped - tidak bisa dikirim ulang.'}), 400

        existing_shipment = ShippingOrder.query.filter(
            ShippingOrder.work_order_id == work_order_id,
            ShippingOrder.status != 'cancelled'
        ).first()
        if existing_shipment:
            return jsonify({
                'error': f'Work Order {work_order.wo_number} sudah punya pengiriman aktif ({existing_shipment.shipping_number}) - tidak bisa dibuat lagi.'
            }), 400

        # Get QC inspection
        qc = None
        if qc_inspection_id:
            qc = db.session.get(QualityInspection, qc_inspection_id)
        
        # Get customer from sales order or data
        customer_id = data.get('customer_id')
        if not customer_id and work_order.sales_order_id:
            sales_order = db.session.get(SalesOrder, work_order.sales_order_id)
            if sales_order:
                customer_id = sales_order.customer_id
        
        if not customer_id:
            return jsonify({'error': 'Customer ID is required'}), 400
        
        # Generate shipping number
        shipping_number = generate_number('SHP', ShippingOrder, 'shipping_number')
        
        # Get delivery method
        delivery_method = data.get('delivery_method', 'expedition')
        
        # Create shipping order
        shipping_order = ShippingOrder(
            shipping_number=shipping_number,
            work_order_id=work_order_id,
            qc_inspection_id=qc_inspection_id,
            sales_order_id=work_order.sales_order_id,
            customer_id=customer_id,
            shipping_date=datetime.fromisoformat(data['shipping_date']) if data.get('shipping_date') else get_local_now().date(),
            expected_delivery_date=datetime.fromisoformat(data['expected_delivery_date']) if data.get('expected_delivery_date') else None,
            status='preparing',
            delivery_method=delivery_method,
            
            # Expedition info
            logistics_provider_id=data.get('logistics_provider_id') if delivery_method == 'expedition' else None,
            tracking_number=data.get('tracking_number'),
            
            # Vehicle & Driver info
            vehicle_number=data.get('vehicle_number'),
            vehicle_type=data.get('vehicle_type'),
            driver_name=data.get('driver_name'),
            driver_phone=data.get('driver_phone'),
            driver_id_number=data.get('driver_id_number'),  # KTP Supir
            driver_license_number=data.get('driver_license_number'),  # SIM
            
            # Self pickup info
            pickup_person_name=data.get('pickup_person_name') if delivery_method == 'self_pickup' else None,
            pickup_person_id=data.get('pickup_person_id') if delivery_method == 'self_pickup' else None,
            pickup_person_phone=data.get('pickup_person_phone') if delivery_method == 'self_pickup' else None,
            pickup_authorization=data.get('pickup_authorization') if delivery_method == 'self_pickup' else None,
            
            shipping_address=data.get('shipping_address'),
            shipping_cost=data.get('shipping_cost', 0),
            total_weight=data.get('total_weight', 0),
            number_of_packages=data.get('number_of_packages', 1),
            notes=data.get('notes'),
            prepared_by=user_id
        )
        
        db.session.add(shipping_order)
        db.session.flush()
        
        # Add shipping item from work order
        product = work_order.product
        quantity = float(qc.quantity_passed if qc and qc.quantity_passed else work_order.quantity_produced or work_order.quantity)
        
        shipping_item = ShippingItem(
            shipping_id=shipping_order.id,
            product_id=work_order.product_id,
            quantity=quantity,
            uom=work_order.uom,
            batch_number=qc.batch_number if qc else work_order.batch_number,
            notes=f'From Work Order {work_order.wo_number}'
        )
        db.session.add(shipping_item)

        # fix_report_3.md (2026-10-02): this endpoint deducts real Inventory
        # and creates the ShippingItem below, but never touched
        # SalesOrderItem.quantity_shipped - "how much of this SO line has
        # actually shipped" stayed 0 forever through this path. Found via a
        # real end-to-end production test (SO fully shipped, item still
        # showed quantity_shipped=0).
        if work_order.sales_order_id:
            from models.sales import SalesOrderItem
            so_item = SalesOrderItem.query.filter_by(
                order_id=work_order.sales_order_id, product_id=work_order.product_id,
            ).first()
            if so_item:
                so_item.quantity_shipped = float(so_item.quantity_shipped or 0) + quantity

        # Update work order status
        work_order.status = 'shipped'
        
        # ============= INVENTORY INTEGRATION (A-004) =============
        from models import Inventory
        from utils.inventory_helpers import record_inventory_transaction
        from utils.fifo_helper import _get_inventory_unit_cost
        from utils.finance_helpers import resolve_account

        # Deduct from inventory (Finished Goods Warehouse, Location ID 3 is default for FG)
        # We try to find match by product and batch
        inv = Inventory.query.filter_by(
            product_id=work_order.product_id,
            batch_number=shipping_item.batch_number,
            location_id=3  # Standard FG Location
        ).first()
        
        if not inv:
            # Fallback: Find any location with this product and batch
            inv = Inventory.query.filter_by(
                product_id=work_order.product_id,
                batch_number=shipping_item.batch_number
            ).first()
            
        if not inv:
            # Fallback 2: Find any location with this product (ignore batch if necessary)
            inv = Inventory.query.filter_by(
                product_id=work_order.product_id
            ).first()
            
        if inv:
            # Fase 3 (2026-09-21): capture FIFO cost before deducting, for
            # the COGS journal below - same pattern as create_shipping_order,
            # see plan.md section 7.
            unit_cost = _get_inventory_unit_cost(inv)

            # Deduct quantity
            inv.quantity_on_hand = float(inv.quantity_on_hand) - quantity
            inv.quantity_available = float(inv.quantity_available) - quantity
            inv.updated_at = get_local_now()

            # Record movement
            movement = record_inventory_transaction(
                transaction_type='stock_out',
                direction='out',
                quantity=quantity,
                product_id=work_order.product_id,
                from_location_id=inv.location_id,
                reference_number=shipping_number,
                reference_type='sales_order',
                reference_id=shipping_order.id,
                batch_number=shipping_item.batch_number,
                unit_cost=unit_cost or None,
                total_cost=(unit_cost * quantity) if unit_cost else None,
                notes=f"Shipped from WO {work_order.wo_number}",
                created_by=user_id
            )

            if unit_cost and unit_cost > 0:
                cogs_amount = unit_cost * quantity
                try:
                    hpp_account_id = resolve_account('akun_hpp_id', product_id=work_order.product_id, category_id=None)
                    persediaan_account_id = resolve_account('akun_persediaan_id', product_id=work_order.product_id, category_id=None)
                    from models.approval_workflow import PendingJournalEntry
                    from utils.finance_helpers import post_pending_journal

                    pending = PendingJournalEntry(
                        workflow_id=None,
                        entry_date=get_local_now().date(),
                        description=f'HPP Pengiriman {shipping_number}',
                        reference=shipping_number,
                        lines=[
                            {'account_id': hpp_account_id, 'debit': cogs_amount, 'credit': 0,
                             'description': f'HPP pengiriman {shipping_number} dari SPK {work_order.wo_number}'},
                            {'account_id': persediaan_account_id, 'debit': 0, 'credit': cogs_amount,
                             'description': f'Persediaan barang jadi keluar {shipping_number}'},
                        ],
                        total_debit=cogs_amount,
                        total_credit=cogs_amount,
                        created_by=user_id,
                    )
                    db.session.add(pending)
                    db.session.flush()
                    posted_entries = post_pending_journal(pending.id, posted_by_user_id=user_id, reference_type='sales_delivery', reference_id=shipping_order.id)
                    if posted_entries:
                        movement.accounting_entry_number = posted_entries[0].entry_number.rsplit('-', 1)[0]
                        movement.accounting_entry_status = 'posted'
                except ValueError:
                    # akun_hpp_id / akun_persediaan_id not configured - stock
                    # effect above still applies, COGS posting is skipped
                    # rather than failing the whole shipment.
                    pass

        db.session.commit()
        
        return jsonify({
            'message': 'Shipping order created successfully',
            'shipping_id': shipping_order.id,
            'shipping_number': shipping_number
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
