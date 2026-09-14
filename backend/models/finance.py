from datetime import datetime
from . import db

class CostCenter(db.Model):
    __tablename__ = 'cost_centers'
    
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Invoice(db.Model):
    __tablename__ = 'invoices'
    
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    invoice_type = db.Column(db.String(50), nullable=False)  # sales, purchase, production_cost
    invoice_date = db.Column(db.Date, nullable=False, index=True)
    due_date = db.Column(db.Date, nullable=True)
    sales_order_id = db.Column(db.Integer, db.ForeignKey('sales_orders.id'), nullable=True)
    purchase_order_id = db.Column(db.Integer, db.ForeignKey('purchase_orders.id'), nullable=True)
    work_order_id = db.Column(db.Integer, db.ForeignKey('work_orders.id'), nullable=True)
    production_approval_id = db.Column(db.Integer, db.ForeignKey('production_approvals.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    status = db.Column(db.String(50), nullable=False, default='draft')  # draft, sent, partial, paid, overdue, cancelled
    currency = db.Column(db.String(10), nullable=False, default='IDR')
    exchange_rate = db.Column(db.Numeric(15, 6), default=1)
    subtotal = db.Column(db.Numeric(15, 2), default=0)
    tax_amount = db.Column(db.Numeric(15, 2), default=0)
    discount_amount = db.Column(db.Numeric(15, 2), default=0)
    shipping_amount = db.Column(db.Numeric(15, 2), default=0)  # purchase: freight-in, posted to a separate payables account per Accurate's pattern - not merged into item cost
    other_charges = db.Column(db.Numeric(15, 2), default=0)
    total_amount = db.Column(db.Numeric(15, 2), default=0)
    paid_amount = db.Column(db.Numeric(15, 2), default=0)
    balance_due = db.Column(db.Numeric(15, 2), default=0)
    payment_terms = db.Column(db.String(100), nullable=True)
    payment_method = db.Column(db.String(50), nullable=True)
    supplier_invoice_number = db.Column(db.String(100), nullable=True)  # vendor's own faktur number, distinct from our invoice_number
    supplier_invoice_date = db.Column(db.Date, nullable=True)
    received_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    posted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    posted_at = db.Column(db.DateTime, nullable=True)
    # Invoice blocking (SAP MM concept, 2026-09-14) - set when a purchase invoice's
    # 3-way-match price variance exceeds PurchaseAccountSettings.invoice_variance_tolerance_percent.
    # While True, the invoice's journal entry (pending_journal_entry_id) is deliberately left
    # UNPOSTED (see routes/purchase_invoice.py::create_purchase_invoice) until a human reviews
    # and calls POST /purchase-invoices/<id>/release-hold. Not used for sales invoices.
    on_hold = db.Column(db.Boolean, nullable=False, default=False)
    hold_reason = db.Column(db.Text, nullable=True)
    pending_journal_entry_id = db.Column(db.Integer, db.ForeignKey('pending_journal_entries.id'), nullable=True)
    internal_notes = db.Column(db.Text, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sales_order = db.relationship('SalesOrder', back_populates='invoices')
    purchase_order = db.relationship('PurchaseOrder')
    customer = db.relationship('Customer')
    supplier = db.relationship('Supplier')
    items = db.relationship('InvoiceItem', back_populates='invoice', cascade='all, delete-orphan')
    payments = db.relationship('Payment', back_populates='invoice')
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    received_by_user = db.relationship('User', foreign_keys=[received_by])
    posted_by_user = db.relationship('User', foreign_keys=[posted_by])

class InvoiceItem(db.Model):
    __tablename__ = 'invoice_items'
    
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id', ondelete='CASCADE'), nullable=False)
    line_number = db.Column(db.Integer, nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=True)
    po_item_id = db.Column(db.Integer, db.ForeignKey('purchase_order_items.id'), nullable=True)  # purchase: links back to the PO line for 3-way match / quantity_invoiced tracking
    description = db.Column(db.Text, nullable=False)
    quantity = db.Column(db.Numeric(15, 2), nullable=False)
    uom = db.Column(db.String(20), nullable=True)
    unit_price = db.Column(db.Numeric(15, 2), nullable=False)
    discount_percent = db.Column(db.Numeric(5, 2), default=0)
    discount_amount = db.Column(db.Numeric(15, 2), default=0)
    tax_percent = db.Column(db.Numeric(5, 2), default=0)
    tax_amount = db.Column(db.Numeric(15, 2), default=0)
    total_amount = db.Column(db.Numeric(15, 2), nullable=False)
    quantity_returned = db.Column(db.Numeric(15, 2), default=0)  # purchase: tracked by PurchaseReturn
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    invoice = db.relationship('Invoice', back_populates='items')
    product = db.relationship('Product')
    material = db.relationship('Material')
    po_item = db.relationship('PurchaseOrderItem')
    
    __table_args__ = (
        db.UniqueConstraint('invoice_id', 'line_number', name='unique_fin_invoice_line'),
    )

class Payment(db.Model):
    __tablename__ = 'payments'
    
    id = db.Column(db.Integer, primary_key=True)
    payment_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    payment_date = db.Column(db.Date, nullable=False, index=True)
    payment_type = db.Column(db.String(50), nullable=False)  # receipt, payment
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    payment_method = db.Column(db.String(50), nullable=False)  # cash, bank_transfer, check, credit_card
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    currency = db.Column(db.String(10), nullable=False, default='IDR')
    exchange_rate = db.Column(db.Numeric(15, 6), default=1)
    reference_number = db.Column(db.String(100), nullable=True)
    bank_account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)  # Kas/Bank account (Account.is_cash_bank=True)
    status = db.Column(db.String(50), nullable=False, default='pending')  # pending, cleared, bounced, cancelled
    notes = db.Column(db.Text, nullable=True)
    received_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    invoice = db.relationship('Invoice', back_populates='payments')
    customer = db.relationship('Customer')
    supplier = db.relationship('Supplier')
    received_by_user = db.relationship('User')

class Account(db.Model):
    __tablename__ = 'accounts'
    
    id = db.Column(db.Integer, primary_key=True)
    account_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    account_name = db.Column(db.String(200), nullable=False)
    account_type = db.Column(db.String(50), nullable=False)  # asset, liability, equity, revenue, expense
    parent_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    level = db.Column(db.Integer, default=1)
    is_active = db.Column(db.Boolean, default=True)
    is_header = db.Column(db.Boolean, default=False)
    is_cash_bank = db.Column(db.Boolean, default=False)  # marks accounts selectable as payment source (Accurate-style Kas/Bank type)
    normal_balance = db.Column(db.String(10), nullable=False)  # debit, credit
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Self-referential relationship
    children = db.relationship('Account', backref=db.backref('parent', remote_side=[id]))
    
    @property
    def balance(self):
        """Calculate account balance from accounting entries"""
        entries = AccountingEntry.query.filter_by(account_code=self.account_code, status='posted').all()
        debit_total = sum(float(entry.debit_amount or 0) for entry in entries)
        credit_total = sum(float(entry.credit_amount or 0) for entry in entries)
        
        if self.normal_balance == 'debit':
            return debit_total - credit_total
        else:
            return credit_total - debit_total

class Budget(db.Model):
    __tablename__ = 'budgets'
    
    id = db.Column(db.Integer, primary_key=True)
    budget_name = db.Column(db.String(200), nullable=False)
    budget_year = db.Column(db.Integer, nullable=False)
    budget_period = db.Column(db.String(50), nullable=False)  # annual, quarterly, monthly
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(50), default='draft')  # draft, approved, active, closed
    total_budget = db.Column(db.Numeric(15, 2), default=0)
    department = db.Column(db.String(50), nullable=True)
    category = db.Column(db.String(50), nullable=True)
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    lines = db.relationship('BudgetLine', back_populates='budget', cascade='all, delete-orphan')
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    approved_by_user = db.relationship('User', foreign_keys=[approved_by])

class BudgetLine(db.Model):
    __tablename__ = 'budget_lines'
    
    id = db.Column(db.Integer, primary_key=True)
    budget_id = db.Column(db.Integer, db.ForeignKey('budgets.id', ondelete='CASCADE'), nullable=False)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    budget_amount = db.Column(db.Numeric(15, 2), nullable=False)
    actual_amount = db.Column(db.Numeric(15, 2), default=0)
    variance_amount = db.Column(db.Numeric(15, 2), default=0)
    variance_percent = db.Column(db.Numeric(5, 2), default=0)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    budget = db.relationship('Budget', back_populates='lines')
    account = db.relationship('Account')

class AccountingEntry(db.Model):
    __tablename__ = 'accounting_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    entry_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    entry_date = db.Column(db.Date, nullable=False, index=True)
    entry_type = db.Column(db.String(50), nullable=False)  # general, sales, purchase, payment
    reference_type = db.Column(db.String(50), nullable=True)
    reference_id = db.Column(db.Integer, nullable=True)
    reference_number = db.Column(db.String(100), nullable=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    account_code = db.Column(db.String(50), nullable=False)
    account_name = db.Column(db.String(200), nullable=False)
    debit_amount = db.Column(db.Numeric(15, 2), default=0)
    credit_amount = db.Column(db.Numeric(15, 2), default=0)
    cost_center_id = db.Column(db.Integer, db.ForeignKey('cost_centers.id'), nullable=True)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='draft')  # draft, posted, reversed
    posted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    posted_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    account = db.relationship('Account')
    cost_center = db.relationship('CostCenter')
    posted_by_user = db.relationship('User')


class FixedAsset(db.Model):
    __tablename__ = 'fixed_assets'
    
    id = db.Column(db.Integer, primary_key=True)
    asset_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    asset_name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(100), nullable=False)  # Building, Equipment, Vehicle, Furniture, IT Equipment
    description = db.Column(db.Text, nullable=True)
    
    # Acquisition
    acquisition_date = db.Column(db.Date, nullable=False)
    acquisition_cost = db.Column(db.Numeric(15, 2), nullable=False)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    invoice_number = db.Column(db.String(100), nullable=True)
    
    # Depreciation
    depreciation_method = db.Column(db.String(50), nullable=False, default='straight_line')  # straight_line, declining_balance
    useful_life_years = db.Column(db.Integer, nullable=False)  # in years
    salvage_value = db.Column(db.Numeric(15, 2), default=0)
    accumulated_depreciation = db.Column(db.Numeric(15, 2), default=0)
    
    # Location & Status
    location = db.Column(db.String(200), nullable=True)
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'), nullable=True)
    responsible_person = db.Column(db.String(200), nullable=True)
    status = db.Column(db.String(50), nullable=False, default='active')  # active, disposed, sold, damaged
    
    # Disposal
    disposal_date = db.Column(db.Date, nullable=True)
    disposal_amount = db.Column(db.Numeric(15, 2), nullable=True)
    disposal_notes = db.Column(db.Text, nullable=True)
    
    # Audit
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    supplier = db.relationship('Supplier')
    department = db.relationship('Department')
    created_by_user = db.relationship('User')
    
    @property
    def net_book_value(self):
        """Calculate Net Book Value (Cost - Accumulated Depreciation)"""
        return float(self.acquisition_cost) - float(self.accumulated_depreciation)
    
    @property
    def annual_depreciation(self):
        """Calculate annual depreciation amount"""
        if self.depreciation_method == 'straight_line':
            return (float(self.acquisition_cost) - float(self.salvage_value)) / self.useful_life_years
        return 0


class TaxTransaction(db.Model):
    __tablename__ = 'tax_transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    transaction_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    transaction_date = db.Column(db.Date, nullable=False, index=True)
    transaction_type = db.Column(db.String(50), nullable=False)  # vat_in, vat_out, income_tax, other
    
    # Tax Details
    tax_type = db.Column(db.String(50), nullable=False)  # VAT, PPh21, PPh23, PPh4(2), etc.
    tax_rate = db.Column(db.Numeric(5, 2), nullable=False)  # percentage
    base_amount = db.Column(db.Numeric(15, 2), nullable=False)  # amount before tax
    tax_amount = db.Column(db.Numeric(15, 2), nullable=False)  # calculated tax
    
    # Reference
    reference_type = db.Column(db.String(50), nullable=True)  # invoice, payment, sales_order
    reference_id = db.Column(db.Integer, nullable=True)
    reference_number = db.Column(db.String(100), nullable=True)
    
    # Tax Document
    tax_invoice_number = db.Column(db.String(100), nullable=True)  # Faktur Pajak number
    tax_invoice_date = db.Column(db.Date, nullable=True)
    
    # Party Information
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    party_name = db.Column(db.String(200), nullable=True)
    party_npwp = db.Column(db.String(50), nullable=True)  # Tax ID number
    
    # Status
    status = db.Column(db.String(50), nullable=False, default='draft')  # draft, reported, paid
    reporting_period = db.Column(db.String(20), nullable=True)  # YYYY-MM format
    payment_date = db.Column(db.Date, nullable=True)
    
    description = db.Column(db.Text, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    # Audit
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    customer = db.relationship('Customer')
    supplier = db.relationship('Supplier')
    created_by_user = db.relationship('User')




class ConsolidationEntity(db.Model):
    __tablename__ = 'consolidation_entities'
    
    id = db.Column(db.Integer, primary_key=True)
    entity_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    entity_name = db.Column(db.String(200), nullable=False)
    entity_type = db.Column(db.String(50), nullable=False)  # parent, subsidiary, branch, division
    
    # Hierarchy
    parent_entity_id = db.Column(db.Integer, db.ForeignKey('consolidation_entities.id'), nullable=True)
    ownership_percentage = db.Column(db.Numeric(5, 2), nullable=True)  # for subsidiaries
    
    # Financial Details
    currency = db.Column(db.String(10), nullable=False, default='IDR')
    fiscal_year_end = db.Column(db.String(10), nullable=True)  # MM-DD format
    
    # Contact
    address = db.Column(db.Text, nullable=True)
    contact_person = db.Column(db.String(200), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    email = db.Column(db.String(100), nullable=True)
    
    # Tax
    tax_id = db.Column(db.String(50), nullable=True)  # NPWP
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    
    # Audit
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    parent_entity = db.relationship('ConsolidationEntity', remote_side=[id], backref='subsidiaries')
    created_by_user = db.relationship('User')


# ===== Account Preferences system (Accurate-style Preferensi Akun) =====
# 3-level fallback for account resolution: item override (Product) ->
# category default (CategoryAccountDefault) -> global default (GlobalAccountDefault).

class CategoryAccountDefault(db.Model):
    __tablename__ = 'category_account_defaults'

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey('product_categories.id'), nullable=False, unique=True, index=True)

    akun_persediaan_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    akun_penjualan_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    akun_retur_penjualan_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    akun_diskon_penjualan_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    akun_barang_terkirim_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    akun_hpp_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    akun_retur_pembelian_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    akun_beban_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    akun_pembelian_belum_tertagih_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GlobalAccountDefault(db.Model):
    """Migrates the hardcoded TRANSACTION_ACCOUNTS dict (utils/account_config.py)
    into the database - final fallback level under category/item overrides,
    editable from Settings UI without redeploy."""
    __tablename__ = 'global_account_defaults'

    id = db.Column(db.Integer, primary_key=True)
    transaction_key = db.Column(db.String(100), unique=True, nullable=False, index=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False)
    description = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SalesAccountSettings(db.Model):
    """Module-level sales settings beyond the 9 item slots. Single-row config table."""
    __tablename__ = 'sales_account_settings'

    id = db.Column(db.Integer, primary_key=True)
    akun_uang_muka_pelanggan_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PurchaseAccountSettings(db.Model):
    """Module-level purchasing settings. Single-row config table."""
    __tablename__ = 'purchase_account_settings'

    id = db.Column(db.Integer, primary_key=True)
    akun_selisih_pembelian_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    akun_perintah_pembayaran_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    # Invoice blocking (SAP MM concept, 2026-09-14) - a 3-way-match price
    # discrepancy bigger than this % of the invoice's total debit amount now
    # holds the invoice's GL posting for manual review instead of always
    # auto-posting the variance (routes/purchase_invoice.py::create_purchase_invoice).
    invoice_variance_tolerance_percent = db.Column(db.Numeric(5, 2), nullable=False, default=5.0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TaxAccountSettings(db.Model):
    """PPN/PPh default accounts. Single-row config table."""
    __tablename__ = 'tax_account_settings'

    id = db.Column(db.Integer, primary_key=True)
    akun_ppn_keluaran_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    akun_ppn_masukan_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    akun_pph22_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    akun_pph23_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CompanyAccountSettings(db.Model):
    """Equity/laba ditahan accounts, plus currency/exchange-rate settings
    (folded in here rather than a separate tab, per 2026-08-14 decision).
    Single-row config table."""
    __tablename__ = 'company_account_settings'

    id = db.Column(db.Integer, primary_key=True)
    akun_ekuitas_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    akun_laba_ditahan_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)
    exchange_rate_refresh_enabled = db.Column(db.Boolean, default=True, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class InventoryAccountSettings(db.Model):
    """Akun selisih stok - mandatory before posting stok opname results,
    per Accurate's pattern. Single-row config table."""
    __tablename__ = 'inventory_account_settings'

    id = db.Column(db.Integer, primary_key=True)
    akun_penyesuaian_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExchangeRate(db.Model):
    """Cache for daily-refreshed exchange rate feed (ExchangeRate-API open-access,
    open.er-api.com/v6/latest/USD, no key needed). Falls back to last known rate
    if the API is unreachable."""
    __tablename__ = 'exchange_rates'

    id = db.Column(db.Integer, primary_key=True)
    currency_pair = db.Column(db.String(10), nullable=False, index=True)  # e.g. 'USD_IDR'
    rate = db.Column(db.Numeric(20, 6), nullable=False)
    fetched_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class RecurringPayment(db.Model):
    """
    Master record for a recurring monthly bill (WiFi, listrik, air, etc).
    Per Bayu's 2026-08-16 decision: amount varies month to month (not a
    fixed subscription fee), so this only holds the "what/who" - the
    actual amount is entered each month via RecurringPaymentTransaction.
    No automatic scheduling/reminders - purely a named template so users
    don't have to re-type "PLN - Listrik Pabrik" every single month.
    """
    __tablename__ = 'recurring_payments'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)  # e.g. "Listrik Pabrik", "WiFi Kantor"
    category = db.Column(db.String(50), nullable=False)  # electricity, water, internet, other
    vendor_name = db.Column(db.String(200), nullable=True)  # e.g. "PLN", "Indihome"
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RecurringPaymentTransaction(db.Model):
    """
    Actual monthly payment record against a RecurringPayment template.
    Posts a GL journal (Debit Beban Operasional / Credit Kas) when created,
    reusing the same global 'beban_operasional' account as regular expense
    claims (per Bayu's 2026-08-16 decision - one shared expense account
    rather than per-category accounts for now).
    """
    __tablename__ = 'recurring_payment_transactions'

    id = db.Column(db.Integer, primary_key=True)
    transaction_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    recurring_payment_id = db.Column(db.Integer, db.ForeignKey('recurring_payments.id'), nullable=False, index=True)
    payment_date = db.Column(db.Date, nullable=False, index=True)
    period_label = db.Column(db.String(20), nullable=True)  # e.g. "2026-08" for reporting/dedup checks
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    recurring_payment = db.relationship('RecurringPayment')


class NumberSequence(db.Model):
    """
    Optional override for document number prefixes (INV, PO, JE, etc),
    configurable from Settings rather than hardcoded at each call site.
    Per Bayu's 2026-08-16 decision to keep this additive rather than
    retrofitting the many existing generate_number() call sites: this only
    powers NEW call sites written going forward (via generate_number_v2()
    in utils/helpers.py) - it does not change behavior for any of the
    dozens of existing generate_number(prefix, ...) calls already in the
    codebase, which keep their hardcoded prefixes untouched.
    """
    __tablename__ = 'number_sequences'

    id = db.Column(db.Integer, primary_key=True)
    sequence_key = db.Column(db.String(50), unique=True, nullable=False, index=True)  # e.g. 'invoice', 'purchase_order'
    prefix = db.Column(db.String(20), nullable=False)  # e.g. 'INV', 'PO'
    description = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PeriodClose(db.Model):
    """
    Records that a given accounting period (year+month) has been closed via
    the "Proses Akhir Bulan" flow - mirrors Accurate's Period End feature.
    Existence of a row for (period_year, period_month) means that period is
    locked: new/edited transactions dated within it should be rejected by
    the transaction-creating routes (not yet enforced everywhere - see
    finance_helpers.py's is_period_locked() for the check routes should
    call before allowing a backdated transaction).
    """
    __tablename__ = 'period_closes'

    id = db.Column(db.Integer, primary_key=True)
    period_year = db.Column(db.Integer, nullable=False)
    period_month = db.Column(db.Integer, nullable=False)
    closed_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    closed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    depreciation_summary = db.Column(db.JSON, nullable=True)  # output of run_monthly_depreciation()
    notes = db.Column(db.Text, nullable=True)

    __table_args__ = (
        db.UniqueConstraint('period_year', 'period_month', name='uq_period_close_year_month'),
    )
