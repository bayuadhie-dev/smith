"""
Pre-Shift Checklist API Routes
"""
from flask import Blueprint, request, jsonify, abort
from datetime import datetime, date, timezone, timedelta
from models import db, Machine

# WIB timezone (UTC+7)
WIB = timezone(timedelta(hours=7))
from models.pre_shift_checklist import (
    PreShiftChecklistItem, PreShiftChecklistMachineItem,
    PreShiftChecklistSubmission, PreShiftChecklistAnswer,
    PreShiftChecklistAuditLog, PreShiftChecklistCorrectiveAction
)
from flask_jwt_extended import jwt_required, get_jwt_identity

pre_shift_checklist_bp = Blueprint('pre_shift_checklist', __name__)


@pre_shift_checklist_bp.route('/items', methods=['GET'])
@jwt_required()
def get_checklist_items():
    """Get all checklist items, optionally filtered by category"""
    category = request.args.get('category')
    
    query = PreShiftChecklistItem.query.filter_by(is_active=True)
    if category:
        query = query.filter_by(category=category)
    
    items = query.order_by(PreShiftChecklistItem.category, PreShiftChecklistItem.sort_order).all()
    
    return jsonify({
        'items': [item.to_dict() for item in items]
    })


MACHINE_CHECKLIST_CONFIG = {
    'perforating': {
        'kondisi_mesin': ['PF01', 'PF02', 'PF03', 'PF04', 'PF05', 'PF06', 'PF07'],
        'manpower': ['MP01'],
    },
    'cutting': {
        'kondisi_mesin': ['CT01', 'CT02'],
        'manpower': ['MP01'],
    },
    'oven': {
        'kondisi_mesin': ['OV01', 'OV02', 'OV03', 'OV04', 'OV05'],
        'manpower': ['MP01'],
    },
    'slitting': {
        'kondisi_mesin': ['SL01', 'SL02', 'SL03', 'SL04'],
        'manpower': ['MP01'],
    },
    'fliptop': {
        'kondisi_mesin': ['FT01', 'FT02', 'FT03'],
        'manpower': ['MP01'],
    },
    'mesin 7': {
        'kondisi_mesin': [
            'KM01', 'KM02', 'KM03', 'KM04', 'KM05', 'KM06', 'KM07', 'KM08', 'KM09', 'KM10',
            'KM11', 'KM12', 'KM13', 'KM14', 'KM15', 'KM16', 'KM17', 'KM18', 'KM19',
            'M7OA', 'M7OB', 'M7OC', 'M7OD', 'M7OE', 'M7CT',
        ],
        'manpower': ['MP01', 'MP02', 'MP03', 'MP04', 'MP05', 'MP06', 'MP07', 'MP08'],
    },
    'standard': {
        'kondisi_mesin': [
            'KM01', 'KM02', 'KM03', 'KM04', 'KM05', 'KM06', 'KM07', 'KM08', 'KM09', 'KM10',
            'KM11', 'KM12', 'KM13', 'KM14', 'KM15', 'KM16', 'KM17', 'KM18', 'KM19', 'PLC',
        ],
        'manpower': ['MP01', 'MP02', 'MP03', 'MP04', 'MP05', 'MP06', 'MP07', 'MP08'],
    },
}

EXTRA_ITEMS_TO_CREATE = [
    # Perforating
    ('PF01', 'Sensor mistar penjepit ada 4 sensor', 'KONDISI_MESIN', 101),
    ('PF02', 'Sensor Bracket AS', 'KONDISI_MESIN', 102),
    ('PF03', 'Sensor Pendorong Kain', 'KONDISI_MESIN', 103),
    ('PF04', 'Sensor Transport AS', 'KONDISI_MESIN', 104),
    ('PF05', 'Sensor Stick AS', 'KONDISI_MESIN', 105),
    ('PF06', 'Sensor Pisau', 'KONDISI_MESIN', 106),
    ('PF07', 'Sensor Stopper roll', 'KONDISI_MESIN', 107),
    # Cutting
    ('CT01', 'Pisau Cutting', 'KONDISI_MESIN', 110),
    ('CT02', 'Dinamo', 'KONDISI_MESIN', 111),
    # Oven
    ('OV01', 'Heater', 'KONDISI_MESIN', 120),
    ('OV02', 'Inverter', 'KONDISI_MESIN', 121),
    ('OV03', 'Conveyor', 'KONDISI_MESIN', 122),
    ('OV04', 'Kipas', 'KONDISI_MESIN', 123),
    ('OV05', 'Thermo Control', 'KONDISI_MESIN', 124),
    # Slitting
    ('SL01', 'Sensor Balancing', 'KONDISI_MESIN', 130),
    ('SL02', 'Bearing Pisau', 'KONDISI_MESIN', 131),
    ('SL03', 'Selang Angin', 'KONDISI_MESIN', 132),
    ('SL04', 'Tension', 'KONDISI_MESIN', 133),
    # Mesin 7 extras
    ('M7OA', 'Mesin Obras A', 'KONDISI_MESIN', 150),
    ('M7OB', 'Mesin Obras B', 'KONDISI_MESIN', 151),
    ('M7OC', 'Mesin Obras C', 'KONDISI_MESIN', 152),
    ('M7OD', 'Mesin Obras D', 'KONDISI_MESIN', 153),
    ('M7OE', 'Mesin Obras E', 'KONDISI_MESIN', 154),
    ('M7CT', 'Mesin Cutting', 'KONDISI_MESIN', 155),
    # Fliptop
    ('FT01', 'Lengan Robotic', 'KONDISI_MESIN', 160),
    ('FT02', 'Mesin Lem', 'KONDISI_MESIN', 161),
    ('FT03', 'Sensor', 'KONDISI_MESIN', 162),
    # Standard items
    ('PLC', 'PLC', 'KONDISI_MESIN', 200),
]


def _get_machine_config(machine_name):
    """Determine which config to use based on machine name"""
    name_lower = machine_name.lower()
    for key in ['perforating', 'cutting', 'oven', 'slitting', 'fliptop', 'mesin 7']:
        if key in name_lower:
            return MACHINE_CHECKLIST_CONFIG[key]
    return MACHINE_CHECKLIST_CONFIG['standard']


def _ensure_extra_items_exist():
    """Create extra checklist items (Obras, Fliptop) if they don't exist yet"""
    created = False
    for code, name, category, sort_order in EXTRA_ITEMS_TO_CREATE:
        if not PreShiftChecklistItem.query.filter_by(item_code=code).first():
            item = PreShiftChecklistItem(
                category=category,
                item_code=code,
                item_name=name,
                sort_order=sort_order,
                is_active=True
            )
            db.session.add(item)
            created = True
    if created:
        try:
            db.session.commit()
        except:
            db.session.rollback()


@pre_shift_checklist_bp.route('/machines/<int:machine_id>/items', methods=['GET'])
@jwt_required()
def get_machine_checklist_items(machine_id):
    """Get checklist items applicable for a specific machine"""
    machine = db.session.get(Machine, machine_id) or abort(404)
    
    # Ensure extra items (Obras, Fliptop) exist in DB
    _ensure_extra_items_exist()
    
    # Get config for this machine
    config = _get_machine_config(machine.name)
    allowed_codes = config['kondisi_mesin'] + config['manpower']
    
    # Get all active items
    all_items = PreShiftChecklistItem.query.filter_by(is_active=True)\
        .order_by(PreShiftChecklistItem.category, PreShiftChecklistItem.sort_order).all()
    
    # Filter by allowed codes
    result = []
    for item in all_items:
        if item.item_code in allowed_codes:
            item_dict = item.to_dict()
            item_dict['is_applicable'] = True
            result.append(item_dict)
    
    return jsonify({
        'machine': {'id': machine.id, 'name': machine.name, 'code': machine.code},
        'items': result
    })


@pre_shift_checklist_bp.route('/submit', methods=['POST'])
@jwt_required()
def submit_checklist():
    """Submit a pre-shift checklist"""
    data = request.get_json()
    user_id = get_jwt_identity()
    
    machine_id = data.get('machine_id')
    product_id = data.get('product_id')
    tanggal_str = data.get('tanggal')
    shift = data.get('shift')
    operator_name = data.get('operator_name')
    answers = data.get('answers', [])
    notes = data.get('notes')
    
    if not all([machine_id, tanggal_str, shift]):
        return jsonify({'error': 'machine_id, tanggal, and shift are required'}), 400
    
    tanggal = datetime.strptime(tanggal_str, '%Y-%m-%d').date()
    
    # Check if submission already exists
    existing = PreShiftChecklistSubmission.query.filter_by(
        machine_id=machine_id,
        tanggal=tanggal,
        shift=shift
    ).first()
    
    if existing:
        # Update existing submission
        submission = existing
        submission.product_id = product_id
        submission.operator_name = operator_name
        submission.submitted_by = user_id
        submission.submitted_at = datetime.now(WIB)
        submission.notes = notes
        submission.status = 'submitted'
        
        # Delete existing answers
        PreShiftChecklistAnswer.query.filter_by(submission_id=submission.id).delete()
    else:
        # Create new submission
        submission = PreShiftChecklistSubmission(
            machine_id=machine_id,
            product_id=product_id,
            tanggal=tanggal,
            shift=shift,
            operator_name=operator_name,
            submitted_by=user_id,
            notes=notes,
            status='submitted'
        )
        db.session.add(submission)
        db.session.flush()  # Get the ID
    
    # Add answers
    for ans in answers:
        answer = PreShiftChecklistAnswer(
            submission_id=submission.id,
            item_id=ans.get('item_id'),
            status=ans.get('status', 'NA'),
            catatan=ans.get('catatan'),
            photo_url=ans.get('photo_url')
        )
        db.session.add(answer)
    
    db.session.commit()
    
    # Notif ke Maintenance jika ada NG items
    ng_items = [a for a in answers if a.get('status') == 'NG']
    if ng_items:
        try:
            from utils.send_notification import notify_users_by_role
            machine = db.session.get(Machine, machine_id)
            machine_name = machine.name if machine else f'Mesin #{machine_id}'
            ng_count = len(ng_items)
            notify_users_by_role('Maintenance',
                f'NG Item: {machine_name} - Shift {shift}',
                f'{ng_count} item NG ditemukan di {machine_name} shift {shift} ({tanggal}). Operator: {operator_name or "-"}. Segera periksa.',
                category='maintenance', notification_type='warning', priority='high',
                action_url='/app/maintenance/checklist-ng', reference_type='checklist_submission', reference_id=submission.id)
        except Exception as e:
            print(f"[Notification] Pre-shift NG notif failed: {e}")
    
    return jsonify({
        'message': 'Checklist submitted successfully',
        'submission': submission.to_dict(include_answers=True)
    }), 201


@pre_shift_checklist_bp.route('/submissions', methods=['GET'])
@jwt_required()
def get_submissions():
    """Get checklist submissions with filters"""
    machine_id = request.args.get('machine_id', type=int)
    tanggal_str = request.args.get('tanggal')
    shift = request.args.get('shift', type=int)
    
    query = PreShiftChecklistSubmission.query
    
    if machine_id:
        query = query.filter_by(machine_id=machine_id)
    if tanggal_str:
        tanggal = datetime.strptime(tanggal_str, '%Y-%m-%d').date()
        query = query.filter_by(tanggal=tanggal)
    if shift:
        query = query.filter_by(shift=shift)
    
    submissions = query.order_by(PreShiftChecklistSubmission.tanggal.desc(), 
                                  PreShiftChecklistSubmission.shift).all()
    
    return jsonify({
        'submissions': [s.to_dict() for s in submissions]
    })


@pre_shift_checklist_bp.route('/submissions/<int:submission_id>', methods=['GET'])
@jwt_required()
def get_submission_detail(submission_id):
    """Get a single submission with answers"""
    submission = db.session.get(PreShiftChecklistSubmission, submission_id) or abort(404)
    return jsonify(submission.to_dict(include_answers=True))


@pre_shift_checklist_bp.route('/status', methods=['GET'])
@jwt_required()
def get_checklist_status():
    """Get checklist status for all machines for a given date"""
    tanggal_str = request.args.get('tanggal', date.today().isoformat())
    tanggal = datetime.strptime(tanggal_str, '%Y-%m-%d').date()
    
    # Get all active machines, sorted naturally by name
    machines = Machine.query.filter_by(is_active=True).all()
    # Natural sort: "Mesin 1", "Mesin 2", ..., "Mesin 10", then alphabetical for others
    def natural_sort_key(m):
        import re
        # Extract number if exists
        match = re.search(r'(\d+)', m.name)
        if match:
            # Pad number for proper sorting
            return (0, int(match.group(1)), m.name)
        return (1, 0, m.name)
    machines = sorted(machines, key=natural_sort_key)
    
    # Get submissions for this date
    submissions = PreShiftChecklistSubmission.query.filter_by(tanggal=tanggal).all()
    submission_map = {}
    for s in submissions:
        key = (s.machine_id, s.shift)
        submission_map[key] = s
    
    result = []
    for machine in machines:
        machine_status = {
            'machine_id': machine.id,
            'machine_name': machine.name,
            'machine_code': machine.code,
            'shifts': {}
        }
        for shift in [1, 2, 3]:
            key = (machine.id, shift)
            if key in submission_map:
                sub = submission_map[key]
                machine_status['shifts'][shift] = {
                    'status': 'submitted',
                    'submission_id': sub.id,
                    'submitted_at': sub.submitted_at.isoformat() if sub.submitted_at else None,
                    'operator_name': sub.operator_name
                }
            else:
                machine_status['shifts'][shift] = {
                    'status': 'pending',
                    'submission_id': None
                }
        result.append(machine_status)
    
    return jsonify({
        'tanggal': tanggal.isoformat(),
        'machines': result
    })


@pre_shift_checklist_bp.route('/seed', methods=['POST'])
@jwt_required()
def seed_checklist_items():
    """Seed initial checklist items (Kondisi Mesin + Man Power)"""
    
    # Check if already seeded
    if PreShiftChecklistItem.query.first():
        return jsonify({'message': 'Items already seeded'}), 200
    
    # Kondisi Mesin items (19 items)
    kondisi_mesin = [
        ('KM01', 'End Seal'),
        ('KM02', 'Centre Seal'),
        ('KM03', 'AS Jumbo Roll'),
        ('KM04', 'Stacker'),
        ('KM05', 'Sticker'),
        ('KM06', 'Pounch'),
        ('KM07', 'Pembersihan dan Perawatan'),
        ('KM08', 'Inkjet'),
        ('KM09', 'Temperatur Mesin'),
        ('KM10', 'Line Together'),
        ('KM11', 'Sensor Eyemark'),
        ('KM12', 'Sensor Packaging'),
        ('KM13', 'Sensor Sticker'),
        ('KM14', 'Tekanan Angin'),
        ('KM15', 'Gusset'),
        ('KM16', 'Press'),
        ('KM17', 'Inverter'),
        ('KM18', 'Pisau'),
        ('KM19', 'Jalur Kain'),
    ]
    
    for i, (code, name) in enumerate(kondisi_mesin):
        item = PreShiftChecklistItem(
            category='KONDISI_MESIN',
            item_code=code,
            item_name=name,
            sort_order=i + 1
        )
        db.session.add(item)
    
    # Man Power items (8 items)
    man_power = [
        ('MP01', 'Operator Mesin'),
        ('MP02', 'Helper'),
        ('MP03', 'Karyawan Packing'),
        ('MP04', 'Kesiapan dan Kondisi Karyawan'),
        ('MP05', 'Pembagian Tugas'),
        ('MP06', 'Distribusi'),
        ('MP07', 'Checker'),
        ('MP08', 'Operator Mesin Obras'),
    ]
    
    for i, (code, name) in enumerate(man_power):
        item = PreShiftChecklistItem(
            category='MANPOWER',
            item_code=code,
            item_name=name,
            sort_order=i + 1
        )
        db.session.add(item)
    
    # Placeholder items for Material and Keamanan
    placeholder_material = PreShiftChecklistItem(
        category='MATERIAL',
        item_code='MAT00',
        item_name='Kelengkapan Material (Coming Soon)',
        description='Data BOM belum lengkap - akan diimplementasi setelah data tersedia',
        sort_order=1,
        is_active=False  # Disabled for now
    )
    db.session.add(placeholder_material)
    
    placeholder_keamanan = PreShiftChecklistItem(
        category='KEAMANAN',
        item_code='KA00',
        item_name='Keamanan Mesin (Coming Soon)',
        description='Item keamanan belum di-finalisasi - akan diimplementasi setelah meeting',
        sort_order=1,
        is_active=False  # Disabled for now
    )
    db.session.add(placeholder_keamanan)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Checklist items seeded successfully',
        'count': {
            'kondisi_mesin': len(kondisi_mesin),
            'man_power': len(man_power),
            'placeholder': 2
        }
    }), 201


@pre_shift_checklist_bp.route('/seed-machine-specific', methods=['POST'])
@jwt_required()
def seed_machine_specific_items():
    """Seed machine-specific checklist items (Perforating, Cutting, Oven, Slitting)"""
    
    # Machine-specific items data
    machine_items = {
        'perforating': [
            ('PF01', 'Sensor mistar penjepit ada 4 sensor'),
            ('PF02', 'Sensor Bracket AS'),
            ('PF03', 'Sensor Pendorong Kain'),
            ('PF04', 'Sensor Transport AS'),
            ('PF05', 'Sensor Stick AS'),
            ('PF06', 'Sensor Pisau'),
            ('PF07', 'Sensor Stopper roll'),
        ],
        'cutting': [
            ('CT01', 'Pisau Cutting'),
            ('CT02', 'Dinamo'),
        ],
        'oven': [
            ('OV01', 'Heater'),
            ('OV02', 'Inverter'),
            ('OV03', 'Conveyor'),
            ('OV04', 'Kipas'),
            ('OV05', 'Thermo Control'),
        ],
        'slitting': [
            ('SL01', 'Sensor Balancing'),
            ('SL02', 'Bearing Pisau'),
            ('SL03', 'Selang Angin'),
            ('SL04', 'Tension'),
        ],
        'fliptop': [
            ('FT01', 'Lengan Robotic'),
            ('FT02', 'Mesin Lem'),
            ('FT03', 'Sensor'),
        ],
        'mesin 7': [
            ('M7OA', 'Mesin Obras A'),
            ('M7OB', 'Mesin Obras B'),
            ('M7OC', 'Mesin Obras C'),
            ('M7OD', 'Mesin Obras D'),
            ('M7OE', 'Mesin Obras E'),
        ],
    }
    
    created_items = {}
    machine_mappings = []
    
    for machine_type, items in machine_items.items():
        created_items[machine_type] = []
        
        for i, (code, name) in enumerate(items):
            # Check if item already exists
            existing = PreShiftChecklistItem.query.filter_by(item_code=code).first()
            if existing:
                item = existing
            else:
                item = PreShiftChecklistItem(
                    category='KONDISI_MESIN',
                    item_code=code,
                    item_name=name,
                    description=f'Item spesifik untuk mesin {machine_type.title()}',
                    sort_order=100 + i,  # Higher sort order so they appear after general items
                    is_active=True
                )
                db.session.add(item)
                db.session.flush()  # Get ID
            
            created_items[machine_type].append({'id': item.id, 'code': code, 'name': name})
            
            # Find machines that match this type (by name containing the machine_type)
            machines = Machine.query.filter(
                Machine.name.ilike(f'%{machine_type}%'),
                Machine.is_active == True
            ).all()
            
            for machine in machines:
                # Check if mapping already exists
                existing_mapping = PreShiftChecklistMachineItem.query.filter_by(
                    machine_id=machine.id,
                    item_id=item.id
                ).first()
                
                if not existing_mapping:
                    mapping = PreShiftChecklistMachineItem(
                        machine_id=machine.id,
                        item_id=item.id,
                        is_applicable=True
                    )
                    db.session.add(mapping)
                    machine_mappings.append({
                        'machine': machine.name,
                        'item': code
                    })
    
    # Also set non-applicable for items that don't belong to a machine type
    # Get all machines
    all_machines = Machine.query.filter_by(is_active=True).all()
    
    for machine in all_machines:
        machine_name_lower = machine.name.lower()
        
        for machine_type, items in machine_items.items():
            # If this machine is NOT of this type, mark items as not applicable
            if machine_type not in machine_name_lower:
                for item_data in created_items[machine_type]:
                    existing_mapping = PreShiftChecklistMachineItem.query.filter_by(
                        machine_id=machine.id,
                        item_id=item_data['id']
                    ).first()
                    
                    if not existing_mapping:
                        mapping = PreShiftChecklistMachineItem(
                            machine_id=machine.id,
                            item_id=item_data['id'],
                            is_applicable=False  # Not applicable for this machine
                        )
                        db.session.add(mapping)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Machine-specific checklist items seeded successfully',
        'items': created_items,
        'mappings_created': len(machine_mappings)
    }), 201


@pre_shift_checklist_bp.route('/weekly-summary', methods=['GET'])
@jwt_required()
def get_weekly_summary():
    """Get weekly summary of checklist submissions"""
    # Get week start date (Monday)
    date_str = request.args.get('date')
    if date_str:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    else:
        target_date = date.today()
    
    # Calculate week start (Monday) and end (Sunday)
    week_start = target_date - timedelta(days=target_date.weekday())
    week_end = week_start + timedelta(days=6)
    
    # Get all submissions for this week
    submissions = PreShiftChecklistSubmission.query.filter(
        PreShiftChecklistSubmission.tanggal >= week_start,
        PreShiftChecklistSubmission.tanggal <= week_end
    ).order_by(
        PreShiftChecklistSubmission.tanggal,
        PreShiftChecklistSubmission.machine_id,
        PreShiftChecklistSubmission.shift
    ).all()
    
    # Get all active machines for the week grid
    machines = Machine.query.filter_by(is_active=True).all()
    def natural_sort_key(m):
        import re
        match = re.search(r'(\d+)', m.name)
        if match:
            return (0, int(match.group(1)), m.name)
        return (1, 0, m.name)
    machines = sorted(machines, key=natural_sort_key)
    
    # Build weekly data structure
    dates = []
    current = week_start
    while current <= week_end:
        dates.append(current.isoformat())
        current += timedelta(days=1)
    
    # Create submission map
    submission_map = {}
    for s in submissions:
        key = (s.machine_id, s.tanggal.isoformat(), s.shift)
        submission_map[key] = s.to_dict()
    
    # Build result
    result = {
        'week_start': week_start.isoformat(),
        'week_end': week_end.isoformat(),
        'dates': dates,
        'machines': [{'id': m.id, 'name': m.name, 'code': m.code} for m in machines],
        'submissions': [s.to_dict() for s in submissions],
        'summary': []
    }
    
    # Build summary per machine per date
    for machine in machines:
        machine_data = {
            'machine_id': machine.id,
            'machine_name': machine.name,
            'days': {}
        }
        for d in dates:
            day_shifts = {}
            for shift in [1, 2, 3]:
                key = (machine.id, d, shift)
                if key in submission_map:
                    day_shifts[shift] = submission_map[key]
                else:
                    day_shifts[shift] = None
            machine_data['days'][d] = day_shifts
        result['summary'].append(machine_data)
    
    return jsonify(result)


@pre_shift_checklist_bp.route('/seed-machines', methods=['POST'])
@jwt_required()
def seed_additional_machines():
    """Seed additional machines: Perforating, Cutting, Oven, Slitting"""
    
    new_machines = [
        {'code': 'PERF-01', 'name': 'Mesin Perforating', 'machine_type': 'perforating_machine'},
        {'code': 'CUT-01', 'name': 'Mesin Cutting', 'machine_type': 'cutting_machine'},
        {'code': 'OVEN-01', 'name': 'Mesin Oven', 'machine_type': 'oven_machine'},
        {'code': 'SLIT-01', 'name': 'Mesin Slitting', 'machine_type': 'slitting_machine'},
    ]
    
    created = []
    for m in new_machines:
        # Check if already exists
        existing = Machine.query.filter_by(code=m['code']).first()
        if existing:
            created.append({'id': existing.id, 'code': m['code'], 'name': m['name'], 'status': 'already_exists'})
            continue
        
        machine = Machine(
            code=m['code'],
            name=m['name'],
            machine_type=m['machine_type'],
            status='idle',
            is_active=True
        )
        db.session.add(machine)
        db.session.flush()
        created.append({'id': machine.id, 'code': m['code'], 'name': m['name'], 'status': 'created'})
    
    db.session.commit()
    
    return jsonify({
        'message': 'Additional machines seeded successfully',
        'machines': created
    }), 201


@pre_shift_checklist_bp.route('/seed-fliptop', methods=['POST'])
@jwt_required()
def seed_fliptop_machine():
    """Seed Mesin Fliptop with its checklist items"""
    
    result = {'machine': None, 'items': [], 'mappings': []}
    
    # 1. Add Mesin Fliptop
    existing_machine = Machine.query.filter_by(code='FLIPTOP-01').first()
    if existing_machine:
        fliptop_id = existing_machine.id
        result['machine'] = {'id': fliptop_id, 'name': 'Mesin Fliptop', 'status': 'already_exists'}
    else:
        machine = Machine(
            code='FLIPTOP-01',
            name='Mesin Fliptop',
            machine_type='fliptop_machine',
            status='idle',
            is_active=True
        )
        db.session.add(machine)
        db.session.flush()
        fliptop_id = machine.id
        result['machine'] = {'id': fliptop_id, 'name': 'Mesin Fliptop', 'status': 'created'}
    
    # 2. Add checklist items for Fliptop
    fliptop_items = [
        ('FLIPTOP_ROBOTIC', 'Lengan Robotic', 'KONDISI_MESIN'),
        ('FLIPTOP_LEM', 'Mesin Lem', 'KONDISI_MESIN'),
        ('FLIPTOP_SENSOR', 'Sensor', 'KONDISI_MESIN'),
    ]
    
    item_ids = []
    for code, name, category in fliptop_items:
        existing_item = PreShiftChecklistItem.query.filter_by(item_code=code).first()
        if existing_item:
            item_ids.append(existing_item.id)
            result['items'].append({'id': existing_item.id, 'name': name, 'status': 'already_exists'})
        else:
            item = PreShiftChecklistItem(
                item_code=code,
                item_name=name,
                category=category,
                is_active=True
            )
            db.session.add(item)
            db.session.flush()
            item_ids.append(item.id)
            result['items'].append({'id': item.id, 'name': name, 'status': 'created'})
    
    # 3. Map items to Fliptop machine
    for item_id in item_ids:
        existing_mapping = PreShiftChecklistMachineItem.query.filter_by(
            machine_id=fliptop_id, item_id=item_id
        ).first()
        if not existing_mapping:
            mapping = PreShiftChecklistMachineItem(
                machine_id=fliptop_id,
                item_id=item_id,
                is_applicable=True
            )
            db.session.add(mapping)
            result['mappings'].append({'item_id': item_id, 'status': 'created'})
        else:
            result['mappings'].append({'item_id': item_id, 'status': 'already_exists'})
    
    # 4. Add MANPOWER - Operator Mesin (ID 20) for Fliptop
    operator_item = PreShiftChecklistItem.query.filter_by(item_code='MP001').first()
    if operator_item:
        existing_op_mapping = PreShiftChecklistMachineItem.query.filter_by(
            machine_id=fliptop_id, item_id=operator_item.id
        ).first()
        if not existing_op_mapping:
            op_mapping = PreShiftChecklistMachineItem(
                machine_id=fliptop_id,
                item_id=operator_item.id,
                is_applicable=True
            )
            db.session.add(op_mapping)
            result['mappings'].append({'item_id': operator_item.id, 'name': 'Operator Mesin', 'status': 'created'})
    
    # 5. Mark Fliptop items as NOT applicable for other machines
    all_machines = Machine.query.filter(Machine.id != fliptop_id).all()
    for machine in all_machines:
        for item_id in item_ids:
            existing = PreShiftChecklistMachineItem.query.filter_by(
                machine_id=machine.id, item_id=item_id
            ).first()
            if not existing:
                mapping = PreShiftChecklistMachineItem(
                    machine_id=machine.id,
                    item_id=item_id,
                    is_applicable=False
                )
                db.session.add(mapping)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Mesin Fliptop seeded successfully',
        'result': result
    }), 201


# ==================== AUDIT TRAIL & CORRECTIVE ACTION ====================

def log_audit(submission_id=None, answer_id=None, action='updated', field_name=None, 
              old_value=None, new_value=None, user_id=None, notes=None):
    """Helper function to create audit log entry"""
    audit = PreShiftChecklistAuditLog(
        submission_id=submission_id,
        answer_id=answer_id,
        action=action,
        field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        changed_by=user_id,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent', '')[:500],
        notes=notes
    )
    db.session.add(audit)
    return audit


@pre_shift_checklist_bp.route('/answers/<int:answer_id>/update', methods=['PUT'])
@jwt_required()
def update_answer(answer_id):
    """Update a single answer (for maintenance to update NG items)"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    answer = db.session.get(PreShiftChecklistAnswer, answer_id) or abort(404)
    old_status = answer.status
    old_catatan = answer.catatan
    
    new_status = data.get('status', answer.status)
    new_catatan = data.get('catatan', answer.catatan)
    
    # Log status change
    if new_status != old_status:
        log_audit(
            submission_id=answer.submission_id,
            answer_id=answer.id,
            action='status_changed',
            field_name='status',
            old_value=old_status,
            new_value=new_status,
            user_id=user_id,
            notes=data.get('edit_notes')
        )
    
    # Log catatan change
    if new_catatan != old_catatan:
        log_audit(
            submission_id=answer.submission_id,
            answer_id=answer.id,
            action='updated',
            field_name='catatan',
            old_value=old_catatan,
            new_value=new_catatan,
            user_id=user_id
        )
    
    answer.status = new_status
    answer.catatan = new_catatan
    
    db.session.commit()
    
    return jsonify({
        'message': 'Answer updated successfully',
        'answer': answer.to_dict()
    })


@pre_shift_checklist_bp.route('/answers/<int:answer_id>/audit-logs', methods=['GET'])
@jwt_required()
def get_answer_audit_logs(answer_id):
    """Get audit logs for a specific answer"""
    answer = db.session.get(PreShiftChecklistAnswer, answer_id) or abort(404)
    logs = PreShiftChecklistAuditLog.query.filter_by(answer_id=answer_id)\
        .order_by(PreShiftChecklistAuditLog.changed_at.desc()).all()
    
    return jsonify({
        'answer': answer.to_dict(),
        'audit_logs': [log.to_dict() for log in logs]
    })


@pre_shift_checklist_bp.route('/submissions/<int:submission_id>/audit-logs', methods=['GET'])
@jwt_required()
def get_submission_audit_logs(submission_id):
    """Get all audit logs for a submission"""
    submission = db.session.get(PreShiftChecklistSubmission, submission_id) or abort(404)
    logs = PreShiftChecklistAuditLog.query.filter_by(submission_id=submission_id)\
        .order_by(PreShiftChecklistAuditLog.changed_at.desc()).all()
    
    return jsonify({
        'submission': submission.to_dict(),
        'audit_logs': [log.to_dict() for log in logs]
    })


@pre_shift_checklist_bp.route('/answers/<int:answer_id>/corrective-action', methods=['POST'])
@jwt_required()
def create_corrective_action(answer_id):
    """Create or update corrective action for NG item"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    answer = db.session.get(PreShiftChecklistAnswer, answer_id) or abort(404)
    
    # Check if corrective action already exists
    existing = PreShiftChecklistCorrectiveAction.query.filter_by(answer_id=answer_id).first()
    
    if existing:
        corrective = existing
        # Log update
        log_audit(
            submission_id=answer.submission_id,
            answer_id=answer_id,
            action='corrective_updated',
            field_name='repair_status',
            old_value=existing.repair_status,
            new_value=data.get('repair_status', existing.repair_status),
            user_id=user_id
        )
    else:
        corrective = PreShiftChecklistCorrectiveAction(answer_id=answer_id)
        db.session.add(corrective)
        # Log creation
        log_audit(
            submission_id=answer.submission_id,
            answer_id=answer_id,
            action='corrective_added',
            user_id=user_id,
            notes='Corrective action created'
        )
    
    # Update fields
    corrective.repair_status = data.get('repair_status', corrective.repair_status)
    corrective.repair_notes = data.get('repair_notes', corrective.repair_notes)
    corrective.reason_cannot_repair = data.get('reason_cannot_repair')
    corrective.deferred_reason = data.get('deferred_reason')
    corrective.handled_by = user_id
    
    if data.get('deferred_until'):
        corrective.deferred_until = datetime.strptime(data['deferred_until'], '%Y-%m-%d').date()
    
    # Set timestamps based on status
    if corrective.repair_status == 'in_progress' and not corrective.started_at:
        corrective.started_at = datetime.now(WIB)
    elif corrective.repair_status == 'completed' and not corrective.completed_at:
        corrective.completed_at = datetime.now(WIB)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Corrective action saved',
        'corrective_action': corrective.to_dict()
    }), 201


@pre_shift_checklist_bp.route('/corrective-action/<int:answer_id>/supervisor-note', methods=['POST', 'PUT'])
@jwt_required()
def add_supervisor_note(answer_id):
    """Add supervisor note and priority to NG item"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    answer = db.session.get(PreShiftChecklistAnswer, answer_id) or abort(404)
    
    if answer.status != 'NG':
        return jsonify({'error': 'Only NG items can have supervisor notes'}), 400
    
    # Get or create corrective action
    corrective = PreShiftChecklistCorrectiveAction.query.filter_by(answer_id=answer_id).first()
    if not corrective:
        corrective = PreShiftChecklistCorrectiveAction(answer_id=answer_id)
        db.session.add(corrective)
    
    # Update supervisor fields
    corrective.supervisor_note = data.get('supervisor_note')
    corrective.priority = data.get('priority', 'normal')  # urgent, high, normal, low
    corrective.supervisor_id = user_id
    corrective.supervisor_noted_at = datetime.now(WIB)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Supervisor note saved',
        'corrective_action': corrective.to_dict()
    })


@pre_shift_checklist_bp.route('/ng-items', methods=['GET'])
@jwt_required()
def get_ng_items():
    """Get all NG items for maintenance dashboard"""
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    machine_id = request.args.get('machine_id', type=int)
    repair_status = request.args.get('repair_status')  # pending, in_progress, completed, cannot_repair
    
    # Join answers with submissions to get machine info
    # Exclude MANPOWER category - only machine-related NG items
    query = db.session.query(PreShiftChecklistAnswer)\
        .join(PreShiftChecklistSubmission)\
        .join(PreShiftChecklistItem, PreShiftChecklistAnswer.item_id == PreShiftChecklistItem.id)\
        .filter(PreShiftChecklistAnswer.status == 'NG')\
        .filter(PreShiftChecklistItem.category != 'MANPOWER')
    
    if date_from:
        df = datetime.strptime(date_from, '%Y-%m-%d').date()
        query = query.filter(PreShiftChecklistSubmission.tanggal >= df)
    if date_to:
        dt = datetime.strptime(date_to, '%Y-%m-%d').date()
        query = query.filter(PreShiftChecklistSubmission.tanggal <= dt)
    if machine_id:
        query = query.filter(PreShiftChecklistSubmission.machine_id == machine_id)
    
    answers = query.order_by(PreShiftChecklistSubmission.tanggal.desc()).all()
    
    result = []
    for ans in answers:
        sub = ans.submission
        item_data = {
            'answer_id': ans.id,
            'item_id': ans.item_id,
            'item_name': ans.item.item_name if ans.item else None,
            'item_category': ans.item.category if ans.item else None,
            'catatan': ans.catatan,
            'machine_id': sub.machine_id,
            'machine_name': sub.machine.name if sub.machine else None,
            'tanggal': sub.tanggal.isoformat(),
            'shift': sub.shift,
            'operator_name': sub.operator_name,
            'submission_id': sub.id,
            'corrective_action': None
        }
        
        # Get corrective action if exists
        corrective = PreShiftChecklistCorrectiveAction.query.filter_by(answer_id=ans.id).first()
        if corrective:
            item_data['corrective_action'] = corrective.to_dict()
            # Filter by repair_status if specified
            if repair_status and corrective.repair_status != repair_status:
                continue
        elif repair_status and repair_status != 'pending':
            continue
        
        result.append(item_data)
    
    return jsonify({
        'ng_items': result,
        'total': len(result)
    })
