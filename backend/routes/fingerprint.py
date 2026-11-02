import re
from datetime import datetime
from difflib import SequenceMatcher

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from models import db, Employee, FingerprintUser, FingerprintLog
from utils.auth_decorators import require_permission

fingerprint_bp = Blueprint('fingerprint', __name__)


def _norm(s):
    return re.sub(r'[^a-z]', '', (s or '').lower())


def _tokens(s):
    return sorted(t for t in re.split(r'[^a-z]+', (s or '').lower()) if t)


def _suggest(name, candidates):
    """Usulan karyawan untuk nama di alat. candidates: list[Employee] yang belum dipetakan.
    Return (employee|None, 'exact'|'similar'|None)."""
    n = _norm(name)
    if not n:
        return None, None
    exact = [e for e in candidates if _norm(e.full_name) == n]
    if len(exact) == 1:
        return exact[0], 'exact'
    if len(exact) > 1:
        return None, None
    tk = _tokens(name)
    same_tokens = [e for e in candidates if _tokens(e.full_name) == tk]
    if len(same_tokens) == 1:
        return same_tokens[0], 'exact'
    best, best_ratio = None, 0.0
    for e in candidates:
        r = SequenceMatcher(None, n, _norm(e.full_name)).ratio()
        if r > best_ratio:
            best, best_ratio = e, r
    if best is not None and best_ratio >= 0.82:
        return best, 'similar'
    return None, None


def _mapped_by_device_id():
    return {e.fingerprint_id: e for e in Employee.query.filter(Employee.fingerprint_id.isnot(None)).all()}


@fingerprint_bp.route('/users', methods=['GET'])
@jwt_required()
@require_permission('hr.view')
def list_users():
    mapped = _mapped_by_device_id()
    free = [e for e in Employee.query.filter(Employee.status == 'active', Employee.fingerprint_id.is_(None)).all()]
    search = (request.args.get('search') or '').strip().lower()
    flt = request.args.get('filter') or ''
    rows = []
    for u in FingerprintUser.query.order_by(FingerprintUser.name).all():
        emp = mapped.get(u.device_user_id)
        sug, kind = (None, None) if emp else _suggest(u.name, free)
        status = 'mapped' if emp else (kind or 'none')
        if search and search not in f'{u.name} {u.device_user_id} {emp.full_name if emp else ""}'.lower():
            continue
        if flt == 'mapped' and status != 'mapped':
            continue
        if flt == 'unmapped' and status == 'mapped':
            continue
        if flt in ('exact', 'similar', 'none') and status != flt:
            continue
        rows.append({
            'id': u.id, 'device_user_id': u.device_user_id, 'name': u.name, 'log_count': u.log_count,
            'last_log_at': u.last_log_at.isoformat() if u.last_log_at else None,
            'status': status,
            'employee': {'id': emp.id, 'name': emp.full_name, 'employee_number': emp.employee_number} if emp else None,
            'suggestion': {'id': sug.id, 'name': sug.full_name, 'employee_number': sug.employee_number, 'kind': kind} if sug else None,
        })
    all_users = FingerprintUser.query.count()
    unmapped_emps = Employee.query.filter(Employee.status == 'active', Employee.fingerprint_id.is_(None)).order_by(Employee.full_name).all()
    return jsonify({
        'users': rows,
        'summary': {
            'device_users': all_users,
            'mapped': sum(1 for u in FingerprintUser.query.all() if u.device_user_id in mapped),
            'active_employees': Employee.query.filter(Employee.status == 'active').count(),
            'employees_without_id': len(unmapped_emps),
        },
        'employees_without_id': [{'id': e.id, 'name': e.full_name, 'employee_number': e.employee_number} for e in unmapped_emps],
    }), 200


@fingerprint_bp.route('/users/<int:uid>/map', methods=['PUT'])
@jwt_required()
@require_permission('hr.edit')
def map_user(uid):
    u = db.session.get(FingerprintUser, uid)
    if not u:
        return jsonify({'error': 'Pengguna alat tidak ditemukan'}), 404
    emp_id = (request.get_json() or {}).get('employee_id')
    for e in Employee.query.filter(Employee.fingerprint_id == u.device_user_id).all():
        e.fingerprint_id = None
    if emp_id:
        emp = db.session.get(Employee, emp_id)
        if not emp:
            db.session.rollback()
            return jsonify({'error': 'Karyawan tidak ditemukan'}), 404
        if emp.fingerprint_id and emp.fingerprint_id != u.device_user_id:
            other = FingerprintUser.query.filter_by(device_user_id=emp.fingerprint_id).first()
            db.session.rollback()
            return jsonify({'error': f'{emp.full_name} sudah dipetakan ke ID alat {emp.fingerprint_id}' + (f' ({other.name})' if other else '') + '. Lepas dulu pemetaan itu.'}), 400
        emp.fingerprint_id = u.device_user_id
    db.session.commit()
    return jsonify({'message': 'Pemetaan disimpan' if emp_id else 'Pemetaan dilepas'}), 200


@fingerprint_bp.route('/users/accept-exact', methods=['POST'])
@jwt_required()
@require_permission('hr.edit')
def accept_exact():
    """Petakan semua pengguna alat yang namanya sama persis dengan satu karyawan aktif."""
    mapped = _mapped_by_device_id()
    free = Employee.query.filter(Employee.status == 'active', Employee.fingerprint_id.is_(None)).all()
    n = 0
    for u in FingerprintUser.query.order_by(FingerprintUser.id).all():
        if u.device_user_id in mapped:
            continue
        emp, kind = _suggest(u.name, free)
        if emp is not None and kind == 'exact':
            emp.fingerprint_id = u.device_user_id
            free = [e for e in free if e.id != emp.id]
            mapped[u.device_user_id] = emp
            n += 1
    db.session.commit()
    return jsonify({'message': f'{n} pengguna dipetakan', 'mapped': n}), 200


@fingerprint_bp.route('/users/import', methods=['POST'])
@jwt_required()
@require_permission('hr.edit')
def import_users():
    """Isi/perbarui daftar pengguna alat. Body: {users:[{user_id,name,privilege?,card?,log_count?,last_log_at?}]}.
    Tidak pernah menghapus pengguna atau pemetaan yang sudah ada."""
    items = (request.get_json() or {}).get('users') or []
    if not items:
        return jsonify({'error': 'Daftar pengguna kosong'}), 400
    created = updated = 0
    now = datetime.utcnow()
    for it in items:
        did = str(it.get('user_id') or '').strip()
        name = (it.get('name') or '').strip()
        if not did or not name:
            continue
        u = FingerprintUser.query.filter_by(device_user_id=did).first()
        if not u:
            u = FingerprintUser(device_user_id=did, name=name)
            db.session.add(u)
            created += 1
        else:
            updated += 1
        u.name = name
        u.privilege = it.get('privilege')
        u.card = (str(it['card']) if it.get('card') not in (None, '', '0') else None)
        u.last_seen_at = now
        if 'log_count' in it:
            u.log_count = int(it.get('log_count') or 0)
        if it.get('last_log_at'):
            u.last_log_at = datetime.fromisoformat(it['last_log_at'])
    db.session.commit()
    return jsonify({'message': f'{created} baru, {updated} diperbarui', 'created': created, 'updated': updated}), 200


@fingerprint_bp.route('/logs/import', methods=['POST'])
@jwt_required()
@require_permission('hr.edit')
def import_logs():
    """Simpan cap mentah. Body: {source_device?, logs:[{user_id, timestamp(ISO), status?, punch?}]}.
    Idempotent: pasangan (user, waktu) yang sudah ada dilewati."""
    body = request.get_json() or {}
    logs = body.get('logs') or []
    if not logs:
        return jsonify({'error': 'Daftar log kosong'}), 400
    src = body.get('source_device')
    rows = []
    for l in logs:
        try:
            rows.append({'device_user_id': str(l['user_id']).strip(), 'punched_at': datetime.fromisoformat(l['timestamp']),
                         'status': l.get('status'), 'punch': l.get('punch'), 'source_device': src})
        except (KeyError, ValueError):
            continue
    from utils.fingerprint_sync import insert_new_logs, refresh_user_stats
    inserted = insert_new_logs(rows)
    refresh_user_stats()
    db.session.commit()
    return jsonify({'message': f'{inserted} log baru', 'received': len(rows), 'inserted': inserted, 'skipped': len(rows) - inserted}), 200


def _range_args():
    from datetime import date as _d, timedelta as _td
    today = datetime.now().date()
    try:
        df = _d.fromisoformat(request.args['date_from']) if request.args.get('date_from') else today.replace(day=1)
        dt = _d.fromisoformat(request.args['date_to']) if request.args.get('date_to') else today
    except ValueError:
        return None, None, ({'error': 'Format tanggal tidak valid (YYYY-MM-DD)'}, 400)
    if dt < df:
        return None, None, ({'error': 'Tanggal akhir lebih awal dari tanggal awal'}, 400)
    if (dt - df).days > 92:
        return None, None, ({'error': 'Rentang maksimal 93 hari'}, 400)
    return df, dt, None


@fingerprint_bp.route('/attendance', methods=['GET'])
@jwt_required()
@require_permission('hr.view')
def attendance():
    from utils.fingerprint_attendance import compute
    df, dt, err = _range_args()
    if err:
        return jsonify(err[0]), err[1]
    data = compute(df, dt, employee_id=request.args.get('employee_id'),
                   include_unmapped=request.args.get('include_unmapped') in ('1', 'true'))
    last = db.session.query(db.func.max(FingerprintLog.punched_at)).scalar()
    data['last_log_at'] = last.isoformat() if last else None
    data['period'] = {'date_from': df.isoformat(), 'date_to': dt.isoformat()}
    return jsonify(data), 200


@fingerprint_bp.route('/attendance/export', methods=['GET'])
@jwt_required()
@require_permission('hr.view')
def attendance_export():
    import io
    import openpyxl
    from flask import send_file
    from utils.fingerprint_attendance import compute
    df, dt, err = _range_args()
    if err:
        return jsonify(err[0]), err[1]
    data = compute(df, dt, employee_id=request.args.get('employee_id'),
                   include_unmapped=request.args.get('include_unmapped') in ('1', 'true'))
    hm = lambda m: '' if m is None else f"{'-' if m < 0 else ''}{abs(m) // 60}:{abs(m) % 60:02d}"
    label = {'hadir': 'Hadir', 'tidak_lengkap': 'Cap tidak lengkap', 'tidak_ada_cap': 'Tidak ada cap', 'libur': 'Libur', 'belum': 'Belum'}
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Ringkasan'
    ws.append(['Karyawan', 'ID alat', 'Hari kerja', 'Hadir', 'Tidak ada cap', 'Cap tidak lengkap', 'Jam kerja bersih', 'Target jam', 'Selisih jam'])
    for p in data['people']:
        ws.append([(p['employee'] or {}).get('name') or p['device_name'], p['device_user_id'], p['work_days'], p['present'], p['absent'],
                   p['incomplete'], hm(p['net_minutes']), hm(p['target_minutes']), hm(p['diff_minutes'])])
    wd = wb.create_sheet('Harian')
    wd.append(['Tanggal', 'Hari', 'Karyawan', 'ID alat', 'Masuk', 'Pulang', 'Jumlah cap', 'Jam bersih', 'Target', 'Selisih', 'Status'])
    for r in sorted(data['days'], key=lambda x: (x['date'], (x['employee'] or {}).get('name') or '')):
        wd.append([r['date'], r['weekday'], (r['employee'] or {}).get('name') or r['device_name'], r['device_user_id'], r['first'], r['last'],
                   r['punches'], hm(r['net_minutes']), hm(r['target_minutes']), hm(r['diff_minutes']), label.get(r['status'], r['status'])])
    for sh in (ws, wd):
        for col in sh.columns:
            sh.column_dimensions[col[0].column_letter].width = min(34, max(10, max(len(str(c.value or '')) for c in col) + 2))
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name=f'absensi-fingerprint-{df}-{dt}.xlsx',
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


@fingerprint_bp.route('/ingest', methods=['POST'])
def ingest():
    """Terima data dari pengumpul di jaringan mesin (server lain), tanpa login user.
    Dijaga token khusus FINGERPRINT_INGEST_TOKEN (header X-Ingest-Token); kosong = ditolak.
    Body: {source_device?, users:[{user_id,name,privilege?,card?}], logs:[{user_id,timestamp,status?,punch?}]}."""
    import os
    import hmac
    from utils.fingerprint_sync import insert_new_logs, refresh_user_stats, upsert_users
    expected = os.getenv('FINGERPRINT_INGEST_TOKEN', '')
    provided = request.headers.get('X-Ingest-Token', '')
    if not expected or not hmac.compare_digest(expected, provided):
        return jsonify({'error': 'Unauthorized'}), 401
    body = request.get_json() or {}
    created, updated = upsert_users(body.get('users') or [])
    rows = []
    for l in body.get('logs') or []:
        try:
            rows.append({'device_user_id': str(l['user_id']).strip(), 'punched_at': datetime.fromisoformat(l['timestamp']),
                         'status': l.get('status'), 'punch': l.get('punch'), 'source_device': body.get('source_device')})
        except (KeyError, ValueError):
            continue
    inserted = insert_new_logs(rows)
    refresh_user_stats()
    db.session.commit()
    return jsonify({'users_created': created, 'users_updated': updated, 'logs_received': len(rows), 'logs_inserted': inserted}), 200
