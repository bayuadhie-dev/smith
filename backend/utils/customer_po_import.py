"""Baca PO pelanggan (PDF) menjadi data terstruktur untuk dibuat menjadi Sales Order draf.
Format yang dikenali: PO Indomaret / Indomarco (teks, bukan scan). Format lain tetap bisa dikoreksi manual di pratinjau."""
import re
import subprocess
from datetime import datetime

MONTHS = {'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'MEI': 5, 'JUN': 6, 'JUL': 7, 'AUG': 8, 'AGU': 8, 'SEP': 9, 'OCT': 10, 'OKT': 10, 'NOV': 11, 'DEC': 12, 'DES': 12}
NUM = r'[\d,]+(?:\.\d+)?'


def _num(s):
    return float(str(s).replace(',', ''))


def pdf_to_text(data: bytes) -> str:
    try:
        p = subprocess.run(['pdftotext', '-layout', '-', '-'], input=data, capture_output=True, timeout=30)
        if p.returncode == 0 and p.stdout.strip():
            return p.stdout.decode('utf-8', 'ignore')
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    try:
        import io
        try:
            from pypdf import PdfReader
        except ImportError:
            from PyPDF2 import PdfReader
        return '\n'.join((pg.extract_text() or '') for pg in PdfReader(io.BytesIO(data)).pages)
    except Exception:
        return ''


def _date(txt):
    m = re.search(r'TGL\s*:\s*(\d{1,2})-([A-Za-z]{3})-(\d{2,4})', txt)
    if not m:
        return None
    mon = MONTHS.get(m.group(2).upper())
    y = int(m.group(3))
    y = y + 2000 if y < 100 else y
    try:
        return datetime(y, mon, int(m.group(1))).date().isoformat() if mon else None
    except ValueError:
        return None


def parse_customer_po(text: str) -> dict:
    out = {'po_number': None, 'po_date': None, 'terms_days': None, 'ship_to': None, 'customer_hint': None, 'items': [], 'warnings': []}
    m = re.search(r'NO\.?\s*PO\s*:\s*([A-Z0-9\-/]+)', text)
    out['po_number'] = m.group(1) if m else None
    m = re.search(r'TOP\s*:\s*(\d+)', text)
    out['terms_days'] = int(m.group(1)) if m else None
    out['po_date'] = _date(text)
    m = re.search(r'KRM\s*KE\s*:\s*(.+?)(?:\s{2,}|\n)', text)
    out['ship_to'] = m.group(1).strip() if m else None
    m = re.search(r'W\.?P\s*:\s*(.+?)(?:\n|$)', text)
    out['customer_hint'] = m.group(1).strip() if m else None
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        head = re.match(r'^\s*(\d{6,12})\s+(.+?)\s+([A-Za-z]{2,5})/(\d+)\s*$', lines[i])
        if head and i + 1 < len(lines):
            d = re.match(rf'^\s*(\d{{6,12}})\s+(\d+)\s+(\d+)\s+({NUM})\s+({NUM})\s+({NUM})\s+({NUM})\s*$', lines[i + 1])
            if d:
                qty, price, disc_amt, ppn, total = int(d.group(2)), _num(d.group(4)), _num(d.group(5)), _num(d.group(6)), _num(d.group(7))
                gross = qty * price
                out['items'].append({
                    'plu': head.group(1), 'name': head.group(2).strip(), 'uom': head.group(3).upper(), 'pack': int(head.group(4)),
                    'quantity': qty, 'free_qty': int(d.group(3)), 'unit_price': price,
                    'discount_amount': disc_amt, 'discount_percent': round(disc_amt / gross * 100, 4) if gross else 0,
                    'ppn_amount': ppn, 'total': total,
                })
                i += 2
                continue
        i += 1
    if not out['items']:
        out['warnings'].append('Baris barang tidak terbaca otomatis. Isi barang secara manual di pratinjau.')
    if not out['po_number']:
        out['warnings'].append('Nomor PO tidak terbaca.')
    return out
