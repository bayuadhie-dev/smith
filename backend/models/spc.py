from datetime import datetime
from . import db


class SPCParameter(db.Model):
    """
    Parameter yang dikontrol secara statistik per produk.
    Contoh: GSM, CD, MD, pH, Thickness, Moisture
    """
    __tablename__ = 'spc_parameters'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)

    # Unit of measurement
    uom = db.Column(db.String(50), nullable=True)  # gsm, mm, pH, %, N/5cm

    # Parameter category
    parameter_type = db.Column(db.String(50), nullable=False, default='variable')
    # variable = X-bar R chart (continuous measurement)
    # attribute = P-chart / NP-chart (defect count)

    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    product_specs = db.relationship('SPCProductSpec', back_populates='parameter', cascade='all, delete-orphan')
    measurements = db.relationship('SPCMeasurement', back_populates='parameter')

    def __repr__(self):
        return f'<SPCParameter {self.code} - {self.name}>'


class SPCProductSpec(db.Model):
    """
    Spesifikasi batas kontrol SPC per produk per parameter.
    UCL/LCL dihitung dari data historis atau ditetapkan manual.
    """
    __tablename__ = 'spc_product_specs'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    parameter_id = db.Column(db.Integer, db.ForeignKey('spc_parameters.id'), nullable=False)

    # Target / Nominal value
    target_value = db.Column(db.Numeric(15, 4), nullable=True)

    # Specification limits (dari customer / internal standard)
    usl = db.Column(db.Numeric(15, 4), nullable=True)  # Upper Specification Limit
    lsl = db.Column(db.Numeric(15, 4), nullable=True)  # Lower Specification Limit

    # Control limits (dihitung secara statistik, bisa di-override manual)
    ucl = db.Column(db.Numeric(15, 4), nullable=True)  # Upper Control Limit
    lcl = db.Column(db.Numeric(15, 4), nullable=True)  # Lower Control Limit
    ucl_r = db.Column(db.Numeric(15, 4), nullable=True)  # UCL untuk R-chart
    lcl_r = db.Column(db.Numeric(15, 4), nullable=True)  # LCL untuk R-chart (biasanya 0)

    # Subgroup size (n) untuk X-bar R chart
    subgroup_size = db.Column(db.Integer, default=5, nullable=False)

    # Flag apakah control limits dihitung otomatis atau manual
    auto_calculate = db.Column(db.Boolean, default=True, nullable=False)

    # Jumlah subgroup minimum sebelum control limits dihitung
    min_subgroups = db.Column(db.Integer, default=25, nullable=False)

    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    product = db.relationship('Product')
    parameter = db.relationship('SPCParameter', back_populates='product_specs')

    __table_args__ = (
        db.UniqueConstraint('product_id', 'parameter_id', name='unique_product_parameter'),
    )

    def __repr__(self):
        return f'<SPCProductSpec product={self.product_id} param={self.parameter_id}>'


class SPCSample(db.Model):
    """
    Subgroup sample yang diambil QC di lantai produksi.
    Satu sample = satu subgroup yang berisi beberapa measurement.
    """
    __tablename__ = 'spc_samples'

    id = db.Column(db.Integer, primary_key=True)
    sample_number = db.Column(db.String(100), unique=True, nullable=False, index=True)

    # Link ke produksi
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    work_order_id = db.Column(db.Integer, db.ForeignKey('work_orders.id'), nullable=True)
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=True)
    shift = db.Column(db.String(20), nullable=True)  # shift_1, shift_2, shift_3
    sub_shift = db.Column(db.String(5), nullable=True)  # a, b, c

    # Waktu pengambilan sample
    sample_date = db.Column(db.Date, nullable=False)
    sample_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # Jumlah unit dalam subgroup
    subgroup_size = db.Column(db.Integer, default=5, nullable=False)

    # Untuk P-chart: jumlah defect dan total inspected
    total_inspected = db.Column(db.Integer, nullable=True)
    total_defective = db.Column(db.Integer, nullable=True)

    notes = db.Column(db.Text, nullable=True)
    sampled_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    product = db.relationship('Product')
    work_order = db.relationship('WorkOrder')
    machine = db.relationship('Machine')
    sampled_by_user = db.relationship('User', foreign_keys=[sampled_by])
    measurements = db.relationship('SPCMeasurement', back_populates='sample', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<SPCSample {self.sample_number}>'


class SPCMeasurement(db.Model):
    """
    Nilai aktual pengukuran per parameter per sample.
    Satu sample bisa punya banyak measurement (tiap parameter).
    Tiap measurement punya beberapa readings (subgroup).
    """
    __tablename__ = 'spc_measurements'

    id = db.Column(db.Integer, primary_key=True)
    sample_id = db.Column(db.Integer, db.ForeignKey('spc_samples.id'), nullable=False)
    parameter_id = db.Column(db.Integer, db.ForeignKey('spc_parameters.id'), nullable=False)

    # Readings individual dalam subgroup (disimpan sebagai JSON array)
    # Contoh: [12.1, 12.3, 11.9, 12.0, 12.2] untuk n=5
    readings = db.Column(db.Text, nullable=False)  # JSON array of float

    # Kalkulasi statistik (dihitung saat input, disimpan untuk performa)
    xbar = db.Column(db.Numeric(15, 4), nullable=True)   # Mean of subgroup
    r_value = db.Column(db.Numeric(15, 4), nullable=True)  # Range of subgroup
    s_value = db.Column(db.Numeric(15, 4), nullable=True)  # Std dev of subgroup

    # Flag out of control
    is_out_of_control = db.Column(db.Boolean, default=False, nullable=False)
    violation_rules = db.Column(db.Text, nullable=True)  # JSON list of violated rules (Western Electric)

    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    sample = db.relationship('SPCSample', back_populates='measurements')
    parameter = db.relationship('SPCParameter', back_populates='measurements')

    __table_args__ = (
        db.UniqueConstraint('sample_id', 'parameter_id', name='unique_sample_parameter'),
    )

    def __repr__(self):
        return f'<SPCMeasurement sample={self.sample_id} param={self.parameter_id}>'


class SPCControlLimitHistory(db.Model):
    """
    Histori perubahan control limits per produk per parameter.
    Penting untuk audit trail dan melihat tren improvement.
    """
    __tablename__ = 'spc_control_limit_history'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    parameter_id = db.Column(db.Integer, db.ForeignKey('spc_parameters.id'), nullable=False)

    # Control limits pada periode ini
    ucl = db.Column(db.Numeric(15, 4), nullable=True)
    lcl = db.Column(db.Numeric(15, 4), nullable=True)
    ucl_r = db.Column(db.Numeric(15, 4), nullable=True)
    lcl_r = db.Column(db.Numeric(15, 4), nullable=True)
    xbar_bar = db.Column(db.Numeric(15, 4), nullable=True)  # Grand mean
    r_bar = db.Column(db.Numeric(15, 4), nullable=True)     # Average range

    # Capability indices
    cp = db.Column(db.Numeric(10, 4), nullable=True)   # Process Capability
    cpk = db.Column(db.Numeric(10, 4), nullable=True)  # Process Capability Index
    pp = db.Column(db.Numeric(10, 4), nullable=True)   # Process Performance
    ppk = db.Column(db.Numeric(10, 4), nullable=True)  # Process Performance Index

    # Jumlah subgroup yang digunakan untuk kalkulasi
    subgroups_used = db.Column(db.Integer, nullable=True)

    effective_from = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    effective_to = db.Column(db.DateTime, nullable=True)  # NULL = masih berlaku

    calculated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    product = db.relationship('Product')
    parameter = db.relationship('SPCParameter')
    calculated_by_user = db.relationship('User', foreign_keys=[calculated_by])

    def __repr__(self):
        return f'<SPCControlLimitHistory product={self.product_id} param={self.parameter_id}>'
