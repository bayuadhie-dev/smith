"""Kas kecil (petty cash) HR: dana tetap (imprest), permintaan pengeluaran, pengisian kembali."""
from datetime import datetime
from . import db


class PettyCashFund(db.Model):
    __tablename__ = 'petty_cash_funds'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(30), unique=True, nullable=False)
    name = db.Column(db.String(150), nullable=False)
    fixed_amount = db.Column(db.Numeric(15, 2), nullable=False, default=1000000)
    per_txn_limit = db.Column(db.Numeric(15, 2), nullable=False, default=500000)
    min_balance = db.Column(db.Numeric(15, 2), nullable=False, default=100000)
    custodian_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approver_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    custodian = db.relationship('User', foreign_keys=[custodian_user_id])
    approver = db.relationship('User', foreign_keys=[approver_user_id])


class PettyCashTransaction(db.Model):
    __tablename__ = 'petty_cash_transactions'

    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    fund_id = db.Column(db.Integer, db.ForeignKey('petty_cash_funds.id'), nullable=False, index=True)
    request_date = db.Column(db.Date, nullable=False, index=True)
    requester_employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True)
    requester_name = db.Column(db.String(255), nullable=False)
    department = db.Column(db.String(150), nullable=True)
    purpose = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    receipt_number = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(30), nullable=False, default='submitted', index=True)  # submitted, approved, paid, rejected, cancelled
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    approval_note = db.Column(db.Text, nullable=True)
    paid_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    paid_at = db.Column(db.DateTime, nullable=True)
    rejected_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    rejected_at = db.Column(db.DateTime, nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)
    replenishment_id = db.Column(db.Integer, db.ForeignKey('petty_cash_replenishments.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    fund = db.relationship('PettyCashFund')
    creator = db.relationship('User', foreign_keys=[created_by])
    approver = db.relationship('User', foreign_keys=[approved_by])
    payer = db.relationship('User', foreign_keys=[paid_by])
    rejecter = db.relationship('User', foreign_keys=[rejected_by])


class PettyCashReplenishment(db.Model):
    __tablename__ = 'petty_cash_replenishments'

    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    fund_id = db.Column(db.Integer, db.ForeignKey('petty_cash_funds.id'), nullable=False, index=True)
    request_date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.String(30), nullable=False)  # min_balance, month_end, manual
    balance_at_request = db.Column(db.Numeric(15, 2), nullable=False)
    amount_requested = db.Column(db.Numeric(15, 2), nullable=False)
    status = db.Column(db.String(30), nullable=False, default='requested', index=True)  # requested, approved, received, rejected
    note = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    received_at = db.Column(db.DateTime, nullable=True)
    amount_received = db.Column(db.Numeric(15, 2), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    fund = db.relationship('PettyCashFund')
    creator = db.relationship('User', foreign_keys=[created_by])
    approver = db.relationship('User', foreign_keys=[approved_by])
    transactions = db.relationship('PettyCashTransaction', backref='replenishment', foreign_keys='PettyCashTransaction.replenishment_id')
