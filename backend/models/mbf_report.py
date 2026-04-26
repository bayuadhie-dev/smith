from datetime import datetime, date
from . import db

class MBFReport(db.Model):
    """
    MBF (Mahakam Beta Farma) Production & Delivery Target Report
    Custom report for MBF customer with specific products (Octenic, Gloveclean)
    """
    __tablename__ = 'mbf_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    report_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    
    # Report period
    delivery_date = db.Column(db.Date, nullable=False)
    period_start = db.Column(db.Date, nullable=False)  # Monday
    period_end = db.Column(db.Date, nullable=False)    # Friday
    
    # Target information
    target_octenic = db.Column(db.Numeric(15, 2), nullable=False, default=0)  # Target quantity for Octenic
    target_gloveclean = db.Column(db.Numeric(15, 2), nullable=False, default=0)  # Target quantity for Gloveclean
    
    # Totals
    total_target = db.Column(db.Numeric(15, 2), nullable=False)
    total_actual = db.Column(db.Numeric(15, 2), nullable=False)
    achievement_percentage = db.Column(db.Numeric(5, 2), default=0)
    
    # Carton totals (calculated)
    total_target_cartons = db.Column(db.Numeric(15, 2), default=0)
    total_actual_cartons = db.Column(db.Numeric(15, 2), default=0)
    
    # Actual production
    actual_octenic = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    actual_gloveclean = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    
    # Issue explanation (mandatory if target not achieved)
    issue_explanation = db.Column(db.Text, nullable=True)
    
    # Status and workflow
    status = db.Column(db.String(20), nullable=False, default='draft')  # draft, pending_review, approved, rejected
    
    # Approval workflow
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Level 1: Production Staff
    staff_name = db.Column(db.String(200), nullable=True)
    staff_signature = db.Column(db.String(200), nullable=True)
    staff_date = db.Column(db.DateTime, nullable=True)
    
    # Level 2: Production Supervisor
    supervisor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    supervisor_name = db.Column(db.String(200), nullable=True)
    supervisor_signature = db.Column(db.String(200), nullable=True)
    supervisor_date = db.Column(db.DateTime, nullable=True)
    supervisor_notes = db.Column(db.Text, nullable=True)
    
    # Level 3: Production Manager
    manager_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    manager_name = db.Column(db.String(200), nullable=True)
    manager_signature = db.Column(db.String(200), nullable=True)
    manager_date = db.Column(db.DateTime, nullable=True)
    manager_notes = db.Column(db.Text, nullable=True)
    
    # Relationships
    creator = db.relationship('User', foreign_keys=[created_by])
    supervisor = db.relationship('User', foreign_keys=[supervisor_id])
    manager = db.relationship('User', foreign_keys=[manager_id])
    details = db.relationship('MBFReportDetail', back_populates='report', cascade='all, delete-orphan')
    
    def calculate_achievement(self):
        """Calculate achievement percentage based on actual vs target"""
        if float(self.total_target or 0) > 0:
            self.achievement_percentage = (float(self.total_actual or 0) / float(self.total_target) * 100)
        else:
            self.achievement_percentage = 0
        return self.achievement_percentage
    
    def check_mandatory_issue(self):
        """Check if issue explanation is mandatory (target not achieved)"""
        return float(self.total_actual or 0) < float(self.total_target or 0)
    
    def get_approval_status(self):
        """Get current approval status"""
        if self.status == 'approved':
            return 'Approved'
        elif self.status == 'rejected':
            return 'Rejected'
        elif self.manager_date:
            return 'Pending Final Approval'
        elif self.supervisor_date:
            return 'Pending Manager Approval'
        elif self.staff_date:
            return 'Pending Supervisor Approval'
        else:
            return 'Draft'


class MBFReportDetail(db.Model):
    """
    Daily production details for MBF Report
    Tracks production per day and shift
    """
    __tablename__ = 'mbf_report_details'
    
    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey('mbf_reports.id', ondelete='CASCADE'), nullable=False)
    
    # Day information
    day_name = db.Column(db.String(20), nullable=False)  # Monday, Tuesday, etc.
    day_date = db.Column(db.Date, nullable=False)
    
    # Shift information
    shift_number = db.Column(db.Integer, nullable=False)  # 1, 2, 3, etc.
    shift_name = db.Column(db.String(50), nullable=True)  # Shift 1, Shift 2, etc.
    
    # Batch numbers
    octn_batch_number = db.Column(db.String(100), nullable=True)
    glvcn_batch_number = db.Column(db.String(100), nullable=True)

    
    # Production targets and actual
    target_octenic = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    target_gloveclean = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    target_total = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    
    actual_octenic = db.Column(db.Numeric(15, 2), default=0)
    actual_gloveclean = db.Column(db.Numeric(15, 2), default=0)
    actual_total = db.Column(db.Numeric(15, 2), default=0)
    
    # Carton values (calculated)
    target_octenic_cartons = db.Column(db.Numeric(15, 2), default=0)
    target_gloveclean_cartons = db.Column(db.Numeric(15, 2), default=0)
    target_total_cartons = db.Column(db.Numeric(15, 2), default=0)
    actual_octenic_cartons = db.Column(db.Numeric(15, 2), default=0)
    actual_gloveclean_cartons = db.Column(db.Numeric(15, 2), default=0)
    actual_total_cartons = db.Column(db.Numeric(15, 2), default=0)
    
    # Panjang Kain (cloth length, auto-calculated from pcs)
    # Octenic: per pcs = 0.225 * 4 * 39 = 35.1
    # Gloveclean: per pcs = 0.45 * 2 * 72 = 64.8
    target_cloth_octenic = db.Column(db.Numeric(15, 2), default=0)
    target_cloth_gloveclean = db.Column(db.Numeric(15, 2), default=0)
    actual_cloth_octenic = db.Column(db.Numeric(15, 2), default=0)
    actual_cloth_gloveclean = db.Column(db.Numeric(15, 2), default=0)
    
    # Roll Isolasi (Octenic only, 1 roll = 100 karton, can be manually overridden)
    target_isolation_roll = db.Column(db.Numeric(10, 2), default=0)
    actual_isolation_roll = db.Column(db.Numeric(10, 2), default=0)
    
    # Roll Packaging (Octenic: pc/4761, Gloveclean: pc/5000)
    target_roll_packaging_octenic = db.Column(db.Numeric(10, 2), default=0)
    target_roll_packaging_gloveclean = db.Column(db.Numeric(10, 2), default=0)
    actual_roll_packaging_octenic = db.Column(db.Numeric(10, 2), default=0)
    actual_roll_packaging_gloveclean = db.Column(db.Numeric(10, 2), default=0)

    # Roll Sticker (Octenic only: pc/2000)
    target_roll_sticker_octenic = db.Column(db.Numeric(10, 2), default=0)
    actual_roll_sticker_octenic = db.Column(db.Numeric(10, 2), default=0)
    
    # Karton (Octenic: 1 karton = 39 pcs, Gloveclean: 1 karton = 72 pcs)
    target_karton_octenic = db.Column(db.Numeric(15, 2), default=0)
    target_karton_gloveclean = db.Column(db.Numeric(15, 2), default=0)
    actual_karton_octenic = db.Column(db.Numeric(15, 2), default=0)
    actual_karton_gloveclean = db.Column(db.Numeric(15, 2), default=0)
    
    # Quality & Waste Tracking - Octenic (6 fields)
    # Manual inputs
    octn_setting_packaging = db.Column(db.Numeric(10, 2), default=0)
    octn_setting_sticker = db.Column(db.Numeric(10, 2), default=0)
    octn_grade_b = db.Column(db.Numeric(10, 2), default=0)
    octn_grade_c = db.Column(db.Numeric(10, 2), default=0)
    # Auto-calculated: (setting_packaging + setting_sticker + grade_b + grade_c) / 4761
    octn_waste_packaging = db.Column(db.Numeric(10, 2), default=0)
    # Auto-calculated: setting_sticker + grade_b + grade_c
    octn_waste_sticker = db.Column(db.Numeric(10, 2), default=0)
    
    # Quality & Waste Tracking - Gloveclean (4 fields, no sticker)
    # Manual inputs
    glvcn_setting_packaging = db.Column(db.Numeric(10, 2), default=0)
    glvcn_grade_b = db.Column(db.Numeric(10, 2), default=0)
    glvcn_grade_c = db.Column(db.Numeric(10, 2), default=0)
    # Auto-calculated: (setting_packaging + grade_b + grade_c) / 5000
    glvcn_waste_packaging = db.Column(db.Numeric(10, 2), default=0)
    
    # New Fields for Waste Kain + Obat (Calculated as strings for display)
    octn_waste_cloth_chem = db.Column(db.String(100), nullable=True)
    glvcn_waste_cloth_chem = db.Column(db.String(100), nullable=True)
    
    # Status calculation
    status = db.Column(db.String(20), default='on_track')  # on_track, at_risk, delayed
    
    # Notes for this shift
    notes = db.Column(db.Text, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    report = db.relationship('MBFReport', back_populates='details')
    
    def calculate_status(self):
        """Calculate if target is achieved for this shift"""
        if float(self.actual_total or 0) >= float(self.target_total or 0):
            self.status = 'achieved'
        else:
            self.status = 'minus'
        return self.status
