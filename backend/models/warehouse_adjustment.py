from datetime import datetime
from . import db
from utils.timezone import get_local_now

class InventoryAdjustment(db.Model):
    """Inventory adjustment for stock corrections"""
    __tablename__ = 'inventory_adjustments'
    
    id = db.Column(db.Integer, primary_key=True)
    adjustment_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=True)
    inventory_id = db.Column(db.Integer, db.ForeignKey('inventory.id'), nullable=True)
    location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=False)

    # Adjustment Details
    adjustment_type = db.Column(db.String(50), nullable=False)  # positive, negative, recount
    reason = db.Column(db.String(100), nullable=False)  # damaged, expired, theft, counting_error, system_error

    # Value Adjustment mode: True = adjust cost/value only (no quantity change,
    # e.g. revaluation) - Inventory.quantity_on_hand is left untouched and
    # total_cost_impact is the user-entered value delta. False (default) =
    # physical quantity adjustment from stock-opname-style variance.
    is_value_adjustment = db.Column(db.Boolean, nullable=False, default=False)

    # Quantities
    system_quantity = db.Column(db.Numeric(15, 2), nullable=False)  # Current system quantity
    physical_quantity = db.Column(db.Numeric(15, 2), nullable=False)  # Actual counted quantity
    adjustment_quantity = db.Column(db.Numeric(15, 2), nullable=False)  # Difference (physical - system)

    # Account Preferences: default is inventory_account_settings.akun_penyesuaian_id,
    # this field allows a per-adjustment override.
    akun_penyesuaian_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)

    # Batch Information
    batch_number = db.Column(db.String(100), nullable=True)
    lot_number = db.Column(db.String(100), nullable=True)
    serial_number = db.Column(db.String(100), nullable=True)
    
    # Cost Impact
    unit_cost = db.Column(db.Numeric(15, 4), nullable=True)
    total_cost_impact = db.Column(db.Numeric(15, 2), nullable=True)  # adjustment_quantity * unit_cost
    
    # Approval Workflow
    status = db.Column(db.String(50), nullable=False, default='pending')  # pending, approved, rejected, applied
    requested_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    
    # Additional Information
    notes = db.Column(db.Text, nullable=True)
    reference_document = db.Column(db.String(200), nullable=True)  # Stock take reference, etc.
    adjustment_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    product = db.relationship('Product')
    material = db.relationship('Material')
    inventory = db.relationship('Inventory')
    location = db.relationship('WarehouseLocation')
    requested_by_user = db.relationship('User', foreign_keys=[requested_by])
    approved_by_user = db.relationship('User', foreign_keys=[approved_by])

    __table_args__ = (
        db.CheckConstraint(
            '(product_id IS NOT NULL AND material_id IS NULL) OR (product_id IS NULL AND material_id IS NOT NULL)',
            name='check_adjustment_product_or_material'
        ),
    )

    def __repr__(self):
        return f'<InventoryAdjustment {self.adjustment_number} - {self.adjustment_quantity}>'

    def to_dict(self):
        return {
            'id': self.id,
            'adjustment_number': self.adjustment_number,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'material_id': self.material_id,
            'material_name': self.material.name if self.material else None,
            'inventory_id': self.inventory_id,
            'location_id': self.location_id,
            'location_name': self.location.location_code if self.location else None,
            'adjustment_type': self.adjustment_type,
            'reason': self.reason,
            'is_value_adjustment': self.is_value_adjustment,
            'system_quantity': float(self.system_quantity) if self.system_quantity is not None else None,
            'physical_quantity': float(self.physical_quantity) if self.physical_quantity is not None else None,
            'adjustment_quantity': float(self.adjustment_quantity) if self.adjustment_quantity is not None else None,
            'akun_penyesuaian_id': self.akun_penyesuaian_id,
            'unit_cost': float(self.unit_cost) if self.unit_cost is not None else None,
            'total_cost_impact': float(self.total_cost_impact) if self.total_cost_impact is not None else None,
            'status': self.status,
            'requested_by': self.requested_by,
            'approved_by': self.approved_by,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'notes': self.notes,
            'reference_document': self.reference_document,
            'adjustment_date': self.adjustment_date.isoformat() if self.adjustment_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
    
    @property
    def is_positive(self):
        return self.adjustment_quantity > 0
    
    @property
    def is_negative(self):
        return self.adjustment_quantity < 0
    
    @property
    def variance_percentage(self):
        if self.system_quantity == 0:
            return 0
        return (self.adjustment_quantity / self.system_quantity) * 100

class InventoryTransfer(db.Model):
    """Inventory transfer between locations"""
    __tablename__ = 'inventory_transfers'
    
    id = db.Column(db.Integer, primary_key=True)
    transfer_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    from_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=False)
    to_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=False)
    
    # Transfer Details
    quantity = db.Column(db.Numeric(15, 2), nullable=False)
    uom = db.Column(db.String(20), nullable=False)

    # Batch Information
    batch_number = db.Column(db.String(100), nullable=True)
    lot_number = db.Column(db.String(100), nullable=True)
    serial_number = db.Column(db.String(100), nullable=True)
    
    # Status Tracking
    status = db.Column(db.String(50), nullable=False, default='pending')  # pending, in_transit, completed, cancelled
    requested_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    shipped_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    received_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Dates
    requested_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    approved_date = db.Column(db.DateTime, nullable=True)
    shipped_date = db.Column(db.DateTime, nullable=True)
    received_date = db.Column(db.DateTime, nullable=True)
    expected_date = db.Column(db.DateTime, nullable=True)
    
    # Additional Information
    reason = db.Column(db.String(200), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    priority = db.Column(db.String(20), nullable=False, default='normal')  # low, normal, high, urgent
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    product = db.relationship('Product')
    from_location = db.relationship('WarehouseLocation', foreign_keys=[from_location_id])
    to_location = db.relationship('WarehouseLocation', foreign_keys=[to_location_id])
    requested_by_user = db.relationship('User', foreign_keys=[requested_by])
    approved_by_user = db.relationship('User', foreign_keys=[approved_by])
    shipped_by_user = db.relationship('User', foreign_keys=[shipped_by])
    received_by_user = db.relationship('User', foreign_keys=[received_by])
    
    def __repr__(self):
        return f'<InventoryTransfer {self.transfer_number} - {self.quantity} {self.uom}>'
    
    @property
    def is_overdue(self):
        if self.expected_date and self.status not in ['completed', 'cancelled']:
            return get_local_now() > self.expected_date
        return False
