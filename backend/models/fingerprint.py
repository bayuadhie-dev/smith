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
    schedule_id = db.Column(db.Integer, db.ForeignKey('attendance_schedules.id'), nullable=True)
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


class AttendanceSchedule(db.Model):
    """Jadwal kerja untuk menghitung kehadiran dari fingerprint. days: {"0": {"start":"07:00","end":"15:00","break":30}, ...}
    (0 = Senin). Hari yang tidak ada di days = hari libur jadwal ini."""
    __tablename__ = 'attendance_schedules'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    days = db.Column(db.JSON, nullable=False, default=dict)
    late_tolerance_minutes = db.Column(db.Integer, nullable=False, default=10)
    early_tolerance_minutes = db.Column(db.Integer, nullable=False, default=10)
    is_default = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AttendanceAdjustment(db.Model):
    """Keterangan manual untuk kehadiran: cuti, sakit, izin, dinas, lupa cap, izin pulang cepat/terlambat, libur khusus."""
    __tablename__ = 'attendance_adjustments'

    id = db.Column(db.Integer, primary_key=True)
    device_user_id = db.Column(db.String(50), nullable=True, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True, index=True)
    date_from = db.Column(db.Date, nullable=False, index=True)
    date_to = db.Column(db.Date, nullable=False)
    adj_type = db.Column(db.String(30), nullable=False)
    letter_number = db.Column(db.String(100), nullable=True)
    note = db.Column(db.Text, nullable=True)
    corrected_in = db.Column(db.Time, nullable=True)
    corrected_out = db.Column(db.Time, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
