import json

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from models import db
from models.settings_extended import AuditLog

record_history_bp = Blueprint('record_history', __name__)


def _loads(v):
    try:
        return json.loads(v) if v else {}
    except (ValueError, TypeError):
        return {}


@record_history_bp.route('', methods=['GET'])
@jwt_required()
def get_history():
    table = (request.args.get('table') or '').strip()
    rid = request.args.get('id', type=int)
    if not table or not rid:
        return jsonify({'error': 'table dan id wajib'}), 400
    rows = AuditLog.query.filter(
        AuditLog.resource_type == table, AuditLog.resource_id == str(rid), AuditLog.action == 'update'
    ).order_by(AuditLog.timestamp.desc()).limit(200).all()
    out = []
    for r in rows:
        old, new = _loads(r.old_values), _loads(r.new_values)
        changes = [{'field': k, 'old': old.get(k), 'new': new.get(k)} for k in new.keys()
                   if k not in ('updated_at', 'modified_at')]
        if not changes:
            continue
        out.append({'id': r.id, 'timestamp': r.timestamp.isoformat() + 'Z' if r.timestamp else None,
                    'user': (r.user.full_name or r.user.username) if r.user else 'Sistem', 'changes': changes})
    created = AuditLog.query.filter(
        AuditLog.resource_type == table, AuditLog.resource_id == str(rid), AuditLog.action == 'create'
    ).order_by(AuditLog.timestamp.asc()).first()
    if created:
        out.append({'id': created.id, 'timestamp': created.timestamp.isoformat() + 'Z' if created.timestamp else None,
                    'user': (created.user.full_name or created.user.username) if created.user else 'Sistem',
                    'changes': [{'field': 'dibuat', 'old': None, 'new': 'Transaksi dibuat'}]})
    return jsonify({'history': out})
