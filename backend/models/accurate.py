"""
Accurate Online API Integration Models
Penyimpanan konfigurasi, mapping barang/BOM, dan log transaksi/approval queue sync Accurate.
"""
from datetime import datetime
from . import db


class AccurateConfig(db.Model):
    __tablename__ = 'accurate_configs'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.String(255), nullable=True)
    client_secret = db.Column(db.String(255), nullable=True)
    db_id = db.Column(db.String(100), nullable=True)
    api_url = db.Column(db.String(255), default='https://accurate.id', nullable=False)
    access_token = db.Column(db.Text, nullable=True)
    refresh_token = db.Column(db.Text, nullable=True)
    token_expiry = db.Column(db.DateTime, nullable=True)
    is_dry_run = db.Column(db.Boolean, default=True, nullable=False)  # Mode simulasi (Default TRUE)
    auto_approve = db.Column(db.Boolean, default=False, nullable=False)
    target_db_name = db.Column(db.String(50), default='smith', nullable=False)  # 'smith' atau 'smith_staging'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'client_id': self.client_id,
            'db_id': self.db_id,
            'api_url': self.api_url,
            'token_expiry': self.token_expiry.isoformat() if self.token_expiry else None,
            'is_dry_run': self.is_dry_run,
            'auto_approve': self.auto_approve,
            'target_db_name': self.target_db_name,
            'is_connected': bool(self.access_token),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class AccurateItemMapping(db.Model):
    __tablename__ = 'accurate_item_mappings'

    id = db.Column(db.Integer, primary_key=True)
    accurate_item_no = db.Column(db.String(100), nullable=False, index=True, unique=True)
    accurate_item_name = db.Column(db.String(255), nullable=True)
    accurate_item_type = db.Column(db.String(50), default='ITEM', nullable=False)  # 'ITEM' atau 'BOM'
    smith_item_type = db.Column(db.String(20), default='material', nullable=False)  # 'material' atau 'product'
    smith_material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=True)
    smith_product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    uom_conversion_ratio = db.Column(db.Numeric(12, 4), default=1.0, nullable=False)
    notes = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    material = db.relationship('Material', foreign_keys=[smith_material_id], backref=db.backref('accurate_mappings', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'accurate_item_no': self.accurate_item_no,
            'accurate_item_name': self.accurate_item_name,
            'accurate_item_type': self.accurate_item_type,
            'smith_item_type': self.smith_item_type,
            'smith_material_id': self.smith_material_id,
            'smith_product_id': self.smith_product_id,
            'smith_item_name': (self.material.name if self.material else None),
            'uom_conversion_ratio': float(self.uom_conversion_ratio) if self.uom_conversion_ratio is not None else 1.0,
            'notes': self.notes,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class AccurateSyncLog(db.Model):
    __tablename__ = 'accurate_sync_logs'

    id = db.Column(db.Integer, primary_key=True)
    transaction_type = db.Column(db.String(50), nullable=False)  # 'item_transfer', 'receive_item', 'stock_adjustment', 'bom'
    accurate_tx_no = db.Column(db.String(100), nullable=True, index=True)
    accurate_tx_date = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(30), default='SIMULATION', nullable=False)  # 'SIMULATION', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FAILED'
    is_dry_run = db.Column(db.Boolean, default=True, nullable=False)
    raw_payload = db.Column(db.Text, nullable=True)
    mapping_summary = db.Column(db.Text, nullable=True)
    stock_diff_summary = db.Column(db.Text, nullable=True)
    mrp_impact_summary = db.Column(db.Text, nullable=True)
    accurate_item_id = db.Column(db.String(100), nullable=True, index=True)
    accurate_item_name = db.Column(db.String(255), nullable=True)
    proposed_target_table = db.Column(db.String(20), nullable=True)
    proposed_material_type = db.Column(db.String(30), nullable=True)
    proposed_category = db.Column(db.String(30), nullable=True)
    matched_smith_id = db.Column(db.Integer, nullable=True)
    matched_smith_table = db.Column(db.String(20), nullable=True)
    proposed_changes = db.Column(db.Text, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'transaction_type': self.transaction_type,
            'accurate_tx_no': self.accurate_tx_no,
            'accurate_tx_date': self.accurate_tx_date.isoformat() if self.accurate_tx_date else None,
            'status': self.status,
            'is_dry_run': self.is_dry_run,
            'mapping_summary': json.loads(self.mapping_summary) if self.mapping_summary else None,
            'stock_diff_summary': json.loads(self.stock_diff_summary) if self.stock_diff_summary else None,
            'mrp_impact_summary': json.loads(self.mrp_impact_summary) if self.mrp_impact_summary else None,
            'error_message': self.error_message,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'accurate_item_id': self.accurate_item_id,
            'accurate_item_name': self.accurate_item_name,
            'proposed_target_table': self.proposed_target_table,
            'proposed_material_type': self.proposed_material_type,
            'proposed_category': self.proposed_category,
            'matched_smith_id': self.matched_smith_id,
            'matched_smith_table': self.matched_smith_table,
            'proposed_changes': json.loads(self.proposed_changes) if self.proposed_changes else None,
        }


class AccurateBomItemIndex(db.Model):
    """
    Cache: Accurate item_id -> which Accurate BOM produces that item.
    Built by a one-time full scan of bill-of-material/list.do +
    bill-of-material/detail.do (Accurate's filter params for this endpoint
    are unreliable - always returns the full unfiltered set - so a scan is
    the only reliable way to build this mapping). Used by the EJO cross-check
    feature's recursive material-tree expansion (Barang Jadi -> WIP -> Mixing)
    so it doesn't need to rescan all ~643 BOMs on every check_ejo() call.
    Manually refreshed via POST /api/integrations/accurate/bom-item-index-scan.
    """
    __tablename__ = 'accurate_bom_item_index'

    id = db.Column(db.Integer, primary_key=True)
    accurate_item_id = db.Column(db.Integer, nullable=False, unique=True, index=True)
    accurate_item_name = db.Column(db.String(255), nullable=True)
    accurate_bom_id = db.Column(db.Integer, nullable=False)
    accurate_bom_number = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AccurateWorkOrderCache(db.Model):
    """
    Cache of recent Accurate work orders (EJO numbers), for the "Data Modul"
    browser tab so users can click through to the EJO cross-check instead
    of typing the number manually. Populated by a manual scan
    (POST /accurate/work-order-cache-scan) since fetching live (2500 WOs,
    1 detail API call each) takes several minutes.
    """
    __tablename__ = 'accurate_work_order_cache'

    id = db.Column(db.Integer, primary_key=True)
    accurate_id = db.Column(db.Integer, nullable=False, unique=True, index=True)
    number = db.Column(db.String(100), nullable=False, index=True)
    item_name = db.Column(db.String(255), nullable=True)
    quantity_real = db.Column(db.Float, nullable=True)
    unit = db.Column(db.String(20), nullable=True)
    status = db.Column(db.String(50), nullable=True)
    final_date = db.Column(db.String(30), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EjoWarehouseSyncLog(db.Model):
    """
    Tracks which Accurate EJO + processHistory stage (MS=masuk EPD,
    FGS=masuk FG) combinations have already been applied to SMITH
    Inventory, so re-running the manual warehouse sync doesn't
    double-count quantity (the EPD/FG stock model is cumulative/
    historical, not a point-in-time snapshot, per user decision).
    """
    __tablename__ = 'ejo_warehouse_sync_log'

    id = db.Column(db.Integer, primary_key=True)
    ejo_number = db.Column(db.String(100), nullable=False, index=True)
    stage_type = db.Column(db.String(20), nullable=False)  # MS or FGS
    accurate_work_order_id = db.Column(db.Integer, nullable=False)
    product_id = db.Column(db.Integer, nullable=True)
    quantity_added = db.Column(db.Float, nullable=True)
    inventory_id = db.Column(db.Integer, nullable=True)
    machine = db.Column(db.String(100), nullable=True)
    operator = db.Column(db.String(200), nullable=True)
    shift = db.Column(db.String(50), nullable=True)
    trans_date = db.Column(db.String(30), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('ejo_number', 'stage_type', name='uq_ejo_stage_sync'),
    )


class EjoWarehouseUnmatchedProduct(db.Model):
    """
    Accurate work order item names that failed exact-match against SMITH
    products during sync_ejo_warehouse_stock(), so they can be surfaced in
    the UI with a warning instead of silently disappearing - helps
    identify product names needing reconciliation between the two systems.
    """
    __tablename__ = 'ejo_warehouse_unmatched_products'

    id = db.Column(db.Integer, primary_key=True)
    accurate_item_name = db.Column(db.String(255), nullable=False, unique=True, index=True)
    occurrence_count = db.Column(db.Integer, nullable=False, default=1)
    last_ejo_number = db.Column(db.String(100), nullable=True)
    last_seen_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class WarehouseStockSnapshotDetail(db.Model):
    """
    Per-item-per-warehouse stock detail from Accurate's item/detail.do
    detailWarehouseData, for PM/EPD/FG. Stores the full breakdown
    (Accurate's real warehouse name, PIC, per-unit quantities) so users
    can view it without a live Accurate re-fetch. Populated by
    sync_warehouse_stock_from_item_detail() alongside the aggregated
    Inventory.quantity_on_hand snapshot.
    """
    __tablename__ = 'warehouse_stock_snapshot_detail'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, nullable=True, index=True)
    material_id = db.Column(db.Integer, nullable=True, index=True)
    smith_location_id = db.Column(db.Integer, nullable=False, index=True)
    accurate_warehouse_id = db.Column(db.Integer, nullable=True)
    accurate_warehouse_name = db.Column(db.String(100), nullable=True)
    pic = db.Column(db.String(100), nullable=True)
    unit1_quantity = db.Column(db.Float, nullable=True)
    unit1_name = db.Column(db.String(50), nullable=True)
    unit2_quantity = db.Column(db.Float, nullable=True)
    unit2_name = db.Column(db.String(50), nullable=True)
    unit3_quantity = db.Column(db.Float, nullable=True)
    unit3_name = db.Column(db.String(50), nullable=True)
    synced_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('product_id', 'smith_location_id', name='uq_product_location_snapshot'),
        db.UniqueConstraint('material_id', 'smith_location_id', name='uq_material_location_snapshot'),
    )


class AccurateWarehouseTransferLog(db.Model):
    """
    Official warehouse-to-warehouse transfer transactions from Accurate's
    item-transfer.do, giving SMITH a real movement audit trail for PM<->EPD
    (prefix IT-) and EPD<->FG (prefix PL-, auto-generated from Packing List
    creation) - not just point-in-time stock snapshots. Each Accurate
    transaction is one row here (paired TRANSFER_OUT/TRANSFER_IN rows both
    get logged, linked via paired_transfer_id).
    """
    __tablename__ = 'accurate_warehouse_transfer_log'

    id = db.Column(db.Integer, primary_key=True)
    accurate_transfer_id = db.Column(db.Integer, nullable=False, unique=True, index=True)
    number = db.Column(db.String(100), nullable=False, index=True)
    transfer_type = db.Column(db.String(20), nullable=False)  # TRANSFER_IN or TRANSFER_OUT
    doc_prefix = db.Column(db.String(30), nullable=True)  # PL or IT, parsed from number
    trans_date = db.Column(db.String(30), nullable=True)
    from_warehouse_id = db.Column(db.Integer, nullable=True)
    from_warehouse_name = db.Column(db.String(100), nullable=True)
    to_warehouse_id = db.Column(db.Integer, nullable=True)
    to_warehouse_name = db.Column(db.String(100), nullable=True)
    paired_transfer_id = db.Column(db.Integer, nullable=True)
    description = db.Column(db.Text, nullable=True)
    synced_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    items = db.relationship('AccurateWarehouseTransferItem', backref='transfer_log', cascade='all, delete-orphan')


class AccurateWarehouseTransferItem(db.Model):
    """
    Per-item line within an AccurateWarehouseTransferLog transaction,
    including serial number/batch and expiry when Accurate tracks it.
    """
    __tablename__ = 'accurate_warehouse_transfer_item'

    id = db.Column(db.Integer, primary_key=True)
    transfer_log_id = db.Column(db.Integer, db.ForeignKey('accurate_warehouse_transfer_log.id', ondelete='CASCADE'), nullable=False, index=True)
    accurate_item_id = db.Column(db.Integer, nullable=True)
    item_name = db.Column(db.String(255), nullable=True)
    smith_product_id = db.Column(db.Integer, nullable=True, index=True)
    smith_material_id = db.Column(db.Integer, nullable=True, index=True)
    quantity = db.Column(db.Float, nullable=True)
    serial_number = db.Column(db.String(100), nullable=True)
    batch_expired_date = db.Column(db.String(30), nullable=True)
