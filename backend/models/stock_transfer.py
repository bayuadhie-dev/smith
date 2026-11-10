from datetime import datetime
from . import db


class StockTransfer(db.Model):
    """Pemindahan Barang antar lokasi/gudang. Nomor IT/MM/NNNN; tiap penerimaan di tujuan bernomor IT/MM/NNNN-n."""
    __tablename__ = 'stock_transfers'

    id = db.Column(db.Integer, primary_key=True)
    transfer_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    source_type = db.Column(db.String(30), nullable=False, default='manual')  # material_issue, grn, manual
    source_id = db.Column(db.Integer, nullable=True)
    source_number = db.Column(db.String(100), nullable=True)
    from_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=False)
    to_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='draft')  # draft, shipped, partial, received, cancelled
    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    shipped_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    shipped_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    from_location = db.relationship('WarehouseLocation', foreign_keys=[from_location_id])
    to_location = db.relationship('WarehouseLocation', foreign_keys=[to_location_id])
    lines = db.relationship('StockTransferLine', back_populates='transfer', cascade='all, delete-orphan', order_by='StockTransferLine.id')
    receipts = db.relationship('StockTransferReceipt', back_populates='transfer', cascade='all, delete-orphan', order_by='StockTransferReceipt.id')


class StockTransferLine(db.Model):
    __tablename__ = 'stock_transfer_lines'

    id = db.Column(db.Integer, primary_key=True)
    transfer_id = db.Column(db.Integer, db.ForeignKey('stock_transfers.id', ondelete='CASCADE'), nullable=False, index=True)
    material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    item_code = db.Column(db.String(100), nullable=True)
    item_name = db.Column(db.String(255), nullable=False)
    uom = db.Column(db.String(20), nullable=True)
    quantity = db.Column(db.Numeric(15, 4), nullable=False)
    received_quantity = db.Column(db.Numeric(15, 4), nullable=False, default=0)
    batch_number = db.Column(db.String(100), nullable=True)

    transfer = db.relationship('StockTransfer', back_populates='lines')


class StockTransferReceipt(db.Model):
    __tablename__ = 'stock_transfer_receipts'

    id = db.Column(db.Integer, primary_key=True)
    transfer_id = db.Column(db.Integer, db.ForeignKey('stock_transfers.id', ondelete='CASCADE'), nullable=False, index=True)
    receipt_number = db.Column(db.String(60), unique=True, nullable=False, index=True)
    to_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    received_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    received_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    transfer = db.relationship('StockTransfer', back_populates='receipts')
    to_location = db.relationship('WarehouseLocation', foreign_keys=[to_location_id])
    lines = db.relationship('StockTransferReceiptLine', back_populates='receipt', cascade='all, delete-orphan')


class StockTransferReceiptLine(db.Model):
    __tablename__ = 'stock_transfer_receipt_lines'

    id = db.Column(db.Integer, primary_key=True)
    receipt_id = db.Column(db.Integer, db.ForeignKey('stock_transfer_receipts.id', ondelete='CASCADE'), nullable=False, index=True)
    line_id = db.Column(db.Integer, db.ForeignKey('stock_transfer_lines.id'), nullable=False)
    quantity = db.Column(db.Numeric(15, 4), nullable=False)

    receipt = db.relationship('StockTransferReceipt', back_populates='lines')
