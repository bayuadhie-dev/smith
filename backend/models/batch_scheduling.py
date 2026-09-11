from datetime import datetime
from . import db


class ProductionRecipe(db.Model):
    """Master data: product+machine combination -> batch size and rate.
    Duration of 1 batch = batch_size / rate_per_hour, computed, not stored (R3)."""
    __tablename__ = 'production_recipes'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=False)
    batch_size = db.Column(db.Numeric(15, 2), nullable=False)
    rate_per_hour = db.Column(db.Numeric(15, 2), nullable=False)
    is_default = db.Column(db.Boolean, default=False, nullable=False)  # 1 per product, UI hint only - not used by the allocation algorithm (machine already chosen manually via ProductionPlan.machine_id)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = db.relationship('Product')
    machine = db.relationship('Machine')
    created_by_user = db.relationship('User')

    # No unique constraint on (product_id, machine_id) - a product can have multiple
    # recipes on the same machine (e.g. different batch_size/rate variants), and a
    # product isn't tied to one machine. When several active recipes match the same
    # product+machine, run_generate_replan() picks is_default first, else the newest.

    def __repr__(self):
        return f'<ProductionRecipe product={self.product_id} machine={self.machine_id}>'


class GlobalCalendar(db.Model):
    """Baseline weekly working pattern for the whole factory - fixed 7 rows (day_of_week 0-6)."""
    __tablename__ = 'global_calendars'

    id = db.Column(db.Integer, primary_key=True)
    day_of_week = db.Column(db.Integer, nullable=False, unique=True)  # 0=Senin ... 6=Minggu
    is_working_day = db.Column(db.Boolean, default=True, nullable=False)
    shift_count = db.Column(db.Integer, default=0, nullable=False)
    shift_duration_hours = db.Column(db.Numeric(5, 2), nullable=True)  # uniform for all shifts that day (R4a)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<GlobalCalendar day={self.day_of_week}>'


class ExceptionCalendar(db.Model):
    """Factory-wide date override (e.g. national holiday). Beats GlobalCalendar, loses to MachineCalendarOverride."""
    __tablename__ = 'exception_calendars'

    id = db.Column(db.Integer, primary_key=True)
    exception_date = db.Column(db.Date, nullable=False, unique=True)
    is_working_day = db.Column(db.Boolean, default=False, nullable=False)
    shift_count = db.Column(db.Integer, nullable=True)  # null = follow Global if is_working_day True
    shift_duration_hours = db.Column(db.Numeric(5, 2), nullable=True)
    reason = db.Column(db.String(200), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    created_by_user = db.relationship('User')

    def __repr__(self):
        return f'<ExceptionCalendar {self.exception_date}>'


class MachineCalendarOverride(db.Model):
    """Per-machine, per-date override. Wins over ExceptionCalendar and GlobalCalendar (§4)."""
    __tablename__ = 'machine_calendar_overrides'

    id = db.Column(db.Integer, primary_key=True)
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=False)
    override_date = db.Column(db.Date, nullable=False)
    is_working_day = db.Column(db.Boolean, default=True, nullable=False)
    shift_count = db.Column(db.Integer, nullable=False)
    shift_duration_hours = db.Column(db.Numeric(5, 2), nullable=False)
    reason = db.Column(db.String(200), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    machine = db.relationship('Machine')
    created_by_user = db.relationship('User')

    __table_args__ = (
        db.UniqueConstraint('machine_id', 'override_date', name='uq_machine_calendar_override_machine_date'),
    )

    def __repr__(self):
        return f'<MachineCalendarOverride machine={self.machine_id} date={self.override_date}>'


class ProductionBatch(db.Model):
    """Core entity: a WorkOrder split into schedulable batches (§3.2, §5, §6, §7.1)."""
    __tablename__ = 'production_batches'

    id = db.Column(db.Integer, primary_key=True)
    batch_number = db.Column(db.String(50), unique=True, nullable=False, index=True)  # R8 format, auto-generated, editable anytime (R11)
    work_order_id = db.Column(db.Integer, db.ForeignKey('work_orders.id'), nullable=False)
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=False)
    recipe_id = db.Column(db.Integer, db.ForeignKey('production_recipes.id'), nullable=False)

    scheduled_date = db.Column(db.Date, nullable=True)  # start date; null when status='unplaceable'
    shift_number = db.Column(db.Integer, nullable=True)  # start shift
    sequence_in_shift = db.Column(db.Integer, nullable=True)  # order within (machine, scheduled_date, shift_number), reset per combination

    planned_qty = db.Column(db.Numeric(15, 2), nullable=False)
    realized_qty = db.Column(db.Numeric(15, 2), default=0, nullable=False)  # recomputed from SUM(ShiftProduction.actual_quantity)

    planned_start_datetime = db.Column(db.DateTime, nullable=True)
    planned_end_datetime = db.Column(db.DateTime, nullable=True)  # may span multiple shifts (R5/R9)

    status = db.Column(db.String(20), nullable=False, default='draft')  # draft, approved, in_progress, completed, cancelled, unplaceable
    is_over_capacity_warning = db.Column(db.Boolean, default=False, nullable=False)  # True when scheduled past the owning SO's required_date

    spk_document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=True)  # always points to the CURRENTLY valid SPK
    spk_is_outdated = db.Column(db.Boolean, default=False, nullable=False)  # R11: True once batch_number is edited after SPK was issued; False again once a new SPK is issued

    # "Tutup Batch" - administrative closing (actual material + waste +
    # packing confirmed), DISTINCT from status='completed' (which only means
    # production output is done). A WO's own "Tutup SPK" gate requires ALL
    # its batches to have admin_closed=True (see _check_closing_requirements).
    admin_closed = db.Column(db.Boolean, default=False, nullable=False)
    admin_closed_at = db.Column(db.DateTime, nullable=True)
    admin_closed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    work_order = db.relationship('WorkOrder')
    machine = db.relationship('Machine')
    recipe = db.relationship('ProductionRecipe')
    spk_document = db.relationship('Document', foreign_keys=[spk_document_id])
    approved_by_user = db.relationship('User', foreign_keys=[approved_by])
    created_by_user = db.relationship('User', foreign_keys=[created_by])
    shift_productions = db.relationship('ShiftProduction', back_populates='production_batch')

    def __repr__(self):
        return f'<ProductionBatch {self.batch_number}>'
