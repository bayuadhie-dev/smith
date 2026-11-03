"""Hitung kehadiran harian dari cap mentah fingerprint (fingerprint_logs).

Aturan dasar (ditampilkan di halaman):
- Cap yang berjarak < 2 menit dianggap satu cap (ketukan ganda).
- Cap pertama = masuk, cap terakhir = pulang. Satu cap saja = "tidak lengkap".
- Jam kerja bersih = (pulang - masuk) - istirahat jadwal (hanya bila rentang > 5 jam).
- Target harian dan jam masuk/pulang diambil dari JADWAL KERJA orang itu (bisa diatur). Tanpa jadwal: 8 jam Senin-Jumat.
- Terlambat = masuk setelah jam mulai + toleransi. Pulang cepat = pulang sebelum jam selesai - toleransi;
  pulang cepat hanya sah bila ada izin pulang cepat bernomor surat dari HRD.
- Keterangan manual (cuti, sakit, izin, dinas, lupa cap, libur khusus) mengubah status hari itu.
- Hari tanpa cap dari siapa pun (< 3 cap seluruh mesin) dianggap libur, bukan tidak masuk.
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta

from models import (AttendanceAdjustment, AttendanceSchedule, Employee, FingerprintLog, FingerprintUser)

RULES = {
    'dedupe_seconds': 120,
    'break_if_span_over_minutes': 300,
    'fallback_target_minutes': 480,
    'fallback_break_minutes': 60,
    'fallback_workdays': [0, 1, 2, 3, 4],
    'tolerance_minutes': 10,
    'holiday_if_total_punches_below': 3,
}

DAY_ID = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

ADJ_LABEL = {
    'cuti': 'Cuti', 'sakit': 'Sakit', 'izin': 'Izin', 'dinas': 'Dinas luar', 'lupa_cap': 'Lupa cap (dikoreksi)',
    'izin_pulang_cepat': 'Izin pulang cepat', 'izin_terlambat': 'Izin terlambat', 'libur_khusus': 'Libur khusus',
}
ABSENCE_TYPES = ('cuti', 'sakit', 'izin', 'dinas')


def _hm(s):
    h, m = str(s).split(':')[:2]
    return int(h) * 60 + int(m)


def _mins(t):
    return t.hour * 60 + t.minute


def _fmt(m):
    return f'{m // 60:02d}:{m % 60:02d}'


def _dedupe(times):
    out = []
    for t in sorted(times):
        if not out or (t - out[-1]).total_seconds() >= RULES['dedupe_seconds']:
            out.append(t)
    return out


def day_config(schedule, weekday):
    """Return dict(start, end, break, target) menit, atau None bila hari libur menurut jadwal."""
    if schedule is None:
        if weekday in RULES['fallback_workdays']:
            return {'start': None, 'end': None, 'break': RULES['fallback_break_minutes'], 'target': RULES['fallback_target_minutes']}
        return None
    d = (schedule.days or {}).get(str(weekday))
    if not d:
        return None
    s, e, b = _hm(d['start']), _hm(d['end']), int(d.get('break') or 0)
    return {'start': s, 'end': e, 'break': b, 'target': max(0, e - s - b)}


def _linked_leaves(date_from, date_to):
    """Cuti/izin dari modul SDM yang sudah disetujui: {employee_id: [(from, to, type)]}."""
    out = defaultdict(list)
    try:
        from models.hr import Leave, StaffLeaveRequest
        for L in Leave.query.filter(Leave.status == 'approved', Leave.start_date <= date_to, Leave.end_date >= date_from).all():
            out[L.employee_id].append((L.start_date, L.end_date, 'sakit' if L.leave_type == 'sick' else 'cuti'))
        for L in StaffLeaveRequest.query.filter(StaffLeaveRequest.status == 'approved', StaffLeaveRequest.employee_id.isnot(None),
                                                 StaffLeaveRequest.start_date <= date_to, StaffLeaveRequest.end_date >= date_from).all():
            t = {'sakit': 'sakit', 'izin': 'izin', 'dinas_luar': 'dinas'}.get(L.leave_type, 'cuti')
            out[L.employee_id].append((L.start_date, L.end_date, t))
    except Exception:
        pass
    return out


def compute(date_from, date_to, employee_id=None, include_unmapped=False, today=None, device_user_id=None):
    today = today or datetime.now().date()
    logs = FingerprintLog.query.filter(
        FingerprintLog.punched_at >= datetime.combine(date_from, datetime.min.time()),
        FingerprintLog.punched_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time())).all()

    per_day_total = defaultdict(int)
    punches = defaultdict(list)
    for l in logs:
        per_day_total[l.punched_at.date()] += 1
        punches[(l.device_user_id, l.punched_at.date())].append(l.punched_at)

    emps = Employee.query.filter(Employee.fingerprint_id.isnot(None)).all()
    by_dev = {e.fingerprint_id: e for e in emps}
    users = {u.device_user_id: u for u in FingerprintUser.query.all()}
    names = {k: u.name for k, u in users.items()}
    if employee_id:
        by_dev = {k: v for k, v in by_dev.items() if v.id == int(employee_id)}

    schedules = {s.id: s for s in AttendanceSchedule.query.filter_by(is_active=True).all()}
    default_sched = next((s for s in schedules.values() if s.is_default), None)

    def sched_of(dev_id):
        u = users.get(dev_id)
        return schedules.get(u.schedule_id) if u and u.schedule_id else default_sched

    adjs = AttendanceAdjustment.query.filter(AttendanceAdjustment.date_from <= date_to, AttendanceAdjustment.date_to >= date_from).all()
    linked = _linked_leaves(date_from, date_to)

    all_dates = []
    d = date_from
    while d <= date_to:
        all_dates.append(d)
        d += timedelta(days=1)

    special_holidays = {}
    for a in adjs:
        if a.adj_type == 'libur_khusus' and not a.device_user_id and not a.employee_id:
            x = a.date_from
            while x <= a.date_to:
                special_holidays[x] = a.note or 'Libur khusus'
                x += timedelta(days=1)

    def is_holiday(day):
        return day in special_holidays or per_day_total.get(day, 0) < RULES['holiday_if_total_punches_below']

    def adjustments_for(dev_id, emp, day):
        res = []
        for a in adjs:
            if not (a.date_from <= day <= a.date_to) or a.adj_type == 'libur_khusus' and not a.device_user_id and not a.employee_id:
                continue
            if (a.device_user_id and a.device_user_id == dev_id) or (a.employee_id and emp and a.employee_id == emp.id):
                res.append({'id': a.id, 'type': a.adj_type, 'label': ADJ_LABEL.get(a.adj_type, a.adj_type), 'letter_number': a.letter_number,
                            'note': a.note, 'corrected_in': a.corrected_in.strftime('%H:%M') if a.corrected_in else None,
                            'corrected_out': a.corrected_out.strftime('%H:%M') if a.corrected_out else None, 'source': 'manual'})
        if emp:
            for (f, t, ty) in linked.get(emp.id, []):
                if f <= day <= t:
                    res.append({'id': None, 'type': ty, 'label': ADJ_LABEL.get(ty, ty), 'letter_number': None,
                                'note': 'Pengajuan disetujui di modul SDM', 'corrected_in': None, 'corrected_out': None, 'source': 'sdm'})
        return res

    def row_for(dev_id, emp, day, times):
        sched = sched_of(dev_id)
        cfg = day_config(sched, day.weekday())
        target = cfg['target'] if cfg else 0
        adj = adjustments_for(dev_id, emp, day)
        absence = next((a for a in adj if a['type'] in ABSENCE_TYPES), None)
        lupa = next((a for a in adj if a['type'] == 'lupa_cap'), None)
        row = {
            'date': day.isoformat(), 'weekday': DAY_ID[day.weekday()], 'device_user_id': dev_id, 'device_name': names.get(dev_id),
            'employee': ({'id': emp.id, 'name': emp.full_name, 'employee_number': emp.employee_number} if emp else None),
            'schedule': sched.name if sched else None,
            'sched_start': _fmt(cfg['start']) if cfg and cfg['start'] is not None else None,
            'sched_end': _fmt(cfg['end']) if cfg and cfg['end'] is not None else None,
            'first': None, 'last': None, 'punches': 0, 'times': [], 'net_minutes': None, 'target_minutes': target, 'diff_minutes': None,
            'late_minutes': 0, 'early_minutes': 0, 'early_excused': False, 'excused': False, 'status': None,
            'adjustments': adj, 'adjustment_label': (absence or (adj[0] if adj else {})).get('label') if adj else None,
        }
        ts = _dedupe(times or [])
        if lupa and (lupa['corrected_in'] or lupa['corrected_out']):
            if lupa['corrected_in']:
                ts = _dedupe(ts + [datetime.combine(day, time(*map(int, lupa['corrected_in'].split(':')))) ])
            if lupa['corrected_out']:
                ts = _dedupe(ts + [datetime.combine(day, time(*map(int, lupa['corrected_out'].split(':'))))])
        if not ts:
            if day in special_holidays and target:
                row['status'] = 'libur'
                row['adjustment_label'] = special_holidays[day]
            elif absence:
                row.update(status='izin', excused=True, diff_minutes=0)
            elif target == 0 or is_holiday(day):
                row['status'] = 'libur'
            elif day >= today:
                row['status'] = 'belum'
            else:
                row.update(status='tidak_ada_cap', diff_minutes=-target)
            return row
        row['first'], row['last'], row['punches'] = ts[0].strftime('%H:%M'), ts[-1].strftime('%H:%M'), len(ts)
        row['times'] = [t.strftime('%H:%M') for t in ts]
        if cfg and cfg['start'] is not None:
            tol = sched.late_tolerance_minutes if sched else 10
            late = _mins(ts[0]) - cfg['start']
            has_late_permit = any(a['type'] == 'izin_terlambat' for a in adj)
            row['late_minutes'] = late if (late > tol and not has_late_permit) else 0
        if len(ts) == 1:
            row['status'] = 'tidak_lengkap'
            return row
        span = int((ts[-1] - ts[0]).total_seconds() // 60)
        brk = cfg['break'] if cfg else (RULES['fallback_break_minutes'] if day.weekday() in RULES['fallback_workdays'] else 0)
        net = span - (brk if span > RULES['break_if_span_over_minutes'] else 0)
        diff = net - target
        if abs(diff) <= RULES['tolerance_minutes']:
            diff = 0
        if cfg and cfg['end'] is not None and target:
            etol = sched.early_tolerance_minutes if sched else 10
            early = cfg['end'] - _mins(ts[-1])
            if early > etol:
                permit = next((a for a in adj if a['type'] == 'izin_pulang_cepat'), None)
                row['early_minutes'] = early
                row['early_excused'] = bool(permit and permit.get('letter_number'))
        row.update(net_minutes=net, diff_minutes=diff, status='hadir')
        return row

    days = []
    for dev_id, emp in by_dev.items():
        if device_user_id and dev_id != str(device_user_id):
            continue
        for day in all_dates:
            days.append(row_for(dev_id, emp, day, punches.get((dev_id, day))))
    if (include_unmapped or device_user_id) and not employee_id:
        seen = {(r['device_user_id'], r['date']) for r in days}
        want = {str(device_user_id)} if device_user_id else None
        for (dev_id, day), times in punches.items():
            if dev_id not in by_dev and (dev_id, day.isoformat()) not in seen and (want is None or dev_id in want):
                days.append(row_for(dev_id, None, day, times))

    days.sort(key=lambda r: (r['date'], (r['employee'] or {}).get('name') or r['device_name'] or ''), reverse=True)

    summary = {}
    for r in days:
        key = r['device_user_id']
        s = summary.setdefault(key, {
            'device_user_id': key, 'employee': r['employee'], 'device_name': r['device_name'], 'schedule': r['schedule'],
            'work_days': 0, 'present': 0, 'absent': 0, 'incomplete': 0, 'excused_days': 0, 'net_minutes': 0, 'target_minutes': 0,
            'diff_minutes': 0, 'short_excused_minutes': 0, 'late_count': 0, 'late_minutes': 0, 'early_count': 0, 'early_minutes': 0,
            'early_unexcused_count': 0})
        if r['target_minutes'] and r['status'] in ('hadir', 'tidak_lengkap', 'tidak_ada_cap', 'izin'):
            s['work_days'] += 1
        if r['status'] == 'hadir':
            s['present'] += 1
            s['net_minutes'] += r['net_minutes']
            s['target_minutes'] += r['target_minutes']
            if r['diff_minutes'] < 0 and r['early_excused']:
                s['short_excused_minutes'] += -r['diff_minutes']
            else:
                s['diff_minutes'] += r['diff_minutes']
        elif r['status'] == 'tidak_ada_cap':
            s['absent'] += 1
            s['target_minutes'] += r['target_minutes']
            s['diff_minutes'] -= r['target_minutes']
        elif r['status'] == 'izin':
            s['excused_days'] += 1
        elif r['status'] == 'tidak_lengkap':
            s['incomplete'] += 1
        if r['late_minutes']:
            s['late_count'] += 1
            s['late_minutes'] += r['late_minutes']
        if r['early_minutes']:
            s['early_count'] += 1
            s['early_minutes'] += r['early_minutes']
            if not r['early_excused']:
                s['early_unexcused_count'] += 1
    last_seen = {u.device_user_id: u.last_log_at for u in users.values()}
    for s_ in summary.values():
        ll = last_seen.get(s_['device_user_id'])
        s_['last_log_at'] = ll.isoformat() if ll else None
        s_['id_inactive'] = bool(ll is None or (today - ll.date()).days > 14)
    people = sorted(summary.values(), key=lambda s: ((s['employee'] or {}).get('name') or s['device_name'] or ''))
    holidays = [x.isoformat() for x in all_dates if x.weekday() in RULES['fallback_workdays'] and x < today and is_holiday(x)]
    return {'rules': RULES, 'days': days, 'people': people, 'holidays': holidays,
            'special_holidays': {k.isoformat(): v for k, v in special_holidays.items()},
            'totals': {
                'people': len(people), 'present': sum(p['present'] for p in people), 'absent': sum(p['absent'] for p in people),
                'incomplete': sum(p['incomplete'] for p in people), 'excused_days': sum(p['excused_days'] for p in people),
                'late_count': sum(p['late_count'] for p in people), 'late_minutes': sum(p['late_minutes'] for p in people),
                'early_unexcused_count': sum(p['early_unexcused_count'] for p in people),
                'over_minutes': sum(r['diff_minutes'] for r in days if (r['diff_minutes'] or 0) > 0),
                'short_minutes': -sum(r['diff_minutes'] for r in days if (r['diff_minutes'] or 0) < 0 and not (r['status'] == 'hadir' and r['early_excused'])),
                'short_excused_minutes': sum(p['short_excused_minutes'] for p in people)}}
