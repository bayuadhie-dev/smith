"""
FG Conversion Routes - WIP to Finish Good conversion management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date
from sqlalchemy import func, and_, or_, desc
from models import db
from models.production import (
    FGConversion, FGConversionItem, FGConversionMaterial, FGConversionLossDetail,
    WorkOrder, WIPStock, WIPStockMovement, BillOfMaterials, BOMItem
)
from models.product import Product, Material
from models.warehouse import Inventory, InventoryMovement
from models.quality import QualityInspection
from utils.fifo_helper import fifo_deduct_stock
from utils.fg_conversion_helper import (
    generate_conversion_number,
    calculate_material_requirements,
    auto_create_fg_conversion_after_qc,
    validate_batch_output,
    calculate_loss_cost_impact,
    get_wip_stock_available,
    check_material_availability
)
import traceback

fg_conversion_bp = Blueprint('fg_conversion', __name__)


@fg_conversion_bp.route('/api/fg-conversion/create', methods=['POST'])
@jwt_required()
def create_fg_conversion():
    """Create new FG conversion (auto-triggered after QC or manual)"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        work_order_id = data.get('work_order_id')
        batch_number = data.get('batch_number')
        qc_inspection_id = data.get('qc_inspection_id')
        
        if not work_order_id or not batch_number:
            return jsonify({'success': False, 'message': 'Work Order ID and Batch Number required'}), 400
        
        # Check if conversion already exists for this batch
        existing = FGConversion.query.filter_by(
            work_order_id=work_order_id,
            batch_number=batch_number
        ).first()
        
        if existing:
            return jsonify({
                'success': False,
                'message': 'FG Conversion already exists for this batch',
                'conversion_id': existing.id
            }), 400
        
        # Validate batch output
        is_valid, msg, ingredient_qty, output_qty, tolerance = validate_batch_output(work_order_id, batch_number)
        
        # Get QC status
        qc_status = 'pending'
        qc_date = None
        if qc_inspection_id:
            qc = QualityInspection.query.get(qc_inspection_id)
            if qc:
                qc_status = qc.status  # pass, fail, rework
                qc_date = qc.inspection_date
        
        # Create conversion header
        conversion = FGConversion(
            conversion_number=generate_conversion_number(),
            work_order_id=work_order_id,
            batch_number=batch_number,
            qc_inspection_id=qc_inspection_id,
            qc_status=qc_status,
            qc_date=qc_date,
            conversion_date=datetime.now(),
            conversion_type=data.get('conversion_type', 'auto'),
            status='draft',
            batch_validated=is_valid,
            validation_notes=f"{msg} (Ingredient: {ingredient_qty}, Output: {output_qty}, Variance: {tolerance:.1f}%)",
            created_by=current_user_id,
            notes=data.get('notes')
        )
        
        db.session.add(conversion)
        db.session.flush()  # Get conversion ID
        
        # Process conversion items (WIP → FG)
        items_data = data.get('items', [])
        total_wip = 0
        total_fg = 0
        total_loss = 0
        
        for item_data in items_data:
            wip_product_id = item_data.get('wip_product_id')
            fg_product_id = item_data.get('fg_product_id')
            wip_qty = float(item_data.get('wip_quantity', 0))
            fg_qty = float(item_data.get('fg_quantity', 0))
            loss_qty = wip_qty - fg_qty
            loss_pct = (loss_qty / wip_qty * 100) if wip_qty > 0 else 0
            
            item = FGConversionItem(
                conversion_id=conversion.id,
                wip_product_id=wip_product_id,
                wip_quantity=wip_qty,
                fg_product_id=fg_product_id,
                fg_quantity=fg_qty,
                loss_quantity=loss_qty,
                loss_percentage=loss_pct,
                batch_number=batch_number,
                expiry_date=item_data.get('expiry_date'),
                production_date=item_data.get('production_date', date.today()),
                uom=item_data.get('uom', 'pcs'),
                pack_per_carton=item_data.get('pack_per_carton', 1),
                total_cartons=int(fg_qty / item_data.get('pack_per_carton', 1)) if item_data.get('pack_per_carton') else 0,
                notes=item_data.get('notes')
            )
            
            db.session.add(item)
            
            total_wip += wip_qty
            total_fg += fg_qty
            total_loss += loss_qty
        
        # Update conversion totals
        conversion.total_wip_qty = total_wip
        conversion.total_fg_qty = total_fg
        conversion.total_loss_qty = total_loss
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'FG Conversion created successfully',
            'data': conversion.to_dict(include_details=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating FG conversion: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@fg_conversion_bp.route('/api/fg-conversion/list', methods=['GET'])
@jwt_required()
def list_fg_conversions():
    """List all FG conversions with filters"""
    try:
        # Get query parameters
        status = request.args.get('status')
        batch_number = request.args.get('batch_number')
        wo_number = request.args.get('wo_number')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        # Build query
        query = FGConversion.query
        
        if status:
            query = query.filter(FGConversion.status == status)
        
        if batch_number:
            query = query.filter(FGConversion.batch_number.like(f'%{batch_number}%'))
        
        if wo_number:
            query = query.join(WorkOrder).filter(WorkOrder.wo_number.like(f'%{wo_number}%'))
        
        if start_date:
            query = query.filter(FGConversion.conversion_date >= start_date)
        
        if end_date:
            query = query.filter(FGConversion.conversion_date <= end_date)
        
        # Order by date descending
        query = query.order_by(desc(FGConversion.conversion_date))
        
        # Paginate
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'success': True,
            'data': [conv.to_dict() for conv in pagination.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages
            }
        }), 200
        
    except Exception as e:
        print(f"Error listing FG conversions: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@fg_conversion_bp.route('/api/fg-conversion/<int:conversion_id>', methods=['GET'])
@jwt_required()
def get_fg_conversion(conversion_id):
    """Get FG conversion details"""
    try:
        conversion = FGConversion.query.get(conversion_id)
        
        if not conversion:
            return jsonify({'success': False, 'message': 'FG Conversion not found'}), 404
        
        return jsonify({
            'success': True,
            'data': conversion.to_dict(include_details=True)
        }), 200
        
    except Exception as e:
        print(f"Error getting FG conversion: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@fg_conversion_bp.route('/api/fg-conversion/<int:conversion_id>/complete', methods=['PUT'])
@jwt_required()
def complete_fg_conversion(conversion_id):
    """
    Complete FG conversion:
    1. Deduct WIP from WIP stock
    2. Add FG to FG inventory (with FIFO)
    3. Deduct materials consumed (packaging, labels, etc)
    4. Record loss/reject details
    """
    try:
        current_user_id = get_jwt_identity()
        conversion = FGConversion.query.get(conversion_id)
        
        if not conversion:
            return jsonify({'success': False, 'message': 'FG Conversion not found'}), 404
        
        if conversion.status == 'completed':
            return jsonify({'success': False, 'message': 'Conversion already completed'}), 400
        
        # Process each conversion item
        for item in conversion.items:
            # 1. Deduct WIP from WIP stock
            wip_stock = WIPStock.query.filter_by(product_id=item.wip_product_id).first()
            if wip_stock:
                wip_stock.quantity_pcs -= int(item.wip_quantity)
                wip_stock.quantity_carton = int(wip_stock.quantity_pcs / wip_stock.pack_per_carton) if wip_stock.pack_per_carton > 0 else 0
                wip_stock.last_updated_at = datetime.now()
                
                # Record WIP movement
                wip_movement = WIPStockMovement(
                    wip_stock_id=wip_stock.id,
                    product_id=item.wip_product_id,
                    movement_type='out',
                    quantity_pcs=int(item.wip_quantity),
                    quantity_carton=int(item.wip_quantity / wip_stock.pack_per_carton) if wip_stock.pack_per_carton > 0 else 0,
                    reference_type='fg_conversion',
                    reference_id=conversion.id,
                    reference_number=conversion.conversion_number,
                    balance_pcs=wip_stock.quantity_pcs,
                    balance_carton=wip_stock.quantity_carton,
                    notes=f'WIP to FG conversion - Batch {item.batch_number}',
                    created_by=current_user_id
                )
                db.session.add(wip_movement)
            
            # 2. Add FG to inventory (FIFO)
            # Find or create FG inventory record
            fg_inventory = Inventory.query.filter_by(
                product_id=item.fg_product_id,
                batch_number=item.batch_number,
                is_active=True
            ).first()
            
            if not fg_inventory:
                # Create new inventory record
                # Get default warehouse location
                from models.warehouse import WarehouseLocation
                default_location = WarehouseLocation.query.filter_by(is_default=True).first()
                if not default_location:
                    default_location = WarehouseLocation.query.first()
                
                if not default_location:
                    return jsonify({'success': False, 'message': 'No warehouse location found'}), 400
                
                fg_inventory = Inventory(
                    product_id=item.fg_product_id,
                    location_id=default_location.id,
                    quantity_on_hand=item.fg_quantity,
                    quantity_available=item.fg_quantity,
                    batch_number=item.batch_number,
                    production_date=item.production_date,
                    expiry_date=item.expiry_date,
                    stock_status='released',  # Auto-released after QC pass
                    work_order_id=conversion.work_order_id,
                    qc_inspection_id=conversion.qc_inspection_id,
                    qc_date=conversion.qc_date,
                    created_by=current_user_id
                )
                db.session.add(fg_inventory)
                db.session.flush()
            else:
                # Update existing inventory
                fg_inventory.quantity_on_hand += item.fg_quantity
                fg_inventory.quantity_available += item.fg_quantity
            
            # Record FG inventory movement
            fg_movement = InventoryMovement(
                inventory_id=fg_inventory.id,
                product_id=item.fg_product_id,
                location_id=fg_inventory.location_id,
                movement_type='stock_in',
                movement_date=date.today(),
                quantity=item.fg_quantity,
                reference_number=conversion.conversion_number,
                reference_type='fg_conversion',
                reference_id=conversion.id,
                batch_number=item.batch_number,
                expiry_date=item.expiry_date,
                quantity_before=float(fg_inventory.quantity_on_hand) - float(item.fg_quantity),
                quantity_after=float(fg_inventory.quantity_on_hand),
                notes=f'FG from WIP conversion - Batch {item.batch_number}',
                created_by=current_user_id
            )
            db.session.add(fg_movement)
        
        # 3. Deduct materials consumed (packaging, labels, etc)
        total_material_cost = 0
        for material in conversion.materials:
            if not material.deducted_from_inventory:
                # Use FIFO helper to deduct material
                result = fifo_deduct_stock(
                    material_id=material.material_id,
                    quantity_needed=float(material.quantity_consumed),
                    reference_type='fg_conversion',
                    reference_id=conversion.id,
                    reference_number=conversion.conversion_number,
                    user_id=current_user_id,
                    notes=f'Material consumed for FG conversion {conversion.conversion_number}'
                )
                
                if result['success']:
                    material.deducted_from_inventory = True
                    # Get first movement ID if available
                    if result.get('movements') and len(result['movements']) > 0:
                        # Find the movement record we just created
                        movement = InventoryMovement.query.filter_by(
                            reference_type='fg_conversion',
                            reference_id=conversion.id,
                            material_id=material.material_id
                        ).order_by(InventoryMovement.created_at.desc()).first()
                        if movement:
                            material.inventory_movement_id = movement.id
                    total_material_cost += result.get('total_cost', 0)
                else:
                    # Log warning but don't fail the conversion
                    print(f"Warning: Could not deduct material {material.material_id}: {result.get('error')}")
        
        conversion.total_material_cost = total_material_cost
        
        # 4. Update conversion status
        conversion.status = 'completed'
        conversion.completed_by = current_user_id
        conversion.completed_at = datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'FG Conversion completed successfully',
            'data': conversion.to_dict(include_details=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error completing FG conversion: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@fg_conversion_bp.route('/api/fg-conversion/batch/<batch_number>', methods=['GET'])
@jwt_required()
def get_conversion_by_batch(batch_number):
    """Get FG conversion by batch number"""
    try:
        conversions = FGConversion.query.filter_by(batch_number=batch_number).all()
        
        return jsonify({
            'success': True,
            'data': [conv.to_dict(include_details=True) for conv in conversions]
        }), 200
        
    except Exception as e:
        print(f"Error getting conversion by batch: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@fg_conversion_bp.route('/api/fg-conversion/loss-report', methods=['GET'])
@jwt_required()
def get_loss_report():
    """Get loss/reject report with aggregation"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        loss_type = request.args.get('loss_type')
        loss_category = request.args.get('loss_category')
        
        # Build query
        query = db.session.query(
            FGConversionLossDetail.loss_type,
            FGConversionLossDetail.loss_category,
            FGConversionLossDetail.loss_reason,
            func.sum(FGConversionLossDetail.loss_quantity).label('total_quantity'),
            func.sum(FGConversionLossDetail.total_cost_impact).label('total_cost'),
            func.count(FGConversionLossDetail.id).label('occurrence_count')
        ).join(FGConversion)
        
        if start_date:
            query = query.filter(FGConversion.conversion_date >= start_date)
        
        if end_date:
            query = query.filter(FGConversion.conversion_date <= end_date)
        
        if loss_type:
            query = query.filter(FGConversionLossDetail.loss_type == loss_type)
        
        if loss_category:
            query = query.filter(FGConversionLossDetail.loss_category == loss_category)
        
        # Group by
        query = query.group_by(
            FGConversionLossDetail.loss_type,
            FGConversionLossDetail.loss_category,
            FGConversionLossDetail.loss_reason
        ).order_by(desc('total_cost'))
        
        results = query.all()
        
        # Format results
        report_data = []
        for row in results:
            report_data.append({
                'loss_type': row.loss_type,
                'loss_category': row.loss_category,
                'loss_reason': row.loss_reason,
                'total_quantity': float(row.total_quantity or 0),
                'total_cost': float(row.total_cost or 0),
                'occurrence_count': row.occurrence_count
            })
        
        # Calculate summary
        total_loss_qty = sum(r['total_quantity'] for r in report_data)
        total_loss_cost = sum(r['total_cost'] for r in report_data)
        
        return jsonify({
            'success': True,
            'data': report_data,
            'summary': {
                'total_loss_quantity': total_loss_qty,
                'total_loss_cost': total_loss_cost,
                'total_occurrences': len(report_data)
            }
        }), 200
        
    except Exception as e:
        print(f"Error generating loss report: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500



@fg_conversion_bp.route('/api/fg-conversion/auto-create-from-qc', methods=['POST'])
@jwt_required()
def auto_create_from_qc():
    """Auto-create FG conversion after QC pass"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        qc_inspection_id = data.get('qc_inspection_id')
        if not qc_inspection_id:
            return jsonify({'success': False, 'message': 'QC Inspection ID required'}), 400
        
        success, message, conversion_id = auto_create_fg_conversion_after_qc(
            qc_inspection_id=qc_inspection_id,
            user_id=current_user_id
        )
        
        if success:
            conversion = FGConversion.query.get(conversion_id)
            return jsonify({
                'success': True,
                'message': message,
                'data': conversion.to_dict(include_details=True) if conversion else None
            }), 201
        else:
            return jsonify({'success': False, 'message': message}), 400
        
    except Exception as e:
        print(f"Error auto-creating from QC: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@fg_conversion_bp.route('/api/fg-conversion/calculate-materials', methods=['POST'])
@jwt_required()
def calculate_materials():
    """Calculate material requirements for FG conversion"""
    try:
        data = request.get_json()
        
        fg_product_id = data.get('fg_product_id')
        fg_quantity = data.get('fg_quantity', 0)
        
        if not fg_product_id or fg_quantity <= 0:
            return jsonify({'success': False, 'message': 'FG Product ID and quantity required'}), 400
        
        materials = calculate_material_requirements(fg_product_id, fg_quantity)
        
        # Check availability
        availability = check_material_availability(materials)
        
        return jsonify({
            'success': True,
            'data': {
                'materials': materials,
                'availability': availability
            }
        }), 200
        
    except Exception as e:
        print(f"Error calculating materials: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@fg_conversion_bp.route('/api/fg-conversion/validate-batch', methods=['POST'])
@jwt_required()
def validate_batch():
    """Validate batch output against ingredient quantity"""
    try:
        data = request.get_json()
        
        work_order_id = data.get('work_order_id')
        batch_number = data.get('batch_number')
        
        if not work_order_id or not batch_number:
            return jsonify({'success': False, 'message': 'Work Order ID and Batch Number required'}), 400
        
        is_valid, message, ingredient_qty, output_qty, tolerance_pct = validate_batch_output(
            work_order_id, batch_number
        )
        
        return jsonify({
            'success': True,
            'data': {
                'is_valid': is_valid,
                'message': message,
                'ingredient_qty': ingredient_qty,
                'output_qty': output_qty,
                'tolerance_pct': round(tolerance_pct, 2)
            }
        }), 200
        
    except Exception as e:
        print(f"Error validating batch: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@fg_conversion_bp.route('/api/fg-conversion/wip-stock/<int:product_id>', methods=['GET'])
@jwt_required()
def get_wip_stock(product_id):
    """Get WIP stock availability for a product"""
    try:
        stock = get_wip_stock_available(product_id)
        
        return jsonify({
            'success': True,
            'data': stock
        }), 200
        
    except Exception as e:
        print(f"Error getting WIP stock: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@fg_conversion_bp.route('/api/fg-conversion/check-material-availability', methods=['POST'])
@jwt_required()
def check_materials_availability():
    """Check if materials are available in inventory"""
    try:
        data = request.get_json()
        materials_list = data.get('materials', [])
        
        if not materials_list:
            return jsonify({'success': False, 'message': 'Materials list required'}), 400
        
        availability = check_material_availability(materials_list)
        
        return jsonify({
            'success': True,
            'data': availability
        }), 200
        
    except Exception as e:
        print(f"Error checking material availability: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@fg_conversion_bp.route('/api/fg-conversion/<int:conversion_id>/add-loss', methods=['POST'])
@jwt_required()
def add_loss_detail(conversion_id):
    """Add loss/reject detail to conversion"""
    try:
        conversion = FGConversion.query.get(conversion_id)
        if not conversion:
            return jsonify({'success': False, 'message': 'Conversion not found'}), 404
        
        data = request.get_json()
        
        loss_quantity = float(data.get('loss_quantity', 0))
        if loss_quantity <= 0:
            return jsonify({'success': False, 'message': 'Loss quantity must be greater than 0'}), 400
        
        # Calculate cost impact
        unit_cost, total_cost = calculate_loss_cost_impact(
            loss_quantity=loss_quantity,
            product_id=data.get('product_id'),
            material_id=data.get('material_id')
        )
        
        # Create loss detail
        loss_detail = FGConversionLossDetail(
            conversion_id=conversion_id,
            conversion_item_id=data.get('conversion_item_id'),
            loss_type=data.get('loss_type', 'reject'),
            loss_quantity=loss_quantity,
            uom=data.get('uom', 'pcs'),
            loss_reason=data.get('loss_reason', ''),
            loss_category=data.get('loss_category'),
            unit_cost=unit_cost,
            total_cost_impact=total_cost,
            responsible_dept=data.get('responsible_dept'),
            pic=data.get('pic'),
            corrective_action=data.get('corrective_action'),
            preventive_action=data.get('preventive_action'),
            notes=data.get('notes')
        )
        
        db.session.add(loss_detail)
        
        # Update conversion total loss
        conversion.total_loss_qty = float(conversion.total_loss_qty or 0) + loss_quantity
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Loss detail added successfully',
            'data': loss_detail.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error adding loss detail: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@fg_conversion_bp.route('/api/fg-conversion/dashboard-stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    """Get FG conversion dashboard statistics"""
    try:
        from sqlalchemy import func
        
        # Get date filters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Base query
        query = FGConversion.query
        
        if start_date:
            query = query.filter(FGConversion.conversion_date >= start_date)
        if end_date:
            query = query.filter(FGConversion.conversion_date <= end_date)
        
        # Total conversions
        total_conversions = query.count()
        
        # Conversions by status
        status_counts = db.session.query(
            FGConversion.status,
            func.count(FGConversion.id)
        ).filter(
            FGConversion.conversion_date >= start_date if start_date else True,
            FGConversion.conversion_date <= end_date if end_date else True
        ).group_by(FGConversion.status).all()
        
        # Total quantities
        totals = db.session.query(
            func.sum(FGConversion.total_wip_qty).label('total_wip'),
            func.sum(FGConversion.total_fg_qty).label('total_fg'),
            func.sum(FGConversion.total_loss_qty).label('total_loss'),
            func.sum(FGConversion.total_material_cost).label('total_material_cost')
        ).filter(
            FGConversion.conversion_date >= start_date if start_date else True,
            FGConversion.conversion_date <= end_date if end_date else True
        ).first()
        
        # Loss percentage
        total_wip = float(totals.total_wip or 0)
        total_loss = float(totals.total_loss or 0)
        loss_percentage = (total_loss / total_wip * 100) if total_wip > 0 else 0
        
        # Top loss reasons
        top_losses = db.session.query(
            FGConversionLossDetail.loss_reason,
            func.sum(FGConversionLossDetail.loss_quantity).label('total_qty'),
            func.sum(FGConversionLossDetail.total_cost_impact).label('total_cost')
        ).join(FGConversion).filter(
            FGConversion.conversion_date >= start_date if start_date else True,
            FGConversion.conversion_date <= end_date if end_date else True
        ).group_by(
            FGConversionLossDetail.loss_reason
        ).order_by(
            desc('total_cost')
        ).limit(10).all()
        
        return jsonify({
            'success': True,
            'data': {
                'total_conversions': total_conversions,
                'status_counts': {status: count for status, count in status_counts},
                'totals': {
                    'total_wip_qty': float(totals.total_wip or 0),
                    'total_fg_qty': float(totals.total_fg or 0),
                    'total_loss_qty': float(totals.total_loss or 0),
                    'total_material_cost': float(totals.total_material_cost or 0),
                    'loss_percentage': round(loss_percentage, 2)
                },
                'top_loss_reasons': [
                    {
                        'reason': reason,
                        'quantity': float(qty or 0),
                        'cost': float(cost or 0)
                    }
                    for reason, qty, cost in top_losses
                ]
            }
        }), 200
        
    except Exception as e:
        print(f"Error getting dashboard stats: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500
