"""
DCC PDF Generator — Sesuai dcc.md

Fitur:
  1. Merge file dokumen asli (PDF yang sudah diupload) ke dalam Controlled Copy
  2. Generate Lembar Pengesahan (halaman pertama) dengan info dokumen + approval blocks
  3. Watermark "APPROVED" diagonal transparan di SEMUA halaman
  4. TTD Digital (blok approval per tier)
  5. QR Code verifikasi
  6. Lock PDF (read-only, no edit/copy) via pikepdf
  7. SHA-256 hash tamper detection
"""
import os
import io
import secrets
import hashlib
from datetime import datetime, timedelta, timezone

# Timezone WIB (UTC+7)
WIB = timezone(timedelta(hours=7))

def _to_wib(dt):
    """Convert naive UTC datetime to WIB (UTC+7)"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(WIB)

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfgen import canvas

import qrcode

PDF_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'dcc', 'pdf')
os.makedirs(PDF_OUTPUT_DIR, exist_ok=True)


def _get_company_name():
    """Get company name from Settings (CompanyProfile)"""
    try:
        from models.settings import CompanyProfile
        profile = CompanyProfile.query.first()
        if profile and profile.company_name:
            return profile.company_name
    except:
        pass
    return 'Company Name'


def generate_controlled_pdf(revision, base_url=''):
    """
    Generate PDF Approved Copy untuk revisi dokumen yang sudah fully approved.

    Alur:
      1. Generate halaman Lembar Pengesahan (cover page)
      2. Merge dengan file PDF dokumen asli (jika ada)
      3. Stamp watermark "APPROVED" ke SEMUA halaman via reportlab per-page overlay
      4. Lock PDF (read-only)
      5. Hitung SHA-256 hash

    Returns: (pdf_path, file_hash, owner_password)
    """
    import pikepdf

    doc = revision.document
    safe_name = f"{doc.document_number}_Rev{revision.revision_number:02d}".replace('/', '_').replace(' ', '_')

    # Paths
    cover_path = os.path.join(PDF_OUTPUT_DIR, f"{safe_name}_cover.pdf")
    merged_path = os.path.join(PDF_OUTPUT_DIR, f"{safe_name}_controlled.pdf")

    # === 1. Generate Cover Page (Lembar Pengesahan) ===
    _generate_cover_page(cover_path, doc, revision, base_url)

    # === 2. Merge: Cover + Dokumen Asli via pikepdf ===
    original_pdf_path = _find_original_pdf(revision)

    merged_pdf = pikepdf.Pdf.new()

    cover_pdf = pikepdf.open(cover_path)
    merged_pdf.pages.extend(cover_pdf.pages)

    if original_pdf_path and os.path.exists(original_pdf_path):
        try:
            original_pdf = pikepdf.open(original_pdf_path)
            merged_pdf.pages.extend(original_pdf.pages)
            original_pdf.close()
        except Exception as e:
            print(f"Warning: Gagal merge PDF asli: {e}")

    # Save merged ke temp
    temp_merged = os.path.join(PDF_OUTPUT_DIR, f"{safe_name}_temp_merged.pdf")
    merged_pdf.save(temp_merged)
    merged_pdf.close()
    cover_pdf.close()

    # === 3. Apply Watermark ke SEMUA halaman (reportlab stamp, bukan pikepdf stream) ===
    _apply_watermark_stamp(temp_merged, merged_path)

    # Cleanup temp files
    for f in [cover_path, temp_merged]:
        try:
            if os.path.exists(f):
                os.remove(f)
        except:
            pass

    # === 4. Lock PDF ===
    locked_path, owner_pw = _lock_pdf(merged_path)

    # === 5. Calculate hash ===
    file_hash = _calculate_hash(locked_path)

    return locked_path, file_hash, owner_pw


def _apply_watermark_stamp(input_path, output_path):
    """
    Apply watermark 'APPROVED' ke semua halaman menggunakan pikepdf.Page.add_overlay().
    Pendekatan ini AMAN — konten asli setiap halaman tidak akan tertimpa/hilang.
    Watermark di-composite di atas konten yang sudah ada.
    """
    import pikepdf

    src = pikepdf.open(input_path)
    out = pikepdf.Pdf.new()

    # Copy semua halaman ke PDF output terlebih dahulu
    for page in src.pages:
        out.pages.append(page)

    # Build satu watermark page untuk tiap ukuran unik yang ditemukan,
    # lalu overlay ke setiap halaman
    _wm_cache: dict = {}

    for i, page in enumerate(out.pages):
        mediabox = page.mediabox
        pw = float(mediabox[2]) - float(mediabox[0])
        ph = float(mediabox[3]) - float(mediabox[1])
        size_key = (round(pw), round(ph))

        if size_key not in _wm_cache:
            wm_buf = io.BytesIO()
            _draw_watermark_to_buffer(wm_buf, pw, ph)
            wm_buf.seek(0)
            wm_pdf = pikepdf.open(wm_buf)
            _wm_cache[size_key] = wm_pdf

        wm_page = pikepdf.Page(_wm_cache[size_key].pages[0])
        pikepdf.Page(page).add_overlay(wm_page)

    out.save(output_path)
    out.close()
    src.close()
    for wm_pdf in _wm_cache.values():
        wm_pdf.close()


def _draw_watermark_to_buffer(buf, page_width_pt, page_height_pt):
    """
    Gambar watermark 'APPROVED' diagonal di buffer in-memory.
    Warna abu-abu transparan, teks diagonal 45 derajat.
    """
    c = canvas.Canvas(buf, pagesize=(page_width_pt, page_height_pt))
    c.saveState()
    c.translate(page_width_pt / 2, page_height_pt / 2)
    c.rotate(45)

    # Warna abu-abu transparan (alpha 0.08)
    c.setFillColor(Color(0.5, 0.5, 0.5, alpha=0.08))
    c.setFont("Helvetica-Bold", 72)

    c.drawCentredString(0, 80 * mm, "APPROVED")
    c.drawCentredString(0, 0, "APPROVED")
    c.drawCentredString(0, -80 * mm, "APPROVED")

    c.restoreState()
    c.save()


def _find_original_pdf(revision):
    """Find the original uploaded PDF for this revision"""
    if revision.pdf_file_path and os.path.exists(revision.pdf_file_path):
        path = revision.pdf_file_path
        if '_controlled' not in path and '_locked' not in path:
            return path

    doc = revision.document
    safe_name = f"{doc.document_number}_Rev{revision.revision_number:02d}".replace('/', '_').replace(' ', '_')
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'dcc')

    candidate = os.path.join(upload_dir, f"{safe_name}.pdf")
    if os.path.exists(candidate) and '_controlled' not in candidate and '_locked' not in candidate:
        return candidate

    return None


def _generate_cover_page(output_path, doc, revision, base_url):
    """Generate halaman Lembar Pengesahan sebagai file PDF terpisah"""
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    _draw_header(c, width, height, doc, revision)
    _draw_approval_sheet(c, width, height, doc, revision)

    verification_url = (
        f"{base_url}/verify/{revision.verification_token}"
        if revision.verification_token
        else f"{base_url}/api/dcc/documents/{doc.id}"
    )
    _draw_qr_code(c, width, verification_url)
    _draw_approved_stamp(c, width)
    _draw_footer(c, width, doc, revision)

    c.save()


def _draw_header(c, width, height, doc, revision):
    """Draw document header with company info"""
    y = height - 30 * mm

    company_name = _get_company_name()
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(HexColor('#1a365d'))
    c.drawCentredString(width / 2, y, company_name)
    y -= 6 * mm
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor('#4a5568'))
    c.drawCentredString(width / 2, y, "Document Control Center — ISO 9001:2015")

    y -= 4 * mm
    c.setStrokeColor(HexColor('#1a365d'))
    c.setLineWidth(1.5)
    c.line(20 * mm, y, width - 20 * mm, y)

    y -= 8 * mm
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor('#2d3748'))

    info = [
        ('No. Dokumen', doc.document_number),
        ('Judul', doc.title),
        ('Level', f"Level {doc.document_level} — {doc.level_name}"),
        ('Departemen', doc.department_code),
        ('No. Revisi', f"{revision.revision_number:02d}"),
        ('Tanggal Efektif', revision.effective_date.strftime('%d %B %Y') if revision.effective_date else '-'),
        ('Status', revision.status.upper()),
    ]

    for label, value in info:
        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor('#718096'))
        c.drawString(25 * mm, y, f"{label}:")
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(HexColor('#1a202c'))
        c.drawString(65 * mm, y, str(value))
        y -= 5 * mm


def _draw_approval_sheet(c, width, height, doc, revision):
    """Draw Lembar Pengesahan with 3-tier approval blocks — warna biru"""
    y = height - 100 * mm

    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor('#1a365d'))
    c.drawCentredString(width / 2, y, "LEMBAR PENGESAHAN DOKUMEN")

    y -= 10 * mm

    approvals = [
        {
            'role': '1. Pembuat (Originator)',
            'name': revision.originator.full_name if revision.originator else '-',
            'date': _to_wib(revision.originator_signed_at).strftime('%d %b %Y, %H:%M WIB') if revision.originator_signed_at else '-',
            'status': 'Ditandatangani' if revision.originator_signed_at else 'Belum',
            'method': 'via ERP',
        },
        {
            'role': '2. Pemeriksa / Pengkaji (Reviewer)',
            'name': revision.reviewer.full_name if revision.reviewer else '-',
            'date': _to_wib(revision.reviewer_signed_at).strftime('%d %b %Y, %H:%M WIB') if revision.reviewer_signed_at else '-',
            'status': (revision.reviewer_status or '').title() if revision.reviewer_signed_at else 'Belum',
            'method': 'via ERP',
        },
        {
            'role': '3. Pengesah (Approver)',
            'name': revision.approver.full_name if revision.approver else '-',
            'date': _to_wib(revision.approver_signed_at).strftime('%d %b %Y, %H:%M WIB') if revision.approver_signed_at else '-',
            'status': (revision.approver_status or '').title() if revision.approver_signed_at else 'Belum',
            'method': 'via ERP',
        },
    ]

    block_width = 55 * mm
    block_height = 35 * mm
    start_x = (width - 3 * block_width - 2 * 5 * mm) / 2

    for i, app in enumerate(approvals):
        x = start_x + i * (block_width + 5 * mm)
        is_signed = app['status'] not in ['Belum', '-']

        # ── Warna biru (signed) vs merah (belum) ──
        if is_signed:
            bg_color      = HexColor('#ebf8ff')   # biru muda
            border_color  = HexColor('#3182ce')   # biru sedang
            header_color  = HexColor('#1e4e8c')   # biru tua
        else:
            bg_color      = HexColor('#fff5f5')
            border_color  = HexColor('#e53e3e')
            header_color  = HexColor('#c53030')

        c.setFillColor(bg_color)
        c.setStrokeColor(border_color)
        c.setLineWidth(1)
        c.roundRect(x, y - block_height, block_width, block_height, 3 * mm, fill=1, stroke=1)

        # Header bar
        bar_h = 7 * mm
        c.setFillColor(header_color)
        c.roundRect(x, y - bar_h, block_width, bar_h, 3 * mm, fill=1, stroke=0)
        c.rect(x, y - bar_h, block_width, 3 * mm, fill=1, stroke=0)

        c.setFillColor(HexColor('#ffffff'))
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(x + block_width / 2, y - bar_h + 2 * mm, app['role'])

        cy = y - bar_h - 5 * mm
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(HexColor('#1a202c'))
        c.drawCentredString(x + block_width / 2, cy, app['name'])

        cy -= 4 * mm
        c.setFont("Helvetica", 7)
        c.setFillColor(HexColor('#4a5568'))
        c.drawCentredString(x + block_width / 2, cy, app['date'])

        cy -= 4 * mm
        if is_signed:
            c.setFillColor(HexColor('#1e4e8c'))
            c.drawCentredString(x + block_width / 2, cy, f"✓ {app['status']}")
        else:
            c.setFillColor(HexColor('#c53030'))
            c.drawCentredString(x + block_width / 2, cy, "○ Belum ditandatangani")

        cy -= 3.5 * mm
        c.setFont("Helvetica", 6)
        c.setFillColor(HexColor('#a0aec0'))
        c.drawCentredString(x + block_width / 2, cy, f"[{app['method']}]")

    # Overall status
    y -= block_height + 12 * mm
    all_signed = all(a['status'] not in ['Belum', '-'] for a in approvals)
    if all_signed:
        c.setFillColor(HexColor('#1e4e8c'))
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(width / 2, y, "✓  DOKUMEN TELAH DISAHKAN")
    else:
        c.setFillColor(HexColor('#c53030'))
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(width / 2, y, "○  DOKUMEN BELUM LENGKAP DISAHKAN")

    y -= 10 * mm
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor('#718096'))
    c.drawCentredString(width / 2, y, "Halaman berikutnya berisi isi dokumen yang telah disahkan.")


def _draw_approved_stamp(c, width):
    """Draw APPROVED stamp box di cover page (ganti CONTROLLED COPY)"""
    stamp_w = 60 * mm
    stamp_h = 18 * mm
    x = (width - stamp_w) / 2
    y = 25 * mm

    # Warna biru
    c.setStrokeColor(HexColor('#1e4e8c'))
    c.setLineWidth(2)
    c.setFillColor(HexColor('#ebf8ff'))
    c.roundRect(x, y, stamp_w, stamp_h, 3 * mm, fill=1, stroke=1)

    c.setFillColor(HexColor('#1e4e8c'))
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(width / 2, y + 10 * mm, "APPROVED")
    c.setFont("Helvetica", 7)
    c.drawCentredString(width / 2, y + 4 * mm, f"Generated: {datetime.now(WIB).strftime('%d %b %Y %H:%M WIB')}")


def _draw_qr_code(c, width, url):
    """Draw QR code for verification"""
    qr = qrcode.QRCode(version=1, box_size=4, border=1)
    qr.add_data(url or 'https://erp.gratiams.com/dcc')
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    qr_img.save(buf, format='PNG')
    buf.seek(0)

    from reportlab.lib.utils import ImageReader
    img = ImageReader(buf)
    qr_size = 22 * mm
    c.drawImage(img, width - 25 * mm - qr_size, 25 * mm, qr_size, qr_size)

    c.setFont("Helvetica", 5)
    c.setFillColor(HexColor('#a0aec0'))
    c.drawCentredString(width - 25 * mm - qr_size / 2, 23 * mm, "Scan untuk verifikasi")


def _draw_footer(c, width, doc, revision):
    """Draw footer"""
    c.setFont("Helvetica", 6)
    c.setFillColor(HexColor('#a0aec0'))
    company_name = _get_company_name()
    c.drawString(20 * mm, 15 * mm,
                 f"{doc.document_number} Rev{revision.revision_number:02d} — {company_name} — Document Control Center")
    c.drawRightString(width - 20 * mm, 15 * mm,
                      f"Generated from ERP — {datetime.now(WIB).strftime('%d/%m/%Y %H:%M WIB')}")


def _lock_pdf(input_path):
    """Lock PDF: read-only, no edit/copy/annotation using pikepdf"""
    import pikepdf

    owner_password = secrets.token_hex(32)
    output_path = input_path.replace('.pdf', '_locked.pdf')

    pdf = pikepdf.open(input_path)
    permissions = pikepdf.Permissions(
        extract=False,
        modify_annotation=False,
        modify_form=False,
        modify_other=False,
        modify_assembly=False,
        print_lowres=True,
        print_highres=True,
        accessibility=True,
    )

    pdf.save(
        output_path,
        encryption=pikepdf.Encryption(
            owner=owner_password,
            user="",
            R=6,
            allow=permissions,
        )
    )
    pdf.close()

    os.remove(input_path)

    return output_path, owner_password


def _calculate_hash(filepath):
    """Calculate SHA-256 hash of PDF file"""
    with open(filepath, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()
