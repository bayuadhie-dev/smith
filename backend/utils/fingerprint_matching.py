"""Pencocokan nama pengguna mesin fingerprint dengan master karyawan.

Dua daftar ini dibuat orang berbeda: nama di mesin maksimal 24 huruf, sering disingkat atau cuma nama panggilan,
sedangkan master karyawan memakai nama lengkap. Maka dicocokkan per kata, bukan teks utuh.
Hasilnya selalu USULAN: yang memutuskan tetap manusia (HRD), kecuali pemetaan massal untuk skor tertinggi.
"""
import re
from difflib import SequenceMatcher

# Ejaan umum yang beragam untuk kata yang sama.
CANON = {
    'muhammad': 'muhammad', 'muhamad': 'muhammad', 'mohammad': 'muhammad', 'mochammad': 'muhammad', 'mohamad': 'muhammad',
    'moch': 'muhammad', 'moh': 'muhammad', 'mhd': 'muhammad', 'muh': 'muhammad', 'md': 'muhammad',
    'ahmad': 'ahmad', 'achmad': 'ahmad', 'akhmad': 'ahmad',
    'abdul': 'abdul', 'abd': 'abdul', 'abdoel': 'abdul',
    'nur': 'nur', 'noer': 'nur', 'siti': 'siti', 'st': 'siti',
}
STOP = {'bin', 'binti', 'bn', 'dan', 'al', 'el'}


def tokens(name):
    out = []
    for t in re.split(r'[^a-z]+', (name or '').lower()):
        if not t or t in STOP:
            continue
        out.append(CANON.get(t, t))
    return out


def _sim(a, b):
    return SequenceMatcher(None, a, b).ratio()


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
