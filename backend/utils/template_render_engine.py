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
import html as _html
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


def _esc(value):
    """HTML-escape user data, but keep &nbsp; (used for BOM indentation)."""
    return _html.escape(str(value)).replace('&amp;nbsp;', '&nbsp;')


def _format_value(value, fmt):
    """Optional per-element display format: 'rp' (Rp 1.234.567) or 'num'
    (Indonesian thousands separator). Non-numeric values pass through."""
    if value is None or value == '':
        return ''
    if fmt in ('rp', 'num'):
        try:
            n = float(value)
        except (TypeError, ValueError):
            return value
        if fmt == 'rp':
            return 'Rp ' + f"{int(round(n)):,}".replace(',', '.')
        if n == int(n):
            return f"{int(n):,}".replace(',', '.')
        return f"{n:,.2f}".rstrip('0').rstrip('.').replace(',', '_').replace('.', ',').replace('_', '.')
    return value


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
        content = _format_value(_resolve_field(obj.get('fieldPath'), document_data), obj.get('format'))
    else:
        content = obj.get('text', '')
    content = _esc(content)

    # fontSize is a Fabric object property, so per the "1 Fabric unit = 1mm,
    # always" convention (TemplateVersionEditor.tsx) it's stored in mm just
    # like left/top/width/height - the editor's canvas.setZoom(PX_PER_MM)
    # scales it on-screen consistently with every other mm-based property.
    # WeasyPrint's CSS font-size has no mm-equivalent concept though, only
    # literal pt - treating the stored number as pt directly (as this used to)
    # under-sized text by a factor of ~2.83x vs what the editor showed, since
    # 1mm = 2.83465pt. Convert explicitly so editor and rendered output agree.
    font_size_mm = float(obj.get('fontSize', 10) or 10)
    font_size_pt = round(font_size_mm * 2.83465, 2)
    font_family = obj.get('fontFamily', 'Arial')
    font_weight = obj.get('fontWeight', 'normal')
    text_align = obj.get('textAlign', 'left')
    color = obj.get('fill', '#000000')
    bg_color = obj.get('backgroundColor') or 'transparent'

    # align-items must be flex-start (top), not center: Fabric's Textbox in
    # the editor anchors text at the TOP of its bounding box (originY:'top')
    # and grows downward - it never vertically centers within a height taller
    # than the text itself. Centering here made every single text element on
    # every template render visibly lower in the PDF than where it sits in
    # the drag-and-drop editor, the position-mismatch bug reported alongside
    # the fontSize unit bug (both independent causes of the same complaint).
    style = (
        f'position:absolute; left:{left}mm; top:{top}mm; width:{width}mm; height:{height}mm; '
        f'transform: rotate({angle}deg); transform-origin: top left; '
        f'font-size:{font_size_pt}pt; font-family:{font_family}, sans-serif; font-weight:{font_weight}; '
        f'text-align:{text_align}; color:{color}; background-color:{bg_color}; '
        f'overflow:hidden; white-space:pre-wrap; display:flex; align-items:flex-start; '
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
        if obj.get('cellFill'):
            style += f'background-color:{obj["cellFill"]};'
    return f'<div style="{style}"></div>'


def _render_repeating_table(obj, document_data, wrap=True):
    """The one exception to absolute positioning - a real <table> flowing
    from the element's anchor, so WeasyPrint's native pagination (<thead>
    repeats per page) handles rows that overflow onto later pages.

    Optional styling props (all default to the original minimal look):
    gridColor (full cell borders), headerBg/headerColor, zebra (row stripe
    color), minRows (blank filler rows), rowHeight (mm), tableFontSize (mm).
    Column props: textAlign, width, format ('rp'|'num'), bold."""
    left, top, width, _height, _angle = _object_box(obj)
    columns = obj.get('columns') or []
    rows = _resolve_field(obj.get('dataSource'), document_data)
    if not isinstance(rows, list):
        rows = []
    show_header = obj.get('showHeader', True)

    grid = obj.get('gridColor')
    header_bg = obj.get('headerBg')
    header_color = obj.get('headerColor') or ('#ffffff' if header_bg else '#000000')
    zebra = obj.get('zebra')
    min_rows = int(obj.get('minRows') or 0)
    row_h = float(obj.get('rowHeight') or 0)
    fs_mm = float(obj.get('tableFontSize') or 0)
    font_pt = round(fs_mm * 2.83465, 2) if fs_mm else 9

    def th_style(c):
        st = f'text-align:{c.get("textAlign", "left")}; padding:1mm;'
        if grid:
            st += f' border:0.25mm solid {header_bg or grid};'
            if header_bg:
                st += f' background:{header_bg}; color:{header_color}; font-weight:bold;'
        else:
            st += ' border-bottom:0.3mm solid #333;'
        return st

    def td_style(c, idx):
        st = f'text-align:{c.get("textAlign", "left")}; padding:1mm; vertical-align:top;'
        if c.get('bold'):
            st += ' font-weight:bold;'
        if grid:
            st += f' border:0.25mm solid {grid};'
            if zebra and idx % 2 == 1:
                st += f' background:{zebra};'
        else:
            st += ' border-bottom:0.2mm solid #ccc;'
        if row_h:
            st += f' height:{max(row_h - 2, 1)}mm;'
        return st

    header_html = ''
    if show_header:
        header_cells = ''.join(f'<th style="{th_style(c)}">{_esc(c.get("label", ""))}</th>' for c in columns)
        header_html = f'<thead><tr>{header_cells}</tr></thead>'

    body_rows = []
    for i, row in enumerate(rows):
        cells = ''.join(
            f'<td style="{td_style(c, i)}">'
            f'{_esc(_format_value(_resolve_field(c.get("fieldPath"), row), c.get("format"))) if isinstance(row, dict) else ""}</td>'
            for c in columns
        )
        body_rows.append(f'<tr>{cells}</tr>')
    for i in range(len(rows), min_rows):
        body_rows.append('<tr>' + ''.join(f'<td style="{td_style(c, i)}">&nbsp;</td>' for c in columns) + '</tr>')

    col_widths = ''.join(f'<col style="width:{c.get("width", 0)}mm;">' for c in columns)
    layout = 'table-layout:fixed;' if grid else ''

    table_html = (
        f'<table style="width:100%; border-collapse:collapse; font-size:{font_pt}pt; {layout}">'
        f'<colgroup>{col_widths}</colgroup>'
        f'{header_html}<tbody>{"".join(body_rows)}</tbody>'
        f'</table>'
    )
    if not wrap:
        return table_html
    # position:absolute (not position:relative + margin-top) - see
    # fix_report_3.md Fase 20 (margin-collapse put the table at y=0).
    return f'<div style="position:absolute; left:{left}mm; top:{top}mm; width:{width}mm;">{table_html}</div>'


def render_template_version_to_html(template_version, document_data):
    """Main entry point - replaces the old render_document_html(template, data).
    Returns a full HTML document string, suitable both for storing as
    Document.html_content and for feeding directly into WeasyPrint."""
    canvas_data = template_version.canvas_data or {}
    objects = canvas_data.get('objects', [])
    page_width_mm, page_height_mm = _paper_dimensions_mm(template_version)

    def render_one(obj):
        element_type = obj.get('elementType', 'label')
        if element_type in ('label', 'field'):
            return _render_text_like(obj, document_data)
        if element_type == 'image':
            return _render_image(obj, document_data)
        if element_type in ('barcode', 'qrcode'):
            return _render_code(obj, document_data, element_type)
        if element_type in ('line', 'box'):
            return _render_line_or_box(obj, element_type)
        if element_type == 'repeating_table':
            return _render_repeating_table(obj, document_data)
        return ''  # unknown elementType: degrade gracefully, never 500 the render

    # Flow layout: a repeating_table with flow=True is rendered at its real
    # data height, and every object marked flowAfter=True is placed relative
    # to the table's BOTTOM (offset = designed top - designed table bottom),
    # so totals/notes/signatures follow the last row instead of sitting at a
    # fixed page position. In the Designer these objects sit at their nominal
    # positions below the placeholder table, so it stays WYSIWYG.
    flow_table = next((o for o in objects if o.get('elementType') == 'repeating_table' and o.get('flow')), None)
    flow_children = [o for o in objects if o.get('flowAfter')] if flow_table else []
    flow_ids = {id(o) for o in flow_children}

    body_parts = []
    for obj in objects:
        if obj is flow_table or id(obj) in flow_ids:
            continue
        body_parts.append(render_one(obj))

    if flow_table:
        t_left, t_top, t_width, t_height, _a = _object_box(flow_table)
        nominal_bottom = t_top + t_height
        inner = []
        max_bottom = 0
        for child in flow_children:
            c = dict(child)
            c_left, c_top, c_w, c_h, _ca = _object_box(child)
            offset = c_top - nominal_bottom
            c['left'] = c_left - t_left
            c['top'] = offset
            max_bottom = max(max_bottom, offset + c_h)
            inner.append(render_one(c))
        body_parts.append(
            # In-flow (not absolute) so a long table + the blocks after it can
            # continue onto the next page instead of being clipped.
            f'<div style="position:relative; padding-top:{t_top}mm; margin-left:{t_left}mm; width:{t_width}mm;">'
            f'{_render_repeating_table(flow_table, document_data, wrap=False)}'
            f'<div style="position:relative; width:100%; height:{max_bottom + 2}mm; page-break-inside:avoid; break-inside:avoid;">{"".join(p for p in inner if p)}</div>'
            f'</div>'
        )

    content_html = ''.join(p for p in body_parts if p)

    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page {{ size: {page_width_mm}mm {page_height_mm}mm; margin: 0 0 12mm 0; }}
            @page :not(:first) {{ margin-top: 12mm; }}
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
