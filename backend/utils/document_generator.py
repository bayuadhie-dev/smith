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
    """Create a template FAMILY + its first (and immediately published) TemplateVersion,
    OR - if a family with this template_code already exists (e.g. an older
    default that was deactivated via is_default=False rather than deleted,
    since existing Document rows FK-reference its TemplateVersion and can't
    have it removed) - publish a NEW version onto that existing family and
    reactivate it instead. template_code has a DB-level unique constraint,
    so a plain INSERT here would raise IntegrityError the moment this
    function's own canvas_objects ever changes after the family was already
    created once (found live: fix_report_3.md Fase 20, invoice template
    density fix). Used as the fallback proof-of-concept layout whenever no
    admin-designed default exists yet for a document_type - real usage is
    expected to replace these via the Template Designer UI (Fase 1 editor,
    not built in this step), but auto-generation must never be blocked
    waiting for that."""
    template = DocumentTemplate.query.filter_by(template_code=template_code).first()
    if template:
        template.is_default = True
        template.is_active = True
        next_version_number = (
            db.session.query(db.func.max(TemplateVersion.version_number))
            .filter_by(document_template_id=template.id).scalar() or 0
        ) + 1
    else:
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
        next_version_number = 1

    version = TemplateVersion(
        document_template_id=template.id,
        version_number=next_version_number,
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


def _pt_to_mm(font_size_pt):
    # Render engine reads fontSize as mm (editor convention) and converts to pt;
    # default layouts are authored in pt, so convert here.
    return round(float(font_size_pt) / 2.83465, 3)


def _label(text, left, top, width, height=6, font_size=10, font_weight='normal', text_align='left'):
    font_size = _pt_to_mm(font_size)
    return {'type': 'Textbox', 'elementType': 'label', 'left': left, 'top': top, 'width': width, 'height': height,
            'scaleX': 1, 'scaleY': 1, 'text': text, 'fontSize': font_size, 'fontWeight': font_weight,
            'fontFamily': 'Arial', 'textAlign': text_align, 'fill': '#000000'}


def _field(field_path, left, top, width, height=6, font_size=10, font_weight='normal', text_align='left'):
    font_size = _pt_to_mm(font_size)
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


def generate_surat_jalan_from_sales_order(sales_order_id, user_id, items_to_ship=None):
    """
    Generate Surat Jalan from Sales Order - Like Accurate: Sales Order → Surat Jalan.

    Real stock allocation added 2026-09-12 (see project_surat_jalan_shipping
    memory) - previously this just printed whatever the SO said was ordered
    with ZERO connection to actual Inventory (no check, no deduction, no
    partial-shipment awareness). Now uses the same FIFO deduction every
    other real stock-consuming flow in this codebase uses
    (utils.fifo_helper.fifo_deduct_stock - excludes quarantine/reject stock).

    items_to_ship: optional list of {'so_item_id': int, 'quantity': float}
    for a partial shipment. Omit to ship the full remaining unshipped
    quantity (ordered - SalesOrderItem.quantity_shipped) for every line.
    Raises ValueError (caught by the except below, which rolls back
    everything) if any line's stock is insufficient or the requested
    quantity exceeds what's still unshipped - the whole Surat Jalan is
    atomic, never partially deducted.
    """
    from utils.fifo_helper import fifo_deduct_stock

    try:
        sales_order = db.session.get(SalesOrder, sales_order_id)
        if not sales_order:
            raise ValueError('Sales Order not found')

        to_ship_by_item = {}
        if items_to_ship:
            for entry in items_to_ship:
                to_ship_by_item[int(entry['so_item_id'])] = float(entry['quantity'])
        else:
            for item in sales_order.items:
                remaining = float(item.quantity) - float(item.quantity_shipped or 0)
                if remaining > 1e-9:
                    to_ship_by_item[item.id] = remaining

        if not to_ship_by_item:
            raise ValueError('Tidak ada quantity yang perlu dikirim untuk Sales Order ini (sudah terkirim semua)')

        doc_number = generate_number('SJ', Document, 'document_number')

        items_data = []
        total_qty = 0.0
        for item in sales_order.items:
            qty_to_ship = to_ship_by_item.get(item.id)
            if not qty_to_ship or qty_to_ship <= 0:
                continue

            remaining_orderable = float(item.quantity) - float(item.quantity_shipped or 0)
            if qty_to_ship > remaining_orderable + 1e-9:
                raise ValueError(
                    f"Qty kirim untuk {item.product.name if item.product else item.description} "
                    f"({qty_to_ship}) melebihi sisa yang belum dikirim ({remaining_orderable})"
                )

            result = fifo_deduct_stock(
                product_id=item.product_id,
                quantity_needed=qty_to_ship,
                reference_number=doc_number,
                reference_type='surat_jalan',
                notes=f'Surat Jalan {doc_number} - SO {sales_order.order_number}',
                user_id=user_id,
            )
            if not result['success']:
                raise ValueError(
                    f"Stok tidak cukup untuk {item.product.name if item.product else item.description}: {result['error']}"
                )

            item.quantity_shipped = float(item.quantity_shipped or 0) + qty_to_ship
            total_qty += qty_to_ship

            items_data.append({
                'code': item.product.code if item.product else '',
                'pack': item.product.packaging.packs_per_karton if item.product and item.product.packaging else None,
                'product_name': item.product.name if item.product else item.description,
                'quantity': qty_to_ship,
                'uom': item.uom,
                'description': item.description or '',
                'batches': [
                    {'batch_number': m['batch_number'], 'quantity': m['quantity_deducted']}
                    for m in result['movements']
                ],
            })

        # Fully shipped once every line's quantity_shipped reaches its
        # ordered quantity - SalesOrder.status already has a real 'shipped'
        # value (confirmed in the SD audit); no 'partial' status exists so a
        # partial shipment intentionally leaves status untouched rather than
        # inventing one.
        if all(float(i.quantity_shipped or 0) >= float(i.quantity) - 1e-9 for i in sales_order.items):
            sales_order.status = 'shipped'

        document_data = {
            'document_number': doc_number,
            'document_date': datetime.utcnow().strftime('%d-%m-%Y'),
            'sales_order_number': sales_order.order_number,
            'customer_name': sales_order.customer.company_name if sales_order.customer else '',
            'customer_address': sales_order.delivery_address or (sales_order.customer.billing_address if sales_order.customer else ''),
            'customer_phone': sales_order.customer.phone if sales_order.customer else '',
            'items': items_data,
            'total_quantity': total_qty,
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
            template_version_id=None,
            document_data=document_data,
            reference_type='sales_order',
            reference_id=sales_order.id,
            reference_number=sales_order.order_number,
            status='generated',
            created_by=user_id
        )
        document.html_content = _render_sj_html(document_data)

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

        doc_number = generate_number('SPK', Document, 'document_number')

        document_data = {
            'document_number': doc_number,
            'document_date': datetime.utcnow().strftime('%d-%m-%Y'),
            'work_order_number': work_order.wo_number,
            'product_name': work_order.product.name if work_order.product else '',
            'product_code': work_order.product.code if work_order.product else '',
            'quantity': float(work_order.quantity),
            'uom': work_order.uom if work_order.uom else 'PCS',
            'start_date': work_order.scheduled_start_date.strftime('%d-%m-%Y') if work_order.scheduled_start_date else '',
            'due_date': work_order.scheduled_end_date.strftime('%d-%m-%Y') if work_order.scheduled_end_date else '',
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
            template_version_id=None,
            document_data=document_data,
            reference_type='work_order',
            reference_id=work_order.id,
            reference_number=work_order.wo_number,
            status='generated',
            created_by=user_id
        )
        document.html_content = _render_spk_html(document_data)

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
        'document_date': datetime.utcnow().strftime('%d-%m-%Y'),
        'batch_number': batch.batch_number,
        'work_order_number': batch.work_order.wo_number if batch.work_order else '',
        'product_name': recipe.product.name if recipe and recipe.product else '',
        'product_code': recipe.product.code if recipe and recipe.product else '',
        'quantity': float(batch.planned_qty) if batch.planned_qty is not None else 0,
        'uom': batch.work_order.uom if batch.work_order else 'PCS',
        'machine': batch.machine.name if batch.machine else '',
        'scheduled_date': batch.scheduled_date.strftime('%d-%m-%Y') if batch.scheduled_date else '',
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

    doc_number = generate_number('DOC-INV', Document, 'document_number')

    customer = invoice.customer
    sales_order = invoice.sales_order

    line_items = []
    gross = 0.0
    for item in invoice.items:
        line_gross = float(item.quantity or 0) * float(item.unit_price or 0)
        net = float(item.total_amount or 0)
        discount = max(0.0, line_gross - net)
        gross += line_gross
        pct = float(item.discount_percent or 0) or (round(discount / line_gross * 100, 2) if line_gross and discount else 0)
        line_items.append({
            'code': item.product.code if item.product else '',
            'pack': item.product.packaging.packs_per_karton if item.product and item.product.packaging else None,
            'item_name': item.description or (item.product.name if item.product else ''),
            'quantity': float(item.quantity),
            'uom': item.uom or '',
            'unit_price': float(item.unit_price),
            'discount': discount,
            'discount_percent': pct,
            'subtotal': line_gross,
        })

    status_label = {
        'draft': 'Draft', 'sent': 'Terkirim', 'partial': 'Sebagian Lunas',
        'paid': 'Lunas', 'overdue': 'Jatuh Tempo', 'cancelled': 'Dibatalkan',
    }.get(invoice.status, invoice.status)

    total = float(invoice.total_amount or 0)
    document_data = {
        'document_number': invoice.invoice_number,
        'document_date': invoice.invoice_date.strftime('%d-%m-%Y') if invoice.invoice_date else '',
        'due_date': invoice.due_date.strftime('%d-%m-%Y') if invoice.due_date else '',
        'po_number': sales_order.customer_po_number if sales_order and sales_order.customer_po_number else '',
        'ship_to': sales_order.delivery_address if sales_order else '',
        'status': status_label,
        'customer_name': customer.company_name if customer else '',
        'customer_address': customer.billing_address if customer else '',
        'payment_terms': invoice.payment_terms or '',
        'notes': invoice.notes or '',
        'gross': gross,
        'discount_total': sum(i['discount'] for i in line_items),
        'subtotal': float(invoice.subtotal or 0),
        'tax_amount': float(invoice.tax_amount or 0),
        'total_amount': total,
        'paid_amount': float(invoice.paid_amount or 0),
        'balance_due': float(invoice.balance_due or 0),
        'terbilang': (_terbilang(total).strip().capitalize() + ' rupiah') if total >= 1 else 'Nol rupiah',
        'line_items': line_items,
        'company': get_company_context(),
    }

    document = Document(
        document_number=doc_number,
        document_title=f'Invoice {invoice.invoice_number} - {customer.company_name if customer else ""}',
        document_type='invoice',
        template_version_id=None,
        document_data=document_data,
        reference_type='invoice',
        reference_id=invoice.id,
        reference_number=invoice.invoice_number,
        status='generated',
        created_by=user_id
    )
    document.html_content = _render_invoice_html(document_data)

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
    never had a print mechanism before this).

    fix_report_3.md Fase 20 (2026-10-03): original layout reserved 100mm for
    the line-items table before placing totals, which read as a mostly-empty
    page for any invoice with only a handful of lines (the common case) -
    real estimate/invoice documents fill the page with actual business
    content, not whitespace. Tightened the table's reserved height (still
    room for ~15-20 rows before WeasyPrint's native pagination kicks in) and
    used the reclaimed space for fields that were already being computed in
    document_data but never actually placed on the canvas (payment_terms),
    plus a standard signature block - no invented data, every field here
    traces to a real document_data key or a static label."""
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
        _label('Syarat Pembayaran', 10, 56, 30, font_size=8),
        _field('payment_terms', 40, 56, 100, font_size=9),
        _label('Ditagihkan Kepada:', 10, 66, 60, font_size=9, font_weight='bold'),
        _field('customer_name', 10, 72, 90, font_size=10),
        _field('customer_address', 10, 77, 90, height=10, font_size=9),
        _label('Kirim Ke:', 110, 66, 60, font_size=9, font_weight='bold'),
        _field('ship_to', 110, 72, 90, height=15, font_size=9),
        _placeholder_box('repeating_table', 10, 96, 190, 65, dataSource='line_items', showHeader=True, columns=[
            {'fieldPath': 'item_name', 'label': 'Item', 'width': 80, 'textAlign': 'left'},
            {'fieldPath': 'quantity', 'label': 'Qty', 'width': 25, 'textAlign': 'right'},
            {'fieldPath': 'uom', 'label': 'Satuan', 'width': 25, 'textAlign': 'left'},
            {'fieldPath': 'unit_price', 'label': 'Harga Satuan', 'width': 30, 'textAlign': 'right'},
            {'fieldPath': 'subtotal', 'label': 'Subtotal', 'width': 30, 'textAlign': 'right'},
        ]),
        _label('Subtotal', 140, 168, 30, font_size=9),
        _field('subtotal', 170, 168, 30, font_size=9, text_align='right'),
        _label('Diskon', 140, 174, 30, font_size=9),
        _field('discount_amount', 170, 174, 30, font_size=9, text_align='right'),
        _label('PPN', 140, 180, 30, font_size=9),
        _field('tax_amount', 170, 180, 30, font_size=9, text_align='right'),
        _label('TOTAL', 140, 188, 30, font_size=11, font_weight='bold'),
        _field('total_amount', 170, 188, 30, font_size=11, font_weight='bold', text_align='right'),
        _label('Sisa Tagihan', 140, 196, 30, font_size=9),
        _field('balance_due', 170, 196, 30, font_size=9, text_align='right'),
        _label('Catatan', 10, 168, 30, font_size=8, font_weight='bold'),
        _field('notes', 10, 174, 115, height=20, font_size=8),
        _hline(10, 220, 190),
        _label('Hormat kami,', 140, 228, 60, font_size=9),
        _field('company.name', 140, 234, 60, font_size=9, font_weight='bold'),
        _label('(_____________________)', 140, 258, 60, font_size=9),
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

    doc_number = generate_number('DOC-PO', Document, 'document_number')

    supplier = po.supplier
    line_items = []
    for item in po.items:
        line_items.append({
            'code': (item.product.code if item.product else (getattr(item.material, 'code', '') if item.material else '')),
            'item_name': item.description or (item.product.name if item.product else (item.material.name if item.material else '')),
            'quantity': float(item.quantity),
            'uom': item.uom or '',
            'unit_price': float(item.unit_price),
            'subtotal': float(item.total_price),
        })

    document_data = {
        'document_number': po.po_number,
        'document_date': po.order_date.strftime('%d-%m-%Y') if po.order_date else '',
        'required_date': po.required_date.strftime('%d-%m-%Y') if po.required_date else '',
        'supplier_name': supplier.company_name if supplier else '',
        'supplier_address': supplier.address if supplier else '',
        'delivery_address': po.delivery_address or '',
        'payment_terms': po.payment_terms or '',
        'notes': po.notes or '',
        'subtotal': float(po.subtotal or 0),
        'tax_amount': float(po.tax_amount or 0),
        'discount_amount': float(po.discount_amount or 0),
        'total_amount': float(po.total_amount or 0),
        'terbilang': (_terbilang(float(po.total_amount or 0)).strip().capitalize() + ' rupiah') if float(po.total_amount or 0) >= 1 else 'Nol rupiah',
        'line_items': line_items,
        'company': get_company_context(),
    }

    document = Document(
        document_number=doc_number,
        document_title=f'PO {po.po_number} - {supplier.company_name if supplier else ""}',
        document_type='purchase_order',
        template_version_id=None,
        document_data=document_data,
        reference_type='purchase_order',
        reference_id=po.id,
        reference_number=po.po_number,
        status='generated',
        created_by=user_id
    )
    document.html_content = _render_po_html(document_data)

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


def _num(v):
    v = float(v or 0)
    return f"{v:,.2f}".rstrip('0').rstrip('.').replace(',', '_').replace('.', ',').replace('_', '.') if v != int(v) else f"{int(v):,}".replace(',', '.')


def _doc_header_html(company, title, lines):
    """Logo + company block on the left, title/number block on the right."""
    from html import escape as e
    logo = company.get('logo_url') or ''
    logo_html = f'<img src="{logo}" style="height:14mm;margin-right:3mm;">' if logo else ''
    address = ', '.join(x for x in [company.get('address'), company.get('city')] if x)
    contact = ' | '.join(x for x in [company.get('phone'), company.get('email')] if x)
    right = ''.join(f'<div>{e(l)}</div>' for l in lines)
    return f"""<table style="border-collapse:collapse;width:100%"><tr>
<td style="vertical-align:top;width:62%"><table style="border-collapse:collapse"><tr>
<td style="vertical-align:middle">{logo_html}</td>
<td style="vertical-align:middle"><div style="font-size:13pt;font-weight:bold">{e(company.get('name') or company.get('legal_name') or '')}</div>
<div style="font-size:8pt;color:#444">{e(address)}</div><div style="font-size:8pt;color:#444">{e(contact)}</div></td></tr></table></td>
<td style="text-align:right;vertical-align:top"><div style="font-size:14pt;font-weight:bold;letter-spacing:1px;white-space:nowrap">{title}</div>{right}</td>
</tr></table><div style="border-top:2px solid #111;margin:6px 0 8px"></div>"""


def _render_invoice_html(d):
    from html import escape as e
    rows = ''.join(
        f"""<tr><td class="c">{i}</td><td>{e(it.get('code') or '')}</td><td>{e(it['item_name'])}</td><td class="r">{_num(it['pack']) if it.get('pack') else ''}</td>
<td class="r">{_num(it['quantity'])}</td><td>{e(it['uom'])}</td><td class="r">{_num(it['unit_price'])}</td>
<td class="r">{(_num(it['discount']) + (' (' + _num(it['discount_percent']) + '%)' if it['discount_percent'] else '')) if it['discount'] else '-'}</td>
<td class="r">{_num(it['subtotal'])}</td></tr>"""
        for i, it in enumerate(d['line_items'], 1)) + _filler_rows(len(d['line_items']), 10, 9)
    def tot(label, val, cls=''):
        return f'<tr class="{cls}"><td>{label}</td><td class="r">{_rp(val)}</td></tr>'
    totals = tot('Subtotal', d['gross'])
    if d['discount_total']:
        totals += tot('Diskon', -d['discount_total'])
        totals += tot('Setelah Diskon', d['subtotal'])
    if d['tax_amount']:
        totals += tot('PPN', d['tax_amount'])
    totals += tot('TOTAL', d['total_amount'], 'grand')
    if d['paid_amount']:
        totals += tot('Sudah Dibayar', d['paid_amount'])
        totals += tot('Sisa Tagihan', d['balance_due'], 'grand')
    meta = _meta_rows([('No. PO Customer', d['po_number']), ('Syarat Pembayaran', d['payment_terms']), ('Jatuh Tempo', d['due_date'])])
    body = f"""{_doc_header_html(d['company'], 'INVOICE', [f"No. {d['document_number']}", f"Tanggal: {d['document_date']}", f"Status: {d['status']}"])}
<table><tr>
<td class="box" style="width:50%"><div class="h">Ditagihkan Kepada</div><div style="font-weight:bold;font-size:10.5pt">{e(d['customer_name'] or '-')}</div><div>{e(d['customer_address'] or '')}</div></td>
<td class="box"><table class="meta">{meta}</table>{f'<div class="h" style="margin-top:4px">Kirim Ke</div><div>{e(d["ship_to"])}</div>' if d['ship_to'] else ''}</td>
</tr></table>
<table class="items"><thead><tr><th>No.</th><th>Kode</th><th>Deskripsi</th><th class="r">Isi/Krt</th><th class="r">Qty</th><th>Satuan</th><th class="r">Harga</th><th class="r">Diskon</th><th class="r">Jumlah</th></tr></thead><tbody>{rows}</tbody></table>
<table class="sum">{totals}</table>
<div class="words"><b>Terbilang:</b> {e(d['terbilang'])}</div>
{f'<div style="margin-top:8px;font-size:9pt"><b>Catatan:</b> {e(d["notes"])}</div>' if d['notes'] else ''}"""
    return _page(body, _sig_row(['Diterima oleh,', f"Hormat kami,<br><span style='font-size:8pt;color:#5b6b72'>{e(d['company'].get('name') or '')}</span>"]), flow=len(d['line_items']) > 12)




_PRINT_CSS = """
@page { size: __SIZE__; margin: __MARGIN__; }
body { font-family: Arial, sans-serif; font-size: 9.5pt; color: #1b2a30; margin: 0; }
table { border-collapse: collapse; width: 100%; }
.wrap { position: relative; height: __MINH__; box-sizing: border-box; }
.sigbox { position: absolute; bottom: 0; left: 0; right: 0; }
.box { border: 1px solid #c5d0d4; padding: 6px 8px; vertical-align: top; }
.box .h { font-size: 8pt; color: #5b6b72; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px; }
.meta td { padding: 1px 0; font-size: 9pt; } .meta td.k { width: 36mm; color: #5b6b72; white-space: nowrap; }
.info td { padding: 2px 0; } .info td.k { width: 38mm; color: #5b6b72; white-space: nowrap; }
.items { margin-top: 10px; }
.items th { background: #1f4e5a; color: #fff; border: 1px solid #1f4e5a; padding: 5px 6px; font-size: 8.5pt; text-align: left; }
.items td { border: 1px solid #c5d0d4; padding: 4px 6px; vertical-align: top; height: 5.2mm; }
.items tbody tr:nth-child(even) td { background: #f5f8f9; }
.items .tot td { font-weight: bold; background: #e3edf0 !important; }
.r { text-align: right; } .c { text-align: center; width: 8mm; }
.sum { width: 80mm; margin-left: auto; margin-top: 6px; }
.sum td { padding: 3px 6px; border-bottom: 1px solid #dde5e8; }
.sum tr.grand td { font-weight: bold; color: #fff; background: #1f4e5a; border: 1px solid #1f4e5a; }
.words { border: 1px solid #c5d0d4; border-left: 3px solid #1f4e5a; padding: 5px 8px; margin-top: 8px; font-style: italic; background: #f5f8f9; }
.sig td { text-align: center; font-size: 9pt; }
.sig .line { border-bottom: 1px solid #1b2a30; margin: 18mm 14mm 2px; }
.sig .cap { font-size: 8pt; color: #5b6b72; }
"""


def _sig_row(labels):
    cells = ''.join(f'<td style="width:{100 // len(labels)}%">{l}<div class="line"></div><div class="cap">Nama jelas &amp; tanda tangan</div></td>' for l in labels)
    return f'<table class="sig"><tr>{cells}</tr></table>'


def _filler_rows(count, min_rows, ncols):
    """Blank ruled rows so short documents still show a full-looking table."""
    return ''.join('<tr>' + '<td>&nbsp;</td>' * ncols + '</tr>' for _ in range(max(0, min_rows - count)))


def _page(body, sig_html='', size='A4', margin='14mm', min_h='265mm', flow=False):
    """flow=True (long documents): no fixed page height, signatures follow the
    content instead of being pinned to the bottom of a single page."""
    css = _PRINT_CSS.replace('__SIZE__', size).replace('__MARGIN__', margin).replace('__MINH__', min_h)
    if flow:
        css += '.wrap{height:auto !important}.sigbox{position:static !important;margin-top:10mm}'
    return (f'<!DOCTYPE html><html><head><meta charset="UTF-8"><style>{css}</style></head><body>'
            f'<div class="wrap">{body}<div class="sigbox">{sig_html}</div></div></body></html>')


def _meta_rows(pairs):
    from html import escape as e
    return ''.join(f'<tr><td class="k">{k}</td><td>: {e(str(v) if v not in (None, "") else "-")}</td></tr>' for k, v in pairs)


def _render_po_html(d):
    from html import escape as e
    rows = ''.join(
        f"""<tr><td class="c">{i}</td><td>{e(it.get('code') or '')}</td><td>{e(it['item_name'])}</td><td class="r">{_num(it['quantity'])}</td>
<td>{e(it['uom'])}</td><td class="r">{_num(it['unit_price'])}</td><td class="r">{_num(it['subtotal'])}</td></tr>"""
        for i, it in enumerate(d['line_items'], 1)) + _filler_rows(len(d['line_items']), 10, 7)
    def tot(label, val, cls=''):
        return f'<tr class="{cls}"><td>{label}</td><td class="r">{_rp(val)}</td></tr>'
    totals = tot('Subtotal', d['subtotal'])
    if d['discount_amount']:
        totals += tot('Diskon', -d['discount_amount'])
    if d['tax_amount']:
        totals += tot('PPN', d['tax_amount'])
    totals += tot('TOTAL', d['total_amount'], 'grand')
    body = f"""{_doc_header_html(d['company'], 'PURCHASE ORDER', [f"No. {d['document_number']}", f"Tanggal: {d['document_date']}"])}
<table><tr>
<td class="box" style="width:50%"><div class="h">Kepada Supplier</div><div style="font-weight:bold;font-size:10.5pt">{e(d['supplier_name'] or '-')}</div><div>{e(d['supplier_address'] or '')}</div></td>
<td class="box"><table class="meta">{_meta_rows([('Dibutuhkan', d['required_date']), ('Syarat Pembayaran', d['payment_terms']), ('Kirim Ke', d['delivery_address'])])}</table></td>
</tr></table>
<table class="items"><thead><tr><th>No.</th><th>Kode</th><th>Deskripsi</th><th class="r">Qty</th><th>Satuan</th><th class="r">Harga</th><th class="r">Jumlah</th></tr></thead><tbody>{rows}</tbody></table>
<table class="sum">{totals}</table>
<div class="words"><b>Terbilang:</b> {e(d['terbilang'])}</div>
{f'<div style="margin-top:8px;font-size:9pt"><b>Catatan:</b> {e(d["notes"])}</div>' if d['notes'] else ''}"""
    return _page(body, _sig_row(['Dibuat oleh,', 'Disetujui oleh,']), flow=len(d['line_items']) > 12)


def _render_sj_html(d):
    from html import escape as e
    rows = ''
    for i, it in enumerate(d['items'], 1):
        batches = ', '.join(f"{b['batch_number']} ({_num(b['quantity'])})" for b in it.get('batches', []))
        rows += f"""<tr><td class="c">{i}</td><td>{e(it.get('code') or '')}</td><td>{e(it['product_name'] or '')}</td><td class="r">{_num(it['pack']) if it.get('pack') else ''}</td>
<td class="r">{_num(it['quantity'])}</td><td>{e(it['uom'] or '')}</td><td>{e(batches)}</td><td>{e(it.get('description') or '')}</td></tr>"""
    rows += _filler_rows(len(d['items']), 10, 8)
    total_row = f'<tr class="tot"><td colspan="4" class="r">TOTAL QTY</td><td class="r">{_num(d["total_quantity"])}</td><td colspan="3"></td></tr>'
    body = f"""{_doc_header_html(d['company'], 'SURAT JALAN', [f"No. {d['document_number']}", f"Tanggal: {d['document_date']}", f"Ref. SO: {d['sales_order_number']}"])}
<table><tr>
<td class="box" style="width:50%"><div class="h">Kepada</div><div style="font-weight:bold;font-size:10.5pt">{e(d['customer_name'] or '-')}</div><div>{e(d['customer_address'] or '')}</div><div>{e(d['customer_phone'] or '')}</div></td>
<td class="box"><table class="meta">{_meta_rows([('Sopir', d['driver_name']), ('No. Kendaraan', d['vehicle_number'])])}</table></td>
</tr></table>
<table class="items"><thead><tr><th>No.</th><th>Kode</th><th>Nama Produk</th><th class="r">Isi/Krt</th><th class="r">Qty</th><th>Satuan</th><th>Batch</th><th>Keterangan</th></tr></thead><tbody>{rows}{total_row}</tbody></table>
{f'<div style="margin-top:8px;font-size:9pt"><b>Catatan:</b> {e(d["notes"])}</div>' if d['notes'] else ''}
<div style="margin-top:6px;font-size:8pt;color:#5b6b72">Barang diterima dalam keadaan baik dan jumlah sesuai.</div>"""
    return _page(body, _sig_row(['Disiapkan oleh,', 'Sopir,', 'Diterima oleh,']), flow=len(d['items']) > 12)


def _render_spk_html(d):
    from html import escape as e
    prio = {'low': 'Rendah', 'normal': 'Normal', 'high': 'Tinggi', 'urgent': 'Mendesak'}.get(str(d.get('priority') or '').lower(), d.get('priority') or '-')
    body = f"""{_doc_header_html(d['company'], 'SURAT PERINTAH KERJA', [f"No. {d['document_number']}", f"Tanggal: {d['document_date']}", f"Ref. WO: {d['work_order_number']}"])}
<table><tr>
<td class="box" style="width:50%"><div class="h">Produk yang Dikerjakan</div>
<div style="font-weight:bold;font-size:11pt">{e(d['product_name'] or '-')}</div><div>Kode: {e(d['product_code'] or '-')}</div>
<div style="margin-top:6px;font-size:13pt"><b>{_num(d['quantity'])}</b> {e(d['uom'] or '')}</div></td>
<td class="box"><table class="meta">{_meta_rows([('Mesin', d['machine']), ('Mulai', d['start_date']), ('Target Selesai', d['due_date']), ('Prioritas', prio)])}</table></td>
</tr></table>
<table class="items"><thead><tr><th>Instruksi / Catatan Produksi</th></tr></thead>
<tbody><tr><td style="height:90mm">{e(d['notes'] or '')}</td></tr></tbody></table>"""
    return _page(body, _sig_row(['Operator,', 'Supervisor,', 'Disetujui oleh,']))


_SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']


def _terbilang(n):
    n = int(n)
    if n < 12:
        return _SATUAN[n]
    if n < 20:
        return _terbilang(n - 10) + ' belas'
    if n < 100:
        return _terbilang(n // 10) + ' puluh' + (' ' + _terbilang(n % 10) if n % 10 else '')
    if n < 200:
        return 'seratus' + (' ' + _terbilang(n - 100) if n > 100 else '')
    if n < 1000:
        return _terbilang(n // 100) + ' ratus' + (' ' + _terbilang(n % 100) if n % 100 else '')
    if n < 2000:
        return 'seribu' + (' ' + _terbilang(n - 1000) if n > 1000 else '')
    if n < 1000000:
        return _terbilang(n // 1000) + ' ribu' + (' ' + _terbilang(n % 1000) if n % 1000 else '')
    if n < 1000000000:
        return _terbilang(n // 1000000) + ' juta' + (' ' + _terbilang(n % 1000000) if n % 1000000 else '')
    if n < 1000000000000:
        return _terbilang(n // 1000000000) + ' miliar' + (' ' + _terbilang(n % 1000000000) if n % 1000000000 else '')
    return _terbilang(n // 1000000000000) + ' triliun' + (' ' + _terbilang(n % 1000000000000) if n % 1000000000000 else '')


def _rp(v):
    return 'Rp ' + f"{int(round(v)):,}".replace(',', '.')


def _render_kwitansi_html(d):
    from html import escape as e
    company = d['company']
    is_receipt = d['is_receipt']
    title = 'BUKTI PENERIMAAN' if is_receipt else 'BUKTI PEMBAYARAN'
    party_label = 'Diterima dari' if is_receipt else 'Dibayarkan kepada'

    if d['allocations']:
        head = '<tr><th>No.</th><th>No. Faktur</th><th class="r">Dibayar</th></tr>'
        rows = ''.join(
            f'<tr><td class="c">{i}</td><td>{e(a["invoice_number"])}</td><td class="r">{_rp(a["amount"])}</td></tr>'
            for i, a in enumerate(d['allocations'], 1)) + _filler_rows(len(d['allocations']), 4, 3)
        cols = 3
    else:
        head = '<tr><th>No.</th><th>Akun</th><th>Keterangan</th><th class="r">Nilai</th></tr>'
        rows = ''.join(
            f'<tr><td class="c">{i}</td><td>{e(l["account"])}</td><td>{e(l["description"] or "")}</td><td class="r">{_rp(l["amount"])}</td></tr>'
            for i, l in enumerate(d['lines'], 1)) + _filler_rows(len(d['lines']), 4, 4)
        cols = 4
    total_row = f'<tr class="tot"><td colspan="{cols - 1}" class="r">TOTAL</td><td class="r">{_rp(d["amount"])}</td></tr>'
    signs = ['Penerima,', 'Pemberi,', 'Mengetahui,'] if is_receipt else ['Penerima,', 'Kasir / Keuangan,', 'Mengetahui,']

    body = f"""{_doc_header_html(company, title, [f"No. {d['document_number']}", f"Tanggal: {d['document_date']}"])}
<table class="info">
<tr><td class="k">{party_label}</td><td>: <b>{e(d['party_name'] or '-')}</b></td><td class="k">Kas/Bank</td><td>: {e(d['bank_account'] or '-')}</td></tr>
<tr><td class="k">Metode</td><td>: {e(d['payment_method'] or '-')}</td><td class="k">No. Referensi</td><td>: {e(d['reference_number'] or '-')}</td></tr>
</table>
<div class="words"><b>Terbilang:</b> {e(d['terbilang'])}</div>
<table class="items"><thead>{head}</thead><tbody>{rows}{total_row}</tbody></table>
{f'<div style="margin-top:6px;font-size:8.5pt"><b>Catatan:</b> {e(d["notes"])}</div>' if d['notes'] else ''}"""
    n = len(d['allocations']) or len(d['lines'])
    return _page(body, _sig_row(signs), size='A5 landscape', margin='10mm 12mm', min_h='124mm', flow=n > 4)


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

    from models.finance import Account

    doc_number = generate_number('DOC-KWT', Document, 'document_number')

    party = payment.customer if payment.customer else payment.supplier
    bank = db.session.get(Account, payment.bank_account_id) if payment.bank_account_id else None
    allocations = [{'invoice_number': a.invoice.invoice_number if a.invoice else f'#{a.invoice_id}', 'amount': float(a.amount)}
                   for a in payment.allocations]
    if not allocations and payment.invoice:
        allocations = [{'invoice_number': payment.invoice.invoice_number, 'amount': float(payment.amount or 0)}]
    lines = []
    for l in payment.lines:
        acc = db.session.get(Account, l.account_id)
        lines.append({'account': f'{acc.account_code} - {acc.account_name}' if acc else f'#{l.account_id}',
                      'description': l.description, 'amount': float(l.amount)})
    if not allocations and not lines and payment.contra_account_id:
        acc = db.session.get(Account, payment.contra_account_id)
        lines.append({'account': f'{acc.account_code} - {acc.account_name}' if acc else '-',
                      'description': payment.notes, 'amount': float(payment.amount or 0)})

    amount = float(payment.amount or 0)
    document_data = {
        'document_number': payment.payment_number,
        'document_date': payment.payment_date.strftime('%d-%m-%Y') if payment.payment_date else '',
        'is_receipt': payment.payment_type in ('receipt', 'received') or payment.customer_id is not None,
        'party_name': (party.company_name if hasattr(party, 'company_name') else getattr(party, 'name', '')) if party else '',
        'amount': amount,
        'terbilang': (_terbilang(amount).strip().capitalize() + ' rupiah') if amount >= 1 else 'Nol rupiah',
        'payment_method': (payment.payment_method or '').replace('_', ' ').title(),
        'reference_number': payment.reference_number or '',
        'bank_account': f'{bank.account_code} - {bank.account_name}' if bank else '',
        'allocations': allocations,
        'lines': lines,
        'notes': payment.notes or '',
        'company': get_company_context(),
    }

    document = Document(
        document_number=doc_number,
        document_title=f'Kwitansi {payment.payment_number}',
        document_type='kwitansi',
        template_version_id=None,
        document_data=document_data,
        reference_type='payment',
        reference_id=payment.id,
        reference_number=payment.payment_number,
        status='generated',
        created_by=user_id
    )
    document.html_content = _render_kwitansi_html(document_data)

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
