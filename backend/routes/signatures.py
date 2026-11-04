import base64
import os
import re
import secrets

from flask import Blueprint, jsonify, request, Response
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db, User, UserSignature
from utils.signatures import MAX_BYTES, detect_mime, sig_root

signatures_bp = Blueprint('signatures', __name__)


def _me():
    return db.session.get(User, int(get_jwt_identity()))


def _path(row):
    return os.path.join(sig_root(), os.path.basename(row.file_path))


def _can_see(viewer, target_id):
    return viewer is not None and (viewer.id == target_id or getattr(viewer, 'is_super_admin', False))


@signatures_bp.route('/me', methods=['GET'])
@jwt_required()
def my_signature():
    row = UserSignature.query.filter_by(user_id=_me().id).first()
    return jsonify({'has_signature': bool(row), 'updated_at': row.updated_at.isoformat() if row and row.updated_at else None}), 200


@signatures_bp.route('/me/image', methods=['GET'])
@jwt_required()
def my_signature_image():
    return signature_image(_me().id)


@signatures_bp.route('/<int:uid>/image', methods=['GET'])
@jwt_required()
def signature_image(uid):
    if not _can_see(_me(), uid):
        return jsonify({'error': 'Tidak diizinkan'}), 403
    row = UserSignature.query.filter_by(user_id=uid).first()
    if not row or not os.path.exists(_path(row)):
        return jsonify({'error': 'Belum ada tanda tangan'}), 404
    with open(_path(row), 'rb') as f:
        return Response(f.read(), mimetype=row.mime_type, headers={'Cache-Control': 'private, no-store'})


@signatures_bp.route('/me', methods=['PUT', 'POST'])
@jwt_required()
def save_my_signature():
    """Body: multipart file 'file', atau JSON {image: 'data:image/png;base64,...'}. Hanya pemilik."""
    me = _me()
    data = None
    if request.files.get('file'):
        data = request.files['file'].read(MAX_BYTES + 1)
    else:
        raw = (request.get_json(silent=True) or {}).get('image') or ''
        m = re.match(r'^data:image/(png|jpeg);base64,(.+)$', raw, re.S)
        if m:
            try:
                data = base64.b64decode(m.group(2), validate=False)
            except Exception:
                data = None
    if not data:
        return jsonify({'error': 'Gambar tanda tangan tidak ditemukan'}), 400
    if len(data) > MAX_BYTES:
        return jsonify({'error': 'Ukuran gambar maksimal 1 MB'}), 400
    mime = detect_mime(data)
    if not mime:
        return jsonify({'error': 'Format harus PNG atau JPEG'}), 400
    os.makedirs(sig_root(), exist_ok=True)
    row = UserSignature.query.filter_by(user_id=me.id).first()
    name = secrets.token_hex(16) + ('.png' if mime == 'image/png' else '.jpg')
    with open(os.path.join(sig_root(), name), 'wb') as f:
        f.write(data)
    old = None
    if row:
        old = _path(row)
        row.file_path, row.mime_type = name, mime
    else:
        db.session.add(UserSignature(user_id=me.id, file_path=name, mime_type=mime))
    db.session.commit()
    if old and os.path.exists(old):
        try:
            os.remove(old)
        except OSError:
            pass
    return jsonify({'message': 'Tanda tangan disimpan'}), 200


@signatures_bp.route('/me', methods=['DELETE'])
@jwt_required()
def delete_my_signature():
    row = UserSignature.query.filter_by(user_id=_me().id).first()
    if not row:
        return jsonify({'message': 'Tidak ada tanda tangan'}), 200
    p = _path(row)
    db.session.delete(row)
    db.session.commit()
    if os.path.exists(p):
        try:
            os.remove(p)
        except OSError:
            pass
    return jsonify({'message': 'Tanda tangan dihapus'}), 200
