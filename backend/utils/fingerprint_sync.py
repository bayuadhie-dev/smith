from datetime import datetime

from sqlalchemy import func

from models import db, FingerprintLog, FingerprintUser


def insert_new_logs(rows):
    """rows: list of dict(device_user_id, punched_at(datetime), status, punch, source_device).
    Melewati pasangan (user, waktu) yang sudah ada. Return jumlah yang baru. Tidak commit."""
    if not rows:
        return 0
    lo = min(r['punched_at'] for r in rows)
    hi = max(r['punched_at'] for r in rows)
    seen = set(db.session.query(FingerprintLog.device_user_id, FingerprintLog.punched_at).filter(
        FingerprintLog.punched_at >= lo, FingerprintLog.punched_at <= hi).all())
    fresh = []
    for r in rows:
        k = (r['device_user_id'], r['punched_at'])
        if k not in seen:
            seen.add(k)
            fresh.append(r)
    for i in range(0, len(fresh), 2000):
        db.session.bulk_insert_mappings(FingerprintLog, fresh[i:i + 2000])
    return len(fresh)


def refresh_user_stats():
    """Hitung ulang jumlah cap dan cap terakhir tiap pengguna alat dari fingerprint_logs. Tidak commit."""
    stats = {uid: (n, last) for uid, n, last in db.session.query(
        FingerprintLog.device_user_id, func.count(FingerprintLog.id), func.max(FingerprintLog.punched_at)
    ).group_by(FingerprintLog.device_user_id).all()}
    for u in FingerprintUser.query.all():
        n, last = stats.get(u.device_user_id, (0, None))
        u.log_count, u.last_log_at = n, last


def upsert_users(items):
    """items: list of dict(user_id, name, privilege, card). Tidak pernah menghapus. Return (baru, diperbarui). Tidak commit."""
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
        u.card = str(it['card']) if it.get('card') not in (None, '', '0', 0) else None
        u.last_seen_at = now
    return created, updated
