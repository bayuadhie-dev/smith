"""
Bank Reconciliation (2026-09-17) - closes a real SAP FI gap: previously
zero code anywhere matched GL cash/bank postings against actual bank
mutations. Import a bank statement (CSV/Excel export), then manually match
each line against the AccountingEntry that recorded it internally.

Matching is deliberately manual, not auto-applied - a suggested candidate
list is offered (same account, amount, +/-3 days) but the user confirms
each match explicitly, same spirit as this project's other "warn, don't
silently decide" patterns.
"""
import csv
import io
from datetime import datetime, timedelta

import openpyxl
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from models import db
from models.finance import Account, AccountingEntry, BankStatement, BankStatementLine
from utils.auth_decorators import require_permission
from utils.timezone import get_local_now

bank_reconciliation_bp = Blueprint('bank_reconciliation', __name__)


def _parse_date(value):
    if value is None or value == '':
        return None
    if isinstance(value, datetime):
        return value.date()
    if hasattr(value, 'year') and hasattr(value, 'month'):  # already a date
        return value
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y'):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            continue
    return None


def _to_amount(value):
    if value is None or value == '':
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).strip().replace('.', '').replace(',', '.') if ',' in str(value) else str(value).strip().replace(',', '')
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _parse_rows(file_storage):
    """Accepts .csv or .xlsx. Expected columns (case-insensitive header
    match, order doesn't matter): tanggal/date, keterangan/description,
    debit, kredit/credit — OR a single signed mutasi/amount column."""
    filename = (file_storage.filename or '').lower()
    rows = []

    if filename.endswith('.csv'):
        text = file_storage.read().decode('utf-8-sig', errors='ignore')
        reader = csv.reader(io.StringIO(text))
        raw_rows = list(reader)
    elif filename.endswith(('.xlsx', '.xls')):
        wb = openpyxl.load_workbook(io.BytesIO(file_storage.read()), data_only=True)
        ws = wb.active
        raw_rows = [list(r) for r in ws.iter_rows(values_only=True)]
    else:
        raise ValueError('File harus berformat .csv, .xlsx, atau .xls')

    if not raw_rows:
        return rows

    header = [str(h or '').strip().lower() for h in raw_rows[0]]

    def col_index(*names):
        for name in names:
            if name in header:
                return header.index(name)
        return None

    idx_date = col_index('tanggal', 'date', 'tgl')
    idx_desc = col_index('keterangan', 'description', 'deskripsi', 'uraian')
    idx_ref = col_index('referensi', 'reference', 'no. referensi', 'reference_number')
    idx_debit = col_index('debit', 'debet')
    idx_credit = col_index('kredit', 'credit')
    idx_amount = col_index('mutasi', 'amount', 'jumlah')

    if idx_date is None:
        raise ValueError("Kolom tanggal ('Tanggal'/'Date') tidak ditemukan di baris header")
    if idx_amount is None and idx_debit is None and idx_credit is None:
        raise ValueError("Butuh kolom 'Debit'+'Kredit', atau 1 kolom 'Mutasi'/'Amount' bertanda +/-")

    for r in raw_rows[1:]:
        if not r or all(c is None or str(c).strip() == '' for c in r):
            continue
        line_date = _parse_date(r[idx_date]) if idx_date < len(r) else None
        if not line_date:
            continue

        if idx_amount is not None:
            amount = _to_amount(r[idx_amount]) if idx_amount < len(r) else 0.0
        else:
            debit = _to_amount(r[idx_debit]) if idx_debit is not None and idx_debit < len(r) else 0.0
            credit = _to_amount(r[idx_credit]) if idx_credit is not None and idx_credit < len(r) else 0.0
            amount = credit - debit  # convention: credit(in) positive, debit(out) negative

        if amount == 0:
            continue

        rows.append({
            'line_date': line_date,
            'description': (str(r[idx_desc]).strip() if idx_desc is not None and idx_desc < len(r) and r[idx_desc] is not None else None),
            'reference_number': (str(r[idx_ref]).strip() if idx_ref is not None and idx_ref < len(r) and r[idx_ref] is not None else None),
            'amount': amount,
        })

    return rows


@bank_reconciliation_bp.route('/statements', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def list_statements():
    statements = BankStatement.query.order_by(BankStatement.period_start.desc()).all()
    return jsonify({'statements': [{
        'id': s.id,
        'account_id': s.account_id,
        'account_name': s.account.account_name if s.account else None,
        'period_start': s.period_start.isoformat(),
        'period_end': s.period_end.isoformat(),
        'source_filename': s.source_filename,
        'imported_at': s.imported_at.isoformat(),
        'total_lines': len(s.lines),
        'matched_lines': sum(1 for l in s.lines if l.is_matched),
    } for s in statements]}), 200


@bank_reconciliation_bp.route('/statements', methods=['POST'])
@jwt_required()
@require_permission('finance.create')
def import_statement():
    if 'file' not in request.files:
        return jsonify({'error': 'File tidak ditemukan'}), 400

    account_id = request.form.get('account_id')
    if not account_id:
        return jsonify({'error': 'account_id (rekening kas/bank) wajib diisi'}), 400

    account = db.session.get(Account, int(account_id))
    if not account:
        return jsonify({'error': 'Akun tidak ditemukan'}), 404
    if not account.is_cash_bank:
        return jsonify({'error': 'Akun yang dipilih bukan akun Kas/Bank (is_cash_bank)'}), 400

    file = request.files['file']
    try:
        rows = _parse_rows(file)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    if not rows:
        return jsonify({'error': 'Tidak ada baris mutasi valid yang bisa dibaca dari file ini'}), 400

    dates = [r['line_date'] for r in rows]
    statement = BankStatement(
        account_id=account.id,
        period_start=min(dates),
        period_end=max(dates),
        source_filename=file.filename,
        imported_by=get_jwt_identity(),
        imported_at=get_local_now(),
    )
    db.session.add(statement)
    db.session.flush()

    for r in rows:
        db.session.add(BankStatementLine(
            statement_id=statement.id,
            line_date=r['line_date'],
            description=r['description'],
            reference_number=r['reference_number'],
            amount=r['amount'],
        ))

    db.session.commit()
    return jsonify({
        'message': f'{len(rows)} baris mutasi berhasil diimpor',
        'statement_id': statement.id,
        'lines_imported': len(rows),
    }), 201


@bank_reconciliation_bp.route('/statements/<int:statement_id>/lines', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def get_statement_lines(statement_id):
    statement = db.session.get(BankStatement, statement_id)
    if not statement:
        return jsonify({'error': 'Statement not found'}), 404

    only_unmatched = request.args.get('unmatched_only', 'false').lower() == 'true'
    lines = statement.lines
    if only_unmatched:
        lines = [l for l in lines if not l.is_matched]

    result = []
    for line in sorted(lines, key=lambda l: l.line_date):
        candidates = []
        matched_entry = None
        if line.is_matched and line.matched_accounting_entry_id:
            e = db.session.get(AccountingEntry, line.matched_accounting_entry_id)
            if e:
                matched_entry = {
                    'id': e.id,
                    'entry_number': e.entry_number,
                    'entry_date': e.entry_date.isoformat(),
                    'description': e.description,
                    'debit_amount': float(e.debit_amount or 0),
                    'credit_amount': float(e.credit_amount or 0),
                }
        if not line.is_matched:
            already_matched_ids = {
                l.matched_accounting_entry_id for l in statement.lines if l.matched_accounting_entry_id
            }
            date_from = line.line_date - timedelta(days=3)
            date_to = line.line_date + timedelta(days=3)
            target_amount = abs(float(line.amount))
            # Cash/bank is an asset account - a debit increases its balance
            # (money in, positive statement line) and a credit decreases it
            # (money out, negative line). This was previously inverted, so
            # every real match (e.g. a receipt line vs the AR-Cash debit
            # side of its journal) was silently never found.
            debit_or_credit = AccountingEntry.debit_amount if line.amount > 0 else AccountingEntry.credit_amount

            query = AccountingEntry.query.filter(
                AccountingEntry.account_id == statement.account_id,
                AccountingEntry.entry_date >= date_from,
                AccountingEntry.entry_date <= date_to,
                debit_or_credit == target_amount,
            )
            if already_matched_ids:
                query = query.filter(~AccountingEntry.id.in_(already_matched_ids))

            candidates = [{
                'id': e.id,
                'entry_number': e.entry_number,
                'entry_date': e.entry_date.isoformat(),
                'description': e.description,
                'debit_amount': float(e.debit_amount or 0),
                'credit_amount': float(e.credit_amount or 0),
            } for e in query.limit(5).all()]

        result.append({
            'id': line.id,
            'line_date': line.line_date.isoformat(),
            'description': line.description,
            'reference_number': line.reference_number,
            'amount': float(line.amount),
            'is_matched': line.is_matched,
            'matched_accounting_entry_id': line.matched_accounting_entry_id,
            'matched_entry': matched_entry,
            'suggested_matches': candidates,
        })

    return jsonify({
        'statement': {
            'id': statement.id,
            'account_name': statement.account.account_name if statement.account else None,
            'period_start': statement.period_start.isoformat(),
            'period_end': statement.period_end.isoformat(),
        },
        'lines': result,
        'total_lines': len(statement.lines),
        'matched_lines': len([l for l in statement.lines if l.is_matched]),
    }), 200


@bank_reconciliation_bp.route('/lines/<int:line_id>/match', methods=['POST'])
@jwt_required()
@require_permission('finance.edit')
def match_line(line_id):
    """Manually confirm a match between a bank statement line and a real
    AccountingEntry - never automatic, always an explicit user action."""
    line = db.session.get(BankStatementLine, line_id)
    if not line:
        return jsonify({'error': 'Line not found'}), 404
    if line.is_matched:
        return jsonify({'error': 'Baris ini sudah dicocokkan - unmatch dulu untuk mengganti'}), 400

    data = request.get_json() or {}
    accounting_entry_id = data.get('accounting_entry_id')
    if not accounting_entry_id:
        return jsonify({'error': 'accounting_entry_id wajib diisi'}), 400

    entry = db.session.get(AccountingEntry, accounting_entry_id)
    if not entry:
        return jsonify({'error': 'AccountingEntry not found'}), 404

    line.is_matched = True
    line.matched_accounting_entry_id = entry.id
    line.matched_by = get_jwt_identity()
    line.matched_at = get_local_now()
    db.session.commit()

    return jsonify({'message': 'Baris berhasil dicocokkan', 'line_id': line.id}), 200


@bank_reconciliation_bp.route('/lines/<int:line_id>/unmatch', methods=['POST'])
@jwt_required()
@require_permission('finance.edit')
def unmatch_line(line_id):
    line = db.session.get(BankStatementLine, line_id)
    if not line:
        return jsonify({'error': 'Line not found'}), 404

    line.is_matched = False
    line.matched_accounting_entry_id = None
    line.matched_by = None
    line.matched_at = None
    db.session.commit()

    return jsonify({'message': 'Kecocokan dibatalkan', 'line_id': line.id}), 200


@bank_reconciliation_bp.route('/statements/<int:statement_id>', methods=['DELETE'])
@jwt_required()
@require_permission('finance.delete')
def delete_statement(statement_id):
    """Delete an imported statement (e.g. wrong file) - blocked if any line
    already has a confirmed match, to avoid silently orphaning a real
    reconciliation decision."""
    statement = db.session.get(BankStatement, statement_id)
    if not statement:
        return jsonify({'error': 'Statement not found'}), 404

    if any(l.is_matched for l in statement.lines):
        return jsonify({'error': 'Tidak bisa dihapus - ada baris yang sudah dicocokkan. Unmatch semua baris dulu.'}), 400

    db.session.delete(statement)
    db.session.commit()
    return jsonify({'message': 'Statement deleted'}), 200
