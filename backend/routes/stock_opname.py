"""
Stock Opname (Physical Inventory Count) Routes
"""
from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db
from models.stock_opname import StockOpnameOrder, StockOpnameItem
from models.warehouse import WarehouseZone, WarehouseLocation, Inventory
from utils.inventory_helpers import record_inventory_transaction
from models.warehouse_adjustment import InventoryAdjustment
from models.product import Product, Material
from utils import generate_number
from datetime import datetime
import json
from utils.timezone import get_local_now, get_local_today

stock_opname_bp = Blueprint('stock_opname', __name__)


@stock_opname_bp.route('/orders', methods=['GET'])
@jwt_required()
@require_permission('inventory.view')
def get_opname_orders():
    """Get list of stock opname orders"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        zone_id = request.args.get('zone_id', type=int)
        
        query = StockOpnameOrder.query
        
        if status:
            query = query.filter(StockOpnameOrder.status == status)
        if zone_id:
            query = query.filter(StockOpnameOrder.zone_id == zone_id)
        
        orders = query.order_by(StockOpnameOrder.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'orders': [order.to_dict() for order in orders.items],
            'total': orders.total,
            'pages': orders.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stock_opname_bp.route('/orders/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('inventory.view')
def get_opname_order(id):
    """Get single stock opname order with items"""
    try:
        order = db.session.get(StockOpnameOrder, id) or abort(404)
        
        order_data = order.to_dict()
        order_data['items'] = [item.to_dict() for item in order.items]
        
        return jsonify({'order': order_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stock_opname_bp.route('/orders', methods=['POST'])
@jwt_required()
@require_permission('inventory.create')
def create_opname_order():
    """Create new stock opname order"""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json()
        
        # Generate opname number
        opname_number = generate_number('SO', StockOpnameOrder, 'opname_number')
        
        order = StockOpnameOrder(
            opname_number=opname_number,
            zone_id=data.get('zone_id'),
            location_id=data.get('location_id'),
            opname_type=data.get('opname_type', 'full'),
            scheduled_date=datetime.strptime(data['scheduled_date'], '%Y-%m-%d').date(),
            assigned_to=data.get('assigned_to'),
            team_members=json.dumps(data.get('team_members', [])) if data.get('team_members') else None,
            notes=data.get('notes'),
            status='draft',
            created_by=user_id
        )
        
        db.session.add(order)
        db.session.flush()
        
        # Generate items based on scope
        items_created = generate_opname_items(order)
        order.total_items = items_created
        
        db.session.commit()
        
        return jsonify({
            'message': 'Perintah stok opname berhasil dibuat',
            'order': order.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def generate_opname_items(order):
    """Generate opname items based on order scope"""
    items_count = 0
    
    # Build inventory query based on scope
    query = Inventory.query.filter(Inventory.is_active == True)
    
    if order.location_id:
        query = query.filter(Inventory.location_id == order.location_id)
    elif order.zone_id:
        # Get all locations in the zone
        locations = WarehouseLocation.query.filter_by(zone_id=order.zone_id).all()
        location_ids = [loc.id for loc in locations]
        query = query.filter(Inventory.location_id.in_(location_ids))
    
    inventories = query.all()
    
    for inv in inventories:
        # Get item details
        if inv.product_id:
            product = db.session.get(Product, inv.product_id)
            item_code = product.code if product else f'P-{inv.product_id}'
            item_name = product.name if product else 'Unknown Product'
            uom = product.primary_uom if product else 'pcs'
        elif inv.material_id:
            material = db.session.get(Material, inv.material_id)
            item_code = material.code if material else f'M-{inv.material_id}'
            item_name = material.name if material else 'Unknown Material'
            uom = material.primary_uom if material else 'kg'
        else:
            continue
        
        item = StockOpnameItem(
            opname_order_id=order.id,
            inventory_id=inv.id,
            product_id=inv.product_id,
            material_id=inv.material_id,
            location_id=inv.location_id,
            item_code=item_code,
            item_name=item_name,
            batch_number=inv.batch_number,
            uom=uom,
            system_qty=inv.quantity_on_hand,
            status='pending'
        )
        
        db.session.add(item)
        items_count += 1
    
    return items_count


@stock_opname_bp.route('/orders/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('inventory.edit')
def update_opname_order(id):
    """Update stock opname order"""
    try:
        order = db.session.get(StockOpnameOrder, id) or abort(404)
        data = request.get_json()
        
        if order.status not in ['draft', 'scheduled']:
            return jsonify({'error': 'Tidak dapat mengubah opname yang sudah berjalan'}), 400
        
        if 'scheduled_date' in data:
            order.scheduled_date = datetime.strptime(data['scheduled_date'], '%Y-%m-%d').date()
        if 'assigned_to' in data:
            order.assigned_to = data['assigned_to']
        if 'team_members' in data:
            order.team_members = json.dumps(data['team_members']) if data['team_members'] else None
        if 'notes' in data:
            order.notes = data['notes']
        if 'status' in data:
            order.status = data['status']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Perintah stok opname berhasil diupdate',
            'order': order.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@stock_opname_bp.route('/orders/<int:id>/start', methods=['PUT'])
@jwt_required()
@require_permission('inventory.edit')
def start_opname(id):
    """Start stock opname counting"""
    try:
        order = db.session.get(StockOpnameOrder, id) or abort(404)
        
        if order.status not in ['draft', 'scheduled']:
            return jsonify({'error': 'Opname sudah dimulai atau selesai'}), 400
        
        order.status = 'in_progress'
        order.start_date = get_local_now()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Stok opname dimulai',
            'order': order.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@stock_opname_bp.route('/orders/<int:id>/items', methods=['GET'])
@jwt_required()
@require_permission('inventory.view')
def get_opname_items(id):
    """Get items for a stock opname order"""
    try:
        order = db.session.get(StockOpnameOrder, id) or abort(404)
        
        status = request.args.get('status')
        search = request.args.get('search')
        
        query = StockOpnameItem.query.filter_by(opname_order_id=id)
        
        if status:
            query = query.filter(StockOpnameItem.status == status)
        if search:
            query = query.filter(
                db.or_(
                    StockOpnameItem.item_code.ilike(f'%{search}%'),
                    StockOpnameItem.item_name.ilike(f'%{search}%'),
                    StockOpnameItem.batch_number.ilike(f'%{search}%')
                )
            )
        
        items = query.order_by(StockOpnameItem.item_code).all()
        
        return jsonify({
            'items': [item.to_dict() for item in items],
            'total': len(items)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stock_opname_bp.route('/orders/<int:order_id>/items/<int:item_id>/count', methods=['PUT'])
@jwt_required()
@require_permission('inventory.edit')
def count_item(order_id, item_id):
    """Record count for an item"""
    try:
        user_id = int(get_jwt_identity())
        
        order = db.session.get(StockOpnameOrder, order_id) or abort(404)
        if order.status != 'in_progress':
            return jsonify({'error': 'Opname belum dimulai atau sudah selesai'}), 400
        
        item = db.session.get(StockOpnameItem, item_id) or abort(404)
        if item.opname_order_id != order_id:
            return jsonify({'error': 'Item tidak ditemukan dalam opname ini'}), 404
        
        data = request.get_json()
        counted_qty = float(data['counted_qty'])
        
        item.counted_qty = counted_qty
        item.variance_qty = counted_qty - float(item.system_qty)
        
        if item.unit_cost:
            item.variance_value = item.variance_qty * float(item.unit_cost)
        
        item.status = 'counted'
        item.counted_by = user_id
        item.counted_at = get_local_now()
        item.notes = data.get('notes')
        
        # Update order progress
        order.counted_items = StockOpnameItem.query.filter_by(
            opname_order_id=order_id
        ).filter(StockOpnameItem.status.in_(['counted', 'verified'])).count()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Hasil hitung berhasil disimpan',
            'item': item.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@stock_opname_bp.route('/orders/<int:id>/complete', methods=['PUT'])
@jwt_required()
@require_permission('inventory.edit')
def complete_opname(id):
    """Complete stock opname and calculate variances"""
    try:
        user_id = int(get_jwt_identity())
        order = db.session.get(StockOpnameOrder, id) or abort(404)
        
        if order.status != 'in_progress':
            return jsonify({'error': 'Opname tidak dalam status in_progress'}), 400
        
        # Check if all items counted
        pending_count = StockOpnameItem.query.filter_by(
            opname_order_id=id, status='pending'
        ).count()
        
        if pending_count > 0:
            return jsonify({'error': f'Masih ada {pending_count} item yang belum dihitung'}), 400
        
        # Calculate summary
        items = StockOpnameItem.query.filter_by(opname_order_id=id).all()
        
        variance_items = 0
        total_variance_value = 0
        
        for item in items:
            if item.variance_qty and item.variance_qty != 0:
                variance_items += 1
                if item.variance_value:
                    total_variance_value += float(item.variance_value)
        
        order.status = 'completed'
        order.end_date = get_local_now()
        order.counted_items = len(items)
        order.variance_items = variance_items
        order.total_variance_value = total_variance_value
        
        db.session.commit()
        
        return jsonify({
            'message': 'Stok opname selesai',
            'order': order.to_dict(),
            'summary': {
                'total_items': len(items),
                'variance_items': variance_items,
                'total_variance_value': total_variance_value
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def apply_stock_opname_adjustments(order, user_id, create_adjustments=True):
    """Apply inventory variance adjustments for a completed stock opname order.

    Shared by the legacy direct-approve endpoint below and by the generic
    ApprovalWorkflow dispatch hook (routes/approval_workflow.py) — same side
    effect regardless of which path triggered the approval.
    """
    if create_adjustments:
        items_with_variance = StockOpnameItem.query.filter(
            StockOpnameItem.opname_order_id == order.id,
            StockOpnameItem.variance_qty != 0
        ).all()

        stock_txns = []
        journal_lines = []
        total_variance_amount = 0.0

        for item in items_with_variance:
            if item.inventory_id:
                inventory = db.session.get(Inventory, item.inventory_id)
                if inventory:
                    # Fase 3 follow-up (2026-09-21): capture cost BEFORE
                    # mutating quantity, same pattern as GRN/Shipping - see
                    # plan.md section 7/9.
                    from utils.fifo_helper import _get_inventory_unit_cost
                    unit_cost = _get_inventory_unit_cost(inventory)

                    inventory.quantity_on_hand = item.counted_qty
                    inventory.quantity_available = item.counted_qty - inventory.quantity_reserved
                    inventory.last_stock_check = get_local_now()

                    variance_qty = float(item.variance_qty)
                    variance_direction = 'in' if variance_qty >= 0 else 'out'
                    movement = record_inventory_transaction(
                        transaction_type='adjustment',
                        direction=variance_direction,
                        quantity=abs(variance_qty),
                        product_id=inventory.product_id,
                        material_id=inventory.material_id,
                        to_location_id=inventory.location_id if variance_direction == 'in' else None,
                        from_location_id=inventory.location_id if variance_direction == 'out' else None,
                        reference_number=order.opname_number,
                        reference_type='stock_opname',
                        reference_id=order.id,
                        batch_number=item.batch_number,
                        unit_cost=unit_cost or None,
                        total_cost=(unit_cost * abs(variance_qty)) if unit_cost else None,
                        notes=f'Penyesuaian dari Stok Opname {order.opname_number}',
                        created_by=user_id
                    )
                    stock_txns.append(movement)

                    if unit_cost and unit_cost > 0:
                        variance_amount = unit_cost * abs(variance_qty)
                        try:
                            from utils.finance_helpers import resolve_account
                            from models.finance import InventoryAccountSettings

                            persediaan_account_id = resolve_account('akun_persediaan_id', product_id=inventory.product_id, category_id=None)
                            settings = InventoryAccountSettings.query.first()
                            selisih_account_id = settings.akun_penyesuaian_id if settings else None

                            if selisih_account_id:
                                desc = f'Selisih Stok Opname {order.opname_number} - {item.batch_number or ""}'
                                if variance_direction == 'in':
                                    # Found more than recorded: stock value up.
                                    journal_lines.append({'account_id': persediaan_account_id, 'debit': variance_amount, 'credit': 0, 'description': desc})
                                    journal_lines.append({'account_id': selisih_account_id, 'debit': 0, 'credit': variance_amount, 'description': desc})
                                else:
                                    # Found less than recorded: stock value down.
                                    journal_lines.append({'account_id': selisih_account_id, 'debit': variance_amount, 'credit': 0, 'description': desc})
                                    journal_lines.append({'account_id': persediaan_account_id, 'debit': 0, 'credit': variance_amount, 'description': desc})
                                total_variance_amount += variance_amount
                        except ValueError:
                            # akun_persediaan_id not resolvable for this item
                            # (no override at any level) - stock effect above
                            # still applies, this line's journal is skipped
                            # rather than failing the whole approval.
                            pass

        if journal_lines and total_variance_amount > 0:
            from models.approval_workflow import PendingJournalEntry
            from utils.finance_helpers import post_pending_journal

            pending = PendingJournalEntry(
                workflow_id=None,
                entry_date=get_local_now().date(),
                description=f'Penyesuaian Stok Opname {order.opname_number}',
                reference=order.opname_number,
                lines=journal_lines,
                total_debit=total_variance_amount,
                total_credit=total_variance_amount,
                created_by=user_id,
            )
            db.session.add(pending)
            db.session.flush()
            posted_entries = post_pending_journal(pending.id, posted_by_user_id=user_id, reference_type='stock_opname', reference_id=order.id)
            if posted_entries:
                base_number = posted_entries[0].entry_number.rsplit('-', 1)[0]
                for txn in stock_txns:
                    txn.accounting_entry_number = base_number
                    txn.accounting_entry_status = 'posted'

    order.approved_by = user_id
    order.approved_at = get_local_now()


# NOTE (Bagian 2 part 1, 2026-08-19; corrected 2026-08-19 after frontend
# wiring audit): approve_opname() below is NOT dead code — it was mislabeled
# as such when submit_opname_for_approval() was added. In reality
# frontend/src/pages/Warehouse/StockOpnameDetail.tsx's handleApprove() still
# calls THIS endpoint exclusively; the newer POST /orders/<id>/submit-approval
# (which routes through the generic ApprovalWorkflow system, see
# routes/approval_workflow.py) is not yet wired to any UI. Keep this endpoint
# working as-is until the frontend is switched over to submit-approval —
# see WAREHOUSE_FRONTEND_WIRING_AUDIT.md item 3 for the migration plan.
# Do not remove this route.
@stock_opname_bp.route('/orders/<int:id>/approve', methods=['PUT'])
@jwt_required()
@require_permission('inventory.edit')
def approve_opname(id):
    """Approve stock opname and create adjustments"""
    try:
        user_id = int(get_jwt_identity())
        order = db.session.get(StockOpnameOrder, id) or abort(404)

        if order.status != 'completed':
            return jsonify({'error': 'Opname belum selesai'}), 400

        data = request.get_json()
        create_adjustments = data.get('create_adjustments', True)

        apply_stock_opname_adjustments(order, user_id, create_adjustments)

        db.session.commit()

        return jsonify({
            'message': 'Stok opname disetujui dan penyesuaian dibuat',
            'order': order.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@stock_opname_bp.route('/orders/<int:id>/submit-approval', methods=['POST'])
@jwt_required()
@require_permission('inventory.create')
def submit_opname_for_approval(id):
    """Submit a completed stock opname order for approval via the generic
    ApprovalWorkflow system. Pattern mirrors routes/purchasing.py submit_for_approval()."""
    try:
        user_id = get_jwt_identity()

        order = db.session.get(StockOpnameOrder, id) or abort(404)
        if order.status != 'completed':
            return jsonify({'error': 'Opname belum selesai'}), 400

        from models.approval_workflow import ApprovalWorkflow, ApprovalHistory

        workflow = ApprovalWorkflow(
            transaction_type='stock_opname',
            transaction_id=order.id,
            transaction_number=order.opname_number,
            status='pending_review',
            current_step='review',
            submitted_by=user_id,
            submitted_at=get_local_now()
        )
        db.session.add(workflow)
        db.session.flush()

        history = ApprovalHistory(
            workflow_id=workflow.id,
            action='submit',
            action_by=user_id,
            old_status='completed',
            new_status='pending_review',
            notes=f'Stock Opname {order.opname_number} submitted for review'
        )
        db.session.add(history)

        db.session.commit()

        return jsonify({'message': 'Opname submitted for approval', 'workflow_id': workflow.id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@stock_opname_bp.route('/orders/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('inventory.delete')
def delete_opname_order(id):
    """Delete stock opname order"""
    try:
        order = db.session.get(StockOpnameOrder, id) or abort(404)
        
        if order.status not in ['draft', 'cancelled']:
            return jsonify({'error': 'Hanya opname draft atau cancelled yang bisa dihapus'}), 400
        
        db.session.delete(order)
        db.session.commit()
        
        return jsonify({'message': 'Perintah stok opname berhasil dihapus'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@stock_opname_bp.route('/zones', methods=['GET'])
@jwt_required()
@require_permission('inventory.view')
def get_zones():
    """Get warehouse zones for dropdown"""
    try:
        zones = WarehouseZone.query.filter_by(is_active=True).all()
        
        return jsonify({
            'zones': [{
                'id': z.id,
                'code': z.code,
                'name': z.name,
                'material_type': z.material_type
            } for z in zones]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
