import os
import re
import uuid

from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db
from models.record_attachment import RecordAttachment

record_attachments_bp = Blueprint('record_attachments', __name__)

MAX_SIZE = 10 * 1024 * 1024
ALLOWED_EXT = {'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'}


def _folder():
    base = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    path = os.path.join(base if os.path.isabs(base) else os.path.join(current_app.root_path, base), 'record_attachments')
    os.makedirs(path, exist_ok=True)
    return path


@record_attachments_bp.route('', methods=['GET'])
@jwt_required()
def list_attachments():
    et = request.args.get('entity_type', '')
    eid = request.args.get('entity_id', type=int)
    if not et or not eid:
        return jsonify({'error': 'entity_type dan entity_id wajib'}), 400
    rows = RecordAttachment.query.filter_by(entity_type=et, entity_id=eid).order_by(RecordAttachment.id.desc()).all()
    return jsonify({'attachments': [r.to_dict() for r in rows]})


@record_attachments_bp.route('', methods=['POST'])
@jwt_required()
def upload_attachment():
    et = (request.form.get('entity_type') or '').strip()
    eid = request.form.get('entity_id', type=int)
    f = request.files.get('file')
    if not et or not re.fullmatch(r'[a-z_]{1,50}', et) or not eid or not f:
        return jsonify({'error': 'entity_type, entity_id, dan file wajib'}), 400
    name = os.path.basename(f.filename or '')
    ext = name.rsplit('.', 1)[-1].lower() if '.' in name else ''
    if ext not in ALLOWED_EXT:
        return jsonify({'error': 'Tipe file tidak diizinkan (boleh: ' + ', '.join(sorted(ALLOWED_EXT)) + ')'}), 400
    data = f.read()
    if len(data) > MAX_SIZE:
        return jsonify({'error': 'Ukuran file maksimal 10 MB'}), 400
    stored = f'{uuid.uuid4().hex}.{ext}'
    with open(os.path.join(_folder(), stored), 'wb') as fh:
        fh.write(data)
    uid = get_jwt_identity()
    row = RecordAttachment(entity_type=et, entity_id=eid, filename=name, stored_name=stored,
                           mime_type=f.mimetype, file_size=len(data),
                           description=(request.form.get('description') or None),
                           uploaded_by=int(uid) if uid is not None and str(uid).isdigit() else None)
    db.session.add(row)
    db.session.commit()
    return jsonify(row.to_dict()), 201


@record_attachments_bp.route('/<int:att_id>/file', methods=['GET'])
@jwt_required()
def download_attachment(att_id):
    row = db.session.get(RecordAttachment, att_id)
    if not row:
        return jsonify({'error': 'Lampiran tidak ditemukan'}), 404
    path = os.path.join(_folder(), row.stored_name)
    if not os.path.isfile(path):
        return jsonify({'error': 'File tidak ada di server'}), 404
    return send_file(path, mimetype=row.mime_type, download_name=row.filename, as_attachment=request.args.get('download') == '1')


@record_attachments_bp.route('/<int:att_id>', methods=['DELETE'])
@jwt_required()
def delete_attachment(att_id):
    row = db.session.get(RecordAttachment, att_id)
    if not row:
        return jsonify({'error': 'Lampiran tidak ditemukan'}), 404
    try:
        os.remove(os.path.join(_folder(), row.stored_name))
    except OSError:
        pass
    db.session.delete(row)
    db.session.commit()
    return jsonify({'message': 'Lampiran dihapus'})
