"""
Default print templates (Print Template Designer) - invoice, kwitansi, PO,
surat jalan, SPK, SPK batch.

Each builder returns canvas objects in the same shape the Designer saves
(Fabric JSON, 1 unit = 1mm, fontSize in mm), so the layouts show up in the
Designer, can be edited there, and print through the normal render engine.

ensure_default_template() creates a default when none exists and upgrades an
older *auto-generated* default to the current LAYOUT; a version somebody saved
from the Designer (change_note not starting with 'Auto-generated') is left alone.
"""
from datetime import datetime

from models import db
from models.document_management import DocumentTemplate, TemplateVersion

LAYOUT = 'v2-2026-10h'
AUTO_NOTE_PREFIX = 'Auto-generated'
AUTO_NOTE_PREFIXES = ('Auto-generated', 'Migrasi otomatis')  # the font-unit migration only rescales values of auto-generated layouts

TEAL = '#1f4e5a'
GRID = '#8fa3aa'
CELL = '#e8eff1'
STRIPE = '#f5f8f9'
MUTED = '#5b6b72'
PT = 0.3528  # 1pt in mm


def _fs(pt):
    return round(pt * PT, 3)


def L(text, left, top, width, height=5, fs=9.5, bold=False, align='left', color='#000000', bg=None):
    o = {'type': 'Textbox', 'elementType': 'label', 'left': left, 'top': top, 'width': width, 'height': height,
         'scaleX': 1, 'scaleY': 1, 'text': text, 'fontSize': _fs(fs), 'fontWeight': 'bold' if bold else 'normal',
         'fontFamily': 'Arial', 'textAlign': align, 'fill': color}
    if bg:
        o['backgroundColor'] = bg
    return o


def F(path, left, top, width, height=5, fs=9.5, bold=False, align='left', color='#000000', fmt=None):
    o = {'type': 'Textbox', 'elementType': 'field', 'left': left, 'top': top, 'width': width, 'height': height,
         'scaleX': 1, 'scaleY': 1, 'text': path, 'fieldPath': path, 'fontSize': _fs(fs),
         'fontWeight': 'bold' if bold else 'normal', 'fontFamily': 'Arial', 'textAlign': align, 'fill': color}
    if fmt:
        o['format'] = fmt
    return o


def BOX(left, top, width, height, fill=None, stroke=GRID):
    o = {'type': 'Rect', 'elementType': 'box', 'left': left, 'top': top, 'width': width, 'height': height,
         'scaleX': 1, 'scaleY': 1, 'fill': 'transparent', 'stroke': stroke, 'strokeWidth': 1}
    if fill:
        o['cellFill'] = fill
    return o


def LINE(left, top, width, stroke='#111111', stroke_width=1):
    return {'type': 'Line', 'elementType': 'line', 'left': left, 'top': top, 'width': width, 'height': 0,
            'scaleX': 1, 'scaleY': 1, 'stroke': stroke, 'strokeWidth': stroke_width}


def IMG(path, left, top, width, height):
    return {'type': 'Rect', 'elementType': 'image', 'left': left, 'top': top, 'width': width, 'height': height,
            'scaleX': 1, 'scaleY': 1, 'fill': '#f3f4f6', 'stroke': '#9ca3af', 'strokeWidth': 1, 'fieldPath': path}


def QR(path, left, top, size):
    return {'type': 'Rect', 'elementType': 'qrcode', 'left': left, 'top': top, 'width': size, 'height': size,
            'scaleX': 1, 'scaleY': 1, 'fill': '#f3f4f6', 'stroke': '#9ca3af', 'strokeWidth': 1, 'fieldPath': path}


def TABLE(source, left, top, width, columns, min_rows=0, row_h=6.5, height=30, fs=9):
    return {'type': 'Rect', 'elementType': 'repeating_table', 'left': left, 'top': top, 'width': width,
            'height': height, 'scaleX': 1, 'scaleY': 1, 'fill': '#f3f4f6', 'stroke': '#9ca3af', 'strokeWidth': 1,
            'dataSource': source, 'columns': columns, 'showHeader': True,
            'gridColor': GRID, 'headerBg': TEAL, 'headerColor': '#ffffff', 'zebra': STRIPE,
            'minRows': min_rows, 'rowHeight': row_h, 'tableFontSize': _fs(fs), 'flow': True}


def C(path, label, width, align='left', fmt=None, bold=False):
    c = {'fieldPath': path, 'label': label, 'width': width, 'textAlign': align}
    if fmt:
        c['format'] = fmt
    if bold:
        c['bold'] = True
    return c


def flow(objs):
    """Mark objects to follow the flow table's bottom (see template_render_engine)."""
    for o in objs:
        o['flowAfter'] = True
    return objs


# ---- shared blocks -------------------------------------------------------

def header(left, width, title, lines=3):
    """Logo + company block (left), title + doc lines (right), rule below."""
    right_w = 82
    right_x = left + width - right_w
    objs = [
        IMG('company.logo_url', left, 9, 16, 14),
        F('company.name', left + 19, 8.5, 78, 10, fs=12, bold=True),
        F('company.address_line', left + 19, 19, 78, 4, fs=8, color='#444444'),
        F('company.contact_line', left + 19, 23, 78, 4, fs=8, color='#444444'),
        L(title, right_x, 8, right_w, 7, fs=15, bold=True, align='right'),
    ]
    for i, path in enumerate(['hdr_no', 'hdr_date', 'hdr_extra', 'hdr_extra2'][:lines]):
        objs.append(F(path, right_x, 15.5 + i * 4.3, right_w, 4.5, fs=9.5, align='right'))
    objs.append(LINE(left, max(15.5 + lines * 4.3 + 2.5, 28.5), width, stroke_width=2))
    return objs


def meta_grid(left, top, label_w, value_w, rows, row_h):
    objs = []
    for i, (label, path) in enumerate(rows):
        y = top + i * row_h
        objs.append(BOX(left, y, label_w, row_h, fill=CELL))
        objs.append(BOX(left + label_w, y, value_w, row_h))
        objs.append(L(label, left + 1.5, y + (row_h - 4) / 2, label_w - 2, 4, fs=9))
        objs.append(F(path, left + label_w + 1.5, y + (row_h - 4) / 2, value_w - 3, row_h - 1, fs=9))
    return objs


def totals_block(left, top, label_w, value_w, rows, row_h=6.5):
    """rows: (label, path, grand?) - grand rows get the teal fill."""
    objs = []
    for i, (label, path, grand) in enumerate(rows):
        y = top + i * row_h
        fill = TEAL if grand else None
        color = '#ffffff' if grand else '#000000'
        objs.append(BOX(left, y, label_w, row_h, fill=fill))
        objs.append(BOX(left + label_w, y, value_w, row_h, fill=fill))
        objs.append(L(label, left + 1.5, y + 1.2, label_w - 2, 4, fs=9.5, bold=grand, color=color))
        objs.append(F(path, left + label_w + 1.5, y + 1.2, value_w - 3, 4, fs=9.5, bold=grand, align='right',
                      color=color, fmt='rp'))
    return objs


def words_box(left, top, width):
    return [
        BOX(left, top, width, 9, fill=STRIPE),
        L('Terbilang:', left + 2, top + 2.5, 22, 4, fs=9.5, bold=True),
        F('terbilang', left + 22, top + 2.5, width - 24, 5, fs=9.5),
    ]


def notes_line(left, top, width):
    return [L('Catatan:', left, top, 18, 4, fs=9, bold=True), F('notes', left + 18, top, width - 18, 12, fs=9)]


def signatures(left, width, top, labels, caption_paths=None, captions=None):
    """labels: list of static texts or ('field', path). 3 or 2 columns."""
    n = len(labels)
    w = width / n
    objs = []
    for i, label in enumerate(labels):
        x = left + i * w
        if isinstance(label, tuple):
            objs.append(F(label[1], x, top, w, 5, fs=9.5, align='center'))
        else:
            objs.append(L(label, x, top, w, 5 + 4.6 * label.count('\n'), fs=9.5, align='center'))
        objs.append(LINE(x + w * 0.15, top + 26, w * 0.7, stroke_width=1))
        cap = (caption_paths or {}).get(i)
        static_cap = (captions or {}).get(i)
        if static_cap:
            objs.append(L(static_cap, x, top + 27.3, w, 4, fs=9.5, bold=True, align='center'))
        elif cap:
            objs.append(F(cap, x, top + 27.3, w, 4, fs=8, align='center', color=MUTED))
        else:
            objs.append(L('Nama jelas & tanda tangan', x, top + 27.3, w, 4, fs=8, align='center', color=MUTED))
    return objs


# ---- builders ------------------------------------------------------------

def build_invoice():
    o = header(14, 182, 'INVOICE')
    o += [BOX(14, 33, 90, 26),
          L('DITAGIHKAN KEPADA', 16, 34, 86, 3.5, fs=7.5, color=MUTED),
          F('customer_name', 16, 38.5, 86, 5, fs=11, bold=True),
          F('customer_address', 16, 44.5, 86, 13, fs=9)]
    o += meta_grid(104, 33, 34, 58, [('No. PO Customer', 'po_number'), ('Syarat Pembayaran', 'payment_terms'),
                                     ('Jatuh Tempo', 'due_date')], 8.67)
    o.append(TABLE('line_items', 14, 63, 182, [
        C('no', 'No.', 9, 'center'), C('code', 'Kode', 24), C('item_name', 'Deskripsi', 43),
        C('pack', 'Isi/Krt', 15, 'right', 'num'), C('quantity', 'Qty', 18, 'right', 'num'), C('uom', 'Satuan', 15),
        C('unit_price', 'Harga', 18, 'right', 'num'), C('discount_text', 'Diskon', 20, 'right'),
        C('subtotal', 'Jumlah', 20, 'right', 'num'),
    ], min_rows=0, row_h=6.5, height=30, fs=9))
    o += flow(totals_block(116, 98, 40, 40, [('Subtotal', 'gross', False), ('Diskon', 'discount_total', False),
                                             ('PPN', 'tax_amount', False), ('TOTAL', 'total_amount', True),
                                             ('Sudah Dibayar', 'paid_amount', False), ('Sisa Tagihan', 'balance_due', True)]))
    o += flow(words_box(14, 141, 182))
    o += flow(notes_line(14, 154, 182))
    o += flow(signatures(14, 182, 172, ['Diterima oleh,', 'Hormat kami,'], {1: 'company.name'}))
    return o, 'A4', 'portrait', None, None


def build_po():
    o = header(14, 182, 'PURCHASE ORDER', lines=2)
    o += [BOX(14, 33, 90, 26),
          L('KEPADA SUPPLIER', 16, 34, 86, 3.5, fs=7.5, color=MUTED),
          F('supplier_name', 16, 38.5, 86, 5, fs=11, bold=True),
          F('supplier_address', 16, 44.5, 86, 13, fs=9)]
    o += meta_grid(104, 33, 34, 58, [('Dibutuhkan', 'required_date'), ('Syarat Pembayaran', 'payment_terms'),
                                     ('Kirim Ke', 'delivery_address')], 8.67)
    o.append(TABLE('line_items', 14, 63, 182, [
        C('no', 'No.', 9, 'center'), C('code', 'Kode', 26), C('item_name', 'Deskripsi', 66),
        C('quantity', 'Qty', 20, 'right', 'num'), C('uom', 'Satuan', 17), C('unit_price', 'Harga', 24, 'right', 'num'),
        C('subtotal', 'Jumlah', 20, 'right', 'num'),
    ], min_rows=0, row_h=6.5, height=30, fs=9))
    o += flow(totals_block(116, 98, 40, 40, [('Subtotal', 'subtotal', False), ('Diskon', 'discount_amount', False),
                                             ('PPN', 'tax_amount', False), ('TOTAL', 'total_amount', True)]))
    o += flow(words_box(14, 128, 182))
    o += flow(notes_line(14, 141, 182))
    o += flow(signatures(14, 182, 160, ['Dibuat oleh,', 'Disetujui oleh,']))
    return o, 'A4', 'portrait', None, None


def build_surat_jalan():
    o = header(14, 182, 'SURAT JALAN')
    o += [BOX(14, 33, 90, 26),
          L('KEPADA', 16, 34, 86, 3.5, fs=7.5, color=MUTED),
          F('customer_name', 16, 38.5, 86, 5, fs=11, bold=True),
          F('customer_address', 16, 44.5, 86, 9, fs=9),
          F('customer_phone', 16, 54, 86, 4, fs=9)]
    o += meta_grid(104, 33, 34, 58, [('Sopir', 'driver_name'), ('No. Kendaraan', 'vehicle_number')], 13)
    o.append(TABLE('items', 14, 63, 182, [
        C('no', 'No.', 9, 'center'), C('code', 'Kode', 24), C('product_name', 'Nama Produk', 50),
        C('pack', 'Isi/Krt', 14, 'right', 'num'), C('quantity', 'Qty', 16, 'right', 'num'), C('uom', 'Satuan', 17),
        C('batch_text', 'Batch', 29), C('description', 'Keterangan', 23),
    ], min_rows=0, row_h=6.5, height=30, fs=9))
    o += flow([BOX(116, 98, 40, 7, fill=CELL), BOX(156, 98, 40, 7),
               L('TOTAL QTY', 117.5, 99.5, 36, 4, fs=9.5, bold=True),
               F('total_quantity', 157.5, 99.5, 37, 4, fs=9.5, bold=True, align='right', fmt='num')])
    o += flow(notes_line(14, 109, 182))
    o += flow([L('Barang diterima dalam keadaan baik dan jumlah sesuai.', 14, 122, 182, 4, fs=8, color=MUTED)])
    o += flow(signatures(14, 182, 130, ['Disiapkan oleh,', 'Sopir,', 'Diterima oleh,']))
    return o, 'A4', 'portrait', None, None


def _spk_product_box(width_box=66):
    return [BOX(14, 33, width_box, 28),
            L('PRODUK YANG DIKERJAKAN', 16, 34, width_box - 4, 3.5, fs=7.5, color=MUTED),
            F('product_name', 16, 38.5, width_box - 4, 5, fs=11, bold=True),
            F('product_code_line', 16, 44.5, width_box - 4, 4, fs=9),
            F('quantity', 16, 50, 26, 7, fs=14, bold=True, fmt='num'),
            F('uom', 16 + 27, 52, 20, 5, fs=11)]


def build_spk():
    o = header(14, 182, 'SURAT PERINTAH KERJA')
    o += _spk_product_box(66)
    o += meta_grid(80, 33, 34, 82, [('Mesin', 'machine'), ('Mulai', 'start_date'), ('Target Selesai', 'due_date'),
                                    ('Prioritas', 'priority_label')], 7)
    o += [BOX(14, 66, 182, 7, fill=TEAL),
          L('Instruksi / Catatan Produksi', 16, 67.5, 170, 4, fs=9, bold=True, color='#ffffff'),
          BOX(14, 73, 182, 80),
          F('notes', 16, 74, 178, 14, fs=9.5)]
    for i in range(1, 10):
        o.append(LINE(14, 73 + i * 8, 182, stroke=GRID, stroke_width=1))
    o += signatures(14, 182, 234, ['Dibuat oleh,', 'Disetujui oleh,'], captions={0: 'PPIC', 1: 'Manager Produksi'})
    return o, 'A4', 'portrait', None, None


def build_spk_batch():
    o = header(14, 182, 'SPK PER BATCH')
    o += [BOX(14, 33, 62, 28),
          L('PRODUK YANG DIKERJAKAN', 16, 34, 58, 3.5, fs=7.5, color=MUTED),
          F('product_name', 16, 38.5, 58, 5, fs=11, bold=True),
          F('product_code_line', 16, 44, 58, 4, fs=9),
          F('wo_line', 16, 48, 58, 4, fs=9),
          F('quantity', 16, 53, 24, 7, fs=14, bold=True, fmt='num'),
          F('uom', 41, 55, 20, 5, fs=11)]
    o += meta_grid(76, 33, 32, 58, [('Mesin', 'machine'), ('Tanggal Jadwal', 'scheduled_date'), ('Shift', 'shift_number'),
                                    ('Urutan di Shift', 'sequence_in_shift')], 7)
    o += [BOX(166, 33, 30, 28), QR('batch_number', 170, 35, 22)]
    o.append(L('Rincian Kebutuhan Material (BOM Berlapis)', 14, 65, 182, 5, fs=9.5, bold=True))
    o.append(TABLE('bom_items', 14, 71, 182, [
        C('no', 'No.', 10, 'center'), C('name', 'Nama Bahan / Sub-Rakitan', 96), C('quantity', 'Kebutuhan', 30, 'right', 'num'),
        C('uom', 'Satuan', 22), C('realisasi', 'Realisasi', 24),
    ], min_rows=0, row_h=6.5, height=30, fs=9))
    o += flow(signatures(14, 182, 108, ['Dibuat oleh,', 'Disetujui oleh,'], captions={0: 'PPIC', 1: 'Manager Produksi'}))
    return o, 'A4', 'portrait', None, None


def build_kwitansi():
    o = header(10, 190, 'BUKTI', lines=2)
    # title is dynamic (penerimaan / pembayaran): replace the static label with a field
    o = [x for x in o if not (x.get('elementType') == 'label' and x.get('text') == 'BUKTI')]
    o.insert(4, F('title', 118, 7, 82, 7, fs=15, bold=True, align='right'))
    o += meta_grid(10, 30, 38, 57, [('__dyn__', 'party_name'), ('Metode', 'payment_method')], 7)
    o += meta_grid(105, 30, 32, 63, [('Kas/Bank', 'bank_account'), ('No. Referensi', 'reference_number')], 7)
    # first label cell is dynamic (Diterima dari / Dibayarkan kepada)
    o = [x for x in o if not (x.get('elementType') == 'label' and x.get('text') == '__dyn__')]
    o.append(F('party_label', 11.5, 32, 35, 4, fs=9))
    o += words_box(10, 46, 190)
    o.append(TABLE('detail_rows', 10, 57, 190, [
        C('no', 'No.', 10, 'center'), C('uraian', 'Uraian', 72), C('keterangan', 'Keterangan', 58),
        C('nilai', 'Nilai', 50, 'right', 'rp'),
    ], min_rows=0, row_h=6.5, height=30, fs=9))
    o += flow([BOX(110, 88, 40, 7, fill=CELL), BOX(150, 88, 50, 7, fill=CELL),
               L('TOTAL', 111.5, 89.5, 36, 4, fs=9.5, bold=True),
               F('amount', 151.5, 89.5, 47, 4, fs=9.5, bold=True, align='right', fmt='rp')])
    o += flow(notes_line(10, 98, 190))
    o += flow(signatures(10, 190, 106, [('field', 'sign_1'), ('field', 'sign_2'), ('field', 'sign_3')]))
    return o, 'A5', 'landscape', 210, 148


DEFAULTS = {
    'invoice': ('Invoice Default', 'INVOICE_DEFAULT', build_invoice),
    'purchase_order': ('Purchase Order Default', 'PO_DEFAULT', build_po),
    'surat_jalan': ('Surat Jalan Default', 'SJ_DEFAULT', build_surat_jalan),
    'spk': ('SPK Default', 'SPK_DEFAULT', build_spk),
    'spk_batch': ('SPK Batch Default', 'SPK_BATCH_DEFAULT', build_spk_batch),
    'kwitansi': ('Kwitansi Default', 'KWITANSI_DEFAULT', build_kwitansi),
}


def _publish_default(user_id, document_type):
    name, code, builder = DEFAULTS[document_type]
    objects, paper, orientation, w_mm, h_mm = builder()

    template = DocumentTemplate.query.filter_by(template_code=code).first()
    if template:
        template.is_default = True
        template.is_active = True
        for v in TemplateVersion.query.filter_by(document_template_id=template.id, status='published').all():
            v.status = 'archived'
        next_no = (db.session.query(db.func.max(TemplateVersion.version_number))
                   .filter_by(document_template_id=template.id).scalar() or 0) + 1
    else:
        template = DocumentTemplate(template_name=name, template_code=code, document_type=document_type,
                                    is_default=True, is_active=True, created_by=user_id)
        db.session.add(template)
        db.session.flush()
        next_no = 1

    version = TemplateVersion(
        document_template_id=template.id, version_number=next_no, status='published',
        canvas_data={'version': 'fabric-6', 'layout': LAYOUT, 'objects': objects},
        paper_size=paper, orientation=orientation, canvas_width_mm=w_mm, canvas_height_mm=h_mm,
        change_note=f'{AUTO_NOTE_PREFIX} default layout {LAYOUT}',
        published_at=datetime.utcnow(), published_by=user_id, created_by=user_id,
    )
    db.session.add(version)
    db.session.flush()
    template.current_version_id = version.id
    db.session.flush()
    return template


def ensure_default_template(user_id, document_type):
    """Return the default template for document_type, creating or upgrading the
    auto-generated one as needed (never overwrites a Designer-saved version)."""
    name, code, _builder = DEFAULTS[document_type]
    template = (DocumentTemplate.query
                .filter_by(document_type=document_type, is_default=True, is_active=True)
                .filter(DocumentTemplate.current_version_id.isnot(None)).first())
    if template:
        if template.template_code != code:
            return template  # an admin-designated default - respect it
        cv = template.current_version
        if (cv.canvas_data or {}).get('layout') == LAYOUT:
            return template
        if not (cv.change_note or '').startswith(AUTO_NOTE_PREFIXES):
            return template  # saved from the Designer - never overwrite
    return _publish_default(user_id, document_type)
