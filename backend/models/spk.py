from datetime import datetime
from . import db


class SPKWarehouseStageLog(db.Model):
    """
    Native replacement for Accurate EJO's processHistory (MS/FGS stages).
    Dedicated table, independent of InventoryMovement/WarehouseLocation -
    records only the two SPK-relevant warehouse stage events (EPD/FG),
    auto-inserted by the existing shift-input flow (see
    routes/production.py::create_work_order_production_record).
    """
    __tablename__ = 'spk_warehouse_stage_log'

    id = db.Column(db.Integer, primary_key=True)
    work_order_id = db.Column(db.Integer, db.ForeignKey('work_orders.id', ondelete='CASCADE'), nullable=False, index=True)
    stage = db.Column(db.String(10), nullable=False)  # 'epd' or 'fg'
    quantity = db.Column(db.Numeric(15, 2), nullable=False)
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    source_type = db.Column(db.String(20), nullable=False)  # 'shift_input' or 'packing_list'
    source_id = db.Column(db.Integer, nullable=True)  # ProductionRecord.id or PackingList.id
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    work_order = db.relationship('WorkOrder')

    __table_args__ = (
        db.Index('idx_spk_stage_wo', 'work_order_id', 'stage'),
    )
