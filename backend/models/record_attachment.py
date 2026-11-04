from datetime import datetime
from . import db


class RecordAttachment(db.Model):
    """Lampiran dokumen/foto generik untuk semua transaksi (entity_type + entity_id)."""
    __tablename__ = 'record_attachments'

    id = db.Column(db.Integer, primary_key=True)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.Integer, nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    stored_name = db.Column(db.String(255), nullable=False)
    mime_type = db.Column(db.String(100))
    file_size = db.Column(db.Integer)
    description = db.Column(db.String(255))
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (db.Index('ix_record_attachments_entity', 'entity_type', 'entity_id'),)

    def to_dict(self):
        return {'id': self.id, 'entity_type': self.entity_type, 'entity_id': self.entity_id,
                'filename': self.filename, 'mime_type': self.mime_type, 'file_size': self.file_size,
                'description': self.description, 'uploaded_by': self.uploaded_by,
                'created_at': self.created_at.isoformat() if self.created_at else None}
