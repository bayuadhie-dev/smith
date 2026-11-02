"""Hitung kehadiran harian dari cap mentah fingerprint (fingerprint_logs).

Aturan (ditampilkan di halaman supaya jelas dan bisa diubah nanti):
- Cap yang berjarak < 2 menit dianggap satu cap (ketukan ganda).
- Cap pertama = masuk, cap terakhir = pulang. Satu cap saja = "tidak lengkap".
- Jam kerja bersih = (pulang - masuk) - istirahat 60 menit (hanya bila rentang > 5 jam).
- Target 8 jam per hari Senin sampai Jumat, Sabtu dan Minggu target 0 (cap di hari itu dihitung lembur).
- Selisih |<= 10 menit| dianggap pas.
- Hari tanpa cap dari siapa pun (< 3 cap seluruh mesin) dianggap hari libur, bukan tidak masuk.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta

from models import Employee, FingerprintLog, FingerprintUser

RULES = {
    'dedupe_seconds': 120,
    'break_minutes': 60,
    'break_if_span_over_minutes': 300,
    'daily_target_minutes': 480,
    'workdays': [0, 1, 2, 3, 4],
    'tolerance_minutes': 10,
    'holiday_if_total_punches_below': 3,
}

DAY_ID = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']


def _dedupe(times):
    out = []
    for t in sorted(times):
        if not out or (t - out[-1]).total_seconds() >= RULES['dedupe_seconds']:
            out.append(t)
    return out


def compute(date_from, date_to, employee_id=None, include_unmapped=False, today=None):
    today = today or datetime.now().date()
    logs = FingerprintLog.query.filter(
        FingerprintLog.punched_at >= datetime.combine(date_from, datetime.min.time()),
        FingerprintLog.punched_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time())).all()

    per_day_total = defaultdict(int)
    punches = defaultdict(list)           # (device_user_id, date) -> [datetime]
    for l in logs:
        per_day_total[l.punched_at.date()] += 1
        punches[(l.device_user_id, l.punched_at.date())].append(l.punched_at)

    emps = Employee.query.filter(Employee.fingerprint_id.isnot(None)).all()
    by_dev = {e.fingerprint_id: e for e in emps}
    names = {u.device_user_id: u.name for u in FingerprintUser.query.all()}
    if employee_id:
        by_dev = {k: v for k, v in by_dev.items() if v.id == int(employee_id)}

    days = []
    d = date_from
    all_dates = []
    while d <= date_to:
        all_dates.append(d)
        d += timedelta(days=1)

    def is_holiday(day):
        return per_day_total.get(day, 0) < RULES['holiday_if_total_punches_below']

    def row_for(dev_id, emp, day, times):
        target = RULES['daily_target_minutes'] if day.weekday() in RULES['workdays'] else 0
        row = {
            'date': day.isoformat(), 'weekday': DAY_ID[day.weekday()], 'device_user_id': dev_id,
            'device_name': names.get(dev_id), 'employee': ({'id': emp.id, 'name': emp.full_name, 'employee_number': emp.employee_number} if emp else None),
            'first': None, 'last': None, 'punches': 0, 'net_minutes': None, 'target_minutes': target, 'diff_minutes': None, 'status': None,
        }
        if not times:
            row['status'] = 'libur' if (target == 0 or is_holiday(day)) else ('belum' if day >= today else 'tidak_ada_cap')
            if row['status'] == 'tidak_ada_cap':
                row['diff_minutes'] = -target
            return row
        ts = _dedupe(times)
        row['first'], row['last'], row['punches'] = ts[0].strftime('%H:%M'), ts[-1].strftime('%H:%M'), len(ts)
        if len(ts) == 1:
            row['status'] = 'tidak_lengkap'
            return row
        span = int((ts[-1] - ts[0]).total_seconds() // 60)
        net = span - (RULES['break_minutes'] if span > RULES['break_if_span_over_minutes'] else 0)
        diff = net - target
        if abs(diff) <= RULES['tolerance_minutes']:
            diff = 0
        row.update(net_minutes=net, diff_minutes=diff, status='hadir')
        return row

    for dev_id, emp in by_dev.items():
        for day in all_dates:
            days.append(row_for(dev_id, emp, day, punches.get((dev_id, day))))
    if include_unmapped and not employee_id:
        seen = {(r['device_user_id'], r['date']) for r in days}
        for (dev_id, day), times in punches.items():
            if dev_id not in by_dev and (dev_id, day.isoformat()) not in seen:
                days.append(row_for(dev_id, None, day, times))

    days.sort(key=lambda r: (r['date'], (r['employee'] or {}).get('name') or r['device_name'] or ''), reverse=True)

    summary = {}
    for r in days:
        key = r['device_user_id']
        s = summary.setdefault(key, {
            'device_user_id': key, 'employee': r['employee'], 'device_name': r['device_name'],
            'work_days': 0, 'present': 0, 'absent': 0, 'incomplete': 0, 'net_minutes': 0, 'target_minutes': 0, 'diff_minutes': 0})
        if r['target_minutes'] and r['status'] in ('hadir', 'tidak_lengkap', 'tidak_ada_cap'):
            s['work_days'] += 1
        if r['status'] == 'hadir':
            s['present'] += 1
            s['net_minutes'] += r['net_minutes']
            s['target_minutes'] += r['target_minutes']
            s['diff_minutes'] += r['diff_minutes']
        elif r['status'] == 'tidak_ada_cap':
            s['absent'] += 1
            s['target_minutes'] += r['target_minutes']
            s['diff_minutes'] -= r['target_minutes']
        elif r['status'] == 'tidak_lengkap':
            s['incomplete'] += 1
    last_seen = {u.device_user_id: u.last_log_at for u in FingerprintUser.query.all()}
    for s_ in summary.values():
        ll = last_seen.get(s_['device_user_id'])
        s_['last_log_at'] = ll.isoformat() if ll else None
        s_['id_inactive'] = bool(ll is None or (today - ll.date()).days > 14)
    people = sorted(summary.values(), key=lambda s: ((s['employee'] or {}).get('name') or s['device_name'] or ''))
    holidays = [d.isoformat() for d in all_dates if d.weekday() in RULES['workdays'] and d < today and is_holiday(d)]
    return {'rules': RULES, 'days': days, 'people': people, 'holidays': holidays,
            'totals': {
                'people': len(people), 'present': sum(p['present'] for p in people), 'absent': sum(p['absent'] for p in people),
                'incomplete': sum(p['incomplete'] for p in people),
                'over_minutes': sum(r['diff_minutes'] for r in days if (r['diff_minutes'] or 0) > 0),
                'short_minutes': -sum(r['diff_minutes'] for r in days if (r['diff_minutes'] or 0) < 0)}}
