"""Pencocokan nama pengguna mesin fingerprint dengan master karyawan.

Dua daftar ini dibuat orang berbeda: nama di mesin maksimal 24 huruf, sering disingkat atau cuma nama panggilan,
sedangkan master karyawan memakai nama lengkap. Maka dicocokkan per kata, bukan teks utuh.
Hasilnya selalu USULAN: yang memutuskan tetap manusia (HRD), kecuali pemetaan massal untuk skor tertinggi.
"""
import re
from difflib import SequenceMatcher
from functools import lru_cache

# Ejaan umum yang beragam untuk kata yang sama.
CANON = {
    'muhammad': 'muhammad', 'muhamad': 'muhammad', 'mohammad': 'muhammad', 'mochammad': 'muhammad', 'mohamad': 'muhammad',
    'moch': 'muhammad', 'moh': 'muhammad', 'mhd': 'muhammad', 'muh': 'muhammad', 'md': 'muhammad',
    'ahmad': 'ahmad', 'achmad': 'ahmad', 'akhmad': 'ahmad',
    'abdul': 'abdul', 'abd': 'abdul', 'abdoel': 'abdul',
    'nur': 'nur', 'noer': 'nur', 'siti': 'siti', 'st': 'siti',
}
STOP = {'bin', 'binti', 'bn', 'dan', 'al', 'el'}


@lru_cache(maxsize=4096)
def _tokens_cached(name):
    return tuple(_tokens(name))


def tokens(name):
    return list(_tokens_cached(name))


def _tokens(name):
    out = []
    for t in re.split(r'[^a-z]+', (name or '').lower()):
        if not t or t in STOP:
            continue
        out.append(CANON.get(t, t))
    return out


def _sim(a, b):
    if not a or not b or a[0] != b[0]:
        return 0.0
    sm = SequenceMatcher(None, a, b)
    if sm.real_quick_ratio() < 0.8 or sm.quick_ratio() < 0.8:
        return 0.0
    return sm.ratio()


def _tok_match(a, b):
    """Skor kemiripan dua kata: 1 sama, 0.9 singkatan huruf depan, selain itu rasio teks (>=0.8)."""
    if a == b:
        return 1.0
    if len(a) == 1 and b.startswith(a):
        return 0.9
    if len(b) == 1 and a.startswith(b):
        return 0.9
    if len(a) >= 4 and len(b) >= 4:
        r = _sim(a, b)
        if r >= 0.8:
            return r
    return 0.0


@lru_cache(maxsize=65536)
def score(device_name, employee_name):
    """Return (skor 0..1, alasan)."""
    d, e = tokens(device_name), tokens(employee_name)
    if not d or not e:
        return 0.0, ''
    if d == e:
        return 1.0, 'nama sama persis'
    if sorted(d) == sorted(e):
        return 0.97, 'kata sama, urutan berbeda'
    joined_d, joined_e = ''.join(d), ''.join(e)
    if joined_d == joined_e:
        return 0.97, 'sama, hanya beda spasi'
    # nama di mesin terpotong (batas 24 huruf): awalan dari nama lengkap
    if len(joined_d) >= 8 and joined_e.startswith(joined_d):
        if len(d) == 1:
            return 0.7, 'satu kata, awal dari nama lengkap (nama panggilan?)'
        return 0.95, 'nama di mesin terpotong'
    # setiap kata di mesin cocok berurutan dengan kata di master (boleh singkatan huruf depan)
    best_sub, used = 0.0, set()
    ok = True
    scores = []
    pos = 0
    for tk in d:
        found = None
        for j in range(pos, len(e)):
            m = _tok_match(tk, e[j])
            if m > 0:
                found = (j, m)
                break
        if not found:
            ok = False
            break
        pos = found[0] + 1
        scores.append(found[1])
    if ok:
        avg = sum(scores) / len(scores)
        coverage = len(d) / len(e)
        if len(d) == 1:
            base = 0.62 if scores[0] >= 0.99 else 0.5
            reason = 'hanya satu kata cocok (nama panggilan?)'
        else:
            base = 0.78 + 0.12 * coverage
            reason = 'sebagian kata cocok / disingkat'
        sc = min(0.94, base * (0.6 + 0.4 * avg) + (0.0 if avg >= 0.99 else 0.0))
        if len(d) >= 2 and avg >= 0.99:
            sc = min(0.94, base)
        if len(d) >= 2 and avg < 0.99:
            reason = 'mirip (ejaan atau singkatan berbeda)'
        return round(sc, 3), reason
    # nama panggilan: satu kata di mesin adalah awal dari salah satu kata nama lengkap (mis. 'Anto' -> 'Antonius')
    if len(d) == 1 and len(d[0]) >= 4 and any(x.startswith(d[0]) and len(x) > len(d[0]) for x in e):
        return 0.55, 'kemungkinan nama panggilan (awal salah satu kata)'
    # ejaan berbeda tipis di seluruh nama
    whole = _sim(joined_d, joined_e)
    if whole >= 0.88:
        return round(0.6 + 0.35 * (whole - 0.88) / 0.12, 3), 'ejaan mirip'
    # tumpang tindih kata
    common = sum(1 for tk in d if any(_tok_match(tk, x) >= 0.85 for x in e))
    if common >= 2 and common >= len(d) - 1:
        return round(0.55 + 0.05 * common, 3), 'beberapa kata sama'
    return 0.0, ''


def confidence(sc):
    return 'tinggi' if sc >= 0.92 else 'sedang' if sc >= 0.75 else 'rendah'


def best_for_employee(employee_name, device_users, limit=3):
    """device_users: iterable of obj dengan .name, .device_user_id, .log_count, .last_log_at."""
    res = []
    for u in device_users:
        sc, why = score(u.name, employee_name)
        if sc >= 0.5:
            res.append({'user': u, 'score': sc, 'reason': why, 'confidence': confidence(sc)})
    res.sort(key=lambda r: (-r['score'], -(r['user'].log_count or 0)))
    return res[:limit]


def best_for_device_user(device_name, employees, limit=3):
    res = []
    for e in employees:
        sc, why = score(device_name, e.full_name)
        if sc >= 0.5:
            res.append({'employee': e, 'score': sc, 'reason': why, 'confidence': confidence(sc)})
    res.sort(key=lambda r: -r['score'])
    return res[:limit]


def assign(device_users, employees, min_score=0.5):
    """Tetapkan usulan satu-satu (satu karyawan hanya untuk satu ID alat) secara serakah dari skor tertinggi.
    Return (by_user, by_employee) berisi dict {id: {'score','reason','confidence','other','unique'}}, dengan
    'unique' True bila skor kedua terbaik (untuk sisi yang sama) berjarak >= 0.1."""
    pairs = []
    for u in device_users:
        for e in employees:
            sc, why = score(u.name, e.full_name)
            if sc >= min_score:
                pairs.append((sc, u.log_count or 0, u, e, why))
    pairs.sort(key=lambda t: (-t[0], -t[1]))
    top_by_user, top_by_emp = {}, {}
    for sc, n, u, e, why in pairs:
        top_by_user.setdefault(u.id, []).append(sc)
        top_by_emp.setdefault(e.id, []).append(sc)
    used_u, used_e, by_user, by_emp = set(), set(), {}, {}
    for sc, n, u, e, why in pairs:
        if u.id in used_u or e.id in used_e:
            continue
        used_u.add(u.id)
        used_e.add(e.id)
        su, se = sorted(top_by_user[u.id], reverse=True), sorted(top_by_emp[e.id], reverse=True)
        unique = (len(su) < 2 or su[0] - su[1] >= 0.1) and (len(se) < 2 or se[0] - se[1] >= 0.1)
        item = {'score': sc, 'reason': why, 'confidence': confidence(sc), 'unique': unique}
        by_user[u.id] = {**item, 'employee': e}
        by_emp[e.id] = {**item, 'user': u}
    return by_user, by_emp
