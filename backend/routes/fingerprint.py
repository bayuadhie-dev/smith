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


@fingerprint_bp.route('/users/options', methods=['GET'])
@jwt_required()
@require_permission('hr.view')
def user_options():
    """Daftar pengguna mesin untuk dropdown di form karyawan: id, nama, dan apakah sudah dipakai karyawan lain."""
    mapped = _mapped_by_device_id()
    out = [{'device_user_id': u.device_user_id, 'name': u.name, 'last_log_at': u.last_log_at.isoformat() if u.last_log_at else None,
            'used_by': mapped[u.device_user_id].full_name if u.device_user_id in mapped else None}
           for u in FingerprintUser.query.order_by(FingerprintUser.name).all()]
    return jsonify({'users': out}), 200


@fingerprint_bp.route('/users', methods=['GET'])
@jwt_required()
@require_permission('hr.view')
def list_users():
    from utils.fingerprint_matching import assign, best_for_employee, best_for_device_user
    mapped = _mapped_by_device_id()
    free = [e for e in Employee.query.filter(Employee.status == 'active', Employee.fingerprint_id.is_(None)).all()]
    all_users = FingerprintUser.query.order_by(FingerprintUser.name).all()
    free_users = [u for u in all_users if u.device_user_id not in mapped]
    by_user, by_emp = assign(free_users, free)
    search = (request.args.get('search') or '').strip().lower()
    flt = request.args.get('filter') or ''
    rows = []
    for u in all_users:
        emp = mapped.get(u.device_user_id)
        a = None if emp else by_user.get(u.id)
        kind = None
        if a:
            kind = 'exact' if a['confidence'] == 'tinggi' else 'similar'
        status = 'mapped' if emp else (kind or 'none')
        if search and search not in f'{u.name} {u.device_user_id} {emp.full_name if emp else ""}'.lower():
            continue
        if flt == 'mapped' and status != 'mapped':
            continue
        if flt == 'unmapped' and status == 'mapped':
            continue
        if flt in ('exact', 'similar', 'none') and status != flt:
            continue
        alts = []
        if not emp:
            alts = [{'id': c['employee'].id, 'name': c['employee'].full_name, 'employee_number': c['employee'].employee_number,
                     'score': c['score'], 'reason': c['reason'], 'confidence': c['confidence']}
                    for c in best_for_device_user(u.name, free)]
        rows.append({
            'id': u.id, 'device_user_id': u.device_user_id, 'name': u.name, 'log_count': u.log_count,
            'last_log_at': u.last_log_at.isoformat() if u.last_log_at else None,
            'status': status,
            'employee': {'id': emp.id, 'name': emp.full_name, 'employee_number': emp.employee_number} if emp else None,
            'suggestion': ({'id': a['employee'].id, 'name': a['employee'].full_name, 'employee_number': a['employee'].employee_number,
                            'kind': kind, 'score': a['score'], 'reason': a['reason'], 'confidence': a['confidence'], 'unique': a['unique']} if a else None),
            'candidates': alts,
        })
    unmapped_emps = sorted(free, key=lambda e: e.full_name or '')
    emp_rows = []
    for e in unmapped_emps:
        top = best_for_employee(e.full_name, free_users)
        emp_rows.append({
            'id': e.id, 'name': e.full_name, 'employee_number': e.employee_number,
            'candidates': [{'device_user_id': c['user'].device_user_id, 'user_row_id': c['user'].id, 'name': c['user'].name,
                            'score': c['score'], 'reason': c['reason'], 'confidence': c['confidence'],
                            'log_count': c['user'].log_count,
                            'last_log_at': c['user'].last_log_at.isoformat() if c['user'].last_log_at else None} for c in top],
        })
    return jsonify({
        'users': rows,
        'summary': {
            'device_users': len(all_users),
            'mapped': sum(1 for u in all_users if u.device_user_id in mapped),
            'active_employees': Employee.query.filter(Employee.status == 'active').count(),
            'employees_without_id': len(unmapped_emps),
            'confident_pending': sum(1 for v in by_user.values() if v['confidence'] == 'tinggi' and v['unique']),
        },
        'employees_without_id': emp_rows,
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
    """Petakan semua usulan berkeyakinan tinggi (skor >= 0.92) yang unik (tidak bersaing dengan kandidat lain)."""
    from utils.fingerprint_matching import assign
    mapped = _mapped_by_device_id()
    free = Employee.query.filter(Employee.status == 'active', Employee.fingerprint_id.is_(None)).all()
    free_users = [u for u in FingerprintUser.query.all() if u.device_user_id not in mapped]
    by_user, _ = assign(free_users, free)
    n = 0
    byid = {u.id: u for u in free_users}
    for uid, a in by_user.items():
        if a['confidence'] == 'tinggi' and a['unique']:
            a['employee'].fingerprint_id = byid[uid].device_user_id
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
    label = {'hadir': 'Hadir', 'tidak_lengkap': 'Cap tidak lengkap', 'tidak_ada_cap': 'Tidak ada cap', 'libur': 'Libur', 'belum': 'Belum', 'izin': 'Izin sah'}
    nm = lambda r: (r['employee'] or {}).get('name') or r['device_name']
    status_text = lambda r: (label.get(r['status'], r['status']) + (f" - {r['adjustment_label']}" if r.get('adjustment_label') and r['status'] in ('izin', 'libur') else '')
                             + (' | terlambat' if r['late_minutes'] else '') + (' | pulang cepat' + (' (izin)' if r['early_excused'] else ' (tanpa surat)') if r['early_minutes'] else ''))
    people_rows = [[nm(p), p['device_user_id'], p['schedule'] or '-', p['work_days'], p['present'], p['excused_days'], p['absent'], p['incomplete'],
                    f"{p['late_count']}x / {p['late_minutes']} mnt" if p['late_count'] else '-',
                    f"{p['early_count']}x ({p['early_unexcused_count']} tanpa surat)" if p['early_count'] else '-',
                    hm(p['net_minutes']), hm(p['target_minutes']), hm(p['diff_minutes'])] for p in data['people']]
    people_head = ['Karyawan', 'ID alat', 'Jadwal', 'Hari kerja', 'Hadir', 'Izin sah', 'Tidak ada cap', 'Cap tidak lengkap', 'Terlambat', 'Pulang cepat', 'Jam bersih', 'Target', 'Selisih']
    day_rows_sorted = sorted(data['days'], key=lambda x: (x['date'], nm(x) or ''))
    day_head = ['Tanggal', 'Hari', 'Karyawan', 'ID alat', 'Masuk', 'Pulang', 'Cap', 'Jam bersih', 'Target', 'Selisih', 'Terlambat (mnt)', 'Pulang cepat (mnt)', 'Status']
    day_rows = [[r['date'], r['weekday'], nm(r), r['device_user_id'], r['first'], r['last'] if r['punches'] > 1 else '', r['punches'], hm(r['net_minutes']),
                 hm(r['target_minutes']), hm(r['diff_minutes']), r['late_minutes'] or '', r['early_minutes'] or '', status_text(r)] for r in day_rows_sorted]
    period = f"{df.strftime('%d/%m/%Y')} sampai {dt.strftime('%d/%m/%Y')}"
    if (request.args.get('format') or '').lower() == 'pdf':
        from routes.finance_reports import _xlsx
        if request.args.get('employee_id') or request.args.get('detail') == '1':
            who = nm(data['days'][0]) if data['days'] else ''
            return _xlsx('Rincian Absensi' + (f' - {who}' if who else ''), day_head, [r for r in day_rows if r[0] and r[12] not in ('Libur', 'Belum')] or day_rows,
                         f'rincian-absensi-{df}-{dt}.pdf', f'Periode {period}')
        return _xlsx('Rekap Absensi Fingerprint', people_head, people_rows, f'rekap-absensi-{df}-{dt}.pdf', f'Periode {period}')
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Ringkasan'
    ws.append(people_head)
    for r in people_rows:
        ws.append(r)
    wd = wb.create_sheet('Harian')
    wd.append(day_head)
    for r in day_rows:
        wd.append(r)
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


# ---------------------------------------------------------------- tombol Perbarui data
def _ingest_token_ok():
    import os
    import hmac
    expected = os.getenv('FINGERPRINT_INGEST_TOKEN', '')
    return bool(expected) and hmac.compare_digest(expected, request.headers.get('X-Ingest-Token', ''))


@fingerprint_bp.route('/refresh', methods=['POST'])
@jwt_required()
@require_permission('hr.view')
def refresh_start():
    from flask import current_app
    from flask_jwt_extended import get_jwt_identity
    from utils.fingerprint_refresh import request_refresh
    return jsonify(request_refresh(get_jwt_identity(), current_app._get_current_object())), 200


@fingerprint_bp.route('/refresh/status', methods=['GET'])
@jwt_required()
@require_permission('hr.view')
def refresh_status():
    from utils.fingerprint_refresh import public_state
    return jsonify(public_state()), 200


@fingerprint_bp.route('/refresh/pending', methods=['GET'])
def refresh_pending():
    """Dipanggil server kantor (pengumpul) dengan token ingest: adakah permintaan perbarui yang menunggu?"""
    if not _ingest_token_ok():
        return jsonify({'error': 'Unauthorized'}), 401
    from utils.fingerprint_refresh import claim_pending
    return jsonify({'id': claim_pending()}), 200


@fingerprint_bp.route('/refresh/result', methods=['POST'])
def refresh_result():
    if not _ingest_token_ok():
        return jsonify({'error': 'Unauthorized'}), 401
    from utils.fingerprint_refresh import report_result
    b = request.get_json(silent=True) or {}
    return jsonify({'recorded': report_result(b.get('id'), bool(b.get('ok')), str(b.get('message') or '')[:300], b.get('new_logs'))}), 200


# ---------------------------------------------------------------- jadwal kerja
def _sched_dict(sc, assigned=None):
    return {'id': sc.id, 'name': sc.name, 'days': sc.days or {}, 'late_tolerance_minutes': sc.late_tolerance_minutes,
            'early_tolerance_minutes': sc.early_tolerance_minutes, 'is_default': sc.is_default, 'is_active': sc.is_active,
            'notes': sc.notes, 'assigned': assigned}


def _clean_days(raw):
    import re as _re
    out = {}
    for k, v in (raw or {}).items():
        if str(k) not in '0123456' or not v:
            continue
        st, en = str(v.get('start') or ''), str(v.get('end') or '')
        if not (_re.fullmatch(r'\d{1,2}:\d{2}', st) and _re.fullmatch(r'\d{1,2}:\d{2}', en)):
            raise ValueError('Jam harus berformat JJ:MM')
        h1, m1 = map(int, st.split(':'))
        h2, m2 = map(int, en.split(':'))
        if h1 > 23 or h2 > 23 or m1 > 59 or m2 > 59:
            raise ValueError('Jam tidak valid')
        if h2 * 60 + m2 <= h1 * 60 + m1:
            raise ValueError('Jam pulang harus setelah jam masuk (jadwal lintas tengah malam belum didukung)')
        brk = int(v.get('break') or 0)
        if brk < 0 or brk > 180:
            raise ValueError('Istirahat harus 0 sampai 180 menit')
        out[str(k)] = {'start': f'{h1:02d}:{m1:02d}', 'end': f'{h2:02d}:{m2:02d}', 'break': brk}
    if not out:
        raise ValueError('Pilih minimal satu hari kerja')
    return out


@fingerprint_bp.route('/schedules', methods=['GET'])
@jwt_required()
@require_permission('hr.view')
def list_schedules():
    from models import AttendanceSchedule
    counts = dict(db.session.query(FingerprintUser.schedule_id, db.func.count(FingerprintUser.id)).group_by(FingerprintUser.schedule_id).all())
    rows = AttendanceSchedule.query.order_by(AttendanceSchedule.id).all()
    return jsonify({'schedules': [_sched_dict(sc, counts.get(sc.id, 0)) for sc in rows], 'unassigned': counts.get(None, 0)}), 200


@fingerprint_bp.route('/schedules', methods=['POST'])
@jwt_required()
@require_permission('hr.edit')
def create_schedule():
    from models import AttendanceSchedule
    d = request.get_json() or {}
    try:
        name = (d.get('name') or '').strip()
        if not name:
            return jsonify({'error': 'Nama jadwal wajib diisi'}), 400
        if AttendanceSchedule.query.filter_by(name=name).first():
            return jsonify({'error': 'Nama jadwal sudah dipakai'}), 400
        sc = AttendanceSchedule(name=name, days=_clean_days(d.get('days')), notes=d.get('notes'),
                                late_tolerance_minutes=int(d.get('late_tolerance_minutes', 10)),
                                early_tolerance_minutes=int(d.get('early_tolerance_minutes', 10)))
        db.session.add(sc)
        db.session.commit()
        return jsonify({'message': 'Jadwal dibuat', 'id': sc.id}), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@fingerprint_bp.route('/schedules/<int:sid>', methods=['PUT'])
@jwt_required()
@require_permission('hr.edit')
def update_schedule(sid):
    from models import AttendanceSchedule
    sc = db.session.get(AttendanceSchedule, sid)
    if not sc:
        return jsonify({'error': 'Jadwal tidak ditemukan'}), 404
    d = request.get_json() or {}
    try:
        if 'name' in d:
            nm = (d['name'] or '').strip()
            if not nm:
                return jsonify({'error': 'Nama jadwal wajib diisi'}), 400
            if nm != sc.name and AttendanceSchedule.query.filter_by(name=nm).first():
                return jsonify({'error': 'Nama jadwal sudah dipakai'}), 400
            sc.name = nm
        if 'days' in d:
            sc.days = _clean_days(d['days'])
        for f in ('late_tolerance_minutes', 'early_tolerance_minutes'):
            if f in d:
                v = int(d[f])
                if v < 0 or v > 120:
                    return jsonify({'error': 'Toleransi harus 0 sampai 120 menit'}), 400
                setattr(sc, f, v)
        if 'notes' in d:
            sc.notes = d['notes']
        if d.get('is_default'):
            AttendanceSchedule.query.update({'is_default': False})
            sc.is_default = True
        if 'is_active' in d:
            if not d['is_active'] and sc.is_default:
                return jsonify({'error': 'Jadwal bawaan tidak bisa dinonaktifkan. Jadikan jadwal lain sebagai bawaan dulu.'}), 400
            sc.is_active = bool(d['is_active'])
        db.session.commit()
        return jsonify({'message': 'Jadwal diperbarui'}), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@fingerprint_bp.route('/schedules/assign', methods=['POST'])
@jwt_required()
@require_permission('hr.edit')
def assign_schedule():
    from models import AttendanceSchedule
    d = request.get_json() or {}
    sid = d.get('schedule_id')
    ids = [str(x) for x in (d.get('device_user_ids') or [])]
    if sid is not None and not db.session.get(AttendanceSchedule, sid):
        return jsonify({'error': 'Jadwal tidak ditemukan'}), 404
    if not ids:
        return jsonify({'error': 'Pilih minimal satu pengguna'}), 400
    n = FingerprintUser.query.filter(FingerprintUser.device_user_id.in_(ids)).update({'schedule_id': sid}, synchronize_session=False)
    db.session.commit()
    return jsonify({'message': f'{n} pengguna diatur', 'updated': n}), 200


@fingerprint_bp.route('/schedules/people', methods=['GET'])
@jwt_required()
@require_permission('hr.view')
def schedule_people():
    """Daftar pengguna alat yang masih cap + jadwal sekarang + saran jadwal dari kebiasaan jam cap 60 hari terakhir."""
    from collections import defaultdict
    from datetime import timedelta
    from statistics import median
    from models import AttendanceSchedule
    from utils.fingerprint_attendance import day_config
    since = datetime.now() - timedelta(days=60)
    logs = db.session.query(FingerprintLog.device_user_id, FingerprintLog.punched_at).filter(FingerprintLog.punched_at >= since).all()
    by = defaultdict(lambda: defaultdict(list))
    for uid, t in logs:
        by[uid][t.date()].append(t)
    scheds = AttendanceSchedule.query.filter_by(is_active=True).all()
    emp_by_dev = {e.fingerprint_id: e for e in Employee.query.filter(Employee.fingerprint_id.isnot(None)).all()}
    users = {u.device_user_id: u for u in FingerprintUser.query.all()}
    rows = []
    for uid, daymap in by.items():
        firsts = [min(ts).hour * 60 + min(ts).minute for dt, ts in daymap.items() if dt.weekday() < 5 and len(ts) >= 2]
        lasts = [max(ts).hour * 60 + max(ts).minute for dt, ts in daymap.items() if dt.weekday() < 5 and len(ts) >= 2]
        u = users.get(uid)
        if not u:
            continue
        sug = None
        if len(firsts) >= 5:
            mf = median(firsts)
            best = None
            for sc in scheds:
                cfg = day_config(sc, 1)
                if cfg and cfg['start'] is not None:
                    gap = abs(cfg['start'] - mf)
                    if best is None or gap < best[0]:
                        best = (gap, sc)
            sug = best[1].id if best and best[0] <= 90 else None
        e = emp_by_dev.get(uid)
        hm = lambda m: None if m is None else f'{int(m) // 60:02d}:{int(m) % 60:02d}'
        rows.append({'device_user_id': uid, 'name': u.name, 'employee_name': e.full_name if e else None, 'schedule_id': u.schedule_id,
                     'active_days': len(daymap), 'median_first': hm(median(firsts)) if firsts else None,
                     'median_last': hm(median(lasts)) if lasts else None, 'suggested_schedule_id': sug})
    rows.sort(key=lambda r: ((r['employee_name'] or r['name'] or '').lower()))
    return jsonify({'people': rows}), 200


# ---------------------------------------------------------------- keterangan manual
ADJ_TYPES = ('cuti', 'sakit', 'izin', 'dinas', 'lupa_cap', 'izin_pulang_cepat', 'izin_terlambat', 'libur_khusus')


def _adj_dict(a):
    from utils.fingerprint_attendance import ADJ_LABEL
    emp = db.session.get(Employee, a.employee_id) if a.employee_id else None
    return {'id': a.id, 'device_user_id': a.device_user_id, 'employee': ({'id': emp.id, 'name': emp.full_name} if emp else None),
            'date_from': a.date_from.isoformat(), 'date_to': a.date_to.isoformat(), 'type': a.adj_type, 'label': ADJ_LABEL.get(a.adj_type, a.adj_type),
            'letter_number': a.letter_number, 'note': a.note,
            'corrected_in': a.corrected_in.strftime('%H:%M') if a.corrected_in else None,
            'corrected_out': a.corrected_out.strftime('%H:%M') if a.corrected_out else None,
            'created_at': a.created_at.isoformat() if a.created_at else None}


@fingerprint_bp.route('/adjustments', methods=['GET'])
@jwt_required()
@require_permission('hr.view')
def list_adjustments():
    from models import AttendanceAdjustment
    df, dt, err = _range_args()
    if err:
        return jsonify(err[0]), err[1]
    q = AttendanceAdjustment.query.filter(AttendanceAdjustment.date_from <= dt, AttendanceAdjustment.date_to >= df)
    if request.args.get('device_user_id'):
        q = q.filter(AttendanceAdjustment.device_user_id == request.args['device_user_id'])
    if request.args.get('employee_id'):
        q = q.filter(AttendanceAdjustment.employee_id == int(request.args['employee_id']))
    return jsonify({'adjustments': [_adj_dict(a) for a in q.order_by(AttendanceAdjustment.date_from.desc()).all()]}), 200


@fingerprint_bp.route('/adjustments', methods=['POST'])
@jwt_required()
@require_permission('hr.edit')
def create_adjustment():
    from datetime import date as _d, time as _t
    from flask_jwt_extended import get_jwt_identity
    from models import AttendanceAdjustment
    d = request.get_json() or {}
    try:
        ty = d.get('adj_type')
        if ty not in ADJ_TYPES:
            return jsonify({'error': 'Jenis keterangan tidak valid'}), 400
        df = _d.fromisoformat(d['date_from'])
        dt = _d.fromisoformat(d.get('date_to') or d['date_from'])
        if dt < df or (dt - df).days > 60:
            return jsonify({'error': 'Rentang tanggal tidak valid (maksimal 61 hari)'}), 400
        dev = str(d['device_user_id']).strip() if d.get('device_user_id') else None
        emp_id = d.get('employee_id') or None
        if emp_id:
            emp = db.session.get(Employee, int(emp_id))
            if not emp:
                return jsonify({'error': 'Karyawan tidak ditemukan'}), 404
            dev = dev or emp.fingerprint_id
        if ty != 'libur_khusus' and not (dev or emp_id):
            return jsonify({'error': 'Pilih karyawan atau ID alat'}), 400
        if ty == 'izin_pulang_cepat' and not (d.get('letter_number') or '').strip():
            return jsonify({'error': 'Izin pulang cepat wajib disertai nomor surat izin dari HRD'}), 400
        cin = _t.fromisoformat(d['corrected_in']) if d.get('corrected_in') else None
        cout = _t.fromisoformat(d['corrected_out']) if d.get('corrected_out') else None
        if ty == 'lupa_cap' and not (cin or cout):
            return jsonify({'error': 'Isi jam masuk atau jam pulang yang dikoreksi'}), 400
        if ty == 'libur_khusus':
            dev, emp_id = None, None
        a = AttendanceAdjustment(device_user_id=dev, employee_id=int(emp_id) if emp_id else None, date_from=df, date_to=dt, adj_type=ty,
                                 letter_number=(d.get('letter_number') or '').strip() or None, note=d.get('note'),
                                 corrected_in=cin, corrected_out=cout, created_by=int(get_jwt_identity()))
        db.session.add(a)
        db.session.commit()
        return jsonify({'message': 'Keterangan disimpan', 'adjustment': _adj_dict(a)}), 201
    except (KeyError, ValueError) as e:
        db.session.rollback()
        return jsonify({'error': f'Data tidak valid: {e}'}), 400


@fingerprint_bp.route('/adjustments/<int:aid>', methods=['DELETE'])
@jwt_required()
@require_permission('hr.edit')
def delete_adjustment(aid):
    from models import AttendanceAdjustment
    a = db.session.get(AttendanceAdjustment, aid)
    if not a:
        return jsonify({'error': 'Keterangan tidak ditemukan'}), 404
    db.session.delete(a)
    db.session.commit()
    return jsonify({'message': 'Keterangan dihapus'}), 200


# ---------------------------------------------------------------- rincian hari
@fingerprint_bp.route('/attendance/day', methods=['GET'])
@jwt_required()
@require_permission('hr.view')
def attendance_day():
    from datetime import date as _d
    from utils.fingerprint_attendance import compute, _dedupe
    try:
        day = _d.fromisoformat(request.args['date'])
        dev = str(request.args['device_user_id'])
    except (KeyError, ValueError):
        return jsonify({'error': 'Parameter date dan device_user_id wajib'}), 400
    data = compute(day, day, device_user_id=dev, include_unmapped=True)
    row = next((r for r in data['days'] if r['device_user_id'] == dev), None)
    raw = FingerprintLog.query.filter(
        FingerprintLog.device_user_id == dev, FingerprintLog.punched_at >= datetime.combine(day, datetime.min.time()),
        FingerprintLog.punched_at < datetime.combine(day, datetime.min.time()).replace(hour=23, minute=59, second=59)).order_by(FingerprintLog.punched_at).all()
    kept = {t for t in _dedupe([l.punched_at for l in raw])}
    punches = [{'time': l.punched_at.strftime('%H:%M:%S'), 'status': l.status, 'punch': l.punch, 'counted': l.punched_at in kept} for l in raw]
    explain = []
    if row:
        if row['sched_start'] and row['sched_end']:
            explain.append(f"Jadwal {row['schedule']}: {row['sched_start']} sampai {row['sched_end']}, target {row['target_minutes'] // 60}:{row['target_minutes'] % 60:02d} jam.")
        elif row['schedule']:
            explain.append(f"Jadwal {row['schedule']}: hari ini bukan hari kerja.")
        else:
            explain.append('Belum ada jadwal untuk orang ini, dipakai aturan umum 8 jam Senin sampai Jumat.')
        if row['punches']:
            explain.append(f"Cap dihitung {row['punches']} (ketukan ganda dalam 2 menit digabung): masuk {row['first']}" + (f", pulang {row['last']}." if row['punches'] > 1 else '. Tidak ada cap pulang, jadi status cap tidak lengkap.'))
        if row['late_minutes']:
            explain.append(f"Terlambat {row['late_minutes']} menit (melewati toleransi).")
        if row['early_minutes']:
            explain.append(f"Pulang {row['early_minutes']} menit lebih awal" + (' dengan izin pulang cepat bernomor surat.' if row['early_excused'] else '. Belum ada surat izin pulang cepat dari HRD.'))
        for a in row['adjustments']:
            explain.append(f"Keterangan: {a['label']}" + (f" (surat {a['letter_number']})" if a['letter_number'] else '') + (f": {a['note']}" if a['note'] else '') + '.')
    return jsonify({'row': row, 'punches': punches, 'explain': explain}), 200
