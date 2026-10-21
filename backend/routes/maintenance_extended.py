from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db, MaintenanceSchedule, MaintenanceRecord, MaintenanceTask, EquipmentHistory
from models.production import Machine
from models.hr import Employee
from utils.i18n import success_response, error_response, get_message
from utils import generate_number
from datetime import datetime
from sqlalchemy import func, desc
from utils.timezone import get_local_now, get_local_today

maintenance_extended_bp = Blueprint('maintenance_extended', __name__)

# Work Order Management Endpoints
@maintenance_extended_bp.route('/work-orders', methods=['GET'])
@jwt_required()
@require_permission('maintenance.view')
def get_work_orders():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        status = request.args.get('status', '')
        
        query = MaintenanceRecord.query
        if status:
            query = query.filter(MaintenanceRecord.status == status)
        
        work_orders = query.order_by(desc(MaintenanceRecord.created_at)).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'work_orders': [{
                'id': wo.id,
                'work_order_number': wo.record_number,
                'title': (wo.problem_description or '')[:50] + ('...' if wo.problem_description and len(wo.problem_description) > 50 else ''),
                'machine_name': wo.machine.name if wo.machine else 'N/A',
                'priority': getattr(wo, 'priority', 'medium'),
                'status': wo.status,
                'assigned_to': wo.performed_by_user.full_name if wo.performed_by_user else 'Unassigned',
                'scheduled_date': wo.maintenance_date.isoformat() if wo.maintenance_date else None,
                'created_at': wo.created_at.isoformat(),
                'estimated_hours': float(wo.duration_hours) if wo.duration_hours else None,
                'actual_hours': None
            } for wo in work_orders.items],
            'total': work_orders.total,
            'pages': work_orders.pages,
            'current_page': work_orders.page
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@maintenance_extended_bp.route('/work-orders', methods=['POST'])
@jwt_required()
@require_permission('maintenance.create')
def create_work_order():
    try:
        data = request.get_json()
        user_id = int(get_jwt_identity())
        
        work_order_number = generate_number('WO', MaintenanceRecord, 'record_number')
        
        work_order = MaintenanceRecord(
            record_number=work_order_number,
            machine_id=data['machine_id'],
            maintenance_type=data['maintenance_type'],
            problem_description=data.get('description', ''),
            maintenance_date=datetime.fromisoformat(data['scheduled_date']) if data.get('scheduled_date') else get_local_now(),
            performed_by=data.get('assigned_technician_id') or data.get('assigned_to') or user_id,
            duration_hours=data.get('estimated_hours', 0),
            status='scheduled',
            notes=data.get('notes')
        )
        
        db.session.add(work_order)
        db.session.commit()
        
        return jsonify({
            'message': 'Work order created successfully',
            'work_order_id': work_order.id,
            'work_order_number': work_order.record_number
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@maintenance_extended_bp.route('/work-orders/<int:work_order_id>', methods=['GET'])
@jwt_required()
@require_permission('maintenance.view')
def get_work_order(work_order_id):
    try:
        work_order = db.session.get(MaintenanceRecord, work_order_id) or abort(404)
        
        return jsonify({
            'work_order': {
                'id': work_order.id,
                'work_order_number': work_order.record_number,
                'machine_id': work_order.machine_id,
                'machine_name': work_order.machine.name if work_order.machine else 'N/A',
                'maintenance_type': work_order.maintenance_type,
                'priority': getattr(work_order, 'priority', 'medium'),
                'status': work_order.status,
                'description': work_order.problem_description,
                'scheduled_date': work_order.maintenance_date.isoformat() if work_order.maintenance_date else None,
                'completion_date': work_order.end_time.isoformat() if work_order.end_time else None,
                'assigned_technician_id': work_order.performed_by,
                'assigned_technician': work_order.performed_by_user.full_name if work_order.performed_by_user else None,
                'estimated_hours': float(work_order.duration_hours) if work_order.duration_hours else None,
                'actual_hours': None,
                'cost': float(work_order.cost) if work_order.cost else 0,
                'notes': work_order.notes,
                'created_at': work_order.created_at.isoformat()
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@maintenance_extended_bp.route('/work-orders/<int:work_order_id>', methods=['PUT'])
@jwt_required()
@require_permission('maintenance.edit')
def update_work_order(work_order_id):
    try:
        work_order = db.session.get(MaintenanceRecord, work_order_id) or abort(404)
        data = request.get_json()
        
        # Update fields
        if 'machine_id' in data:
            work_order.machine_id = data['machine_id']
        if 'maintenance_type' in data:
            work_order.maintenance_type = data['maintenance_type']
        if 'priority' in data:
            work_order.priority = data['priority']
        if 'description' in data:
            work_order.problem_description = data['description']
        if 'scheduled_date' in data:
            work_order.maintenance_date = datetime.fromisoformat(data['scheduled_date']) if data['scheduled_date'] else None
        if 'assigned_technician_id' in data:
            work_order.performed_by = data['assigned_technician_id']
        elif 'assigned_to' in data:
            work_order.performed_by = data['assigned_to']
        if 'estimated_hours' in data:
            work_order.duration_hours = data['estimated_hours']
        if 'actual_hours' in data:
            pass  # No direct field for actual_hours
        if 'cost' in data:
            work_order.cost = data['cost']
        if 'notes' in data:
            work_order.notes = data['notes']
        if 'status' in data:
            work_order.status = data['status']
            if data['status'] == 'completed':
                work_order.end_time = get_local_now()
        
        db.session.commit()
        return jsonify({'message': 'Work order updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Parts Request Management Endpoints
@maintenance_extended_bp.route('/parts-requests', methods=['GET'])
@jwt_required()
@require_permission('maintenance.view')
def get_parts_requests():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        # Mock data for now - will be replaced with actual model
        parts_requests = []
        
        return jsonify({
            'parts_requests': parts_requests,
            'total': 0,
            'pages': 0,
            'current_page': 1
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@maintenance_extended_bp.route('/parts-requests', methods=['POST'])
@jwt_required()
@require_permission('maintenance.create')
def create_parts_request():
    try:
        data = request.get_json()
        user_id = int(get_jwt_identity())
        
        # Mock response for now - will be replaced with actual implementation
        request_number = generate_number('PR', MaintenanceRecord, 'record_number')
        
        return jsonify({
            'message': 'Parts request created successfully',
            'request_id': 1,
            'request_number': request_number
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@maintenance_extended_bp.route('/parts-requests/<int:request_id>', methods=['GET'])
@jwt_required()
@require_permission('maintenance.view')
def get_parts_request(request_id):
    try:
        # Mock response for now
        return jsonify({
            'parts_request': {
                'id': request_id,
                'request_number': f'PR-{request_id:06d}',
                'machine_id': 1,
                'requested_by': 1,
                'request_date': get_local_now().isoformat(),
                'urgency': 'medium',
                'work_order_id': None,
                'parts': [],
                'justification': '',
                'notes': '',
                'status': 'pending'
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@maintenance_extended_bp.route('/parts-requests/<int:request_id>', methods=['PUT'])
@jwt_required()
@require_permission('maintenance.edit')
def update_parts_request(request_id):
    try:
        data = request.get_json()
        
        # Mock response for now
        return jsonify({'message': 'Parts request updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Analytics Endpoints
@maintenance_extended_bp.route('/analytics', methods=['GET'])
@jwt_required()
@require_permission('maintenance.view')
def get_maintenance_analytics():
    try:
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        machine_id = request.args.get('machine_id')
        maintenance_type = request.args.get('maintenance_type')
        report_type = request.args.get('report_type', 'overview')
        
        # Base query
        query = MaintenanceRecord.query
        
        if date_from:
            query = query.filter(MaintenanceRecord.created_at >= datetime.fromisoformat(date_from))
        if date_to:
            query = query.filter(MaintenanceRecord.created_at <= datetime.fromisoformat(date_to))
        if machine_id:
            query = query.filter(MaintenanceRecord.machine_id == machine_id)
        if maintenance_type:
            query = query.filter(MaintenanceRecord.maintenance_type == maintenance_type)
        
        records = query.all()

        # Calculate summary metrics
        total_work_orders = len(records)
        completed_work_orders = len([r for r in records if r.status == 'completed'])
        pending_work_orders = len([r for r in records if r.status == 'pending'])
        total_cost = sum([r.cost or 0 for r in records])

        # Calculate MTTR (Mean Time To Repair).
        # Bug fixed 2026-10-07: this used to read `r.actual_completion_time`,
        # a field that DOES NOT EXIST on MaintenanceRecord (see models/
        # maintenance.py - the real duration field is `duration_hours`).
        # Any time this endpoint ran against a date range containing even
        # one 'completed' record, `r.actual_completion_time` raised
        # AttributeError, caught by the bare `except Exception` below and
        # turned into a silent 500 - this is very likely WHY the rest of
        # this endpoint was "temporarily" filled with mock/hardcoded data
        # in the first place (a crash discovered, worked around with fake
        # data, and the underlying crash never actually fixed).
        completed_records = [r for r in records if r.status == 'completed' and r.duration_hours]
        mttr = float(sum([float(r.duration_hours or 0) for r in completed_records]) / len(completed_records)) if completed_records else 0

        # Real availability/MTBF from actual downtime_hours + failure count,
        # not the hardcoded 85.5%/168.0h this endpoint used to always
        # return regardless of filters. "Failure" = corrective/breakdown/
        # emergency maintenance (unplanned) - preventive is scheduled, not
        # a failure. Period length comes from the requested date range when
        # given, else the real span between the earliest and latest record
        # in the result set (never fabricated).
        if date_from and date_to:
            period_hours = (datetime.fromisoformat(date_to) - datetime.fromisoformat(date_from)).total_seconds() / 3600
        elif records:
            dates = [r.maintenance_date for r in records if r.maintenance_date]
            period_hours = (max(dates) - min(dates)).total_seconds() / 3600 if dates else 0
        else:
            period_hours = 0

        total_downtime_hours = float(sum([float(r.downtime_hours or 0) for r in records]))
        failure_records = [r for r in records if r.maintenance_type in ('corrective', 'breakdown', 'emergency')]
        availability_rate = round(max(0.0, (period_hours - total_downtime_hours) / period_hours * 100), 2) if period_hours > 0 else 0
        mtbf = round(period_hours / len(failure_records), 2) if failure_records and period_hours > 0 else 0

        # Generate chart data
        preventive_records = [r for r in records if r.maintenance_type == 'preventive']
        corrective_records = [r for r in records if r.maintenance_type == 'corrective']
        emergency_records = [r for r in records if r.maintenance_type == 'emergency']
        maintenance_by_type = [
            {'name': 'Preventive', 'value': len(preventive_records), 'color': '#3B82F6'},
            {'name': 'Corrective', 'value': len(corrective_records), 'color': '#10B981'},
            {'name': 'Emergency', 'value': len(emergency_records), 'color': '#EF4444'},
        ]

        # Real monthly trends grouped from `records` (was 6 literal hardcoded
        # Jan-Jun rows that never changed regardless of filters/real data).
        monthly_buckets = {}
        for r in records:
            if not r.maintenance_date:
                continue
            key = r.maintenance_date.strftime('%Y-%m')
            bucket = monthly_buckets.setdefault(key, {'month': r.maintenance_date.strftime('%b'), 'work_orders': 0, 'cost': 0.0, '_mttr_sum': 0.0, '_mttr_n': 0})
            bucket['work_orders'] += 1
            bucket['cost'] += float(r.cost or 0)
            if r.status == 'completed' and r.duration_hours:
                bucket['_mttr_sum'] += float(r.duration_hours)
                bucket['_mttr_n'] += 1
        monthly_trends = []
        for key in sorted(monthly_buckets.keys()):
            b = monthly_buckets[key]
            monthly_trends.append({
                'month': b['month'],
                'work_orders': b['work_orders'],
                'cost': b['cost'],
                'mttr': round(b['_mttr_sum'] / b['_mttr_n'], 2) if b['_mttr_n'] > 0 else 0
            })

        # Real per-machine performance (was always an empty array).
        machine_buckets = {}
        for r in records:
            if not r.machine_id:
                continue
            mb = machine_buckets.setdefault(r.machine_id, {'machine_id': r.machine_id, 'count': 0, 'cost': 0.0, 'downtime': 0.0})
            mb['count'] += 1
            mb['cost'] += float(r.cost or 0)
            mb['downtime'] += float(r.downtime_hours or 0)
        machine_performance = []
        if machine_buckets:
            from models.production import Machine
            machines_by_id = {m.id: m for m in Machine.query.filter(Machine.id.in_(machine_buckets.keys())).all()}
            for mid, mb in machine_buckets.items():
                machine = machines_by_id.get(mid)
                machine_period_hours = period_hours if period_hours > 0 else 1
                machine_performance.append({
                    'machine': machine.name if machine else f'Machine {mid}',
                    'availability': round(max(0.0, (machine_period_hours - mb['downtime']) / machine_period_hours * 100), 2),
                    'mttr': mb['count'],
                    'cost': mb['cost']
                })

        # Cost breakdown by real maintenance_type (was total_cost split by
        # fixed invented Labor/Parts/Tools/External percentages that never
        # reflected what was actually spent). No cost-category field exists
        # in this schema to split cost by Labor/Parts/Tools honestly.
        cost_breakdown = []
        for label, recs in [('Preventive', preventive_records), ('Corrective', corrective_records), ('Emergency', emergency_records)]:
            amount = float(sum(r.cost or 0 for r in recs))
            cost_breakdown.append({
                'category': label,
                'amount': amount,
                'percentage': round(amount / float(total_cost) * 100, 1) if total_cost else 0
            })

        # Real downtime analysis grouped by root_cause_category (a real
        # structured field, see models/maintenance.py) - was 4 hardcoded
        # reasons/hours/frequency numbers that never changed.
        downtime_buckets = {}
        for r in records:
            if not r.downtime_hours:
                continue
            key = r.root_cause_category or 'Belum dikategorikan'
            db_bucket = downtime_buckets.setdefault(key, {'reason': key, 'hours': 0.0, 'frequency': 0})
            db_bucket['hours'] += float(r.downtime_hours)
            db_bucket['frequency'] += 1
        downtime_analysis = sorted(downtime_buckets.values(), key=lambda x: x['hours'], reverse=True)

        total_duration_hours = float(sum([float(r.duration_hours or 0) for r in records]))

        return jsonify({
            'summary': {
                'total_work_orders': total_work_orders,
                'completed_work_orders': completed_work_orders,
                'pending_work_orders': pending_work_orders,
                'total_cost': total_cost,
                'average_completion_time': mttr,
                'mttr': mttr,
                'mtbf': mtbf,
                'availability_rate': availability_rate
            },
            'charts': {
                'maintenance_by_type': maintenance_by_type,
                'monthly_trends': monthly_trends,
                'machine_performance': machine_performance,
                'cost_breakdown': cost_breakdown,
                'downtime_analysis': downtime_analysis
            },
            'kpis': {
                'preventive_ratio': (len(preventive_records) / total_work_orders * 100) if total_work_orders > 0 else 0,
                'emergency_ratio': (len(emergency_records) / total_work_orders * 100) if total_work_orders > 0 else 0,
                'cost_per_hour': float(total_cost) / total_duration_hours if total_duration_hours > 0 else 0,
                # No cost-category or maintenance-schedule-adherence field
                # exists in this schema yet to compute these for real - left
                # honestly at 0 instead of the previous hardcoded 35.0/40.0/
                # 92.5 (which never changed regardless of actual data).
                'parts_cost_ratio': 0,
                'labor_cost_ratio': 0,
                'schedule_compliance': 0
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@maintenance_extended_bp.route('/analytics/export', methods=['GET'])
@jwt_required()
@require_permission('maintenance.view')
def export_maintenance_analytics():
    try:
        format_type = request.args.get('format', 'excel')
        
        # Mock response - actual implementation would generate file
        return jsonify({
            'message': f'Analytics export in {format_type} format would be generated here',
            'download_url': f'/downloads/maintenance_analytics.{format_type}'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
