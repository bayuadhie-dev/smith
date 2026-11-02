from datetime import datetime
from . import db


class FingerprintUser(db.Model):
    """Pengguna yang terdaftar di mesin fingerprint (daftar kerja untuk pemetaan ke karyawan)."""
    __tablename__ = 'fingerprint_users'

    id = db.Column(db.Integer, primary_key=True)
    device_user_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    privilege = db.Column(db.Integer, nullable=True)
    card = db.Column(db.String(50), nullable=True)
    last_seen_at = db.Column(db.DateTime, nullable=True)
    log_count = db.Column(db.Integer, nullable=False, default=0)
    last_log_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FingerprintLog(db.Model):
    """Catatan cap mentah dari mesin fingerprint. Tidak dipakai gaji sebelum dipetakan dan disetujui."""
    __tablename__ = 'fingerprint_logs'

    id = db.Column(db.BigInteger().with_variant(db.Integer, 'sqlite'), primary_key=True)
    device_user_id = db.Column(db.String(50), nullable=False, index=True)
    punched_at = db.Column(db.DateTime, nullable=False, index=True)
    status = db.Column(db.Integer, nullable=True)   # jenis verifikasi (1 = sidik jari, dst. menurut mesin)
    punch = db.Column(db.Integer, nullable=True)    # 0 masuk, 1 pulang menurut mesin
    source_device = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (db.UniqueConstraint('device_user_id', 'punched_at', name='uq_fingerprint_log_user_time'),)
