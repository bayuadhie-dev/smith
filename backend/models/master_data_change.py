"""
Master Data Change Order (2026-09-21)

Tracks every change made to Product/Material master data fields with a
change number, requester, and an effective date - so a change made today
can be scheduled to take effect on a future date (old values stay live
until then), and EVERY change (immediate or scheduled) leaves a record of
exactly what changed.

Design note: Product/Material live columns remain the single source of
truth every other part of this ~458K-line codebase already reads directly -
retrofitting every read site to resolve "value as of today" from a
separate versioned table was ruled out as impractical at this scale (see
plan.md's master-data-change section). Instead: a pending change sits here
until its effective_date arrives, then a daily cron applies it by writing
directly into the live Product/Material row - the same "apply queued change
via cron" shape already used for exchange rate sync
(routes/finance.py:sync_exchange_rates_cron).

Follows the same header + JSON-lines shape as PendingJournalEntry
(models/approval_workflow.py) rather than a second child table - one
change_number can bundle several field changes submitted together.
"""
from datetime import datetime
from models import db
from sqlalchemy.dialects.postgresql import JSON


class MasterDataChangeOrder(db.Model):
    __tablename__ = 'master_data_change_orders'

    id = db.Column(db.Integer, primary_key=True)
    change_number = db.Column(db.String(50), unique=True, nullable=False, index=True)

    entity_type = db.Column(db.String(20), nullable=False, index=True)  # 'product' | 'material'
    entity_id = db.Column(db.Integer, nullable=False, index=True)
    # No FK constraint - entity_type decides which table entity_id points
    # into (products.id or materials.id), same polymorphic-by-string
    # pattern already used throughout this app for reference_type/
    # reference_id (InventoryTransaction, AccountingEntry, etc).

    # Changes = [{field_name, field_label, old_value, new_value}, ...].
    # Values stored as JSON-safe strings (None/number/bool/str) - applied
    # back with type casting from the live SQLAlchemy column type, not
    # trusted as already-correct Python types (see
    # utils/master_data_change_helper.py:_cast_value).
    changes = db.Column(JSON, nullable=False)

    effective_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='pending')
    # pending, applied, cancelled

    reason = db.Column(db.Text, nullable=True)

    requested_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    requested_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    applied_at = db.Column(db.DateTime, nullable=True)
    applied_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    # applied_by is null when a change was applied by the daily cron rather
    # than a synchronous request (immediate/effective_date<=today changes
    # are applied by requested_by in the same request instead).
    cancelled_at = db.Column(db.DateTime, nullable=True)
    cancelled_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    requested_by_user = db.relationship('User', foreign_keys=[requested_by])
    applied_by_user = db.relationship('User', foreign_keys=[applied_by])
    cancelled_by_user = db.relationship('User', foreign_keys=[cancelled_by])

    def to_dict(self):
        return {
            'id': self.id,
            'change_number': self.change_number,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'changes': self.changes,
            'effective_date': self.effective_date.isoformat() if self.effective_date else None,
            'status': self.status,
            'reason': self.reason,
            'requested_by': self.requested_by_user.full_name if self.requested_by_user else None,
            'requested_at': self.requested_at.isoformat() if self.requested_at else None,
            'applied_at': self.applied_at.isoformat() if self.applied_at else None,
            'applied_by': self.applied_by_user.full_name if self.applied_by_user else ('Sistem (terjadwal)' if self.status == 'applied' and not self.applied_by else None),
            'cancelled_at': self.cancelled_at.isoformat() if self.cancelled_at else None,
            'cancelled_by': self.cancelled_by_user.full_name if self.cancelled_by_user else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
