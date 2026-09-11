"""
Document Management System Models
Dynamic template-based document generation (Surat Jalan, SPK, etc.)
"""
from datetime import datetime
from models import db
from sqlalchemy.dialects.postgresql import JSON

class DocumentTemplate(db.Model):
    """Template FAMILY (Print Template Designer, rebuilt from scratch).

    Holds identity/document_type/default-flag only - the actual visual design
    lives in TemplateVersion rows. `current_version_id` points at whichever
    version is LIVE (the one render_template_version_to_html() actually reads);
    every other version stays in the table forever as history/rollback targets,
    never deleted. NULL current_version_id = family exists but nothing
    published yet (still draft-only).

    Access control (Fase 3): access_scope = 'all' (default, everyone with
    generic template-viewing access can see/edit it) | 'role' (restricted to
    role IDs in access_role_ids) | 'user' (restricted to user IDs in
    access_user_ids). JSON list of IDs rather than a join table - informal,
    but matches the existing string/JSON-based RBAC convention used elsewhere
    in this codebase (permission keys as strings, not normalized tables).
    is_admin/is_super_admin users always bypass this (see
    routes/document_management.py::_user_can_access_template)."""
    __tablename__ = 'document_templates'

    id = db.Column(db.Integer, primary_key=True)

    template_name = db.Column(db.String(100), nullable=False)
    template_code = db.Column(db.String(50), unique=True, nullable=False)
    document_type = db.Column(db.String(50), nullable=False, index=True)  # surat_jalan, spk, spk_batch, invoice, purchase_order, etc

    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_default = db.Column(db.Boolean, default=False, nullable=False)  # 1 per document_type, enforced app-level (same pattern as ProductionRecipe.is_default)

    access_scope = db.Column(db.String(20), default='all', nullable=False)  # all, role, user
    access_role_ids = db.Column(JSON, nullable=True)  # list[int] Role.id - used when access_scope='role'
    access_user_ids = db.Column(JSON, nullable=True)  # list[int] User.id - used when access_scope='user'

    current_version_id = db.Column(db.Integer, db.ForeignKey('template_versions.id', use_alter=True, name='fk_document_templates_current_version'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    # Relationships
    versions = db.relationship('TemplateVersion', back_populates='template', cascade='all, delete-orphan', foreign_keys='TemplateVersion.document_template_id')
    current_version = db.relationship('TemplateVersion', foreign_keys=[current_version_id], post_update=True)
    created_by_user = db.relationship('User', foreign_keys=[created_by])

    def __repr__(self):
        return f'<DocumentTemplate {self.template_name}>'


class TemplateVersion(db.Model):
    """1 saved design revision of a template (Print Template Designer).

    canvas_data is Fabric.js's OWN serialization (canvas.toJSON([...extra
    props])) stored as-is - no custom JSON schema layered on top of it, per
    the architecture decision. Custom element metadata (elementType,
    fieldPath, dataSource, columns for repeating tables, etc) lives inside
    canvas_data's object entries because they were registered as extra
    properties in the frontend's toJSON() call, not as separate columns here.

    Coordinates inside canvas_data are in millimeters directly (1 Fabric unit
    = 1mm) - the render engine uses them as CSS `mm` values with zero
    conversion. Zoom in the editor is a pure view-transform, never baked into
    stored object coordinates.

    Never deleted - status moves draft -> published -> archived. Rollback =
    point DocumentTemplate.current_version_id back at an older row here."""
    __tablename__ = 'template_versions'

    id = db.Column(db.Integer, primary_key=True)
    document_template_id = db.Column(db.Integer, db.ForeignKey('document_templates.id', ondelete='CASCADE'), nullable=False)

    version_number = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='draft')  # draft, published, archived

    canvas_data = db.Column(JSON, nullable=False)  # fabric.Canvas.toJSON() output, verbatim

    paper_size = db.Column(db.String(20), default='A4')
    orientation = db.Column(db.String(20), default='portrait')
    canvas_width_mm = db.Column(db.Numeric(8, 2), nullable=True)
    canvas_height_mm = db.Column(db.Numeric(8, 2), nullable=True)

    change_note = db.Column(db.Text, nullable=True)

    published_at = db.Column(db.DateTime, nullable=True)
    published_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    # Relationships
    template = db.relationship('DocumentTemplate', back_populates='versions', foreign_keys=[document_template_id])
    published_by_user = db.relationship('User', foreign_keys=[published_by])
    created_by_user = db.relationship('User', foreign_keys=[created_by])

    __table_args__ = (
        db.UniqueConstraint('document_template_id', 'version_number', name='uq_template_version_number'),
    )

    def __repr__(self):
        return f'<TemplateVersion template={self.document_template_id} v{self.version_number} {self.status}>'


class Document(db.Model):
    """Generated documents from templates"""
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Document Info
    document_number = db.Column(db.String(100), unique=True, nullable=False)
    document_title = db.Column(db.String(200))
    document_type = db.Column(db.String(50), nullable=False)
    
    # Template Reference - the EXACT design version this document was generated
    # from (not just "which template family"), so history can always answer
    # "what did this look like when issued". Nullable: (a) Document rows that
    # predate the Print Template Designer rebuild lose this link (their
    # html_content stays frozen/intact regardless - see migration notes), and
    # (b) documents generated outside this template system entirely.
    template_version_id = db.Column(db.Integer, db.ForeignKey('template_versions.id'), nullable=True)
    
    # Document Data (filled template)
    document_data = db.Column(JSON, nullable=False)  # All filled fields
    
    # Reference to source transaction
    reference_type = db.Column(db.String(50))  # sales_order, work_order, purchase_order, etc
    reference_id = db.Column(db.Integer)
    reference_number = db.Column(db.String(100))
    
    # Generated Files
    pdf_path = db.Column(db.String(500))
    excel_path = db.Column(db.String(500))
    html_content = db.Column(db.Text)  # For preview
    
    # Status
    status = db.Column(db.String(50), default='draft')  # draft, generated, printed, sent
    
    # Printing
    print_count = db.Column(db.Integer, default=0)
    last_printed_at = db.Column(db.DateTime)
    printed_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # Signatures (manual for now)
    signature_fields = db.Column(JSON)  # {prepared_by, approved_by, received_by}
    
    # Metadata
    document_date = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # Relationships
    revisions = db.relationship('DocumentRevision', backref='document', lazy='dynamic', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Document {self.document_number}>'


class DocumentRevision(db.Model):
    """Document revision history"""
    __tablename__ = 'document_revisions'
    
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False)
    
    # Revision Info
    revision_number = db.Column(db.Integer, nullable=False)
    revision_note = db.Column(db.Text)
    
    # Previous Data
    previous_data = db.Column(JSON)
    
    # Files
    pdf_path = db.Column(db.String(500))
    excel_path = db.Column(db.String(500))
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    def __repr__(self):
        return f'<DocumentRevision {self.document_id} v{self.revision_number}>'


class DocumentCategory(db.Model):
    """Document categories for organization"""
    __tablename__ = 'document_categories'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Category Info
    category_name = db.Column(db.String(100), nullable=False)
    category_code = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text)
    
    # Numbering Format
    number_prefix = db.Column(db.String(20))  # SJ, SPK, INV, etc
    number_format = db.Column(db.String(100))  # {prefix}-{year}{month}-{sequence}
    next_sequence = db.Column(db.Integer, default=1)
    
    # Configuration
    requires_approval = db.Column(db.Boolean, default=False)
    auto_generate = db.Column(db.Boolean, default=True)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    def __repr__(self):
        return f'<DocumentCategory {self.category_name}>'


class DocumentAttachment(db.Model):
    """Attachments for documents"""
    __tablename__ = 'document_attachments'
    
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False)
    
    # File Info
    file_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_type = db.Column(db.String(50))
    file_size = db.Column(db.Integer)
    
    # Description
    description = db.Column(db.Text)
    
    # Metadata
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    def __repr__(self):
        return f'<DocumentAttachment {self.file_name}>'


class DocumentLog(db.Model):
    """Activity log for documents"""
    __tablename__ = 'document_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=False)
    
    # Activity
    activity_type = db.Column(db.String(50), nullable=False)  # created, updated, printed, sent, etc
    activity_description = db.Column(db.Text)
    
    # User
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    user_name = db.Column(db.String(100))
    
    # IP & Device
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(500))
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<DocumentLog {self.activity_type}>'
