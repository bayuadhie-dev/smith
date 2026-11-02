from datetime import datetime
from . import db


class MachineSparePart(db.Model):
    """Daftar sparepart yang terpasang/dipakai pada satu mesin."""
    __tablename__ = 'machine_spare_parts'

    id = db.Column(db.Integer, primary_key=True)
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id', ondelete='CASCADE'), nullable=False, index=True)
    spare_part_id = db.Column(db.Integer, db.ForeignKey('spare_parts.id', ondelete='CASCADE'), nullable=False, index=True)
    qty_installed = db.Column(db.Numeric(15, 2), nullable=False, default=1)
    replace_interval_days = db.Column(db.Integer, nullable=True)
    last_replaced_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    machine = db.relationship('Machine')
    spare_part = db.relationship('SparePart')

    __table_args__ = (db.UniqueConstraint('machine_id', 'spare_part_id', name='uq_machine_spare_part'),)


class SparePartRequest(db.Model):
    """Permintaan sparepart dari mekanik; disetujui kepala maintenance, stok keluar saat disetujui."""
    __tablename__ = 'spare_part_requests'

    id = db.Column(db.Integer, primary_key=True)
    request_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=True)
    maintenance_record_id = db.Column(db.Integer, db.ForeignKey('maintenance_records.id'), nullable=True)
    status = db.Column(db.String(30), nullable=False, default='pending', index=True)  # pending, approved, rejected, cancelled
    notes = db.Column(db.Text, nullable=True)
    requested_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    requested_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    decided_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    decided_at = db.Column(db.DateTime, nullable=True)
    decision_note = db.Column(db.Text, nullable=True)

    machine = db.relationship('Machine')
    items = db.relationship('SparePartRequestItem', back_populates='request', cascade='all, delete-orphan')


class SparePartRequestItem(db.Model):
    __tablename__ = 'spare_part_request_items'

    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('spare_part_requests.id', ondelete='CASCADE'), nullable=False, index=True)
    spare_part_id = db.Column(db.Integer, db.ForeignKey('spare_parts.id'), nullable=False)
    qty_requested = db.Column(db.Numeric(15, 2), nullable=False)
    qty_issued = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    notes = db.Column(db.Text, nullable=True)

    request = db.relationship('SparePartRequest', back_populates='items')
    spare_part = db.relationship('SparePart')


class MaintenanceSchedulePart(db.Model):
    """Sparepart yang dibutuhkan setiap kali jadwal preventive jatuh tempo."""
    __tablename__ = 'maintenance_schedule_parts'

    id = db.Column(db.Integer, primary_key=True)
    schedule_id = db.Column(db.Integer, db.ForeignKey('maintenance_schedules.id', ondelete='CASCADE'), nullable=False, index=True)
    spare_part_id = db.Column(db.Integer, db.ForeignKey('spare_parts.id'), nullable=False)
    qty = db.Column(db.Numeric(15, 2), nullable=False, default=1)

    spare_part = db.relationship('SparePart')

    __table_args__ = (db.UniqueConstraint('schedule_id', 'spare_part_id', name='uq_schedule_spare_part'),)
