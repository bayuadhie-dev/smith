from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date, timedelta
from models import db, ConvertingMachine, ConvertingProduction, Employee, Product
from utils.helpers import get_setting_value

converting_bp = Blueprint('converting', __name__)

def get_local_today():
    """Get today's date in local timezone (WIB)"""
    from datetime import timezone
    utc_now = datetime.now(timezone.utc)
    wib = timezone(timedelta(hours=7))
    return utc_now.astimezone(wib).date()

def get_local_now():
    """Get current datetime in local timezone (WIB)"""
    from datetime import timezone
    utc_now = datetime.now(timezone.utc)
    wib = timezone(timedelta(hours=7))
    return utc_now.astimezone(wib)

# ============ MACHINES ============

@converting_bp.route('/api/converting/machines', methods=['GET'])
@jwt_required()
def get_converting_machines():
    """Get all converting machines"""
    try:
        machines = ConvertingMachine.query.filter_by(is_active=True).order_by(ConvertingMachine.name).all()
        
        result = []
        for m in machines:
            result.append({
                'id': m.id,
                'code': m.code,
                'name': m.name,
                'machine_type': m.machine_type,
                'status': m.status,
                'default_speed': m.default_speed,
                'target_efficiency': m.target_efficiency,
                'notes': m.notes
            })
        
        return jsonify({'machines': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@converting_bp.route('/api/converting/machines', methods=['POST'])
@jwt_required()
def create_converting_machine():
    """Create a new converting machine"""
    try:
        data = request.get_json()
        
        # Check if code already exists
        existing = ConvertingMachine.query.filter_by(code=data['code']).first()
        if existing:
            return jsonify({'error': f"Kode mesin {data['code']} sudah ada"}), 400
        
        machine = ConvertingMachine(
            code=data['code'],
            name=data['name'],
            machine_type=data['machine_type'],
            default_speed=data.get('default_speed', 0),
            target_efficiency=data.get('target_efficiency', get_setting_value('converting.default_target_efficiency', 60.0)),
            notes=data.get('notes')
        )
        db.session.add(machine)
        db.session.commit()
        
        return jsonify({
            'message': 'Mesin berhasil ditambahkan',
            'machine': {
                'id': machine.id,
                'code': machine.code,
                'name': machine.name
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@converting_bp.route('/api/converting/machines/<int:machine_id>', methods=['PUT'])
@jwt_required()
def update_converting_machine(machine_id):
    """Update a converting machine"""
    try:
        machine = db.session.get(ConvertingMachine, machine_id) or abort(404)
        data = request.get_json()
        
        if 'name' in data:
            machine.name = data['name']
        if 'machine_type' in data:
            machine.machine_type = data['machine_type']
        if 'default_speed' in data:
            machine.default_speed = data['default_speed']
        if 'target_efficiency' in data:
            machine.target_efficiency = data['target_efficiency']
        if 'status' in data:
            machine.status = data['status']
        if 'notes' in data:
            machine.notes = data['notes']
        
        db.session.commit()
        
        return jsonify({'message': 'Mesin berhasil diupdate'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@converting_bp.route('/api/converting/machines/seed', methods=['POST'])
@jwt_required()
def seed_converting_machines():
    """Seed initial 12 converting machines"""
    try:
        machines_data = [
            {'code': 'CVT-PERF-01', 'name': 'Perforating 1', 'machine_type': 'perforating', 'default_speed': 100},
            {'code': 'CVT-PERF-02', 'name': 'Perforating 2', 'machine_type': 'perforating', 'default_speed': 100},
            {'code': 'CVT-SLIT-01', 'name': 'Slitting 1', 'machine_type': 'slitting', 'default_speed': 150},
            {'code': 'CVT-SLIT-02', 'name': 'Slitting 2', 'machine_type': 'slitting', 'default_speed': 150},
            {'code': 'CVT-LAMI-01', 'name': 'Laminasi Kain', 'machine_type': 'laminasi', 'default_speed': 80},
            {'code': 'CVT-BAGM-01', 'name': 'Bagmaker', 'machine_type': 'bagmaker', 'default_speed': 60},
            {'code': 'CVT-FOLD-200A', 'name': 'Folding 200 (1)', 'machine_type': 'folding', 'default_speed': 200},
            {'code': 'CVT-FOLD-200B', 'name': 'Folding 200 (2)', 'machine_type': 'folding', 'default_speed': 200},
            {'code': 'CVT-FOLD-280', 'name': 'Folding 280', 'machine_type': 'folding', 'default_speed': 180},
            {'code': 'CVT-FOLD-320', 'name': 'Folding 320', 'machine_type': 'folding', 'default_speed': 160},
            {'code': 'CVT-FOLD-600', 'name': 'Folding 600', 'machine_type': 'folding', 'default_speed': 120},
            {'code': 'CVT-CUT-01', 'name': 'Cutting', 'machine_type': 'cutting', 'default_speed': 200},
        ]
        
        created = 0
        skipped = 0
        for m in machines_data:
            existing = ConvertingMachine.query.filter_by(code=m['code']).first()
            if not existing:
                machine = ConvertingMachine(
                    code=m['code'],
                    name=m['name'],
                    machine_type=m['machine_type'],
                    default_speed=m['default_speed'],
                    target_efficiency=get_setting_value('converting.default_target_efficiency', 60.0)
                )
                db.session.add(machine)
                created += 1
            else:
                skipped += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'Seed selesai: {created} mesin dibuat, {skipped} sudah ada',
            'created': created,
            'skipped': skipped
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============ PRODUCTION ============

@converting_bp.route('/api/converting/production', methods=['GET'])
@jwt_required()
def get_converting_productions():
    """Get converting productions with filters"""
    try:
        # Filters
        date_str = request.args.get('date')
        machine_id = request.args.get('machine_id')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        query = ConvertingProduction.query
        
        if date_str:
            prod_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            query = query.filter(ConvertingProduction.production_date == prod_date)
        elif start_date and end_date:
            s_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            e_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            query = query.filter(ConvertingProduction.production_date.between(s_date, e_date))
        
        if machine_id:
            query = query.filter(ConvertingProduction.machine_id == int(machine_id))
        
        productions = query.order_by(ConvertingProduction.production_date.desc(), ConvertingProduction.shift).all()
        
        result = []
        for p in productions:
            result.append({
                'id': p.id,
                'production_date': p.production_date.isoformat(),
                'shift': p.shift,
                'machine_id': p.machine_id,
                'machine_name': p.machine.name if p.machine else None,
                'machine_type': p.machine.machine_type if p.machine else None,
                'njo': p.njo,
                'product_name': p.product_name,
                'specification': p.specification,
                'grade_a': float(p.grade_a) if p.grade_a else 0,
                'grade_b': float(p.grade_b) if p.grade_b else 0,
                'loss_kg': float(p.loss_kg) if p.loss_kg else 0,
                'machine_data': p.get_machine_data(),
                'operator_name': p.operator_name,
                'notes': p.notes,
                'status': p.status
            })
        
        return jsonify({'productions': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@converting_bp.route('/api/converting/production', methods=['POST'])
@jwt_required()
def create_converting_production():
    """Create a new converting production record with machine-specific data"""
    try:
        import json
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Parse date
        prod_date = datetime.strptime(data['production_date'], '%Y-%m-%d').date()
        
        # Get machine info
        machine = db.session.get(ConvertingMachine, data['machine_id'])
        if not machine:
            return jsonify({'error': 'Mesin tidak ditemukan'}), 404
        
        production = ConvertingProduction(
            production_date=prod_date,
            shift=int(data.get('shift', 1)),
            machine_id=data['machine_id'],
            njo=data.get('njo'),
            product_name=data.get('product_name'),
            specification=data.get('specification'),
            grade_a=float(data.get('grade_a', 0)),
            grade_b=float(data.get('grade_b', 0)),
            loss_kg=float(data.get('loss_kg', 0)),
            operator_name=data.get('operator_name'),
            notes=data.get('notes'),
            status=data.get('status', 'completed'),
            created_by=user_id
        )
        
        # Set machine-specific data as JSON
        machine_data = data.get('machine_data') or {}
        
        # Process downtime entries if provided
        downtime_entries = data.get('downtime_entries') or machine_data.get('downtime_entries', [])
        if downtime_entries:
            from utils.helpers import detect_downtime_category
            
            downtime_by_category = {
                'mesin': 0,
                'operator': 0,
                'material': 0,
                'design': 0,
                'idle': 0,
                'others': 0
            }
            
            processed_entries = []
            total_downtime_mins = 0
            
            for entry in downtime_entries:
                reason = entry.get('reason', '')
                duration = int(entry.get('duration_minutes', 0))
                frequency = int(entry.get('frequency', 1))
                
                entry_total = duration * frequency
                total_downtime_mins += entry_total
                
                detected_cat = detect_downtime_category(reason)
                if detected_cat == 'istirahat':
                    detected_cat = 'others'
                    
                downtime_by_category[detected_cat] = downtime_by_category.get(detected_cat, 0) + entry_total
                
                processed_entries.append({
                    'reason': reason,
                    'duration_minutes': duration,
                    'frequency': frequency,
                    'category': detected_cat
                })
                
            machine_data['downtime_entries'] = processed_entries
            machine_data['downtime_minutes'] = total_downtime_mins
            for cat, mins in downtime_by_category.items():
                machine_data[f'downtime_{cat}'] = mins
                
        # Also sync downtime_minutes directly if no entries but total is passed
        elif 'downtime_minutes' in data:
            machine_data['downtime_minutes'] = int(data['downtime_minutes'])
            
        if machine_data:
            production.set_machine_data(machine_data)
        
        db.session.add(production)
        db.session.commit()
        
        return jsonify({
            'message': 'Data produksi berhasil disimpan',
            'production': {
                'id': production.id,
                'machine_type': machine.machine_type
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@converting_bp.route('/api/converting/production/<int:prod_id>', methods=['PUT'])
@jwt_required()
def update_converting_production(prod_id):
    """Update a converting production record"""
    try:
        production = db.session.get(ConvertingProduction, prod_id) or abort(404)
        data = request.get_json()
        
        mdata = production.get_machine_data() or {}
        
        if 'good_quantity' in data:
            production.grade_a = float(data['good_quantity'])
        elif 'actual_quantity' in data:
            production.grade_a = float(data['actual_quantity'])
            
        if 'reject_quantity' in data:
            production.grade_b = float(data['reject_quantity'])
            
        if 'downtime_entries' in data or ('machine_data' in data and 'downtime_entries' in data['machine_data']):
            downtime_entries = data.get('downtime_entries') or data.get('machine_data', {}).get('downtime_entries', [])
            from utils.helpers import detect_downtime_category
            
            downtime_by_category = {
                'mesin': 0,
                'operator': 0,
                'material': 0,
                'design': 0,
                'idle': 0,
                'others': 0
            }
            
            processed_entries = []
            total_downtime_mins = 0
            
            for entry in downtime_entries:
                reason = entry.get('reason', '')
                duration = int(entry.get('duration_minutes', 0))
                frequency = int(entry.get('frequency', 1))
                
                entry_total = duration * frequency
                total_downtime_mins += entry_total
                
                detected_cat = detect_downtime_category(reason)
                if detected_cat == 'istirahat':
                    detected_cat = 'others'
                    
                downtime_by_category[detected_cat] = downtime_by_category.get(detected_cat, 0) + entry_total
                
                processed_entries.append({
                    'reason': reason,
                    'duration_minutes': duration,
                    'frequency': frequency,
                    'category': detected_cat
                })
                
            mdata['downtime_entries'] = processed_entries
            mdata['downtime_minutes'] = total_downtime_mins
            for cat, mins in downtime_by_category.items():
                mdata[f'downtime_{cat}'] = mins
                
        elif 'downtime_minutes' in data:
            mdata['downtime_minutes'] = int(data['downtime_minutes'])
            
        if 'idle_time' in data:
            mdata['idle_time'] = int(data['idle_time'])
        if 'machine_speed' in data:
            mdata['machine_speed'] = float(data['machine_speed'])
        if 'planned_runtime' in data:
            mdata['production_hour_minutes'] = int(data['planned_runtime'])
            
        if mdata:
            production.set_machine_data(mdata)
            
        if 'notes' in data:
            production.notes = data['notes']
        if 'operator_name' in data:
            production.operator_name = data['operator_name']
        if 'product_name' in data:
            production.product_name = data['product_name']
        if 'specification' in data:
            production.specification = data['specification']
        if 'njo' in data:
            production.njo = data['njo']
        if 'loss_kg' in data:
            production.loss_kg = float(data['loss_kg']) if data['loss_kg'] is not None else None
            
        db.session.commit()
        
        return jsonify({'message': 'Data produksi berhasil diupdate'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@converting_bp.route('/api/converting/production/<int:prod_id>', methods=['DELETE'])
@jwt_required()
def delete_converting_production(prod_id):
    """Delete a converting production record"""
    try:
        production = db.session.get(ConvertingProduction, prod_id) or abort(404)
        db.session.delete(production)
        db.session.commit()
        
        return jsonify({'message': 'Data produksi berhasil dihapus'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============ DASHBOARD ============

@converting_bp.route('/api/converting/dashboard', methods=['GET'])
@jwt_required(optional=True)
def get_converting_dashboard():
    """Get converting dashboard data"""
    try:
        date_str = request.args.get('date')
        if date_str:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            target_date = get_local_today()
        
        # Get all machines
        machines = ConvertingMachine.query.filter_by(is_active=True).order_by(ConvertingMachine.name).all()
        
        # Get today's productions
        productions = ConvertingProduction.query.filter(
            ConvertingProduction.production_date == target_date
        ).all()
        
        # Group by machine
        machine_data = {}
        for m in machines:
            machine_data[m.id] = {
                'id': m.id,
                'code': m.code,
                'name': m.name,
                'machine_type': m.machine_type,
                'status': m.status,
                'target_efficiency': m.target_efficiency,
                'shifts': [],
                'total_output': 0,
                'total_good': 0,
                'total_reject': 0,
                'avg_efficiency': 0
            }
        
        for p in productions:
            if p.machine_id in machine_data:
                machine_data[p.machine_id]['shifts'].append({
                    'id': p.id,
                    'shift': p.shift,
                    'product_name': p.product_name or (p.product.name if p.product else '-'),
                    'actual_quantity': float(p.actual_quantity) if p.actual_quantity else 0,
                    'good_quantity': float(p.good_quantity) if p.good_quantity else 0,
                    'reject_quantity': float(p.reject_quantity) if p.reject_quantity else 0,
                    'efficiency_rate': float(p.efficiency_rate) if p.efficiency_rate else 0,
                    'operator_name': p.operator_name,
                    'downtime_entries': p.downtime_entries,
                    'specification': p.specification,
                    'njo': p.njo,
                    'notes': p.notes,
                    'loss_kg': float(p.loss_kg) if p.loss_kg else 0,
                    'machine_data': p.machine_data_dict
                })
                machine_data[p.machine_id]['total_output'] += float(p.actual_quantity) if p.actual_quantity else 0
                machine_data[p.machine_id]['total_good'] += float(p.good_quantity) if p.good_quantity else 0
                machine_data[p.machine_id]['total_reject'] += float(p.reject_quantity) if p.reject_quantity else 0
        
        # Calculate averages
        for mid, md in machine_data.items():
            if md['shifts']:
                md['avg_efficiency'] = round(sum(s['efficiency_rate'] for s in md['shifts']) / len(md['shifts']), 2)
        
        # Summary
        total_output = sum(md['total_output'] for md in machine_data.values())
        total_good = sum(md['total_good'] for md in machine_data.values())
        total_reject = sum(md['total_reject'] for md in machine_data.values())
        active_machines = sum(1 for md in machine_data.values() if md['shifts'])
        
        return jsonify({
            'date': target_date.isoformat(),
            'machines': list(machine_data.values()),
            'summary': {
                'total_machines': len(machines),
                'active_machines': active_machines,
                'total_output': total_output,
                'total_good': total_good,
                'total_reject': total_reject,
                'quality_rate': round((total_good / total_output) * 100, 2) if total_output > 0 else 100
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============ REPORTS ============

@converting_bp.route('/api/converting/daily-report', methods=['GET'])
@jwt_required()
def get_converting_daily_report():
    """Get daily report for converting"""
    try:
        date_str = request.args.get('date')
        if date_str:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            target_date = get_local_today()
        
        productions = ConvertingProduction.query.filter(
            ConvertingProduction.production_date == target_date
        ).order_by(ConvertingProduction.machine_id, ConvertingProduction.shift).all()
        
        # Group by machine type
        by_type = {}
        for p in productions:
            mtype = p.machine.machine_type if p.machine else 'unknown'
            if mtype not in by_type:
                by_type[mtype] = {
                    'type': mtype,
                    'total_output': 0,
                    'total_good': 0,
                    'total_reject': 0,
                    'machines': {}
                }
            
            mid = p.machine_id
            if mid not in by_type[mtype]['machines']:
                by_type[mtype]['machines'][mid] = {
                    'machine_name': p.machine.name if p.machine else '-',
                    'productions': []
                }
            
            by_type[mtype]['machines'][mid]['productions'].append({
                'shift': p.shift,
                'product': p.product_name or (p.product.name if p.product else '-'),
                'output': float(p.actual_quantity) if p.actual_quantity else 0,
                'good': float(p.good_quantity) if p.good_quantity else 0,
                'reject': float(p.reject_quantity) if p.reject_quantity else 0,
                'efficiency': float(p.efficiency_rate) if p.efficiency_rate else 0
            })
            
            by_type[mtype]['total_output'] += float(p.actual_quantity) if p.actual_quantity else 0
            by_type[mtype]['total_good'] += float(p.good_quantity) if p.good_quantity else 0
            by_type[mtype]['total_reject'] += float(p.reject_quantity) if p.reject_quantity else 0
        
        # Convert machines dict to list
        for mtype in by_type:
            by_type[mtype]['machines'] = list(by_type[mtype]['machines'].values())
        
        return jsonify({
            'date': target_date.isoformat(),
            'report': list(by_type.values())
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@converting_bp.route('/api/converting/monthly-summary', methods=['GET'])
@jwt_required(optional=True)
def get_converting_monthly_summary():
    """Get weekly or monthly summary for converting module"""
    try:
        year_str = request.args.get('year')
        month_str = request.args.get('month')
        view_mode = request.args.get('view', 'monthly')  # 'weekly' or 'monthly'
        week_number = request.args.get('week', 0, type=int)
        
        if not year_str or not month_str:
            return jsonify({'error': 'Parameter year dan month wajib diisi'}), 400
            
        y = int(year_str)
        m = int(month_str)
        
        # Calculate date range
        start_date = date(y, m, 1)
        if m == 12:
            end_date = date(y + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(y, m + 1, 1) - timedelta(days=1)

        # For weekly view, calculate week boundaries (Monday-Sunday)
        if view_mode == 'weekly' and week_number > 0:
            first_day_of_month = date(y, m, 1)
            days_until_monday = (7 - first_day_of_month.weekday()) % 7
            if first_day_of_month.weekday() != 0:
                first_monday = first_day_of_month + timedelta(days=days_until_monday)
            else:
                first_monday = first_day_of_month

            week_start = first_monday + timedelta(days=(week_number - 1) * 7)
            week_end = min(week_start + timedelta(days=6), end_date)
            start_date = week_start
            end_date = week_end
            
        # Query all production records in the date range
        records = ConvertingProduction.query.filter(
            ConvertingProduction.production_date.between(start_date, end_date)
        ).all()
        
        # Group by date
        daily_data = {}
        total_output = 0
        total_good = 0
        total_reject = 0
        
        # Aggregated downtime across the whole period (month/week)
        period_downtime = {
            'mesin': 0,
            'operator': 0,
            'material': 0,
            'design': 0,
            'idle': 0,
            'others': 0
        }
        period_total_downtime = 0
        
        for r in records:
            d_str = r.production_date.isoformat()
            if d_str not in daily_data:
                daily_data[d_str] = {
                    'date': d_str,
                    'output': 0,
                    'good': 0,
                    'reject': 0,
                    'machines': set(),
                    'downtime_records': []
                }
            
            output_val = float(r.actual_quantity) if r.actual_quantity else 0
            good_val = float(r.good_quantity) if r.good_quantity else 0
            reject_val = float(r.reject_quantity) if r.reject_quantity else 0
            
            daily_data[d_str]['output'] += output_val
            daily_data[d_str]['good'] += good_val
            daily_data[d_str]['reject'] += reject_val
            if r.machine:
                daily_data[d_str]['machines'].add(r.machine.name)
                
            total_output += output_val
            total_good += good_val
            total_reject += reject_val
            
            # Process downtime entries for this record
            entries = r.downtime_entries or []
            for entry in entries:
                duration = int(entry.get('duration_minutes', 0))
                frequency = int(entry.get('frequency', 1))
                entry_total = duration * frequency
                
                cat = entry.get('category', 'others')
                if cat == 'istirahat':
                    cat = 'others'
                    
                period_downtime[cat] = period_downtime.get(cat, 0) + entry_total
                period_total_downtime += entry_total
                
                daily_data[d_str]['downtime_records'].append({
                    'machine_name': r.machine.name if r.machine else 'N/A',
                    'product_name': r.product_name or 'N/A',
                    'shift': r.shift,
                    'duration_minutes': entry_total,
                    'downtime_reason': entry.get('reason', ''),
                    'downtime_category': cat
                })
            
        # Format daily_data to list
        daily_list = []
        for d, val in daily_data.items():
            val['machines'] = ', '.join(sorted(list(val['machines'])))
            daily_list.append(val)
            
        daily_list.sort(key=lambda x: x['date'], reverse=True)
        
        return jsonify({
            'success': True,
            'summary': {
                'total_output': total_output,
                'total_good': total_good,
                'total_reject': total_reject,
                'quality_rate': round((total_good / total_output) * 100, 2) if total_output > 0 else 100,
                'total_downtime': period_total_downtime,
                'downtime_breakdown': period_downtime
            },
            'daily_records': daily_list
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
