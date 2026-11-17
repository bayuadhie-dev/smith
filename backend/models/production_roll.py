from datetime import datetime

from . import db


class ProductionRoll(db.Model):
    """Roll keluaran spunlace: main roll dari mesin, dan jumbo roll hasil sliting.

    Nomor roll ditulis operator di lapangan dengan satu deret 1-10000 lalu berulang
    dari 1 lagi, jadi nomor saja tidak unik. Yang membedakan adalah jenis kainnya
    dan putaran keberapa deret itu berjalan (`cycle`) - keduanya disimpan supaya
    roll nomor 500 hari ini tidak tertukar dengan roll nomor 500 putaran berikutnya,
    sementara yang tampil di layar dan surat jalan tetap nomor apa adanya.

    Jumbo roll hasil sliting memakai nomor main roll-nya ditambah nomor repeat, dan
    tetap menyimpan tautan ke main roll induknya (`parent_roll_id`).
    """
    __tablename__ = 'production_rolls'

    id = db.Column(db.Integer, primary_key=True)
    roll_number = db.Column(db.Integer, nullable=False, index=True)      # 1..10000, ditulis operator
    cycle = db.Column(db.Integer, nullable=False, default=1)             # putaran deret nomor
    repeat_number = db.Column(db.Integer, nullable=True)                 # urutan potongan jumbo roll dari satu main roll
    roll_type = db.Column(db.String(10), nullable=False, default='main')  # main, jumbo
    parent_roll_id = db.Column(db.Integer, db.ForeignKey('production_rolls.id'), nullable=True)

    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False, index=True)
    work_order_id = db.Column(db.Integer, db.ForeignKey('work_orders.id'), nullable=True)
    machine_id = db.Column(db.Integer, db.ForeignKey('machines.id'), nullable=True)

    produced_at = db.Column(db.Date, nullable=False, index=True)
    shift = db.Column(db.String(20), nullable=True)

    gross_weight_kg = db.Column(db.Numeric(12, 2), nullable=False)       # berat total termasuk cone
    net_weight_kg = db.Column(db.Numeric(12, 2), nullable=False)         # berat kain, diisi sendiri (bukan hitungan sistem)
    length_m = db.Column(db.Numeric(12, 2), nullable=True)
    width_cm = db.Column(db.Numeric(10, 2), nullable=True)
    grade = db.Column(db.String(1), nullable=False, default='A')         # A bagus, B perlu sortir, C reject

    batch_number = db.Column(db.String(50), nullable=True)   # nomor batch roll ini di stok
    status = db.Column(db.String(20), nullable=False, default='available', index=True)  # available, consumed, shipped, cancelled
    notes = db.Column(db.Text, nullable=True)

    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    product = db.relationship('Product')
    work_order = db.relationship('WorkOrder')
    machine = db.relationship('Machine')
    parent = db.relationship('ProductionRoll', remote_side=[id], backref='children')
    creator = db.relationship('User')

    @property
    def display_number(self):
        """Nomor seperti yang ditulis di lapangan; jumbo roll memakai akhiran repeat."""
        return f'{self.roll_number}-{self.repeat_number}' if self.repeat_number else str(self.roll_number)

    def to_dict(self):
        return {
            'id': self.id,
            'roll_number': self.roll_number,
            'display_number': self.display_number,
            'cycle': self.cycle,
            'repeat_number': self.repeat_number,
            'roll_type': self.roll_type,
            'parent_roll_id': self.parent_roll_id,
            'parent_number': self.parent.display_number if self.parent else None,
            'product_id': self.product_id,
            'product_code': self.product.code if self.product else None,
            'product_name': self.product.name if self.product else None,
            'work_order_id': self.work_order_id,
            'work_order_number': self.work_order.wo_number if self.work_order else None,
            'machine_id': self.machine_id,
            'machine_name': self.machine.name if self.machine else None,
            'produced_at': self.produced_at.isoformat() if self.produced_at else None,
            'shift': self.shift,
            'gross_weight_kg': float(self.gross_weight_kg or 0),
            'net_weight_kg': float(self.net_weight_kg or 0),
            'length_m': float(self.length_m) if self.length_m is not None else None,
            'width_cm': float(self.width_cm) if self.width_cm is not None else None,
            'grade': self.grade,
            'batch_number': self.batch_number,
            'status': self.status,
            'notes': self.notes,
            'created_by_name': self.creator.full_name if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
