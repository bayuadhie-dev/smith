from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.asset_management import Asset, DepreciationSchedule, AssetTransfer, AssetValuation, SparePart, SparePartMovement
from models.maintenance import MaintenanceRecord
from utils import generate_number
from utils.timezone import get_local_now, get_local_today
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
from sqlalchemy import func, and_, or_, desc
import json

asset_bp = Blueprint('assets', __name__)

# ============ ASSET CRUD ============

@asset_bp.route('/', methods=['GET'])
@asset_bp.route('', methods=['GET'])
@jwt_required()
def get_assets():
    """Get all assets with filters"""
    try:
        # Filters
        asset_type = request.args.get('type')
        status = request.args.get('status')
        department_id = request.args.get('department_id', type=int)
        is_production = request.args.get('is_production')
        search = request.args.get('search')
        
        query = Asset.query
        
        if asset_type:
            query = query.filter(Asset.asset_type == asset_type)
        if status:
            query = query.filter(Asset.status == status)
        if department_id:
            query = query.filter(Asset.department_id == department_id)
        if is_production is not None:
            query = query.filter(Asset.is_production_machine == (is_production.lower() == 'true'))
        if search:
            query = query.filter(
                or_(
                    Asset.asset_code.ilike(f'%{search}%'),
                    Asset.asset_name.ilike(f'%{search}%'),
                    Asset.machine_code.ilike(f'%{search}%')
                )
            )
        
        assets = query.order_by(Asset.created_at.desc()).all()
        
        return jsonify({
            'assets': [{
                'id': a.id,
                'asset_code': a.asset_code,
                'asset_name': a.asset_name,
                'asset_type': a.asset_type,
                'category': a.category,
                'status': a.status,
                'is_production_machine': a.is_production_machine,
                'machine_code': a.machine_code,
                'location': a.location,
                'department_id': a.department_id,
                'purchase_date': a.purchase_date.isoformat() if a.purchase_date else None,
                'purchase_cost': float(a.purchase_cost) if a.purchase_cost else 0,
                'accumulated_depreciation': float(a.accumulated_depreciation) if a.accumulated_depreciation else 0,
                'net_book_value': a.net_book_value,
                'is_under_warranty': a.is_under_warranty,
                'next_maintenance_date': a.next_maintenance_date.isoformat() if a.next_maintenance_date else None,
            } for a in assets]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@asset_bp.route('/<int:asset_id>', methods=['GET'])
@jwt_required()
def get_asset_detail(asset_id):
    """Get detailed asset information"""
    try:
        asset = db.session.get(Asset, asset_id)
        if not asset:
            return jsonify({'error': 'Asset not found'}), 404
        
        # Get maintenance history
        maintenance_records = MaintenanceRecord.query.filter_by(asset_id=asset_id).order_by(desc(MaintenanceRecord.maintenance_date)).limit(10).all()
        
        # Get depreciation schedule
        depreciation_schedule = DepreciationSchedule.query.filter_by(asset_id=asset_id).order_by(DepreciationSchedule.period_date).all()
        
        # Get transfer history
        transfers = AssetTransfer.query.filter_by(asset_id=asset_id).order_by(desc(AssetTransfer.transfer_date)).all()
        
        return jsonify({
            'asset': {
                'id': asset.id,
                'asset_code': asset.asset_code,
                'asset_name': asset.asset_name,
                'asset_type': asset.asset_type,
                'category': asset.category,
                'subcategory': asset.subcategory,
                'description': asset.description,
                'status': asset.status,
                
                # Procurement
                'purchase_date': asset.purchase_date.isoformat() if asset.purchase_date else None,
                'purchase_cost': float(asset.purchase_cost) if asset.purchase_cost else 0,
                'supplier_id': asset.supplier_id,
                'invoice_number': asset.invoice_number,
                'warranty_start_date': asset.warranty_start_date.isoformat() if asset.warranty_start_date else None,
                'warranty_end_date': asset.warranty_end_date.isoformat() if asset.warranty_end_date else None,
                'is_under_warranty': asset.is_under_warranty,
                
                # Installation
                'installation_date': asset.installation_date.isoformat() if asset.installation_date else None,
                'commissioning_date': asset.commissioning_date.isoformat() if asset.commissioning_date else None,
                'location': asset.location,
                'department_id': asset.department_id,
                
                # Financial
                'depreciation_method': asset.depreciation_method,
                'useful_life_years': asset.useful_life_years,
                'salvage_value': float(asset.salvage_value) if asset.salvage_value else 0,
                'accumulated_depreciation': float(asset.accumulated_depreciation) if asset.accumulated_depreciation else 0,
                'net_book_value': asset.net_book_value,
                'annual_depreciation': asset.annual_depreciation,
                'monthly_depreciation': asset.monthly_depreciation,
                'age_years': asset.age_years,
                
                # Production Machine
                'is_production_machine': asset.is_production_machine,
                'machine_code': asset.machine_code,
                'capacity': float(asset.capacity) if asset.capacity else None,
                'speed': asset.speed,
                'specifications': json.loads(asset.specifications) if asset.specifications else None,
                
                # Maintenance
                'last_maintenance_date': asset.last_maintenance_date.isoformat() if asset.last_maintenance_date else None,
                'next_maintenance_date': asset.next_maintenance_date.isoformat() if asset.next_maintenance_date else None,
                'total_maintenance_cost': float(asset.total_maintenance_cost) if asset.total_maintenance_cost else 0,
                'total_downtime_hours': float(asset.total_downtime_hours) if asset.total_downtime_hours else 0,
                
                # Disposal
                'disposal_date': asset.disposal_date.isoformat() if asset.disposal_date else None,
                'disposal_value': float(asset.disposal_value) if asset.disposal_value else None,
            },
            'maintenance_history': [{
                'id': m.id,
                'record_number': m.record_number,
                'maintenance_type': m.maintenance_type,
                'maintenance_date': m.maintenance_date.isoformat() if m.maintenance_date else None,
                'status': m.status,
                'cost': float(m.cost) if m.cost else 0,
                'downtime_hours': float(m.downtime_hours) if m.downtime_hours else 0,
            } for m in maintenance_records],
            'depreciation_schedule': [{
                'period_date': d.period_date.isoformat(),
                'depreciation_amount': float(d.depreciation_amount),
                'accumulated_depreciation': float(d.accumulated_depreciation),
                'net_book_value': float(d.net_book_value),
                'is_posted': d.is_posted,
            } for d in depreciation_schedule],
            'transfer_history': [{
                'id': t.id,
                'transfer_number': t.transfer_number,
                'transfer_date': t.transfer_date.isoformat(),
                'from_location': t.from_location,
                'to_location': t.to_location,
                'status': t.status,
            } for t in transfers]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@asset_bp.route('/', methods=['POST'])
@asset_bp.route('', methods=['POST'])
@jwt_required()
def create_asset():
    """Create new asset"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # Generate asset code
        asset_code = generate_number('AST', Asset, 'asset_code')
        
        asset = Asset(
            asset_code=asset_code,
            asset_name=data['asset_name'],
            asset_type=data['asset_type'],
            category=data.get('category'),
            subcategory=data.get('subcategory'),
            description=data.get('description'),
            status=data.get('status', 'planning'),
            
            # Procurement
            purchase_date=datetime.fromisoformat(data['purchase_date']) if data.get('purchase_date') else None,
            purchase_cost=data.get('purchase_cost'),
            supplier_id=data.get('supplier_id'),
            invoice_number=data.get('invoice_number'),
            
            # Installation
            location=data.get('location'),
            department_id=data.get('department_id'),
            
            # Financial
            depreciation_method=data.get('depreciation_method', 'straight_line'),
            useful_life_years=data.get('useful_life_years'),
            salvage_value=data.get('salvage_value', 0),
            
            # Production Machine
            is_production_machine=data.get('is_production_machine', False),
            machine_code=data.get('machine_code'),
            capacity=data.get('capacity'),
            speed=data.get('speed'),
            
            created_by=user_id
        )
        
        db.session.add(asset)
        db.session.commit()
        
        # Generate depreciation schedule if applicable
        if asset.purchase_cost and asset.useful_life_years and asset.depreciation_method:
            generate_depreciation_schedule(asset.id)
        
        return jsonify({
            'message': 'Asset created successfully',
            'asset_id': asset.id,
            'asset_code': asset.asset_code
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@asset_bp.route('/<int:asset_id>', methods=['PUT'])
@jwt_required()
def update_asset(asset_id):
    """Update asset"""
    try:
        asset = db.session.get(Asset, asset_id)
        if not asset:
            return jsonify({'error': 'Asset not found'}), 404
        
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # Update fields
        if 'asset_name' in data:
            asset.asset_name = data['asset_name']
        if 'status' in data:
            asset.status = data['status']
        if 'location' in data:
            asset.location = data['location']
        if 'department_id' in data:
            asset.department_id = data['department_id']
        if 'description' in data:
            asset.description = data['description']
        
        asset.updated_by = user_id
        db.session.commit()
        
        return jsonify({'message': 'Asset updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============ DEPRECIATION ============

def generate_depreciation_schedule(asset_id):
    """Generate depreciation schedule for an asset"""
    asset = db.session.get(Asset, asset_id)
    if not asset or not asset.purchase_cost or not asset.useful_life_years:
        return
    
    # Delete existing schedule
    DepreciationSchedule.query.filter_by(asset_id=asset_id).delete()
    
    start_date = asset.purchase_date or date.today()
    monthly_depreciation = asset.monthly_depreciation
    accumulated = 0
    
    for month in range(asset.useful_life_years * 12):
        period_date = start_date + relativedelta(months=month)
        period_date = period_date.replace(day=1)  # First day of month
        
        accumulated += monthly_depreciation
        nbv = float(asset.purchase_cost) - accumulated
        
        schedule = DepreciationSchedule(
            asset_id=asset_id,
            period_date=period_date,
            depreciation_amount=monthly_depreciation,
            accumulated_depreciation=accumulated,
            net_book_value=max(nbv, float(asset.salvage_value or 0))
        )
        db.session.add(schedule)
    
    db.session.commit()


@asset_bp.route('/<int:asset_id>/depreciation-schedule', methods=['GET'])
@jwt_required()
def get_depreciation_schedule(asset_id):
    """Get depreciation schedule for an asset"""
    try:
        schedules = DepreciationSchedule.query.filter_by(asset_id=asset_id).order_by(DepreciationSchedule.period_date).all()
        
        return jsonify({
            'schedules': [{
                'period_date': s.period_date.isoformat(),
                'depreciation_amount': float(s.depreciation_amount),
                'accumulated_depreciation': float(s.accumulated_depreciation),
                'net_book_value': float(s.net_book_value),
                'is_posted': s.is_posted,
            } for s in schedules]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@asset_bp.route('/batch-depreciation', methods=['POST'])
@jwt_required()
def calculate_batch_depreciation():
    """Calculate depreciation for all active assets for current month"""
    try:
        current_month = get_local_today().replace(day=1)
        
        # Get all active assets with depreciation
        assets = Asset.query.filter(
            Asset.status == 'active',
            Asset.purchase_cost.isnot(None),
            Asset.useful_life_years.isnot(None)
        ).all()
        
        updated_count = 0
        for asset in assets:
            # Check if depreciation for this month exists
            existing = DepreciationSchedule.query.filter_by(
                asset_id=asset.id,
                period_date=current_month,
                is_posted=True
            ).first()
            
            if not existing:
                # Update accumulated depreciation
                monthly_dep = asset.monthly_depreciation
                asset.accumulated_depreciation = float(asset.accumulated_depreciation or 0) + monthly_dep
                asset.last_depreciation_date = current_month
                
                # Mark schedule as posted
                schedule = DepreciationSchedule.query.filter_by(
                    asset_id=asset.id,
                    period_date=current_month
                ).first()
                if schedule:
                    schedule.is_posted = True
                    schedule.posted_date = datetime.utcnow()
                
                updated_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'Depreciation calculated for {updated_count} assets',
            'period': current_month.isoformat()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============ ASSET TRANSFER ============

@asset_bp.route('/<int:asset_id>/transfer', methods=['POST'])
@jwt_required()
def transfer_asset(asset_id):
    """Transfer asset to new location/department"""
    try:
        asset = db.session.get(Asset, asset_id)
        if not asset:
            return jsonify({'error': 'Asset not found'}), 404
        
        data = request.get_json()
        user_id = get_jwt_identity()
        
        transfer_number = generate_number('TRF', AssetTransfer, 'transfer_number')
        
        transfer = AssetTransfer(
            transfer_number=transfer_number,
            asset_id=asset_id,
            transfer_date=datetime.fromisoformat(data['transfer_date']) if data.get('transfer_date') else date.today(),
            from_location=asset.location,
            from_department_id=asset.department_id,
            to_location=data['to_location'],
            to_department_id=data.get('to_department_id'),
            to_responsible_id=data['to_responsible_id'],
            reason=data.get('reason'),
            status='pending',
            created_by=user_id
        )
        
        db.session.add(transfer)
        db.session.commit()
        
        return jsonify({
            'message': 'Transfer request created',
            'transfer_id': transfer.id,
            'transfer_number': transfer.transfer_number
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@asset_bp.route('/transfers/<int:transfer_id>/approve', methods=['POST'])
@jwt_required()
def approve_transfer(transfer_id):
    """Approve asset transfer"""
    try:
        transfer = db.session.get(AssetTransfer, transfer_id)
        if not transfer:
            return jsonify({'error': 'Transfer not found'}), 404
        
        user_id = get_jwt_identity()
        
        # Update transfer status
        transfer.status = 'completed'
        transfer.approved_by = user_id
        transfer.approved_at = datetime.utcnow()
        
        # Update asset location
        asset = transfer.asset
        asset.location = transfer.to_location
        asset.department_id = transfer.to_department_id
        asset.responsible_person_id = transfer.to_responsible_id
        
        db.session.commit()
        
        return jsonify({'message': 'Transfer approved and completed'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============ SPARE PARTS ============

@asset_bp.route('/spare-parts', methods=['GET'])
@jwt_required()
def get_spare_parts():
    """Get spare parts inventory"""
    try:
        low_stock_only = request.args.get('low_stock', 'false').lower() == 'true'
        
        query = SparePart.query.filter_by(is_active=True)
        
        if low_stock_only:
            query = query.filter(SparePart.current_stock <= SparePart.reorder_point)
        
        parts = query.order_by(SparePart.part_number).all()
        
        return jsonify({
            'spare_parts': [{
                'id': p.id,
                'part_number': p.part_number,
                'part_name': p.part_name,
                'category': p.category,
                'current_stock': float(p.current_stock),
                'min_stock': float(p.min_stock),
                'reorder_point': float(p.reorder_point),
                'uom': p.uom,
                'unit_cost': float(p.unit_cost) if p.unit_cost else 0,
                'needs_reorder': p.needs_reorder,
            } for p in parts]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============ REPORTS & ANALYTICS ============

@asset_bp.route('/reports/summary', methods=['GET'])
@jwt_required()
def get_asset_summary():
    """Get asset summary by category and status"""
    try:
        # Summary by type
        by_type = db.session.query(
            Asset.asset_type,
            func.count(Asset.id).label('count'),
            func.sum(Asset.purchase_cost).label('total_cost'),
            func.sum(Asset.accumulated_depreciation).label('total_depreciation')
        ).filter(Asset.status != 'disposed').group_by(Asset.asset_type).all()
        
        # Summary by status
        by_status = db.session.query(
            Asset.status,
            func.count(Asset.id).label('count')
        ).group_by(Asset.status).all()
        
        # Total values
        totals = db.session.query(
            func.count(Asset.id).label('total_assets'),
            func.sum(Asset.purchase_cost).label('total_acquisition_cost'),
            func.sum(Asset.accumulated_depreciation).label('total_depreciation')
        ).filter(Asset.status != 'disposed').first()
        
        return jsonify({
            'by_type': [{
                'asset_type': t[0],
                'count': t[1],
                'total_cost': float(t[2]) if t[2] else 0,
                'total_depreciation': float(t[3]) if t[3] else 0,
            } for t in by_type],
            'by_status': [{
                'status': s[0],
                'count': s[1]
            } for s in by_status],
            'totals': {
                'total_assets': totals[0] if totals else 0,
                'total_acquisition_cost': float(totals[1]) if totals and totals[1] else 0,
                'total_depreciation': float(totals[2]) if totals and totals[2] else 0,
                'total_net_book_value': (float(totals[1]) - float(totals[2])) if totals and totals[1] and totals[2] else 0,
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@asset_bp.route('/reports/maintenance-due', methods=['GET'])
@jwt_required()
def get_maintenance_due():
    """Get assets with upcoming or overdue maintenance"""
    try:
        today = get_local_today()
        next_30_days = today + timedelta(days=30)
        
        # Overdue
        overdue = Asset.query.filter(
            Asset.status == 'active',
            Asset.next_maintenance_date < today
        ).all()
        
        # Due soon (next 30 days)
        due_soon = Asset.query.filter(
            Asset.status == 'active',
            Asset.next_maintenance_date >= today,
            Asset.next_maintenance_date <= next_30_days
        ).all()
        
        return jsonify({
            'overdue': [{
                'id': a.id,
                'asset_code': a.asset_code,
                'asset_name': a.asset_name,
                'next_maintenance_date': a.next_maintenance_date.isoformat(),
                'days_overdue': (today - a.next_maintenance_date).days,
            } for a in overdue],
            'due_soon': [{
                'id': a.id,
                'asset_code': a.asset_code,
                'asset_name': a.asset_name,
                'next_maintenance_date': a.next_maintenance_date.isoformat(),
                'days_until_due': (a.next_maintenance_date - today).days,
            } for a in due_soon]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
