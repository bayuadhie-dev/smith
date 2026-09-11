from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db
from models.material_issue import MaterialIssue, MaterialIssueItem, MaterialReturn, MaterialReturnItem
from models.warehouse import Inventory, InventoryMovement, WarehouseLocation
from models.product import Material
from models.production import WorkOrder, BillOfMaterials, BOMItem
from utils.i18n import success_response, error_response
from utils import generate_number
from datetime import datetime
from sqlalchemy import func
from utils.timezone import get_local_now, get_local_today

material_issue_bp = Blueprint('material_issue', __name__)

# ============= MATERIAL ISSUE =============

@material_issue_bp.route('/material-issues', methods=['GET'])
@jwt_required()
@require_permission('materials.view')
def get_material_issues():
    """Get all material issues with filters"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        work_order_id = request.args.get('work_order_id', type=int)
        
        query = MaterialIssue.query
        
        if status:
            query = query.filter(MaterialIssue.status == status)
        
        if work_order_id:
            query = query.filter(MaterialIssue.work_order_id == work_order_id)
        
        issues = query.order_by(MaterialIssue.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'material_issues': [{
                'id': mi.id,
                'issue_number': mi.issue_number,
                'work_order_id': mi.work_order_id,
                'wo_number': mi.work_order.wo_number if mi.work_order else None,
                'product_name': mi.work_order.product.name if mi.work_order and mi.work_order.product else None,
                'issue_date': mi.issue_date.isoformat() if mi.issue_date else None,
                'status': mi.status,
                'priority': mi.priority,
                'issue_type': mi.issue_type,
                'total_items': mi.total_items,
                'requested_by': mi.requested_by_user.username if mi.requested_by_user else None,
                'created_at': mi.created_at.isoformat()
            } for mi in issues.items],
            'total': issues.total,
            'pages': issues.pages,
            'current_page': issues.page
        }), 200
        
    except Exception as e:
        return error_response(str(e)), 500

@material_issue_bp.route('/material-issues/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('materials.view')
def get_material_issue(id):
    """Get single material issue with items"""
    try:
        mi = db.session.get(MaterialIssue, id)
        if not mi:
            return error_response('Material issue not found'), 404
        
        product_name = mi.work_order.product.name if mi.work_order and mi.work_order.product else None
        if not product_name and mi.sales_order_id and mi.sales_order and mi.sales_order.items:
            first_item = mi.sales_order.items[0]
            product_name = first_item.product.name if first_item.product else None
        if not product_name and mi.production_plan_id and mi.production_plan and mi.production_plan.product:
            product_name = mi.production_plan.product.name

        return jsonify({
            'material_issue': {
                'id': mi.id,
                'issue_number': mi.issue_number,
                'work_order_id': mi.work_order_id,
                'wo_number': mi.work_order.wo_number if mi.work_order else None,
                'sales_order_id': mi.sales_order_id,
                'so_number': mi.sales_order.order_number if mi.sales_order_id and mi.sales_order else None,
                'production_plan_id': mi.production_plan_id,
                'plan_number': mi.production_plan.plan_number if mi.production_plan_id and mi.production_plan else None,
                'trigger_source': mi.trigger_source,
                'product_name': product_name,
                'issue_date': mi.issue_date.isoformat() if mi.issue_date else None,
                'required_date': mi.required_date.isoformat() if mi.required_date else None,
                'status': mi.status,
                'priority': mi.priority,
                'issue_type': mi.issue_type,
                'department': mi.department,
                'notes': mi.notes,
                'special_instructions': mi.special_instructions,
                'requested_by': mi.requested_by_user.username if mi.requested_by_user else None,
                'approved_by': mi.approved_by_user.username if mi.approved_by_user else None,
                'issued_by': mi.issued_by_user.username if mi.issued_by_user else None,
                'approved_date': mi.approved_date.isoformat() if mi.approved_date else None,
                'issued_date': mi.issued_date.isoformat() if mi.issued_date else None,
                'received_confirmed_by': mi.received_confirmed_by_user.username if getattr(mi, 'received_confirmed_by_user', None) else None,
                'received_confirmed_at': mi.received_confirmed_at.isoformat() if mi.received_confirmed_at else None,
                'items': [{
                    'id': item.id,
                    'line_number': item.line_number,
                    'material_id': item.material_id,
                    'material_code': item.material.code if item.material else None,
                    'material_name': item.material.name if item.material else None,
                    'description': item.description,
                    'required_quantity': float(item.required_quantity),
                    'issued_quantity': float(item.issued_quantity or 0),
                    'returned_quantity': float(item.returned_quantity or 0),
                    'pending_quantity': float(item.pending_quantity),
                    'received_quantity': float(item.received_quantity) if item.received_quantity is not None else None,
                    'receive_note': item.receive_note,
                    'reservation_status': item.reservation_status,
                    'uom': item.uom,
                    'warehouse_location_id': item.warehouse_location_id,
                    'location_code': item.warehouse_location.location_code if item.warehouse_location else None,
                    'batch_number': item.batch_number,
                    'status': item.status,
                    'unit_cost': float(item.unit_cost) if item.unit_cost else None,
                    'total_cost': float(item.total_cost) if item.total_cost else None
                } for item in mi.items]
            }
        }), 200
        
    except Exception as e:
        return error_response(str(e)), 500

@material_issue_bp.route('/material-issues', methods=['POST'])
@jwt_required()
@require_permission('materials.create')
def create_material_issue():
    """Create material issue for a work order"""
    try:
        data = request.get_json()
        user_id = int(get_jwt_identity())

        work_order_id = data.get('work_order_id')
        sales_order_id = data.get('sales_order_id')
        production_plan_id = data.get('production_plan_id')

        # At least one source document is required. Enforced here at the
        # endpoint level (not a DB constraint) — work_order_id alone used to be
        # mandatory, now any one of work_order_id/sales_order_id/production_plan_id
        # satisfies the requirement.
        if not work_order_id and not sales_order_id and not production_plan_id:
            return error_response(
                'At least one of work_order_id, sales_order_id, production_plan_id is required'
            ), 400

        if work_order_id:
            wo = db.session.get(WorkOrder, work_order_id)
            if not wo:
                return error_response('Work order not found'), 404

        if sales_order_id:
            from models.sales import SalesOrder
            so = db.session.get(SalesOrder, sales_order_id)
            if not so:
                return error_response('Sales order not found'), 404

        if production_plan_id:
            from models.production import ProductionPlan
            plan = db.session.get(ProductionPlan, production_plan_id)
            if not plan:
                return error_response('Production plan not found'), 404

        # Generate issue number
        issue_number = generate_number('MI', MaterialIssue, 'issue_number')

        # Create material issue
        mi = MaterialIssue(
            issue_number=issue_number,
            work_order_id=work_order_id,
            sales_order_id=sales_order_id,
            production_plan_id=production_plan_id,
            trigger_source=data.get('trigger_source', 'manual'),
            issue_date=get_local_now(),
            requested_by=user_id,
            status='pending',
            priority=data.get('priority', 'normal'),
            issue_type=data.get('issue_type', 'production'),
            department=data.get('department'),
            notes=data.get('notes'),
            special_instructions=data.get('special_instructions'),
            required_date=datetime.fromisoformat(data['required_date']) if data.get('required_date') else None
        )
        db.session.add(mi)
        db.session.flush()
        
        # Add items
        items_data = data.get('items', [])
        for idx, item_data in enumerate(items_data, 1):
            material = db.session.get(Material, item_data['material_id'])
            if not material:
                continue
            
            item = MaterialIssueItem(
                material_issue_id=mi.id,
                line_number=idx,
                material_id=item_data['material_id'],
                description=item_data.get('description', material.name),
                required_quantity=item_data['required_quantity'],
                uom=item_data.get('uom', material.primary_uom),
                warehouse_location_id=item_data.get('warehouse_location_id'),
                batch_number=item_data.get('batch_number'),
                unit_cost=material.unit_cost if hasattr(material, 'unit_cost') else None,
                status='pending'
            )
            
            # Calculate total cost
            if item.unit_cost:
                item.total_cost = float(item.unit_cost) * float(item.required_quantity)
            
            db.session.add(item)
        
        db.session.commit()
        
        return success_response('Material issue created', {
            'id': mi.id,
            'issue_number': mi.issue_number
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return error_response(str(e)), 500

@material_issue_bp.route('/material-issues/from-work-order/<int:work_order_id>', methods=['POST'])
@jwt_required()
@require_permission('materials.create')
def create_material_issue_from_wo(work_order_id):
    """Auto-create material issue from work order BOM"""
    try:
        user_id = int(get_jwt_identity())
        
        wo = db.session.get(WorkOrder, work_order_id)
        if not wo:
            return error_response('Work order not found'), 404
        
        # Get BOM for the product
        bom = BillOfMaterials.query.filter_by(product_id=wo.product_id, is_active=True).first()
        if not bom:
            return error_response('No active BOM found for this product'), 404
        
        # Check if material issue already exists for this WO
        existing = MaterialIssue.query.filter_by(
            work_order_id=work_order_id,
            status='pending'
        ).first()
        
        if existing:
            return error_response('Material issue already exists for this work order'), 400
        
        # Generate issue number
        issue_number = generate_number('MI', MaterialIssue, 'issue_number')
        
        # Create material issue
        mi = MaterialIssue(
            issue_number=issue_number,
            work_order_id=work_order_id,
            issue_date=get_local_now(),
            requested_by=user_id,
            status='pending',
            priority='normal',
            issue_type='production',
            notes=f'Auto-generated from Work Order {wo.wo_number}'
        )
        db.session.add(mi)
        db.session.flush()
        
        # Add items from BOM
        # NOTE: Do NOT assign warehouse_location_id or batch_number here.
        # This is just a pending request. The actual batch allocation happens
        # at approve time (fifo_reserve_stock) and issue time (fifo_deduct_stock).
        # Hardcoding a single batch here would be the "Single Batch Trap" —
        # if required_qty > batch.quantity, it would fail at issue time.
        insufficient_warnings = []
        for idx, bom_item in enumerate(bom.items, 1):
            required_qty = float(bom_item.quantity) * float(wo.quantity)
            
            # Check total available across ALL batches (read-only, no lock)
            total_available = db.session.query(
                func.coalesce(func.sum(Inventory.quantity_available), 0)
            ).filter(
                Inventory.material_id == bom_item.material_id,
                Inventory.is_active == True
            ).scalar()
            
            item = MaterialIssueItem(
                material_issue_id=mi.id,
                line_number=idx,
                material_id=bom_item.material_id,
                description=bom_item.material.name if bom_item.material else '',
                required_quantity=required_qty,
                uom=bom_item.uom,
                status='pending'
            )
            db.session.add(item)
            
            if float(total_available) < required_qty:
                insufficient_warnings.append({
                    'material': bom_item.material.name if bom_item.material else f'ID {bom_item.material_id}',
                    'required': required_qty,
                    'available': float(total_available),
                    'short': round(required_qty - float(total_available), 4)
                })
        
        db.session.commit()
        
        return success_response('Material issue created from BOM', {
            'id': mi.id,
            'issue_number': mi.issue_number,
            'total_items': len(bom.items),
            'insufficient_warnings': insufficient_warnings
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return error_response(str(e)), 500

@material_issue_bp.route('/material-issues/<int:id>/approve', methods=['PUT'])
@jwt_required()
@require_permission('materials.edit')
def approve_material_issue(id):
    """Approve material issue — reserves materials using FIFO with row-level locking."""
    try:
        from utils.fifo_helper import fifo_reserve_stock
        
        user_id = int(get_jwt_identity())
        
        mi = db.session.get(MaterialIssue, id)
        if not mi:
            return error_response('Material issue not found'), 404
        
        if mi.status != 'pending':
            return error_response(f'Cannot approve issue with status: {mi.status}'), 400
        
        # Reserve materials using FIFO (oldest batch first) with locking
        reservation_details = []
        for item in mi.items:
            if not item.material_id:
                continue
            
            reserve_qty = float(item.required_quantity) - float(item.issued_quantity or 0)
            if reserve_qty <= 0:
                continue
            
            result = fifo_reserve_stock(
                material_id=item.material_id,
                quantity_needed=reserve_qty
            )
            
            if not result['success']:
                db.session.rollback()
                return error_response(
                    f'Insufficient stock for {item.material.name if item.material else "material"}. '
                    f'{result["error"]}'
                ), 400
            
            # Update item with reservation info (first batch location/batch_number)
            if result['reservations']:
                item.warehouse_location_id = result['reservations'][0]['location_id']
                item.batch_number = result['reservations'][0]['batch_number']
            
            reservation_details.append({
                'material_id': item.material_id,
                'material_name': item.material.name if item.material else None,
                'quantity_reserved': result['reserved'],
                'batches': len(result['reservations'])
            })
        
        mi.status = 'approved'
        mi.approved_by = user_id
        mi.approved_date = get_local_now()
        
        db.session.commit()
        
        return success_response('Material issue approved and materials reserved (FIFO)', {
            'reservations': reservation_details
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return error_response(str(e)), 500

@material_issue_bp.route('/material-issues/<int:id>/issue', methods=['PUT'])
@jwt_required()
@require_permission('materials.edit')
def issue_materials(id):
    """Issue materials — deduct from reserved inventory using FIFO with row-level locking.
    Materials must be approved (reserved) first. Deducts from quantity_reserved bucket."""
    try:
        from utils.fifo_helper import fifo_deduct_stock
        
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        
        mi = db.session.get(MaterialIssue, id)
        if not mi:
            return error_response('Material issue not found'), 404
        
        if mi.status not in ['approved', 'partial']:
            return error_response(f'Cannot issue materials with status: {mi.status}'), 400
        
        # Check opname lock for all materials in this issue
        from utils.opname_lock import check_opname_lock
        for item in mi.items:
            if item.material_id:
                lock = check_opname_lock(material_id=item.material_id)
                if lock['locked']:
                    return error_response(lock['message']), 423
        
        items_to_issue = data.get('items', [])
        
        # If no specific items, issue all pending items
        if not items_to_issue:
            items_to_issue = [{'item_id': item.id, 'quantity': float(item.pending_quantity)} 
                            for item in mi.items if item.pending_quantity > 0]
        
        issued_count = 0
        fifo_details = []
        
        for issue_data in items_to_issue:
            item = db.session.get(MaterialIssueItem, issue_data['item_id'])
            if not item or item.material_issue_id != id:
                continue
            
            issue_qty = float(issue_data.get('quantity', item.pending_quantity))
            
            if issue_qty <= 0 or issue_qty > float(item.pending_quantity):
                continue
            
            # FIFO deduction from RESERVED stock (locked rows, race-condition safe)
            wo_number = mi.work_order.wo_number if mi.work_order else ''
            result = fifo_deduct_stock(
                material_id=item.material_id,
                quantity_needed=issue_qty,
                reference_number=mi.issue_number,
                reference_type='material_issue',
                reference_id=mi.id,
                notes=f'Issued for Work Order {wo_number}',
                user_id=user_id,
                from_reserved=True
            )
            
            if not result['success']:
                fifo_details.append({
                    'material_id': item.material_id,
                    'material_name': item.material.name if item.material else None,
                    'error': result['error']
                })
                continue
            
            # Update item with issued quantity and cost
            item.issued_quantity = float(item.issued_quantity or 0) + result['deducted']
            item.unit_cost = result['weighted_avg_cost']
            item.total_cost = result['total_cost']
            
            # Set batch_number to the first (oldest) batch used
            if result['movements']:
                item.batch_number = result['movements'][0]['batch_number']
                item.warehouse_location_id = result['movements'][0]['location_id']
            
            if item.is_fully_issued:
                item.status = 'issued'
            else:
                item.status = 'partial'
            
            issued_count += 1
            fifo_details.append({
                'material_id': item.material_id,
                'material_name': item.material.name if item.material else None,
                'quantity_issued': result['deducted'],
                'batches_used': len(result['movements']),
                'weighted_avg_cost': result['weighted_avg_cost'],
                'total_cost': result['total_cost'],
                'batch_details': result['movements']
            })
        
        # Update material issue status
        all_issued = all(item.is_fully_issued for item in mi.items)
        any_issued = any(item.issued_quantity > 0 for item in mi.items)
        
        if all_issued:
            mi.status = 'issued'
            mi.issued_date = get_local_now()
        elif any_issued:
            mi.status = 'partial'
        
        mi.issued_by = user_id
        
        db.session.commit()
        
        return success_response('Materials issued successfully (FIFO)', {
            'issued_items': issued_count,
            'status': mi.status,
            'fifo_details': fifo_details
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return error_response(str(e)), 500

@material_issue_bp.route('/material-issues/<int:id>/cancel', methods=['PUT'])
@jwt_required()
@require_permission('materials.edit')
def cancel_material_issue(id):
    """Cancel material issue and release reserved materials using FIFO helper with locking."""
    try:
        from utils.fifo_helper import fifo_release_reservation
        
        mi = db.session.get(MaterialIssue, id)
        if not mi:
            return error_response('Material issue not found'), 404
        
        if mi.status == 'issued':
            return error_response('Cannot cancel fully issued material issue'), 400
        
        # Release reserved materials via FIFO helper (with row locking)
        if mi.status in ['approved', 'partial']:
            for item in mi.items:
                if not item.material_id:
                    continue
                unreserved_qty = float(item.required_quantity) - float(item.issued_quantity or 0)
                if unreserved_qty > 0:
                    fifo_release_reservation(
                        material_id=item.material_id,
                        quantity_to_release=unreserved_qty
                    )
        
        mi.status = 'cancelled'
        
        db.session.commit()
        
        return success_response('Material issue cancelled'), 200
        
    except Exception as e:
        db.session.rollback()
        return error_response(str(e)), 500

# ============= SHORTAGE REPORT (kebutuhan C) =============

@material_issue_bp.route('/material-issues/shortages', methods=['GET'])
@jwt_required()
@require_permission('materials.view')
def get_material_issue_shortages():
    """Shortage report — read-only, DERIVED from MaterialIssueItem, no new table.

    Lists every MaterialIssueItem with pending_quantity > 0 on a MaterialIssue
    that is 'approved' or 'partial', together with the source document
    (Work Order / Sales Order / Production Plan) it belongs to.

    SPK-sourced items (trigger_source='spk', production_batch_id set) are special-cased
    (2026-08-24, SPK_STAGING_BAHAN_BAKU_RENCANA_TEKNIS.md): per the explicit decision,
    staging (MaterialIssueItem.required_quantity) stays FROZEN at whatever it was when
    the SPK first triggered it — never recalculated in the DB, even if the SPK is later
    edited. But the picklist itself must still show the TRUE current gap, so for these
    items only, shortage_quantity is recomputed live against the SPK's CURRENT
    document_data['quantity'] (BOM-exploded) rather than trusted from the stored
    required_quantity/reservation_status. This can surface an item here even if its
    stored reservation_status is still 'full' (fully covered under the OLD qty) - that's
    intentional, it's exactly the case an SPK qty increase needs to surface. Follow-up
    stays manual either way - this recompute is read-only, nothing is written here."""
    try:
        from models.sales import SalesOrder
        from models.production import ProductionPlan
        from models.document_management import Document
        from utils.auto_reserve import _get_bom_requirements

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        material_id = request.args.get('material_id', type=int)

        # --- Normal path: reservation actually fell short (partial/insufficient) ---
        query = db.session.query(MaterialIssueItem).join(
            MaterialIssue, MaterialIssueItem.material_issue_id == MaterialIssue.id
        ).filter(
            MaterialIssue.status.in_(['approved', 'partial']),
            MaterialIssueItem.reservation_status.in_(['partial', 'insufficient'])
        )
        if material_id:
            query = query.filter(MaterialIssueItem.material_id == material_id)
        query = query.order_by(MaterialIssue.created_at.asc())
        normal_items = query.all()

        # --- SPK-sourced items: recompute live against current SPK qty, regardless of
        # stored reservation_status, to also catch "SPK qty went UP after full reservation" ---
        spk_mi_list = MaterialIssue.query.filter(
            MaterialIssue.status.in_(['approved', 'partial']),
            MaterialIssue.trigger_source == 'spk',
            MaterialIssue.production_batch_id.isnot(None),
        ).all()

        spk_shortage_items = []  # list of (item, recomputed_shortage_qty)
        normal_item_ids = {i.id for i in normal_items}
        for mi in spk_mi_list:
            batch = mi.production_batch
            if not batch or not batch.spk_document_id:
                continue
            spk_doc = db.session.get(Document, batch.spk_document_id)
            if not spk_doc or not spk_doc.document_data:
                continue
            current_qty = spk_doc.document_data.get('quantity')
            if current_qty is None or not batch.recipe:
                continue
            current_requirements = {
                m_id: req_qty for m_id, req_qty, _uom, _name in _get_bom_requirements(batch.recipe.product_id, current_qty)
            }
            for item in mi.items:
                current_required = current_requirements.get(item.material_id, 0)
                recomputed_shortage = max(0, float(current_required) - float(item.issued_quantity or 0))
                if recomputed_shortage <= 0:
                    continue
                if material_id and item.material_id != material_id:
                    continue
                spk_shortage_items.append((item, recomputed_shortage))
                # If already in normal_items, we'll override its shortage_quantity below
                # instead of listing it twice.

        results = []
        seen_item_ids = set()

        def _source_document(mi):
            if mi.work_order_id and mi.work_order:
                return {
                    'type': 'work_order',
                    'id': mi.work_order_id,
                    'number': mi.work_order.wo_number,
                    'product_name': mi.work_order.product.name if mi.work_order.product else None,
                }
            if mi.sales_order_id and mi.sales_order:
                return {
                    'type': 'sales_order',
                    'id': mi.sales_order_id,
                    'number': mi.sales_order.order_number,
                    'customer_name': mi.sales_order.customer.company_name if mi.sales_order.customer else None,
                }
            if mi.production_plan_id and mi.production_plan:
                return {
                    'type': 'production_plan',
                    'id': mi.production_plan_id,
                    'number': mi.production_plan.plan_number,
                    'product_name': mi.production_plan.product.name if mi.production_plan.product else None,
                }
            if mi.production_batch_id and mi.production_batch:
                return {
                    'type': 'production_batch',
                    'id': mi.production_batch_id,
                    'number': mi.production_batch.batch_number,
                    'product_name': mi.production_batch.recipe.product.name if mi.production_batch.recipe and mi.production_batch.recipe.product else None,
                }
            return {}

        spk_recomputed_by_item_id = {item.id: shortage for item, shortage in spk_shortage_items}

        for item in normal_items:
            mi = item.material_issue
            shortage_qty = spk_recomputed_by_item_id.get(item.id, float(item.pending_quantity))
            results.append({
                'material_issue_item_id': item.id,
                'material_issue_id': mi.id,
                'issue_number': mi.issue_number,
                'trigger_source': mi.trigger_source,
                'material_id': item.material_id,
                'material_code': item.material.code if item.material else None,
                'material_name': item.material.name if item.material else (item.description or None),
                'required_quantity': float(item.required_quantity),
                'issued_quantity': float(item.issued_quantity or 0),
                'shortage_quantity': shortage_qty,
                'uom': item.uom,
                'reservation_status': item.reservation_status,
                'issue_status': mi.status,
                'priority': mi.priority,
                'source_document': _source_document(mi),
                'created_at': mi.created_at.isoformat() if mi.created_at else None,
            })
            seen_item_ids.add(item.id)

        for item, shortage_qty in spk_shortage_items:
            if item.id in seen_item_ids:
                continue
            mi = item.material_issue
            results.append({
                'material_issue_item_id': item.id,
                'material_issue_id': mi.id,
                'issue_number': mi.issue_number,
                'trigger_source': mi.trigger_source,
                'material_id': item.material_id,
                'material_code': item.material.code if item.material else None,
                'material_name': item.material.name if item.material else (item.description or None),
                'required_quantity': float(item.required_quantity),
                'issued_quantity': float(item.issued_quantity or 0),
                'shortage_quantity': shortage_qty,
                'uom': item.uom,
                'reservation_status': item.reservation_status,
                'issue_status': mi.status,
                'priority': mi.priority,
                'source_document': _source_document(mi),
                'created_at': mi.created_at.isoformat() if mi.created_at else None,
                'spk_qty_increased': True,  # flag: appears here only because SPK qty went up after full reservation
            })
            seen_item_ids.add(item.id)

        results.sort(key=lambda r: r['created_at'] or '')

        total = len(results)
        start = (page - 1) * per_page
        page_results = results[start:start + per_page]

        return jsonify({
            'shortages': page_results,
            'total': total,
            'pages': (total + per_page - 1) // per_page if per_page else 1,
            'current_page': page
        }), 200

    except Exception as e:
        return error_response(str(e)), 500


# ============= RECEIPT CONFIRMATION (kebutuhan A) =============

@material_issue_bp.route('/material-issues/<int:id>/confirm-receipt', methods=['PUT'])
@jwt_required()
@require_permission('materials.edit')
def confirm_material_issue_receipt(id):
    """Production confirms physical receipt of a Material Issue.

    Fills received_quantity (+ optional receive_note on discrepancy) per item.
    Once ALL items on this document have received_quantity filled, the header's
    received_confirmed_by/received_confirmed_at is set — checklist confirmation
    happens ONLY at this receipt point, per design."""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}

        mi = db.session.get(MaterialIssue, id)
        if not mi:
            return error_response('Material issue not found'), 404

        items_data = data.get('items', [])
        if not items_data:
            return error_response('items is required'), 400

        confirmed_count = 0
        for item_data in items_data:
            item = db.session.get(MaterialIssueItem, item_data.get('item_id'))
            if not item or item.material_issue_id != id:
                continue

            if 'received_quantity' not in item_data:
                continue

            received_qty = float(item_data['received_quantity'])
            item.received_quantity = received_qty
            if item_data.get('receive_note'):
                item.receive_note = item_data['receive_note']

            confirmed_count += 1

        # Only set header confirmation once EVERY item on this document has a
        # received_quantity recorded (loop-check all items, per design).
        all_items_confirmed = len(mi.items) > 0 and all(
            item.received_quantity is not None for item in mi.items
        )

        if all_items_confirmed:
            mi.received_confirmed_by = user_id
            mi.received_confirmed_at = get_local_now()

        db.session.commit()

        return success_response('Receipt confirmation recorded', {
            'confirmed_items': confirmed_count,
            'all_items_confirmed': all_items_confirmed,
            'received_confirmed_by': mi.received_confirmed_by,
            'received_confirmed_at': mi.received_confirmed_at.isoformat() if mi.received_confirmed_at else None
        }), 200

    except Exception as e:
        db.session.rollback()
        return error_response(str(e)), 500


# ============= WORK ORDER INTEGRATION =============

@material_issue_bp.route('/work-orders/<int:work_order_id>/material-requirements', methods=['GET'])
@jwt_required()
@require_permission('materials.view')
def get_wo_material_requirements(work_order_id):
    """Get material requirements for a work order based on BOM"""
    try:
        wo = db.session.get(WorkOrder, work_order_id)
        if not wo:
            return error_response('Work order not found'), 404
        
        # Get BOM
        bom = BillOfMaterials.query.filter_by(product_id=wo.product_id, is_active=True).first()
        if not bom:
            return jsonify({'requirements': [], 'message': 'No BOM found'}), 200
        
        requirements = []
        for bom_item in bom.items:
            required_qty = float(bom_item.quantity) * float(wo.quantity)
            
            # Get available stock
            available_stock = db.session.query(func.sum(Inventory.quantity_available)).filter(
                Inventory.material_id == bom_item.material_id,
                Inventory.is_active == True
            ).scalar() or 0
            
            # Get already issued quantity
            issued_qty = db.session.query(func.sum(MaterialIssueItem.issued_quantity)).join(
                MaterialIssue
            ).filter(
                MaterialIssue.work_order_id == work_order_id,
                MaterialIssueItem.material_id == bom_item.material_id,
                MaterialIssue.status.in_(['approved', 'partial', 'issued'])
            ).scalar() or 0
            
            remaining_to_issue = required_qty - float(issued_qty)
            
            requirements.append({
                'material_id': bom_item.material_id,
                'material_code': bom_item.material.code if bom_item.material else None,
                'material_name': bom_item.material.name if bom_item.material else None,
                'required_quantity': required_qty,
                'issued_quantity': float(issued_qty),
                'remaining_quantity': max(0, remaining_to_issue),
                'available_stock': float(available_stock),
                'uom': bom_item.uom,
                'is_sufficient': float(available_stock) >= remaining_to_issue
            })
        
        return jsonify({
            'work_order': {
                'id': wo.id,
                'wo_number': wo.wo_number,
                'product_name': wo.product.name if wo.product else None,
                'quantity': float(wo.quantity)
            },
            'requirements': requirements,
            'all_sufficient': all(r['is_sufficient'] for r in requirements)
        }), 200
        
    except Exception as e:
        return error_response(str(e)), 500

@material_issue_bp.route('/work-orders/<int:work_order_id>/reserve-materials', methods=['POST'])
@jwt_required()
@require_permission('materials.create')
def reserve_materials_for_wo(work_order_id):
    """Reserve materials for a work order using FIFO with row-level locking."""
    try:
        from utils.fifo_helper import fifo_reserve_stock, fifo_release_reservation
        
        user_id = int(get_jwt_identity())
        
        wo = db.session.get(WorkOrder, work_order_id)
        if not wo:
            return error_response('Work order not found'), 404
        
        bom = BillOfMaterials.query.filter_by(product_id=wo.product_id, is_active=True).first()
        if not bom:
            return error_response('No active BOM found'), 404
        
        reserved_items = []
        insufficient_items = []
        already_reserved = []  # track for rollback if any item fails
        
        for bom_item in bom.items:
            required_qty = float(bom_item.quantity) * float(wo.quantity)
            
            result = fifo_reserve_stock(
                material_id=bom_item.material_id,
                quantity_needed=required_qty
            )
            
            mat_name = bom_item.material.name if bom_item.material else 'Unknown'
            
            if not result['success']:
                insufficient_items.append({
                    'material_name': mat_name,
                    'required': required_qty,
                    'short': required_qty,
                    'error': result['error']
                })
            else:
                reserved_items.append({
                    'material_name': mat_name,
                    'quantity': required_qty,
                    'batches': len(result['reservations'])
                })
                already_reserved.append({
                    'material_id': bom_item.material_id,
                    'quantity': result['reserved']
                })
        
        # If any item is insufficient, rollback ALL reservations made so far
        if insufficient_items:
            for res in already_reserved:
                fifo_release_reservation(
                    material_id=res['material_id'],
                    quantity_to_release=res['quantity']
                )
            db.session.commit()
            return jsonify({
                'success': False,
                'reserved_items': [],
                'insufficient_items': insufficient_items,
                'message': 'Some materials are insufficient. No reservations were made.'
            }), 200
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'reserved_items': reserved_items,
            'insufficient_items': [],
            'message': 'All materials reserved (FIFO)'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return error_response(str(e)), 500
