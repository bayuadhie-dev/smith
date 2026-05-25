"""
WMS Advanced Routes — Warehouse Management System
Full integration with Production, Materials, WIP, and Finished Goods.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import (
    db, Inventory, InventoryMovement, WarehouseZone, WarehouseLocation,
    Product, Material, WorkOrder, ProductionRecord, Machine,
    BillOfMaterials, BOMItem, WIPStock, WIPStockMovement, PackingList,
    WorkOrderBOMItem
)
from models.wms_advanced import (
    MaterialConsumption, InventoryTransaction, PickList, PickListItem,
    StockTransferOrder, StockTransferItem, CycleCountSchedule
)
from sqlalchemy import func, or_, and_, desc, case
from sqlalchemy.orm import joinedload
from datetime import datetime, date, timedelta
from utils.timezone import get_local_now, get_local_today
import math

wms_advanced_bp = Blueprint('wms_advanced', __name__, url_prefix='/api/wms')


# ============================================================
# HELPER
# ============================================================
_txn_counter = 0

def generate_txn_number(prefix='TXN'):
    global _txn_counter
    _txn_counter += 1
    return f"{prefix}-{get_local_now().strftime('%Y%m%d%H%M%S')}-{_txn_counter:04d}"


# ============================================================
# 1. WMS DASHBOARD
# ============================================================
@wms_advanced_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def wms_dashboard():
    """WMS Dashboard - aggregated KPIs"""
    try:
        today = get_local_today()

        # Total inventory value
        inv_summary = db.session.query(
            func.count(Inventory.id).label('total_items'),
            func.sum(Inventory.quantity_on_hand).label('total_qty'),
        ).filter(Inventory.is_active == True).first()

        # Zone summary
        zones = db.session.query(
            WarehouseZone.name,
            WarehouseZone.material_type,
            func.count(WarehouseLocation.id).label('location_count'),
            func.sum(WarehouseLocation.capacity).label('total_capacity'),
            func.sum(WarehouseLocation.occupied).label('total_occupied'),
        ).outerjoin(WarehouseLocation, WarehouseZone.id == WarehouseLocation.zone_id)\
         .filter(WarehouseZone.is_active == True)\
         .group_by(WarehouseZone.id).all()

        zone_data = []
        for z in zones:
            cap = float(z.total_capacity or 0)
            occ = float(z.total_occupied or 0)
            zone_data.append({
                'name': z.name,
                'material_type': z.material_type,
                'location_count': z.location_count,
                'total_capacity': cap,
                'total_occupied': occ,
                'utilization': round(occ / cap * 100, 1) if cap > 0 else 0,
            })

        # Low stock alerts
        low_stock = db.session.query(func.count(Inventory.id)).filter(
            Inventory.is_active == True,
            Inventory.quantity_on_hand > 0,
            Inventory.quantity_on_hand <= Inventory.min_stock_level,
            Inventory.min_stock_level > 0
        ).scalar() or 0

        # Pending transfers
        pending_transfers = db.session.query(func.count(StockTransferOrder.id)).filter(
            StockTransferOrder.status.in_(['draft', 'approved'])
        ).scalar() or 0

        # Active pick lists
        active_picks = db.session.query(func.count(PickList.id)).filter(
            PickList.status.in_(['assigned', 'in_progress'])
        ).scalar() or 0

        # Recent transactions (today)
        today_txns = db.session.query(func.count(InventoryTransaction.id)).filter(
            func.date(InventoryTransaction.transaction_date) == today
        ).scalar() or 0

        # Material consumption variance - try WMS table first, fallback to WO BOM
        variance_data = db.session.query(
            func.count(MaterialConsumption.id).label('total'),
            func.sum(case(
                (MaterialConsumption.variance > 0, 1), else_=0
            )).label('over_consumed'),
        ).filter(MaterialConsumption.status.in_(['issued', 'completed'])).first()

        # Fallback: if no WMS consumption data, get from work_order_bom_items then master BOM
        mc_total = variance_data.total if variance_data else 0
        mc_over = int(variance_data.over_consumed or 0) if variance_data else 0
        if mc_total == 0:
            bom_variance = db.session.query(
                func.count(WorkOrderBOMItem.id).label('total'),
                func.sum(case(
                    (WorkOrderBOMItem.quantity_actual > WorkOrderBOMItem.quantity_planned, 1), else_=0
                )).label('over_consumed'),
            ).filter(
                WorkOrderBOMItem.quantity_actual.isnot(None),
                WorkOrderBOMItem.quantity_actual > 0
            ).first()
            mc_total = bom_variance.total if bom_variance else 0
            mc_over = int(bom_variance.over_consumed or 0) if bom_variance else 0

        # Fallback 2: count from master BOM items linked to WOs (via bom_id OR product_id)
        if mc_total == 0:
            mc_total = db.session.query(func.count(BOMItem.id)).join(
                BillOfMaterials, BOMItem.bom_id == BillOfMaterials.id
            ).join(
                WorkOrder, or_(
                    WorkOrder.bom_id == BillOfMaterials.id,
                    and_(WorkOrder.bom_id.is_(None), WorkOrder.product_id == BillOfMaterials.product_id)
                )
            ).scalar() or 0

        # WIP stock summary
        wip_total = db.session.query(
            func.count(WIPStock.id).label('products'),
            func.sum(WIPStock.quantity_carton).label('cartons'),
        ).filter(WIPStock.quantity_carton > 0).first()

        return jsonify({
            'inventory': {
                'total_items': inv_summary.total_items or 0,
                'total_quantity': float(inv_summary.total_qty or 0),
            },
            'zones': zone_data,
            'alerts': {
                'low_stock': low_stock,
                'pending_transfers': pending_transfers,
                'active_picks': active_picks,
            },
            'today': {
                'transactions': today_txns,
            },
            'material_consumption': {
                'total_tracked': mc_total,
                'over_consumed': mc_over,
            },
            'wip': {
                'products': wip_total.products if wip_total else 0,
                'total_cartons': int(wip_total.cartons or 0) if wip_total else 0,
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================
# 2. STOCK BY WORK ORDER
# ============================================================
@wms_advanced_bp.route('/stock-by-wo', methods=['GET'])
@jwt_required()
def stock_by_work_order():
    """Get inventory grouped by Work Order — shows output per WO"""
    try:
        wo_number = request.args.get('wo_number', '')
        status = request.args.get('status', '')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        query = db.session.query(
            WorkOrder.id,
            WorkOrder.wo_number,
            WorkOrder.status,
            Product.name.label('product_name'),
            Product.code.label('product_code'),
            WorkOrder.quantity.label('wo_quantity'),
            func.coalesce(func.sum(Inventory.quantity_on_hand), 0).label('fg_stock'),
            Machine.name.label('machine_name'),
        ).join(Product, WorkOrder.product_id == Product.id)\
         .outerjoin(Machine, WorkOrder.machine_id == Machine.id)\
         .outerjoin(Inventory, and_(
             Inventory.work_order_id == WorkOrder.id,
             Inventory.is_active == True
         ))

        if wo_number:
            query = query.filter(WorkOrder.wo_number.ilike(f'%{wo_number}%'))
        if status:
            query = query.filter(WorkOrder.status == status)

        query = query.group_by(
            WorkOrder.id, WorkOrder.wo_number, WorkOrder.status,
            Product.name, Product.code, WorkOrder.quantity, Machine.name
        ).order_by(desc(WorkOrder.id))

        total = query.count()
        items = query.offset((page - 1) * per_page).limit(per_page).all()

        results = []
        for item in items:
            # Get WIP stock for this product
            wip = WIPStock.query.join(Product).filter(
                Product.code == item.product_code
            ).first()

            # Get material consumption - try WMS table first
            consumption = db.session.query(
                func.count(MaterialConsumption.id).label('materials_count'),
                func.sum(MaterialConsumption.quantity_planned).label('planned'),
                func.sum(MaterialConsumption.quantity_actual).label('actual'),
            ).filter(MaterialConsumption.work_order_id == item.id).first()

            mat_count = consumption.materials_count if consumption else 0
            mat_planned = float(consumption.planned or 0) if consumption else 0
            mat_actual = float(consumption.actual or 0) if consumption else 0

            # Fallback 1: work_order_bom_items
            if mat_count == 0:
                bom_consumption = db.session.query(
                    func.count(WorkOrderBOMItem.id).label('materials_count'),
                    func.sum(WorkOrderBOMItem.quantity_planned).label('planned'),
                    func.sum(WorkOrderBOMItem.quantity_actual).label('actual'),
                ).filter(WorkOrderBOMItem.work_order_id == item.id).first()
                mat_count = bom_consumption.materials_count if bom_consumption else 0
                mat_planned = float(bom_consumption.planned or 0) if bom_consumption else 0
                mat_actual = float(bom_consumption.actual or 0) if bom_consumption else 0

            # Fallback 2: master BOM (bom_items via bom_id or product_id)
            if mat_count == 0:
                wo_obj = db.session.get(WorkOrder, item.id)
                if wo_obj:
                    bom = None
                    if wo_obj.bom_id:
                        bom = db.session.get(BillOfMaterials, wo_obj.bom_id)
                    if not bom and wo_obj.product_id:
                        bom = BillOfMaterials.query.filter_by(
                            product_id=wo_obj.product_id, is_active=True
                        ).first()
                    if bom:
                        wo_qty = float(item.wo_quantity or 0)
                        bom_ppc = float(bom.pack_per_carton) if bom.pack_per_carton else float(wo_obj.pack_per_carton or 1)
                        total_cartons = math.ceil(wo_qty / bom_ppc) if bom_ppc > 0 else 0
                        master_items = BOMItem.query.filter_by(bom_id=bom.id).all()
                        mat_count = len(master_items)
                        mat_planned = sum(float(bi.quantity or 0) * total_cartons for bi in master_items)
                        mat_actual = 0

            results.append({
                'wo_id': item.id,
                'wo_number': item.wo_number,
                'status': item.status,
                'product_name': item.product_name,
                'product_code': item.product_code,
                'wo_quantity': float(item.wo_quantity or 0),
                'fg_stock': float(item.fg_stock or 0),
                'wip_cartons': wip.quantity_carton if wip else 0,
                'wip_pcs': wip.quantity_pcs if wip else 0,
                'machine_name': item.machine_name,
                'materials_count': mat_count,
                'material_planned': mat_planned,
                'material_actual': mat_actual,
            })

        return jsonify({
            'work_orders': results,
            'pagination': {
                'page': page, 'per_page': per_page,
                'total': total, 'pages': math.ceil(total / per_page) if per_page else 0,
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/stock-by-wo/<int:wo_id>', methods=['GET'])
@jwt_required()
def stock_by_wo_detail(wo_id):
    """Detailed stock breakdown for a specific Work Order"""
    try:
        wo = db.session.get(WorkOrder, wo_id)
        if not wo:
            return jsonify({'error': 'Work order not found'}), 404

        # FG inventory linked to this WO
        fg_items = Inventory.query.filter_by(
            work_order_id=wo_id, is_active=True
        ).all()

        # Material consumption from WMS table
        consumptions = MaterialConsumption.query.filter_by(
            work_order_id=wo_id
        ).all()

        # Fallback 1: work_order_bom_items
        consumption_data = [c.to_dict() for c in consumptions]
        if not consumption_data:
            wo_bom_items = WorkOrderBOMItem.query.filter_by(
                work_order_id=wo_id
            ).order_by(WorkOrderBOMItem.line_number).all()
            consumption_data = [{
                'id': bi.id,
                'work_order_id': bi.work_order_id,
                'material_id': bi.material_id,
                'material_code': bi.item_code,
                'material_name': bi.item_name,
                'material_uom': bi.uom,
                'quantity_planned': float(bi.quantity_planned or 0),
                'quantity_actual': float(bi.quantity_actual or 0),
                'variance': float(bi.quantity_variance or 0),
                'variance_percentage': round(
                    ((float(bi.quantity_actual or 0) - float(bi.quantity_planned or 0)) / float(bi.quantity_planned) * 100), 1
                ) if bi.quantity_planned and float(bi.quantity_planned) > 0 else 0,
                'from_batch_number': None,
                'from_location': None,
                'status': 'completed' if bi.quantity_actual and float(bi.quantity_actual) > 0 else 'planned',
                'issued_by': None,
                'issued_at': None,
                'notes': bi.notes,
                'created_at': bi.created_at.isoformat() if bi.created_at else None,
                'source': 'wo_bom_items',
            } for bi in wo_bom_items]

        # Fallback 2: master BOM (bom_items via bom_id or product_id)
        if not consumption_data:
            bom = None
            if wo.bom_id:
                bom = db.session.get(BillOfMaterials, wo.bom_id)
            if not bom and wo.product_id:
                bom = BillOfMaterials.query.filter_by(
                    product_id=wo.product_id, is_active=True
                ).first()

            if bom:
                wo_qty = float(wo.quantity or 0)
                bom_ppc = float(bom.pack_per_carton) if bom.pack_per_carton else float(wo.pack_per_carton or 1)
                total_cartons = math.ceil(wo_qty / bom_ppc) if bom_ppc > 0 else 0

                master_items = BOMItem.query.filter_by(bom_id=bom.id).order_by(BOMItem.line_number).all()
                consumption_data = [{
                    'id': bi.id,
                    'work_order_id': wo_id,
                    'material_id': bi.material_id,
                    'material_code': bi.item_code,
                    'material_name': bi.item_name,
                    'material_uom': bi.uom,
                    'quantity_planned': round(float(bi.quantity or 0) * total_cartons, 2),
                    'quantity_actual': 0,
                    'variance': 0,
                    'variance_percentage': 0,
                    'from_batch_number': None,
                    'from_location': None,
                    'status': 'planned',
                    'issued_by': None,
                    'issued_at': None,
                    'notes': bi.notes,
                    'created_at': bi.created_at.isoformat() if bi.created_at else None,
                    'source': 'master_bom',
                } for bi in master_items]

        # Production records
        records = ProductionRecord.query.filter_by(
            work_order_id=wo_id
        ).order_by(ProductionRecord.production_date.desc()).all()

        # WIP movements for this WO
        wip_movements = WIPStockMovement.query.filter_by(
            reference_type='work_order', reference_id=wo_id
        ).order_by(WIPStockMovement.created_at.desc()).all()

        # Inventory transactions - try WMS table first, fallback to inventory_movements
        txns = InventoryTransaction.query.filter_by(
            work_order_id=wo_id
        ).order_by(InventoryTransaction.transaction_date.desc()).limit(50).all()
        txn_data = [t.to_dict() for t in txns]

        if not txn_data:
            legacy_mvs = InventoryMovement.query.filter_by(
                reference_type='work_order', reference_id=wo_id
            ).order_by(InventoryMovement.created_at.desc()).limit(50).all()
            txn_data = [{
                'id': mv.id,
                'transaction_number': mv.reference_number or f'MV-{mv.id:06d}',
                'transaction_type': mv.movement_type,
                'transaction_date': mv.created_at.isoformat() if mv.created_at else None,
                'item_type': 'product' if mv.product_id else 'material',
                'item_code': '',
                'item_name': (mv.product.name if mv.product else (mv.material.name if mv.material else '')),
                'product_id': mv.product_id,
                'material_id': mv.material_id,
                'quantity': float(mv.quantity or 0),
                'uom': None,
                'direction': 'out' if mv.movement_type in ('stock_out', 'issue') else 'in',
                'from_location': None,
                'to_location': None,
                'batch_number': mv.batch_number,
                'lot_number': mv.lot_number,
                'reference_type': mv.reference_type,
                'reference_id': mv.reference_id,
                'reference_number': mv.reference_number,
                'work_order_id': mv.reference_id if mv.reference_type == 'work_order' else None,
                'wo_number': wo.wo_number,
                'machine_name': None,
                'shift': None,
                'unit_cost': float(mv.unit_cost) if mv.unit_cost else None,
                'total_cost': float(mv.total_cost) if mv.total_cost else None,
                'balance_before': float(mv.quantity_before) if mv.quantity_before is not None else None,
                'balance_after': float(mv.quantity_after) if mv.quantity_after is not None else None,
                'status': 'completed',
                'notes': mv.notes,
                'created_by': mv.created_by_user.full_name if mv.created_by_user else None,
                'created_at': mv.created_at.isoformat() if mv.created_at else None,
                'source': 'inventory_movements',
            } for mv in legacy_mvs]

        product = db.session.get(Product, wo.product_id) if wo.product_id else None

        return jsonify({
            'work_order': {
                'id': wo.id,
                'wo_number': wo.wo_number,
                'status': wo.status,
                'product_name': product.name if product else None,
                'product_code': product.code if product else None,
                'quantity': float(wo.quantity or 0),
                'quantity_produced': float(wo.quantity_produced or 0),
                'quantity_good': float(wo.quantity_good or 0),
                'quantity_scrap': float(wo.quantity_scrap or 0),
                'machine': wo.machine.name if wo.machine_id and wo.machine else None,
            },
            'fg_inventory': [{
                'id': inv.id,
                'location': inv.location.location_code if inv.location else None,
                'quantity': float(inv.quantity_on_hand or 0),
                'batch_number': inv.batch_number,
                'stock_status': inv.stock_status,
                'production_date': inv.production_date.isoformat() if inv.production_date else None,
            } for inv in fg_items],
            'material_consumption': consumption_data,
            'production_records': [{
                'id': r.id,
                'production_date': r.production_date.isoformat() if r.production_date else None,
                'shift': r.shift,
                'quantity_good': float(r.quantity_good or 0),
                'quantity_reject': float(r.quantity_scrap or 0),
                'machine': r.machine.name if r.machine_id and r.machine else None,
            } for r in records],
            'wip_movements': [m.to_dict() for m in wip_movements],
            'transactions': txn_data,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================
# 3. MATERIAL CONSUMPTION TRACKING
# ============================================================
@wms_advanced_bp.route('/material-consumption', methods=['GET'])
@jwt_required()
def get_material_consumptions():
    """List material consumptions with filters"""
    try:
        wo_id = request.args.get('work_order_id', type=int)
        material_id = request.args.get('material_id', type=int)
        status = request.args.get('status')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        query = MaterialConsumption.query

        if wo_id:
            query = query.filter_by(work_order_id=wo_id)
        if material_id:
            query = query.filter_by(material_id=material_id)
        if status:
            query = query.filter_by(status=status)

        query = query.order_by(desc(MaterialConsumption.created_at))
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        consumptions = [c.to_dict() for c in pagination.items]
        total_count = pagination.total

        # Fallback 1: work_order_bom_items
        if total_count == 0:
            bom_query = db.session.query(
                WorkOrderBOMItem,
                WorkOrder.wo_number
            ).join(WorkOrder, WorkOrderBOMItem.work_order_id == WorkOrder.id)

            if wo_id:
                bom_query = bom_query.filter(WorkOrderBOMItem.work_order_id == wo_id)

            bom_query = bom_query.order_by(desc(WorkOrderBOMItem.created_at))
            total_count = bom_query.count()
            bom_items = bom_query.offset((page - 1) * per_page).limit(per_page).all()

            consumptions = [{
                'id': bi.WorkOrderBOMItem.id,
                'work_order_id': bi.WorkOrderBOMItem.work_order_id,
                'wo_number': bi.wo_number,
                'material_id': bi.WorkOrderBOMItem.material_id,
                'material_code': bi.WorkOrderBOMItem.item_code,
                'material_name': bi.WorkOrderBOMItem.item_name,
                'material_uom': bi.WorkOrderBOMItem.uom,
                'quantity_planned': float(bi.WorkOrderBOMItem.quantity_planned or 0),
                'quantity_actual': float(bi.WorkOrderBOMItem.quantity_actual or 0),
                'variance': float(bi.WorkOrderBOMItem.quantity_variance or 0),
                'variance_percentage': round(
                    ((float(bi.WorkOrderBOMItem.quantity_actual or 0) - float(bi.WorkOrderBOMItem.quantity_planned or 0))
                     / float(bi.WorkOrderBOMItem.quantity_planned) * 100), 1
                ) if bi.WorkOrderBOMItem.quantity_planned and float(bi.WorkOrderBOMItem.quantity_planned) > 0 else 0,
                'from_batch_number': None,
                'from_location': None,
                'status': 'completed' if bi.WorkOrderBOMItem.quantity_actual and float(bi.WorkOrderBOMItem.quantity_actual) > 0 else 'planned',
                'issued_by': None,
                'issued_at': None,
                'notes': bi.WorkOrderBOMItem.notes,
                'created_at': bi.WorkOrderBOMItem.created_at.isoformat() if bi.WorkOrderBOMItem.created_at else None,
                'source': 'wo_bom_items',
            } for bi in bom_items]

        # Fallback 2: master BOM (bom_items via bom_id or product_id)
        if total_count == 0:
            wo_query = WorkOrder.query
            if wo_id:
                wo_query = wo_query.filter_by(id=wo_id)
            wo_query = wo_query.order_by(desc(WorkOrder.id))

            all_items = []
            for w in wo_query.all():
                bom_obj = None
                if w.bom_id:
                    bom_obj = db.session.get(BillOfMaterials, w.bom_id)
                if not bom_obj and w.product_id:
                    bom_obj = BillOfMaterials.query.filter_by(
                        product_id=w.product_id, is_active=True
                    ).first()
                if not bom_obj:
                    continue
                bom_ppc = float(bom_obj.pack_per_carton) if bom_obj.pack_per_carton else float(w.pack_per_carton or 1)
                wo_qty = float(w.quantity or 0)
                total_cartons = math.ceil(wo_qty / bom_ppc) if bom_ppc > 0 else 0

                for bi in bom_obj.items:
                    all_items.append({
                        'id': bi.id,
                        'work_order_id': w.id,
                        'wo_number': w.wo_number,
                        'material_id': bi.material_id,
                        'material_code': bi.item_code,
                        'material_name': bi.item_name,
                        'material_uom': bi.uom,
                        'quantity_planned': round(float(bi.quantity or 0) * total_cartons, 2),
                        'quantity_actual': 0,
                        'variance': 0,
                        'variance_percentage': 0,
                        'from_batch_number': None,
                        'from_location': None,
                        'status': 'planned',
                        'issued_by': None,
                        'issued_at': None,
                        'notes': bi.notes,
                        'created_at': bi.created_at.isoformat() if bi.created_at else None,
                        'source': 'master_bom',
                    })

            total_count = len(all_items)
            start = (page - 1) * per_page
            consumptions = all_items[start:start + per_page]

        return jsonify({
            'consumptions': consumptions,
            'pagination': {
                'page': page, 'per_page': per_page,
                'total': total_count,
                'pages': math.ceil(total_count / per_page) if per_page else 0,
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/material-consumption/generate/<int:wo_id>', methods=['POST'])
@jwt_required()
def generate_material_consumption(wo_id):
    """Generate planned material consumption from BOM for a Work Order"""
    try:
        wo = db.session.get(WorkOrder, wo_id)
        if not wo:
            return jsonify({'error': 'Work order not found'}), 404

        # Check if already generated
        existing = MaterialConsumption.query.filter_by(work_order_id=wo_id).count()
        if existing > 0:
            return jsonify({'error': 'Material consumption already generated for this WO', 'count': existing}), 400

        # Get BOM for this product
        bom = BillOfMaterials.query.filter_by(
            product_id=wo.product_id, is_active=True
        ).first()
        if not bom:
            return jsonify({'error': 'No active BOM found for this product'}), 404

        wo_qty = float(wo.quantity or 0)
        bom_ppc = float(bom.pack_per_carton) if bom.pack_per_carton else 1
        total_cartons = math.ceil(wo_qty / bom_ppc) if bom_ppc > 0 else 0

        created = []
        for item in bom.items:
            qty_per_ctn = float(item.quantity) if item.quantity else 0
            qty_planned = qty_per_ctn * total_cartons

            mc = MaterialConsumption(
                work_order_id=wo_id,
                material_id=item.material_id,
                bom_item_id=item.id,
                quantity_planned=qty_planned,
                uom=item.uom if hasattr(item, 'uom') else None,
                status='planned',
            )
            db.session.add(mc)
            created.append(mc)

        db.session.commit()
        return jsonify({
            'message': f'Generated {len(created)} material consumption records',
            'count': len(created),
            'consumptions': [c.to_dict() for c in created]
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/material-consumption/<int:mc_id>/issue', methods=['POST'])
@jwt_required()
def issue_material(mc_id):
    """Issue material - update actual quantity consumed"""
    try:
        mc = db.session.get(MaterialConsumption, mc_id)
        if not mc:
            return jsonify({'error': 'Consumption record not found'}), 404

        data = request.get_json()
        quantity = float(data.get('quantity', 0))
        if quantity <= 0:
            return jsonify({'error': 'Quantity must be > 0'}), 400

        user_id = get_jwt_identity()

        mc.quantity_actual += quantity
        mc.compute_variance()
        mc.issued_by = user_id
        mc.issued_at = get_local_now()
        mc.from_batch_number = data.get('batch_number')
        mc.from_location_id = data.get('location_id')
        mc.notes = data.get('notes')

        if mc.quantity_actual >= mc.quantity_planned:
            mc.status = 'completed'
        else:
            mc.status = 'partial'

        # Record inventory transaction
        txn = InventoryTransaction(
            transaction_number=generate_txn_number('MI'),
            transaction_type='material_issue',
            transaction_date=get_local_now(),
            material_id=mc.material_id,
            quantity=quantity,
            direction='out',
            from_location_id=data.get('location_id'),
            batch_number=data.get('batch_number'),
            reference_type='work_order',
            reference_id=mc.work_order_id,
            reference_number=mc.work_order.wo_number if mc.work_order else None,
            work_order_id=mc.work_order_id,
            status='completed',
            notes=f'Material issue for WO',
            created_by=user_id,
        )
        db.session.add(txn)
        db.session.commit()

        return jsonify({
            'message': 'Material issued successfully',
            'consumption': mc.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================================
# 4. INVENTORY TRANSACTIONS (Unified Log)
# ============================================================
@wms_advanced_bp.route('/transactions', methods=['GET'])
@jwt_required()
def get_transactions():
    """Get inventory transactions with full filtering"""
    try:
        txn_type = request.args.get('type')
        wo_id = request.args.get('work_order_id', type=int)
        product_id = request.args.get('product_id', type=int)
        material_id = request.args.get('material_id', type=int)
        direction = request.args.get('direction')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        search = request.args.get('search', '')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        query = InventoryTransaction.query

        if txn_type:
            query = query.filter_by(transaction_type=txn_type)
        if wo_id:
            query = query.filter_by(work_order_id=wo_id)
        if product_id:
            query = query.filter_by(product_id=product_id)
        if material_id:
            query = query.filter_by(material_id=material_id)
        if direction:
            query = query.filter_by(direction=direction)
        if start_date:
            query = query.filter(InventoryTransaction.transaction_date >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(InventoryTransaction.transaction_date <= datetime.fromisoformat(end_date))
        if search:
            query = query.filter(or_(
                InventoryTransaction.transaction_number.ilike(f'%{search}%'),
                InventoryTransaction.reference_number.ilike(f'%{search}%'),
                InventoryTransaction.batch_number.ilike(f'%{search}%'),
            ))

        query = query.order_by(desc(InventoryTransaction.transaction_date))
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'transactions': [t.to_dict() for t in pagination.items],
            'pagination': {
                'page': pagination.page, 'per_page': pagination.per_page,
                'total': pagination.total, 'pages': pagination.pages,
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/transactions/<int:txn_id>', methods=['GET'])
@jwt_required()
def get_transaction_detail(txn_id):
    """Get single transaction detail"""
    try:
        txn = db.session.get(InventoryTransaction, txn_id)
        if not txn:
            return jsonify({'error': 'Transaction not found'}), 404

        data = txn.to_dict()

        # Enrich with extra detail
        if txn.work_order_id:
            wo = db.session.get(WorkOrder, txn.work_order_id)
            if wo:
                data['wo_number'] = wo.wo_number
                data['wo_status'] = wo.status
                data['wo_quantity'] = float(wo.quantity or 0)

        if txn.product_id:
            product = db.session.get(Product, txn.product_id)
            if product:
                data['product_name'] = product.name
                data['product_code'] = product.code if hasattr(product, 'code') else ''

        if txn.material_id:
            mat = db.session.get(Material, txn.material_id)
            if mat:
                data['material_name'] = mat.name
                data['material_code'] = mat.code

        return jsonify({'transaction': data}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/transactions', methods=['POST'])
@jwt_required()
def create_transaction():
    """Create manual inventory transaction"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()

        txn = InventoryTransaction(
            transaction_number=generate_txn_number('MAN'),
            transaction_type=data.get('transaction_type', 'adjustment'),
            transaction_date=get_local_now(),
            product_id=data.get('product_id'),
            material_id=data.get('material_id'),
            quantity=data['quantity'],
            uom=data.get('uom'),
            direction=data.get('direction', 'in'),
            from_location_id=data.get('from_location_id'),
            to_location_id=data.get('to_location_id'),
            batch_number=data.get('batch_number'),
            lot_number=data.get('lot_number'),
            reference_type=data.get('reference_type', 'manual'),
            reference_number=data.get('reference_number'),
            work_order_id=data.get('work_order_id'),
            notes=data.get('notes'),
            created_by=user_id,
        )
        db.session.add(txn)
        db.session.commit()

        return jsonify({
            'message': 'Transaction created',
            'transaction': txn.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================================
# 5. PICK LISTS
# ============================================================
@wms_advanced_bp.route('/pick-lists', methods=['GET'])
@jwt_required()
def get_pick_lists():
    """List all pick lists"""
    try:
        status = request.args.get('status')
        pick_type = request.args.get('type')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        query = PickList.query
        if status:
            query = query.filter_by(status=status)
        if pick_type:
            query = query.filter_by(pick_type=pick_type)

        query = query.order_by(desc(PickList.created_at))
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'pick_lists': [p.to_dict() for p in pagination.items],
            'pagination': {
                'page': pagination.page, 'per_page': pagination.per_page,
                'total': pagination.total, 'pages': pagination.pages,
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/pick-lists', methods=['POST'])
@jwt_required()
def create_pick_list():
    """Create a new pick list"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()

        pl = PickList(
            pick_number=generate_txn_number('PL'),
            pick_type=data.get('pick_type', 'material_issue'),
            reference_type=data.get('reference_type'),
            reference_id=data.get('reference_id'),
            reference_number=data.get('reference_number'),
            assigned_to=data.get('assigned_to'),
            priority=data.get('priority', 'normal'),
            pick_date=get_local_now(),
            notes=data.get('notes'),
            created_by=user_id,
        )
        db.session.add(pl)
        db.session.flush()

        # Add items
        items = data.get('items', [])
        for idx, item_data in enumerate(items):
            pli = PickListItem(
                pick_list_id=pl.id,
                product_id=item_data.get('product_id'),
                material_id=item_data.get('material_id'),
                quantity_requested=item_data['quantity'],
                uom=item_data.get('uom'),
                location_id=item_data.get('location_id'),
                batch_number=item_data.get('batch_number'),
                sequence=idx + 1,
            )
            db.session.add(pli)

        pl.total_items = len(items)
        pl.status = 'assigned' if pl.assigned_to else 'draft'
        db.session.commit()

        return jsonify({
            'message': 'Pick list created',
            'pick_list': pl.to_dict(include_items=True)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/pick-lists/<int:pl_id>', methods=['GET'])
@jwt_required()
def get_pick_list_detail(pl_id):
    """Get pick list detail with items"""
    try:
        pl = db.session.get(PickList, pl_id)
        if not pl:
            return jsonify({'error': 'Pick list not found'}), 404
        return jsonify(pl.to_dict(include_items=True)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/pick-lists/<int:pl_id>/pick-item/<int:item_id>', methods=['PUT'])
@jwt_required()
def pick_item(pl_id, item_id):
    """Mark a pick list item as picked"""
    try:
        pli = PickListItem.query.filter_by(id=item_id, pick_list_id=pl_id).first()
        if not pli:
            return jsonify({'error': 'Pick list item not found'}), 404

        data = request.get_json()
        user_id = get_jwt_identity()

        pli.quantity_picked = data.get('quantity_picked', pli.quantity_requested)
        pli.picked_by = user_id
        pli.picked_at = get_local_now()
        pli.status = 'picked' if float(pli.quantity_picked) >= float(pli.quantity_requested) else 'short'
        pli.notes = data.get('notes')

        # Update pick list progress
        pl = db.session.get(PickList, pl_id)
        if pl:
            picked = PickListItem.query.filter(
                PickListItem.pick_list_id == pl_id,
                PickListItem.status.in_(['picked', 'short'])
            ).count()
            pl.picked_items = picked
            if pl.status == 'assigned':
                pl.status = 'in_progress'
                pl.started_at = get_local_now()
            if picked >= pl.total_items:
                pl.status = 'completed'
                pl.completed_at = get_local_now()

        db.session.commit()
        return jsonify({'message': 'Item picked', 'item': pli.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================================
# 6. STOCK TRANSFERS
# ============================================================
@wms_advanced_bp.route('/transfers', methods=['GET'])
@jwt_required()
def get_transfers():
    """List stock transfer orders"""
    try:
        status = request.args.get('status')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        query = StockTransferOrder.query
        if status:
            query = query.filter_by(status=status)
        query = query.order_by(desc(StockTransferOrder.created_at))
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'transfers': [t.to_dict() for t in pagination.items],
            'pagination': {
                'page': pagination.page, 'per_page': pagination.per_page,
                'total': pagination.total, 'pages': pagination.pages,
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/transfers', methods=['POST'])
@jwt_required()
def create_transfer():
    """Create stock transfer order"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()

        sto = StockTransferOrder(
            transfer_number=generate_txn_number('STO'),
            from_zone_id=data['from_zone_id'],
            to_zone_id=data['to_zone_id'],
            from_location_id=data.get('from_location_id'),
            to_location_id=data.get('to_location_id'),
            reason=data.get('reason', 'relocation'),
            priority=data.get('priority', 'normal'),
            requested_by=user_id,
            notes=data.get('notes'),
        )
        db.session.add(sto)
        db.session.flush()

        items = data.get('items', [])
        for item_data in items:
            sti = StockTransferItem(
                transfer_order_id=sto.id,
                product_id=item_data.get('product_id'),
                material_id=item_data.get('material_id'),
                quantity=item_data['quantity'],
                uom=item_data.get('uom'),
                batch_number=item_data.get('batch_number'),
            )
            db.session.add(sti)

        sto.total_items = len(items)
        db.session.commit()

        return jsonify({
            'message': 'Transfer order created',
            'transfer': sto.to_dict(include_items=True)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/transfers/<int:sto_id>/approve', methods=['POST'])
@jwt_required()
def approve_transfer(sto_id):
    """Approve a stock transfer order"""
    try:
        sto = db.session.get(StockTransferOrder, sto_id)
        if not sto:
            return jsonify({'error': 'Transfer not found'}), 404
        if sto.status != 'draft':
            return jsonify({'error': f'Cannot approve transfer with status: {sto.status}'}), 400

        user_id = get_jwt_identity()
        sto.status = 'approved'
        sto.approved_by = user_id
        sto.approved_at = get_local_now()
        db.session.commit()

        return jsonify({'message': 'Transfer approved', 'transfer': sto.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/transfers/<int:sto_id>/execute', methods=['POST'])
@jwt_required()
def execute_transfer(sto_id):
    """Execute an approved stock transfer"""
    try:
        sto = db.session.get(StockTransferOrder, sto_id)
        if not sto:
            return jsonify({'error': 'Transfer not found'}), 404
        if sto.status != 'approved':
            return jsonify({'error': 'Transfer must be approved first'}), 400

        user_id = get_jwt_identity()

        for item in sto.items.all():
            item.quantity_transferred = item.quantity
            item.status = 'transferred'

            # Record transaction
            txn = InventoryTransaction(
                transaction_number=generate_txn_number('TRF'),
                transaction_type='transfer',
                transaction_date=get_local_now(),
                product_id=item.product_id,
                material_id=item.material_id,
                quantity=float(item.quantity),
                direction='out',
                from_location_id=sto.from_location_id,
                to_location_id=sto.to_location_id,
                batch_number=item.batch_number,
                reference_type='transfer_order',
                reference_id=sto.id,
                reference_number=sto.transfer_number,
                status='completed',
                notes=f'Transfer: {sto.reason}',
                created_by=user_id,
            )
            db.session.add(txn)

        sto.status = 'completed'
        sto.transferred_by = user_id
        sto.transferred_at = get_local_now()
        db.session.commit()

        return jsonify({'message': 'Transfer executed', 'transfer': sto.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================================
# 7. CYCLE COUNT
# ============================================================
@wms_advanced_bp.route('/cycle-counts', methods=['GET'])
@jwt_required()
def get_cycle_counts():
    """List cycle count schedules"""
    try:
        status = request.args.get('status')
        query = CycleCountSchedule.query
        if status:
            query = query.filter_by(status=status)
        query = query.order_by(CycleCountSchedule.next_count_date.asc())
        schedules = query.all()
        return jsonify({
            'schedules': [s.to_dict() for s in schedules]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/cycle-counts', methods=['POST'])
@jwt_required()
def create_cycle_count():
    """Create a cycle count schedule"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()

        cc = CycleCountSchedule(
            schedule_number=generate_txn_number('CC'),
            zone_id=data.get('zone_id'),
            location_id=data.get('location_id'),
            abc_category=data.get('abc_category'),
            frequency=data.get('frequency', 'monthly'),
            next_count_date=datetime.fromisoformat(data['next_count_date']).date() if data.get('next_count_date') else get_local_today(),
            assigned_to=data.get('assigned_to'),
            notes=data.get('notes'),
            created_by=user_id,
        )
        db.session.add(cc)
        db.session.commit()

        return jsonify({
            'message': 'Cycle count schedule created',
            'schedule': cc.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================================
# 8. REPORTS
# ============================================================
@wms_advanced_bp.route('/reports/material-variance', methods=['GET'])
@jwt_required()
def material_variance_report():
    """Material variance report - planned vs actual consumption"""
    try:
        wo_id = request.args.get('work_order_id', type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        query = db.session.query(
            MaterialConsumption.material_id,
            Material.code.label('material_code'),
            Material.name.label('material_name'),
            func.sum(MaterialConsumption.quantity_planned).label('total_planned'),
            func.sum(MaterialConsumption.quantity_actual).label('total_actual'),
            func.sum(MaterialConsumption.variance).label('total_variance'),
            func.count(MaterialConsumption.id).label('wo_count'),
        ).join(Material, MaterialConsumption.material_id == Material.id)

        if wo_id:
            query = query.filter(MaterialConsumption.work_order_id == wo_id)
        if start_date:
            query = query.filter(MaterialConsumption.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(MaterialConsumption.created_at <= datetime.fromisoformat(end_date))

        query = query.group_by(
            MaterialConsumption.material_id, Material.code, Material.name
        ).order_by(desc(func.abs(func.sum(MaterialConsumption.variance))))

        results = query.all()

        return jsonify({
            'report': [{
                'material_id': r.material_id,
                'material_code': r.material_code,
                'material_name': r.material_name,
                'total_planned': float(r.total_planned or 0),
                'total_actual': float(r.total_actual or 0),
                'total_variance': float(r.total_variance or 0),
                'variance_pct': round(float(r.total_variance or 0) / float(r.total_planned) * 100, 2) if float(r.total_planned or 0) > 0 else 0,
                'wo_count': r.wo_count,
            } for r in results],
            'total_records': len(results),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/reports/stock-movement-summary', methods=['GET'])
@jwt_required()
def stock_movement_summary():
    """Stock movement summary report"""
    try:
        days = request.args.get('days', 30, type=int)
        start = get_local_today() - timedelta(days=days)

        summary = db.session.query(
            InventoryTransaction.transaction_type,
            InventoryTransaction.direction,
            func.count(InventoryTransaction.id).label('count'),
            func.sum(InventoryTransaction.quantity).label('total_qty'),
            func.sum(InventoryTransaction.total_cost).label('total_cost'),
        ).filter(
            InventoryTransaction.transaction_date >= start
        ).group_by(
            InventoryTransaction.transaction_type,
            InventoryTransaction.direction
        ).all()

        return jsonify({
            'period_days': days,
            'start_date': start.isoformat(),
            'summary': [{
                'type': s.transaction_type,
                'direction': s.direction,
                'count': s.count,
                'total_quantity': float(s.total_qty or 0),
                'total_cost': float(s.total_cost or 0) if s.total_cost else 0,
            } for s in summary],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@wms_advanced_bp.route('/reports/batch-traceability/<batch_number>', methods=['GET'])
@jwt_required()
def batch_traceability(batch_number):
    """Trace a batch number across all transactions"""
    try:
        # Inventory records
        inv_items = Inventory.query.filter_by(batch_number=batch_number, is_active=True).all()

        # Transactions
        txns = InventoryTransaction.query.filter_by(batch_number=batch_number)\
            .order_by(InventoryTransaction.transaction_date.asc()).all()

        # Material consumption
        consumptions = MaterialConsumption.query.filter_by(from_batch_number=batch_number).all()

        # WIP movements
        wip_mvs = WIPStockMovement.query.filter_by(reference_number=batch_number).all()

        return jsonify({
            'batch_number': batch_number,
            'inventory': [{
                'id': inv.id,
                'item_type': 'product' if inv.product_id else 'material',
                'item_name': inv.product.name if inv.product else (inv.material.name if inv.material else ''),
                'location': inv.location.location_code if inv.location else None,
                'quantity': float(inv.quantity_on_hand or 0),
                'stock_status': inv.stock_status,
            } for inv in inv_items],
            'transactions': [t.to_dict() for t in txns],
            'material_consumptions': [c.to_dict() for c in consumptions],
            'wip_movements': [m.to_dict() for m in wip_mvs],
            'total_records': len(inv_items) + len(txns) + len(consumptions) + len(wip_mvs),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
