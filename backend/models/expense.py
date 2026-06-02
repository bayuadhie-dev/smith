"""
Expense and Reimbursement Models
Enterprise-grade expense management with receipt tracking and approval workflow
"""

from datetime import datetime
from sqlalchemy import event
from . import db


class Expense(db.Model):
    """Employee expense claim with receipt attachments"""
    __tablename__ = 'expenses'

    id = db.Column(db.Integer, primary_key=True)
    expense_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    employee_name = db.Column(db.String(255))  # Denormalized for reporting
    
    # Expense details
    expense_date = db.Column(db.Date, nullable=False, index=True)
    expense_category = db.Column(db.String(100), nullable=False)  # Travel, Meals, Office, etc.
    expense_type = db.Column(db.String(100), nullable=False)  # Cash, Credit Card, Company Card
    description = db.Column(db.Text, nullable=False)
    
    # Amount
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    currency = db.Column(db.String(10), default='IDR')
    exchange_rate = db.Column(db.Numeric(15, 6), default=1.0)
    amount_base = db.Column(db.Numeric(15, 2))  # Converted to base currency
    
    # Receipt attachment
    receipt_file_path = db.Column(db.String(500))
    receipt_file_name = db.Column(db.String(255))
    receipt_file_type = db.Column(db.String(50))  # image/jpeg, application/pdf
    receipt_file_size = db.Column(db.Integer)
    receipt_uploaded_at = db.Column(db.DateTime)
    
    # Reference
    reference_number = db.Column(db.String(100))  # Invoice number, receipt number, etc.
    vendor_name = db.Column(db.String(255))
    
    # Workflow
    status = db.Column(db.String(50), default='draft', index=True)  # draft, submitted, approved, rejected, paid
    submitted_at = db.Column(db.DateTime)
    submitted_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_at = db.Column(db.DateTime)
    approval_notes = db.Column(db.Text)
    
    rejected_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    rejected_at = db.Column(db.DateTime)
    rejection_reason = db.Column(db.Text)
    
    # Reimbursement
    reimbursement_id = db.Column(db.Integer, db.ForeignKey('reimbursements.id'))
    reimbursed_at = db.Column(db.DateTime)
    
    # Accounting
    cost_center_id = db.Column(db.Integer, db.ForeignKey('cost_centers.id'))
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'))
    journal_entry_id = db.Column(db.Integer, db.ForeignKey('accounting_entries.id'))
    posted_to_gl = db.Column(db.Boolean, default=False)
    gl_posted_at = db.Column(db.DateTime)
    
    # Audit
    notes = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    employee = db.relationship('Employee', backref='expenses')
    submitter = db.relationship('User', foreign_keys=[submitted_by], backref='submitted_expenses')
    approver = db.relationship('User', foreign_keys=[approved_by], backref='approved_expenses')
    rejector = db.relationship('User', foreign_keys=[rejected_by], backref='rejected_expenses')
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_expenses')
    reimbursement = db.relationship('Reimbursement', backref='expenses', foreign_keys=[reimbursement_id])
    cost_center = db.relationship('CostCenter', backref='expenses')
    account = db.relationship('Account', backref='expenses')
    journal_entry = db.relationship('AccountingEntry', backref='expenses')
    
    def __repr__(self):
        return f'<Expense {self.expense_number}>'
    
    @property
    def status_display(self):
        status_map = {
            'draft': 'Draft',
            'submitted': 'Submitted',
            'approved': 'Approved',
            'rejected': 'Rejected',
            'paid': 'Paid'
        }
        return status_map.get(self.status, self.status)


class Reimbursement(db.Model):
    """Batch reimbursement for multiple expenses"""
    __tablename__ = 'reimbursements'

    id = db.Column(db.Integer, primary_key=True)
    reimbursement_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    employee_name = db.Column(db.String(255))
    
    # Amount summary
    total_amount = db.Column(db.Numeric(15, 2), default=0)
    currency = db.Column(db.String(10), default='IDR')
    
    # Payment details
    payment_method = db.Column(db.String(50))  # Bank Transfer, Cash, Payroll Deduction
    bank_account_number = db.Column(db.String(100))
    bank_account_name = db.Column(db.String(255))
    bank_name = db.Column(db.String(255))
    
    # Workflow
    status = db.Column(db.String(50), default='pending', index=True)  # pending, approved, processing, paid, cancelled
    submitted_at = db.Column(db.DateTime)
    submitted_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_at = db.Column(db.DateTime)
    
    processed_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    processed_at = db.Column(db.DateTime)
    
    paid_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    paid_at = db.Column(db.DateTime)
    payment_reference = db.Column(db.String(100))
    
    # Accounting
    journal_entry_id = db.Column(db.Integer, db.ForeignKey('accounting_entries.id'))
    posted_to_gl = db.Column(db.Boolean, default=False)
    gl_posted_at = db.Column(db.DateTime)
    
    # Period
    reimbursement_period_start = db.Column(db.Date)
    reimbursement_period_end = db.Column(db.Date)
    
    # Notes
    notes = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    employee = db.relationship('Employee', backref='reimbursements')
    submitter = db.relationship('User', foreign_keys=[submitted_by], backref='submitted_reimbursements')
    approver = db.relationship('User', foreign_keys=[approved_by], backref='approved_reimbursements')
    processor = db.relationship('User', foreign_keys=[processed_by], backref='processed_reimbursements')
    payer = db.relationship('User', foreign_keys=[paid_by], backref='paid_reimbursements')
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_reimbursements')
    journal_entry = db.relationship('AccountingEntry', backref='reimbursements')
    
    def __repr__(self):
        return f'<Reimbursement {self.reimbursement_number}>'
    
    @property
    def expense_count(self):
        return len(self.expenses)
    
    @property
    def status_display(self):
        status_map = {
            'pending': 'Pending Approval',
            'approved': 'Approved',
            'processing': 'Processing Payment',
            'paid': 'Paid',
            'cancelled': 'Cancelled'
        }
        return status_map.get(self.status, self.status)


# Auto-generate expense number
@event.listens_for(Expense, 'before_insert')
def generate_expense_number(mapper, connection, target):
    if not target.expense_number:
        from sqlalchemy import select
        from datetime import datetime
        year_month = datetime.now().strftime('%Y%m')
        result = connection.execute(
            select(db.func.max(Expense.expense_number))
            .where(Expense.expense_number.like(f'EXP-{year_month}%'))
        )
        max_num = result.scalar()
        if max_num:
            sequence = int(max_num.split('-')[-1]) + 1
        else:
            sequence = 1
        target.expense_number = f'EXP-{year_month}-{sequence:04d}'


# Auto-generate reimbursement number
@event.listens_for(Reimbursement, 'before_insert')
def generate_reimbursement_number(mapper, connection, target):
    if not target.reimbursement_number:
        from sqlalchemy import select
        from datetime import datetime
        year_month = datetime.now().strftime('%Y%m')
        result = connection.execute(
            select(db.func.max(Reimbursement.reimbursement_number))
            .where(Reimbursement.reimbursement_number.like(f'REIMB-{year_month}%'))
        )
        max_num = result.scalar()
        if max_num:
            sequence = int(max_num.split('-')[-1]) + 1
        else:
            sequence = 1
        target.reimbursement_number = f'REIMB-{year_month}-{sequence:04d}'
