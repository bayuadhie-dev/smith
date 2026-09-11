"""
Print Template Designer - Render Engine (Fase 1).

Replaces routes/document_management.py's old render_document_html() (which
only understood the retired `template_structure.sections` shape) AND the old
/api/documents/render-pdf endpoint (which understood `bands` - the previous,
now-deleted TemplateDesigner.tsx format). This is the ONE render path used by
every caller from now on: manual "Generate" (routes/document_management.py),
the auto-SPK generators in utils/document_generator.py, and the editor's own
live preview.

Reads TemplateVersion.canvas_data - Fabric.js's OWN `canvas.toJSON([...extra
props])` output, stored verbatim (no custom schema on top of it, per the
architecture decision). Coordinates in canvas_data are already millimeters
(1 Fabric unit = 1mm, enforced by the editor - see frontend
TemplateVersionEditor.tsx), so this engine uses them directly as CSS `mm`
values with zero conversion.

canvas_data.objects[] entries - contract this engine expects (and the editor
must produce):
    Common (every object):
        elementType: 'label' | 'field' | 'image' | 'barcode' | 'qrcode'
                     | 'line' | 'box' | 'repeating_table'
        left, top:            position in mm, from the object's own anchor
        width, height:        BASE size in mm (before scale)
        scaleX, scaleY:       Fabric's resize multiplier (default 1) -
                               effective size = width*scaleX, height*scaleY
        angle:                rotation in degrees (default 0)
    Text-like (label/field):
        text:                 literal text (label) or placeholder text (field,
                               NOT used at render time - only fieldPath is)
        fontSize, fontFamily, fontWeight, textAlign, fill (text color),
        backgroundColor (Fabric Textbox's own prop)
    field:
        fieldPath:             dot-path into document_data, e.g. 'work_order.number'
    image:
        src:                   data-URI/URL for a STATIC image (used verbatim
                               if fieldPath is absent)
        fieldPath:             if present, image src is resolved from
                               document_data instead of `src` (e.g. company logo)
    barcode / qrcode:
        fieldPath OR staticValue: the value to encode (fieldPath wins if both present)
    line / box:
        stroke, strokeWidth
    repeating_table:
        dataSource:            key into document_data holding an ARRAY
        columns:               [{fieldPath, label, width, textAlign}, ...]
        rowHeight, headerHeight, showHeader

Repeating tables are the ONE deliberate exception to "everything is
position:absolute": they're emitted as a real HTML <table> flowing from its
anchor point, so WeasyPrint's native CSS pagination (<thead> repeats per
page) handles overflow - not something this engine reimplements.
"""
import base64
import io

PAPER_SIZES_MM = {
    'A4': (210, 297),
    'A5': (148, 210),
    'Letter': (216, 279),
    'Legal': (216, 356),
    'F4': (215, 330),
}


def _resolve_field(field_path, data):
    """Dot-path lookup into document_data, e.g. 'work_order.number' or
    'materials.0.item_name'. Missing path -> '' (never raises - a render
    should never 500 just because one optional field is absent)."""
    if not field_path:
        return ''
    value = data
    for part in field_path.split('.'):
        if isinstance(value, dict) and part in value:
            value = value[part]
        elif isinstance(value, list) and part.isdigit() and int(part) < len(value):
            value = value[int(part)]
        else:
            return ''
    return value if value is not None else ''


def _qrcode_data_uri(value):
    import qrcode
    img = qrcode.make(str(value))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


def _barcode_data_uri(value):
    """Code128, via reportlab (already a project dependency - no new library
    just for this)."""
    from reportlab.graphics.barcode import code128
    from reportlab.graphics.shapes import Drawing
    from reportlab.graphics import renderPM

    barcode = code128.Code128(str(value), barHeight=12, barWidth=0.4)
    drawing = Drawing(barcode.width, barcode.height)
    drawing.add(barcode)
    buf = io.BytesIO()
    renderPM.drawToFile(drawing, buf, fmt='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


def _paper_dimensions_mm(template_version):
    if template_version.canvas_width_mm and template_version.canvas_height_mm:
        return float(template_version.canvas_width_mm), float(template_version.canvas_height_mm)
    width, height = PAPER_SIZES_MM.get(template_version.paper_size or 'A4', PAPER_SIZES_MM['A4'])
    if (template_version.orientation or 'portrait') == 'landscape':
        width, height = height, width
    return float(width), float(height)


def _object_box(obj):
    """Effective position/size in mm, folding Fabric's scaleX/scaleY into width/height."""
    left = float(obj.get('left', 0) or 0)
    top = float(obj.get('top', 0) or 0)
    width = float(obj.get('width', 0) or 0) * float(obj.get('scaleX', 1) or 1)
    height = float(obj.get('height', 0) or 0) * float(obj.get('scaleY', 1) or 1)
    angle = float(obj.get('angle', 0) or 0)
    return left, top, width, height, angle


def _render_text_like(obj, document_data):
    left, top, width, height, angle = _object_box(obj)
    element_type = obj.get('elementType', 'label')

    if element_type == 'field':
        content = _resolve_field(obj.get('fieldPath'), document_data)
    else:
        content = obj.get('text', '')

    font_size = obj.get('fontSize', 10)
    font_family = obj.get('fontFamily', 'Arial')
    font_weight = obj.get('fontWeight', 'normal')
    text_align = obj.get('textAlign', 'left')
    color = obj.get('fill', '#000000')
    bg_color = obj.get('backgroundColor') or 'transparent'

    style = (
        f'position:absolute; left:{left}mm; top:{top}mm; width:{width}mm; height:{height}mm; '
        f'transform: rotate({angle}deg); transform-origin: top left; '
        f'font-size:{font_size}pt; font-family:{font_family}, sans-serif; font-weight:{font_weight}; '
        f'text-align:{text_align}; color:{color}; background-color:{bg_color}; '
        f'overflow:hidden; white-space:pre-wrap; display:flex; align-items:center; '
        f'justify-content:{ {"left": "flex-start", "center": "center", "right": "flex-end"}.get(text_align, "flex-start") };'
    )
    return f'<div style="{style}">{content}</div>'


def _render_image(obj, document_data):
    left, top, width, height, angle = _object_box(obj)
    field_path = obj.get('fieldPath')
    src = _resolve_field(field_path, document_data) if field_path else obj.get('src', '')
    if not src:
        return ''
    style = (
        f'position:absolute; left:{left}mm; top:{top}mm; width:{width}mm; height:{height}mm; '
        f'transform: rotate({angle}deg); transform-origin: top left;'
    )
    return f'<img src="{src}" style="{style} object-fit:contain;" />'


def _render_code(obj, document_data, kind):
    left, top, width, height, angle = _object_box(obj)
    field_path = obj.get('fieldPath')
    value = _resolve_field(field_path, document_data) if field_path else obj.get('staticValue', '')
    if not value:
        return ''
    try:
        data_uri = _qrcode_data_uri(value) if kind == 'qrcode' else _barcode_data_uri(value)
    except Exception:
        return ''  # never let a bad barcode value break the whole document render
    style = (
        f'position:absolute; left:{left}mm; top:{top}mm; width:{width}mm; height:{height}mm; '
        f'transform: rotate({angle}deg); transform-origin: top left;'
    )
    return f'<img src="{data_uri}" style="{style} object-fit:contain;" />'


def _render_line_or_box(obj, kind):
    left, top, width, height, angle = _object_box(obj)
    stroke = obj.get('stroke', '#000000')
    stroke_width = obj.get('strokeWidth', 1)
    style = (
        f'position:absolute; left:{left}mm; top:{top}mm; width:{width}mm; height:{height}mm; '
        f'transform: rotate({angle}deg); transform-origin: top left;'
    )
    if kind == 'line':
        style += f'border-bottom: {stroke_width}px solid {stroke}; height:0;'
    else:
        style += f'border: {stroke_width}px solid {stroke};'
    return f'<div style="{style}"></div>'


def _render_repeating_table(obj, document_data):
    """The one exception to absolute positioning - a real <table> flowing
    from the element's anchor, so WeasyPrint's native pagination (<thead>
    repeats per page) handles rows that overflow onto later pages."""
    left, top, width, _height, _angle = _object_box(obj)
    columns = obj.get('columns') or []
    rows = _resolve_field(obj.get('dataSource'), document_data)
    if not isinstance(rows, list):
        rows = []
    show_header = obj.get('showHeader', True)

    header_html = ''
    if show_header:
        header_cells = ''.join(
            f'<th style="text-align:{c.get("textAlign", "left")}; padding:1mm; border-bottom:0.3mm solid #333;">{c.get("label", "")}</th>'
            for c in columns
        )
        header_html = f'<thead><tr>{header_cells}</tr></thead>'

    body_rows = []
    for row in rows:
        cells = ''.join(
            f'<td style="text-align:{c.get("textAlign", "left")}; padding:1mm; border-bottom:0.2mm solid #ccc;">'
            f'{_resolve_field(c.get("fieldPath"), row) if isinstance(row, dict) else ""}</td>'
            for c in columns
        )
        body_rows.append(f'<tr>{cells}</tr>')

    col_widths = ''.join(f'<col style="width:{c.get("width", 0)}mm;">' for c in columns)

    return (
        f'<div style="position:relative; margin-left:{left}mm; width:{width}mm; margin-top:{top}mm;">'
        f'<table style="width:100%; border-collapse:collapse; font-size:9pt;">'
        f'<colgroup>{col_widths}</colgroup>'
        f'{header_html}<tbody>{"".join(body_rows)}</tbody>'
        f'</table></div>'
    )


def render_template_version_to_html(template_version, document_data):
    """Main entry point - replaces the old render_document_html(template, data).
    Returns a full HTML document string, suitable both for storing as
    Document.html_content and for feeding directly into WeasyPrint."""
    canvas_data = template_version.canvas_data or {}
    objects = canvas_data.get('objects', [])
    page_width_mm, page_height_mm = _paper_dimensions_mm(template_version)

    body_parts = []
    for obj in objects:
        element_type = obj.get('elementType', 'label')
        if element_type in ('label', 'field'):
            body_parts.append(_render_text_like(obj, document_data))
        elif element_type == 'image':
            body_parts.append(_render_image(obj, document_data))
        elif element_type in ('barcode', 'qrcode'):
            body_parts.append(_render_code(obj, document_data, element_type))
        elif element_type in ('line', 'box'):
            body_parts.append(_render_line_or_box(obj, element_type))
        elif element_type == 'repeating_table':
            body_parts.append(_render_repeating_table(obj, document_data))
        # Unknown elementType: skip silently - a render should degrade
        # gracefully, not 500 the whole document over 1 unrecognized element.

    content_html = ''.join(p for p in body_parts if p)

    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page {{ size: {page_width_mm}mm {page_height_mm}mm; margin: 0; }}
            body {{ margin: 0; padding: 0; font-family: Arial, sans-serif; }}
            .tpd-page {{ position: relative; width: {page_width_mm}mm; min-height: {page_height_mm}mm; }}
        </style>
    </head>
    <body>
        <div class="tpd-page">
            {content_html}
        </div>
    </body>
    </html>
    '''
