"""
Document Control Center (DCC) & CAPA — API Routes
Sesuai Implementation Plan dcc.md

Sub-Modul:
  I.   Pengendalian Dokumen (QP-DCC-01) — FRM-DCC-01/02/04/05/10
  II.  Pengendalian Rekaman Mutu (QP-DCC-02) — FRM-DCC-03
  III. CAPA (QP-DCC-03, WI-DCC-02) — FRM-DCC-08/09/11
  IV.  Komunikasi Internal (QP-DCC-04) — FRM-DCC-07
  V.   Pemusnahan Dokumen (WI-DCC-01) — FRM-DCC-14
"""
from flask import Blueprint, request, jsonify, send_file, abort
from datetime import datetime, date, timedelta
from sqlalchemy import extract, func, or_
from models import db, User
from models.dcc import (
    DccDocument, DccDocumentRevision, DccDocumentDistribution,
    DccDocumentReview, DccChangeNotice, DccQualityRecord,
    CapaRequest, CapaInvestigation, CapaVerification, CapaMonthlyReport,
    InternalMemo, InternalMemoDistribution, DccDestructionLog
)
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import json

dcc_bp = Blueprint('dcc', __name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'dcc')
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _get_user_dcc_roles(user_id):
    """Get DCC-relevant roles for a user"""
    from models.user import UserRole, Role
    roles = db.session.query(Role.name).join(UserRole).filter(UserRole.user_id == user_id).all()
    return [r[0] for r in roles]


def _check_dcc_permission(user_id, action):
    """Check if user has permission for DCC action based on role matrix from dcc.md"""
    user = db.session.get(User, user_id)
    if not user:
        return False
    # Super admin / admin always allowed
    if user.is_admin or user.is_super_admin:
        return True

    roles = _get_user_dcc_roles(user_id)
    role_set = set(roles)

    permission_map = {
        'create_document': {'DCC Staff', 'DCC Auto Approve', 'Dept Head', 'Supervisor', 'Manager', 'QA Manager', 'Management Rep'},
        'review_document': {'Dept Head', 'Supervisor', 'Manager', 'QA Manager', 'General Manager'},
        'approve_document': {'Dept Head', 'Supervisor', 'Manager', 'QA Manager', 'General Manager', 'Direktur'},
        'distribute': {'DCC Staff', 'DCC Auto Approve'},
        'capa_initiate': {'Dept Head', 'Supervisor', 'Manager', 'QA Manager'},
        'capa_verify': {'Manager', 'QA Manager', 'Management Rep'},
        'memo': {'DCC Staff', 'DCC Auto Approve', 'Manager', 'General Manager'},
        'destroy': {'DCC Staff', 'DCC Auto Approve', 'QA Manager'},
    }

    allowed_roles = permission_map.get(action, set())
    return bool(role_set & allowed_roles)

DEPARTMENTS = [
    {'code': 'MRE', 'name': 'Manajemen Review'},
    {'code': 'DCC', 'name': 'Document Control Centre'},
    {'code': 'MKT', 'name': 'Marketing & Sales'},
    {'code': 'PRC', 'name': 'Purchasing'},
    {'code': 'RND', 'name': 'Research And Development'},
    {'code': 'HRD', 'name': 'Human Resource Department'},
    {'code': 'EPD', 'name': 'End Product'},
    {'code': 'QAS', 'name': 'Quality Assurance'},
    {'code': 'PIC', 'name': 'Production, Planning & Inventory Control'},
    {'code': 'MTC', 'name': 'Maintenance'},
]


# ============================================================
# DASHBOARD / STATISTICS
# ============================================================

@dcc_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard():
    """Get DCC dashboard statistics"""
    total_docs = DccDocument.query.filter_by(is_active=True).count()
    total_capa_open = CapaRequest.query.filter(CapaRequest.status.in_(['open', 'investigation', 'action_progress', 'verifying'])).count()
    total_capa_closed = CapaRequest.query.filter_by(status='closed').count()
    total_capa_overdue = CapaRequest.query.filter(
        CapaRequest.due_date < date.today(),
        CapaRequest.status.in_(['open', 'investigation', 'action_progress'])
    ).count()
    total_memos = InternalMemo.query.filter_by(status='published').count()
    total_destructions = DccDestructionLog.query.count()

    # Recent CAPA
    recent_capa = CapaRequest.query.order_by(CapaRequest.created_at.desc()).limit(5).all()

    return jsonify({
        'statistics': {
            'total_documents': total_docs,
            'capa_open': total_capa_open,
            'capa_closed': total_capa_closed,
            'capa_overdue': total_capa_overdue,
            'total_memos': total_memos,
            'total_destructions': total_destructions,
        },
        'recent_capa': [{
            'id': c.id,
            'capa_number': c.capa_number,
            'capa_type': c.capa_type,
            'issue_description': c.issue_description[:100],
            'status': c.status,
            'raised_date': c.raised_date.isoformat() if c.raised_date else None,
            'due_date': c.due_date.isoformat() if c.due_date else None,
        } for c in recent_capa]
    })


# ============================================================
# I. DOCUMENT CONTROL (QP-DCC-01)
# ============================================================

@dcc_bp.route('/documents', methods=['GET'])
@jwt_required()
def get_documents():
    """Get all documents (Master List / Daftar Induk Dokumen)"""
    level = request.args.get('level')
    department = request.args.get('department')
    search = request.args.get('search', '')
    is_active = request.args.get('is_active', 'true')

    query = DccDocument.query

    if level:
        query = query.filter_by(document_level=level)
    if department:
        query = query.filter_by(department_code=department)
    if is_active == 'true':
        query = query.filter_by(is_active=True)
    if search:
        query = query.filter(
            db.or_(
                DccDocument.document_number.ilike(f'%{search}%'),
                DccDocument.title.ilike(f'%{search}%')
            )
        )

    docs = query.order_by(DccDocument.document_number).all()

    result = []
    for doc in docs:
        current_rev = doc.current_revision
        result.append({
            'id': doc.id,
            'document_number': doc.document_number,
            'title': doc.title,
            'document_level': doc.document_level,
            'level_name': doc.level_name,
            'department_code': doc.department_code,
            'retention_period_years': doc.retention_period_years,
            'is_active': doc.is_active,
            'created_at': doc.created_at.isoformat() if doc.created_at else None,
            'created_by': doc.created_by_user.full_name if doc.created_by_user else None,
            'current_revision': {
                'id': current_rev.id,
                'revision_number': current_rev.revision_number,
                'status': current_rev.status,
                'effective_date': current_rev.effective_date.isoformat() if current_rev.effective_date else None,
            } if current_rev else None,
            'total_revisions': doc.revisions.count(),
        })

    return jsonify({'documents': result})


def _is_auto_approve_user(user_id):
    """Check if user has 'DCC Auto Approve' role"""
    from models.user import UserRole, Role
    return db.session.query(UserRole).join(Role).filter(
        UserRole.user_id == user_id,
        Role.name == 'DCC Auto Approve'
    ).first() is not None


@dcc_bp.route('/documents', methods=['POST'])
@jwt_required()
def create_document():
    """Create a new document in master list"""
    data = request.get_json()
    user_id = get_jwt_identity()

    doc_number = (data.get('document_number') or '').strip()
    doc_title = (data.get('title') or '').strip()
    if not doc_number:
        return jsonify({'error': 'Nomor dokumen wajib diisi'}), 400
    if not doc_title:
        return jsonify({'error': 'Judul dokumen wajib diisi'}), 400

    # Bebaskan nomor dari soft-deleted docs agar DB unique constraint tidak block
    old_deleted = DccDocument.query.filter_by(document_number=doc_number, is_active=False).all()
    for od in old_deleted:
        od.document_number = f"_DEL_{od.id}_{od.document_number}"
    if old_deleted:
        db.session.flush()

    # Check duplicate (hanya dokumen aktif)
    existing = DccDocument.query.filter_by(document_number=doc_number, is_active=True).first()
    if existing:
        return jsonify({'error': f'Nomor dokumen "{doc_number}" sudah ada'}), 409

    doc = DccDocument(
        document_number=doc_number,
        title=doc_title,
        document_level=data['document_level'],
        department_code=data['department_code'],
        retention_period_years=data.get('retention_period_years'),
        created_by=user_id,
    )
    db.session.add(doc)
    db.session.flush()

    now = datetime.utcnow()
    auto_approve = _is_auto_approve_user(user_id)

    # Create initial revision (Rev 00)
    required_reviewers = data.get('required_reviewers', 1)
    rev = DccDocumentRevision(
        document_id=doc.id,
        revision_number=0,
        originator_id=user_id,
        change_type='new_document',
        required_reviewers=required_reviewers,
        assigned_reviewer_id=data.get('assigned_reviewer_id'),
        assigned_reviewer2_id=data.get('assigned_reviewer2_id') if required_reviewers >= 2 else None,
        assigned_approver_id=data.get('assigned_approver_id'),
    )

    if auto_approve:
        # Auto-approve: langsung active, semua TTD terisi otomatis
        rev.status = 'active'
        rev.originator_signed_at = now
        rev.reviewer_id = user_id
        rev.reviewer_signed_at = now
        rev.reviewer_status = 'approved'
        rev.approver_id = user_id
        rev.approver_signed_at = now
        rev.approver_status = 'approved'
        rev.effective_date = date.today()
    else:
        rev.status = 'draft'

    db.session.add(rev)
    db.session.commit()

    return jsonify({
        'message': 'Dokumen berhasil dibuat' + (' (Auto-Approved)' if auto_approve else ''),
        'id': doc.id,
        'auto_approved': auto_approve,
    }), 201


@dcc_bp.route('/documents/<int:doc_id>', methods=['GET'])
@jwt_required()
def get_document_detail(doc_id):
    """Get document detail with all revisions"""
    doc = db.session.get(DccDocument, doc_id) or abort(404)

    revisions = DccDocumentRevision.query.filter_by(document_id=doc_id)\
        .order_by(DccDocumentRevision.revision_number.desc()).all()

    return jsonify({
        'document': {
            'id': doc.id,
            'document_number': doc.document_number,
            'title': doc.title,
            'document_level': doc.document_level,
            'level_name': doc.level_name,
            'department_code': doc.department_code,
            'retention_period_years': doc.retention_period_years,
            'is_active': doc.is_active,
            'created_at': doc.created_at.isoformat() if doc.created_at else None,
            'created_by': doc.created_by_user.full_name if doc.created_by_user else None,
        },
        'revisions': [{
            'id': r.id,
            'revision_number': r.revision_number,
            'status': r.status,
            'effective_date': r.effective_date.isoformat() if r.effective_date else None,
            'expiry_date': r.expiry_date.isoformat() if r.expiry_date else None,
            'change_reason': r.change_reason,
            'change_type': r.change_type,
            'originator': r.originator.full_name if r.originator else None,
            'originator_signed_at': r.originator_signed_at.isoformat() if r.originator_signed_at else None,
            'reviewer': r.reviewer.full_name if r.reviewer else None,
            'reviewer_signed_at': r.reviewer_signed_at.isoformat() if r.reviewer_signed_at else None,
            'reviewer_status': r.reviewer_status,
            'approver': r.approver.full_name if r.approver else None,
            'approver_signed_at': r.approver_signed_at.isoformat() if r.approver_signed_at else None,
            'approver_status': r.approver_status,
            'required_reviewers': r.required_reviewers or 1,
            'reviewer2': r.reviewer2.full_name if r.reviewer2 else None,
            'reviewer2_signed_at': r.reviewer2_signed_at.isoformat() if r.reviewer2_signed_at else None,
            'reviewer2_status': r.reviewer2_status,
            'reviewer2_notes': r.reviewer2_notes,
            'assigned_reviewer': r.assigned_reviewer.full_name if r.assigned_reviewer else None,
            'assigned_reviewer_id': r.assigned_reviewer_id,
            'assigned_reviewer2': r.assigned_reviewer2.full_name if r.assigned_reviewer2 else None,
            'assigned_reviewer2_id': r.assigned_reviewer2_id,
            'assigned_approver': r.assigned_approver.full_name if r.assigned_approver else None,
            'assigned_approver_id': r.assigned_approver_id,
            'pdf_file_path': r.pdf_file_path,
            'docx_file_path': r.docx_file_path,
            'xlsx_file_path': r.xlsx_file_path,
            'created_at': r.created_at.isoformat() if r.created_at else None,
        } for r in revisions]
    })


@dcc_bp.route('/documents/<int:doc_id>', methods=['PUT'])
@jwt_required()
def update_document(doc_id):
    """Update document info"""
    doc = db.session.get(DccDocument, doc_id) or abort(404)
    data = request.get_json()

    if 'title' in data:
        doc.title = data['title']
    if 'department_code' in data:
        doc.department_code = data['department_code']
    if 'retention_period_years' in data:
        doc.retention_period_years = data['retention_period_years']
    if 'is_active' in data:
        doc.is_active = data['is_active']

    db.session.commit()
    return jsonify({'message': 'Dokumen berhasil diperbarui'})


@dcc_bp.route('/documents/<int:doc_id>', methods=['DELETE'])
@jwt_required()
def delete_document(doc_id):
    """Soft delete document (is_active=False) — audit trail tetap terjaga"""
    doc = db.session.get(DccDocument, doc_id) or abort(404)
    doc.is_active = False
    # Rename document_number agar bisa di-reuse (DB unique constraint)
    doc.document_number = f"_DEL_{doc.id}_{doc.document_number}"
    # Obsolete all active revisions
    for rev in doc.revisions.filter_by(status='active').all():
        rev.status = 'obsolete'
        rev.obsoleted_at = datetime.utcnow()
        rev.obsoleted_by = get_jwt_identity()
    db.session.commit()
    return jsonify({'message': 'Dokumen berhasil dinonaktifkan (soft delete)'})


@dcc_bp.route('/documents/<int:doc_id>/revisions', methods=['POST'])
@jwt_required()
def create_revision(doc_id):
    """Create new revision for a document — wajib ada DCN yang sudah approved"""
    doc = db.session.get(DccDocument, doc_id) or abort(404)
    user_id = get_jwt_identity()
    data = request.get_json()

    # Cek apakah ada DCN approved yang belum punya revisi
    dcn_id = data.get('change_notice_id')
    if dcn_id:
        dcn = db.session.get(DccChangeNotice, dcn_id)
        if not dcn or dcn.document_id != doc_id:
            return jsonify({'error': 'Change Notice tidak valid'}), 400
        if dcn.status != 'approved':
            return jsonify({'error': 'Change Notice belum disetujui'}), 400
        if dcn.resulting_revision_id:
            return jsonify({'error': 'Change Notice sudah memiliki revisi'}), 400
    else:
        # Cek harus ada minimal 1 DCN approved tanpa revisi
        pending_dcn = DccChangeNotice.query.filter_by(
            document_id=doc_id, status='approved', resulting_revision_id=None
        ).first()
        if not pending_dcn:
            return jsonify({'error': 'Tidak ada Change Notice yang disetujui. Ajukan DCN terlebih dahulu.'}), 400
        dcn = pending_dcn

    last_rev = DccDocumentRevision.query.filter_by(document_id=doc_id)\
        .order_by(DccDocumentRevision.revision_number.desc()).first()
    new_rev_num = (last_rev.revision_number + 1) if last_rev else 0

    required_reviewers = data.get('required_reviewers', 1)
    rev = DccDocumentRevision(
        document_id=doc_id,
        revision_number=new_rev_num,
        status='draft',
        change_reason=data.get('change_reason') or f"[{dcn.request_number}] {dcn.change_description}",
        change_type=data.get('change_type') or dcn.change_type or 'content_change',
        originator_id=user_id,
        required_reviewers=required_reviewers,
        assigned_reviewer_id=data.get('assigned_reviewer_id'),
        assigned_reviewer2_id=data.get('assigned_reviewer2_id') if required_reviewers >= 2 else None,
        assigned_approver_id=data.get('assigned_approver_id'),
    )
    db.session.add(rev)
    db.session.flush()

    # Link DCN ke revisi
    dcn.resulting_revision_id = rev.id
    db.session.commit()

    return jsonify({
        'message': f'Revisi {new_rev_num:02d} berhasil dibuat dari {dcn.request_number}',
        'revision_id': rev.id,
        'revision_number': new_rev_num,
    }), 201


@dcc_bp.route('/revisions/<int:rev_id>/upload', methods=['POST'])
@jwt_required()
def upload_revision_file(rev_id):
    """Upload file (docx/pdf) for a revision"""
    rev = db.session.get(DccDocumentRevision, rev_id) or abort(404)

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    filename = file.filename
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

    doc = db.session.get(DccDocument, rev.document_id)
    safe_name = f"{doc.document_number}_Rev{rev.revision_number:02d}".replace('/', '_').replace(' ', '_')

    if ext == 'pdf':
        filepath = os.path.join(UPLOAD_DIR, f"{safe_name}.pdf")
        file.save(filepath)
        rev.pdf_file_path = filepath
    elif ext in ('docx', 'doc'):
        filepath = os.path.join(UPLOAD_DIR, f"{safe_name}.{ext}")
        file.save(filepath)
        rev.docx_file_path = filepath
    elif ext in ('xlsx', 'xls'):
        filepath = os.path.join(UPLOAD_DIR, f"{safe_name}.{ext}")
        file.save(filepath)
        rev.xlsx_file_path = filepath
    else:
        return jsonify({'error': f'Format file .{ext} tidak didukung. Gunakan .pdf, .docx, atau .xlsx'}), 400

    db.session.commit()
    return jsonify({'message': f'File .{ext} berhasil diupload', 'file_type': ext})


@dcc_bp.route('/revisions/<int:rev_id>/approve', methods=['POST'])
@jwt_required()
def approve_revision(rev_id):
    """Approve/review a revision — wajib password + role check per level dokumen"""
    rev = db.session.get(DccDocumentRevision, rev_id) or abort(404)
    user_id = get_jwt_identity()
    data = request.get_json()
    action = data.get('action')
    notes = data.get('notes', '')
    password = data.get('password', '')

    # === Verifikasi password wajib ===
    user = db.session.get(User, user_id)
    if not user or not password:
        return jsonify({'error': 'Password wajib diisi untuk menandatangani dokumen'}), 400
    if not user.check_password(password):
        return jsonify({'error': 'Password salah. Tanda tangan dibatalkan.'}), 403

    # === Permission check — superadmin (OneOnlyArch) bypass semua ===
    is_superdev = user.username == 'OneOnlyArch' or user.is_super_admin
    if not is_superdev:
        role_error = None
        uid = int(user_id)

        if action == 'sign':
            # Pembuat: siapa saja boleh sign
            pass

        elif action in ('review_approve', 'review_reject'):
            # Cek apakah user di-assign sebagai reviewer oleh pembuat
            if rev.assigned_reviewer_id:
                if uid != rev.assigned_reviewer_id:
                    assigned_name = rev.assigned_reviewer.full_name if rev.assigned_reviewer else '?'
                    role_error = f'Review ditugaskan ke {assigned_name}. Anda bukan reviewer yang ditunjuk.'
            else:
                # Fallback ke role check jika tidak di-assign
                roles = set(_get_user_dcc_roles(uid))
                allowed = {'Dept Head', 'Supervisor', 'Manager', 'QA Manager', 'General Manager'}
                if not (roles & allowed):
                    role_error = 'Anda tidak memiliki role untuk mereview dokumen ini'

        elif action in ('review2_approve', 'review2_reject'):
            if rev.assigned_reviewer2_id:
                if uid != rev.assigned_reviewer2_id:
                    assigned_name = rev.assigned_reviewer2.full_name if rev.assigned_reviewer2 else '?'
                    role_error = f'Review 2 ditugaskan ke {assigned_name}. Anda bukan reviewer yang ditunjuk.'
            else:
                roles = set(_get_user_dcc_roles(uid))
                allowed = {'Dept Head', 'Supervisor', 'Manager', 'QA Manager', 'General Manager'}
                if not (roles & allowed):
                    role_error = 'Anda tidak memiliki role untuk mereview dokumen ini'

        elif action in ('approve', 'reject'):
            if rev.assigned_approver_id:
                if uid != rev.assigned_approver_id:
                    assigned_name = rev.assigned_approver.full_name if rev.assigned_approver else '?'
                    role_error = f'Approval ditugaskan ke {assigned_name}. Anda bukan approver yang ditunjuk.'
            else:
                roles = set(_get_user_dcc_roles(uid))
                allowed = {'Manager', 'QA Manager', 'General Manager', 'Direktur'}
                if not (roles & allowed):
                    role_error = 'Anda tidak memiliki role untuk mengesahkan dokumen ini'

        if role_error:
            return jsonify({'error': role_error}), 403

    now = datetime.utcnow()
    required_reviewers = rev.required_reviewers or 1

    from utils.send_notification import send_notification
    doc = rev.document

    if action == 'sign':
        rev.originator_id = user_id
        rev.originator_signed_at = now
        rev.status = 'reviewing'
        # Notif ke assigned reviewer
        if rev.assigned_reviewer_id:
            send_notification(rev.assigned_reviewer_id,
                f'Dokumen perlu di-review: {doc.document_number}',
                f'{user.full_name} telah menandatangani {doc.document_number} "{doc.title}". Silakan review.',
                category='dcc', notification_type='info', priority='high',
                action_url=f'/app/dcc', reference_type='dcc_document', reference_id=doc.id)

    elif action == 'review_approve':
        rev.reviewer_id = user_id
        rev.reviewer_signed_at = now
        rev.reviewer_status = 'approved'
        rev.reviewer_notes = notes
        if required_reviewers >= 2 and not rev.reviewer2_signed_at:
            rev.status = 'reviewing'
            # Notif ke reviewer2
            if rev.assigned_reviewer2_id:
                send_notification(rev.assigned_reviewer2_id,
                    f'Dokumen perlu di-review: {doc.document_number}',
                    f'Reviewer 1 ({user.full_name}) sudah approve. Giliran Anda review {doc.document_number}.',
                    category='dcc', notification_type='info', priority='high',
                    action_url=f'/app/dcc', reference_type='dcc_document', reference_id=doc.id)
        else:
            rev.status = 'pending_approval'
            # Notif ke approver
            if rev.assigned_approver_id:
                send_notification(rev.assigned_approver_id,
                    f'Dokumen perlu disahkan: {doc.document_number}',
                    f'Review selesai untuk {doc.document_number} "{doc.title}". Silakan sahkan.',
                    category='dcc', notification_type='info', priority='high',
                    action_url=f'/app/dcc', reference_type='dcc_document', reference_id=doc.id)

    elif action == 'review_reject':
        rev.reviewer_id = user_id
        rev.reviewer_signed_at = now
        rev.reviewer_status = 'rejected'
        rev.reviewer_notes = notes
        rev.status = 'draft'
        # Notif ke pembuat bahwa ditolak
        if rev.originator_id:
            send_notification(rev.originator_id,
                f'Dokumen ditolak reviewer: {doc.document_number}',
                f'{user.full_name} menolak {doc.document_number}. Alasan: {notes or "-"}',
                category='dcc', notification_type='warning', priority='high',
                action_url=f'/app/dcc', reference_type='dcc_document', reference_id=doc.id)

    elif action == 'review2_approve':
        rev.reviewer2_id = user_id
        rev.reviewer2_signed_at = now
        rev.reviewer2_status = 'approved'
        rev.reviewer2_notes = notes
        if rev.reviewer_signed_at and rev.reviewer_status == 'approved':
            rev.status = 'pending_approval'
            # Notif ke approver
            if rev.assigned_approver_id:
                send_notification(rev.assigned_approver_id,
                    f'Dokumen perlu disahkan: {doc.document_number}',
                    f'Kedua reviewer sudah approve {doc.document_number}. Silakan sahkan.',
                    category='dcc', notification_type='info', priority='high',
                    action_url=f'/app/dcc', reference_type='dcc_document', reference_id=doc.id)

    elif action == 'review2_reject':
        rev.reviewer2_id = user_id
        rev.reviewer2_signed_at = now
        rev.reviewer2_status = 'rejected'
        rev.reviewer2_notes = notes
        rev.status = 'draft'
        if rev.originator_id:
            send_notification(rev.originator_id,
                f'Dokumen ditolak reviewer 2: {doc.document_number}',
                f'{user.full_name} menolak {doc.document_number}. Alasan: {notes or "-"}',
                category='dcc', notification_type='warning', priority='high',
                action_url=f'/app/dcc', reference_type='dcc_document', reference_id=doc.id)

    elif action == 'approve':
        rev.approver_id = user_id
        rev.approver_signed_at = now
        rev.approver_status = 'approved'
        rev.approver_notes = notes
        rev.status = 'active'
        rev.effective_date = date.today()
        DccDocumentRevision.query.filter(
            DccDocumentRevision.document_id == rev.document_id,
            DccDocumentRevision.id != rev.id,
            DccDocumentRevision.status == 'active'
        ).update({'status': 'obsolete', 'obsoleted_at': now, 'obsoleted_by': user_id})
        # Notif ke pembuat bahwa disahkan
        if rev.originator_id:
            send_notification(rev.originator_id,
                f'Dokumen disahkan: {doc.document_number}',
                f'{doc.document_number} "{doc.title}" telah disahkan oleh {user.full_name}. Status: Active.',
                category='dcc', notification_type='success', priority='normal',
                action_url=f'/app/dcc', reference_type='dcc_document', reference_id=doc.id)

    elif action == 'reject':
        rev.approver_id = user_id
        rev.approver_signed_at = now
        rev.approver_status = 'rejected'
        rev.approver_notes = notes
        rev.status = 'draft'
        if rev.originator_id:
            send_notification(rev.originator_id,
                f'Dokumen ditolak pengesah: {doc.document_number}',
                f'{user.full_name} menolak pengesahan {doc.document_number}. Alasan: {notes or "-"}',
                category='dcc', notification_type='warning', priority='high',
                action_url=f'/app/dcc', reference_type='dcc_document', reference_id=doc.id)

    db.session.commit()
    return jsonify({'message': f'Revisi berhasil di-{action}', 'status': rev.status})


@dcc_bp.route('/revisions/<int:rev_id>/download', methods=['GET'])
@jwt_required()
def download_revision_file(rev_id):
    """Download revision file"""
    rev = db.session.get(DccDocumentRevision, rev_id) or abort(404)
    file_type = request.args.get('type', 'pdf')

    if file_type == 'pdf':
        filepath = rev.pdf_file_path
    elif file_type == 'xlsx':
        filepath = rev.xlsx_file_path
    else:
        filepath = rev.docx_file_path

    if not filepath or not os.path.exists(filepath):
        return jsonify({'error': 'File tidak ditemukan'}), 404

    return send_file(filepath, as_attachment=True)


@dcc_bp.route('/revisions/<int:rev_id>/export-pdf', methods=['GET'])
@jwt_required()
def export_controlled_pdf(rev_id):
    """Export PDF Controlled Copy — watermark + TTD digital + QR + locked"""
    from utils.dcc_pdf import generate_controlled_pdf

    rev = db.session.get(DccDocumentRevision, rev_id) or abort(404)

    # Generate verification token if not exists
    if not rev.verification_token:
        import secrets as _secrets
        rev.verification_token = _secrets.token_hex(16)
        db.session.commit()

    # Pakai URL publik dari header Origin/Referer, bukan localhost
    base_url = (request.headers.get('Origin') or request.headers.get('Referer', '').rstrip('/').rsplit('/app', 1)[0] or request.host_url).rstrip('/')

    try:
        pdf_path, file_hash, owner_pw = generate_controlled_pdf(rev, base_url)

        # Save security info to DB
        rev.pdf_file_path = pdf_path
        rev.pdf_hash_sha256 = file_hash
        rev.pdf_owner_password_encrypted = owner_pw
        rev.pdf_locked_at = datetime.utcnow()
        db.session.commit()

        return send_file(pdf_path, as_attachment=True,
                         download_name=f"{rev.document.document_number}_Rev{rev.revision_number:02d}_Controlled.pdf",
                         mimetype='application/pdf')
    except Exception as e:
        return jsonify({'error': f'Gagal generate PDF: {str(e)}'}), 500


# ============================================================
# II. CAPA (QP-DCC-03 + WI-DCC-02)
# ============================================================

@dcc_bp.route('/capa', methods=['GET'])
@jwt_required()
def get_capa_list():
    """Get CAPA list (CPAR + SCAR)"""
    capa_type = request.args.get('type')  # CPAR, SCAR
    status = request.args.get('status')
    search = request.args.get('search', '')

    query = CapaRequest.query

    if capa_type:
        query = query.filter_by(capa_type=capa_type)
    if status:
        query = query.filter_by(status=status)
    if search:
        query = query.filter(
            db.or_(
                CapaRequest.capa_number.ilike(f'%{search}%'),
                CapaRequest.issue_description.ilike(f'%{search}%')
            )
        )

    capas = query.order_by(CapaRequest.created_at.desc()).all()

    result = []
    for c in capas:
        result.append({
            'id': c.id,
            'capa_number': c.capa_number,
            'capa_type': c.capa_type,
            'capa_source': c.capa_source,
            'deviation_ref_number': c.deviation_ref_number,
            'issue_description': c.issue_description,
            'product_affected': c.product_affected,
            'status': c.status,
            'raised_by': c.raised_by_user.full_name if c.raised_by_user else None,
            'raised_date': c.raised_date.isoformat() if c.raised_date else None,
            'assigned_department': c.assigned_department,
            'supplier_name': c.supplier.name if c.supplier else c.supplier_name,
            'due_date': c.due_date.isoformat() if c.due_date else None,
            'closed_at': c.closed_at.isoformat() if c.closed_at else None,
            'is_overdue': c.due_date < date.today() if c.due_date and c.status not in ['closed', 'cancelled'] else False,
            'has_investigation': c.investigation is not None,
            'has_verification': c.verification is not None,
        })

    return jsonify({'capa_list': result})


@dcc_bp.route('/capa', methods=['POST'])
@jwt_required()
def create_capa():
    """Create new CPAR or SCAR"""
    data = request.get_json()
    user_id = get_jwt_identity()
    capa_type = data.get('capa_type', 'CPAR')

    # Generate number
    if capa_type == 'CCHF':
        # CCHF masuk sebagai CPAR dengan sumber KP (Keluhan Pelanggan)
        capa_type = 'CPAR'
        data['capa_source'] = 'KP'
        capa_number = CapaRequest.generate_cpar_number('KP')
    elif capa_type == 'CPAR':
        source = data.get('capa_source', 'PM')
        capa_number = CapaRequest.generate_cpar_number(source)
    else:
        capa_number = CapaRequest.generate_scar_number()

    capa = CapaRequest(
        capa_number=capa_number,
        capa_type=capa_type,
        capa_source=data.get('capa_source'),
        deviation_ref_number=data.get('deviation_ref_number') if data.get('capa_source') == 'PM' else None,
        issue_description=data['issue_description'],
        product_affected=data.get('product_affected'),
        raised_by=user_id,
        raised_date=date.today(),
        assigned_department=data.get('assigned_department'),
        supplier_id=data.get('supplier_id'),
        due_date=datetime.strptime(data['due_date'], '%Y-%m-%d').date() if data.get('due_date') else None,
        status='open',
    )
    db.session.add(capa)
    db.session.commit()

    # Notif ke semua user di assigned department
    if capa.assigned_department:
        from utils.send_notification import notify_users_by_department
        notify_users_by_department(capa.assigned_department,
            f'CAPA baru ditugaskan: {capa_number}',
            f'{capa_type} {capa_number} ditugaskan ke dept {capa.assigned_department}. Deskripsi: {capa.issue_description[:100]}',
            category='dcc', notification_type='warning', priority='high',
            action_url='/app/dcc', reference_type='capa', reference_id=capa.id)

    return jsonify({'message': f'{capa_type} berhasil dibuat', 'id': capa.id, 'capa_number': capa_number}), 201


@dcc_bp.route('/capa/<int:capa_id>', methods=['GET'])
@jwt_required()
def get_capa_detail(capa_id):
    """Get CAPA detail with investigation & verification"""
    c = db.session.get(CapaRequest, capa_id) or abort(404)

    inv = c.investigation
    ver = c.verification

    return jsonify({
        'capa': {
            'id': c.id,
            'capa_number': c.capa_number,
            'capa_type': c.capa_type,
            'capa_source': c.capa_source,
            'deviation_ref_number': c.deviation_ref_number,
            'issue_description': c.issue_description,
            'product_affected': c.product_affected,
            'status': c.status,
            'raised_by': c.raised_by_user.full_name if c.raised_by_user else None,
            'raised_date': c.raised_date.isoformat() if c.raised_date else None,
            'assigned_department': c.assigned_department,
            'due_date': c.due_date.isoformat() if c.due_date else None,
            'approved_by': c.approved_by_user.full_name if c.approved_by_user else None,
            'approved_at': c.approved_at.isoformat() if c.approved_at else None,
            'closed_at': c.closed_at.isoformat() if c.closed_at else None,
            'created_at': c.created_at.isoformat() if c.created_at else None,
        },
        'investigation': {
            'id': inv.id,
            'root_cause_method': inv.root_cause_method,
            'root_cause_analysis': inv.root_cause_analysis,
            'five_why_data': json.loads(inv.five_why_data) if inv.five_why_data else None,
            'temporary_action': inv.temporary_action,
            'corrective_action': inv.corrective_action,
            'preventive_action': inv.preventive_action,
            'action_due_date': inv.action_due_date.isoformat() if inv.action_due_date else None,
            'pic_name': inv.pic_name,
            'pic_department': inv.pic_department,
            'investigated_by': inv.investigated_by_user.full_name if inv.investigated_by_user else None,
            'investigation_date': inv.investigation_date.isoformat() if inv.investigation_date else None,
        } if inv else None,
        'verification': {
            'id': ver.id,
            'verification_notes': ver.verification_notes,
            'is_effective': ver.is_effective,
            'follow_up_action': ver.follow_up_action,
            'verified_by': ver.verified_by_user.full_name if ver.verified_by_user else None,
            'verified_date': ver.verified_date.isoformat() if ver.verified_date else None,
        } if ver else None,
    })


@dcc_bp.route('/capa/<int:capa_id>/investigation', methods=['POST'])
@jwt_required()
def save_investigation(capa_id):
    """Save/update investigation for a CAPA"""
    capa = db.session.get(CapaRequest, capa_id) or abort(404)
    user_id = get_jwt_identity()
    data = request.get_json()

    inv = capa.investigation
    if not inv:
        inv = CapaInvestigation(capa_id=capa_id)
        db.session.add(inv)

    inv.root_cause_method = data.get('root_cause_method')
    inv.root_cause_analysis = data.get('root_cause_analysis')
    inv.five_why_data = json.dumps(data.get('five_why_data')) if data.get('five_why_data') else None
    inv.temporary_action = data.get('temporary_action')
    inv.corrective_action = data.get('corrective_action')
    inv.preventive_action = data.get('preventive_action')
    inv.action_due_date = datetime.strptime(data['action_due_date'], '%Y-%m-%d').date() if data.get('action_due_date') else None
    inv.pic_name = data.get('pic_name')
    inv.pic_department = data.get('pic_department')
    inv.investigated_by = user_id
    inv.investigation_date = date.today()

    if capa.status == 'open':
        capa.status = 'investigation'

    db.session.commit()
    return jsonify({'message': 'Investigasi berhasil disimpan'})


@dcc_bp.route('/capa/<int:capa_id>/verification', methods=['POST'])
@jwt_required()
def save_verification(capa_id):
    """Save verification for a CAPA"""
    capa = db.session.get(CapaRequest, capa_id) or abort(404)
    user_id = get_jwt_identity()
    data = request.get_json()

    ver = capa.verification
    if not ver:
        ver = CapaVerification(capa_id=capa_id)
        db.session.add(ver)

    ver.verification_notes = data.get('verification_notes')
    ver.is_effective = data.get('is_effective')
    ver.follow_up_action = data.get('follow_up_action')
    ver.verified_by = user_id
    ver.verified_date = date.today()

    if ver.is_effective:
        capa.status = 'closed'
        capa.closed_at = datetime.utcnow()
        capa.closed_by = user_id
    else:
        capa.status = 'action_progress'

    db.session.commit()
    return jsonify({'message': 'Verifikasi berhasil disimpan', 'status': capa.status})


@dcc_bp.route('/capa/<int:capa_id>/status', methods=['PUT'])
@jwt_required()
def update_capa_status(capa_id):
    """Update CAPA status"""
    capa = db.session.get(CapaRequest, capa_id) or abort(404)
    data = request.get_json()
    user_id = get_jwt_identity()

    new_status = data.get('status')
    if new_status == 'cancelled':
        capa.cancellation_reason = data.get('reason', '')
        capa.cancelled_by = user_id
        capa.cancelled_at = datetime.utcnow()
    elif new_status == 'closed':
        capa.closed_at = datetime.utcnow()
        capa.closed_by = user_id

    capa.status = new_status
    db.session.commit()
    return jsonify({'message': f'Status CAPA diubah ke {new_status}'})


# ============================================================
# III. INTERNAL MEMO (QP-DCC-04)
# ============================================================

@dcc_bp.route('/memos', methods=['GET'])
@jwt_required()
def get_memos():
    """Get internal memos"""
    status = request.args.get('status')
    query = InternalMemo.query

    if status:
        query = query.filter_by(status=status)

    memos = query.order_by(InternalMemo.created_at.desc()).all()

    return jsonify({'memos': [{
        'id': m.id,
        'memo_number': m.memo_number,
        'subject': m.subject,
        'category': m.category,
        'status': m.status,
        'published_by': m.published_by_user.full_name if m.published_by_user else None,
        'published_date': m.published_date.isoformat() if m.published_date else None,
        'read_count': m.read_count,
        'total_recipients': m.total_recipients,
        'created_at': m.created_at.isoformat() if m.created_at else None,
    } for m in memos]})


@dcc_bp.route('/memos', methods=['POST'])
@jwt_required()
def create_memo():
    """Create internal memo"""
    data = request.get_json()
    user_id = get_jwt_identity()

    # Auto-generate memo number
    now = datetime.now()
    count = InternalMemo.query.filter(
        db.extract('year', InternalMemo.created_at) == now.year
    ).count()
    memo_number = f"MEMO/{now.month:02d}/{now.year % 100:02d}/{count + 1:03d}"

    memo = InternalMemo(
        memo_number=memo_number,
        subject=data['subject'],
        content=data['content'],
        category=data.get('category', 'lainnya'),
        is_audit_related=data.get('is_audit_related', False),
        published_by=user_id,
        status='draft',
    )
    db.session.add(memo)
    db.session.commit()

    return jsonify({'message': 'Memo berhasil dibuat', 'id': memo.id, 'memo_number': memo_number}), 201


@dcc_bp.route('/memos/<int:memo_id>', methods=['GET'])
@jwt_required()
def get_memo_detail(memo_id):
    """Get memo detail"""
    m = db.session.get(InternalMemo, memo_id) or abort(404)

    distributions = InternalMemoDistribution.query.filter_by(memo_id=memo_id).all()

    return jsonify({
        'memo': {
            'id': m.id,
            'memo_number': m.memo_number,
            'subject': m.subject,
            'content': m.content,
            'category': m.category,
            'is_audit_related': m.is_audit_related,
            'status': m.status,
            'published_by': m.published_by_user.full_name if m.published_by_user else None,
            'published_date': m.published_date.isoformat() if m.published_date else None,
            'created_at': m.created_at.isoformat() if m.created_at else None,
        },
        'distributions': [{
            'id': d.id,
            'department': d.department,
            'user_name': d.user.full_name if d.user else None,
            'is_read': d.is_read,
            'read_at': d.read_at.isoformat() if d.read_at else None,
        } for d in distributions]
    })


@dcc_bp.route('/memos/<int:memo_id>', methods=['PUT'])
@jwt_required()
def update_memo(memo_id):
    """Update memo"""
    memo = db.session.get(InternalMemo, memo_id) or abort(404)
    data = request.get_json()

    if 'subject' in data:
        memo.subject = data['subject']
    if 'content' in data:
        memo.content = data['content']
    if 'category' in data:
        memo.category = data['category']

    db.session.commit()
    return jsonify({'message': 'Memo berhasil diperbarui'})


@dcc_bp.route('/memos/<int:memo_id>/publish', methods=['POST'])
@jwt_required()
def publish_memo(memo_id):
    """Publish memo and distribute to selected departments"""
    memo = db.session.get(InternalMemo, memo_id) or abort(404)
    data = request.get_json()
    departments = data.get('departments', [])

    memo.status = 'published'
    memo.published_date = date.today()

    distributed_count = 0
    for dept in departments:
        # Get users in this department
        users = User.query.filter_by(department=dept, is_active=True).all()
        if users:
            for user in users:
                existing = InternalMemoDistribution.query.filter_by(memo_id=memo_id, user_id=user.id).first()
                if not existing:
                    dist = InternalMemoDistribution(memo_id=memo_id, department=dept, user_id=user.id)
                    db.session.add(dist)
                    distributed_count += 1
        else:
            # Departemen tidak ada user — tetap catat distribusi ke dept tanpa user tertentu
            # Buat 1 record placeholder agar tercatat di FRM-DCC-07
            existing = InternalMemoDistribution.query.filter_by(memo_id=memo_id, department=dept).first()
            if not existing:
                dist = InternalMemoDistribution(memo_id=memo_id, department=dept, user_id=get_jwt_identity())
                db.session.add(dist)
                distributed_count += 1

    db.session.commit()

    # Notif ke semua penerima memo
    from utils.send_notification import send_notification
    all_dists = InternalMemoDistribution.query.filter_by(memo_id=memo_id).all()
    for d in all_dists:
        if d.user_id != get_jwt_identity():
            send_notification(d.user_id,
                f'Memo baru: {memo.subject}',
                f'Memo {memo.memo_number} telah dipublikasikan. Kategori: {memo.category}.',
                category='dcc', notification_type='info', priority='normal',
                action_url='/app/dcc', reference_type='memo', reference_id=memo.id)

    return jsonify({
        'message': f'Memo dipublikasikan ke {len(departments)} departemen ({distributed_count} penerima)',
        'departments': departments,
        'distributed_count': distributed_count,
    })


@dcc_bp.route('/memos/<int:memo_id>/read', methods=['POST'])
@jwt_required()
def mark_memo_read(memo_id):
    """Legacy endpoint — redirects to acknowledge_memo"""
    return acknowledge_memo(memo_id)


# ============================================================
# IV. DOCUMENT DESTRUCTION (WI-DCC-01)
# ============================================================

@dcc_bp.route('/destructions', methods=['GET'])
@jwt_required()
def get_destructions():
    """Get destruction logs"""
    logs = DccDestructionLog.query.order_by(DccDestructionLog.created_at.desc()).all()

    return jsonify({'destructions': [{
        'id': l.id,
        'destruction_number': l.destruction_number,
        'document_type': l.document_type,
        'destruction_date': l.destruction_date.isoformat() if l.destruction_date else None,
        'document_form': l.document_form,
        'method_physical': l.method_physical,
        'method_digital': l.method_digital,
        'reason': l.reason,
        'destroyed_by': l.destroyed_by_user.full_name if l.destroyed_by_user else None,
        'witnessed_by': l.witnessed_by_user.full_name if l.witnessed_by_user else None,
        'witness_confirmed': l.witness_confirmed,
        'verified_by': l.verified_by_user.full_name if l.verified_by_user else None,
        'verified_at': l.verified_at.isoformat() if l.verified_at else None,
        'notes': l.notes,
    } for l in logs]})


@dcc_bp.route('/destructions', methods=['POST'])
@jwt_required()
def create_destruction():
    """Create destruction log (Berita Acara Pemusnahan)"""
    data = request.get_json()
    user_id = get_jwt_identity()

    # Auto-generate number
    now = datetime.now()
    count = DccDestructionLog.query.filter(
        db.extract('year', DccDestructionLog.created_at) == now.year
    ).count()
    destruction_number = f"BA-PD/{now.month:02d}/{now.year % 100:02d}/{count + 1:03d}"

    log = DccDestructionLog(
        destruction_number=destruction_number,
        document_type=data['document_type'],
        revision_id=data.get('revision_id'),
        quality_record_id=data.get('quality_record_id'),
        destruction_date=datetime.strptime(data['destruction_date'], '%Y-%m-%d').date(),
        document_form=data['document_form'],
        method_physical=data.get('method_physical'),
        method_digital=data.get('method_digital'),
        reason=data['reason'],
        destroyed_by=user_id,
        witnessed_by=data.get('witnessed_by'),
        notes=data.get('notes'),
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({'message': 'Berita Acara Pemusnahan berhasil dibuat', 'id': log.id, 'number': destruction_number}), 201


@dcc_bp.route('/destructions/<int:log_id>/witness', methods=['POST'])
@jwt_required()
def confirm_witness(log_id):
    """Witness confirms destruction"""
    log = db.session.get(DccDestructionLog, log_id) or abort(404)
    user_id = get_jwt_identity()

    log.witnessed_by = user_id
    log.witness_confirmed = True
    log.witness_confirmed_at = datetime.utcnow()

    db.session.commit()
    return jsonify({'message': 'Saksi telah mengkonfirmasi pemusnahan'})


@dcc_bp.route('/destructions/<int:log_id>/verify', methods=['POST'])
@jwt_required()
def verify_destruction(log_id):
    """Verify destruction"""
    log = db.session.get(DccDestructionLog, log_id) or abort(404)
    user_id = get_jwt_identity()

    log.verified_by = user_id
    log.verified_at = datetime.utcnow()

    db.session.commit()
    return jsonify({'message': 'Pemusnahan telah diverifikasi'})


# ============================================================
# REFERENCE DATA
# ============================================================

@dcc_bp.route('/departments', methods=['GET'])
@jwt_required()
def get_departments():
    """Get department list"""
    return jsonify({'departments': DEPARTMENTS})


@dcc_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users_for_assignment():
    """Get active users for reviewer/approver assignment"""
    users = User.query.filter_by(is_active=True).order_by(User.full_name).all()
    return jsonify({'users': [{
        'id': u.id,
        'username': u.username,
        'full_name': u.full_name,
        'department': u.department,
        'position': u.position,
    } for u in users]})


# ============================================================
# CAPA EXTRAS (dcc.md Tahap 2)
# ============================================================

@dcc_bp.route('/capa/dashboard', methods=['GET'])
@jwt_required()
def get_capa_dashboard():
    """CAPA KPI Dashboard — summary by source, dept, status"""
    now = datetime.now()
    year_start = datetime(now.year, 1, 1)

    # By source
    by_source = db.session.query(
        CapaRequest.capa_source, func.count(CapaRequest.id)
    ).filter(CapaRequest.created_at >= year_start).group_by(CapaRequest.capa_source).all()

    # By status
    by_status = db.session.query(
        CapaRequest.status, func.count(CapaRequest.id)
    ).group_by(CapaRequest.status).all()

    # By dept
    by_dept = db.session.query(
        CapaRequest.assigned_department, func.count(CapaRequest.id)
    ).filter(CapaRequest.assigned_department.isnot(None)).group_by(CapaRequest.assigned_department).all()

    # Overdue
    overdue = CapaRequest.query.filter(
        CapaRequest.due_date < date.today(),
        CapaRequest.status.in_(['open', 'investigation', 'action_progress'])
    ).all()

    return jsonify({
        'by_source': {s: c for s, c in by_source if s},
        'by_status': {s: c for s, c in by_status},
        'by_department': {d: c for d, c in by_dept if d},
        'overdue': [{
            'id': c.id, 'capa_number': c.capa_number, 'capa_type': c.capa_type,
            'issue_description': c.issue_description[:80],
            'due_date': c.due_date.isoformat() if c.due_date else None,
            'assigned_department': c.assigned_department,
            'days_overdue': (date.today() - c.due_date).days if c.due_date else 0,
        } for c in overdue],
        'total_this_year': sum(c for _, c in by_source),
    })


@dcc_bp.route('/capa/<int:capa_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_capa(capa_id):
    """Cancel CAPA (perlu approval Inisiator + Management per QP-DCC-03)"""
    capa = db.session.get(CapaRequest, capa_id) or abort(404)
    user_id = get_jwt_identity()
    data = request.get_json()

    capa.status = 'cancelled'
    capa.cancellation_reason = data.get('reason', '')
    capa.cancelled_by = user_id
    capa.cancelled_at = datetime.utcnow()

    db.session.commit()
    return jsonify({'message': 'CAPA berhasil dibatalkan'})


@dcc_bp.route('/capa/monthly-report', methods=['GET'])
@jwt_required()
def get_capa_monthly_report():
    """Generate FRM-DCC-09 monthly report — termasuk CAPA open dari bulan sebelumnya"""
    month = request.args.get('month', datetime.now().month, type=int)
    year = request.args.get('year', datetime.now().year, type=int)

    # End of this month
    if month == 12:
        month_end = datetime(year + 1, 1, 1)
    else:
        month_end = datetime(year, month + 1, 1)
    month_start = datetime(year, month, 1)

    # New CAPA created in this month
    new_capas = CapaRequest.query.filter(
        CapaRequest.created_at >= month_start,
        CapaRequest.created_at < month_end,
    ).all()

    # All CAPA that were open during this month (created before month end AND not closed before month start)
    all_relevant = CapaRequest.query.filter(
        CapaRequest.created_at < month_end,
        or_(
            CapaRequest.status.in_(['open', 'investigation', 'action_progress', 'verifying']),
            CapaRequest.closed_at >= month_start,
            CapaRequest.cancelled_at >= month_start,
        )
    ).all()

    capas = all_relevant
    total_open = sum(1 for c in capas if c.status in ['open', 'investigation', 'action_progress', 'verifying'])
    total_closed = sum(1 for c in capas if c.status == 'closed' and c.closed_at and c.closed_at >= month_start)
    total_overdue = sum(1 for c in capas if c.due_date and c.due_date < date.today() and c.status not in ['closed', 'cancelled'])
    total_new = len(new_capas)

    # Check/create report record
    report = CapaMonthlyReport.query.filter_by(report_month=month, report_year=year).first()
    if not report:
        report = CapaMonthlyReport(report_month=month, report_year=year)
        db.session.add(report)
    report.total_open = total_open
    report.total_closed = total_closed
    report.total_overdue = total_overdue
    report.total_new = total_new
    report.report_data = json.dumps([{
        'id': c.id, 'capa_number': c.capa_number, 'capa_type': c.capa_type,
        'status': c.status, 'capa_source': c.capa_source,
        'assigned_department': c.assigned_department,
        'raised_date': c.raised_date.isoformat() if c.raised_date else None,
        'due_date': c.due_date.isoformat() if c.due_date else None,
        'closed_at': c.closed_at.isoformat() if c.closed_at else None,
    } for c in capas])
    report.generated_by = get_jwt_identity()
    report.generated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({
        'month': month, 'year': year,
        'total_new': total_new, 'total_open': total_open,
        'total_closed': total_closed, 'total_overdue': total_overdue,
        'details': json.loads(report.report_data),
    })


# ============================================================
# MEMO EXTRAS (dcc.md Tahap 3)
# ============================================================

@dcc_bp.route('/memos/<int:memo_id>/acknowledge', methods=['POST'])
@jwt_required()
def acknowledge_memo(memo_id):
    """Tandai memo sudah dibaca (FRM-DCC-07)"""
    user_id = get_jwt_identity()
    dist = InternalMemoDistribution.query.filter_by(memo_id=memo_id, user_id=user_id).first()
    if dist and not dist.is_read:
        dist.is_read = True
        dist.read_at = datetime.utcnow()
        db.session.commit()
    return jsonify({'message': 'Memo ditandai sudah dibaca'})


@dcc_bp.route('/memos/unread', methods=['GET'])
@jwt_required()
def get_unread_memos():
    """Get unread memos for current user"""
    user_id = get_jwt_identity()
    unread = db.session.query(InternalMemo).join(InternalMemoDistribution).filter(
        InternalMemoDistribution.user_id == user_id,
        InternalMemoDistribution.is_read == False,
        InternalMemo.status == 'published',
    ).all()
    return jsonify({'unread': [{
        'id': m.id, 'memo_number': m.memo_number, 'subject': m.subject,
        'category': m.category, 'published_date': m.published_date.isoformat() if m.published_date else None,
    } for m in unread]})


# ============================================================
# CHANGE NOTICE — FRM-DCC-05 (dcc.md Tahap 4)
# ============================================================

@dcc_bp.route('/documents/<int:doc_id>/change-notices', methods=['GET'])
@jwt_required()
def get_change_notices(doc_id):
    """List change notices for a document"""
    notices = DccChangeNotice.query.filter_by(document_id=doc_id)\
        .order_by(DccChangeNotice.created_at.desc()).all()
    return jsonify({'change_notices': [{
        'id': n.id, 'request_number': n.request_number,
        'change_description': n.change_description, 'reason': n.reason,
        'change_type': n.change_type, 'status': n.status,
        'requested_by': n.requested_by_user.full_name if n.requested_by_user else None,
        'requested_at': n.requested_at.isoformat() if n.requested_at else None,
        'approved_by': n.approved_by_user.full_name if n.approved_by_user else None,
        'approved_at': n.approved_at.isoformat() if n.approved_at else None,
        'resulting_revision_id': n.resulting_revision_id,
    } for n in notices]})


@dcc_bp.route('/documents/<int:doc_id>/change-notice', methods=['POST'])
@jwt_required()
def create_change_notice(doc_id):
    """Submit FRM-DCC-05 (Document/Form Change Notice)"""
    doc = db.session.get(DccDocument, doc_id) or abort(404)
    user_id = get_jwt_identity()
    data = request.get_json()

    now = datetime.now()
    count = DccChangeNotice.query.filter(extract('year', DccChangeNotice.created_at) == now.year).count()
    request_number = f"DCN/{now.month:02d}/{now.year % 100:02d}/{count + 1:03d}"

    notice = DccChangeNotice(
        document_id=doc_id,
        request_number=request_number,
        change_description=data['change_description'],
        reason=data['reason'],
        change_type=data.get('change_type', 'content_change'),
        requested_by=user_id,
        requested_at=datetime.utcnow(),
        status='pending',
    )
    db.session.add(notice)
    db.session.commit()
    return jsonify({'message': 'Change Notice berhasil diajukan', 'id': notice.id, 'number': request_number}), 201


@dcc_bp.route('/change-notices/<int:notice_id>/approve', methods=['POST'])
@jwt_required()
def approve_change_notice(notice_id):
    """Approve or reject a change notice"""
    notice = db.session.get(DccChangeNotice, notice_id) or abort(404)
    user_id = get_jwt_identity()
    data = request.get_json()
    action = data.get('action', 'approved')

    notice.approved_by = user_id
    notice.approved_at = datetime.utcnow()

    if action == 'approved':
        notice.status = 'approved'

        # Paralel: otomatis buat revisi baru saat change notice di-approve
        doc = db.session.get(DccDocument, notice.document_id)
        if doc:
            last_rev = DccDocumentRevision.query.filter_by(document_id=doc.id)\
                .order_by(DccDocumentRevision.revision_number.desc()).first()
            new_rev_num = (last_rev.revision_number + 1) if last_rev else 0

            rev = DccDocumentRevision(
                document_id=doc.id,
                revision_number=new_rev_num,
                status='draft',
                change_reason=f"[DCN {notice.request_number}] {notice.change_description}",
                change_type=notice.change_type or 'content_change',
                originator_id=notice.requested_by,
                required_reviewers=last_rev.required_reviewers if last_rev else 1,
            )
            db.session.add(rev)
            db.session.flush()
            notice.resulting_revision_id = rev.id

    elif action == 'rejected':
        notice.status = 'rejected'
        notice.rejection_reason = data.get('rejection_reason', '')

    db.session.commit()

    result = {'message': f'Change Notice {action}'}
    if action == 'approved' and notice.resulting_revision_id:
        result['revision_id'] = notice.resulting_revision_id
        result['message'] = f'Change Notice disetujui — Revisi baru (Rev {new_rev_num:02d}) otomatis dibuat'
    return jsonify(result)


# ============================================================
# DISTRIBUTION — FRM-DCC-04 + FRM-DCC-01 (dcc.md Tahap 4)
# ============================================================

@dcc_bp.route('/documents/<int:doc_id>/distribute', methods=['POST'])
@jwt_required()
def distribute_document(doc_id):
    """Distribute document revision to departments (FRM-DCC-04)"""
    doc = db.session.get(DccDocument, doc_id) or abort(404)
    user_id = get_jwt_identity()
    data = request.get_json()

    rev_id = data.get('revision_id')
    departments = data.get('departments', [])
    copy_type = data.get('copy_type', 'controlled')

    rev = db.session.get(DccDocumentRevision, rev_id) or abort(404)
    now = datetime.utcnow()

    created = []
    for i, dept in enumerate(departments):
        dist = DccDocumentDistribution(
            revision_id=rev_id,
            copy_number=i + 1,
            copy_type=copy_type,
            department_target=dept,
            distributed_at=now,
            distributed_by=user_id,
        )
        db.session.add(dist)
        created.append(dept)

    db.session.commit()
    return jsonify({'message': f'Dokumen didistribusikan ke {len(created)} departemen', 'departments': created})


@dcc_bp.route('/documents/<int:doc_id>/distributions', methods=['GET'])
@jwt_required()
def get_distributions(doc_id):
    """Get distribution list for a document (FRM-DCC-04)"""
    revisions = DccDocumentRevision.query.filter_by(document_id=doc_id).all()
    rev_ids = [r.id for r in revisions]

    dists = DccDocumentDistribution.query.filter(
        DccDocumentDistribution.revision_id.in_(rev_ids)
    ).order_by(DccDocumentDistribution.created_at.desc()).all()

    return jsonify({'distributions': [{
        'id': d.id, 'revision_id': d.revision_id, 'copy_number': d.copy_number,
        'copy_type': d.copy_type, 'department_target': d.department_target,
        'distributed_at': d.distributed_at.isoformat() if d.distributed_at else None,
        'distributed_by': d.distributed_by_user.full_name if d.distributed_by_user else None,
        'received_by': d.received_by_user.full_name if d.received_by_user else None,
        'received_at': d.received_at.isoformat() if d.received_at else None,
        'is_acknowledged': d.is_acknowledged,
        'old_copy_returned': d.old_copy_returned,
    } for d in dists]})


@dcc_bp.route('/distribution/<int:dist_id>/acknowledge', methods=['POST'])
@jwt_required()
def acknowledge_distribution(dist_id):
    """Penerima TTD digital (FRM-DCC-01 Serah Terima Dokumen)"""
    dist = db.session.get(DccDocumentDistribution, dist_id) or abort(404)
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    dist.received_by = user_id
    dist.received_at = datetime.utcnow()
    dist.is_acknowledged = True
    dist.old_copy_returned = data.get('old_copy_returned', False)
    if dist.old_copy_returned:
        dist.old_copy_returned_at = datetime.utcnow()

    db.session.commit()
    return jsonify({'message': 'Dokumen berhasil diterima (FRM-DCC-01)'})


# ============================================================
# DOCUMENT REVIEW — FRM-DCC-10 (dcc.md Tahap 4)
# ============================================================

@dcc_bp.route('/documents/<int:doc_id>/reviews', methods=['GET'])
@jwt_required()
def get_document_reviews(doc_id):
    """Get review history for a document"""
    reviews = DccDocumentReview.query.filter_by(document_id=doc_id)\
        .order_by(DccDocumentReview.review_date.desc()).all()
    return jsonify({'reviews': [{
        'id': r.id, 'review_date': r.review_date.isoformat() if r.review_date else None,
        'review_result': r.review_result, 'review_notes': r.review_notes,
        'reviewed_by': r.reviewed_by_user.full_name if r.reviewed_by_user else None,
        'next_review_date': r.next_review_date.isoformat() if r.next_review_date else None,
    } for r in reviews]})


@dcc_bp.route('/documents/<int:doc_id>/review', methods=['POST'])
@jwt_required()
def submit_document_review(doc_id):
    """Submit kaji ulang dokumen (FRM-DCC-10)"""
    doc = db.session.get(DccDocument, doc_id) or abort(404)
    user_id = get_jwt_identity()
    data = request.get_json()

    review = DccDocumentReview(
        document_id=doc_id,
        review_date=date.today(),
        review_result=data['review_result'],  # still_relevant, needs_revision, obsolete
        review_notes=data.get('review_notes', ''),
        reviewed_by=user_id,
        next_review_date=datetime.strptime(data['next_review_date'], '%Y-%m-%d').date() if data.get('next_review_date') else None,
    )
    db.session.add(review)

    # If obsolete, mark document
    if data['review_result'] == 'obsolete':
        current_rev = doc.current_revision
        if current_rev:
            current_rev.status = 'obsolete'
            current_rev.obsoleted_at = datetime.utcnow()
            current_rev.obsoleted_by = user_id

    db.session.commit()
    return jsonify({'message': 'Kaji ulang berhasil disimpan', 'id': review.id})


@dcc_bp.route('/documents/expiring', methods=['GET'])
@jwt_required()
def get_expiring_documents():
    """Get documents expiring in 3-4 months (for review alert)"""
    threshold = date.today() + timedelta(days=120)
    revisions = DccDocumentRevision.query.filter(
        DccDocumentRevision.status == 'active',
        DccDocumentRevision.expiry_date.isnot(None),
        DccDocumentRevision.expiry_date <= threshold,
    ).all()

    return jsonify({'expiring': [{
        'document_id': r.document_id,
        'document_number': r.document.document_number if r.document else None,
        'title': r.document.title if r.document else None,
        'revision_number': r.revision_number,
        'expiry_date': r.expiry_date.isoformat() if r.expiry_date else None,
        'days_remaining': (r.expiry_date - date.today()).days if r.expiry_date else None,
    } for r in revisions]})


# ============================================================
# QUALITY RECORDS — FRM-DCC-03 (dcc.md Sub-Modul II)
# ============================================================

@dcc_bp.route('/quality-records', methods=['GET'])
@jwt_required()
def get_quality_records():
    """Daftar Induk Rekaman Mutu (FRM-DCC-03)"""
    record_type = request.args.get('type')
    department = request.args.get('department')
    status = request.args.get('status', 'active')
    search = request.args.get('search', '')

    query = DccQualityRecord.query
    if record_type:
        query = query.filter_by(record_type=record_type)
    if department:
        query = query.filter_by(department=department)
    if status:
        query = query.filter_by(status=status)
    if search:
        query = query.filter(or_(
            DccQualityRecord.record_number.ilike(f'%{search}%'),
            DccQualityRecord.title.ilike(f'%{search}%'),
        ))

    records = query.order_by(DccQualityRecord.record_number).all()
    return jsonify({'quality_records': [{
        'id': r.id, 'record_number': r.record_number, 'title': r.title,
        'record_type': r.record_type, 'revision_number': r.revision_number,
        'department': r.department, 'storage_location': r.storage_location,
        'retention_period': r.retention_period, 'is_confidential': r.is_confidential,
        'status': r.status, 'published_date': r.published_date.isoformat() if r.published_date else None,
        'holder': r.holder.full_name if r.holder else None,
        'created_by': r.created_by_user.full_name if r.created_by_user else None,
    } for r in records]})


@dcc_bp.route('/quality-records', methods=['POST'])
@jwt_required()
def create_quality_record():
    """Create quality record entry"""
    data = request.get_json()
    user_id = get_jwt_identity()

    record = DccQualityRecord(
        record_number=data['record_number'],
        title=data['title'],
        record_type=data.get('record_type', 'smm'),
        revision_number=data.get('revision_number', 0),
        department=data['department'],
        holder_id=data.get('holder_id'),
        storage_location=data.get('storage_location'),
        retention_period=data.get('retention_period'),
        is_confidential=data.get('is_confidential', False),
        status='active',
        published_date=datetime.strptime(data['published_date'], '%Y-%m-%d').date() if data.get('published_date') else date.today(),
        created_by=user_id,
    )
    db.session.add(record)
    db.session.commit()
    return jsonify({'message': 'Rekaman mutu berhasil dibuat', 'id': record.id}), 201


@dcc_bp.route('/quality-records/<int:rec_id>', methods=['GET'])
@jwt_required()
def get_quality_record_detail(rec_id):
    """Get quality record detail"""
    r = db.session.get(DccQualityRecord, rec_id) or abort(404)
    return jsonify({
        'id': r.id, 'record_number': r.record_number, 'title': r.title,
        'record_type': r.record_type, 'revision_number': r.revision_number,
        'department': r.department, 'storage_location': r.storage_location,
        'retention_period': r.retention_period,
        'retention_expiry_date': r.retention_expiry_date.isoformat() if r.retention_expiry_date else None,
        'is_confidential': r.is_confidential, 'status': r.status,
        'published_date': r.published_date.isoformat() if r.published_date else None,
        'holder': r.holder.full_name if r.holder else None,
        'created_by': r.created_by_user.full_name if r.created_by_user else None,
    })


@dcc_bp.route('/quality-records/<int:rec_id>', methods=['PUT'])
@jwt_required()
def update_quality_record(rec_id):
    """Update quality record"""
    r = db.session.get(DccQualityRecord, rec_id) or abort(404)
    data = request.get_json()

    for field in ['title', 'record_type', 'department', 'storage_location',
                  'retention_period', 'is_confidential', 'status', 'revision_number']:
        if field in data:
            setattr(r, field, data[field])
    if 'holder_id' in data:
        r.holder_id = data['holder_id']

    db.session.commit()
    return jsonify({'message': 'Rekaman mutu berhasil diperbarui'})

@dcc_bp.route('/verify/<token>', methods=['GET'])
def verify_document(token):
    rev = DccDocumentRevision.query.filter_by(verification_token=token).first()
    if not rev:
        return jsonify({'valid': False, 'message': 'Token tidak valid'}), 404
    return jsonify({
        'valid': True,
        'document_number': rev.document.document_number,
        'title': rev.document.title,
        'revision_number': rev.revision_number,
        'effective_date': rev.effective_date.isoformat() if rev.effective_date else None,
        'signatures': [
            {
                'role': 'Pembuat',
                'name': rev.originator.full_name if rev.originator else None,
                'signed_at': rev.originator_signed_at.isoformat() if rev.originator_signed_at else None,
                'method': 'Tanda tangan digital terverifikasi password',
                'status': 'approved',
            },
            {
                'role': 'Pemeriksa 1',
                'name': rev.reviewer.full_name if rev.reviewer else None,
                'signed_at': rev.reviewer_signed_at.isoformat() if rev.reviewer_signed_at else None,
                'method': 'Tanda tangan digital terverifikasi password',
                'status': rev.reviewer_status,
            },
            *([{
                'role': 'Pemeriksa 2',
                'name': rev.reviewer2.full_name if rev.reviewer2 else None,
                'signed_at': rev.reviewer2_signed_at.isoformat() if rev.reviewer2_signed_at else None,
                'method': 'Tanda tangan digital terverifikasi password',
                'status': rev.reviewer2_status,
            }] if rev.required_reviewers and rev.required_reviewers >= 2 else []),
            {
                'role': 'Pengesah',
                'name': rev.approver.full_name if rev.approver else None,
                'signed_at': rev.approver_signed_at.isoformat() if rev.approver_signed_at else None,
                'method': 'Tanda tangan digital terverifikasi password',
                'status': rev.approver_status,
            },
        ]
    })