from datetime import datetime
from . import db

class Asset(db.Model):
    """
    Unified Asset Management Model
    Consolidates FixedAsset (finance), Machine (production), and Equipment tracking
    """
    __tablename__ = 'assets'
    
    id = db.Column(db.Integer, primary_key=True)
    asset_code = db.Column(db.String(100), unique=True, nullable=False, index=True)
    asset_name = db.Column(db.String(200), nullable=False)
    
    # Classification
    asset_type = db.Column(db.String(50), nullable=False)  # machinery, building, vehicle, IT_equipment, furniture, land
    category = db.Column(db.String(100), nullable=True)  # production_machine, office_equipment, warehouse, etc.
    subcategory = db.Column(db.String(100), nullable=True)
    description = db.Column(db.Text, nullable=True)
    
    # Lifecycle Status
    status = db.Column(db.String(50), nullable=False, default='planning')
    # planning, procured, in_transit, installed, commissioned, active, maintenance, idle, retired, disposed
    
    # ========== PROCUREMENT ==========
    purchase_order_id = db.Column(db.Integer, db.ForeignKey('purchase_orders.id'), nullable=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    purchase_date = db.Column(db.Date, nullable=True)
    purchase_cost = db.Column(db.Numeric(15, 2), nullable=True)
    invoice_number = db.Column(db.String(100), nullable=True)
    
    # Warranty
    warranty_start_date = db.Column(db.Date, nullable=True)
    warranty_end_date = db.Column(db.Date, nullable=True)
    warranty_terms = db.Column(db.Text, nullable=True)
    
    # ========== INSTALLATION & COMMISSIONING ==========
    installation_date = db.Column(db.Date, nullable=True)
    commissioning_date = db.Column(db.Date, nullable=True)
    location = db.Column(db.String(200), nullable=True)
    # Structured functional-location FK (see FunctionalLocation model docstring) -
    # nullable, opt-in; `location` (free-text) stays authoritative for display
    # until an asset is explicitly placed in the hierarchy.
    functional_location_id = db.Column(db.Integer, db.ForeignKey('functional_locations.id'), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'), nullable=True)
    responsible_person_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True)
    
    # ========== FINANCIAL (DEPRECIATION) ==========
    # This is the COMMERCIAL/book depreciation - the one that posts to the real
    # GL (see DepreciationSchedule.book_type='commercial').
    depreciation_method = db.Column(db.String(50), nullable=True, default='straight_line')
    # straight_line, declining_balance, units_of_production
    useful_life_years = db.Column(db.Integer, nullable=True)
    useful_life_units = db.Column(db.Integer, nullable=True)  # For units_of_production method
    salvage_value = db.Column(db.Numeric(15, 2), default=0)
    accumulated_depreciation = db.Column(db.Numeric(15, 2), default=0)
    last_depreciation_date = db.Column(db.Date, nullable=True)

    # Parallel FISCAL/tax depreciation (SAP FI-AA "parallel depreciation areas"
    # concept, 2026-09-14) - tax law often mandates a different method/useful life
    # than the commercial book. All nullable/opt-in: when tax_useful_life_years is
    # not set, the fiscal book simply mirrors the commercial one (no behavior
    # change for existing assets). Fiscal depreciation is a REPORTING-ONLY parallel
    # ledger, matching real practice - it does NOT post to the operational GL
    # (only commercial does), so there's no double-posting risk.
    tax_depreciation_method = db.Column(db.String(50), nullable=True)
    tax_useful_life_years = db.Column(db.Integer, nullable=True)
    tax_accumulated_depreciation = db.Column(db.Numeric(15, 2), default=0)
    tax_last_depreciation_date = db.Column(db.Date, nullable=True)
    
    # ========== PRODUCTION MACHINE SPECIFIC ==========
    is_production_machine = db.Column(db.Boolean, default=False, nullable=False)
    machine_code = db.Column(db.String(50), nullable=True, index=True)  # Legacy machine code
    capacity = db.Column(db.Numeric(15, 2), nullable=True)
    speed = db.Column(db.Integer, nullable=True)  # units per hour
    capacity_uom = db.Column(db.String(20), nullable=True)
    
    # Technical Specifications (JSON)
    specifications = db.Column(db.Text, nullable=True)  # JSON: {voltage, power, dimensions, etc}
    
    # ========== MAINTENANCE ==========
    last_maintenance_date = db.Column(db.Date, nullable=True)
    next_maintenance_date = db.Column(db.Date, nullable=True)
    maintenance_frequency_days = db.Column(db.Integer, nullable=True)
    total_maintenance_cost = db.Column(db.Numeric(15, 2), default=0)
    total_downtime_hours = db.Column(db.Numeric(10, 2), default=0)
    
    # ========== DISPOSAL ==========
    disposal_date = db.Column(db.Date, nullable=True)
    disposal_method = db.Column(db.String(50), nullable=True)  # sold, scrapped, donated, traded
    disposal_value = db.Column(db.Numeric(15, 2), nullable=True)
    disposal_notes = db.Column(db.Text, nullable=True)
    
    # ========== AUDIT ==========
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # ========== RELATIONSHIPS ==========
    purchase_order = db.relationship('PurchaseOrder', foreign_keys=[purchase_order_id])
    supplier = db.relationship('Supplier')
    department = db.relationship('Department')
    functional_location = db.relationship('FunctionalLocation')
    responsible_person = db.relationship('Employee', foreign_keys=[responsible_person_id])
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    updated_by_user = db.relationship('User', foreign_keys=[updated_by])
    
    maintenance_records = db.relationship('MaintenanceRecord', back_populates='asset', foreign_keys='MaintenanceRecord.asset_id')
    depreciation_schedules = db.relationship('DepreciationSchedule', back_populates='asset', cascade='all, delete-orphan')
    transfers = db.relationship('AssetTransfer', back_populates='asset', cascade='all, delete-orphan')
    valuations = db.relationship('AssetValuation', back_populates='asset', cascade='all, delete-orphan')
    
    # ========== COMPUTED PROPERTIES ==========
    @property
    def net_book_value(self):
        """Calculate Net Book Value (Cost - Accumulated Depreciation)"""
        if not self.purchase_cost:
            return 0
        return float(self.purchase_cost) - float(self.accumulated_depreciation or 0)
    
    @property
    def annual_depreciation(self):
        """Calculate annual depreciation amount"""
        if not self.purchase_cost or not self.useful_life_years:
            return 0
        
        if self.depreciation_method == 'straight_line':
            return (float(self.purchase_cost) - float(self.salvage_value or 0)) / self.useful_life_years
        elif self.depreciation_method == 'declining_balance':
            # Double declining balance
            rate = 2 / self.useful_life_years
            return self.net_book_value * rate
        return 0
    
    @property
    def monthly_depreciation(self):
        """Monthly depreciation amount"""
        return self.annual_depreciation / 12

    @property
    def tax_annual_depreciation(self):
        """Parallel fiscal/tax-book annual depreciation - falls back to the
        commercial method/useful life when no separate tax values are configured
        (i.e. behaves identically to annual_depreciation for existing assets)."""
        method = self.tax_depreciation_method or self.depreciation_method
        useful_life = self.tax_useful_life_years or self.useful_life_years
        if not self.purchase_cost or not useful_life:
            return 0
        if method == 'straight_line':
            return (float(self.purchase_cost) - float(self.salvage_value or 0)) / useful_life
        elif method == 'declining_balance':
            rate = 2 / useful_life
            net_book_value = float(self.purchase_cost) - float(self.tax_accumulated_depreciation or 0)
            return net_book_value * rate
        return 0

    @property
    def tax_monthly_depreciation(self):
        return self.tax_annual_depreciation / 12
    
    @property
    def is_under_warranty(self):
        """Check if asset is still under warranty"""
        if not self.warranty_end_date:
            return False
        from datetime import date
        return date.today() <= self.warranty_end_date
    
    @property
    def age_years(self):
        """Calculate asset age in years"""
        if not self.purchase_date:
            return 0
        from datetime import date
        delta = date.today() - self.purchase_date
        return delta.days / 365.25
    
    def __repr__(self):
        return f'<Asset {self.asset_code} - {self.asset_name}>'


class DepreciationSchedule(db.Model):
    """
    Auto-generated depreciation schedule for assets
    One record per month for the asset's useful life
    """
    __tablename__ = 'depreciation_schedules'
    
    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(db.Integer, db.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False)

    period_date = db.Column(db.Date, nullable=False, index=True)  # First day of month
    # Parallel depreciation areas (SAP FI-AA concept, 2026-09-14) - 'commercial'
    # (the real book, posts to GL) or 'fiscal' (tax-law parallel book, reporting
    # only, never posted). Default 'commercial' keeps every pre-existing row's
    # meaning unchanged.
    book_type = db.Column(db.String(20), nullable=False, default='commercial')
    depreciation_amount = db.Column(db.Numeric(15, 2), nullable=False)
    accumulated_depreciation = db.Column(db.Numeric(15, 2), nullable=False)
    net_book_value = db.Column(db.Numeric(15, 2), nullable=False)

    # Posting to accounting
    is_posted = db.Column(db.Boolean, default=False, nullable=False)
    posted_date = db.Column(db.DateTime, nullable=True)
    accounting_entry_id = db.Column(db.Integer, db.ForeignKey('accounting_entries.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    asset = db.relationship('Asset', back_populates='depreciation_schedules')
    accounting_entry = db.relationship('AccountingEntry')

    __table_args__ = (
        db.UniqueConstraint('asset_id', 'period_date', 'book_type', name='unique_asset_period_book'),
        db.Index('idx_depreciation_period', 'period_date'),
    )
    
    def __repr__(self):
        return f'<DepreciationSchedule Asset:{self.asset_id} Period:{self.period_date}>'


class FunctionalLocation(db.Model):
    """Functional Location hierarchy (SAP PM concept, 2026-09-14) - both Asset.location
    and Machine.location were plain free-text strings with zero hierarchy (confirmed
    during the PM gap audit). Self-referential parent/child so a real Plant -> Building
    -> Line -> Machine-position structure can be modeled, opt-in: Asset/Machine's
    existing free-text `location` fields are left untouched for backward compatibility,
    this is an additive `functional_location_id` FK alongside them."""
    __tablename__ = 'functional_locations'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    location_type = db.Column(db.String(50), nullable=True)  # plant, building, line, position - free-text, not enforced
    parent_location_id = db.Column(db.Integer, db.ForeignKey('functional_locations.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    parent_location = db.relationship('FunctionalLocation', remote_side=[id], foreign_keys=[parent_location_id])

    def __repr__(self):
        return f'<FunctionalLocation {self.code} - {self.name}>'


class AssetTransfer(db.Model):
    """
    Track asset transfers between locations/departments
    """
    __tablename__ = 'asset_transfers'
    
    id = db.Column(db.Integer, primary_key=True)
    transfer_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    asset_id = db.Column(db.Integer, db.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False)
    
    transfer_date = db.Column(db.Date, nullable=False, index=True)
    
    # From
    from_location = db.Column(db.String(200), nullable=True)
    from_department_id = db.Column(db.Integer, db.ForeignKey('departments.id'), nullable=True)
    from_responsible_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True)
    
    # To
    to_location = db.Column(db.String(200), nullable=False)
    to_department_id = db.Column(db.Integer, db.ForeignKey('departments.id'), nullable=True)
    to_responsible_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    
    reason = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='pending')  # pending, in_transit, completed, cancelled
    
    # Approval
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    
    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    asset = db.relationship('Asset', back_populates='transfers')
    from_department = db.relationship('Department', foreign_keys=[from_department_id])
    to_department = db.relationship('Department', foreign_keys=[to_department_id])
    from_responsible = db.relationship('Employee', foreign_keys=[from_responsible_id])
    to_responsible = db.relationship('Employee', foreign_keys=[to_responsible_id])
    approved_by_user = db.relationship('User', foreign_keys=[approved_by])
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    
    def __repr__(self):
        return f'<AssetTransfer {self.transfer_number}>'


class AssetValuation(db.Model):
    """
    Track asset revaluations
    """
    __tablename__ = 'asset_valuations'
    
    id = db.Column(db.Integer, primary_key=True)
    valuation_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    asset_id = db.Column(db.Integer, db.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False)
    
    valuation_date = db.Column(db.Date, nullable=False, index=True)
    valuation_type = db.Column(db.String(50), nullable=False)  # revaluation, impairment, market_adjustment
    
    old_value = db.Column(db.Numeric(15, 2), nullable=False)
    new_value = db.Column(db.Numeric(15, 2), nullable=False)
    adjustment_amount = db.Column(db.Numeric(15, 2), nullable=False)
    
    reason = db.Column(db.Text, nullable=False)
    valuer_name = db.Column(db.String(200), nullable=True)  # External valuer if applicable
    valuation_report = db.Column(db.String(500), nullable=True)  # File path to report
    
    # Approval
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    
    # Accounting impact
    accounting_entry_id = db.Column(db.Integer, db.ForeignKey('accounting_entries.id'), nullable=True)
    
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    asset = db.relationship('Asset', back_populates='valuations')
    approved_by_user = db.relationship('User', foreign_keys=[approved_by])
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    accounting_entry = db.relationship('AccountingEntry')
    
    def __repr__(self):
        return f'<AssetValuation {self.valuation_number}>'


class SparePart(db.Model):
    """
    Spare parts inventory for asset maintenance (MRO - Maintenance, Repair, Operations)
    """
    __tablename__ = 'spare_parts'
    
    id = db.Column(db.Integer, primary_key=True)
    part_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    part_name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(100), nullable=True)  # electrical, mechanical, hydraulic, etc.
    description = db.Column(db.Text, nullable=True)
    
    # Inventory
    uom = db.Column(db.String(20), nullable=False)
    current_stock = db.Column(db.Numeric(15, 2), default=0, nullable=False)
    min_stock = db.Column(db.Numeric(15, 2), default=0)
    max_stock = db.Column(db.Numeric(15, 2), nullable=True)
    
    # Cost
    unit_cost = db.Column(db.Numeric(15, 2), nullable=True)
    last_purchase_cost = db.Column(db.Numeric(15, 2), nullable=True)
    
    # Supplier
    primary_supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    lead_time_days = db.Column(db.Integer, nullable=True)
    
    # Compatibility (JSON array of asset_ids or asset_codes)
    compatible_assets = db.Column(db.Text, nullable=True)  # JSON: ["MACH-001", "MACH-002"]
    
    # Storage
    warehouse_location = db.Column(db.String(100), nullable=True)
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    supplier = db.relationship('Supplier')
    movements = db.relationship('SparePartMovement', back_populates='spare_part', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<SparePart {self.part_number} - {self.part_name}>'


class SparePartMovement(db.Model):
    """
    Track spare parts inventory movements
    """
    __tablename__ = 'spare_part_movements'
    
    id = db.Column(db.Integer, primary_key=True)
    movement_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    spare_part_id = db.Column(db.Integer, db.ForeignKey('spare_parts.id', ondelete='CASCADE'), nullable=False)
    
    movement_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    movement_type = db.Column(db.String(50), nullable=False)  # in, out, adjustment, return
    
    quantity = db.Column(db.Numeric(15, 2), nullable=False)
    unit_cost = db.Column(db.Numeric(15, 2), nullable=True)
    total_cost = db.Column(db.Numeric(15, 2), nullable=True)
    
    # Reference
    maintenance_record_id = db.Column(db.Integer, db.ForeignKey('maintenance_records.id'), nullable=True)
    asset_id = db.Column(db.Integer, db.ForeignKey('assets.id'), nullable=True)
    purchase_order_id = db.Column(db.Integer, db.ForeignKey('purchase_orders.id'), nullable=True)
    
    # Stock after movement
    stock_before = db.Column(db.Numeric(15, 2), nullable=True)
    stock_after = db.Column(db.Numeric(15, 2), nullable=True)
    
    notes = db.Column(db.Text, nullable=True)
    performed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    spare_part = db.relationship('SparePart', back_populates='movements')
    maintenance_record = db.relationship('MaintenanceRecord')
    asset = db.relationship('Asset')
    purchase_order = db.relationship('PurchaseOrder')
    performed_by_user = db.relationship('User')
    
    def __repr__(self):
        return f'<SparePartMovement {self.movement_number}>'
