from datetime import datetime
import json
from . import db

class ConvertingMachine(db.Model):
    """Mesin-mesin Converting:
    - 2x Perforating
    - 2x Slitting
    - 1x Laminasi Kain
    - 1x Bagmaker
    - 1x Folding 200 (1)
    - 1x Folding 200 (2)
    - 1x Folding 280
    - 1x Folding 320
    - 1x Folding 600
    - 1x Cutting
    Total: 12 mesin
    """
    __tablename__ = 'converting_machines'
    
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    machine_type = db.Column(db.String(100), nullable=False)  # perforating, slitting, laminasi, bagmaker, folding, cutting
    status = db.Column(db.String(50), nullable=False, default='idle')  # idle, running, maintenance, breakdown
    default_speed = db.Column(db.Integer, default=0)  # pcs/menit
    target_efficiency = db.Column(db.Integer, default=60)  # Target efficiency %
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    productions = db.relationship('ConvertingProduction', back_populates='machine', lazy='dynamic')
    
    def __repr__(self):
        return f'<ConvertingMachine {self.code} - {self.name}>'


class ConvertingProduction(db.Model):
    """Production record untuk Converting - dengan data spesifik per jenis mesin"""
    __tablename__ = 'converting_productions'
    
    id = db.Column(db.Integer, primary_key=True)
    production_date = db.Column(db.Date, nullable=False, index=True)
    shift = db.Column(db.Integer, nullable=False, default=1)  # 1, 2, 3
    machine_id = db.Column(db.Integer, db.ForeignKey('converting_machines.id'), nullable=False)
    
    # Common fields untuk semua mesin
    njo = db.Column(db.String(100), nullable=True)  # Nomor Job Order
    product_name = db.Column(db.String(200), nullable=True)
    specification = db.Column(db.String(500), nullable=True)
    
    # Production Result (Grade A, B, Loss) - untuk Perforating, Folding, Cutting
    grade_a = db.Column(db.Numeric(15, 2), default=0)  # kg atau pcs
    grade_b = db.Column(db.Numeric(15, 2), default=0)
    loss_kg = db.Column(db.Numeric(15, 2), default=0)
    
    # Machine-specific data disimpan sebagai JSON
    # Slitting: {rows: [{no_roll, width, weight, length, thick, slitting: [kg1..kg10], loss, total_length, total_weight}]}
    # Perforating: {rows: [{no_roll, width, weight, length, repeat_length, repeat_width}]}
    # Folding: {rows: [{no_roll, no_slitting, weight, length}]}
    # Cutting: {rows: [{no_roll, width, weight, length, repeat_length, repeat_width}]}
    # Laminasi: {film_axis: {...}, nonwoven_axis: {...}, rows: [{no, time_start, time_end, ...}]}
    machine_data = db.Column(db.Text, nullable=True)  # JSON string
    
    # Operator
    operator_name = db.Column(db.String(200), nullable=True)
    
    # Additional Info
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), default='completed')
    
    # Audit
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    machine = db.relationship('ConvertingMachine', back_populates='productions')
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    
    def get_machine_data(self):
        """Parse machine_data JSON"""
        if self.machine_data:
            try:
                return json.loads(self.machine_data)
            except:
                return {}
        return {}
    
    def set_machine_data(self, data):
        """Set machine_data as JSON string"""
        self.machine_data = json.dumps(data) if data else None

    # ============ DYNAMIC HYBRID PROPERTIES FOR OEE & DASHBOARD COMPATIBILITY ============
    @property
    def machine_data_dict(self):
        """Helper to get machine_data parsed as a dictionary"""
        return self.get_machine_data() or {}

    @property
    def good_quantity(self):
        """Grade A output quantity"""
        return float(self.grade_a) if self.grade_a else 0.0

    @property
    def reject_quantity(self):
        """Grade B (or Grade C for bagmaker) output quantity"""
        return float(self.grade_b) if self.grade_b else 0.0

    @property
    def actual_quantity(self):
        """Total output (good + reject)"""
        return self.good_quantity + self.reject_quantity

    @property
    def planned_runtime(self):
        """Planned runtime in minutes (default shift duration is 8 hours = 480 mins)"""
        mdata = self.machine_data_dict
        return int(mdata.get('production_hour_minutes', 480))

    @property
    def downtime_minutes(self):
        """Downtime duration in minutes"""
        mdata = self.machine_data_dict
        return int(mdata.get('downtime_minutes', 0))

    @property
    def idle_time(self):
        """Idle duration in minutes"""
        mdata = self.machine_data_dict
        return int(mdata.get('idle_time', 0))

    @property
    def actual_runtime(self):
        """Actual runtime (planned_runtime - downtime_minutes - idle_time)"""
        return self.planned_runtime - self.downtime_minutes - self.idle_time

    @property
    def machine_speed(self):
        """Machine speed (defaults to machine's default_speed if not set in production record)"""
        mdata = self.machine_data_dict
        if 'machine_speed' in mdata and mdata['machine_speed'] is not None:
            try:
                return float(mdata['machine_speed'])
            except ValueError:
                pass
        return float(self.machine.default_speed) if self.machine and self.machine.default_speed else 0.0

    @property
    def efficiency_rate(self):
        """OEE / Efficiency rate in percentage"""
        speed = self.machine_speed
        runtime = self.actual_runtime
        if speed > 0 and runtime > 0:
            expected = speed * runtime
            if expected > 0:
                return round((self.good_quantity / expected) * 100, 2)
        # Fallback to machine target efficiency or default 60% if speed/runtime info is missing
        return float(self.machine.target_efficiency) if self.machine and self.machine.target_efficiency else 60.0

    @property
    def quality_rate(self):
        """Quality rate in percentage"""
        total = self.actual_quantity
        if total > 0:
            return round((self.good_quantity / total) * 100, 2)
        return 100.0
    
    def __repr__(self):
        return f'<ConvertingProduction {self.id} - {self.production_date} Shift {self.shift}>'
