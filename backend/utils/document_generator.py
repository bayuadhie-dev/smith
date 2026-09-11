"""
Document Generator Utility
Auto-generate documents from transactions (like Accurate)

Print Template Designer rebuild (Fase 1): every generator here now (1) injects
document_data['company'] via utils.company_context.get_company_context() -
company profile is a dynamic field for every document type, never hardcoded
per-template, and (2) renders through utils.template_render_engine (Fabric.js
canvas_data), not the old routes.document_management.render_document_html()
(retired - it only understood the deleted `sections` schema).
"""
from models import db
from models.document_management import DocumentTemplate, TemplateVersion, Document, DocumentLog
from models.sales import SalesOrder, SalesOrderItem
from models.production import WorkOrder
from datetime import datetime
from utils import generate_number
from utils.company_context import get_company_context
from utils.template_render_engine import render_template_version_to_html


def _get_default_template(document_type):
    """Only a template with a PUBLISHED version counts as usable - a family
    row that exists but never got a version (e.g. leftover from before the
    Print Template Designer schema rebuild) is treated as if it doesn't
    exist, so the caller falls through to create a fresh working default."""
    return DocumentTemplate.query.filter_by(
        document_type=document_type, is_default=True, is_active=True
    ).filter(DocumentTemplate.current_version_id.isnot(None)).first()


def _create_default_template(user_id, template_name, template_code, document_type, canvas_objects):
    """Create a template FAMILY + its first (and immediately published) TemplateVersion.
    Used as the fallback proof-of-concept layout whenever no admin-designed
    default exists yet for a document_type - real usage is expected to
    replace these via the Template Designer UI (Fase 1 editor, not built in
    this step), but auto-generation must never be blocked waiting for that."""
    template = DocumentTemplate(
        template_name=template_name,
        template_code=template_code,
        document_type=document_type,
        is_default=True,
        is_active=True,
        created_by=user_id,
    )
    db.session.add(template)
    db.session.flush()

    version = TemplateVersion(
        document_template_id=template.id,
        version_number=1,
        status='published',
        canvas_data={'version': 'fabric-6', 'objects': canvas_objects},
        paper_size='A4',
        orientation='portrait',
        change_note='Auto-generated proof-of-concept layout (Print Template Designer Fase 1)',
        published_at=datetime.utcnow(),
        published_by=user_id,
        created_by=user_id,
    )
    db.session.add(version)
    db.session.flush()

    template.current_version_id = version.id
    db.session.commit()
    return template


def _label(text, left, top, width, height=6, font_size=10, font_weight='normal', text_align='left'):
    return {'type': 'Textbox', 'elementType': 'label', 'left': left, 'top': top, 'width': width, 'height': height,
            'scaleX': 1, 'scaleY': 1, 'text': text, 'fontSize': font_size, 'fontWeight': font_weight,
            'fontFamily': 'Arial', 'textAlign': text_align, 'fill': '#000000'}


def _field(field_path, left, top, width, height=6, font_size=10, font_weight='normal', text_align='left'):
    # text = the field's placeholder label (shown while editing) - fieldPath is
    # what the render engine actually uses; see utils/template_render_engine.py.
    return {'type': 'Textbox', 'elementType': 'field', 'left': left, 'top': top, 'width': width, 'height': height,
            'scaleX': 1, 'scaleY': 1, 'text': field_path, 'fieldPath': field_path, 'fontSize': font_size,
            'fontWeight': font_weight, 'fontFamily': 'Arial', 'textAlign': text_align, 'fill': '#000000'}


def _placeholder_box(element_type, left, top, width, height, **extra_props):
    """A plain Fabric Rect used as the visual stand-in for image/barcode/qrcode/
    repeating_table in the auto-generated proof-of-concept layouts. Deliberately
    NOT a Fabric Group - hand-authoring valid nested-children JSON for Group
    (child coordinates are relative to the group's own center) is fragile to
    get right without going through the actual editor; a flat Rect carries the
    same custom props (elementType, fieldPath, dataSource, columns, ...) just
    as well, since the render engine only ever reads those, never Fabric's own
    `type`. Once someone edits these in the real editor, Fabric will
    re-serialize them as whatever visual representation is used there."""
    return {'type': 'Rect', 'elementType': element_type, 'left': left, 'top': top, 'width': width, 'height': height,
            'scaleX': 1, 'scaleY': 1, 'fill': '#f3f4f6', 'stroke': '#9ca3af', 'strokeWidth': 1, **extra_props}


def _hline(left, top, width, stroke='#333333', stroke_width=1):
    return {'type': 'Line', 'elementType': 'line', 'left': left, 'top': top, 'width': width, 'height': 0,
            'scaleX': 1, 'scaleY': 1, 'x1': 0, 'y1': 0, 'x2': width, 'y2': 0, 'stroke': stroke, 'strokeWidth': stroke_width}


def _company_header_objects():
    """Reusable header block: company name/address + logo, top of the page.
    Every default template includes this - company.* fields are always
    available and always shown, per the explicit requirement."""
    return [
        _placeholder_box('image', 10, 8, 25, 15, fieldPath='company.logo_url'),
        _field('company.name', 40, 8, 120, 6, font_size=13, font_weight='bold'),
        _field('company.address', 40, 15, 120, 5, font_size=8),
        _field('company.phone', 40, 20, 120, 5, font_size=8),
        _hline(10, 27, 190),
    ]


def generate_surat_jalan_from_sales_order(sales_order_id, user_id):
    """
    Generate Surat Jalan from Sales Order
    Like Accurate: Sales Order → Surat Jalan
    """
    try:
        sales_order = db.session.get(SalesOrder, sales_order_id)
        if not sales_order:
            raise ValueError('Sales Order not found')

        template = _get_default_template('surat_jalan')
        if not template:
            template = create_default_surat_jalan_template(user_id)

        doc_number = generate_number('SJ', Document, 'document_number')

        items_data = []
        for item in sales_order.items:
            items_data.append({
                'product_name': item.product.name if item.product else item.description,
                'quantity': float(item.quantity),
                'uom': item.uom,
                'description': item.description or ''
            })

        document_data = {
            'document_number': doc_number,
            'document_date': datetime.utcnow().strftime('%d %B %Y'),
            'sales_order_number': sales_order.order_number,
            'customer_name': sales_order.customer.company_name if sales_order.customer else '',
            'customer_address': sales_order.delivery_address or (sales_order.customer.address if sales_order.customer else ''),
            'customer_phone': sales_order.customer.phone if sales_order.customer else '',
            'items': items_data,
            'total_quantity': sum(float(item.quantity) for item in sales_order.items),
            'notes': sales_order.notes or '',
            'prepared_by': '',
            'received_by': '',
            'driver_name': '',
            'vehicle_number': '',
            'company': get_company_context(),
        }

        document = Document(
            document_number=doc_number,
            document_title=f'Surat Jalan - {sales_order.customer.company_name if sales_order.customer else ""}',
            document_type='surat_jalan',
            template_version_id=template.current_version_id,
            document_data=document_data,
            reference_type='sales_order',
            reference_id=sales_order.id,
            reference_number=sales_order.order_number,
            status='generated',
            created_by=user_id
        )
        document.html_content = render_template_version_to_html(template.current_version, document_data)

        db.session.add(document)
        db.session.flush()

        log = DocumentLog(
            document_id=document.id,
            activity_type='auto_generated',
            activity_description=f'Surat Jalan auto-generated from Sales Order {sales_order.order_number}',
            user_id=user_id
        )
        db.session.add(log)

        db.session.commit()
        return document

    except Exception as e:
        db.session.rollback()
        raise e


def generate_spk_from_work_order(work_order_id, user_id):
    """
    Generate SPK (Surat Perintah Kerja) from Work Order
    Like Accurate: Work Order → SPK
    """
    try:
        work_order = db.session.get(WorkOrder, work_order_id)
        if not work_order:
            raise ValueError('Work Order not found')

        template = _get_default_template('spk')
        if not template:
            template = create_default_spk_template(user_id)

        doc_number = generate_number('SPK', Document, 'document_number')

        document_data = {
            'document_number': doc_number,
            'document_date': datetime.utcnow().strftime('%d %B %Y'),
            'work_order_number': work_order.wo_number,
            'product_name': work_order.product.name if work_order.product else '',
            'product_code': work_order.product.code if work_order.product else '',
            'quantity': float(work_order.quantity),
            'uom': work_order.uom if work_order.uom else 'PCS',
            'start_date': work_order.scheduled_start_date.strftime('%d %B %Y') if work_order.scheduled_start_date else '',
            'due_date': work_order.scheduled_end_date.strftime('%d %B %Y') if work_order.scheduled_end_date else '',
            'priority': work_order.priority or 'normal',
            'notes': work_order.notes or '',
            'machine': work_order.machine.name if work_order.machine else '',
            'operator': '',
            'supervisor': '',
            'approved_by': '',
            'company': get_company_context(),
        }

        document = Document(
            document_number=doc_number,
            document_title=f'SPK - {work_order.product.name if work_order.product else work_order.wo_number}',
            document_type='spk',
            template_version_id=template.current_version_id,
            document_data=document_data,
            reference_type='work_order',
            reference_id=work_order.id,
            reference_number=work_order.wo_number,
            status='generated',
            created_by=user_id
        )
        document.html_content = render_template_version_to_html(template.current_version, document_data)

        db.session.add(document)
        db.session.flush()

        log = DocumentLog(
            document_id=document.id,
            activity_type='auto_generated',
            activity_description=f'SPK auto-generated from Work Order {work_order.wo_number}',
            user_id=user_id
        )
        db.session.add(log)

        db.session.commit()
        return document

    except Exception as e:
        db.session.rollback()
        raise e


def _flatten_bom_for_print(exploded, depth=1):
    """DFS-flatten explode_bom_requirements()'s nested sub_assemblies/materials
    (Barang Jadi -> WIP -> Mixing) into indented rows for a repeating_table
    print element - reuses the same nested `children` shape routes/spk.py's
    build_tree() re-derives from `path`, just walked directly instead."""
    rows = []
    indent = '&nbsp;&nbsp;&nbsp;&nbsp;' * (depth - 1)
    for sa in exploded.get('sub_assemblies', []):
        rows.append({
            'name': f"{indent}{sa.get('product_name') or '-'} (WIP)",
            'quantity': round(sa['required_quantity'], 4),
            'uom': '',
        })
        if sa.get('children'):
            rows.extend(_flatten_bom_for_print(sa['children'], depth + 1))
    for m in exploded.get('materials', []):
        rows.append({
            'name': f"{indent}{m.get('material_name') or '-'}",
            'quantity': round(m['required_quantity'], 4),
            'uom': m.get('uom') or '',
        })
    return rows


def _build_spk_bom_rows(product_id, quantity):
    """Multi-level BOM breakdown for the SPK-per-batch print document
    (user requirement: "surat SPK per batch harus lengkap, harus ada bom
    berlapis juga"). Reuses explode_bom_requirements() directly rather than
    routes/spk.py's HTTP endpoint, since this runs inside document
    generation, not a request."""
    if not product_id or not quantity:
        return []

    from utils.bom_explosion import explode_bom_requirements, CircularBOMError, MaxDepthExceededError
    from models.production import BillOfMaterials

    bom = BillOfMaterials.query.filter_by(product_id=product_id, is_active=True).first()
    if not bom:
        return []

    def scale_fn(bom_item, parent_qty, _bom):
        return float(bom_item.effective_quantity) * parent_qty

    try:
        exploded = explode_bom_requirements(product_id, float(quantity), scale_fn)
    except (CircularBOMError, MaxDepthExceededError):
        return []

    return _flatten_bom_for_print(exploded)


def generate_spk_from_batch(batch_id, user_id):
    """
    Generate SPK (Surat Perintah Kerja) per ProductionBatch (Batch Scheduling §7).
    Meniru generate_spk_from_work_order() apa adanya, cuma level datanya per-Batch.
    Tidak commit/rollback sendiri — caller (approve / reprint endpoint) yang mengatur transaksi,
    supaya update ProductionBatch.spk_document_id ikut 1 transaksi yang sama.
    """
    from models.batch_scheduling import ProductionBatch

    batch = db.session.get(ProductionBatch, batch_id)
    if not batch:
        raise ValueError('Batch not found')

    template = _get_default_template('spk_batch')
    if not template:
        template = create_default_spk_batch_template(user_id)

    doc_number = generate_number('SPK', Document, 'document_number')

    recipe = batch.recipe
    document_data = {
        'document_number': doc_number,
        'document_date': datetime.utcnow().strftime('%d %B %Y'),
        'batch_number': batch.batch_number,
        'work_order_number': batch.work_order.wo_number if batch.work_order else '',
        'product_name': recipe.product.name if recipe and recipe.product else '',
        'product_code': recipe.product.code if recipe and recipe.product else '',
        'quantity': float(batch.planned_qty) if batch.planned_qty is not None else 0,
        'uom': batch.work_order.uom if batch.work_order else 'PCS',
        'machine': batch.machine.name if batch.machine else '',
        'scheduled_date': batch.scheduled_date.strftime('%d %B %Y') if batch.scheduled_date else '',
        'shift_number': batch.shift_number,
        'sequence_in_shift': batch.sequence_in_shift,
        'operator': '',
        'supervisor': '',
        'approved_by': '',
        'company': get_company_context(),
        'bom_items': _build_spk_bom_rows(recipe.product_id, batch.planned_qty) if recipe else [],
    }

    document = Document(
        document_number=doc_number,
        document_title=f'SPK Batch - {batch.batch_number}',
        document_type='spk_batch',
        template_version_id=template.current_version_id,
        document_data=document_data,
        reference_type='production_batch',
        reference_id=batch.id,
        reference_number=batch.batch_number,
        status='generated',
        created_by=user_id
    )
    document.html_content = render_template_version_to_html(template.current_version, document_data)

    db.session.add(document)
    db.session.flush()

    log = DocumentLog(
        document_id=document.id,
        activity_type='auto_generated',
        activity_description=f'SPK auto-generated from Production Batch {batch.batch_number}',
        user_id=user_id
    )
    db.session.add(log)

    batch.spk_document_id = document.id
    batch.spk_is_outdated = False

    return document


def generate_invoice_document(invoice_id, user_id):
    """
    Generate a printable Invoice document (Print Template Designer Fase 1 proof-of-concept #2).
    Invoice had NO print/PDF mechanism anywhere in SMITH before this - see the
    Print Template Designer scoping investigation (2026-08-23). Mirrors the
    SPK/Surat Jalan generators' shape exactly, just a new document_type.
    """
    from models.finance import Invoice

    invoice = db.session.get(Invoice, invoice_id)
    if not invoice:
        raise ValueError('Invoice not found')

    template = _get_default_template('invoice')
    if not template:
        template = create_default_invoice_template(user_id)

    doc_number = generate_number('DOC-INV', Document, 'document_number')

    customer = invoice.customer
    sales_order = invoice.sales_order

    line_items = []
    for item in invoice.items:
        line_items.append({
            'item_name': item.description or (item.product.name if item.product else ''),
            'quantity': float(item.quantity),
            'uom': item.uom or '',
            'unit_price': float(item.unit_price),
            'subtotal': float(item.total_amount),
        })

    status_label = {
        'draft': 'Draft', 'sent': 'Terkirim', 'partial': 'Sebagian Lunas',
        'paid': 'Lunas', 'overdue': 'Jatuh Tempo', 'cancelled': 'Dibatalkan',
    }.get(invoice.status, invoice.status)

    document_data = {
        'document_number': invoice.invoice_number,
        'document_date': invoice.invoice_date.strftime('%d %B %Y') if invoice.invoice_date else '',
        'due_date': invoice.due_date.strftime('%d %B %Y') if invoice.due_date else '',
        'po_number': sales_order.customer_po_number if sales_order and sales_order.customer_po_number else '',
        'ship_to': sales_order.delivery_address if sales_order else '',
        'status': status_label,
        'customer_name': customer.company_name if customer else '',
        'customer_address': customer.address if customer else '',
        'payment_terms': invoice.payment_terms or '',
        'notes': invoice.notes or '',
        'subtotal': float(invoice.subtotal or 0),
        'tax_amount': float(invoice.tax_amount or 0),
        'discount_amount': float(invoice.discount_amount or 0),
        'total_amount': float(invoice.total_amount or 0),
        'balance_due': float(invoice.balance_due or 0),
        'line_items': line_items,
        'company': get_company_context(),
    }

    document = Document(
        document_number=doc_number,
        document_title=f'Invoice {invoice.invoice_number} - {customer.company_name if customer else ""}',
        document_type='invoice',
        template_version_id=template.current_version_id,
        document_data=document_data,
        reference_type='invoice',
        reference_id=invoice.id,
        reference_number=invoice.invoice_number,
        status='generated',
        created_by=user_id
    )
    document.html_content = render_template_version_to_html(template.current_version, document_data)

    db.session.add(document)
    db.session.flush()

    log = DocumentLog(
        document_id=document.id,
        activity_type='auto_generated',
        activity_description=f'Invoice document generated from Invoice {invoice.invoice_number}',
        user_id=user_id
    )
    db.session.add(log)

    db.session.commit()
    return document


def create_default_surat_jalan_template(user_id):
    """Create default Surat Jalan template (Fase 1 proof-of-concept layout)."""
    objects = _company_header_objects() + [
        _label('SURAT JALAN', 10, 32, 100, 8, font_size=14, font_weight='bold'),
        _field('document_number', 10, 42, 90, font_size=9),
        _field('document_date', 110, 42, 90, font_size=9),
        _field('sales_order_number', 10, 48, 90, font_size=9),
        _label('Kepada:', 10, 58, 40, font_size=9, font_weight='bold'),
        _field('customer_name', 10, 64, 120, font_size=9),
        _field('customer_address', 10, 69, 120, height=10, font_size=9),
        _placeholder_box('repeating_table', 10, 85, 190, 100, dataSource='items', showHeader=True, columns=[
            {'fieldPath': 'product_name', 'label': 'Nama Produk', 'width': 90, 'textAlign': 'left'},
            {'fieldPath': 'quantity', 'label': 'Qty', 'width': 30, 'textAlign': 'right'},
            {'fieldPath': 'uom', 'label': 'Satuan', 'width': 30, 'textAlign': 'left'},
            {'fieldPath': 'description', 'label': 'Keterangan', 'width': 40, 'textAlign': 'left'},
        ]),
        _label('Disiapkan Oleh', 10, 250, 50, font_size=9),
        _field('prepared_by', 10, 260, 50, font_size=9),
        _label('Sopir', 80, 250, 50, font_size=9),
        _field('driver_name', 80, 260, 50, font_size=9),
        _label('Diterima Oleh', 150, 250, 50, font_size=9),
        _field('received_by', 150, 260, 50, font_size=9),
    ]
    return _create_default_template(user_id, 'Surat Jalan Default', 'SJ_DEFAULT', 'surat_jalan', objects)


def create_default_spk_template(user_id):
    """Create default SPK template (Fase 1 proof-of-concept layout)."""
    objects = _company_header_objects() + [
        _label('SURAT PERINTAH KERJA', 10, 32, 140, 8, font_size=14, font_weight='bold'),
        _field('document_number', 10, 42, 90, font_size=9),
        _field('document_date', 110, 42, 90, font_size=9),
        _field('work_order_number', 10, 48, 90, font_size=9),
        _label('Produk', 10, 58, 40, font_size=9, font_weight='bold'),
        _field('product_name', 10, 64, 120, font_size=10),
        _field('product_code', 10, 70, 60, font_size=9),
        _field('quantity', 10, 76, 40, font_size=9),
        _field('uom', 55, 76, 40, font_size=9),
        _label('Jadwal', 10, 86, 40, font_size=9, font_weight='bold'),
        _field('start_date', 10, 92, 60, font_size=9),
        _field('due_date', 75, 92, 60, font_size=9),
        _field('priority', 140, 92, 40, font_size=9),
        _field('machine', 10, 100, 90, font_size=9),
        _field('notes', 10, 108, 190, height=15, font_size=9),
        _label('Operator', 10, 250, 50, font_size=9),
        _field('operator', 10, 260, 50, font_size=9),
        _label('Supervisor', 80, 250, 50, font_size=9),
        _field('supervisor', 80, 260, 50, font_size=9),
        _label('Disetujui Oleh', 150, 250, 50, font_size=9),
        _field('approved_by', 150, 260, 50, font_size=9),
    ]
    return _create_default_template(user_id, 'SPK Default', 'SPK_DEFAULT', 'spk', objects)


def create_default_spk_batch_template(user_id):
    """Create default SPK-per-Batch template (Batch Scheduling §7, Fase 1 proof-of-concept layout)."""
    objects = _company_header_objects() + [
        _label('SURAT PERINTAH KERJA (PER BATCH)', 10, 32, 160, 8, font_size=13, font_weight='bold'),
        _field('document_number', 10, 42, 90, font_size=9),
        _field('document_date', 110, 42, 90, font_size=9),
        _field('batch_number', 10, 48, 90, font_size=11, font_weight='bold'),
        _field('work_order_number', 110, 48, 90, font_size=9),
        _label('Produk', 10, 58, 40, font_size=9, font_weight='bold'),
        _field('product_name', 10, 64, 120, font_size=10),
        _field('product_code', 10, 70, 60, font_size=9),
        _field('quantity', 10, 76, 40, font_size=9),
        _field('uom', 55, 76, 40, font_size=9),
        _label('Jadwal', 10, 86, 40, font_size=9, font_weight='bold'),
        _field('machine', 10, 92, 60, font_size=9),
        _field('scheduled_date', 75, 92, 60, font_size=9),
        _field('shift_number', 140, 92, 20, font_size=9),
        _field('sequence_in_shift', 165, 92, 20, font_size=9),
        _placeholder_box('qrcode', 165, 32, 20, 20, fieldPath='batch_number'),
        _label('Rincian Kebutuhan Material (BOM Berlapis)', 10, 112, 190, font_size=9, font_weight='bold'),
        _placeholder_box('repeating_table', 10, 118, 190, 110, dataSource='bom_items', showHeader=True, columns=[
            {'fieldPath': 'name', 'label': 'Nama Bahan / Sub-Rakitan', 'width': 120, 'textAlign': 'left'},
            {'fieldPath': 'quantity', 'label': 'Kebutuhan', 'width': 40, 'textAlign': 'right'},
            {'fieldPath': 'uom', 'label': 'Satuan', 'width': 30, 'textAlign': 'left'},
        ]),
        _label('Operator', 10, 260, 50, font_size=9),
        _field('operator', 10, 270, 50, font_size=9),
        _label('Supervisor', 80, 260, 50, font_size=9),
        _field('supervisor', 80, 270, 50, font_size=9),
        _label('Disetujui Oleh', 150, 260, 50, font_size=9),
        _field('approved_by', 150, 270, 50, font_size=9),
    ]
    return _create_default_template(user_id, 'SPK Batch Default', 'SPK_BATCH_DEFAULT', 'spk_batch', objects)


def create_default_invoice_template(user_id):
    """Create default Invoice template (Fase 1 proof-of-concept layout - Invoice
    never had a print mechanism before this)."""
    objects = _company_header_objects() + [
        _label('INVOICE', 10, 32, 100, 10, font_size=16, font_weight='bold'),
        _field('document_number', 150, 32, 50, font_size=9, text_align='right'),
        _label('Tanggal', 10, 44, 30, font_size=8),
        _field('document_date', 40, 44, 60, font_size=9),
        _label('Jatuh Tempo', 110, 44, 30, font_size=8),
        _field('due_date', 140, 44, 60, font_size=9),
        _label('No. PO Customer', 10, 50, 30, font_size=8),
        _field('po_number', 40, 50, 60, font_size=9),
        _label('Status', 110, 50, 30, font_size=8),
        _field('status', 140, 50, 60, font_size=9, font_weight='bold'),
        _label('Ditagihkan Kepada:', 10, 60, 60, font_size=9, font_weight='bold'),
        _field('customer_name', 10, 66, 90, font_size=10),
        _field('customer_address', 10, 71, 90, height=10, font_size=9),
        _label('Kirim Ke:', 110, 60, 60, font_size=9, font_weight='bold'),
        _field('ship_to', 110, 66, 90, height=15, font_size=9),
        _placeholder_box('repeating_table', 10, 90, 190, 100, dataSource='line_items', showHeader=True, columns=[
            {'fieldPath': 'item_name', 'label': 'Item', 'width': 80, 'textAlign': 'left'},
            {'fieldPath': 'quantity', 'label': 'Qty', 'width': 25, 'textAlign': 'right'},
            {'fieldPath': 'uom', 'label': 'Satuan', 'width': 25, 'textAlign': 'left'},
            {'fieldPath': 'unit_price', 'label': 'Harga Satuan', 'width': 30, 'textAlign': 'right'},
            {'fieldPath': 'subtotal', 'label': 'Subtotal', 'width': 30, 'textAlign': 'right'},
        ]),
        _label('Subtotal', 140, 200, 30, font_size=9),
        _field('subtotal', 170, 200, 30, font_size=9, text_align='right'),
        _label('Diskon', 140, 206, 30, font_size=9),
        _field('discount_amount', 170, 206, 30, font_size=9, text_align='right'),
        _label('PPN', 140, 212, 30, font_size=9),
        _field('tax_amount', 170, 212, 30, font_size=9, text_align='right'),
        _label('TOTAL', 140, 220, 30, font_size=11, font_weight='bold'),
        _field('total_amount', 170, 220, 30, font_size=11, font_weight='bold', text_align='right'),
        _label('Sisa Tagihan', 140, 228, 30, font_size=9),
        _field('balance_due', 170, 228, 30, font_size=9, text_align='right'),
        _field('notes', 10, 245, 190, height=15, font_size=8),
    ]
    return _create_default_template(user_id, 'Invoice Default', 'INVOICE_DEFAULT', 'invoice', objects)


def generate_purchase_order_document(po_id, user_id):
    """
    Generate a printable Purchase Order document (Print Template Designer Fase 2).
    Mirrors generate_invoice_document()'s shape - Fase 1 proved the pattern works
    generically across document types, this is that proof extended to PO.
    """
    from models.purchasing import PurchaseOrder

    po = db.session.get(PurchaseOrder, po_id)
    if not po:
        raise ValueError('Purchase Order not found')

    template = _get_default_template('purchase_order')
    if not template:
        template = create_default_purchase_order_template(user_id)

    doc_number = generate_number('DOC-PO', Document, 'document_number')

    supplier = po.supplier
    line_items = []
    for item in po.items:
        line_items.append({
            'item_name': item.description or (item.product.name if item.product else (item.material.name if item.material else '')),
            'quantity': float(item.quantity),
            'uom': item.uom or '',
            'unit_price': float(item.unit_price),
            'subtotal': float(item.total_price),
        })

    document_data = {
        'document_number': po.po_number,
        'document_date': po.order_date.strftime('%d %B %Y') if po.order_date else '',
        'required_date': po.required_date.strftime('%d %B %Y') if po.required_date else '',
        'supplier_name': supplier.company_name if supplier else '',
        'supplier_address': supplier.address if supplier else '',
        'delivery_address': po.delivery_address or '',
        'payment_terms': po.payment_terms or '',
        'notes': po.notes or '',
        'subtotal': float(po.subtotal or 0),
        'tax_amount': float(po.tax_amount or 0),
        'discount_amount': float(po.discount_amount or 0),
        'total_amount': float(po.total_amount or 0),
        'line_items': line_items,
        'company': get_company_context(),
    }

    document = Document(
        document_number=doc_number,
        document_title=f'PO {po.po_number} - {supplier.company_name if supplier else ""}',
        document_type='purchase_order',
        template_version_id=template.current_version_id,
        document_data=document_data,
        reference_type='purchase_order',
        reference_id=po.id,
        reference_number=po.po_number,
        status='generated',
        created_by=user_id
    )
    document.html_content = render_template_version_to_html(template.current_version, document_data)

    db.session.add(document)
    db.session.flush()

    log = DocumentLog(
        document_id=document.id,
        activity_type='auto_generated',
        activity_description=f'PO document generated from Purchase Order {po.po_number}',
        user_id=user_id
    )
    db.session.add(log)

    db.session.commit()
    return document


def generate_kwitansi_document(payment_id, user_id):
    """
    Generate a printable Kwitansi (payment receipt) document (Print Template
    Designer Fase 2). Reuses the existing Payment model - no separate
    "receipt" table exists or is needed, payment_type ('receipt'/'payment')
    already distinguishes uang-masuk vs uang-keluar.
    """
    from models.finance import Payment

    payment = db.session.get(Payment, payment_id)
    if not payment:
        raise ValueError('Payment not found')

    template = _get_default_template('kwitansi')
    if not template:
        template = create_default_kwitansi_template(user_id)

    doc_number = generate_number('DOC-KWT', Document, 'document_number')

    party = payment.customer if payment.customer else payment.supplier
    document_data = {
        'document_number': payment.payment_number,
        'document_date': payment.payment_date.strftime('%d %B %Y') if payment.payment_date else '',
        'payment_type_label': 'Terima (Uang Masuk)' if payment.payment_type == 'receipt' else 'Bayar (Uang Keluar)',
        'party_name': (party.company_name if hasattr(party, 'company_name') else '') if party else '',
        'amount': float(payment.amount or 0),
        'payment_method': payment.payment_method or '',
        'reference_number': payment.reference_number or '',
        'invoice_number': payment.invoice.invoice_number if payment.invoice else '',
        'notes': payment.notes or '',
        'company': get_company_context(),
    }

    document = Document(
        document_number=doc_number,
        document_title=f'Kwitansi {payment.payment_number}',
        document_type='kwitansi',
        template_version_id=template.current_version_id,
        document_data=document_data,
        reference_type='payment',
        reference_id=payment.id,
        reference_number=payment.payment_number,
        status='generated',
        created_by=user_id
    )
    document.html_content = render_template_version_to_html(template.current_version, document_data)

    db.session.add(document)
    db.session.flush()

    log = DocumentLog(
        document_id=document.id,
        activity_type='auto_generated',
        activity_description=f'Kwitansi generated from Payment {payment.payment_number}',
        user_id=user_id
    )
    db.session.add(log)

    db.session.commit()
    return document


def create_default_purchase_order_template(user_id):
    """Create default Purchase Order template (Fase 2 proof-of-concept layout)."""
    objects = _company_header_objects() + [
        _label('PURCHASE ORDER', 10, 32, 100, 10, font_size=16, font_weight='bold'),
        _field('document_number', 150, 32, 50, font_size=9, text_align='right'),
        _label('Tanggal', 10, 44, 30, font_size=8),
        _field('document_date', 40, 44, 60, font_size=9),
        _label('Dibutuhkan', 110, 44, 30, font_size=8),
        _field('required_date', 140, 44, 60, font_size=9),
        _label('Kepada Supplier:', 10, 56, 60, font_size=9, font_weight='bold'),
        _field('supplier_name', 10, 62, 90, font_size=10),
        _field('supplier_address', 10, 67, 90, height=10, font_size=9),
        _label('Kirim Ke:', 110, 56, 60, font_size=9, font_weight='bold'),
        _field('delivery_address', 110, 62, 90, height=15, font_size=9),
        _placeholder_box('repeating_table', 10, 85, 190, 100, dataSource='line_items', showHeader=True, columns=[
            {'fieldPath': 'item_name', 'label': 'Item', 'width': 80, 'textAlign': 'left'},
            {'fieldPath': 'quantity', 'label': 'Qty', 'width': 25, 'textAlign': 'right'},
            {'fieldPath': 'uom', 'label': 'Satuan', 'width': 25, 'textAlign': 'left'},
            {'fieldPath': 'unit_price', 'label': 'Harga Satuan', 'width': 30, 'textAlign': 'right'},
            {'fieldPath': 'subtotal', 'label': 'Subtotal', 'width': 30, 'textAlign': 'right'},
        ]),
        _label('Subtotal', 140, 195, 30, font_size=9),
        _field('subtotal', 170, 195, 30, font_size=9, text_align='right'),
        _label('Diskon', 140, 201, 30, font_size=9),
        _field('discount_amount', 170, 201, 30, font_size=9, text_align='right'),
        _label('PPN', 140, 207, 30, font_size=9),
        _field('tax_amount', 170, 207, 30, font_size=9, text_align='right'),
        _label('TOTAL', 140, 215, 30, font_size=11, font_weight='bold'),
        _field('total_amount', 170, 215, 30, font_size=11, font_weight='bold', text_align='right'),
        _field('payment_terms', 10, 225, 90, font_size=8),
        _field('notes', 10, 235, 190, height=15, font_size=8),
    ]
    return _create_default_template(user_id, 'Purchase Order Default', 'PO_DEFAULT', 'purchase_order', objects)


def create_default_kwitansi_template(user_id):
    """Create default Kwitansi template (Fase 2 proof-of-concept layout)."""
    objects = _company_header_objects() + [
        _label('KWITANSI', 10, 35, 100, 10, font_size=18, font_weight='bold'),
        _field('document_number', 150, 35, 50, font_size=9, text_align='right'),
        _label('Tanggal', 10, 50, 30, font_size=8),
        _field('document_date', 40, 50, 60, font_size=9),
        _field('payment_type_label', 110, 50, 90, font_size=9, font_weight='bold'),
        _label('Sudah terima dari / dibayarkan kepada:', 10, 62, 100, font_size=9),
        _field('party_name', 10, 68, 150, font_size=12, font_weight='bold'),
        _label('Jumlah:', 10, 82, 30, font_size=9),
        _field('amount', 40, 82, 100, font_size=14, font_weight='bold'),
        _label('Untuk pembayaran:', 10, 96, 40, font_size=8),
        _field('invoice_number', 55, 96, 60, font_size=9),
        _label('Metode', 10, 106, 30, font_size=8),
        _field('payment_method', 40, 106, 60, font_size=9),
        _label('No. Referensi', 110, 106, 30, font_size=8),
        _field('reference_number', 145, 106, 55, font_size=9),
        _field('notes', 10, 120, 190, height=15, font_size=8),
        _label('Diterima Oleh', 140, 250, 50, font_size=9),
        _hline(140, 270, 50),
    ]
    return _create_default_template(user_id, 'Kwitansi Default', 'KWITANSI_DEFAULT', 'kwitansi', objects)
