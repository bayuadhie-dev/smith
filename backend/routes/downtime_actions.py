"""
Routes for Downtime Action Items - Root Cause & Follow Up Tracking
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.production import DowntimeActionItem, Machine, ShiftProduction
from models.product import Product
from models.user import User
from models import db
from datetime import datetime, timedelta
from sqlalchemy import func, and_, or_
import calendar

downtime_actions_bp = Blueprint('downtime_actions', __name__)

# Kategori downtime yang dianggap UNPLANNED
UNPLANNED_CATEGORIES = ['mesin', 'operator', 'material']
# Kategori PLANNED yang tidak perlu action item
PLANNED_CATEGORIES = ['idle', 'design']


def get_week_number(date):
    """Get week number in month (1-5)"""
    day = date.day
    if day <= 7:
        return 1
    elif day <= 14:
        return 2
    elif day <= 21:
        return 3
    elif day <= 28:
        return 4
    else:
        return 5


@downtime_actions_bp.route('/action-items', methods=['GET'])
@jwt_required()
def get_action_items():
    """Get action items with filters"""
    try:
        # Filters
        machine_id = request.args.get('machine_id', type=int)
        product_id = request.args.get('product_id', type=int)
        week_number = request.args.get('week_number', type=int)
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        status = request.args.get('status')
        
        query = DowntimeActionItem.query
        
        if machine_id:
            query = query.filter_by(machine_id=machine_id)
        if product_id:
            query = query.filter_by(product_id=product_id)
        if week_number:
            query = query.filter_by(week_number=week_number)
        if month:
            query = query.filter_by(month=month)
        if year:
            query = query.filter_by(year=year)
        if status:
            query = query.filter_by(status=status)
        
        # Order by duration desc (most critical first)
        action_items = query.order_by(DowntimeActionItem.total_duration.desc()).all()
        
        return jsonify({
            'action_items': [item.to_dict() for item in action_items]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@downtime_actions_bp.route('/action-items/<int:item_id>', methods=['GET'])
@jwt_required()
def get_action_item(item_id):
    """Get single action item"""
    try:
        item = DowntimeActionItem.query.get_or_404(item_id)
        return jsonify(item.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@downtime_actions_bp.route('/action-items', methods=['POST'])
@jwt_required()
def create_action_item():
    """Create new action item"""
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        # Validate required fields
        required = ['downtime_reason', 'machine_id', 'week_number', 'year', 'month', 'total_duration']
        for field in required:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Create action item
        action_item = DowntimeActionItem(
            downtime_reason=data['downtime_reason'],
            machine_id=data['machine_id'],
            product_id=data.get('product_id'),
            week_number=data['week_number'],
            year=data['year'],
            month=data['month'],
            total_duration=data['total_duration'],
            root_cause=data.get('root_cause'),
            follow_up=data.get('follow_up'),
            status=data.get('status', 'pending'),
            pic=data.get('pic'),
            created_by=current_user_id,
            updated_by=current_user_id
        )
        
        db.session.add(action_item)
        db.session.commit()
        
        return jsonify({
            'message': 'Action item created successfully',
            'action_item': action_item.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@downtime_actions_bp.route('/action-items/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_action_item(item_id):
    """Update action item (root cause, follow up, status, PIC)"""
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        action_item = DowntimeActionItem.query.get_or_404(item_id)
        
        # Update fields
        if 'root_cause' in data:
            action_item.root_cause = data['root_cause']
        if 'follow_up' in data:
            action_item.follow_up = data['follow_up']
        if 'status' in data:
            action_item.status = data['status']
        if 'pic' in data:
            action_item.pic = data['pic']
        
        action_item.updated_by = current_user_id
        action_item.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Action item updated successfully',
            'action_item': action_item.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@downtime_actions_bp.route('/action-items/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_action_item(item_id):
    """Delete action item"""
    try:
        action_item = DowntimeActionItem.query.get_or_404(item_id)
        db.session.delete(action_item)
        db.session.commit()
        
        return jsonify({'message': 'Action item deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@downtime_actions_bp.route('/generate-action-items', methods=['POST'])
@jwt_required()
def generate_action_items():
    """
    Generate action items from top 3 unplanned downtime per machine per product per week
    This should be run weekly (e.g., every Monday morning)
    """
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        # Get date range (default: last week)
        if 'start_date' in data and 'end_date' in data:
            start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        else:
            # Default: last week
            today = datetime.now().date()
            start_date = today - timedelta(days=today.weekday() + 7)  # Last Monday
            end_date = start_date + timedelta(days=6)  # Last Sunday
        
        week_number = get_week_number(start_date)
        year = start_date.year
        month = start_date.month
        
        # Get all shift productions in date range
        shift_productions = ShiftProduction.query.filter(
            and_(
                ShiftProduction.production_date >= start_date,
                ShiftProduction.production_date <= end_date
            )
        ).all()
        
        # Aggregate downtime by machine, product, and reason
        downtime_agg = {}
        
        for sp in shift_productions:
            if not sp.issues:
                continue
            
            # Parse issues string: "60 menit - Description [category]"
            issues_list = sp.issues.split('\n')
            
            for issue in issues_list:
                if not issue.strip():
                    continue
                
                try:
                    # Extract duration, reason, and category
                    parts = issue.split(' - ', 1)
                    if len(parts) < 2:
                        continue
                    
                    duration_str = parts[0].replace('menit', '').strip()
                    duration = int(duration_str)
                    
                    rest = parts[1]
                    if '[' in rest and ']' in rest:
                        reason = rest[:rest.rfind('[')].strip()
                        category = rest[rest.rfind('[')+1:rest.rfind(']')].strip()
                    else:
                        reason = rest.strip()
                        category = 'unknown'
                    
                    # Only process UNPLANNED downtime
                    if category not in UNPLANNED_CATEGORIES:
                        continue
                    
                    # Create key for aggregation
                    key = (sp.machine_id, sp.product_id, reason)
                    
                    if key not in downtime_agg:
                        downtime_agg[key] = {
                            'machine_id': sp.machine_id,
                            'product_id': sp.product_id,
                            'reason': reason,
                            'total_duration': 0
                        }
                    
                    downtime_agg[key]['total_duration'] += duration
                    
                except Exception as e:
                    print(f"Error parsing issue: {issue} - {str(e)}")
                    continue
        
        # Group by machine and product, get top 3 per group
        grouped = {}
        for key, data in downtime_agg.items():
            machine_id = data['machine_id']
            product_id = data['product_id']
            group_key = (machine_id, product_id)
            
            if group_key not in grouped:
                grouped[group_key] = []
            
            grouped[group_key].append(data)
        
        # Create action items for top 3 in each group
        created_count = 0
        
        for group_key, items in grouped.items():
            # Sort by duration desc, take top 3
            top_3 = sorted(items, key=lambda x: x['total_duration'], reverse=True)[:3]
            
            for item in top_3:
                # Check if action item already exists
                existing = DowntimeActionItem.query.filter_by(
                    downtime_reason=item['reason'],
                    machine_id=item['machine_id'],
                    product_id=item['product_id'],
                    week_number=week_number,
                    year=year,
                    month=month
                ).first()
                
                if existing:
                    # Update duration if different
                    if existing.total_duration != item['total_duration']:
                        existing.total_duration = item['total_duration']
                        existing.updated_by = current_user_id
                        existing.updated_at = datetime.utcnow()
                    continue
                
                # Create new action item
                action_item = DowntimeActionItem(
                    downtime_reason=item['reason'],
                    machine_id=item['machine_id'],
                    product_id=item['product_id'],
                    week_number=week_number,
                    year=year,
                    month=month,
                    total_duration=item['total_duration'],
                    status='pending',
                    created_by=current_user_id,
                    updated_by=current_user_id
                )
                
                db.session.add(action_item)
                created_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'Generated {created_count} action items',
            'week_number': week_number,
            'year': year,
            'month': month,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@downtime_actions_bp.route('/action-items/summary', methods=['GET'])
@jwt_required()
def get_action_items_summary():
    """Get summary of action items by status"""
    try:
        # Count by status
        summary = db.session.query(
            DowntimeActionItem.status,
            func.count(DowntimeActionItem.id).label('count'),
            func.sum(DowntimeActionItem.total_duration).label('total_duration')
        ).group_by(DowntimeActionItem.status).all()
        
        result = {
            'by_status': [
                {
                    'status': row.status,
                    'count': row.count,
                    'total_duration': int(row.total_duration) if row.total_duration else 0
                }
                for row in summary
            ],
            'total_items': sum(row.count for row in summary),
            'total_duration': sum(int(row.total_duration) if row.total_duration else 0 for row in summary)
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
