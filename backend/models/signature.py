from datetime import datetime
from . import db


class UserSignature(db.Model):
    """Gambar tanda tangan milik satu pengguna (untuk dokumen cetak)."""
    __tablename__ = 'user_signatures'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    file_path = db.Column(db.String(300), nullable=False)
    mime_type = db.Column(db.String(30), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
