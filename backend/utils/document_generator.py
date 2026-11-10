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
from utils.template_render_engine import render_template_version_to_html, _format_value
from utils.default_templates import ensure_default_template


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

        template = ensure_default_template(user_id, 'surat_jalan')

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
                'no': len(items_data) + 1,
                'batch_text': ', '.join(f"{m['batch_number']} ({_format_value(m['quantity_deducted'], 'num')})" for m in result['movements']),
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
            'hdr_no': f'No. {doc_number}',
            'hdr_date': f"Tanggal: {datetime.utcnow().strftime('%d-%m-%Y')}",
            'hdr_extra': f'Ref. SO: {sales_order.order_number}',
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

        template = ensure_default_template(user_id, 'spk')

        doc_number = generate_number('SPK', Document, 'document_number')

        document_data = {
            'document_number': doc_number,
            'hdr_no': f'No. {doc_number}',
            'hdr_date': f"Tanggal: {datetime.utcnow().strftime('%d-%m-%Y')}",
            'hdr_extra': f'Ref. WO: {work_order.wo_number}',
            'product_code_line': f"Kode: {work_order.product.code if work_order.product else '-'}",
            'priority_label': {'low': 'Rendah', 'normal': 'Normal', 'high': 'Tinggi', 'urgent': 'Mendesak'}.get(str(work_order.priority or 'normal').lower(), work_order.priority or '-'),
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

    template = ensure_default_template(user_id, 'spk_batch')

    doc_number = generate_number('SPK', Document, 'document_number')

    recipe = batch.recipe
    document_data = {
        'document_number': doc_number,
        'hdr_no': f'No. {doc_number}',
        'hdr_date': f"Tanggal: {datetime.utcnow().strftime('%d-%m-%Y')}",
        'hdr_extra': f'Batch: {batch.batch_number}',
        'product_code_line': f"Kode: {recipe.product.code if recipe and recipe.product else '-'}",
        'wo_line': f"Ref. WO: {batch.work_order.wo_number if batch.work_order else '-'}",
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
        'bom_items': [dict(r, no=i, realisasi='') for i, r in enumerate(_build_spk_bom_rows(recipe.product_id, batch.planned_qty) if recipe else [], 1)],
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

    template = ensure_default_template(user_id, 'invoice')

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
            'no': len(line_items) + 1,
            'discount_text': ((_format_value(discount, 'num') + (f' ({_format_value(pct, "num")}%)' if pct else '')) if discount else '-'),
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
        'hdr_no': f'No. {invoice.invoice_number}',
        'hdr_date': f"Tanggal: {invoice.invoice_date.strftime('%d-%m-%Y') if invoice.invoice_date else ''}",
        'hdr_extra': f'Status: {status_label}',
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


def generate_surat_jalan_from_shipping_order(shipping_id, user_id):
    """Printable Surat Jalan for an existing ShippingOrder. Stock was already deducted when the
    shipping order was created, so this only renders - it never touches inventory."""
    from models.shipping import ShippingOrder

    so_ship = db.session.get(ShippingOrder, shipping_id)
    if not so_ship:
        raise ValueError('Surat Jalan tidak ditemukan')
    template = ensure_default_template(user_id, 'surat_jalan')
    doc_number = generate_number('SJ', Document, 'document_number')
    sales_order = so_ship.sales_order
    customer = so_ship.customer

    grouped = {}
    for it in so_ship.items:
        key = (it.sales_order_item_id or 0, it.product_id)
        g = grouped.setdefault(key, {'item': it, 'qty': 0.0, 'batches': []})
        g['qty'] += float(it.quantity)
        if it.batch_number:
            g['batches'].append((it.batch_number, float(it.quantity)))
    items_data, total_qty = [], 0.0
    for g in grouped.values():
        it = g['item']
        prod = it.product
        so_item = it.sales_order_item
        total_qty += g['qty']
        items_data.append({
            'no': len(items_data) + 1,
            'code': prod.code if prod else '',
            'product_name': prod.name if prod else '',
            'pack': prod.packaging.packs_per_karton if prod and prod.packaging else None,
            'quantity': g['qty'],
            'uom': it.uom,
            'batch_text': ', '.join(f"{b} ({_format_value(q, 'num')})" for b, q in g['batches']),
            # Keterangan baris hanya dicetak bila berbeda dari nama barang (bawaannya sama dengan nama barang).
            'description': ((so_item.description or '').strip() if so_item and (so_item.description or '').strip() != (prod.name if prod else '').strip() else ''),
        })
    d = so_ship.shipping_date.strftime('%d-%m-%Y') if so_ship.shipping_date else ''
    document_data = {
        'document_number': so_ship.shipping_number,
        'document_date': d,
        'sales_order_number': sales_order.order_number if sales_order else '',
        'customer_name': customer.company_name if customer else '',
        'customer_address': so_ship.shipping_address or (sales_order.delivery_address if sales_order else None) or (customer.billing_address if customer else ''),
        'customer_phone': customer.phone if customer else '',
        'hdr_no': f'No. {so_ship.shipping_number}',
        'hdr_date': f'Tanggal: {d}',
        'hdr_extra': f'Ref. SO: {sales_order.order_number}' if sales_order else '',
        'items': items_data,
        'total_quantity': total_qty,
        'notes': so_ship.notes or '',
        'driver_name': so_ship.driver_name or '',
        'vehicle_number': so_ship.vehicle_number or '',
        'company': get_company_context(),
    }
    document = Document(
        document_number=doc_number,
        document_title=f'Surat Jalan {so_ship.shipping_number}',
        document_type='surat_jalan',
        template_version_id=template.current_version_id,
        document_data=document_data,
        reference_type='shipping_order',
        reference_id=so_ship.id,
        reference_number=so_ship.shipping_number,
        status='generated',
        created_by=user_id,
    )
    document.html_content = render_template_version_to_html(template.current_version, document_data)
    db.session.add(document)
    db.session.flush()
    db.session.add(DocumentLog(document_id=document.id, activity_type='auto_generated',
                               activity_description=f'Surat Jalan dicetak dari pengiriman {so_ship.shipping_number}', user_id=user_id))
    db.session.commit()
    return document


def build_po_document_data(po):
    """Amounts are pre-formatted in the PO's own currency (the render engine's
    'rp' format is IDR-only)."""
    from utils.tax_helpers import ppn_rate_for_code

    supplier = po.supplier
    ccy = (po.currency or 'IDR').upper()
    symbols = {'IDR': 'Rp', 'USD': 'US$', 'EUR': 'EUR', 'CNY': 'CNY', 'JPY': 'JPY', 'SGD': 'S$'}
    words_name = {'IDR': 'rupiah', 'USD': 'dolar Amerika Serikat', 'EUR': 'euro', 'CNY': 'yuan',
                  'JPY': 'yen', 'SGD': 'dolar Singapura'}

    def money(v, force_decimals=False):
        n = float(v or 0)
        decimals = 2 if (ccy != 'IDR' or force_decimals or n != int(n)) else 0
        txt = f'{n:,.{decimals}f}'.replace(',', '_').replace('.', ',').replace('_', '.')
        return f'{symbols.get(ccy, ccy)} {txt}'

    line_items = []
    for item in po.items:
        line_items.append({
            'no': len(line_items) + 1,
            'code': (item.product.code if item.product else (getattr(item.material, 'code', '') if item.material else '')),
            'item_name': (item.description or (item.product.name if item.product else (item.material.name if item.material else ''))) + (('\n' + item.notes.strip()) if (item.notes or '').strip() else ''),
            'quantity': float(item.quantity),
            'uom': item.uom or '',
            'unit_price_text': money(item.unit_price),
            'subtotal_text': money(item.total_price),
        })

    def fmt_date(d):
        return d.strftime('%d-%m-%Y') if d else ''

    contact = ' | '.join(x for x in [
        f'Attn: {supplier.contact_person}' if supplier and supplier.contact_person else '',
        f'Telp: {supplier.phone or supplier.mobile}' if supplier and (supplier.phone or supplier.mobile) else '',
        supplier.email if supplier and supplier.email else '',
    ] if x)

    rate = float(po.exchange_rate or 1)
    foreign = ccy != 'IDR'
    kurs_text = ''
    if foreign:
        if po.status == 'draft' and not po.manual_exchange_rate:
            kurs_text = 'Kurs belum dikunci'
        else:
            r = float(po.manual_exchange_rate) if (po.status == 'draft' and po.manual_exchange_rate) else rate
            kurs_text = f'Kurs 1 {ccy} = Rp {r:,.2f}'.replace(',', '_').replace('.', ',').replace('_', '.')

    code = (po.ppn_code or (supplier.ppn_code if supplier else None) or 'Y') if po.is_taxable else None
    tax_pct = ppn_rate_for_code(code) if code else None
    rate_txt = f'{tax_pct:g}'.replace('.', ',') if tax_pct is not None else ''
    inclusive = bool(po.is_taxable and po.tax_inclusive)
    # same wording as the PO form ("Pajak (PPN)" block and its order summary)
    if not po.is_taxable:
        tax_note = 'Tanpa pajak'
        subtotal_label, tax_label = 'Subtotal', 'PPN'
    elif inclusive:
        tax_note = f'Harga sudah termasuk pajak (PPN {code} - {rate_txt}%): PPN dipisahkan dari harga, total pembayaran tidak bertambah'
        subtotal_label, tax_label = 'DPP (tanpa PPN)', f'PPN {rate_txt}% (termasuk)'
    else:
        tax_note = f'PPN {code} - {rate_txt}% ditambahkan di atas harga'
        subtotal_label, tax_label = 'Subtotal', f'PPN {rate_txt}%'

    total = float(po.total_amount or 0)
    idr_text = ''
    if foreign and not (po.status == 'draft' and not po.manual_exchange_rate):
        r = float(po.manual_exchange_rate) if (po.status == 'draft' and po.manual_exchange_rate) else rate
        idr_text = ('Setara Rp ' + f'{total * r:,.0f}'.replace(',', '.'))
        tax_note += '. Setara Rp ' + f'{total * r:,.0f}'.replace(',', '.') + f' ({kurs_text})'

    document_data = {
        'document_number': po.po_number,
        'hdr_no': f'No. {po.po_number}',
        'hdr_date': f"Tanggal: {fmt_date(po.order_date)}",
        'hdr_extra': f'Mata Uang: {ccy}' + (f' ({kurs_text})' if kurs_text else ''),
        'document_date': fmt_date(po.order_date),
        'required_date': fmt_date(po.required_date),
        'expected_date': fmt_date(po.expected_date),
        'supplier_name': supplier.company_name if supplier else '',
        'supplier_address': ', '.join(x for x in [supplier.address, supplier.city, supplier.country] if x) if supplier else '',
        'supplier_contact': contact,
        'supplier_tax_id': f'NPWP/Tax ID: {supplier.tax_id}' if supplier and supplier.tax_id else '',
        'supplier_tax_address': (supplier.tax_address or '') if supplier else '',
        'delivery_address': po.delivery_address or '',
        'payment_terms': po.payment_terms or '',
        'notes': po.notes or '',
        'subtotal_text': money(po.subtotal),
        'discount_text': money(po.discount_amount),
        'tax_text': money(po.tax_amount),
        'total_text': money(total),
        'tax_note': tax_note,
        'subtotal_label': subtotal_label,
        'tax_label': tax_label,
        'terbilang': (_terbilang(total).strip().capitalize() + ' ' + words_name.get(ccy, ccy)) if total >= 1 else f'Nol {words_name.get(ccy, ccy)}',
        'line_items': line_items,
        'company': get_company_context(),
    }
    return document_data


def generate_purchase_invoice_document(invoice_id, user_id):
    """Printable Faktur Pembelian (purchase invoice)."""
    from models.finance import Invoice

    inv = db.session.get(Invoice, invoice_id)
    if not inv or inv.invoice_type != 'purchase':
        raise ValueError('Faktur pembelian tidak ditemukan')

    ccy = (inv.currency or 'IDR').upper()
    symbols = {'IDR': 'Rp', 'USD': 'US$', 'EUR': 'EUR', 'CNY': 'CNY', 'JPY': 'JPY', 'SGD': 'S$'}
    words_name = {'IDR': 'rupiah', 'USD': 'dolar Amerika Serikat', 'EUR': 'euro', 'CNY': 'yuan', 'JPY': 'yen', 'SGD': 'dolar Singapura'}

    def money(v):
        n = float(v or 0)
        decimals = 2 if (ccy != 'IDR' or n != int(n)) else 0
        txt = f'{n:,.{decimals}f}'.replace(',', '_').replace('.', ',').replace('_', '.')
        return f'{symbols.get(ccy, ccy)} {txt}'

    def fmt_date(d):
        return d.strftime('%d-%m-%Y') if d else ''

    supplier = inv.supplier
    po = inv.purchase_order
    line_items, dpp, tax = [], 0.0, 0.0
    for item in inv.items:
        base = float(item.quantity or 0) * float(item.unit_price or 0) - float(item.discount_amount or 0)
        dpp += base
        tax += float(item.tax_amount or 0)
        master = (item.product.name if item.product else (item.material.name if getattr(item, 'material', None) else ''))
        line_items.append({
            'no': len(line_items) + 1,
            'code': (item.product.code if item.product else (getattr(item.material, 'code', '') if getattr(item, 'material', None) else '')),
            'item_name': (item.description or master) + (('\n' + item.notes.strip()) if (item.notes or '').strip() else ''),
            'quantity': float(item.quantity or 0), 'uom': item.uom or '',
            'unit_price_text': money(item.unit_price), 'subtotal_text': money(base),
        })
    total = float(inv.total_amount or 0)
    tax = tax or float(inv.tax_amount or 0)
    contact = ' | '.join(x for x in [
        f'Attn: {supplier.contact_person}' if supplier and supplier.contact_person else '',
        f'Telp: {supplier.phone or supplier.mobile}' if supplier and (supplier.phone or supplier.mobile) else '',
        supplier.email if supplier and supplier.email else ''] if x)
    document_data = {
        'document_number': inv.invoice_number,
        'hdr_no': f'No. {inv.invoice_number}',
        'hdr_date': f'Tanggal: {fmt_date(inv.invoice_date)}',
        'hdr_extra': f'Mata Uang: {ccy}',
        'document_date': fmt_date(inv.invoice_date),
        'due_date': fmt_date(inv.due_date),
        'supplier_invoice_number': inv.supplier_invoice_number or '',
        'supplier_invoice_date': fmt_date(inv.supplier_invoice_date),
        'po_number': po.po_number if po else '',
        'supplier_name': supplier.company_name if supplier else '',
        'supplier_address': getattr(supplier, 'address', '') or '' if supplier else '',
        'supplier_contact': contact,
        'supplier_tax_id': (f'NPWP: {supplier.tax_id}' if supplier and getattr(supplier, 'tax_id', None) else ''),
        'notes': inv.notes or '',
        'subtotal_label': 'Subtotal', 'tax_label': 'PPN',
        'subtotal_text': money(dpp), 'discount_text': money(inv.discount_amount or 0), 'tax_text': money(tax), 'total_text': money(total),
        'terbilang': (_terbilang(total).strip().capitalize() + ' ' + words_name.get(ccy, ccy)) if total >= 1 else f'Nol {words_name.get(ccy, ccy)}',
        'line_items': line_items,
        'company': get_company_context(),
    }
    template = ensure_default_template(user_id, 'purchase_invoice')
    document = Document(
        document_number=generate_number('DOC-PI', Document, 'document_number'),
        document_title=f'Faktur Pembelian {inv.invoice_number} - {supplier.company_name if supplier else ""}',
        document_type='purchase_invoice',
        template_version_id=template.current_version_id,
        document_data=document_data,
        reference_type='purchase_invoice', reference_id=inv.id, reference_number=inv.invoice_number,
        status='generated', created_by=user_id)
    document.html_content = render_template_version_to_html(template.current_version, document_data)
    db.session.add(document)
    db.session.flush()
    db.session.add(DocumentLog(document_id=document.id, activity_type='auto_generated',
                               activity_description=f'Faktur pembelian {inv.invoice_number} dicetak', user_id=user_id))
    db.session.commit()
    return document


def generate_three_way_match_document(invoice_id, user_id):
    """Cetak hasil pencocokan 3 arah (PO, penerimaan barang, faktur) sebagai dokumen lanskap."""
    from models.finance import Invoice
    from routes.purchase_invoice import _compute_three_way_match

    inv = db.session.get(Invoice, invoice_id)
    if not inv or inv.invoice_type != 'purchase':
        raise ValueError('Faktur pembelian tidak ditemukan')
    m = _compute_three_way_match(inv)
    ccy = (inv.currency or 'IDR').upper()
    symbols = {'IDR': 'Rp', 'USD': 'US$', 'EUR': 'EUR', 'CNY': 'CNY', 'JPY': 'JPY', 'SGD': 'S$'}

    def money(v):
        n = float(v or 0)
        txt = f'{n:,.{2 if (ccy != "IDR" or n != int(n)) else 0}f}'.replace(',', '_').replace('.', ',').replace('_', '.')
        return f'{symbols.get(ccy, ccy)} {txt}'

    overall_text = {'matched': 'Cocok', 'discrepancy': 'Ada selisih', 'missing_grn': 'GRN belum ada'}.get(m['overall_status'], m['overall_status'])
    from models.purchasing import PurchaseOrderItem
    for l in m['lines']:
        if not (l.get('item_name') or '').strip():
            poi = db.session.get(PurchaseOrderItem, l['po_item_id'])
            l['item_name'] = (poi.description or (poi.material.name if poi and poi.material else '') or (poi.product.name if poi and poi.product else '')) if poi else ''
    rows = []
    for i, l in enumerate(m['lines'], 1):
        diffs = []
        if abs(l['price_variance']) > 0.01:
            diffs.append(f"Harga {('+' if l['price_variance'] > 0 else '')}{money(l['price_variance'])}")
        if abs(l['qty_vs_grn']) > 0.001:
            diffs.append(f"Qty {('+' if l['qty_vs_grn'] > 0 else '')}{l['qty_vs_grn']:g} vs GRN")
        rows.append({
            'no': i, 'item_name': l['item_name'], 'uom': l['uom'] or '', 'po_qty': l['po_qty'], 'po_price_text': money(l['po_price']),
            'grn_qty': l['grn_accepted'], 'inv_qty': l['inv_qty'], 'inv_price_text': money(l['inv_price']), 'inv_total_text': money(l['inv_total']),
            'diff_text': '; '.join(diffs) or '-', 'status_text': {'matched': 'Cocok', 'discrepancy': 'Selisih'}.get(l['status'], l['status']),
        })
    notes = '\n'.join(f"{r['item_name']}: " + ' | '.join(l['issues']) for r, l in zip(rows, m['lines']) if l['issues'])
    d = lambda x: x.strftime('%d-%m-%Y') if x else ''
    document_data = {
        'document_number': inv.invoice_number,
        'hdr_no': f'No. Faktur {inv.invoice_number}',
        'hdr_date': f'Tanggal: {d(inv.invoice_date)}',
        'hdr_extra': f'PO: {m["po_number"]}',
        'invoice_number': inv.invoice_number, 'po_number': m['po_number'], 'overall_text': overall_text,
        'supplier_name': m['supplier_name'] or '',
        'summary_line': f"{m['grn_count']} dokumen penerimaan barang | Mata uang {ccy}",
        'lines': rows, 'notes': notes,
        'po_total_text': money(m['po_total_invoiced']), 'invoice_subtotal_text': money(m['invoice_subtotal']),
        'value_diff_text': money(m['invoice_subtotal'] - m['po_total_invoiced']),
        'company': get_company_context(),
    }
    template = ensure_default_template(user_id, 'three_way_match')
    document = Document(
        document_number=generate_number('DOC-3WM', Document, 'document_number'),
        document_title=f'Pencocokan 3 Arah {inv.invoice_number}', document_type='three_way_match',
        template_version_id=template.current_version_id, document_data=document_data,
        reference_type='purchase_invoice', reference_id=inv.id, reference_number=inv.invoice_number,
        status='generated', created_by=user_id)
    document.html_content = render_template_version_to_html(template.current_version, document_data)
    db.session.add(document)
    db.session.flush()
    db.session.add(DocumentLog(document_id=document.id, activity_type='auto_generated',
                               activity_description=f'Pencocokan 3 arah {inv.invoice_number} dicetak', user_id=user_id))
    db.session.commit()
    return document


def generate_grn_document(grn_id, user_id, detail=False):
    """Cetak penerimaan barang. detail=True: satu baris per nomor batch; False: satu baris per barang (batch diringkas)."""
    from models.purchasing import GoodsReceivedNote

    grn = db.session.get(GoodsReceivedNote, grn_id)
    if not grn:
        raise ValueError('GRN tidak ditemukan')

    def name_of(i):
        return (i.item_name or (i.po_item.description if i.po_item and i.po_item.description else None)
                or (i.material.name if i.material else None) or (i.product.name if i.product else None) or '')

    def fmt(n):
        n = float(n or 0)
        return f'{n:,.3f}'.rstrip('0').rstrip('.').replace(',', '_').replace('.', ',').replace('_', '.')

    from routes.purchasing import _display_qty
    groups = {}
    for it in grn.items:
        key = it.po_item_id or (it.material_id, it.product_id, name_of(it))
        groups.setdefault(key, []).append(it)
    rows, n = [], 0
    for items in groups.values():
        if detail:
            for it in items:
                n += 1
                dq, du, _f = _display_qty(it)
                rows.append({'no': n, 'item_name': name_of(it), 'uom': du, 'qty': dq, 'batch_text': it.batch_number or '-'})
        else:
            n += 1
            batches = [b for b in dict.fromkeys(i.batch_number for i in items) if b]
            disp = [_display_qty(i) for i in items]
            same = len({d[1] for d in disp}) == 1
            rows.append({'no': n, 'item_name': name_of(items[0]), 'uom': disp[0][1] if same else items[0].uom,
                         'qty': sum(d[0] for d in disp) if same else sum(float(i.quantity_received or 0) for i in items),
                         'batch_text': (batches[0] if len(batches) == 1 else (f'{len(batches)} batch' if batches else '-'))})
    total = sum(r['qty'] for r in rows)
    d = lambda x: x.strftime('%d-%m-%Y') if x else ''
    document_data = {
        'document_number': grn.grn_number,
        'hdr_no': f'No. {grn.grn_number}', 'hdr_date': f'Tanggal Terima: {d(grn.receipt_date)}',
        'hdr_extra': 'Rincian per nomor batch' if detail else '',
        'supplier_name': grn.supplier.company_name if grn.supplier else '',
        'summary_line': f'Status {grn.status}' + (f' | {len(rows)} baris' if rows else ''),
        'po_number': grn.purchase_order.po_number if grn.purchase_order else 'Tanpa PO',
        'delivery_note': grn.delivery_note_number or '-', 'supplier_invoice_number': grn.supplier_invoice_number or '-',
        'vehicle_driver': ' / '.join(x for x in [grn.vehicle_number, grn.driver_name] if x) or '-',
        'lines': rows, 'total_qty_text': fmt(total), 'notes': grn.notes or '',
        'company': get_company_context(),
    }
    template = ensure_default_template(user_id, 'grn')
    document = Document(
        document_number=generate_number('DOC-GRN', Document, 'document_number'),
        document_title=f'Penerimaan Barang {grn.grn_number}' + (' (rincian batch)' if detail else ''), document_type='grn',
        template_version_id=template.current_version_id, document_data=document_data,
        reference_type='grn', reference_id=grn.id, reference_number=grn.grn_number, status='generated', created_by=user_id)
    document.html_content = render_template_version_to_html(template.current_version, document_data)
    db.session.add(document)
    db.session.flush()
    db.session.add(DocumentLog(document_id=document.id, activity_type='auto_generated',
                               activity_description=f'GRN {grn.grn_number} dicetak' + (' (rincian batch)' if detail else ''), user_id=user_id))
    db.session.commit()
    return document


def generate_purchase_requisition_document(pr_id, user_id):
    """Cetak Bon Permintaan Pembelian (Purchase Request)."""
    from models.purchasing import PurchaseRequisition

    pr = db.session.get(PurchaseRequisition, pr_id)
    if not pr:
        raise ValueError('Permintaan pembelian tidak ditemukan')

    def fmt(n):
        return f'{float(n or 0):,.3f}'.rstrip('0').rstrip('.').replace(',', '_').replace('.', ',').replace('_', '.')

    d = lambda x: x.strftime('%d-%m-%Y') if x else '-'
    rows = []
    for i, it in enumerate(pr.items, 1):
        master = (it.material.name if it.material else (it.product.name if it.product else ''))
        rows.append({'no': i, 'code': it.item_code or (it.material.code if it.material else (it.product.code if it.product else '')),
                     'item_name': it.item_name or master, 'quantity': float(it.quantity or 0), 'uom': it.uom, 'notes': it.notes or '',
                     'qty_text': f'{fmt(it.quantity)} {it.uom}'.strip()})
    labels = {'low': 'Rendah', 'normal': 'Normal', 'high': 'Tinggi', 'urgent': 'Mendesak'}
    status = {'draft': 'Draf', 'submitted': 'Diajukan', 'approved': 'Disetujui', 'rejected': 'Ditolak', 'converted': 'Jadi PO', 'partially_converted': 'Sebagian jadi PO'}
    document_data = {
        'document_number': pr.pr_number, 'hdr_no': f'No. {pr.pr_number}', 'hdr_date': f'Tanggal: {d(pr.request_date)}', 'hdr_extra': '',
        'requester_name': (pr.requester.full_name or pr.requester.username) if pr.requester else '',
        'department_line': f'Departemen: {pr.department}' if pr.department else '',
        'purpose': pr.purpose or '', 'request_date': d(pr.request_date), 'required_date': d(pr.required_date),
        'priority_label': labels.get(pr.priority, pr.priority or ''), 'status_label': status.get(pr.status, pr.status or ''),
        'bagian': pr.department or '', 'bpp_no': pr.pr_number, 'tanggal_text': d(pr.request_date), 'kepada': 'Purchasing',
        'lines': rows, 'notes': pr.notes or '', 'company': get_company_context(),
    }
    template = ensure_default_template(user_id, 'purchase_requisition')
    document = Document(
        document_number=generate_number('DOC-PR', Document, 'document_number'),
        document_title=f'Bon Permintaan Pembelian {pr.pr_number}', document_type='purchase_requisition',
        template_version_id=template.current_version_id, document_data=document_data,
        reference_type='purchase_requisition', reference_id=pr.id, reference_number=pr.pr_number, status='generated', created_by=user_id)
    document.html_content = render_template_version_to_html(template.current_version, document_data)
    db.session.add(document)
    db.session.flush()
    db.session.add(DocumentLog(document_id=document.id, activity_type='auto_generated',
                               activity_description=f'Bon permintaan pembelian {pr.pr_number} dicetak', user_id=user_id))
    db.session.commit()
    return document


def generate_purchase_order_document(po_id, user_id):
    """Printable Purchase Order."""
    from models.purchasing import PurchaseOrder

    po = db.session.get(PurchaseOrder, po_id)
    if not po:
        raise ValueError('Purchase Order not found')

    template = ensure_default_template(user_id, 'purchase_order')
    doc_number = generate_number('DOC-PO', Document, 'document_number')
    document_data = build_po_document_data(po)
    supplier = po.supplier
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




_SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']


def refresh_documents_layout(document_type, user_id=None):
    """Re-render already generated documents of one type with the current default
    layout and fresh company header, keeping each document's stored data."""
    template = ensure_default_template(user_id, document_type)
    n = 0
    for doc in Document.query.filter_by(document_type=document_type).all():
        data = dict(doc.document_data or {})
        data['company'] = get_company_context()
        doc.document_data = data
        doc.template_version_id = template.current_version_id
        doc.html_content = render_template_version_to_html(template.current_version, data)
        n += 1
    db.session.commit()
    return n


def refresh_po_documents(user_id=None):
    """Re-render already generated PO documents with the current default layout."""
    from models.purchasing import PurchaseOrder

    template = ensure_default_template(user_id, 'purchase_order')
    n = 0
    for doc in Document.query.filter_by(document_type='purchase_order').all():
        po = db.session.get(PurchaseOrder, doc.reference_id) if doc.reference_id else None
        if not po:
            continue
        data = build_po_document_data(po)
        doc.document_data = data
        doc.template_version_id = template.current_version_id
        doc.html_content = render_template_version_to_html(template.current_version, data)
        n += 1
    db.session.commit()
    return n


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

    template = ensure_default_template(user_id, 'kwitansi')

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
    is_receipt = payment.payment_type in ('receipt', 'received') or payment.customer_id is not None
    detail_rows = []
    for a in allocations:
        detail_rows.append({'no': len(detail_rows) + 1, 'uraian': f"Pelunasan {a['invoice_number']}", 'keterangan': '', 'nilai': a['amount']})
    for l in lines:
        detail_rows.append({'no': len(detail_rows) + 1, 'uraian': l['account'], 'keterangan': l['description'] or '', 'nilai': l['amount']})
    document_data = {
        'title': 'BUKTI PENERIMAAN' if is_receipt else 'BUKTI PEMBAYARAN',
        'party_label': 'Diterima dari' if is_receipt else 'Dibayarkan kepada',
        'hdr_no': f'No. {payment.payment_number}',
        'hdr_date': f"Tanggal: {payment.payment_date.strftime('%d-%m-%Y') if payment.payment_date else ''}",
        'detail_rows': detail_rows,
        'sign_1': 'Penerima,',
        'sign_2': 'Pemberi,' if is_receipt else 'Kasir / Keuangan,',
        'sign_3': 'Mengetahui,',
        'document_number': payment.payment_number,
        'document_date': payment.payment_date.strftime('%d-%m-%Y') if payment.payment_date else '',
        'is_receipt': payment.payment_type in ('receipt', 'received') or payment.customer_id is not None,
        'party_name': (party.company_name if hasattr(party, 'company_name') else getattr(party, 'name', '')) if party else (payment.paid_to or ''),
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


