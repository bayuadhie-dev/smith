"""
Per-user table column preferences (2026-09-21).

Generic "field catalog" persistence - which columns are visible and in what
order, for a given table/view, saved per user so it follows them across
devices. Keyed by an arbitrary view_key string (e.g. 'wms_transactions')
so the same mechanism can back a field catalog on any dense table in the
app later, not just Transaksi Stok.
"""
from datetime import datetime
from models import db
from sqlalchemy.dialects.postgresql import JSON


class UserTablePreference(db.Model):
    __tablename__ = 'user_table_preferences'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'view_key', name='uq_user_table_pref_user_view'),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    view_key = db.Column(db.String(100), nullable=False, index=True)

    # Ordered list of field keys the user wants visible, e.g.
    # ['transaction_number', 'movement_type_code', 'quantity', ...].
    # Order in the array IS the display order.
    visible_columns = db.Column(JSON, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'view_key': self.view_key,
            'visible_columns': self.visible_columns,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
