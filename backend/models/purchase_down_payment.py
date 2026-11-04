from datetime import datetime
from . import db


class PurchaseDownPayment(db.Model):
    """Uang muka pembelian ke pemasok: dibayar dari PO, lalu dialokasikan ke faktur pembelian."""
    __tablename__ = 'purchase_down_payments'

    id = db.Column(db.Integer, primary_key=True)
    dp_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    po_id = db.Column(db.Integer, db.ForeignKey('purchase_orders.id'), nullable=True, index=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False, index=True)
    dp_date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    allocated_amount = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    bank_account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    dp_account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    payment_method = db.Column(db.String(50), nullable=False, default='bank_transfer')
    reference_number = db.Column(db.String(100), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='posted')  # draft, posted, cancelled
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    purchase_order = db.relationship('PurchaseOrder')
    supplier = db.relationship('Supplier')
    allocations = db.relationship('PurchaseDownPaymentAllocation', back_populates='down_payment', cascade='all, delete-orphan')

    @property
    def remaining(self):
        return float(self.amount or 0) - float(self.allocated_amount or 0)


class PurchaseDownPaymentAllocation(db.Model):
    __tablename__ = 'purchase_down_payment_allocations'

    id = db.Column(db.Integer, primary_key=True)
    down_payment_id = db.Column(db.Integer, db.ForeignKey('purchase_down_payments.id', ondelete='CASCADE'), nullable=False, index=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False, index=True)
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='active')  # active, reversed
    allocated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    allocated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    down_payment = db.relationship('PurchaseDownPayment', back_populates='allocations')
    invoice = db.relationship('Invoice')
