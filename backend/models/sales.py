from datetime import datetime
from . import db

# ===============================
# LEAD MANAGEMENT MODELS
# ===============================

class Lead(db.Model):
    __tablename__ = 'leads'
    
    id = db.Column(db.Integer, primary_key=True)
    lead_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    company_name = db.Column(db.String(255), nullable=False, index=True)
    contact_person = db.Column(db.String(200), nullable=False)
    job_title = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    mobile = db.Column(db.String(50), nullable=True)
    website = db.Column(db.String(200), nullable=True)
    address = db.Column(db.Text, nullable=True)
    city = db.Column(db.String(100), nullable=True)
    state = db.Column(db.String(100), nullable=True)
    country = db.Column(db.String(100), nullable=True)
    postal_code = db.Column(db.String(20), nullable=True)
    
    # Lead Information
    lead_source = db.Column(db.String(50), nullable=True)  # website, referral, cold_call, social_media, trade_show, advertisement
    lead_status = db.Column(db.String(50), nullable=False, default='new')  # new, contacted, qualified, converted, lost
    lead_score = db.Column(db.Integer, default=0)
    industry = db.Column(db.String(100), nullable=True)
    company_size = db.Column(db.String(50), nullable=True)  # startup, small, medium, large, enterprise
    annual_revenue = db.Column(db.Numeric(15, 2), nullable=True)
    budget = db.Column(db.Numeric(15, 2), nullable=True)
    decision_maker = db.Column(db.Boolean, default=False)
    purchase_timeline = db.Column(db.String(50), nullable=True)  # immediate, 1_month, 3_months, 6_months, 1_year
    
    # Assignment & Tracking  
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    converted_to_customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    converted_at = db.Column(db.DateTime, nullable=True)
    last_contacted = db.Column(db.DateTime, nullable=True)
    next_followup = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assigned_user = db.relationship('User', foreign_keys=[assigned_to])
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    converted_customer = db.relationship('Customer', foreign_keys=[converted_to_customer_id])
    opportunities = db.relationship('Opportunity', back_populates='lead', cascade='all, delete-orphan')
    activities = db.relationship('SalesActivity', back_populates='lead', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Lead {self.lead_number} - {self.company_name}>'

# ===============================
# OPPORTUNITY/PIPELINE MANAGEMENT
# ===============================

class SalesPipeline(db.Model):
    __tablename__ = 'sales_pipelines'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    is_default = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    stages = db.relationship('PipelineStage', back_populates='pipeline', cascade='all, delete-orphan', order_by='PipelineStage.order')
    opportunities = db.relationship('Opportunity', back_populates='pipeline')

class PipelineStage(db.Model):
    __tablename__ = 'pipeline_stages'
    
    id = db.Column(db.Integer, primary_key=True)
    pipeline_id = db.Column(db.Integer, db.ForeignKey('sales_pipelines.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    order = db.Column(db.Integer, nullable=False)
    probability = db.Column(db.Integer, default=0)  # 0-100%
    is_closed_won = db.Column(db.Boolean, default=False)
    is_closed_lost = db.Column(db.Boolean, default=False)
    color_code = db.Column(db.String(7), nullable=True)  # hex color
    
    # Relationships
    pipeline = db.relationship('SalesPipeline', back_populates='stages')
    opportunities = db.relationship('Opportunity', back_populates='stage')

class Opportunity(db.Model):
    __tablename__ = 'opportunities'
    
    id = db.Column(db.Integer, primary_key=True)
    opportunity_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    
    # Relationships
    lead_id = db.Column(db.Integer, db.ForeignKey('leads.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    pipeline_id = db.Column(db.Integer, db.ForeignKey('sales_pipelines.id'), nullable=False)
    stage_id = db.Column(db.Integer, db.ForeignKey('pipeline_stages.id'), nullable=False)
    
    # Opportunity Details
    description = db.Column(db.Text, nullable=True)
    value = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    probability = db.Column(db.Integer, default=0)  # 0-100%
    expected_close_date = db.Column(db.Date, nullable=True)
    actual_close_date = db.Column(db.Date, nullable=True)
    
    # Competition & Decision
    competitors = db.Column(db.Text, nullable=True)
    decision_criteria = db.Column(db.Text, nullable=True)
    decision_process = db.Column(db.Text, nullable=True)
    budget_confirmed = db.Column(db.Boolean, default=False)
    authority_identified = db.Column(db.Boolean, default=False)
    need_identified = db.Column(db.Boolean, default=False)
    timeline_identified = db.Column(db.Boolean, default=False)
    
    # Assignment & Status
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    status = db.Column(db.String(50), nullable=False, default='open')  # open, won, lost, on_hold
    lost_reason = db.Column(db.String(100), nullable=True)
    
    # Tracking
    source = db.Column(db.String(50), nullable=True)
    last_activity_date = db.Column(db.DateTime, nullable=True)
    next_step = db.Column(db.Text, nullable=True)
    next_step_date = db.Column(db.DateTime, nullable=True)
    
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    lead = db.relationship('Lead', back_populates='opportunities')
    customer = db.relationship('Customer', back_populates='opportunities')
    pipeline = db.relationship('SalesPipeline', back_populates='opportunities')
    stage = db.relationship('PipelineStage', back_populates='opportunities')
    assigned_user = db.relationship('User', foreign_keys=[assigned_to])
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    activities = db.relationship('SalesActivity', back_populates='opportunity', cascade='all, delete-orphan')
    quotations = db.relationship('Quotation', back_populates='opportunity', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Opportunity {self.opportunity_number} - {self.name}>'

# ===============================
# ENHANCED CUSTOMER DATABASE
# ===============================

class Customer(db.Model):
    __tablename__ = 'customers'
    
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    company_name = db.Column(db.String(255), nullable=False, index=True)
    contact_person = db.Column(db.String(200), nullable=True)
    job_title = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    mobile = db.Column(db.String(50), nullable=True)
    fax = db.Column(db.String(50), nullable=True)
    website = db.Column(db.String(200), nullable=True)
    tax_id = db.Column(db.String(100), nullable=True)
    
    # Address Information
    billing_address = db.Column(db.Text, nullable=True)
    billing_city = db.Column(db.String(100), nullable=True)
    billing_state = db.Column(db.String(100), nullable=True)
    billing_country = db.Column(db.String(100), nullable=True)
    billing_postal_code = db.Column(db.String(20), nullable=True)
    
    shipping_address = db.Column(db.Text, nullable=True)
    shipping_city = db.Column(db.String(100), nullable=True)
    shipping_state = db.Column(db.String(100), nullable=True)
    shipping_country = db.Column(db.String(100), nullable=True)
    shipping_postal_code = db.Column(db.String(20), nullable=True)
    
    # Business Information
    credit_limit = db.Column(db.Numeric(15, 2), default=0)
    payment_terms_days = db.Column(db.Integer, default=30)

    # Account Preferences: overrides GlobalAccountDefault('accounts_receivable')
    # when set. Per Accurate's pattern (confirmed via web search 2026-08-17),
    # piutang usaha can be set per-customer, same as accounts payable is
    # per-supplier via Supplier.akun_hutang_usaha_id.
    akun_piutang_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=True)

    customer_type = db.Column(db.String(50), nullable=True)  # wholesale, retail, distributor
    industry = db.Column(db.String(100), nullable=True)
    company_size = db.Column(db.String(50), nullable=True)  # startup, small, medium, large, enterprise
    annual_revenue = db.Column(db.Numeric(15, 2), nullable=True)
    
    # CRM Information
    rating = db.Column(db.String(20), nullable=True)  # A, B, C
    priority = db.Column(db.String(20), nullable=False, default='normal')  # low, normal, high
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    lifecycle_stage = db.Column(db.String(50), nullable=True)  # prospect, customer, champion, other
    
    # Status & Tracking
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    last_contact_date = db.Column(db.DateTime, nullable=True)
    next_contact_date = db.Column(db.DateTime, nullable=True)
    total_orders = db.Column(db.Integer, default=0)
    total_revenue = db.Column(db.Numeric(15, 2), default=0)
    average_order_value = db.Column(db.Numeric(15, 2), default=0)
    
    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assigned_user = db.relationship('User', foreign_keys=[assigned_to])
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    opportunities = db.relationship('Opportunity', back_populates='customer', cascade='all, delete-orphan')
    quotations = db.relationship('Quotation', back_populates='customer', cascade='all, delete-orphan')
    sales_orders = db.relationship('SalesOrder', back_populates='customer', cascade='all, delete-orphan')
    activities = db.relationship('SalesActivity', back_populates='customer', cascade='all, delete-orphan')
    contacts = db.relationship('CustomerContact', back_populates='customer', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Customer {self.code} - {self.company_name}>'

class CustomerContact(db.Model):
    __tablename__ = 'customer_contacts'
    
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    job_title = db.Column(db.String(100), nullable=True)
    department = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    mobile = db.Column(db.String(50), nullable=True)
    is_primary = db.Column(db.Boolean, default=False)
    is_decision_maker = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    customer = db.relationship('Customer', back_populates='contacts')

# ===============================
# QUOTATION MANAGEMENT
# ===============================

class Quotation(db.Model):
    __tablename__ = 'quotations'
    
    id = db.Column(db.Integer, primary_key=True)
    quote_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    revision = db.Column(db.Integer, default=1)
    
    # Relationships
    opportunity_id = db.Column(db.Integer, db.ForeignKey('opportunities.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    
    # Quote Details
    quote_date = db.Column(db.Date, nullable=False, index=True)
    valid_until = db.Column(db.Date, nullable=False)
    delivery_date = db.Column(db.Date, nullable=True)
    payment_terms = db.Column(db.String(100), nullable=True)
    delivery_terms = db.Column(db.String(100), nullable=True)
    
    # Pricing
    subtotal = db.Column(db.Numeric(15, 2), default=0)
    discount_percent = db.Column(db.Numeric(5, 2), default=0)
    discount_amount = db.Column(db.Numeric(15, 2), default=0)
    tax_percent = db.Column(db.Numeric(5, 2), default=0)
    tax_amount = db.Column(db.Numeric(15, 2), default=0)
    shipping_cost = db.Column(db.Numeric(15, 2), default=0)
    total_amount = db.Column(db.Numeric(15, 2), default=0)
    
    # Status & Tracking
    status = db.Column(db.String(50), nullable=False, default='draft')  # draft, sent, accepted, rejected, expired, converted
    sent_date = db.Column(db.DateTime, nullable=True)
    accepted_date = db.Column(db.DateTime, nullable=True)
    rejected_date = db.Column(db.DateTime, nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)
    
    # Conversion
    converted_to_order_id = db.Column(db.Integer, db.ForeignKey('sales_orders.id'), nullable=True)
    conversion_rate = db.Column(db.Numeric(5, 2), default=100)  # percentage of quote converted to order
    
    # Additional Information
    notes = db.Column(db.Text, nullable=True)
    terms_conditions = db.Column(db.Text, nullable=True)
    internal_notes = db.Column(db.Text, nullable=True)
    
    prepared_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    opportunity = db.relationship('Opportunity', back_populates='quotations')
    customer = db.relationship('Customer', back_populates='quotations')
    converted_order = db.relationship('SalesOrder', foreign_keys=[converted_to_order_id])
    items = db.relationship('QuotationItem', back_populates='quotation', cascade='all, delete-orphan')
    prepared_by_user = db.relationship('User', foreign_keys=[prepared_by])
    approved_by_user = db.relationship('User', foreign_keys=[approved_by])
    
    def __repr__(self):
        return f'<Quotation {self.quote_number}>'

class QuotationItem(db.Model):
    __tablename__ = 'quotation_items'
    
    id = db.Column(db.Integer, primary_key=True)
    quotation_id = db.Column(db.Integer, db.ForeignKey('quotations.id'), nullable=False)
    line_number = db.Column(db.Integer, nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    description = db.Column(db.Text, nullable=True)
    quantity = db.Column(db.Numeric(15, 2), nullable=False)
    uom = db.Column(db.String(20), nullable=False)
    unit_price = db.Column(db.Numeric(15, 2), nullable=False)
    discount_percent = db.Column(db.Numeric(5, 2), default=0)
    discount_amount = db.Column(db.Numeric(15, 2), default=0)
    tax_percent = db.Column(db.Numeric(5, 2), default=0)
    tax_amount = db.Column(db.Numeric(15, 2), default=0)
    total_price = db.Column(db.Numeric(15, 2), nullable=False)
    delivery_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    # Relationships
    quotation = db.relationship('Quotation', back_populates='items')
    product = db.relationship('Product')
    
    __table_args__ = (
        db.UniqueConstraint('quotation_id', 'line_number', name='unique_quote_line'),
    )

# ===============================
# SALES ORDER MANAGEMENT
# ===============================

class SalesOrder(db.Model):
    __tablename__ = 'sales_orders'
    
    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    
    # Relationships
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False)
    quotation_id = db.Column(db.Integer, db.ForeignKey('quotations.id'), nullable=True)
    
    # Order Details
    order_date = db.Column(db.Date, nullable=False, index=True)
    required_date = db.Column(db.Date, nullable=True)
    promised_date = db.Column(db.Date, nullable=True)
    delivery_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='draft')  # draft, confirmed, in_production, ready, shipped, delivered, cancelled
    priority = db.Column(db.String(20), nullable=False, default='normal')  # low, normal, high, urgent
    customer_po_number = db.Column(db.String(100), nullable=True)
    payment_terms = db.Column(db.String(100), nullable=True)
    payment_method = db.Column(db.String(50), nullable=True)
    delivery_address = db.Column(db.Text, nullable=True)
    shipping_method = db.Column(db.String(100), nullable=True)
    shipping_cost = db.Column(db.Numeric(15, 2), default=0)
    subtotal = db.Column(db.Numeric(15, 2), default=0)
    tax_amount = db.Column(db.Numeric(15, 2), default=0)
    discount_amount = db.Column(db.Numeric(15, 2), default=0)
    total_amount = db.Column(db.Numeric(15, 2), default=0)
    notes = db.Column(db.Text, nullable=True)
    internal_notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    customer = db.relationship('Customer', back_populates='sales_orders')
    quotation = db.relationship('Quotation', foreign_keys=[quotation_id])
    items = db.relationship('SalesOrderItem', back_populates='order', cascade='all, delete-orphan')
    shipping_orders = db.relationship('ShippingOrder', back_populates='sales_order')
    invoices = db.relationship('Invoice', back_populates='sales_order')
    returns = db.relationship('CustomerReturn', back_populates='sales_order')
    work_orders = db.relationship('WorkOrder', back_populates='sales_order')  # Workflow integration
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    approved_by_user = db.relationship('User', foreign_keys=[approved_by])
    
    def __repr__(self):
        return f'<SalesOrder {self.order_number}>'

class SalesOrderItem(db.Model):
    __tablename__ = 'sales_order_items'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('sales_orders.id', ondelete='CASCADE'), nullable=False)
    line_number = db.Column(db.Integer, nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    description = db.Column(db.Text, nullable=True)
    quantity = db.Column(db.Numeric(15, 2), nullable=False)
    uom = db.Column(db.String(20), nullable=False)
    unit_price = db.Column(db.Numeric(15, 2), nullable=False)
    discount_percent = db.Column(db.Numeric(5, 2), default=0)
    discount_amount = db.Column(db.Numeric(15, 2), default=0)
    tax_percent = db.Column(db.Numeric(5, 2), default=0)
    tax_amount = db.Column(db.Numeric(15, 2), default=0)
    total_price = db.Column(db.Numeric(15, 2), nullable=False)
    quantity_shipped = db.Column(db.Numeric(15, 2), default=0)
    quantity_invoiced = db.Column(db.Numeric(15, 2), default=0)
    required_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    order = db.relationship('SalesOrder', back_populates='items')
    product = db.relationship('Product', back_populates='sales_order_items')
    
    __table_args__ = (
        db.UniqueConstraint('order_id', 'line_number', name='unique_order_line'),
    )

# ===============================
# ACTIVITY & TASK MANAGEMENT
# ===============================

class SalesActivity(db.Model):
    __tablename__ = 'sales_activities'
    
    id = db.Column(db.Integer, primary_key=True)
    activity_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    subject = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # Activity Type & Status
    activity_type = db.Column(db.String(50), nullable=False)  # call, email, meeting, task, note, demo, proposal
    status = db.Column(db.String(50), nullable=False, default='planned')  # planned, in_progress, completed, cancelled, overdue
    priority = db.Column(db.String(20), nullable=False, default='normal')  # low, normal, high, urgent
    
    # Timing
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)
    due_date = db.Column(db.DateTime, nullable=True)
    duration_minutes = db.Column(db.Integer, nullable=True)
    completed_date = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    lead_id = db.Column(db.Integer, db.ForeignKey('leads.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    opportunity_id = db.Column(db.Integer, db.ForeignKey('opportunities.id'), nullable=True)
    quotation_id = db.Column(db.Integer, db.ForeignKey('quotations.id'), nullable=True)
    sales_order_id = db.Column(db.Integer, db.ForeignKey('sales_orders.id'), nullable=True)
    
    # Assignment
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Outcome & Follow-up
    outcome = db.Column(db.Text, nullable=True)  # result of the activity
    next_step = db.Column(db.Text, nullable=True)
    follow_up_date = db.Column(db.DateTime, nullable=True)
    
    # Additional Information
    location = db.Column(db.String(200), nullable=True)
    attendees = db.Column(db.Text, nullable=True)  # JSON or comma-separated
    tags = db.Column(db.String(500), nullable=True)  # comma-separated tags
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    lead = db.relationship('Lead', back_populates='activities')
    customer = db.relationship('Customer', back_populates='activities')
    opportunity = db.relationship('Opportunity', back_populates='activities')
    quotation = db.relationship('Quotation')
    sales_order = db.relationship('SalesOrder')
    assigned_user = db.relationship('User', foreign_keys=[assigned_to])
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    
    def __repr__(self):
        return f'<SalesActivity {self.activity_number} - {self.subject}>'

class SalesTask(db.Model):
    __tablename__ = 'sales_tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    task_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # Task Details
    task_type = db.Column(db.String(50), nullable=True)  # follow_up, research, preparation, admin
    status = db.Column(db.String(50), nullable=False, default='open')  # open, in_progress, completed, cancelled, on_hold
    priority = db.Column(db.String(20), nullable=False, default='normal')  # low, normal, high, urgent
    
    # Timing
    due_date = db.Column(db.DateTime, nullable=True)
    start_date = db.Column(db.DateTime, nullable=True)
    completed_date = db.Column(db.DateTime, nullable=True)
    estimated_hours = db.Column(db.Numeric(5, 2), nullable=True)
    actual_hours = db.Column(db.Numeric(5, 2), nullable=True)
    
    # Relationships
    lead_id = db.Column(db.Integer, db.ForeignKey('leads.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    opportunity_id = db.Column(db.Integer, db.ForeignKey('opportunities.id'), nullable=True)
    parent_task_id = db.Column(db.Integer, db.ForeignKey('sales_tasks.id'), nullable=True)
    
    # Assignment
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Progress & Notes
    progress_percent = db.Column(db.Integer, default=0)  # 0-100%
    notes = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    lead = db.relationship('Lead')
    customer = db.relationship('Customer')
    opportunity = db.relationship('Opportunity')
    parent_task = db.relationship('SalesTask', remote_side=[id], backref='subtasks')
    assigned_user = db.relationship('User', foreign_keys=[assigned_to])
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    
    def __repr__(self):
        return f'<SalesTask {self.task_number} - {self.title}>'

# ===============================
# SALES ANALYTICS & REPORTING
# ===============================

class SalesMetrics(db.Model):
    __tablename__ = 'sales_metrics'
    
    id = db.Column(db.Integer, primary_key=True)
    metric_date = db.Column(db.Date, nullable=False, index=True)
    period_type = db.Column(db.String(20), nullable=False)  # daily, weekly, monthly, quarterly, yearly
    
    # User/Team Metrics
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    team_id = db.Column(db.Integer, nullable=True)  # if you have teams
    
    # Lead Metrics
    leads_generated = db.Column(db.Integer, default=0)
    leads_qualified = db.Column(db.Integer, default=0)
    leads_converted = db.Column(db.Integer, default=0)
    lead_conversion_rate = db.Column(db.Numeric(5, 2), default=0)  # percentage
    
    # Opportunity Metrics
    opportunities_created = db.Column(db.Integer, default=0)
    opportunities_won = db.Column(db.Integer, default=0)
    opportunities_lost = db.Column(db.Integer, default=0)
    win_rate = db.Column(db.Numeric(5, 2), default=0)  # percentage
    
    # Pipeline Metrics
    pipeline_value = db.Column(db.Numeric(15, 2), default=0)
    weighted_pipeline = db.Column(db.Numeric(15, 2), default=0)
    average_deal_size = db.Column(db.Numeric(15, 2), default=0)
    average_sales_cycle = db.Column(db.Integer, default=0)  # days
    
    # Revenue Metrics
    revenue_target = db.Column(db.Numeric(15, 2), default=0)
    revenue_actual = db.Column(db.Numeric(15, 2), default=0)
    revenue_achievement = db.Column(db.Numeric(5, 2), default=0)  # percentage
    
    # Activity Metrics
    calls_made = db.Column(db.Integer, default=0)
    emails_sent = db.Column(db.Integer, default=0)
    meetings_held = db.Column(db.Integer, default=0)
    demos_conducted = db.Column(db.Integer, default=0)
    proposals_sent = db.Column(db.Integer, default=0)
    
    # Customer Metrics
    new_customers = db.Column(db.Integer, default=0)
    customer_retention_rate = db.Column(db.Numeric(5, 2), default=0)
    customer_lifetime_value = db.Column(db.Numeric(15, 2), default=0)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User')
    
    __table_args__ = (
        db.UniqueConstraint('metric_date', 'period_type', 'user_id', name='unique_user_metric'),
    )

class SalesReport(db.Model):
    __tablename__ = 'sales_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    report_name = db.Column(db.String(200), nullable=False)
    report_type = db.Column(db.String(50), nullable=False)  # pipeline, activity, revenue, conversion, forecast
    
    # Report Configuration
    parameters = db.Column(db.Text, nullable=True)  # JSON configuration
    filters = db.Column(db.Text, nullable=True)  # JSON filters
    date_range_start = db.Column(db.Date, nullable=True)
    date_range_end = db.Column(db.Date, nullable=True)
    
    # Report Data
    data = db.Column(db.Text, nullable=True)  # JSON report data
    summary = db.Column(db.Text, nullable=True)  # JSON summary data
    
    # Status & Schedule
    status = db.Column(db.String(50), nullable=False, default='draft')  # draft, generated, scheduled, error
    is_scheduled = db.Column(db.Boolean, default=False)
    schedule_frequency = db.Column(db.String(20), nullable=True)  # daily, weekly, monthly
    next_run_date = db.Column(db.DateTime, nullable=True)
    last_run_date = db.Column(db.DateTime, nullable=True)
    
    # Access Control
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_public = db.Column(db.Boolean, default=False)
    shared_with = db.Column(db.Text, nullable=True)  # JSON list of user IDs
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    created_by_user = db.relationship('User')
    
    def __repr__(self):
        return f'<SalesReport {self.report_name}>'

# ===============================
# SALES FORECAST
# ===============================

class ForecastHeader(db.Model):
    """Sales Forecast Matrix - 1 row per rolling 12-month window (see
    SALES_FORECAST_MATRIX_RENCANA_TEKNIS.md, rombak 2026-08-25 per keputusan manajemen:
    forecast TIDAK terkunci ke tahun kalender Jan-Des - bisa mulai dari bulan apa saja,
    mis. mulai Agustus 2026 -> berlaku sampai Juli 2027). `period_start` selalu tanggal 1
    bulan mulai; `period_end` (12 bulan setelahnya) dihitung, tidak disimpan.
    Replaces the old SalesForecast (1 row per product+period) - retired 2026-08-24, no data
    migration (old draft data was disposable per explicit confirmation)."""
    __tablename__ = 'forecast_headers'

    id = db.Column(db.Integer, primary_key=True)
    period_start = db.Column(db.Date, nullable=False)  # always day=1
    name = db.Column(db.String(200), nullable=True)
    status = db.Column(db.String(20), nullable=False, default='draft')  # draft, approved (§3.3)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lines = db.relationship('ForecastLine', backref='header', cascade='all, delete-orphan', lazy='selectin')
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    approved_by_user = db.relationship('User', foreign_keys=[approved_by])

    @property
    def period_end(self):
        """Last day of the 12th month in this window (inclusive)."""
        from dateutil.relativedelta import relativedelta
        from calendar import monthrange
        last_month = self.period_start + relativedelta(months=11)
        return last_month.replace(day=monthrange(last_month.year, last_month.month)[1])

    def month_date(self, month_index):
        """month_index 1-12 (position in this forecast's window, NOT calendar month) ->
        actual calendar date (day=1) for that slot."""
        from dateutil.relativedelta import relativedelta
        return self.period_start + relativedelta(months=month_index - 1)

    def __repr__(self):
        return f'<ForecastHeader {self.period_start}>'


class ForecastLine(db.Model):
    """1 row per product per ForecastHeader. Rombak putaran 6 (2026-08-25, keputusan
    manajemen - grid rolling + bisa geser lihat histori): qty_m1..qty_m12 (12 kolom
    tetap terikat ke header.period_start) DIHAPUS, diganti child table ForecastLineMonth
    (1 baris per bulan KALENDER asli, sparse, tidak dibatasi 12 bulan). Ini yang bikin
    grid bisa "rolling" (selalu bisa query bulan berjalan + 11 ke depan) SEKALIGUS bisa
    digeser mundur lihat histori (query bulan berapa saja, tidak cuma window awal).
    best_case/most_likely/worst_case/committed sudah lama non-aktif dari sebelum rombak
    ini, ikut dihapus sekalian (tidak pernah dipakai UI matrix)."""
    __tablename__ = 'forecast_lines'

    id = db.Column(db.Integer, primary_key=True)
    header_id = db.Column(db.Integer, db.ForeignKey('forecast_headers.id', ondelete='CASCADE'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = db.relationship('Product')
    conversions = db.relationship('ForecastLineConversion', backref='line', cascade='all, delete-orphan', lazy='selectin')
    months = db.relationship('ForecastLineMonth', backref='line', cascade='all, delete-orphan', lazy='selectin')

    __table_args__ = (
        db.UniqueConstraint('header_id', 'product_id', name='uq_forecast_line_header_product'),
    )

    def __repr__(self):
        return f'<ForecastLine header={self.header_id} product={self.product_id}>'


class ForecastLineMonth(db.Model):
    """1 baris per (ForecastLine, bulan kalender asli) - sparse, dibuat baru putaran 6.
    `period` SELALU tanggal 1 bulan kalender itu (bukan slot 1-12 relatif ke header lagi)
    - inilah yang memungkinkan grid rolling (query period >= bulan-ini) dan digeser bebas
    ke bulan manapun buat lihat histori, tidak terikat ke window 12 bulan tetap."""
    __tablename__ = 'forecast_line_months'

    id = db.Column(db.Integer, primary_key=True)
    line_id = db.Column(db.Integer, db.ForeignKey('forecast_lines.id', ondelete='CASCADE'), nullable=False)
    period = db.Column(db.Date, nullable=False)  # selalu day=1
    quantity = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    # "Grid forecast harus hidup" (masukan user 2026-08-26): diisi timestamp saat qty sel ini
    # dinaikkan OTOMATIS oleh _bump_forecast_for_so_item() (utils/sales_order_workflow.py)
    # karena demand SO riil melampaui target - dikosongkan lagi (None) begitu user edit manual
    # cell ini (lihat update_forecast_line di routes/sales.py), supaya keterangan "otomatis"
    # ini akurat, bukan nempel selamanya.
    so_bumped_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('line_id', 'period', name='uq_forecast_line_month_line_period'),
    )

    def __repr__(self):
        return f'<ForecastLineMonth line={self.line_id} period={self.period}>'


class ForecastLineConversion(db.Model):
    """Tracks which (line, month) cells have been converted to a real Sales Order - a small
    sparse child table (§5) instead of 12 more wide columns, since most cells are never
    converted.

    2026-08-24 (tracking realisasi): no longer unique per (line, month) - a cell can be
    converted MULTIPLE times over time (partial realizations, e.g. 12,000 now + more
    later against the same forecasted 15,000), each row here is 1 realization slice with
    its own `quantity`. converted_qty for a cell = SUM(quantity) over all its rows."""
    __tablename__ = 'forecast_line_conversions'

    id = db.Column(db.Integer, primary_key=True)
    line_id = db.Column(db.Integer, db.ForeignKey('forecast_lines.id', ondelete='CASCADE'), nullable=False)
    # 2026-08-25 (rombak putaran 6): `month` (slot 1-12 relatif ke header.period_start)
    # diganti `period` (Date, bulan kalender ASLI) - grid sekarang rolling/bisa digeser,
    # jadi realisasi harus tertaut ke bulan kalender nyata, bukan slot posisi lagi.
    period = db.Column(db.Date, nullable=False)  # selalu day=1
    quantity = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    # 2026-08-25 (rombak putaran 5, keputusan manajemen): forecast di-convert jadi Work
    # Order (produksi build-ahead), BUKAN Sales Order lagi - forecast itu agregat semua
    # customer, sedangkan SO/customer riil baru muncul dari Manual/Quotation dan itu yang
    # reserve stok FG-nya berdasarkan tanggal kirim. sales_order_id dipertahankan
    # nullable (baris LAMA dari sebelum rombak ini masih tertaut ke SO).
    # 2026-08-26 (rombak putaran 7, keputusan manajemen): forecast TIDAK lagi langsung
    # jadi Work Order - dikirim ke Monthly Schedule (routes/schedule_grid.py) dulu supaya
    # PPIC review & pecah ke Weekly Planning sebelum WO beneran terbit (WorkOrder/Monthly
    # Schedule/Weekly Planning/Batch Planning jadi 1 alur nyambung, bukan lompat langsung).
    # work_order_id dipertahankan nullable (baris LAMA putaran 5 masih tertaut ke WO
    # langsung) - baris BARU pakai monthly_schedule_id. Tepat 1 dari ketiganya harus
    # terisi (lihat CheckConstraint).
    sales_order_id = db.Column(db.Integer, db.ForeignKey('sales_orders.id'), nullable=True)
    work_order_id = db.Column(db.Integer, db.ForeignKey('work_orders.id'), nullable=True)
    monthly_schedule_id = db.Column(db.Integer, db.ForeignKey('monthly_schedules.id'), nullable=True)
    converted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    converted_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    sales_order = db.relationship('SalesOrder')
    work_order = db.relationship('WorkOrder')
    monthly_schedule = db.relationship('MonthlySchedule')
    converted_by_user = db.relationship('User')

    __table_args__ = (
        db.CheckConstraint(
            '(CASE WHEN sales_order_id IS NOT NULL THEN 1 ELSE 0 END + '
            'CASE WHEN work_order_id IS NOT NULL THEN 1 ELSE 0 END + '
            'CASE WHEN monthly_schedule_id IS NOT NULL THEN 1 ELSE 0 END) = 1',
            name='check_forecast_conversion_so_or_wo'
        ),
    )

    def __repr__(self):
        return f'<ForecastLineConversion line={self.line_id} month={self.month}>'


class CustomerDeposit(db.Model):
    """
    Customer uang muka (down payment) - stored as a free-floating balance per
    customer, not tied to a specific Sales Order, per Bayu's 2026-08-16
    decision. Money in (this row) posts as a liability (akun_uang_muka_
    pelanggan_id credit) until consumed by an invoice.
    """
    __tablename__ = 'customer_deposits'

    id = db.Column(db.Integer, primary_key=True)
    deposit_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False, index=True)
    deposit_date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    amount_used = db.Column(db.Numeric(15, 2), nullable=False, default=0)
    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customer = db.relationship('Customer')

    @property
    def amount_available(self):
        return float(self.amount) - float(self.amount_used)


class CustomerDepositUsage(db.Model):
    """
    Tracks how much of a given CustomerDeposit was applied to a given
    Invoice - a many-to-many join with the amount applied, since one
    deposit can be split across multiple invoices and one invoice could
    theoretically draw from multiple deposits (oldest-first, see
    apply_customer_deposit() in finance_helpers.py).
    """
    __tablename__ = 'customer_deposit_usages'

    id = db.Column(db.Integer, primary_key=True)
    deposit_id = db.Column(db.Integer, db.ForeignKey('customer_deposits.id'), nullable=False, index=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False, index=True)
    amount_applied = db.Column(db.Numeric(15, 2), nullable=False)
    applied_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    deposit = db.relationship('CustomerDeposit')


# ===============================
# SD GAP-CLOSING: PRICING PROCEDURE + CUSTOMER-MATERIAL INFO RECORD (2026-09-14)
# ===============================

class PricingCondition(db.Model):
    """Pricing Procedure (SAP SD concept) - a simplified condition-type stack replacing
    the flat unit_price/discount/tax fields SalesOrderItem has today. Real SAP uses
    access sequences + condition tables; this is a scoped-and-ordered equivalent:
    every active condition whose scope matches (customer/product/both/all) and whose
    validity window covers "now" applies, in `sequence` order, on top of a running
    price that starts from Product.price (or CustomerMaterialInfo.special_price if one
    exists for that customer+product - see utils/pricing_procedure.py). Not persisted
    onto SalesOrderItem directly - the /sales/pricing/calculate endpoint returns a
    breakdown the frontend uses to fill the EXISTING unit_price/discount_percent/
    tax_percent fields, so nothing about SalesOrderItem's schema or other readers of
    it needs to change."""
    __tablename__ = 'pricing_conditions'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    condition_type = db.Column(db.String(20), nullable=False)  # discount, surcharge, tax
    calculation_type = db.Column(db.String(20), nullable=False, default='percentage')  # percentage, fixed_amount
    value = db.Column(db.Numeric(10, 4), nullable=False)
    sequence = db.Column(db.Integer, nullable=False, default=10)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)  # NULL = applies to all customers
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)  # NULL = applies to all products
    valid_from = db.Column(db.Date, nullable=True)
    valid_to = db.Column(db.Date, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customer = db.relationship('Customer')
    product = db.relationship('Product')

    def __repr__(self):
        return f'<PricingCondition {self.name} ({self.condition_type})>'


class CustomerMaterialInfo(db.Model):
    """Customer-Material Info Record (SAP SD concept) - customer-specific data for a
    given product: their own article/SKU code for it, a negotiated special price
    (takes priority over Product.price as the pricing-procedure base, see
    utils/pricing_procedure.py), minimum order quantity, and a delivery lead-time
    override. Added 2026-09-14 - Sales already has real live usage (unlike
    Purchasing), so this is read-only informational + a soft MOQ warning, never a
    hard block, at Sales Order entry time."""
    __tablename__ = 'customer_material_info'

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    customer_material_code = db.Column(db.String(100), nullable=True)
    special_price = db.Column(db.Numeric(15, 2), nullable=True)
    min_order_qty = db.Column(db.Numeric(15, 2), nullable=True)
    lead_time_days = db.Column(db.Integer, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customer = db.relationship('Customer')
    product = db.relationship('Product')

    __table_args__ = (
        db.UniqueConstraint('customer_id', 'product_id', name='unique_customer_material_info'),
    )

    def __repr__(self):
        return f'<CustomerMaterialInfo customer={self.customer_id} product={self.product_id}>'
