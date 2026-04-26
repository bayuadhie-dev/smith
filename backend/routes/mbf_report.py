from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.mbf_report import MBFReport, MBFReportDetail
from models.production import WorkOrder
from models.product import Product
from utils.i18n import success_response, error_response
from utils import generate_number
from datetime import datetime, timedelta
from utils.timezone import get_local_now, get_local_today
import calendar

mbf_report_bp = Blueprint('mbf_report', __name__)

@mbf_report_bp.route('/reports', methods=['GET'])
@jwt_required()
def get_mbf_reports():
    """Get all MBF reports with pagination"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        
        query = MBFReport.query
        
        if status:
            query = query.filter(MBFReport.status == status)
        
        reports = query.order_by(MBFReport.created_at.desc()).paginate(
            page=page, per_page=per_page
        )
        
        return jsonify({
            'reports': [{
                'id': r.id,
                'report_number': r.report_number,
                'delivery_date': r.delivery_date.isoformat(),
                'period_start': r.period_start.isoformat(),
                'period_end': r.period_end.isoformat(),
                'total_target': float(r.total_target),
                'total_actual': float(r.total_actual),
                'achievement_percentage': float(r.achievement_percentage),
                'status': r.status,
                'approval_status': r.get_approval_status(),
                'created_at': r.created_at.isoformat()
            } for r in reports.items],
            'total': reports.total,
            'pages': reports.pages
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mbf_report_bp.route('/reports/<int:report_id>', methods=['GET'])
@jwt_required()
def get_mbf_report(report_id):
    """Get detailed MBF report by ID"""
    try:
        report = db.session.get(MBFReport, report_id) or abort(404)
        
        # Get all details grouped by day_date (unique per day)
        details_by_day = {}
        for detail in sorted(report.details, key=lambda d: (d.day_date, d.shift_number)):
            day_key = detail.day_date.isoformat() if detail.day_date else detail.day_name
            if day_key not in details_by_day:
                details_by_day[day_key] = []
            details_by_day[day_key].append({
                'id': detail.id,
                'day_name': detail.day_name,
                'day_date': detail.day_date.isoformat() if detail.day_date else None,
                'shift_number': detail.shift_number,
                'shift_name': detail.shift_name,
                'target_octenic': float(detail.target_octenic),
                'target_gloveclean': float(detail.target_gloveclean),
                'target_total_cartons': float(detail.target_total_cartons or 0),
                'actual_octenic_cartons': float(detail.actual_octenic_cartons or 0),
                'actual_gloveclean_cartons': float(detail.actual_gloveclean_cartons or 0),
                'actual_total_cartons': float(detail.actual_total_cartons or 0),
                'octn_batch_number': detail.octn_batch_number,
                'glvcn_batch_number': detail.glvcn_batch_number,
                'target_total': float(detail.target_total),
                'actual_octenic': float(detail.actual_octenic),
                'actual_gloveclean': float(detail.actual_gloveclean),
                'actual_total': float(detail.actual_total),
                'target_cloth_octenic': float(detail.target_cloth_octenic or 0),
                'target_cloth_gloveclean': float(detail.target_cloth_gloveclean or 0),
                'target_isolation_roll': float(detail.target_isolation_roll or 0),
                'target_karton_octenic': float(detail.target_karton_octenic or 0),
                'target_karton_gloveclean': float(detail.target_karton_gloveclean or 0),
                'actual_cloth_octenic': float(detail.actual_cloth_octenic or 0),
                'actual_cloth_gloveclean': float(detail.actual_cloth_gloveclean or 0),
                'actual_isolation_roll': float(detail.actual_isolation_roll or 0),
                'actual_karton_octenic': float(detail.actual_karton_octenic or 0),
                'actual_karton_gloveclean': float(detail.actual_karton_gloveclean or 0),
                'target_roll_packaging_octenic': float(detail.target_roll_packaging_octenic or 0),
                'target_roll_packaging_gloveclean': float(detail.target_roll_packaging_gloveclean or 0),
                'actual_roll_packaging_octenic': float(detail.actual_roll_packaging_octenic or 0),
                'actual_roll_packaging_gloveclean': float(detail.actual_roll_packaging_gloveclean or 0),
                'target_roll_sticker_octenic': float(detail.target_roll_sticker_octenic or 0),
                'actual_roll_sticker_octenic': float(detail.actual_roll_sticker_octenic or 0),
                'status': detail.status,
                'notes': detail.notes,
                # New quality fields
                'octn_setting_packaging': float(detail.octn_setting_packaging or 0),
                'octn_setting_sticker': float(detail.octn_setting_sticker or 0),
                'octn_grade_b': float(detail.octn_grade_b or 0),
                'octn_grade_c': float(detail.octn_grade_c or 0),
                'octn_waste_packaging': float(detail.octn_waste_packaging or 0),
                'octn_waste_sticker': float(detail.octn_waste_sticker or 0),
                'glvcn_setting_packaging': float(detail.glvcn_setting_packaging or 0),
                'glvcn_grade_b': float(detail.glvcn_grade_b or 0),
                'glvcn_grade_c': float(detail.glvcn_grade_c or 0),
                'glvcn_waste_packaging': float(detail.glvcn_waste_packaging or 0),
                'octn_waste_cloth_chem': detail.octn_waste_cloth_chem,
                'glvcn_waste_cloth_chem': detail.glvcn_waste_cloth_chem
            })
        
        return jsonify({
            'report': {
                'id': report.id,
                'report_number': report.report_number,
                'delivery_date': report.delivery_date.isoformat(),
                'period_start': report.period_start.isoformat(),
                'period_end': report.period_end.isoformat(),
                'target_octenic': float(report.target_octenic),
                'target_gloveclean': float(report.target_gloveclean),
                'total_target': float(report.total_target),
                'actual_octenic': float(report.actual_octenic),
                'actual_gloveclean': float(report.actual_gloveclean),
                'total_actual': float(report.total_actual),
                'achievement_percentage': float(report.achievement_percentage),
                'issue_explanation': report.issue_explanation,
                'status': report.status,
                'approval_status': report.get_approval_status(),
                'created_at': report.created_at.isoformat(),
                'details_by_day': details_by_day,
                'approvals': {
                    'staff': {
                        'name': report.staff_name,
                        'signature': report.staff_signature,
                        'date': report.staff_date.isoformat() if report.staff_date else None
                    },
                    'supervisor': {
                        'id': report.supervisor_id,
                        'name': report.supervisor_name,
                        'signature': report.supervisor_signature,
                        'date': report.supervisor_date.isoformat() if report.supervisor_date else None,
                        'notes': report.supervisor_notes
                    },
                    'manager': {
                        'id': report.manager_id,
                        'name': report.manager_name,
                        'signature': report.manager_signature,
                        'date': report.manager_date.isoformat() if report.manager_date else None,
                        'notes': report.manager_notes
                    }
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@mbf_report_bp.route('/reports', methods=['POST'])
@jwt_required()
def create_mbf_report():
    """Create new MBF report"""
    try:
        data = request.get_json()
        user_id = int(get_jwt_identity())
        
        # Generate report number
        report_number = generate_number('MBF', MBFReport, 'report_number')
        
        # User picks period manually
        delivery_date = datetime.fromisoformat(data['delivery_date']).date()
        period_start = datetime.fromisoformat(data['period_start']).date()
        period_end = datetime.fromisoformat(data['period_end']).date()
        
        # Input is in KARTON, convert to pcs
        OCTENIC_PER_KARTON = 39
        GLOVECLEAN_PER_KARTON = 72
        
        target_octenic_karton = float(data.get('target_octenic', 0))
        target_gloveclean_karton = float(data.get('target_gloveclean', 0))
        target_octenic_pcs = target_octenic_karton * OCTENIC_PER_KARTON
        target_gloveclean_pcs = target_gloveclean_karton * GLOVECLEAN_PER_KARTON
        
        # Create report
        report = MBFReport(
            report_number=report_number,
            delivery_date=delivery_date,
            period_start=period_start,
            period_end=period_end,
            target_octenic=target_octenic_pcs,
            target_gloveclean=target_gloveclean_pcs,
            total_target=target_octenic_pcs + target_gloveclean_pcs,
            total_actual=0,
            actual_octenic=0,
            actual_gloveclean=0,
            achievement_percentage=0,
            total_target_cartons=target_octenic_karton + target_gloveclean_karton,
            total_actual_cartons=0,
            created_by=user_id,
            status='draft'
        )
        
        db.session.add(report)
        db.session.flush()
        
        # Create daily details based on period range
        num_days = (period_end - period_start).days + 1
        for i in range(num_days):
            day_date = period_start + timedelta(days=i)
            day_name = calendar.day_name[day_date.weekday()]
            
            # Create 2 shifts per day
            for shift_num in [1, 2]:
                detail = MBFReportDetail(
                    report_id=report.id,
                    day_name=day_name,
                    day_date=day_date,
                    shift_number=shift_num,
                    shift_name=f'Shift {shift_num}',
                    target_octenic=0,
                    target_gloveclean=0,
                    target_total=0,
                    actual_octenic=0,
                    actual_gloveclean=0,
                    actual_total=0
                )
                db.session.add(detail)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Report created successfully',
            'synced': True,
            'report_id': report.id,
            'report_number': report_number
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@mbf_report_bp.route('/reports/<int:report_id>', methods=['PUT'])
@jwt_required()
def update_mbf_report(report_id):
    """Update MBF report"""
    try:
        report = db.session.get(MBFReport, report_id) or abort(404)
        data = request.get_json()
        
        # Check if report can be updated (not approved)
        if report.status == 'approved':
            return jsonify({'error': 'Cannot update approved report'}), 400
        
        # Update header information
        if 'delivery_date' in data:
            report.delivery_date = datetime.fromisoformat(data['delivery_date']).date()
        if 'period_start' in data:
            report.period_start = datetime.fromisoformat(data['period_start']).date()
        if 'period_end' in data:
            report.period_end = datetime.fromisoformat(data['period_end']).date()
        
        if 'target_octenic' in data:
            report.target_octenic = data['target_octenic']
        if 'target_gloveclean' in data:
            report.target_gloveclean = data['target_gloveclean']
        
        # Recalculate totals
        report.total_target = float(report.target_octenic or 0) + float(report.target_gloveclean or 0)
        
        # Update issue explanation if provided
        if 'issue_explanation' in data:
            report.issue_explanation = data['issue_explanation']
        
        # Update details if provided
        if 'details' in data:
            for detail_data in data['details']:
                detail = db.session.get(MBFReportDetail, detail_data['id'])
                if detail and detail.report_id == report_id:
                    OCTENIC_CLOTH_PER_PCS = 0.9  # 35.1 meters / 39 pcs
                    GLOVECLEAN_CLOTH_PER_PCS = 0.4875  # 35.1 meters / 72 pcs
                    
                    detail.target_octenic = float(detail_data.get('target_octenic', detail.target_octenic))
                    detail.target_gloveclean = float(detail_data.get('target_gloveclean', detail.target_gloveclean))
                    detail.target_total = detail.target_octenic + detail.target_gloveclean
                    detail.actual_octenic = float(detail_data.get('actual_octenic', detail.actual_octenic or 0))
                    detail.actual_gloveclean = float(detail_data.get('actual_gloveclean', detail.actual_gloveclean or 0))
                    detail.actual_total = detail.actual_octenic + detail.actual_gloveclean
                    
                    # Auto-calc cloth length, karton
                    detail.target_cloth_octenic = detail.target_octenic * OCTENIC_CLOTH_PER_PCS
                    detail.target_cloth_gloveclean = detail.target_gloveclean * GLOVECLEAN_CLOTH_PER_PCS
                    detail.actual_cloth_octenic = detail.actual_octenic * OCTENIC_CLOTH_PER_PCS
                    detail.actual_cloth_gloveclean = detail.actual_gloveclean * GLOVECLEAN_CLOTH_PER_PCS
                    detail.target_karton_octenic = detail.target_octenic / 39 if detail.target_octenic else 0
                    detail.target_karton_gloveclean = detail.target_gloveclean / 72 if detail.target_gloveclean else 0
                    detail.actual_karton_octenic = detail.actual_octenic / 39 if detail.actual_octenic else 0
                    detail.actual_karton_gloveclean = detail.actual_gloveclean / 72 if detail.actual_gloveclean else 0
                    
                    # Quality & Waste fields
                    detail.octn_setting_packaging = float(detail_data.get('octn_setting_packaging', detail.octn_setting_packaging or 0))
                    detail.octn_setting_sticker = float(detail_data.get('octn_setting_sticker', detail.octn_setting_sticker or 0))
                    detail.octn_grade_b = float(detail_data.get('octn_grade_b', detail.octn_grade_b or 0))
                    detail.octn_grade_c = float(detail_data.get('octn_grade_c', detail.octn_grade_c or 0))
                    
                    octn_waste_base = detail.octn_setting_packaging + detail.octn_setting_sticker + detail.octn_grade_b + detail.octn_grade_c
                    detail.octn_waste_packaging = octn_waste_base / 4761
                    detail.octn_waste_sticker = (detail.octn_setting_sticker + detail.octn_grade_b + detail.octn_grade_c) / 2000
                    
                    glvcn_waste_base = float(detail_data.get('glvcn_setting_packaging', detail.glvcn_setting_packaging or 0)) + \
                                       float(detail_data.get('glvcn_grade_b', detail.glvcn_grade_b or 0)) + \
                                       float(detail_data.get('glvcn_grade_c', detail.glvcn_grade_c or 0))
                    detail.glvcn_setting_packaging = float(detail_data.get('glvcn_setting_packaging', detail.glvcn_setting_packaging or 0))
                    detail.glvcn_grade_b = float(detail_data.get('glvcn_grade_b', detail.glvcn_grade_b or 0))
                    detail.glvcn_grade_c = float(detail_data.get('glvcn_grade_c', detail.glvcn_grade_c or 0))
                    detail.glvcn_waste_packaging = glvcn_waste_base / 5000
                    
                    # New waste fields (Sync with frontend strings)
                    detail.octn_waste_cloth_chem = detail_data.get('octn_waste_cloth_chem')
                    detail.glvcn_waste_cloth_chem = detail_data.get('glvcn_waste_cloth_chem')
                    
                    # Batch numbers
                    detail.octn_batch_number = detail_data.get('octn_batch_number', detail.octn_batch_number)
                    detail.glvcn_batch_number = detail_data.get('glvcn_batch_number', detail.glvcn_batch_number)
                    
                    detail.notes = detail_data.get('notes', detail.notes)
                    detail.calculate_status()

                    # Roll Packaging & Sticker: prioritize manual override, fallback to auto-calc
                    detail.target_roll_packaging_octenic = detail.target_octenic / 4761 if detail.target_octenic else 0
                    detail.target_roll_packaging_gloveclean = detail.target_gloveclean / 5000 if detail.target_gloveclean else 0
                    detail.target_roll_sticker_octenic = detail.target_octenic / 2000 if detail.target_octenic else 0
                    
                    detail.actual_roll_packaging_octenic = detail_data.get('actual_roll_packaging_octenic', detail.actual_octenic / 4761 if detail.actual_octenic else 0)
                    detail.actual_roll_packaging_gloveclean = detail_data.get('actual_roll_packaging_gloveclean', detail.actual_gloveclean / 5000 if detail.actual_gloveclean else 0)
                    detail.actual_roll_sticker_octenic = detail_data.get('actual_roll_sticker_octenic', detail.actual_octenic / 2000 if detail.actual_octenic else 0)
                    
                    # Isolation roll: pure manual overrides
                    detail.target_isolation_roll = detail_data.get('target_isolation_roll', detail.target_isolation_roll)
                    detail.actual_isolation_roll = detail_data.get('actual_isolation_roll', detail.actual_isolation_roll)
                    
                    detail.notes = detail_data.get('notes', detail.notes)
                    
                    # Update new quality/waste fields
                    detail.octn_setting_packaging = float(detail_data.get('octn_setting_packaging', detail.octn_setting_packaging or 0))
                    detail.octn_setting_sticker = float(detail_data.get('octn_setting_sticker', detail.octn_setting_sticker or 0))
                    detail.octn_grade_b = float(detail_data.get('octn_grade_b', detail.octn_grade_b or 0))
                    detail.octn_grade_c = float(detail_data.get('octn_grade_c', detail.octn_grade_c or 0))
                    
                    detail.glvcn_setting_packaging = float(detail_data.get('glvcn_setting_packaging', detail.glvcn_setting_packaging or 0))
                    detail.glvcn_grade_b = float(detail_data.get('glvcn_grade_b', detail.glvcn_grade_b or 0))
                    detail.glvcn_grade_c = float(detail_data.get('glvcn_grade_c', detail.glvcn_grade_c or 0))
                    
                    # Recalculate waste
                    # Octenic Waste
                    octn_waste_base = (detail.octn_setting_packaging + detail.octn_setting_sticker + 
                                       detail.octn_grade_b + detail.octn_grade_c)
                    detail.octn_waste_packaging = octn_waste_base / 4761
                    detail.octn_waste_sticker = (detail.octn_setting_sticker + detail.octn_grade_b + detail.octn_grade_c) / 2000
                    
                    # Gloveclean Waste
                    glvcn_waste_base = (detail.glvcn_setting_packaging + detail.glvcn_grade_b + detail.glvcn_grade_c)
                    detail.glvcn_waste_packaging = glvcn_waste_base / 5000
                    
                    detail.calculate_status()
        
        # Calculate actual totals from details
        actual_octenic = sum(float(d.actual_octenic or 0) for d in report.details)
        actual_gloveclean = sum(float(d.actual_gloveclean or 0) for d in report.details)
        report.actual_octenic = actual_octenic
        report.actual_gloveclean = actual_gloveclean
        report.total_actual = actual_octenic + actual_gloveclean
        
        # Calculate achievement percentage
        report.calculate_achievement()
        
        db.session.commit()
        
        return jsonify(success_response('Report updated successfully'))
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@mbf_report_bp.route('/reports/<int:report_id>/submit', methods=['POST'])
@jwt_required()
def submit_mbf_report(report_id):
    """Submit MBF report for approval"""
    try:
        report = db.session.get(MBFReport, report_id) or abort(404)
        user_id = int(get_jwt_identity())
        
        # Check if report can be submitted
        if report.status != 'draft':
            return jsonify({'error': 'Report can only be submitted from draft status'}), 400
        
        # Check mandatory issue explanation if target not achieved
        if report.check_mandatory_issue() and not report.issue_explanation:
            return jsonify({
                'error': 'Issue explanation is mandatory when target is not achieved'
            }), 400
        
        # Update staff signature
        from models import User
        staff = db.session.get(User, user_id)
        report.staff_name = staff.full_name if staff else 'Unknown'
        report.staff_signature = f"{staff.full_name} - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        report.staff_date = get_local_now()
        
        # Update status
        report.status = 'pending_review'
        
        db.session.commit()
        
        return jsonify(success_response('Report submitted for approval'))
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@mbf_report_bp.route('/reports/<int:report_id>/approve', methods=['POST'])
@jwt_required()
def approve_mbf_report(report_id):
    """Approve MBF report (Supervisor or Manager)"""
    try:
        report = db.session.get(MBFReport, report_id) or abort(404)
        user_id = int(get_jwt_identity())
        data = request.get_json()
        
        from models import User
        user = db.session.get(User, user_id)
        
        # Check user role and approval level
        approval_level = data.get('level')  # 'supervisor' or 'manager'
        
        if approval_level == 'supervisor':
            # Check if user is supervisor
            if not user or user.role not in ['production_supervisor', 'supervisor']:
                return jsonify({'error': 'Unauthorized: Supervisor role required'}), 403
            
            # Update supervisor approval
            report.supervisor_id = user_id
            report.supervisor_name = user.full_name
            report.supervisor_signature = f"{user.full_name} - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            report.supervisor_date = get_local_now()
            report.supervisor_notes = data.get('notes', '')
            
        elif approval_level == 'manager':
            # Check if user is manager
            if not user or user.role not in ['production_manager', 'manager']:
                return jsonify({'error': 'Unauthorized: Manager role required'}), 403
            
            # Check if supervisor has approved
            if not report.supervisor_date:
                return jsonify({'error': 'Report must be approved by supervisor first'}), 400
            
            # Update manager approval
            report.manager_id = user_id
            report.manager_name = user.full_name
            report.manager_signature = f"{user.full_name} - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            report.manager_date = get_local_now()
            report.manager_notes = data.get('notes', '')
            
            # Final approval
            report.status = 'approved'
            
        else:
            return jsonify({'error': 'Invalid approval level'}), 400
        
        db.session.commit()
        
        return jsonify(success_response('Report approved successfully'))
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@mbf_report_bp.route('/reports/<int:report_id>/reject', methods=['POST'])
@jwt_required()
def reject_mbf_report(report_id):
    """Reject MBF report"""
    try:
        report = db.session.get(MBFReport, report_id) or abort(404)
        user_id = int(get_jwt_identity())
        data = request.get_json()
        
        from models import User
        user = db.session.get(User, user_id)
        
        # Check if user can reject (supervisor or manager)
        if not user or user.role not in ['production_supervisor', 'supervisor', 'production_manager', 'manager']:
            return jsonify({'error': 'Unauthorized: Supervisor or Manager role required'}), 403
        
        # Update rejection info based on role
        if user.role in ['production_supervisor', 'supervisor']:
            report.supervisor_id = user_id
            report.supervisor_name = user.full_name
            report.supervisor_signature = f"REJECTED - {user.full_name} - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            report.supervisor_date = get_local_now()
            report.supervisor_notes = data.get('reason', 'Rejected')
        else:
            report.manager_id = user_id
            report.manager_name = user.full_name
            report.manager_signature = f"REJECTED - {user.full_name} - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            report.manager_date = get_local_now()
            report.manager_notes = data.get('reason', 'Rejected')
        
        report.status = 'rejected'
        
        db.session.commit()
        
        return jsonify(success_response('Report rejected'))
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@mbf_report_bp.route('/reports/<int:report_id>', methods=['DELETE'])
@jwt_required()
def delete_mbf_report(report_id):
    """Delete MBF report (only draft or rejected)"""
    try:
        report = db.session.get(MBFReport, report_id) or abort(404)
        
        if report.status not in ['draft', 'rejected']:
            return jsonify({'error': 'Only draft or rejected reports can be deleted'}), 400
        
        db.session.delete(report)
        db.session.commit()
        
        return jsonify({'status': 'success', 'message': 'Report deleted successfully'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@mbf_report_bp.route('/sync-production-data', methods=['POST'])
@jwt_required()
def sync_production_data():
    """Sync actual production data from ShiftProduction (primary) and WorkOrders (fallback)"""
    try:
        data = request.get_json()
        report_id = data['report_id']
        
        report = db.session.get(MBFReport, report_id) or abort(404)
        
        # Find ALL products matching octenic/gloveclean (including WIP variants)
        octenic_products = Product.query.filter(Product.name.ilike('%octenic%')).all()
        gloveclean_products = Product.query.filter(Product.name.ilike('%gloveclean%')).all()
        
        octenic_ids = [p.id for p in octenic_products]
        gloveclean_ids = [p.id for p in gloveclean_products]
        all_product_ids = octenic_ids + gloveclean_ids
        
        if not all_product_ids:
            return jsonify({'message': 'Products Octenic/Gloveclean not found in database. Please input data manually.', 'synced': False}), 200
        
        # === PRIMARY SOURCE: ShiftProduction (per date, per shift, per product) ===
        from models.production import ShiftProduction
        
        shift_records = ShiftProduction.query.filter(
            ShiftProduction.production_date >= report.period_start,
            ShiftProduction.production_date <= report.period_end,
            ShiftProduction.product_id.in_(all_product_ids)
        ).all()
        
        # Group ShiftProduction by date + shift_number
        production_data = {}
        for sp in shift_records:
            day_key = sp.production_date.strftime('%Y-%m-%d')
            
            # Try to extract shift number from ShiftProduction record
            sp_shift_attr = getattr(sp, 'shift_number', None) or getattr(sp, 'shift', None) or getattr(sp, 'shift_name', '')
            
            import re
            match = re.search(r'(\d+)', str(sp_shift_attr))
            sp_shift = int(match.group(1)) if match else 1
            
            composite_key = f"{day_key}_shift_{sp_shift}"
            
            if composite_key not in production_data:
                production_data[composite_key] = {'octenic': 0, 'gloveclean': 0, 'source': 'shift_production', 'date': day_key, 'shift': sp_shift}
            
            if sp.product_id in octenic_ids:
                production_data[composite_key]['octenic'] += float(sp.actual_quantity or 0)
            elif sp.product_id in gloveclean_ids:
                production_data[composite_key]['gloveclean'] += float(sp.actual_quantity or 0)
        
        # === FALLBACK: WorkOrders (for dates NOT covered by ShiftProduction) ===
        period_start_dt = datetime.combine(report.period_start, datetime.min.time())
        period_end_dt = datetime.combine(report.period_end, datetime.max.time())
        
        work_orders = WorkOrder.query.filter(
            db.or_(
                db.and_(
                    WorkOrder.actual_start_date >= period_start_dt,
                    WorkOrder.actual_start_date <= period_end_dt,
                ),
                db.and_(
                    WorkOrder.actual_start_date.is_(None),
                    WorkOrder.scheduled_start_date >= period_start_dt,
                    WorkOrder.scheduled_start_date <= period_end_dt,
                )
            ),
            WorkOrder.product_id.in_(all_product_ids),
            WorkOrder.status.in_(['completed', 'in_progress'])
        ).all()
        
        wo_count = 0
        for wo in work_orders:
            wo_date = wo.actual_start_date or wo.scheduled_start_date
            if wo_date:
                day_key = wo_date.strftime('%Y-%m-%d')
                # WorkOrders don't have shift info, assign to Shift 1
                composite_key = f"{day_key}_shift_1"
                
                # Only add WO data if ShiftProduction didn't already cover this slot
                if composite_key not in production_data:
                    production_data[composite_key] = {'octenic': 0, 'gloveclean': 0, 'source': 'work_order', 'date': day_key, 'shift': 1}
                    wo_count += 1
                
                if production_data[composite_key].get('source') == 'work_order':
                    if wo.product_id in octenic_ids:
                        production_data[composite_key]['octenic'] += float(wo.quantity_produced or 0)
                    elif wo.product_id in gloveclean_ids:
                        production_data[composite_key]['gloveclean'] += float(wo.quantity_produced or 0)
        
        if not production_data:
            return jsonify({
                'message': f'No production data found for period {report.period_start} - {report.period_end}.',
                'synced': False
            }), 200
        
        # Reset all detail actuals to 0 first (clear stale data from previous syncs)
        for detail in report.details:
            detail.actual_octenic = 0
            detail.actual_gloveclean = 0
            detail.actual_total = 0
            detail.actual_cloth_octenic = 0
            detail.actual_cloth_gloveclean = 0
            detail.actual_karton_octenic = 0
            detail.actual_karton_gloveclean = 0
            detail.actual_roll_packaging_octenic = 0
            detail.actual_roll_packaging_gloveclean = 0
            detail.actual_roll_sticker_octenic = 0
            detail.status = 'on_track'
        
        # Constants
        OCTENIC_CLOTH_PER_PCS = 0.9  # 35.1 meters / 39 pcs
        GLOVECLEAN_CLOTH_PER_PCS = 0.4875  # 35.1 meters / 72 pcs
        
        # Update report details (match by DATE + SHIFT)
        matched = 0
        for detail in report.details:
            day_date_str = detail.day_date.strftime('%Y-%m-%d') if detail.day_date else None
            composite_key = f"{day_date_str}_shift_{detail.shift_number}"
            
            if composite_key in production_data:
                pd = production_data[composite_key]
                detail.actual_octenic = pd['octenic']
                detail.actual_gloveclean = pd['gloveclean']
                detail.actual_total = float(detail.actual_octenic) + float(detail.actual_gloveclean)
                
                # Auto-calc cloth length, karton, isolation roll
                detail.actual_cloth_octenic = float(detail.actual_octenic) * OCTENIC_CLOTH_PER_PCS
                detail.actual_cloth_gloveclean = float(detail.actual_gloveclean) * GLOVECLEAN_CLOTH_PER_PCS
                detail.actual_karton_octenic = float(detail.actual_octenic) / 39 if detail.actual_octenic else 0
                detail.actual_karton_gloveclean = float(detail.actual_gloveclean) / 72 if detail.actual_gloveclean else 0
                
                # Roll Packaging & Sticker Actuals
                detail.actual_roll_packaging_octenic = float(detail.actual_octenic) / 4761 if detail.actual_octenic else 0
                detail.actual_roll_packaging_gloveclean = float(detail.actual_gloveclean) / 5000 if detail.actual_gloveclean else 0
                detail.actual_roll_sticker_octenic = float(detail.actual_octenic) / 2000 if detail.actual_octenic else 0
                
                detail.calculate_status()
                matched += 1
        
        # Recalculate totals (sum unique shifts, not doubled)
        actual_octenic = sum(float(d.actual_octenic or 0) for d in report.details)
        actual_gloveclean = sum(float(d.actual_gloveclean or 0) for d in report.details)
        report.actual_octenic = actual_octenic
        report.actual_gloveclean = actual_gloveclean
        report.total_actual = actual_octenic + actual_gloveclean
        
        # Calculate cartons
        report.total_actual_cartons = (float(actual_octenic) / 39) + (float(actual_gloveclean) / 72)
        
        # Calculate achievement
        report.calculate_achievement()
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': f'Synced: {len(shift_records)} shift records + {wo_count} work orders → {matched} detail rows updated',
            'synced': True,
            'shift_records_count': len(shift_records),
            'work_orders_count': wo_count,
            'details_updated': matched,
            'production_data': {k: {kk: vv for kk, vv in v.items() if kk not in ('source', 'date', 'shift')} for k, v in production_data.items()}
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

