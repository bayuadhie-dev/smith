import time
from collections import defaultdict, deque

from flask import Blueprint, request, jsonify

from models import db
from models.approval_workflow import ApprovalWorkflow
from models.user import User
from utils import approval_email as ae
from utils.auth_decorators import _get_user_permissions

approval_email_bp = Blueprint('approval_email', __name__)

_hits = defaultdict(deque)
RATE_LIMIT = 30  # per menit per IP


def _limited():
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()
    now = time.time()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        return True
    q.append(now)
    return False


def _resolve(token):
    row, err = ae.find_token(token)
    if err:
        return None, None, None, err
    user = db.session.get(User, row.user_id)
    wf = db.session.get(ApprovalWorkflow, row.workflow_id)
    if not user or not user.is_active:
        return None, None, None, 'Akun penyetuju tidak aktif.'
    return row, user, wf, None


@approval_email_bp.route('/<token>', methods=['GET'])
def preview(token):
    """Hanya membaca: ringkasan dokumen. Tidak mengubah apa pun (aman dari pemindai email)."""
    if _limited():
        return jsonify({'error': 'Terlalu banyak permintaan, coba lagi sebentar.'}), 429
    row, user, wf, err = _resolve(token)
    if err:
        return jsonify({'error': err}), 400
    return jsonify({'step': row.step, 'approver': user.full_name or user.username,
                    'details': ae.workflow_details(wf)})


@approval_email_bp.route('/<token>', methods=['POST'])
def act(token):
    if _limited():
        return jsonify({'error': 'Terlalu banyak permintaan, coba lagi sebentar.'}), 429
    row, user, wf, err = _resolve(token)
    if err:
        return jsonify({'error': err}), 400
    body = request.get_json(silent=True) or {}
    action = body.get('action')
    if action not in ('approve', 'reject'):
        return jsonify({'error': 'Aksi tidak valid.'}), 400

    from routes.approval_workflow import review_core, approve_core, reject_core, user_can_act_on
    allowed, msg = user_can_act_on(user, wf, row.step)
    if not allowed:
        return jsonify({'error': msg}), 403
    needed = 'approval.reject' if action == 'reject' else 'approval.approve' if row.step == 'approval' else 'approval.view'
    if not getattr(user, 'is_super_admin', False) and needed not in _get_user_permissions(user):
        return jsonify({'error': 'Akun Anda tidak punya izin untuk aksi ini.'}), 403

    notes = (body.get('notes') or '').strip()
    if action == 'reject' and not notes:
        return jsonify({'error': 'Alasan penolakan wajib diisi.'}), 400
    via = ' [via email]'
    if action == 'reject':
        resp = reject_core(wf.id, user.id, {'reason': notes + via})
    elif row.step == 'review':
        resp = review_core(wf.id, user.id, {'notes': (notes + via).strip()})
    else:
        resp = approve_core(wf.id, user.id, {'notes': (notes + via).strip()})

    response, status = resp if isinstance(resp, tuple) else (resp, resp.status_code)
    if status == 200:
        ae.close_tokens(wf.id, row.step)
    return response, status
