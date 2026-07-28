"""
EWS (Early Warning System) — Model prediksi risiko downtime shift produksi.
"""
from datetime import datetime
from . import db


class EWSPrediction(db.Model):
    __tablename__ = 'ews_predictions'

    id = db.Column(db.Integer, primary_key=True)
    shift_production_id = db.Column(
        db.Integer,
        db.ForeignKey('shift_productions.id'),
        nullable=False,
        unique=True,  # satu shift cuma boleh punya satu prediksi (re-score = update, bukan duplikat)
        index=True
    )
    prob_bahaya = db.Column(db.Numeric(5, 4), nullable=False)  # 0.0000 - 1.0000
    status_ews = db.Column(db.String(20), nullable=False)  # 'AMAN' atau 'BAHAYA'
    prob_threshold_used = db.Column(db.Numeric(5, 4), nullable=False)  # threshold yang dipakai saat scoring
    model_version = db.Column(db.String(50), nullable=True)  # untuk tracking kalau model diretrain
    scored_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    shift_production = db.relationship('ShiftProduction', backref=db.backref('ews_prediction', uselist=False))

    def __repr__(self):
        return f'<EWSPrediction shift={self.shift_production_id} status={self.status_ews} prob={self.prob_bahaya}>'

    def to_dict(self):
        return {
            'id': self.id,
            'shift_production_id': self.shift_production_id,
            'prob_bahaya': float(self.prob_bahaya) if self.prob_bahaya is not None else None,
            'status_ews': self.status_ews,
            'prob_threshold_used': float(self.prob_threshold_used) if self.prob_threshold_used is not None else None,
            'model_version': self.model_version,
            'scored_at': self.scored_at.isoformat() if self.scored_at else None,
        }
