from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db
from models.hr import Attendance, OfficeLocation, Employee, AttendanceCorrectionRequest, AttendanceReconciliationFlag
from models.user import User
from datetime import datetime, date, timedelta
from utils.timezone import get_local_now, get_local_today
import hashlib
import base64
import math

attendance_bp = Blueprint('attendance', __name__)


def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates using Haversine formula (in meters)"""
    R = 6371000  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c  # Distance in meters


def validate_location(latitude, longitude):
    """Validate if location is within allowed radius of office"""
    # Get default office location
    office = OfficeLocation.query.filter(
        OfficeLocation.is_active == True,
        OfficeLocation.is_default == True
    ).first()
    
    if not office:
        # Fallback to first active location
        office = OfficeLocation.query.filter(OfficeLocation.is_active == True).first()
    
    if not office:
        # No office configured, skip validation
        return True, None, None
    
    distance = calculate_distance(latitude, longitude, office.latitude, office.longitude)
    is_valid = distance <= office.radius_meters
    
    return is_valid, distance, office


def cors_preflight_response():
    """Return proper CORS preflight response"""
    response = make_response()
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    return response


@attendance_bp.route('/detect-face', methods=['POST', 'OPTIONS'])
def detect_face():
    """Endpoint to run OpenCV face detection on photo and return detection results & confidence score"""
    if request.method == 'OPTIONS':
        return cors_preflight_response()
    try:
        data = request.get_json() or {}
        photo_base64 = data.get('photo_base64', '')
        if not photo_base64:
            return jsonify({'success': False, 'error': 'Foto tidak ditemukan'}), 400

        from utils.face_detector import detect_face_in_image
        res = detect_face_in_image(photo_base64)
        return jsonify({
            'success': True,
            'detected': res['detected'],
            'confidence': res['confidence'],
            'count': res['count'],
            'error': res['error']
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def get_client_ip():
    """Get client IP address"""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    return request.remote_addr


# ==================== PUBLIC ENDPOINTS (No Auth Required) ====================

def to_proper_case(name):
    """Convert name to proper case (capitalize first letter of each word)"""
    if not name:
        return name
    return ' '.join(word.capitalize() for word in name.strip().split())


@attendance_bp.route('/public/check', methods=['GET', 'POST', 'OPTIONS'])
def public_check_attendance():
    # Handle preflight request
    if request.method == 'OPTIONS':
        return cors_preflight_response()
    
    """Check today's attendance by name"""
    try:
        # Support both GET and POST
        if request.method == 'GET':
            name = request.args.get('name', '').strip()
        else:
            data = request.get_json()
            name = data.get('name', '').strip()
        
        if not name:
            return jsonify({'error': 'Nama wajib diisi'}), 400
        
        # Format name to proper case
        formatted_name = to_proper_case(name)
        
        # Get today's attendance for this name (check notes field with [NAME:xxx] pattern)
        today = get_local_today()
        attendance = Attendance.query.filter(
            Attendance.attendance_date == today,
            Attendance.notes.ilike(f'%[NAME:{formatted_name}]%')
        ).first()
        
        return jsonify({
            'name': formatted_name,
            'attendance': attendance.to_dict() if attendance else None
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/public/clock-in', methods=['POST', 'OPTIONS'])
def public_clock_in():
    # Handle preflight request
    if request.method == 'OPTIONS':
        return cors_preflight_response()
    """Public clock in with photo verification - using name"""
    try:
        from models.hr import Employee
        
        data = request.get_json()
        name = data.get('name', '').strip()
        jabatan = data.get('jabatan', '').strip()
        departemen = data.get('departemen', '').strip()
        
        if not name:
            return jsonify({'error': 'Nama wajib diisi'}), 400
        
        # Format name to proper case for consistency
        formatted_name = to_proper_case(name)
        
        # Try to find employee by name (fuzzy match)
        employee = Employee.query.filter(
            db.func.lower(Employee.full_name) == formatted_name.lower()
        ).first()
        
        # If not found, try partial match
        if not employee:
            employee = Employee.query.filter(
                Employee.full_name.ilike(f'%{formatted_name}%')
            ).first()
        
        today = get_local_today()
        now = get_local_now()
        
        # Check if already clocked in today (by name stored in notes)
        existing = Attendance.query.filter(
            Attendance.attendance_date == today,
            Attendance.clock_in.isnot(None),
            Attendance.notes.like(f'%[NAME:{formatted_name}]%')
        ).first()
        
        if existing:
            return jsonify({
                'error': 'Anda sudah melakukan clock in hari ini',
                'clock_in_time': existing.clock_in.strftime('%H:%M:%S')
            }), 400
        
        # Get photo data
        photo_base64 = data.get('photo_base64')
        if not photo_base64:
            return jsonify({'error': 'Foto wajib diambil untuk absensi'}), 400
        
        # Calculate photo hash
        if ',' in photo_base64:
            photo_base64 = photo_base64.split(',')[1]
        
        try:
            photo_bytes = base64.b64decode(photo_base64)
            photo_hash = hashlib.sha256(photo_bytes).hexdigest()
            photo_size = len(photo_bytes)
        except Exception as e:
            return jsonify({'error': f'Invalid photo data: {str(e)}'}), 400
        
        # Real face detection using OpenCV
        from utils.face_detector import detect_face_in_image
        detection = detect_face_in_image(photo_base64)
        
        face_detected = data.get('face_detected', detection['detected'])
        face_confidence = data.get('face_confidence', detection['confidence'])
        face_count = data.get('face_count', detection['count'])
        
        if not face_detected or not detection['detected']:
            return jsonify({'error': detection['error'] or 'Wajah tidak terdeteksi. Pastikan wajah terlihat jelas di kamera.'}), 400
        
        if face_count > 1 or detection['count'] > 1:
            return jsonify({'error': f'Terdeteksi {max(face_count, detection["count"])} wajah. Pastikan hanya ada 1 wajah.'}), 400
        
        # GPS/Location validation
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        gps_accuracy = data.get('gps_accuracy')
        location_valid = None
        distance_from_office = None
        
        if latitude is not None and longitude is not None:
            is_valid, distance, office = validate_location(float(latitude), float(longitude))
            location_valid = is_valid
            distance_from_office = round(distance, 2) if distance else None
            
            if office and not is_valid:
                return jsonify({
                    'error': f'Lokasi Anda terlalu jauh dari kantor. Jarak: {int(distance)} meter (maksimal {office.radius_meters} meter)',
                    'distance': int(distance),
                    'allowed_radius': office.radius_meters
                }), 400
        
        # Build notes with name tag
        notes_parts = [f'[NAME:{formatted_name}]']
        
        # Check if late (after office start + tolerance)
        from utils.helpers import get_setting_value
        from datetime import timedelta
        start_time_str = get_setting_value('attendance.office_start_time', '08:00')
        tolerance_min = get_setting_value('attendance.late_tolerance_minutes', 30)
        try:
            start_time = datetime.strptime(start_time_str, '%H:%M')
        except ValueError:
            start_time = datetime.strptime('08:00', '%H:%M')
        late_time = (start_time + timedelta(minutes=int(tolerance_min))).time()
        late_threshold = datetime.combine(today, late_time)
        
        status = 'present'
        if now > late_threshold:
            status = 'late'
            late_minutes = int((now - late_threshold).total_seconds() / 60)
            notes_parts.append(f'Terlambat {late_minutes} menit')
        
        # Create attendance record
        attendance = Attendance(
            employee_id=employee.id if employee else None,
            attendance_date=today,
            clock_in=now,
            status=status,
            photo_hash=photo_hash,
            photo_size_bytes=photo_size,
            face_detected=face_detected,
            face_confidence=face_confidence,
            face_count=face_count,
            clock_in_latitude=float(latitude) if latitude else None,
            clock_in_longitude=float(longitude) if longitude else None,
            clock_in_accuracy=float(gps_accuracy) if gps_accuracy else None,
            clock_in_distance=distance_from_office,
            clock_in_location_valid=location_valid,
            staff_jabatan=jabatan if jabatan else None,
            staff_departemen=departemen if departemen else None,
            device_info=request.headers.get('User-Agent', '')[:500],
            ip_address=get_client_ip(),
            verification_status='verified',
            notes=' | '.join(notes_parts)
        )
        
        db.session.add(attendance)
        db.session.commit()
        
        # Return with name included
        result = attendance.to_dict()
        result['attendee_name'] = formatted_name
        
        return jsonify({
            'message': 'Clock in berhasil',
            'attendance': result
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/public/clock-out', methods=['POST', 'OPTIONS'])
def public_clock_out():
    # Handle preflight request
    if request.method == 'OPTIONS':
        return cors_preflight_response()
    """Public clock out - no photo needed, using name"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        
        if not name:
            return jsonify({'error': 'Nama wajib diisi'}), 400
        
        # Format name to proper case
        formatted_name = to_proper_case(name)
        
        today = get_local_today()
        now = get_local_now()
        
        # Find today's attendance by name
        attendance = Attendance.query.filter(
            Attendance.attendance_date == today,
            Attendance.clock_in.isnot(None),
            Attendance.notes.like(f'%[NAME:{formatted_name}]%')
        ).first()
        
        if not attendance:
            return jsonify({'error': 'Anda belum melakukan clock in hari ini'}), 400
        
        if attendance.clock_out:
            return jsonify({
                'error': 'Anda sudah melakukan clock out hari ini',
                'clock_out_time': attendance.clock_out.strftime('%H:%M:%S')
            }), 400
        
        # Update attendance
        attendance.clock_out = now
        
        # Calculate worked hours
        if attendance.clock_in:
            worked_seconds = (now - attendance.clock_in).total_seconds()
            attendance.worked_hours = round(worked_seconds / 3600, 2)
            
            # Calculate overtime (after office end time)
            from utils.helpers import get_setting_value
            end_time_str = get_setting_value('attendance.office_end_time', '17:00')
            try:
                end_time = datetime.strptime(end_time_str, '%H:%M').time()
            except ValueError:
                end_time = datetime.strptime('17:00', '%H:%M').time()
            standard_end = datetime.combine(today, end_time)
            if now > standard_end:
                overtime_seconds = (now - standard_end).total_seconds()
                attendance.overtime_hours = round(overtime_seconds / 3600, 2)
        
        db.session.commit()
        
        # Return with name included
        result = attendance.to_dict()
        result['attendee_name'] = formatted_name
        
        return jsonify({
            'message': 'Clock out berhasil',
            'attendance': result
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== AUTHENTICATED ENDPOINTS ====================


@attendance_bp.route('/clock-in', methods=['POST'])
@jwt_required()
@require_permission('attendance.create')
def clock_in():
    """Clock in with photo verification"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        today = get_local_today()
        now = get_local_now()
        
        # Check if already clocked in today
        existing = Attendance.query.filter(
            Attendance.user_id == user_id,
            Attendance.attendance_date == today,
            Attendance.clock_in.isnot(None)
        ).first()
        
        if existing:
            return jsonify({
                'error': 'Anda sudah melakukan clock in hari ini',
                'clock_in_time': existing.clock_in.strftime('%H:%M:%S')
            }), 400
        
        # Get photo data (base64)
        photo_base64 = data.get('photo_base64')
        if not photo_base64:
            return jsonify({'error': 'Foto wajib diambil untuk absensi'}), 400
        
        # Calculate photo hash (SHA-256)
        # Remove base64 header if present
        if ',' in photo_base64:
            photo_base64 = photo_base64.split(',')[1]
        
        import base64
        try:
            photo_bytes = base64.b64decode(photo_base64)
            photo_hash = hashlib.sha256(photo_bytes).hexdigest()
            photo_size = len(photo_bytes)
        except Exception as e:
            return jsonify({'error': f'Invalid photo data: {str(e)}'}), 400
        
        # Real face detection using OpenCV
        from utils.face_detector import detect_face_in_image
        detection = detect_face_in_image(photo_base64)
        
        face_detected = data.get('face_detected', detection['detected'])
        face_confidence = data.get('face_confidence', detection['confidence'])
        face_count = data.get('face_count', detection['count'])
        
        if not face_detected or not detection['detected']:
            return jsonify({'error': detection['error'] or 'Wajah tidak terdeteksi. Pastikan wajah terlihat jelas di kamera.'}), 400
        
        if face_count > 1 or detection['count'] > 1:
            return jsonify({'error': f'Terdeteksi {max(face_count, detection["count"])} wajah. Pastikan hanya ada 1 wajah di foto.'}), 400
        
        if face_confidence < 60 and detection['confidence'] < 60:
            return jsonify({'error': f'Confidence wajah terlalu rendah ({detection["confidence"]:.1f}%). Pastikan pencahayaan cukup.'}), 400
        
        # Create attendance record
        attendance = Attendance(
            user_id=user_id,
            attendance_date=today,
            clock_in=now,
            status='present',
            photo_hash=photo_hash,
            photo_size_bytes=photo_size,
            face_detected=face_detected,
            face_confidence=face_confidence,
            face_count=face_count,
            device_info=request.headers.get('User-Agent', '')[:500],
            ip_address=get_client_ip(),
            verification_status='verified'  # Auto-verified if face detected
        )
        
        # Check if late (after office start + tolerance)
        from utils.helpers import get_setting_value
        from datetime import timedelta
        start_time_str = get_setting_value('attendance.office_start_time', '08:00')
        tolerance_min = get_setting_value('attendance.late_tolerance_minutes', 30)
        try:
            start_time = datetime.strptime(start_time_str, '%H:%M')
        except ValueError:
            start_time = datetime.strptime('08:00', '%H:%M')
        late_time = (start_time + timedelta(minutes=int(tolerance_min))).time()
        late_threshold = datetime.combine(today, late_time)
        
        if now > late_threshold:
            attendance.status = 'late'
            late_minutes = int((now - late_threshold).total_seconds() / 60)
            attendance.notes = f'Terlambat {late_minutes} menit'
        
        db.session.add(attendance)
        db.session.commit()
        
        return jsonify({
            'message': 'Clock in berhasil',
            'attendance': attendance.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/clock-out', methods=['POST'])
@jwt_required()
@require_permission('attendance.create')
def clock_out():
    """Clock out with photo verification"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        today = get_local_today()
        now = get_local_now()
        
        # Find today's attendance record
        attendance = Attendance.query.filter(
            Attendance.user_id == user_id,
            Attendance.attendance_date == today,
            Attendance.clock_in.isnot(None)
        ).first()
        
        if not attendance:
            return jsonify({'error': 'Anda belum melakukan clock in hari ini'}), 400
        
        if attendance.clock_out:
            return jsonify({
                'error': 'Anda sudah melakukan clock out hari ini',
                'clock_out_time': attendance.clock_out.strftime('%H:%M:%S')
            }), 400
        
        # Get photo data (base64)
        photo_base64 = data.get('photo_base64')
        if not photo_base64:
            return jsonify({'error': 'Foto wajib diambil untuk absensi'}), 400
        
        # Calculate photo hash
        if ',' in photo_base64:
            photo_base64 = photo_base64.split(',')[1]
        
        import base64
        try:
            photo_bytes = base64.b64decode(photo_base64)
            photo_hash = hashlib.sha256(photo_bytes).hexdigest()
        except Exception as e:
            return jsonify({'error': f'Invalid photo data: {str(e)}'}), 400
        
        # Real face detection using OpenCV
        from utils.face_detector import detect_face_in_image
        detection = detect_face_in_image(photo_base64)
        
        face_detected = data.get('face_detected', detection['detected'])
        face_confidence = data.get('face_confidence', detection['confidence'])
        face_count = data.get('face_count', detection['count'])
        
        if not face_detected or not detection['detected']:
            return jsonify({'error': detection['error'] or 'Wajah tidak terdeteksi. Pastikan wajah terlihat jelas di kamera.'}), 400
        
        if face_count > 1 or detection['count'] > 1:
            return jsonify({'error': f'Terdeteksi {max(face_count, detection["count"])} wajah. Pastikan hanya ada 1 wajah di foto.'}), 400
        
        # Update attendance record
        attendance.clock_out = now
        
        # Calculate worked hours
        if attendance.clock_in:
            worked_seconds = (now - attendance.clock_in).total_seconds()
            attendance.worked_hours = round(worked_seconds / 3600, 2)
            
            # Calculate overtime (after office end time)
            from utils.helpers import get_setting_value
            end_time_str = get_setting_value('attendance.office_end_time', '17:00')
            try:
                end_time = datetime.strptime(end_time_str, '%H:%M').time()
            except ValueError:
                end_time = datetime.strptime('17:00', '%H:%M').time()
            standard_end = datetime.combine(today, end_time)
            if now > standard_end:
                overtime_seconds = (now - standard_end).total_seconds()
                attendance.overtime_hours = round(overtime_seconds / 3600, 2)
        
        # Check early leave (before office end time)
        from utils.helpers import get_setting_value
        end_time_str = get_setting_value('attendance.office_end_time', '17:00')
        try:
            end_time = datetime.strptime(end_time_str, '%H:%M').time()
        except ValueError:
            end_time = datetime.strptime('17:00', '%H:%M').time()
        early_threshold = datetime.combine(today, end_time)
        if now < early_threshold:
            early_minutes = int((early_threshold - now).total_seconds() / 60)
            if attendance.notes:
                attendance.notes += f'; Pulang awal {early_minutes} menit'
            else:
                attendance.notes = f'Pulang awal {early_minutes} menit'
        
        db.session.commit()
        
        return jsonify({
            'message': 'Clock out berhasil',
            'attendance': attendance.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/today', methods=['GET'])
@jwt_required()
@require_permission('attendance.view')
def get_today_attendance():
    """Get current user's attendance for today"""
    try:
        user_id = get_jwt_identity()
        today = get_local_today()
        
        attendance = Attendance.query.filter(
            Attendance.user_id == user_id,
            Attendance.attendance_date == today
        ).first()
        
        return jsonify({
            'attendance': attendance.to_dict() if attendance else None,
            'date': today.isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/history', methods=['GET'])
@jwt_required()
@require_permission('attendance.view')
def get_attendance_history():
    """Get current user's attendance history"""
    try:
        user_id = get_jwt_identity()
        
        # Date range
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 30, type=int)
        
        query = Attendance.query.filter(Attendance.user_id == user_id)
        
        if start_date:
            query = query.filter(Attendance.attendance_date >= datetime.strptime(start_date, '%Y-%m-%d').date())
        if end_date:
            query = query.filter(Attendance.attendance_date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        
        # Default to current month if no dates specified
        if not start_date and not end_date:
            today = get_local_today()
            first_day = today.replace(day=1)
            query = query.filter(Attendance.attendance_date >= first_day)
        
        attendances = query.order_by(Attendance.attendance_date.desc()).paginate(page=page, per_page=per_page)
        
        return jsonify({
            'attendances': [a.to_dict() for a in attendances.items],
            'total': attendances.total,
            'pages': attendances.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/summary', methods=['GET'])
@jwt_required()
@require_permission('attendance.view')
def get_attendance_summary():
    """Get attendance summary for current month"""
    try:
        user_id = get_jwt_identity()
        
        # Get month/year from params or use current
        month = request.args.get('month', get_local_today().month, type=int)
        year = request.args.get('year', get_local_today().year, type=int)
        
        # Calculate date range
        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)
        
        # Get attendances for the month
        attendances = Attendance.query.filter(
            Attendance.user_id == user_id,
            Attendance.attendance_date >= first_day,
            Attendance.attendance_date <= last_day
        ).all()
        
        # Calculate summary
        total_days = (last_day - first_day).days + 1
        present_days = len([a for a in attendances if a.status in ['present', 'late']])
        late_days = len([a for a in attendances if a.status == 'late'])
        absent_days = total_days - present_days  # Simplified
        total_worked_hours = sum(float(a.worked_hours or 0) for a in attendances)
        total_overtime = sum(float(a.overtime_hours or 0) for a in attendances)
        
        return jsonify({
            'summary': {
                'month': month,
                'year': year,
                'total_work_days': total_days,
                'present_days': present_days,
                'late_days': late_days,
                'absent_days': absent_days,
                'total_worked_hours': round(total_worked_hours, 2),
                'total_overtime_hours': round(total_overtime, 2)
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/admin/list', methods=['GET'])
@jwt_required()
@require_permission('attendance.view')
def admin_get_all_attendance():
    """Admin: Get all users' attendance"""
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        
        # Check admin permission
        if not user or not (user.is_admin or user.is_super_admin):
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Filters
        target_date = request.args.get('date', get_local_today().isoformat())
        target_user_id = request.args.get('user_id', type=int)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        query = Attendance.query
        
        if target_date:
            query = query.filter(Attendance.attendance_date == datetime.strptime(target_date, '%Y-%m-%d').date())
        
        if target_user_id:
            query = query.filter(Attendance.user_id == target_user_id)
        
        attendances = query.order_by(Attendance.attendance_date.desc(), Attendance.clock_in.desc()).paginate(page=page, per_page=per_page)
        
        return jsonify({
            'attendances': [a.to_dict() for a in attendances.items],
            'total': attendances.total,
            'pages': attendances.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/admin/verify/<int:attendance_id>', methods=['PUT'])
@jwt_required()
@require_permission('attendance.edit')
def admin_verify_attendance(attendance_id):
    """Admin: Verify or reject attendance"""
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        
        if not user or not (user.is_admin or user.is_super_admin):
            return jsonify({'error': 'Unauthorized'}), 403
        
        attendance = db.session.get(Attendance, attendance_id)
        if not attendance:
            return jsonify({'error': 'Attendance not found'}), 404
        
        data = request.get_json()
        action = data.get('action')  # 'verify' or 'reject'
        
        if action == 'verify':
            attendance.verification_status = 'verified'
        elif action == 'reject':
            attendance.verification_status = 'rejected'
            attendance.rejection_reason = data.get('reason', 'Ditolak oleh admin')
        else:
            return jsonify({'error': 'Invalid action'}), 400
        
        attendance.verified_by = user_id
        attendance.verified_at = get_local_now()
        
        db.session.commit()
        
        return jsonify({
            'message': f'Attendance {action}ed',
            'attendance': attendance.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== REPORTS & ANALYTICS ====================


@attendance_bp.route('/report', methods=['GET'])
@jwt_required()
@require_permission('attendance.view')
def get_attendance_report():
    """Get attendance report with filters"""
    try:
        # Get filters from query params
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        name_filter = request.args.get('name', '')
        status_filter = request.args.get('status', '')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Build query
        query = Attendance.query
        
        if start_date:
            query = query.filter(Attendance.attendance_date >= datetime.strptime(start_date, '%Y-%m-%d').date())
        if end_date:
            query = query.filter(Attendance.attendance_date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        if name_filter:
            query = query.filter(Attendance.notes.ilike(f'%{name_filter}%'))
        if status_filter:
            query = query.filter(Attendance.status == status_filter)
        
        # Order by date descending
        query = query.order_by(Attendance.attendance_date.desc(), Attendance.clock_in.desc())
        
        # Paginate
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Extract name from notes for each record
        records = []
        for att in pagination.items:
            record = att.to_dict()
            # Extract name from notes field [NAME:xxx]
            if att.notes and '[NAME:' in att.notes:
                name_start = att.notes.find('[NAME:') + 6
                name_end = att.notes.find(']', name_start)
                record['attendee_name'] = att.notes[name_start:name_end] if name_end > name_start else ''
            else:
                record['attendee_name'] = ''
            records.append(record)
        
        return jsonify({
            'records': records,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/summary/monthly', methods=['GET'])
@jwt_required()
@require_permission('attendance.view')
def get_monthly_summary():
    """Get monthly attendance summary with total hours per person"""
    try:
        year = request.args.get('year', get_local_today().year, type=int)
        month = request.args.get('month', get_local_today().month, type=int)
        
        # Get first and last day of month
        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)
        
        # Query attendance for the month
        attendances = Attendance.query.filter(
            Attendance.attendance_date >= first_day,
            Attendance.attendance_date <= last_day
        ).all()
        
        # Group by name and calculate totals
        summary = {}
        for att in attendances:
            # Extract name from notes
            name = ''
            if att.notes and '[NAME:' in att.notes:
                name_start = att.notes.find('[NAME:') + 6
                name_end = att.notes.find(']', name_start)
                name = att.notes[name_start:name_end] if name_end > name_start else 'Unknown'
            
            if not name:
                continue
                
            if name not in summary:
                summary[name] = {
                    'name': name,
                    'total_days': 0,
                    'present_days': 0,
                    'late_days': 0,
                    'total_worked_hours': 0,
                    'total_overtime_hours': 0,
                    'records': []
                }
            
            summary[name]['total_days'] += 1
            if att.status == 'present':
                summary[name]['present_days'] += 1
            elif att.status == 'late':
                summary[name]['late_days'] += 1
            
            if att.worked_hours:
                summary[name]['total_worked_hours'] += float(att.worked_hours)
            if att.overtime_hours:
                summary[name]['total_overtime_hours'] += float(att.overtime_hours)
        
        # Round hours
        for name in summary:
            summary[name]['total_worked_hours'] = round(summary[name]['total_worked_hours'], 2)
            summary[name]['total_overtime_hours'] = round(summary[name]['total_overtime_hours'], 2)
        
        return jsonify({
            'year': year,
            'month': month,
            'summary': list(summary.values()),
            'total_employees': len(summary)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/today/late', methods=['GET'])
@jwt_required()
@require_permission('attendance.view')
def get_today_late():
    """Get list of employees who are late today - for HR notification"""
    try:
        today = get_local_today()
        
        # Query late attendance for today
        late_attendances = Attendance.query.filter(
            Attendance.attendance_date == today,
            Attendance.status == 'late'
        ).all()
        
        late_list = []
        for att in late_attendances:
            name = ''
            if att.notes and '[NAME:' in att.notes:
                name_start = att.notes.find('[NAME:') + 6
                name_end = att.notes.find(']', name_start)
                name = att.notes[name_start:name_end] if name_end > name_start else 'Unknown'
            
            late_list.append({
                'id': att.id,
                'name': name,
                'clock_in': att.clock_in.strftime('%H:%M:%S') if att.clock_in else None,
                'notes': att.notes
            })
        
        return jsonify({
            'date': today.isoformat(),
            'late_count': len(late_list),
            'late_employees': late_list
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/dashboard/stats', methods=['GET'])
@jwt_required()
@require_permission('attendance.view')
def get_attendance_dashboard_stats():
    """Get attendance statistics for dashboard"""
    try:
        today = get_local_today()
        
        # Today's stats
        today_total = Attendance.query.filter(Attendance.attendance_date == today).count()
        today_present = Attendance.query.filter(
            Attendance.attendance_date == today,
            Attendance.status == 'present'
        ).count()
        today_late = Attendance.query.filter(
            Attendance.attendance_date == today,
            Attendance.status == 'late'
        ).count()
        today_clocked_out = Attendance.query.filter(
            Attendance.attendance_date == today,
            Attendance.clock_out.isnot(None)
        ).count()
        
        # This month stats
        first_day_month = date(today.year, today.month, 1)
        month_total = Attendance.query.filter(
            Attendance.attendance_date >= first_day_month,
            Attendance.attendance_date <= today
        ).count()
        month_late = Attendance.query.filter(
            Attendance.attendance_date >= first_day_month,
            Attendance.attendance_date <= today,
            Attendance.status == 'late'
        ).count()
        
        return jsonify({
            'today': {
                'date': today.isoformat(),
                'total': today_total,
                'present': today_present,
                'late': today_late,
                'clocked_out': today_clocked_out
            },
            'month': {
                'year': today.year,
                'month': today.month,
                'total_records': month_total,
                'late_records': month_late,
                'late_percentage': round((month_late / month_total * 100), 1) if month_total > 0 else 0
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/dashboard/not-clocked-out', methods=['GET'])
@jwt_required()
@require_permission('attendance.view')
def get_not_clocked_out():
    """Get list of people who clocked in but haven't clocked out today"""
    try:
        import re
        today = get_local_today()
        
        # Get all attendance records for today where clock_in exists but clock_out is null
        not_clocked_out = Attendance.query.filter(
            Attendance.attendance_date == today,
            Attendance.clock_in.isnot(None),
            Attendance.clock_out.is_(None)
        ).order_by(Attendance.clock_in.asc()).all()
        
        result = []
        for att in not_clocked_out:
            # Extract name from notes [NAME:xxx]
            name = 'Unknown'
            if att.notes:
                match = re.search(r'\[NAME:([^\]]+)\]', att.notes)
                if match:
                    name = match.group(1)
            
            result.append({
                'id': att.id,
                'name': name,
                'jabatan': att.staff_jabatan,
                'departemen': att.staff_departemen,
                'clock_in': att.clock_in.strftime('%H:%M:%S') if att.clock_in else None,
                'clock_in_time': att.clock_in.isoformat() if att.clock_in else None,
                'status': att.status,
                'hours_since_clock_in': round((get_local_now() - att.clock_in).total_seconds() / 3600, 1) if att.clock_in else 0
            })
        
        return jsonify({
            'date': today.isoformat(),
            'count': len(result),
            'records': result
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/admin/delete/<int:id>', methods=['DELETE', 'OPTIONS'])
@jwt_required()
def admin_delete_attendance(id):
    """Delete attendance record (super admin only)"""
    if request.method == 'OPTIONS':
        return cors_preflight_response()
    
    try:
        # Check if user is super admin
        current_user_id = get_jwt_identity()
        from models.auth import User
        user = db.session.get(User, current_user_id)
        
        if not user or user.role not in ['super_admin', 'admin']:
            return jsonify({'error': 'Tidak memiliki akses'}), 403
        
        attendance = db.session.get(Attendance, id)
        
        if not attendance:
            return jsonify({'error': 'Data absensi tidak ditemukan'}), 404
        
        # Get name for response
        name = 'Unknown'
        if attendance.notes:
            import re
            name_match = re.search(r'\[NAME:([^\]]+)\]', attendance.notes)
            if name_match:
                name = name_match.group(1)
        
        db.session.delete(attendance)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Data absensi {name} berhasil dihapus'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/admin/search', methods=['GET', 'OPTIONS'])
@jwt_required()
def admin_search_attendance():
    """Search attendance records by name for deletion"""
    if request.method == 'OPTIONS':
        return cors_preflight_response()
    
    try:
        query = request.args.get('q', '').strip()
        
        if not query:
            return jsonify({'records': []}), 200
        
        # Search in notes field
        records = Attendance.query.filter(
            Attendance.notes.ilike(f'%{query}%')
        ).order_by(Attendance.attendance_date.desc()).limit(50).all()
        
        result = []
        for att in records:
            name = 'Unknown'
            if att.notes:
                import re
                name_match = re.search(r'\[NAME:([^\]]+)\]', att.notes)
                if name_match:
                    name = name_match.group(1)
            
            result.append({
                'id': att.id,
                'name': name,
                'jabatan': att.staff_jabatan,
                'departemen': att.staff_departemen,
                'date': att.attendance_date.isoformat() if att.attendance_date else None,
                'clock_in': att.clock_in.strftime('%H:%M') if att.clock_in else None,
                'clock_out': att.clock_out.strftime('%H:%M') if att.clock_out else None,
                'status': att.status
            })
        
        return jsonify({'records': result}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== ATTENDANCE CORRECTION REQUESTS (2026-09-27) ====================
# Employee-side "I forgot to clock in/out" flow, distinct from
# admin_verify_attendance above (which is the admin verifying a record that
# WAS submitted). requested_change shape:
#   {"clock_in": {"old": "2026-09-27T08:15:00", "new": "2026-09-27T08:00:00"},
#    "clock_out": {"old": null, "new": "2026-09-27T17:00:00"}}
# Either key may be omitted if that side isn't being corrected.

@attendance_bp.route('/correction-requests', methods=['POST'])
@jwt_required()
@require_permission('attendance.create')
def submit_correction_request():
    try:
        user_id = get_jwt_identity()
        employee = Employee.query.filter_by(user_id=user_id).first()
        if not employee:
            return jsonify({'error': 'Akun Anda tidak terhubung ke data karyawan. Hubungi HR.'}), 400

        data = request.get_json() or {}
        correction_date = data.get('correction_date')
        reason = (data.get('reason') or '').strip()
        requested_change = data.get('requested_change')

        if not correction_date:
            return jsonify({'error': 'Tanggal wajib diisi'}), 400
        if not reason:
            return jsonify({'error': 'Alasan wajib diisi'}), 400
        if not requested_change or not isinstance(requested_change, dict):
            return jsonify({'error': 'requested_change wajib berupa object {clock_in/clock_out: {old, new}}'}), 400

        try:
            correction_date_parsed = datetime.strptime(correction_date, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Format tanggal tidak valid (YYYY-MM-DD)'}), 400

        attendance_id = data.get('attendance_id')
        if attendance_id:
            existing = db.session.get(Attendance, attendance_id)
            if not existing or existing.employee_id != employee.id:
                return jsonify({'error': 'Attendance tidak ditemukan atau bukan milik Anda'}), 404

        correction = AttendanceCorrectionRequest(
            employee_id=employee.id,
            attendance_id=attendance_id,
            correction_date=correction_date_parsed,
            reason=reason,
            requested_change=requested_change,
            status='pending',
        )
        db.session.add(correction)
        db.session.commit()

        return jsonify({'message': 'Pengajuan koreksi terkirim', 'correction': correction.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/correction-requests', methods=['GET'])
@jwt_required()
@require_permission('attendance.view')
def list_correction_requests():
    try:
        status = request.args.get('status')
        query = AttendanceCorrectionRequest.query
        if status:
            query = query.filter_by(status=status)
        requests_ = query.order_by(AttendanceCorrectionRequest.created_at.desc()).all()
        return jsonify({'correction_requests': [r.to_dict() for r in requests_]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/correction-requests/<int:request_id>/approve', methods=['POST'])
@jwt_required()
@require_permission('attendance.edit')
def approve_correction_request(request_id):
    """Approve applies requested_change to the target Attendance row,
    creating one first if the employee never had a record at all
    (e.g. forgot to clock in entirely)."""
    try:
        user_id = get_jwt_identity()
        correction = db.session.get(AttendanceCorrectionRequest, request_id)
        if not correction:
            return jsonify({'error': 'Pengajuan tidak ditemukan'}), 404
        if correction.status != 'pending':
            return jsonify({'error': 'Pengajuan sudah diproses sebelumnya'}), 400

        attendance = db.session.get(Attendance, correction.attendance_id) if correction.attendance_id else None
        if not attendance:
            attendance = Attendance(
                employee_id=correction.employee_id,
                attendance_date=correction.correction_date,
                status='present',
                notes='Dibuat dari AttendanceCorrectionRequest (koreksi lupa absen)',
            )
            db.session.add(attendance)

        change = correction.requested_change or {}
        if 'clock_in' in change and change['clock_in'].get('new'):
            attendance.clock_in = datetime.fromisoformat(change['clock_in']['new'])
        if 'clock_out' in change and change['clock_out'].get('new'):
            attendance.clock_out = datetime.fromisoformat(change['clock_out']['new'])
        attendance.verification_status = 'verified'
        attendance.verified_by = user_id
        attendance.verified_at = get_local_now()

        db.session.flush()
        correction.attendance_id = attendance.id
        correction.status = 'approved'
        correction.approver_id = user_id
        correction.resolved_at = get_local_now()
        correction.approver_notes = (request.get_json() or {}).get('notes')

        db.session.commit()
        return jsonify({'message': 'Koreksi disetujui', 'correction': correction.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/correction-requests/<int:request_id>/reject', methods=['POST'])
@jwt_required()
@require_permission('attendance.edit')
def reject_correction_request(request_id):
    try:
        user_id = get_jwt_identity()
        correction = db.session.get(AttendanceCorrectionRequest, request_id)
        if not correction:
            return jsonify({'error': 'Pengajuan tidak ditemukan'}), 404
        if correction.status != 'pending':
            return jsonify({'error': 'Pengajuan sudah diproses sebelumnya'}), 400

        data = request.get_json() or {}
        correction.status = 'rejected'
        correction.approver_id = user_id
        correction.resolved_at = get_local_now()
        correction.approver_notes = data.get('notes', 'Ditolak oleh admin')

        db.session.commit()
        return jsonify({'message': 'Koreksi ditolak', 'correction': correction.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== ATTENDANCE <-> SHIFT PRODUCTION RECONCILIATION (2026-09-27) ====================
# Cross-checks operators' Attendance clock-ins against their
# ShiftProduction logs. Neither side is auto-corrected - either could be
# the one that's wrong - this only surfaces mismatches for a supervisor
# to look at and fix manually (via correction-requests above, or by
# editing the production log directly).

@attendance_bp.route('/reconciliation/run', methods=['POST'])
@jwt_required()
@require_permission('attendance.edit')
def run_reconciliation():
    try:
        from models.production import ShiftProduction

        data = request.get_json() or {}
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        if not start_date or not end_date:
            return jsonify({'error': 'start_date dan end_date wajib diisi'}), 400

        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        end = datetime.strptime(end_date, '%Y-%m-%d').date()

        # Group ShiftProduction rows by (operator_id, production_date)
        sp_rows = ShiftProduction.query.filter(
            ShiftProduction.production_date >= start,
            ShiftProduction.production_date <= end,
            ShiftProduction.operator_id.isnot(None),
        ).all()
        sp_by_key = {}
        for sp in sp_rows:
            key = (sp.operator_id, sp.production_date)
            sp_by_key.setdefault(key, []).append(sp.id)

        # Attendance rows in range for employees who are known operators
        # (appear in ShiftProduction at least once historically) so we
        # don't flag office staff for never having a production log.
        known_operator_ids = {sp.operator_id for sp in ShiftProduction.query.filter(
            ShiftProduction.operator_id.isnot(None)
        ).with_entities(ShiftProduction.operator_id).distinct()}

        if known_operator_ids:
            att_rows = Attendance.query.filter(
                Attendance.attendance_date >= start,
                Attendance.attendance_date <= end,
                Attendance.employee_id.in_(known_operator_ids),
                Attendance.clock_in.isnot(None),
            ).all()
        else:
            att_rows = []
        att_by_key = {(a.employee_id, a.attendance_date) for a in att_rows}

        flags_created = 0
        seen_keys = set()

        # Case 1: has ShiftProduction, no Attendance clock-in
        for (employee_id, prod_date), sp_ids in sp_by_key.items():
            if (employee_id, prod_date) not in att_by_key:
                seen_keys.add((employee_id, prod_date, 'missing_attendance'))
                flag = AttendanceReconciliationFlag.query.filter_by(
                    employee_id=employee_id, flag_date=prod_date, mismatch_type='missing_attendance'
                ).first()
                if not flag:
                    flag = AttendanceReconciliationFlag(
                        employee_id=employee_id, flag_date=prod_date, mismatch_type='missing_attendance',
                    )
                    db.session.add(flag)
                    flags_created += 1
                flag.detail = {'shift_production_ids': sp_ids}
                if flag.status == 'reviewed':
                    flag.status = 'open'  # re-open if it recurs after being reviewed

        # Case 2: has Attendance clock-in, no ShiftProduction log that day
        for employee_id, att_date in att_by_key:
            if (employee_id, att_date) not in sp_by_key:
                seen_keys.add((employee_id, att_date, 'missing_production_log'))
                flag = AttendanceReconciliationFlag.query.filter_by(
                    employee_id=employee_id, flag_date=att_date, mismatch_type='missing_production_log'
                ).first()
                if not flag:
                    flag = AttendanceReconciliationFlag(
                        employee_id=employee_id, flag_date=att_date, mismatch_type='missing_production_log',
                    )
                    db.session.add(flag)
                    flags_created += 1
                if flag.status == 'reviewed':
                    flag.status = 'open'

        db.session.commit()

        flags = AttendanceReconciliationFlag.query.filter(
            AttendanceReconciliationFlag.flag_date >= start,
            AttendanceReconciliationFlag.flag_date <= end,
        ).order_by(AttendanceReconciliationFlag.flag_date.desc()).all()

        return jsonify({
            'message': f'{flags_created} flag baru ditemukan',
            'flags': [f.to_dict() for f in flags],
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/reconciliation', methods=['GET'])
@jwt_required()
@require_permission('attendance.view')
def list_reconciliation_flags():
    try:
        status = request.args.get('status', 'open')
        query = AttendanceReconciliationFlag.query
        if status:
            query = query.filter_by(status=status)
        flags = query.order_by(AttendanceReconciliationFlag.flag_date.desc()).all()
        return jsonify({'flags': [f.to_dict() for f in flags]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/reconciliation/<int:flag_id>/review', methods=['POST'])
@jwt_required()
@require_permission('attendance.edit')
def review_reconciliation_flag(flag_id):
    try:
        user_id = get_jwt_identity()
        flag = db.session.get(AttendanceReconciliationFlag, flag_id)
        if not flag:
            return jsonify({'error': 'Flag tidak ditemukan'}), 404

        data = request.get_json() or {}
        flag.status = 'reviewed'
        flag.reviewed_by = user_id
        flag.reviewed_at = get_local_now()
        flag.review_notes = data.get('notes')

        db.session.commit()
        return jsonify({'message': 'Ditandai sudah direview', 'flag': flag.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
