from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from utils.auth_decorators import require_permission
from models import db
from models.production import WorkOrder, ProductionRecord, BillOfMaterials
from models.work_order_bom import WorkOrderBOMItem
from models.spk import SPKWarehouseStageLog
from utils.bom_explosion import explode_bom_requirements, CircularBOMError, MaxDepthExceededError

spk_bp = Blueprint('spk', __name__)


@spk_bp.route('/<int:work_order_id>/warehouse-history', methods=['GET'])
@jwt_required()
@require_permission('work_orders.view')
def get_spk_warehouse_history(work_order_id):
    """Native replacement for Accurate EJO's processHistory (MS/FGS) - dedicated
    SPKWarehouseStageLog table, auto-populated by shift-input and packing-list
    completion (see routes/production.py and routes/packing_list.py)."""
    wo = db.session.get(WorkOrder, work_order_id)
    if not wo:
        return jsonify({'error': 'Work order not found'}), 404

    logs = SPKWarehouseStageLog.query.filter_by(work_order_id=work_order_id) \
        .order_by(SPKWarehouseStageLog.recorded_at).all()

    stage_label = {'epd': 'Masuk Gudang EPD', 'fg': 'Masuk Gudang FG'}
    return jsonify({
        'work_order_id': work_order_id,
        'wo_number': wo.wo_number,
        'history': [{
            'stage': log.stage,
            'stage_label': stage_label.get(log.stage, log.stage),
            'quantity': float(log.quantity),
            'recorded_at': log.recorded_at.isoformat() if log.recorded_at else None,
            'source_type': log.source_type,
        } for log in logs],
    }), 200


@spk_bp.route('/<int:work_order_id>/completion-records', methods=['GET'])
@jwt_required()
@require_permission('work_orders.view')
def get_spk_completion_records(work_order_id):
    """Native replacement for Accurate EJO's Finished Good Slip list -
    reads the existing ProductionRecord table (one row per completion event,
    already populated by the shift-input flow), exposed via a dedicated SPK endpoint."""
    wo = db.session.get(WorkOrder, work_order_id)
    if not wo:
        return jsonify({'error': 'Work order not found'}), 404

    records = ProductionRecord.query.filter_by(work_order_id=work_order_id) \
        .order_by(ProductionRecord.production_date).all()

    def operator_name(rec):
        if not rec.operator:
            return None
        return f'{rec.operator.first_name} {rec.operator.last_name}'.strip()

    return jsonify({
        'work_order_id': work_order_id,
        'wo_number': wo.wo_number,
        'records': [{
            'id': r.id,
            'production_date': r.production_date.isoformat() if r.production_date else None,
            'machine_name': r.machine.name if r.machine else None,
            'operator_name': operator_name(r),
            'shift': r.shift,
            'quantity_produced': float(r.quantity_produced) if r.quantity_produced is not None else 0,
            'quantity_good': float(r.quantity_good) if r.quantity_good is not None else 0,
            'quantity_scrap': float(r.quantity_scrap) if r.quantity_scrap is not None else 0,
            'quantity_rework': float(r.quantity_rework) if r.quantity_rework is not None else 0,
            'downtime_minutes': r.downtime_minutes or 0,
            'is_waste': (r.quantity_scrap or 0) > 0 and (r.quantity_good or 0) == 0,
        } for r in records],
    }), 200


@spk_bp.route('/<int:work_order_id>/material-breakdown', methods=['GET'])
@jwt_required()
@require_permission('work_orders.view')
def get_spk_material_breakdown(work_order_id):
    """Native replacement for Accurate EJO's multi-level material tree
    (Barang Jadi -> WIP -> Mixing). Dedicated SPK computation - reuses only the
    generic recursive utility explode_bom_requirements(), not routes/bom.py's
    endpoint/tree-building code."""
    wo = db.session.get(WorkOrder, work_order_id)
    if not wo:
        return jsonify({'error': 'Work order not found'}), 404

    # Find the BOM in effect for this WO: WO-specific override first, else master BOM
    # (same lookup order as get_work_order_bom() in routes/production.py, reimplemented
    # here standalone rather than calling that endpoint's code).
    has_wo_bom = WorkOrderBOMItem.query.filter_by(work_order_id=work_order_id).first() is not None

    bom = None
    if wo.bom_id:
        bom = db.session.get(BillOfMaterials, wo.bom_id)
    if not bom and wo.product_id:
        bom = BillOfMaterials.query.filter_by(product_id=wo.product_id, is_active=True).first()

    if not bom:
        return jsonify({
            'work_order_id': work_order_id,
            'wo_number': wo.wo_number,
            'source': 'none',
            'tree': [],
            'message': 'Tidak ada BOM untuk work order ini.',
        }), 200

    def scale_fn(bom_item, parent_qty, _bom):
        return float(bom_item.effective_quantity) * parent_qty

    try:
        exploded = explode_bom_requirements(bom.product_id, float(wo.quantity), scale_fn)
    except (CircularBOMError, MaxDepthExceededError) as e:
        return jsonify({'error': str(e)}), 400

    def build_tree(level, path_len):
        """Rebuild a nested Barang Jadi -> WIP -> Mixing tree from the flat
        materials/sub_assemblies lists returned by explode_bom_requirements()
        (own implementation, not routes/bom.py's build_shortage_tree)."""
        materials = [
            {
                'type': 'material',
                'material_id': m['material_id'],
                'name': m['material_name'],
                'quantity': m['required_quantity'],
                'uom': m['uom'],
            }
            for m in exploded['materials'] if len(m['path']) == path_len
        ]
        sub_assemblies = []
        for sa in exploded['sub_assemblies']:
            if len(sa['path']) != path_len:
                continue
            sub_assemblies.append({
                'type': 'sub_assembly',
                'product_id': sa['product_id'],
                'name': sa['product_name'],
                'quantity': sa['required_quantity'],
                'has_own_bom': sa['has_own_bom'],
                'children': build_tree(level, path_len + 1) if sa['has_own_bom'] else [],
            })
        return materials + sub_assemblies

    tree = build_tree(exploded, 1)

    return jsonify({
        'work_order_id': work_order_id,
        'wo_number': wo.wo_number,
        'source': 'work_order_override' if has_wo_bom else 'master_bom',
        'bom_id': bom.id,
        'bom_number': bom.bom_number,
        'tree': tree,
    }), 200
