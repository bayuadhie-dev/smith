"""
Pre-Shift Checklist Models
Form checklist harian per mesin, per shift, per hari sebelum produksi dimulai.
"""
from datetime import datetime, timezone, timedelta
from . import db

# WIB timezone (UTC+7)
WIB = timezone(timedelta(hours=7))

def now_wib():
    return datetime.now(WIB)


class PreShiftChecklistItem(db.Model):
    """Master item checklist (19 item Kondisi Mesin + 8 item Man Power)"""
    __tablename__ = 'pre_shift_checklist_items'
    
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(50), nullable=False)  # MATERIAL, KONDISI_MESIN, KEAMANAN, MANPOWER
    item_code = db.Column(db.String(20), nullable=False)
    item_name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=now_wib)
    updated_at = db.Column(db.DateTime, default=now_wib, onupdate=now_wib)
    
    # Relationships
    machine_items = db.relationship('PreShiftChecklistMachineItem', back_populates='item', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'category': self.category,
            'item_code': self.item_code,
            'item_name': self.item_name,
            'description': self.description,
            'sort_order': self.sort_order,
            'is_active': self.is_active
        }


class PreShiftChecklistMachineItem(db.Model):
    """Mapping item ke mesin (mana yang applicable)"""
    __tablename__ = 'pre_shift_checklist_machine_items'
    
    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.Integer, db.ForeignKey('pre_shift_checklist_items.id'), nullable=False)
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=False)
    is_applicable = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=now_wib)
    
    # Relationships
    item = db.relationship('PreShiftChecklistItem', back_populates='machine_items')
    machine = db.relationship('Machine', backref=db.backref('checklist_items', lazy='dynamic'))
    
    __table_args__ = (
        db.UniqueConstraint('item_id', 'machine_id', name='uq_checklist_item_machine'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'item_id': self.item_id,
            'machine_id': self.machine_id,
            'is_applicable': self.is_applicable,
            'item': self.item.to_dict() if self.item else None
        }


class PreShiftChecklistSubmission(db.Model):
    """Submission per mesin per shift per hari"""
    __tablename__ = 'pre_shift_checklist_submissions'
    
    id = db.Column(db.Integer, primary_key=True)
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    tanggal = db.Column(db.Date, nullable=False)
    shift = db.Column(db.Integer, nullable=False)  # 1, 2, 3
    operator_name = db.Column(db.String(100), nullable=True)
    submitted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    submitted_at = db.Column(db.DateTime, default=now_wib)
    status = db.Column(db.String(20), default='submitted')  # draft, submitted
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=now_wib)
    updated_at = db.Column(db.DateTime, default=now_wib, onupdate=now_wib)
    
    # Relationships
    machine = db.relationship('Machine', backref=db.backref('checklist_submissions', lazy='dynamic'))
    product = db.relationship('Product', backref=db.backref('checklist_submissions', lazy='dynamic'))
    user = db.relationship('User', backref=db.backref('checklist_submissions', lazy='dynamic'))
    answers = db.relationship('PreShiftChecklistAnswer', back_populates='submission', lazy='dynamic', cascade='all, delete-orphan')
    
    __table_args__ = (
        db.UniqueConstraint('machine_id', 'tanggal', 'shift', name='uq_checklist_submission'),
    )
    
    def to_dict(self, include_answers=False):
        result = {
            'id': self.id,
            'machine_id': self.machine_id,
            'machine_name': self.machine.name if self.machine else None,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'tanggal': self.tanggal.isoformat() if self.tanggal else None,
            'shift': self.shift,
            'operator_name': self.operator_name,
            'submitted_by': self.submitted_by,
            'submitted_by_name': self.user.full_name if self.user else None,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'status': self.status,
            'notes': self.notes
        }
        if include_answers:
            result['answers'] = [a.to_dict() for a in self.answers]
        return result


class PreShiftChecklistAnswer(db.Model):
    """Jawaban per item"""
    __tablename__ = 'pre_shift_checklist_answers'
    
    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.Integer, db.ForeignKey('pre_shift_checklist_submissions.id'), nullable=False)
    item_id = db.Column(db.Integer, db.ForeignKey('pre_shift_checklist_items.id'), nullable=False)
    status = db.Column(db.String(10), nullable=False)  # OK, NG, NA
    catatan = db.Column(db.Text, nullable=True)
    photo_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=now_wib)
    
    # Relationships
    submission = db.relationship('PreShiftChecklistSubmission', back_populates='answers')
    item = db.relationship('PreShiftChecklistItem', backref=db.backref('answers', lazy='dynamic'))
    
    __table_args__ = (
        db.UniqueConstraint('submission_id', 'item_id', name='uq_checklist_answer'),
    )
    
    def to_dict(self):
        # Get latest corrective action if exists
        corrective = None
        if hasattr(self, 'corrective_actions') and self.corrective_actions.count() > 0:
            latest = self.corrective_actions.order_by(PreShiftChecklistCorrectiveAction.created_at.desc()).first()
            if latest:
                corrective = latest.to_dict()
        
        return {
            'id': self.id,
            'submission_id': self.submission_id,
            'item_id': self.item_id,
            'item': self.item.to_dict() if self.item else None,
            'status': self.status,
            'catatan': self.catatan,
            'photo_url': self.photo_url,
            'corrective_action': corrective
        }


class PreShiftChecklistAuditLog(db.Model):
    """Audit trail untuk semua perubahan pada checklist"""
    __tablename__ = 'pre_shift_checklist_audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.Integer, db.ForeignKey('pre_shift_checklist_submissions.id'), nullable=True)
    answer_id = db.Column(db.Integer, db.ForeignKey('pre_shift_checklist_answers.id'), nullable=True)
    action = db.Column(db.String(50), nullable=False)  # created, updated, status_changed, corrective_added
    field_name = db.Column(db.String(100), nullable=True)  # e.g., 'status', 'catatan'
    old_value = db.Column(db.Text, nullable=True)
    new_value = db.Column(db.Text, nullable=True)
    changed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    changed_at = db.Column(db.DateTime, default=now_wib)
    ip_address = db.Column(db.String(50), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    # Relationships
    submission = db.relationship('PreShiftChecklistSubmission', backref=db.backref('audit_logs', lazy='dynamic'))
    answer = db.relationship('PreShiftChecklistAnswer', backref=db.backref('audit_logs', lazy='dynamic'))
    user = db.relationship('User', backref=db.backref('checklist_audit_logs', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'submission_id': self.submission_id,
            'answer_id': self.answer_id,
            'action': self.action,
            'field_name': self.field_name,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'changed_by': self.changed_by,
            'changed_by_name': self.user.full_name if self.user else None,
            'changed_at': self.changed_at.isoformat() if self.changed_at else None,
            'notes': self.notes
        }


class PreShiftChecklistCorrectiveAction(db.Model):
    """Tindakan perbaikan untuk item NG - link ke Maintenance"""
    __tablename__ = 'pre_shift_checklist_corrective_actions'
    
    id = db.Column(db.Integer, primary_key=True)
    answer_id = db.Column(db.Integer, db.ForeignKey('pre_shift_checklist_answers.id'), nullable=False)
    maintenance_record_id = db.Column(db.Integer, db.ForeignKey('maintenance_records.id'), nullable=True)
    
    # Status perbaikan
    repair_status = db.Column(db.String(50), nullable=False, default='pending')
    # pending, in_progress, completed, cannot_repair, deferred
    
    # Keterangan dari supervisor/kepala shift (prioritas perbaikan)
    supervisor_note = db.Column(db.Text, nullable=True)  # e.g., "Harus segera diperbaiki"
    priority = db.Column(db.String(20), nullable=False, default='normal')  # urgent, high, normal, low
    supervisor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    supervisor_noted_at = db.Column(db.DateTime, nullable=True)
    
    # Keterangan dari maintenance
    repair_notes = db.Column(db.Text, nullable=True)  # Catatan perbaikan
    reason_cannot_repair = db.Column(db.Text, nullable=True)  # Alasan jika tidak bisa diperbaiki
    deferred_reason = db.Column(db.Text, nullable=True)  # Alasan jika ditunda
    deferred_until = db.Column(db.Date, nullable=True)  # Ditunda sampai kapan
    
    # Waktu perbaikan
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # Siapa yang handle
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    handled_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    created_at = db.Column(db.DateTime, default=now_wib)
    updated_at = db.Column(db.DateTime, default=now_wib, onupdate=now_wib)
    
    # Relationships
    answer = db.relationship('PreShiftChecklistAnswer', backref=db.backref('corrective_actions', lazy='dynamic'))
    maintenance_record = db.relationship('MaintenanceRecord', backref=db.backref('checklist_corrective_actions', lazy='dynamic'))
    assigned_user = db.relationship('User', foreign_keys=[assigned_to], backref=db.backref('assigned_corrective_actions', lazy='dynamic'))
    handled_user = db.relationship('User', foreign_keys=[handled_by], backref=db.backref('handled_corrective_actions', lazy='dynamic'))
    supervisor = db.relationship('User', foreign_keys=[supervisor_id], backref=db.backref('supervisor_corrective_actions', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'answer_id': self.answer_id,
            'maintenance_record_id': self.maintenance_record_id,
            'repair_status': self.repair_status,
            'priority': self.priority,
            'supervisor_note': self.supervisor_note,
            'supervisor_id': self.supervisor_id,
            'supervisor_name': self.supervisor.full_name if self.supervisor else None,
            'supervisor_noted_at': self.supervisor_noted_at.isoformat() if self.supervisor_noted_at else None,
            'repair_notes': self.repair_notes,
            'reason_cannot_repair': self.reason_cannot_repair,
            'deferred_reason': self.deferred_reason,
            'deferred_until': self.deferred_until.isoformat() if self.deferred_until else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'assigned_to': self.assigned_to,
            'assigned_to_name': self.assigned_user.full_name if self.assigned_user else None,
            'handled_by': self.handled_by,
            'handled_by_name': self.handled_user.full_name if self.handled_user else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
