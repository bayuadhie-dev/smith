"""
Document Management Routes
Dynamic template-based document generation with PDF/Excel export
"""
from flask import Blueprint, request, jsonify, send_file, render_template_string, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth_decorators import require_permission
from models import db
from models.document_management import (
    DocumentTemplate, TemplateVersion, Document, DocumentRevision,
    DocumentCategory, DocumentAttachment, DocumentLog
)
from models.user import User
from datetime import datetime
from utils import generate_number
import os
import json
from io import BytesIO
from utils.timezone import get_local_now, get_local_today

# For PDF generation
try:
    from weasyprint import HTML, CSS
    WEASYPRINT_AVAILABLE = True
except (ImportError, OSError) as e:
    WEASYPRINT_AVAILABLE = False
    print(f"Warning: WeasyPrint not available. PDF generation will be limited. Error: {e}")

# For Excel generation
try:
    import openpyxl
    from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False
    print("Warning: openpyxl not installed. Excel generation disabled.")

document_bp = Blueprint('document', __name__, url_prefix='/api/documents')


def _user_can_access_template(user_id, template):
    """Fase 3 access control. is_admin/is_super_admin always bypass - template
    access is about who can casually browse/edit DESIGNS, not a security
    boundary against elevated staff. access_scope='all' (the default) means
    no restriction at all, matching pre-Fase-3 behavior for every template
    that predates this feature."""
    if template.access_scope == 'all' or not template.access_scope:
        return True
    user = db.session.get(User, user_id)
    if not user:
        return False
    if user.is_admin or user.is_super_admin:
        return True
    if template.access_scope == 'user':
        return user_id in (template.access_user_ids or [])
    if template.access_scope == 'role':
        user_role_ids = {ur.role_id for ur in user.roles} if hasattr(user, 'roles') else set()
        return bool(user_role_ids.intersection(template.access_role_ids or []))
    return True


@document_bp.route('/templates', methods=['GET'])
@jwt_required()
@require_permission('documents.view')
def get_templates():
    """List template FAMILIES. Each row shows its current live version's status
    summary - the editor's own version list (§ versions endpoints below) is
    where per-version detail/history lives."""
    try:
        current_user_id = int(get_jwt_identity())
        document_type = request.args.get('document_type')

        query = DocumentTemplate.query.filter_by(is_active=True)
        if document_type:
            query = query.filter_by(document_type=document_type)
        templates = query.order_by(DocumentTemplate.document_type, DocumentTemplate.template_name).all()
        templates = [t for t in templates if _user_can_access_template(current_user_id, t)]

        return jsonify({
            'templates': [{
                'id': t.id,
                'template_name': t.template_name,
                'template_code': t.template_code,
                'document_type': t.document_type,
                'is_default': t.is_default,
                'is_active': t.is_active,
                'access_scope': t.access_scope,
                'access_role_ids': t.access_role_ids,
                'access_user_ids': t.access_user_ids,
                'current_version_id': t.current_version_id,
                'current_version_number': t.current_version.version_number if t.current_version else None,
                'current_version_status': t.current_version.status if t.current_version else None,
                'version_count': len(t.versions),
                'updated_at': t.updated_at.isoformat() if t.updated_at else None,
            } for t in templates]
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@document_bp.route('/templates', methods=['POST'])
@jwt_required()
@require_permission('documents.create')
def create_template():
    """Create a new template FAMILY, with an empty draft v1 to start designing in."""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()

        for field in ('template_name', 'template_code', 'document_type'):
            if not data.get(field):
                return jsonify({'error': f'{field} wajib diisi'}), 400

        if DocumentTemplate.query.filter_by(template_code=data['template_code']).first():
            return jsonify({'error': 'template_code sudah dipakai'}), 400

        is_default = bool(data.get('is_default', False))
        if is_default:
            DocumentTemplate.query.filter_by(document_type=data['document_type'], is_default=True).update({'is_default': False})

        access_scope = data.get('access_scope', 'all')
        if access_scope not in ('all', 'role', 'user'):
            return jsonify({'error': 'access_scope harus all, role, atau user'}), 400

        template = DocumentTemplate(
            template_name=data['template_name'],
            template_code=data['template_code'],
            document_type=data['document_type'],
            is_default=is_default,
            is_active=True,
            access_scope=access_scope,
            access_role_ids=data.get('access_role_ids') if access_scope == 'role' else None,
            access_user_ids=data.get('access_user_ids') if access_scope == 'user' else None,
            created_by=current_user_id,
        )
        db.session.add(template)
        db.session.flush()

        version = TemplateVersion(
            document_template_id=template.id,
            version_number=1,
            status='draft',
            canvas_data={'version': 'fabric-6', 'objects': []},
            paper_size=data.get('paper_size', 'A4'),
            orientation=data.get('orientation', 'portrait'),
            created_by=current_user_id,
        )
        db.session.add(version)
        db.session.commit()

        return jsonify({
            'message': 'Template dibuat',
            'template_id': template.id,
            'version_id': version.id,
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/templates/<int:id>', methods=['GET'])
@jwt_required()
@require_permission('documents.view')
def get_template(id):
    """Family detail + list of ALL its versions (history - never deleted)."""
    try:
        current_user_id = int(get_jwt_identity())
        template = db.session.get(DocumentTemplate, id) or abort(404)
        if not _user_can_access_template(current_user_id, template):
            return jsonify({'error': 'Kamu tidak punya akses ke template ini'}), 403

        return jsonify({
            'template': {
                'id': template.id,
                'template_name': template.template_name,
                'template_code': template.template_code,
                'document_type': template.document_type,
                'is_default': template.is_default,
                'is_active': template.is_active,
                'access_scope': template.access_scope,
                'access_role_ids': template.access_role_ids,
                'access_user_ids': template.access_user_ids,
                'current_version_id': template.current_version_id,
                'versions': [{
                    'id': v.id,
                    'version_number': v.version_number,
                    'status': v.status,
                    'change_note': v.change_note,
                    'paper_size': v.paper_size,
                    'orientation': v.orientation,
                    'published_at': v.published_at.isoformat() if v.published_at else None,
                    'created_at': v.created_at.isoformat() if v.created_at else None,
                } for v in sorted(template.versions, key=lambda v: v.version_number, reverse=True)],
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@document_bp.route('/templates/<int:id>', methods=['PUT'])
@jwt_required()
@require_permission('documents.edit')
def update_template(id):
    """Update family metadata only (name/active/default) - design content lives
    in TemplateVersion, edited via the version endpoints below."""
    try:
        current_user_id = int(get_jwt_identity())
        template = db.session.get(DocumentTemplate, id) or abort(404)
        if not _user_can_access_template(current_user_id, template):
            return jsonify({'error': 'Kamu tidak punya akses ke template ini'}), 403
        data = request.get_json()

        if 'template_name' in data:
            template.template_name = data['template_name']
        if 'is_active' in data:
            template.is_active = bool(data['is_active'])
        if 'is_default' in data and data['is_default'] and not template.is_default:
            DocumentTemplate.query.filter_by(document_type=template.document_type, is_default=True).update({'is_default': False})
            template.is_default = True
        elif 'is_default' in data and not data['is_default']:
            template.is_default = False
        if 'access_scope' in data:
            if data['access_scope'] not in ('all', 'role', 'user'):
                return jsonify({'error': 'access_scope harus all, role, atau user'}), 400
            template.access_scope = data['access_scope']
            template.access_role_ids = data.get('access_role_ids') if data['access_scope'] == 'role' else None
            template.access_user_ids = data.get('access_user_ids') if data['access_scope'] == 'user' else None

        db.session.commit()
        return jsonify({'message': 'Template diperbarui', 'template_id': template.id}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/templates/<int:id>/versions', methods=['POST'])
@jwt_required()
@require_permission('documents.create')
def create_template_version(id):
    """Start a new draft version - either blank, or a copy of an existing
    version's canvas_data (typically the current live one, to edit it further
    without touching what's actually in production until Publish)."""
    try:
        current_user_id = int(get_jwt_identity())
        template = db.session.get(DocumentTemplate, id) or abort(404)
        if not _user_can_access_template(current_user_id, template):
            return jsonify({'error': 'Kamu tidak punya akses ke template ini'}), 403
        data = request.get_json() or {}

        copy_from_id = data.get('copy_from_version_id')
        canvas_data = {'version': 'fabric-6', 'objects': []}
        paper_size, orientation = 'A4', 'portrait'
        if copy_from_id:
            source = db.session.get(TemplateVersion, copy_from_id)
            if source and source.document_template_id == template.id:
                canvas_data = source.canvas_data
                paper_size, orientation = source.paper_size, source.orientation

        next_number = db.session.query(db.func.coalesce(db.func.max(TemplateVersion.version_number), 0)).filter_by(document_template_id=template.id).scalar() + 1

        version = TemplateVersion(
            document_template_id=template.id,
            version_number=next_number,
            status='draft',
            canvas_data=canvas_data,
            paper_size=paper_size,
            orientation=orientation,
            change_note=data.get('change_note'),
            created_by=current_user_id,
        )
        db.session.add(version)
        db.session.commit()

        return jsonify({'message': 'Versi draft baru dibuat', 'version_id': version.id, 'version_number': version.version_number}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/templates/<int:id>/versions/<int:version_id>', methods=['GET'])
@jwt_required()
@require_permission('documents.view')
def get_template_version(id, version_id):
    try:
        current_user_id = int(get_jwt_identity())
        version = db.session.get(TemplateVersion, version_id)
        if not version or version.document_template_id != id:
            abort(404)
        if not _user_can_access_template(current_user_id, version.template):
            return jsonify({'error': 'Kamu tidak punya akses ke template ini'}), 403

        return jsonify({
            'version': {
                'id': version.id,
                'document_template_id': version.document_template_id,
                'version_number': version.version_number,
                'status': version.status,
                'canvas_data': version.canvas_data,
                'paper_size': version.paper_size,
                'orientation': version.orientation,
                'canvas_width_mm': float(version.canvas_width_mm) if version.canvas_width_mm else None,
                'canvas_height_mm': float(version.canvas_height_mm) if version.canvas_height_mm else None,
                'change_note': version.change_note,
                'document_type': version.template.document_type,
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@document_bp.route('/templates/<int:id>/versions/<int:version_id>', methods=['PUT'])
@jwt_required()
@require_permission('documents.edit')
def update_template_version(id, version_id):
    """Save draft progress. Only 'draft' versions are editable - a published
    or archived version is frozen (any further edit must go through a new
    draft version via POST .../versions, so Documents already generated from
    it stay reproducible)."""
    try:
        current_user_id = int(get_jwt_identity())
        version = db.session.get(TemplateVersion, version_id)
        if not version or version.document_template_id != id:
            abort(404)
        if not _user_can_access_template(current_user_id, version.template):
            return jsonify({'error': 'Kamu tidak punya akses ke template ini'}), 403
        if version.status != 'draft':
            return jsonify({'error': f'Versi ini berstatus "{version.status}", tidak bisa diedit lagi. Buat versi draft baru dari sini kalau mau lanjut edit.'}), 400

        data = request.get_json()
        if 'canvas_data' in data:
            version.canvas_data = data['canvas_data']
        if 'paper_size' in data:
            version.paper_size = data['paper_size']
        if 'orientation' in data:
            version.orientation = data['orientation']
        if 'canvas_width_mm' in data:
            version.canvas_width_mm = data['canvas_width_mm']
        if 'canvas_height_mm' in data:
            version.canvas_height_mm = data['canvas_height_mm']
        if 'change_note' in data:
            version.change_note = data['change_note']

        db.session.commit()
        return jsonify({'message': 'Draft disimpan', 'version_id': version.id}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/templates/<int:id>/versions/<int:version_id>/publish', methods=['POST'])
@jwt_required()
@require_permission('documents.create')
def publish_template_version(id, version_id):
    """Make this version the LIVE one - render_template_version_to_html() picks
    it up immediately for every subsequent document generated. The version
    that was live before (if any) moves to 'archived', never deleted."""
    try:
        current_user_id = int(get_jwt_identity())
        template = db.session.get(DocumentTemplate, id) or abort(404)
        if not _user_can_access_template(current_user_id, template):
            return jsonify({'error': 'Kamu tidak punya akses ke template ini'}), 403
        version = db.session.get(TemplateVersion, version_id)
        if not version or version.document_template_id != id:
            abort(404)
        if not version.canvas_data.get('objects'):
            return jsonify({'error': 'Desain masih kosong, tidak ada elemen untuk di-publish.'}), 400

        if template.current_version_id and template.current_version_id != version.id:
            previous = db.session.get(TemplateVersion, template.current_version_id)
            if previous and previous.status == 'published':
                previous.status = 'archived'

        version.status = 'published'
        version.published_at = get_local_now()
        version.published_by = current_user_id
        template.current_version_id = version.id

        db.session.commit()
        return jsonify({'message': f'Versi {version.version_number} sekarang live', 'version_id': version.id}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/templates/<int:id>/versions/<int:version_id>/rollback', methods=['POST'])
@jwt_required()
@require_permission('documents.create')
def rollback_template_version(id, version_id):
    """Point current_version_id back at an older (archived/published) version -
    the version being rolled back FROM moves to 'archived' too. Nothing is
    ever deleted; this is purely a pointer change plus a status flip."""
    try:
        current_user_id = int(get_jwt_identity())
        template = db.session.get(DocumentTemplate, id) or abort(404)
        if not _user_can_access_template(current_user_id, template):
            return jsonify({'error': 'Kamu tidak punya akses ke template ini'}), 403
        target = db.session.get(TemplateVersion, version_id)
        if not target or target.document_template_id != id:
            abort(404)
        if target.status == 'draft':
            return jsonify({'error': 'Tidak bisa rollback ke versi draft - cuma versi yang pernah published.'}), 400

        if template.current_version_id and template.current_version_id != target.id:
            current = db.session.get(TemplateVersion, template.current_version_id)
            if current and current.status == 'published':
                current.status = 'archived'

        target.status = 'published'
        template.current_version_id = target.id

        db.session.commit()
        return jsonify({'message': f'Rollback ke versi {target.version_number} berhasil'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/templates/<int:id>/versions/<int:version_id>/preview-pdf', methods=['POST'])
@jwt_required()
@require_permission('documents.create')
def preview_template_version_pdf(id, version_id):
    """Live preview from inside the editor - renders canvas_data AS-IS (even
    while still draft) against either data the caller supplies, or an
    auto-built sample (field label standing in for its own value) so preview
    works before any real transaction data is wired up."""
    try:
        if not WEASYPRINT_AVAILABLE:
            return jsonify({'error': 'PDF generation not available. Install WeasyPrint.'}), 500

        current_user_id = int(get_jwt_identity())
        version = db.session.get(TemplateVersion, version_id)
        if not version or version.document_template_id != id:
            abort(404)
        if not _user_can_access_template(current_user_id, version.template):
            return jsonify({'error': 'Kamu tidak punya akses ke template ini'}), 403

        data = request.get_json() or {}
        document_data = data.get('document_data')
        if not document_data:
            from utils.field_library import get_field_library, COMPANY_FIELDS
            from utils.company_context import get_company_context
            library = get_field_library(version.template.document_type)
            # company.* is real data (already nested under document_data['company']) -
            # everything else is a flat top-level key per the field_library convention,
            # filled with its own label as a readable placeholder value.
            document_data = {'company': get_company_context()}
            for group_name, group_fields in library.items():
                if group_name == 'company':
                    continue
                for f in group_fields:
                    if f['type'] == 'list':
                        sample_row = {c['path']: c['label'] for c in f.get('columns', [])}
                        document_data[f['path']] = [sample_row, sample_row]
                    elif f['type'] != 'image':
                        document_data[f['path']] = f['label']

        from utils.template_render_engine import render_template_version_to_html
        html = render_template_version_to_html(version, document_data)

        pdf_buffer = BytesIO()
        HTML(string=html).write_pdf(pdf_buffer)
        pdf_buffer.seek(0)

        return send_file(pdf_buffer, mimetype='application/pdf', as_attachment=False, download_name='preview.pdf')

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@document_bp.route('/field-library/<document_type>', methods=['GET'])
@jwt_required()
@require_permission('documents.view')
def get_field_library_route(document_type):
    """Backend-owned field registry for the editor's Field Library panel
    (Fase 1, replaces the old hardcoded TS constant in the retired
    TemplateDesigner.tsx). company.* is always included regardless of
    document_type - see utils/field_library.py and utils/company_context.py."""
    try:
        from utils.field_library import get_field_library
        return jsonify(get_field_library(document_type)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@document_bp.route('/generate', methods=['POST'])
@jwt_required()
@require_permission('documents.create')
def generate_document():
    """Generate document from template"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()

        template = db.session.get(DocumentTemplate, data['template_id']) or abort(404)
        if not template.current_version_id:
            return jsonify({'error': f'Template "{template.template_name}" belum punya versi yang di-publish. Selesaikan desain dan publish dulu di Template Designer.'}), 400

        # Generate document number
        document_number = generate_number(
            data.get('number_prefix', 'DOC'),
            Document,
            'document_number'
        )

        from utils.company_context import get_company_context
        document_data = dict(data['document_data'])
        document_data['company'] = get_company_context()

        # Create document
        document = Document(
            document_number=document_number,
            document_title=data.get('document_title'),
            document_type=template.document_type,
            template_version_id=template.current_version_id,
            document_data=document_data,
            reference_type=data.get('reference_type'),
            reference_id=data.get('reference_id'),
            reference_number=data.get('reference_number'),
            signature_fields=data.get('signature_fields'),
            document_date=datetime.fromisoformat(data['document_date']) if data.get('document_date') else get_local_now(),
            created_by=current_user_id
        )

        # Generate HTML content for preview
        from utils.template_render_engine import render_template_version_to_html
        document.html_content = render_template_version_to_html(template.current_version, document_data)
        
        db.session.add(document)
        db.session.flush()
        
        # Log activity
        log = DocumentLog(
            document_id=document.id,
            activity_type='created',
            activity_description=f'Document {document_number} created',
            user_id=current_user_id
        )
        db.session.add(log)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Document generated successfully',
            'document_id': document.id,
            'document_number': document_number
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/<int:id>/preview', methods=['GET'])
@jwt_required()
@require_permission('documents.view')
def preview_document(id):
    """Get document HTML preview"""
    try:
        document = db.session.get(Document, id) or abort(404)
        
        return jsonify({
            'document': {
                'id': document.id,
                'document_number': document.document_number,
                'document_title': document.document_title,
                'html_content': document.html_content,
                'status': document.status,
                # Peringatan wajib tidak-bisa-di-dismiss untuk dokumen usang (R11, §7.1) —
                # frontend WAJIB tampilkan ini besar-besar tiap dokumen superseded dibuka.
                'is_superseded': document.status == 'superseded',
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@document_bp.route('/<int:id>/spk-data', methods=['PUT'])
@jwt_required()
@require_permission('documents.edit')
def update_spk_data(id):
    """Edit an SPK's business data (qty/notes) after it's been generated - 2026-08-24,
    SPK_STAGING_BAHAN_BAKU_RENCANA_TEKNIS.md §6. Only document_data (the business-data
    JSON snapshot: qty, notes, etc) is editable here, NEVER the print layout/design
    (template_version_id/canvas_data - that's Print Template Designer's domain, shared
    across every SPK of this type, not this one instance).

    Per the explicit decision on staging-after-edit: this endpoint does NOT touch
    MaterialIssue/MaterialIssueItem at all - staging stays frozen at whatever it was
    when the SPK was first approved. If the edited qty creates a gap, that surfaces
    through the ALREADY-EXISTING shortage picklist (GET /material-issues/shortages),
    which for SPK-sourced items compares against this CURRENT document_data quantity
    rather than the frozen MaterialIssueItem.required_quantity - see that endpoint.
    Follow-up on any gap is manual (staff creates an additional MaterialIssue), not
    automatic - this endpoint never creates/modifies staging records.

    Old document_data is snapshotted to DocumentRevision first (audit trail), then
    document_data is updated and html_content re-rendered from the SAME template
    version (design untouched)."""
    from utils.template_render_engine import render_template_version_to_html

    try:
        document = db.session.get(Document, id) or abort(404)
        if document.document_type not in ('spk_batch', 'spk'):
            return jsonify({'error': 'Endpoint ini hanya untuk dokumen SPK'}), 400
        if document.status == 'superseded':
            return jsonify({'error': 'SPK ini sudah superseded (nomor batch pernah diubah) - edit versi SPK yang aktif'}), 400

        user_id = get_jwt_identity()
        data = request.get_json() or {}

        editable_fields = ('quantity', 'notes')
        changes = {k: v for k, v in data.items() if k in editable_fields}
        if not changes:
            return jsonify({'error': f'Tidak ada field yang bisa diedit dalam payload (boleh: {", ".join(editable_fields)})'}), 400

        last_revision = DocumentRevision.query.filter_by(document_id=document.id).order_by(DocumentRevision.revision_number.desc()).first()
        next_revision_number = (last_revision.revision_number + 1) if last_revision else 1

        revision = DocumentRevision(
            document_id=document.id,
            revision_number=next_revision_number,
            revision_note=f'Edit qty/catatan SPK oleh user #{user_id}',
            previous_data=dict(document.document_data or {}),
            created_by=user_id,
        )
        db.session.add(revision)

        new_data = dict(document.document_data or {})
        new_data.update(changes)
        document.document_data = new_data

        if document.template_version_id:
            template_version = db.session.get(TemplateVersion, document.template_version_id)
            if template_version:
                document.html_content = render_template_version_to_html(template_version, new_data)

        log = DocumentLog(
            document_id=document.id,
            activity_type='edited',
            activity_description=f'SPK data diedit: {", ".join(changes.keys())}',
            user_id=user_id
        )
        db.session.add(log)

        db.session.commit()

        return jsonify({
            'message': 'SPK diperbarui',
            'document': {
                'id': document.id,
                'document_data': document.document_data,
                'html_content': document.html_content,
            },
            'revision_number': next_revision_number,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/<int:id>/pdf', methods=['GET'])
@jwt_required()
@require_permission('documents.view')
def generate_pdf(id):
    """Generate and download PDF"""
    try:
        current_user_id = get_jwt_identity()
        document = db.session.get(Document, id) or abort(404)
        
        if not WEASYPRINT_AVAILABLE:
            return jsonify({'error': 'PDF generation not available. Install WeasyPrint.'}), 500
        
        # Generate PDF from HTML
        html_content = document.html_content
        if document.status == 'superseded':
            # Dokumen usang (R11, §7.1) — peringatan wajib ditempel di file fisiknya juga,
            # bukan cuma di UI, karena PDF ini bisa diunduh/dicetak lepas dari aplikasi.
            warning_banner = (
                '<div style="background:#dc2626;color:#fff;padding:16px;margin-bottom:16px;'
                'text-align:center;font-weight:bold;font-size:16px;border:3px solid #7f1d1d;">'
                'DOKUMEN INI SUDAH USANG — nomor batch sudah berubah, JANGAN DIPAKAI. '
                'Minta cetak ulang SPK yang berlaku saat ini.</div>'
            )
            html_content = warning_banner + (html_content or '')
        pdf_buffer = BytesIO()
        
        HTML(string=html_content).write_pdf(pdf_buffer)
        pdf_buffer.seek(0)
        
        # Update print count
        document.print_count += 1
        document.last_printed_at = get_local_now()
        document.printed_by = current_user_id
        
        # Log activity
        log = DocumentLog(
            document_id=document.id,
            activity_type='printed',
            activity_description=f'Document {document.document_number} printed as PDF',
            user_id=current_user_id
        )
        db.session.add(log)
        db.session.commit()
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'{document.document_number}.pdf'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@document_bp.route('/<int:id>/excel', methods=['GET'])
@jwt_required()
@require_permission('documents.view')
def generate_excel(id):
    """Generate and download Excel"""
    try:
        current_user_id = get_jwt_identity()
        document = db.session.get(Document, id) or abort(404)
        
        if not OPENPYXL_AVAILABLE:
            return jsonify({'error': 'Excel generation not available. Install openpyxl.'}), 500
        
        # Create workbook
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = document.document_type.upper()
        
        # Styling
        header_font = Font(bold=True, size=12)
        header_fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')
        border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        
        # Add document data
        row = 1
        
        # Document header
        ws.merge_cells(f'A{row}:D{row}')
        ws[f'A{row}'] = document.document_title or document.document_type.upper()
        ws[f'A{row}'].font = Font(bold=True, size=14)
        ws[f'A{row}'].alignment = Alignment(horizontal='center')
        row += 2
        
        # Document number and date
        ws[f'A{row}'] = 'Document Number:'
        ws[f'B{row}'] = document.document_number
        ws[f'A{row}'].font = header_font
        row += 1
        
        ws[f'A{row}'] = 'Date:'
        ws[f'B{row}'] = document.document_date.strftime('%Y-%m-%d')
        ws[f'A{row}'].font = header_font
        row += 2
        
        # Document data
        document_data = document.document_data
        
        for key, value in document_data.items():
            if isinstance(value, list):
                # Table data
                ws[f'A{row}'] = key.replace('_', ' ').title()
                ws[f'A{row}'].font = header_font
                row += 1
                
                if value and isinstance(value[0], dict):
                    # Headers
                    col = 1
                    for header in value[0].keys():
                        cell = ws.cell(row=row, column=col)
                        cell.value = header.replace('_', ' ').title()
                        cell.font = header_font
                        cell.fill = header_fill
                        cell.border = border
                        col += 1
                    row += 1
                    
                    # Data rows
                    for item in value:
                        col = 1
                        for val in item.values():
                            cell = ws.cell(row=row, column=col)
                            cell.value = val
                            cell.border = border
                            col += 1
                        row += 1
                row += 1
            else:
                # Simple key-value
                ws[f'A{row}'] = key.replace('_', ' ').title()
                ws[f'B{row}'] = str(value)
                ws[f'A{row}'].font = header_font
                row += 1
        
        # Auto-adjust column widths
        for column in ws.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(cell.value)
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
        
        # Save to buffer
        excel_buffer = BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)
        
        # Log activity
        log = DocumentLog(
            document_id=document.id,
            activity_type='exported',
            activity_description=f'Document {document.document_number} exported to Excel',
            user_id=current_user_id
        )
        db.session.add(log)
        db.session.commit()
        
        return send_file(
            excel_buffer,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'{document.document_number}.xlsx'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@document_bp.route('', methods=['GET'])
@jwt_required()
@require_permission('documents.view')
def get_documents():
    """Get all documents with filters"""
    try:
        document_type = request.args.get('document_type')
        status = request.args.get('status')
        reference_type = request.args.get('reference_type')
        
        query = Document.query
        
        if document_type:
            query = query.filter_by(document_type=document_type)
        if status:
            query = query.filter_by(status=status)
        if reference_type:
            query = query.filter_by(reference_type=reference_type)
        
        documents = query.order_by(Document.created_at.desc()).all()
        
        return jsonify({
            'documents': [{
                'id': d.id,
                'document_number': d.document_number,
                'document_title': d.document_title,
                'document_type': d.document_type,
                'reference_number': d.reference_number,
                'status': d.status,
                'document_date': d.document_date.isoformat(),
                'print_count': d.print_count,
                'created_at': d.created_at.isoformat()
            } for d in documents]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@document_bp.route('/<int:id>/print', methods=['POST'])
@jwt_required()
@require_permission('documents.create')
def record_print(id):
    """Record document print"""
    try:
        current_user_id = get_jwt_identity()
        document = db.session.get(Document, id) or abort(404)
        
        document.print_count += 1
        document.last_printed_at = get_local_now()
        document.printed_by = current_user_id
        document.status = 'printed'
        
        # Log activity
        log = DocumentLog(
            document_id=document.id,
            activity_type='printed',
            activity_description=f'Document {document.document_number} printed',
            user_id=current_user_id
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({
            'message': 'Print recorded',
            'print_count': document.print_count
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@document_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('documents.delete')
def delete_document(id):
    """Delete document"""
    try:
        document = db.session.get(Document, id) or abort(404)
        
        # Delete related logs
        DocumentLog.query.filter_by(document_id=id).delete()
        
        db.session.delete(document)
        db.session.commit()
        
        return jsonify({'message': 'Document deleted'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/templates/<int:id>/set-default', methods=['PUT'])
@jwt_required()
@require_permission('documents.edit')
def set_default_template(id):
    """Set template as default for its document type"""
    try:
        template = db.session.get(DocumentTemplate, id) or abort(404)
        
        # Remove default from other templates of same type
        DocumentTemplate.query.filter_by(
            document_type=template.document_type,
            is_default=True
        ).update({'is_default': False})
        
        # Set this template as default
        template.is_default = True
        db.session.commit()
        
        return jsonify({
            'message': 'Default template updated',
            'template_id': template.id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/templates/<int:id>', methods=['DELETE'])
@jwt_required()
@require_permission('documents.delete')
def delete_template(id):
    """Delete document template"""
    try:
        template = db.session.get(DocumentTemplate, id) or abort(404)

        version_ids = [v.id for v in template.versions]
        doc_count = Document.query.filter(Document.template_version_id.in_(version_ids)).count() if version_ids else 0
        if doc_count > 0:
            return jsonify({
                'error': f'Template is used by {doc_count} documents. Cannot delete.'
            }), 400

        # Clear the self-referential pointer first, or deleting the version rows
        # (cascaded below) can conflict with current_version_id still pointing at one.
        template.current_version_id = None
        db.session.flush()
        db.session.delete(template)
        db.session.commit()
        
        return jsonify({'message': 'Template deleted'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500



@document_bp.route('/categories', methods=['GET'])
@jwt_required()
@require_permission('documents.view')
def get_categories():
    """Get document categories"""
    try:
        categories = DocumentCategory.query.filter_by(is_active=True).all()
        
        return jsonify({
            'categories': [{
                'id': c.id,
                'category_name': c.category_name,
                'category_code': c.category_code,
                'number_prefix': c.number_prefix,
                'number_format': c.number_format
            } for c in categories]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@document_bp.route('/generate-from-sales-order/<int:sales_order_id>', methods=['POST'])
@jwt_required()
@require_permission('documents.create')
def generate_from_sales_order(sales_order_id):
    """Auto-generate Surat Jalan from Sales Order (like Accurate)"""
    try:
        current_user_id = get_jwt_identity()
        
        from utils.document_generator import generate_surat_jalan_from_sales_order
        document = generate_surat_jalan_from_sales_order(sales_order_id, current_user_id)
        
        return jsonify({
            'message': 'Surat Jalan generated successfully',
            'document_id': document.id,
            'document_number': document.document_number
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@document_bp.route('/generate-from-work-order/<int:work_order_id>', methods=['POST'])
@jwt_required()
@require_permission('documents.create')
def generate_from_work_order(work_order_id):
    """Auto-generate SPK from Work Order (like Accurate)"""
    try:
        current_user_id = get_jwt_identity()
        
        from utils.document_generator import generate_spk_from_work_order
        document = generate_spk_from_work_order(work_order_id, current_user_id)
        
        return jsonify({
            'message': 'SPK generated successfully',
            'document_id': document.id,
            'document_number': document.document_number
        }), 201
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/generate-from-invoice/<int:invoice_id>', methods=['POST'])
@jwt_required()
@require_permission('documents.create')
def generate_from_invoice(invoice_id):
    """Auto-generate printable Invoice document. Invoice had no print mechanism
    at all before Print Template Designer Fase 1 - this endpoint was missed
    when that generator was first written and is added now (Fase 2)."""
    try:
        current_user_id = get_jwt_identity()
        from utils.document_generator import generate_invoice_document
        document = generate_invoice_document(invoice_id, current_user_id)
        return jsonify({
            'message': 'Invoice document generated successfully',
            'document_id': document.id,
            'document_number': document.document_number
        }), 201
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/generate-from-purchase-order/<int:po_id>', methods=['POST'])
@jwt_required()
@require_permission('documents.create')
def generate_from_purchase_order(po_id):
    """Auto-generate printable Purchase Order document (Fase 2)."""
    try:
        current_user_id = get_jwt_identity()
        from utils.document_generator import generate_purchase_order_document
        document = generate_purchase_order_document(po_id, current_user_id)
        return jsonify({
            'message': 'PO document generated successfully',
            'document_id': document.id,
            'document_number': document.document_number
        }), 201
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/generate-from-payment/<int:payment_id>', methods=['POST'])
@jwt_required()
@require_permission('documents.create')
def generate_from_payment(payment_id):
    """Auto-generate printable Kwitansi from a Payment record (Fase 2)."""
    try:
        current_user_id = get_jwt_identity()
        from utils.document_generator import generate_kwitansi_document
        document = generate_kwitansi_document(payment_id, current_user_id)
        return jsonify({
            'message': 'Kwitansi generated successfully',
            'document_id': document.id,
            'document_number': document.document_number
        }), 201
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@document_bp.route('/dashboard', methods=['GET'])
@jwt_required()
@require_permission('documents.view')
def get_dashboard():
    """Get document management dashboard stats"""
    try:
        from sqlalchemy import func
        
        total_documents = Document.query.count()
        total_templates = DocumentTemplate.query.filter_by(is_active=True).count()
        
        # Documents by type
        by_type = db.session.query(
            Document.document_type,
            func.count(Document.id)
        ).group_by(Document.document_type).all()
        
        # Recent documents
        recent = Document.query.order_by(Document.created_at.desc()).limit(10).all()
        
        return jsonify({
            'statistics': {
                'total_documents': total_documents,
                'total_templates': total_templates,
                'by_type': [{'type': t[0], 'count': t[1]} for t in by_type]
            },
            'recent_documents': [{
                'id': d.id,
                'document_number': d.document_number,
                'document_type': d.document_type,
                'created_at': d.created_at.isoformat()
            } for d in recent]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
