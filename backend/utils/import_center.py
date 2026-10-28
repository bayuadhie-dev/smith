"""Pusat Impor: kerangka umum impor dokumen/transaksi dari Excel (.xlsx) atau CSV.

Tiap jenis impor adalah satu subclass ImportKind yang didaftarkan lewat register(). Kerangka ini yang mengurus:
baca file + pencocokan judul kolom, pengelompokan baris menjadi dokumen, pratinjau (validasi lalu dibatalkan),
simpan per dokumen (dokumen bermasalah dilewati, sisanya tersimpan), template, dan format hasil untuk UI.

Aturan untuk kind:
- build(key, rows) hanya memvalidasi dan menyusun payload. Tidak boleh menulis ke database. Kesalahan: raise ValueError(pesan)
  atau tambahkan ke `errors` lewat ImportErrors.
- save(data, user_id) menulis ke database memakai session yang sama. DILARANG commit/rollback sendiri; kerangka yang
  memegang savepoint dan commit. Kesalahan aturan bisnis: raise ValueError(pesan). Kembalikan {'number': 'nomor dokumen'}.
- Pakai aturan bisnis yang sama dengan form biasa (panggil fungsi inti yang sama), jangan menulis ulang logikanya.
"""
import csv
import io
from datetime import date, datetime

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from models import User, db
from utils.auth_decorators import _get_user_permissions

import_center_bp = Blueprint('import_center', __name__)
REGISTRY = {}


class Col:
    def __init__(self, field, label, required=False, aliases=(), example=''):
        self.field, self.label, self.required, self.example = field, label, required, example
        self.aliases = [a.lower() for a in (label, field, *aliases)]


class ImportKind:
    key = ''
    label = ''
    group = 'Transaksi'                 # 'Transaksi' atau 'Master'
    description = ''
    view_permission = 'finance.view'
    create_permission = 'finance.create'
    columns = []                        # list[Col]
    group_field = None                  # baris dengan nilai sama pada field ini digabung jadi satu dokumen; kosong = satu baris satu dokumen
    summary_columns = [('date', 'Tanggal', 'text'), ('party', 'Pihak', 'text'), ('total', 'Nilai', 'money')]
    guide = []                          # kalimat petunjuk di sheet Petunjuk
    sample_rows = []                    # list[list] sesuai urutan columns
    max_rows = 1000

    def build(self, key, rows):
        """rows: list[(nomor_baris_excel, {field: nilai})] satu dokumen. Return (data, summary dict)."""
        raise NotImplementedError

    def save(self, data, user_id):
        raise NotImplementedError


def register(kind):
    REGISTRY[kind.key] = kind
    return kind


def parse_date(v):
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = str(v or '').strip()
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y'):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    raise ValueError(f'Tanggal "{s}" tidak valid (pakai YYYY-MM-DD atau DD/MM/YYYY)')


def parse_amount(v, allow_negative=True):
    if isinstance(v, (int, float)):
        out = float(v)
    else:
        s = str(v or '').strip().replace('Rp', '').replace(' ', '')
        if not s:
            raise ValueError('Nilai kosong')
        if ',' in s and '.' in s:
            s = s.replace('.', '').replace(',', '.')
        elif ',' in s:
            s = s.replace(',', '.') if s.count(',') == 1 and len(s.split(',')[1]) != 3 else s.replace(',', '')
        elif s.count('.') > 1:
            s = s.replace('.', '')
        try:
            out = float(s)
        except ValueError:
            raise ValueError(f'Nilai "{v}" bukan angka')
    if not allow_negative and out < 0:
        raise ValueError(f'Nilai {out:g} tidak boleh negatif')
    return out


def text(v, limit=None):
    s = str(v).strip() if v not in (None, '') else None
    return s[:limit] if s and limit else s


def read_rows(file_storage, kind):
    """-> list[(nomor_baris_excel, {field: nilai})]; ValueError bila file/kolom salah."""
    name = (file_storage.filename or '').lower()
    raw = file_storage.read()
    if name.endswith('.csv'):
        txt = raw.decode('utf-8-sig', errors='replace')
        dialect = csv.Sniffer().sniff(txt[:2000], delimiters=',;\t') if txt.strip() else csv.excel
        table = [list(r) for r in csv.reader(io.StringIO(txt), dialect)]
    elif name.endswith('.xlsx'):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(raw), data_only=True, read_only=True)
        ws = wb['Data'] if 'Data' in wb.sheetnames else wb.worksheets[0]
        table = [list(r) for r in ws.iter_rows(values_only=True)]
    else:
        raise ValueError('Format file harus .xlsx atau .csv')
    if not table:
        raise ValueError('File kosong')
    head = [str(h or '').strip().lower() for h in table[0]]
    index = {}
    for col in kind.columns:
        for alias in col.aliases:
            if alias in head:
                index[col.field] = head.index(alias)
                break
    missing = [c.label for c in kind.columns if c.required and c.field not in index]
    if missing:
        raise ValueError('Kolom wajib tidak ditemukan: ' + ', '.join(missing) + '. Gunakan template dari tombol "Unduh Template".')
    out = []
    for n, row in enumerate(table[1:], start=2):
        rec = {f: (row[i] if i < len(row) else None) for f, i in index.items()}
        if all(v in (None, '') for v in rec.values()):
            continue
        out.append((n, rec))
    if not out:
        raise ValueError('Tidak ada baris data di file')
    if len(out) > kind.max_rows:
        raise ValueError(f'Maksimal {kind.max_rows} baris per impor')
    return out


def group_rows(kind, rows):
    groups, order = {}, []
    for n, rec in rows:
        gv = rec.get(kind.group_field) if kind.group_field else None
        key = str(gv).strip() if gv not in (None, '') else f'__row{n}'
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append((n, rec))
    return [(k, groups[k]) for k in order]


def _allowed(user, perm):
    return bool(user) and (getattr(user, 'is_super_admin', False) or perm in _get_user_permissions(user))


def _current_user():
    return db.session.get(User, int(get_jwt_identity()))


def _kind_or_404(key):
    kind = REGISTRY.get(key)
    return kind


def kind_info(kind):
    return {'key': kind.key, 'label': kind.label, 'group': kind.group, 'description': kind.description,
            'columns': [{'field': c.field, 'label': c.label, 'required': c.required} for c in kind.columns],
            'summary_columns': [{'key': k, 'label': l, 'type': t} for k, l, t in kind.summary_columns]}


@import_center_bp.route('/kinds', methods=['GET'])
@jwt_required()
def list_kinds():
    user = _current_user()
    return jsonify({'kinds': [dict(kind_info(k), can_import=_allowed(user, k.create_permission))
                              for k in REGISTRY.values() if _allowed(user, k.view_permission) or _allowed(user, k.create_permission)]}), 200


@import_center_bp.route('/<key>/template', methods=['GET'])
@jwt_required()
def template(key):
    kind = _kind_or_404(key)
    if not kind:
        return jsonify({'error': 'Jenis impor tidak dikenal'}), 404
    if not (_allowed(_current_user(), kind.view_permission) or _allowed(_current_user(), kind.create_permission)):
        return jsonify({'error': 'Permission denied'}), 403
    import openpyxl
    from openpyxl.styles import Alignment, Font, PatternFill
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Data'
    ws.append([c.label for c in kind.columns])
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = PatternFill('solid', fgColor='047857')
        c.alignment = Alignment(horizontal='center')
    for r in kind.sample_rows:
        ws.append(list(r))
    for i, c in enumerate(kind.columns, start=1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = max(14, min(36, len(c.label) + 6))
    ws.freeze_panes = 'A2'
    guide = wb.create_sheet('Petunjuk')
    lines = [f'Petunjuk impor: {kind.label}', '',
             'Baris pertama (judul kolom) jangan diubah. Hapus baris contoh sebelum mengisi data Anda.',
             'Tanggal: YYYY-MM-DD atau DD/MM/YYYY. Angka tanpa simbol Rp.',
             'Kolom wajib: ' + ', '.join(c.label for c in kind.columns if c.required)]
    if kind.group_field:
        label = next(c.label for c in kind.columns if c.field == kind.group_field)
        lines.append(f'Baris dengan "{label}" yang sama digabung menjadi satu dokumen. Kosongkan agar tiap baris jadi dokumen sendiri.')
    lines += list(kind.guide)
    for line in lines:
        guide.append([line])
    guide['A1'].font = Font(bold=True, size=13)
    guide.column_dimensions['A'].width = 110
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return send_file(buf, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', as_attachment=True,
                     download_name=f'template_import_{kind.key}.xlsx')


@import_center_bp.route('/<key>', methods=['POST'])
@jwt_required()
def run_import(key):
    """multipart: file, commit ('1' = simpan, selain itu pratinjau)."""
    kind = _kind_or_404(key)
    if not kind:
        return jsonify({'error': 'Jenis impor tidak dikenal'}), 404
    if not _allowed(_current_user(), kind.create_permission):
        return jsonify({'error': 'Permission denied', 'required_permission': kind.create_permission}), 403
    f = request.files.get('file')
    if not f:
        return jsonify({'error': 'File belum dipilih'}), 400
    try:
        rows = read_rows(f, kind)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception:
        return jsonify({'error': 'File tidak bisa dibaca. Pastikan formatnya .xlsx atau .csv sesuai template.'}), 400

    commit = request.form.get('commit') == '1'
    uid = int(get_jwt_identity())
    results = []
    for gkey, items in group_rows(kind, rows):
        tx = {'key': gkey, 'number': None if gkey.startswith('__row') else gkey, 'rows': [n for n, _ in items],
              'errors': [], 'created': None, 'summary': None}
        try:
            data, summary = kind.build(gkey, items)
            tx['summary'] = summary
        except ValueError as e:
            tx['errors'].append(f'Baris {tx["rows"][0]}: {e}')
            results.append(tx)
            continue
        sp = db.session.begin_nested()
        try:
            out = kind.save(data, uid) or {}
            if commit:
                sp.commit()
                tx['created'] = out.get('number')
            else:
                sp.rollback()
        except ValueError as e:
            sp.rollback()
            tx['errors'].append(f'Baris {tx["rows"][0]}: {e}')
        except Exception as e:
            sp.rollback()
            tx['errors'].append(f'Baris {tx["rows"][0]}: gagal diproses ({str(e)[:160]})')
        results.append(tx)
    if commit:
        db.session.commit()
    else:
        db.session.rollback()
    ok = [r for r in results if not r['errors']]
    return jsonify({'committed': commit, 'kind': kind_info(kind), 'transactions': results,
                    'summary': {'total': len(results), 'ok': len(ok), 'error': len(results) - len(ok),
                                'amount': round(sum(float((r['summary'] or {}).get('total', 0) or 0) for r in ok), 2)}}), 200
