from datetime import datetime, date
from . import db


class MaterialConsumption(db.Model):
    """Track material consumption per Work Order - Planned vs Actual with BOM link"""
    __tablename__ = 'material_consumptions'

    id = db.Column(db.Integer, primary_key=True)
    work_order_id = db.Column(db.Integer, db.ForeignKey('work_orders.id'), nullable=False, index=True)
    material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=False, index=True)
    bom_item_id = db.Column(db.Integer, db.ForeignKey('bom_items.id'), nullable=True)

    # Planned (from BOM calculation)
    quantity_planned = db.Column(db.Numeric(15, 3), nullable=False, default=0)
    uom = db.Column(db.String(20), nullable=True)

    # Actual (from material issue / production input)
    quantity_actual = db.Column(db.Numeric(15, 3), nullable=False, default=0)

    # Variance
    variance = db.Column(db.Numeric(15, 3), nullable=False, default=0)
    variance_percentage = db.Column(db.Numeric(8, 2), nullable=False, default=0)

    # Source tracking - from which inventory / batch
    from_inventory_id = db.Column(db.Integer, db.ForeignKey('inventory.id'), nullable=True)
    from_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=True)
    from_batch_number = db.Column(db.String(100), nullable=True)

    # Issue details
    issued_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    issued_at = db.Column(db.DateTime, nullable=True)

    # Status: planned, partial, issued, completed, returned
    status = db.Column(db.String(20), nullable=False, default='planned')

    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    work_order = db.relationship('WorkOrder', backref=db.backref('material_consumptions', lazy='dynamic'))
    material = db.relationship('Material')
    bom_item = db.relationship('BOMItem')
    from_inventory = db.relationship('Inventory')
    from_location = db.relationship('WarehouseLocation')
    issued_by_user = db.relationship('User', foreign_keys=[issued_by])

    __table_args__ = (
        db.Index('idx_mc_wo_material', 'work_order_id', 'material_id'),
    )

    def compute_variance(self):
        planned = float(self.quantity_planned or 0)
        actual = float(self.quantity_actual or 0)
        self.variance = actual - planned
        self.variance_percentage = ((actual - planned) / planned * 100) if planned > 0 else 0

    def to_dict(self):
        return {
            'id': self.id,
            'work_order_id': self.work_order_id,
            'material_id': self.material_id,
            'material_code': self.material.code if self.material else None,
            'material_name': self.material.name if self.material else None,
            'material_uom': self.material.primary_uom if self.material else self.uom,
            'quantity_planned': float(self.quantity_planned or 0),
            'quantity_actual': float(self.quantity_actual or 0),
            'variance': float(self.variance or 0),
            'variance_percentage': float(self.variance_percentage or 0),
            'from_batch_number': self.from_batch_number,
            'from_location': self.from_location.location_code if self.from_location else None,
            'status': self.status,
            'issued_by': self.issued_by_user.full_name if self.issued_by_user else None,
            'issued_at': self.issued_at.isoformat() if self.issued_at else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class InventoryTransaction(db.Model):
    """Comprehensive inventory transaction log - unified view of all stock movements
    Links every stock change back to its source: WO, PO, SO, Transfer, Adjustment, etc.
    """
    __tablename__ = 'inventory_transactions'

    id = db.Column(db.Integer, primary_key=True)

    # Transaction identification
    transaction_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    transaction_type = db.Column(db.String(30), nullable=False)
    # Types: production_output, material_issue, goods_receipt, sales_delivery,
    #        transfer, adjustment, return, fg_conversion, wip_in, wip_out, scrap

    transaction_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # Item (product OR material)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=True)

    # Quantity
    quantity = db.Column(db.Numeric(15, 3), nullable=False)
    uom = db.Column(db.String(20), nullable=True)
    direction = db.Column(db.String(3), nullable=False)  # 'in' or 'out'

    # Location tracking
    from_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=True)
    to_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=True)

    # Batch & lot
    batch_number = db.Column(db.String(100), nullable=True)
    lot_number = db.Column(db.String(100), nullable=True)

    # Reference to source document
    reference_type = db.Column(db.String(50), nullable=True)
    # Reference types: work_order, purchase_order, sales_order, material_issue,
    #                  transfer_order, stock_opname, fg_conversion, packing_list, manual
    reference_id = db.Column(db.Integer, nullable=True)
    reference_number = db.Column(db.String(100), nullable=True)

    # Production specific
    work_order_id = db.Column(db.Integer, db.ForeignKey('work_orders.id'), nullable=True)
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=True)
    shift = db.Column(db.String(20), nullable=True)
    production_record_id = db.Column(db.Integer, db.ForeignKey('production_records.id'), nullable=True)

    # Cost
    unit_cost = db.Column(db.Numeric(15, 4), nullable=True)
    total_cost = db.Column(db.Numeric(15, 2), nullable=True)

    # Balance snapshot
    balance_before = db.Column(db.Numeric(15, 3), nullable=True)
    balance_after = db.Column(db.Numeric(15, 3), nullable=True)

    # Status
    status = db.Column(db.String(20), nullable=False, default='completed')
    # completed, pending, cancelled

    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    product = db.relationship('Product', foreign_keys=[product_id])
    material = db.relationship('Material', foreign_keys=[material_id])
    from_location = db.relationship('WarehouseLocation', foreign_keys=[from_location_id])
    to_location = db.relationship('WarehouseLocation', foreign_keys=[to_location_id])
    work_order = db.relationship('WorkOrder')
    machine = db.relationship('Machine')
    production_record = db.relationship('ProductionRecord')
    created_by_user = db.relationship('User', foreign_keys=[created_by])

    __table_args__ = (
        db.Index('idx_it_type_date', 'transaction_type', 'transaction_date'),
        db.Index('idx_it_reference', 'reference_type', 'reference_id'),
        db.Index('idx_it_wo', 'work_order_id'),
        db.Index('idx_it_product', 'product_id'),
        db.Index('idx_it_material', 'material_id'),
    )

    def to_dict(self):
        item_name = ''
        item_code = ''
        item_type = ''
        if self.product:
            item_name = self.product.name
            item_code = self.product.code if hasattr(self.product, 'code') else ''
            item_type = 'product'
        elif self.material:
            item_name = self.material.name
            item_code = self.material.code
            item_type = 'material'

        return {
            'id': self.id,
            'transaction_number': self.transaction_number,
            'transaction_type': self.transaction_type,
            'transaction_date': self.transaction_date.isoformat() if self.transaction_date else None,
            'item_type': item_type,
            'item_code': item_code,
            'item_name': item_name,
            'product_id': self.product_id,
            'material_id': self.material_id,
            'quantity': float(self.quantity or 0),
            'uom': self.uom,
            'direction': self.direction,
            'from_location': self.from_location.location_code if self.from_location else None,
            'to_location': self.to_location.location_code if self.to_location else None,
            'batch_number': self.batch_number,
            'lot_number': self.lot_number,
            'reference_type': self.reference_type,
            'reference_id': self.reference_id,
            'reference_number': self.reference_number,
            'work_order_id': self.work_order_id,
            'wo_number': self.work_order.wo_number if self.work_order else None,
            'machine_name': self.machine.name if self.machine else None,
            'shift': self.shift,
            'unit_cost': float(self.unit_cost or 0) if self.unit_cost else None,
            'total_cost': float(self.total_cost or 0) if self.total_cost else None,
            'balance_before': float(self.balance_before or 0) if self.balance_before is not None else None,
            'balance_after': float(self.balance_after or 0) if self.balance_after is not None else None,
            'status': self.status,
            'notes': self.notes,
            'created_by': self.created_by_user.full_name if self.created_by_user else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class PickList(db.Model):
    """Pick list for warehouse operations - generated from Sales Order or Material Issue"""
    __tablename__ = 'pick_lists'

    id = db.Column(db.Integer, primary_key=True)
    pick_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    pick_type = db.Column(db.String(30), nullable=False)
    # Types: sales_order, material_issue, transfer, production

    # Reference
    reference_type = db.Column(db.String(50), nullable=True)
    reference_id = db.Column(db.Integer, nullable=True)
    reference_number = db.Column(db.String(100), nullable=True)

    # Assignment
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    priority = db.Column(db.String(20), nullable=False, default='normal')  # low, normal, high, urgent

    # Status: draft, assigned, in_progress, completed, cancelled
    status = db.Column(db.String(20), nullable=False, default='draft')

    # Timing
    pick_date = db.Column(db.DateTime, nullable=True)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    # Summary
    total_items = db.Column(db.Integer, default=0)
    picked_items = db.Column(db.Integer, default=0)

    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items = db.relationship('PickListItem', backref='pick_list', lazy='dynamic', cascade='all, delete-orphan')
    assigned_user = db.relationship('User', foreign_keys=[assigned_to])
    created_by_user = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self, include_items=False):
        result = {
            'id': self.id,
            'pick_number': self.pick_number,
            'pick_type': self.pick_type,
            'reference_type': self.reference_type,
            'reference_id': self.reference_id,
            'reference_number': self.reference_number,
            'assigned_to': self.assigned_user.full_name if self.assigned_user else None,
            'priority': self.priority,
            'status': self.status,
            'pick_date': self.pick_date.isoformat() if self.pick_date else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'total_items': self.total_items,
            'picked_items': self.picked_items,
            'notes': self.notes,
            'created_by': self.created_by_user.full_name if self.created_by_user else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_items:
            result['items'] = [i.to_dict() for i in self.items.all()]
        return result


class PickListItem(db.Model):
    """Individual item in a pick list"""
    __tablename__ = 'pick_list_items'

    id = db.Column(db.Integer, primary_key=True)
    pick_list_id = db.Column(db.Integer, db.ForeignKey('pick_lists.id', ondelete='CASCADE'), nullable=False)

    # Item to pick
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=True)

    # Quantities
    quantity_requested = db.Column(db.Numeric(15, 3), nullable=False)
    quantity_picked = db.Column(db.Numeric(15, 3), nullable=False, default=0)
    uom = db.Column(db.String(20), nullable=True)

    # Location (where to pick from)
    location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=True)
    inventory_id = db.Column(db.Integer, db.ForeignKey('inventory.id'), nullable=True)
    batch_number = db.Column(db.String(100), nullable=True)

    # Status: pending, picked, short, skipped
    status = db.Column(db.String(20), nullable=False, default='pending')

    # Pick sequence (order of picking for route optimization)
    sequence = db.Column(db.Integer, nullable=True)

    picked_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    picked_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)

    # Relationships
    product = db.relationship('Product')
    material = db.relationship('Material')
    location = db.relationship('WarehouseLocation')
    inventory = db.relationship('Inventory')
    picked_by_user = db.relationship('User', foreign_keys=[picked_by])

    def to_dict(self):
        item_name = ''
        item_code = ''
        if self.product:
            item_name = self.product.name
            item_code = self.product.code if hasattr(self.product, 'code') else ''
        elif self.material:
            item_name = self.material.name
            item_code = self.material.code
        return {
            'id': self.id,
            'pick_list_id': self.pick_list_id,
            'product_id': self.product_id,
            'material_id': self.material_id,
            'item_code': item_code,
            'item_name': item_name,
            'quantity_requested': float(self.quantity_requested or 0),
            'quantity_picked': float(self.quantity_picked or 0),
            'uom': self.uom,
            'location': self.location.location_code if self.location else None,
            'batch_number': self.batch_number,
            'status': self.status,
            'sequence': self.sequence,
            'picked_by': self.picked_by_user.full_name if self.picked_by_user else None,
            'picked_at': self.picked_at.isoformat() if self.picked_at else None,
            'notes': self.notes,
        }


class StockTransferOrder(db.Model):
    """Inter-location stock transfer order"""
    __tablename__ = 'stock_transfer_orders'

    id = db.Column(db.Integer, primary_key=True)
    transfer_number = db.Column(db.String(50), unique=True, nullable=False, index=True)

    # Locations
    from_zone_id = db.Column(db.Integer, db.ForeignKey('warehouse_zones.id'), nullable=False)
    to_zone_id = db.Column(db.Integer, db.ForeignKey('warehouse_zones.id'), nullable=False)
    from_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=True)
    to_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=True)

    # Transfer reason
    reason = db.Column(db.String(50), nullable=False)
    # Reasons: replenishment, relocation, consolidation, production_staging, quality_hold

    # Status: draft, approved, in_transit, completed, cancelled
    status = db.Column(db.String(20), nullable=False, default='draft')

    # Approval
    requested_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)

    # Execution
    transferred_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    transferred_at = db.Column(db.DateTime, nullable=True)

    # Summary
    total_items = db.Column(db.Integer, default=0)
    priority = db.Column(db.String(20), nullable=False, default='normal')

    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items = db.relationship('StockTransferItem', backref='transfer_order', lazy='dynamic', cascade='all, delete-orphan')
    from_zone = db.relationship('WarehouseZone', foreign_keys=[from_zone_id])
    to_zone = db.relationship('WarehouseZone', foreign_keys=[to_zone_id])
    from_location_rel = db.relationship('WarehouseLocation', foreign_keys=[from_location_id])
    to_location_rel = db.relationship('WarehouseLocation', foreign_keys=[to_location_id])
    requested_by_user = db.relationship('User', foreign_keys=[requested_by])
    approved_by_user = db.relationship('User', foreign_keys=[approved_by])
    transferred_by_user = db.relationship('User', foreign_keys=[transferred_by])

    def to_dict(self, include_items=False):
        result = {
            'id': self.id,
            'transfer_number': self.transfer_number,
            'from_zone': self.from_zone.name if self.from_zone else None,
            'to_zone': self.to_zone.name if self.to_zone else None,
            'from_location': self.from_location_rel.location_code if self.from_location_rel else None,
            'to_location': self.to_location_rel.location_code if self.to_location_rel else None,
            'reason': self.reason,
            'status': self.status,
            'requested_by': self.requested_by_user.full_name if self.requested_by_user else None,
            'approved_by': self.approved_by_user.full_name if self.approved_by_user else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'transferred_by': self.transferred_by_user.full_name if self.transferred_by_user else None,
            'transferred_at': self.transferred_at.isoformat() if self.transferred_at else None,
            'total_items': self.total_items,
            'priority': self.priority,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_items:
            result['items'] = [i.to_dict() for i in self.items.all()]
        return result


class StockTransferItem(db.Model):
    """Individual item in a stock transfer order"""
    __tablename__ = 'stock_transfer_items'

    id = db.Column(db.Integer, primary_key=True)
    transfer_order_id = db.Column(db.Integer, db.ForeignKey('stock_transfer_orders.id', ondelete='CASCADE'), nullable=False)

    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=True)

    quantity = db.Column(db.Numeric(15, 3), nullable=False)
    quantity_transferred = db.Column(db.Numeric(15, 3), nullable=False, default=0)
    uom = db.Column(db.String(20), nullable=True)

    batch_number = db.Column(db.String(100), nullable=True)
    from_inventory_id = db.Column(db.Integer, db.ForeignKey('inventory.id'), nullable=True)

    # Status: pending, transferred, short
    status = db.Column(db.String(20), nullable=False, default='pending')

    notes = db.Column(db.Text, nullable=True)

    # Relationships
    product = db.relationship('Product')
    material = db.relationship('Material')
    from_inventory = db.relationship('Inventory')

    def to_dict(self):
        item_name = ''
        item_code = ''
        if self.product:
            item_name = self.product.name
            item_code = self.product.code if hasattr(self.product, 'code') else ''
        elif self.material:
            item_name = self.material.name
            item_code = self.material.code
        return {
            'id': self.id,
            'product_id': self.product_id,
            'material_id': self.material_id,
            'item_code': item_code,
            'item_name': item_name,
            'quantity': float(self.quantity or 0),
            'quantity_transferred': float(self.quantity_transferred or 0),
            'uom': self.uom,
            'batch_number': self.batch_number,
            'status': self.status,
            'notes': self.notes,
        }


class CycleCountSchedule(db.Model):
    """Automated cycle counting schedule for inventory accuracy"""
    __tablename__ = 'cycle_count_schedules'

    id = db.Column(db.Integer, primary_key=True)
    schedule_number = db.Column(db.String(50), unique=True, nullable=False, index=True)

    # Scope
    zone_id = db.Column(db.Integer, db.ForeignKey('warehouse_zones.id'), nullable=True)
    location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=True)
    abc_category = db.Column(db.String(1), nullable=True)  # A, B, C or null for all

    # Frequency: daily, weekly, monthly, quarterly
    frequency = db.Column(db.String(20), nullable=False)
    next_count_date = db.Column(db.Date, nullable=False)
    last_count_date = db.Column(db.Date, nullable=True)

    # Assignment
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Status: active, paused, completed
    status = db.Column(db.String(20), nullable=False, default='active')

    # Results
    total_items_counted = db.Column(db.Integer, default=0)
    discrepancies_found = db.Column(db.Integer, default=0)
    accuracy_percentage = db.Column(db.Numeric(5, 2), default=100)

    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    zone = db.relationship('WarehouseZone')
    location = db.relationship('WarehouseLocation')
    assigned_user = db.relationship('User', foreign_keys=[assigned_to])
    created_by_user = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        return {
            'id': self.id,
            'schedule_number': self.schedule_number,
            'zone': self.zone.name if self.zone else 'All Zones',
            'location': self.location.location_code if self.location else 'All Locations',
            'abc_category': self.abc_category,
            'frequency': self.frequency,
            'next_count_date': self.next_count_date.isoformat() if self.next_count_date else None,
            'last_count_date': self.last_count_date.isoformat() if self.last_count_date else None,
            'assigned_to': self.assigned_user.full_name if self.assigned_user else None,
            'status': self.status,
            'total_items_counted': self.total_items_counted,
            'discrepancies_found': self.discrepancies_found,
            'accuracy_percentage': float(self.accuracy_percentage or 100),
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
