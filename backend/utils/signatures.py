"""Tanda tangan digital pada dokumen cetak.

Gambar diambil dari berkas pemilik lalu DITANAM sebagai data URI ke document_data saat dokumen dibuat, bersama
nama dan waktu penandatangan. Dokumen tersimpan membekukan HTML itu, jadi mengganti gambar tanda tangan
belakangan tidak mengubah dokumen lama. Kegagalan membaca gambar tidak pernah menggagalkan pencetakan.
"""
import base64
import os

from flask import current_app

SIG_DIR = os.path.join('uploads', 'signatures')
MAX_BYTES = 1024 * 1024
_PNG = b'\x89PNG\r\n\x1a\n'


def sig_root():
    base = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    if not os.path.isabs(base):
        base = os.path.join(current_app.root_path, base)
    return os.path.join(base, 'signatures')


def detect_mime(data):
    if data[:8] == _PNG:
        return 'image/png'
    if data[:3] == b'\xff\xd8\xff':
        return 'image/jpeg'
    return None


def load_data_uri(user_id):
    """Return data URI (str) atau '' bila tidak ada/rusak."""
    try:
        from models import UserSignature
        row = UserSignature.query.filter_by(user_id=user_id).first()
        if not row:
            return ''
        path = os.path.join(sig_root(), os.path.basename(row.file_path))
        with open(path, 'rb') as f:
            data = f.read()
        mime = detect_mime(data)
        if not mime:
            return ''
        return f'data:{mime};base64,' + base64.b64encode(data).decode('ascii')
    except Exception:
        return ''


def signature_block(user, when=None, default_caption=' '):
    """user: objek User atau None. Selalu mengembalikan dict (kosong bila tidak ada tanda tangan)."""
    empty = {'image': '', 'name': '', 'date': '', 'stamp': '', 'caption': default_caption}
    if user is None:
        return empty
    img = load_data_uri(user.id)
    if not img:
        return empty
    name = getattr(user, 'full_name', None) or getattr(user, 'username', '') or ''
    date = when.strftime('%d-%m-%Y') if when else ''
    return {'image': img, 'name': name, 'date': date, 'stamp': (name + (' · ' + date if date else '')).strip(), 'caption': name or default_caption}


def add_signatures(document_data, created_user=None, created_at=None, approved_user=None, approved_at=None):
    """Tambah document_data['signature'] = {created_by:{...}, approved_by:{...}}. Aman dipanggil kapan pun."""
    try:
        document_data['signature'] = {
            'created_by': signature_block(created_user, created_at),
            'approved_by': signature_block(approved_user, approved_at),
        }
    except Exception:
        document_data['signature'] = {'created_by': {'image': '', 'name': '', 'date': '', 'stamp': '', 'caption': ' '},
                                      'approved_by': {'image': '', 'name': '', 'date': '', 'stamp': '', 'caption': ' '}}
    return document_data
