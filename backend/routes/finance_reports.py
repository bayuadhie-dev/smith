"""Finance report center: trial balance, account ledger (bank/cash mutation), daily cash, cash position,
customer/supplier statements, purchase report, VAT summary and equity changes.

Every endpoint takes date_from/date_to (YYYY-MM-DD) and `format=xlsx` to download the same table as Excel.
All figures come from POSTED journal lines (accounting_entries) or the invoice/payment sub-ledgers, in IDR.
"""
import io
import re
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required
from sqlalchemy import case, func

from models import db
from models.finance import Account, AccountingEntry, CreditMemo, CreditMemoApplication, Invoice, Payment, PaymentAllocation
from utils.auth_decorators import require_permission
from utils.timezone import get_local_today

finance_reports_bp = Blueprint('finance_reports', __name__)

DOC_URLS = {
    'payment': '/app/finance/payments/{id}',
    'void_payment': '/app/finance/payments/{id}',
    'sales_invoice': '/app/finance/invoices/{id}',
    'void_sales_invoice': '/app/finance/invoices/{id}',
    'purchase_invoice': '/app/purchasing/invoices/{id}',
    'void_purchase_invoice': '/app/purchasing/invoices/{id}',
    'credit_memo_refund': '/app/finance/credit-memos',
    'manual_journal': '/app/accounting/journal',
    'invoice': '/app/finance/invoices/{id}',
    'work_order': '/app/production/work-orders/{id}',
    'work_order_ready_to_close': '/app/production/work-orders/{id}',
    'work_order_revert': '/app/production/work-orders/{id}',
    'work_order_ipqc': '/app/production/work-orders/{id}',
    'sales_order': '/app/sales/orders/{id}',
    'sales_order_correction': '/app/sales/orders/{id}',
    'purchase_order': '/app/purchasing/purchase-orders/{id}',
    'stock_opname': '/app/warehouse/stock-opname/{id}',
    'sales_delivery': '/app/shipping/orders/{id}',
    'asset': '/app/assets/{id}',
    'recurring_payment': '/app/finance/recurring-payments',
    'payroll_period': '/app/hr/payroll/periods/{id}/records',
    'payroll_payment': '/app/hr/payroll/{id}/edit',
    'material_issue': '/app/production/material-issues/{id}',
    'fg_conversion': '/app/production/fg-conversion/{id}',
    'wip_conversion_to_fg': '/app/production/work-orders/{id}',
    'inventory_destruction': '/app/waste/{id}/edit',
    'purchase_return': '/app/purchasing/returns/{id}',
    'production_approval': '/app/production/approvals/{id}',
    'manual_stock_in': '/app/wms/transactions/{id}',
}


def _doc_url(reference_type, reference_id):
    tpl = DOC_URLS.get(reference_type or '')
    return tpl.format(id=reference_id) if tpl and (reference_id or '{id}' not in tpl) else None


def _d(value):
    return value.date() if isinstance(value, datetime) else value


def _period():
    today = get_local_today()
    try:
        date_to = date.fromisoformat(request.args['date_to']) if request.args.get('date_to') else today
        date_from = date.fromisoformat(request.args['date_from']) if request.args.get('date_from') else date_to.replace(day=1)
    except ValueError:
        raise ValueError('Format tanggal harus YYYY-MM-DD')
    if date_from > date_to:
        raise ValueError('Tanggal mulai tidak boleh setelah tanggal akhir')
    return date_from, date_to


def _f(v):
    return float(v or 0)


_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def _is_total_row(r):
    return any(isinstance(c, str) and c.strip().upper().startswith(('TOTAL', 'SALDO AWAL')) for c in r)


def _col_kinds(headers, rows):
    """'num' / 'int' / 'date' / 'text' per column, from the data itself."""
    kinds = []
    for i in range(len(headers)):
        vals = [r[i] for r in rows if i < len(r) and r[i] not in ('', None)]
        if vals and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in vals):
            kinds.append('int' if all(float(v).is_integer() for v in vals) and not any(isinstance(v, float) for v in vals) else 'num')
        elif vals and all(isinstance(v, str) and _DATE_RE.match(v) for v in vals):
            kinds.append('date')
        else:
            kinds.append('text')
    return kinds


def _idn(v, decimals=2):
    s = f'{abs(v):,.{decimals}f}'.replace(',', '#').replace('.', ',').replace('#', '.')
    return ('-' if v < 0 and round(abs(v), decimals) != 0 else '') + s


def _date_idn(v):
    return f'{v[8:10]}/{v[5:7]}/{v[0:4]}'


def _company_name():
    # The CompanyProfile row (Settings) is the source of truth; the constant in company_config is only a fallback.
    try:
        from company_config.company import get_company_info
        return get_company_info()['name']
    except Exception:
        return 'SMITH ERP'


def _xlsx_file(title, headers, rows, filename, subtitle, kinds):
    import datetime as _dt
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter
    n = len(headers)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = re.sub(r'[\\/*?:\[\]]', '-', title)[:30]
    thin = Side(style='thin', color='D1D5DB')
    meta = [(_company_name(), Font(bold=True, size=12, color='065F46')), (title, Font(bold=True, size=15)),
            (subtitle or '', Font(size=10, color='4B5563')), ('Dicetak: ' + _dt.datetime.now().strftime('%d/%m/%Y %H:%M'), Font(size=9, italic=True, color='6B7280'))]
    for i, (text, font) in enumerate(meta, start=1):
        ws.cell(row=i, column=1, value=text).font = font
        ws.merge_cells(start_row=i, start_column=1, end_row=i, end_column=max(n, 2))
    hr = 6
    for j, h in enumerate(headers, start=1):
        c = ws.cell(row=hr, column=j, value=h)
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = PatternFill('solid', fgColor='047857')
        c.alignment = Alignment(horizontal='right' if kinds[j - 1] in ('num', 'int') else ('center' if kinds[j - 1] == 'date' else 'left'), vertical='center', wrap_text=True)
        c.border = Border(top=thin, bottom=thin, left=thin, right=thin)
    ws.row_dimensions[hr].height = 30
    widths = [len(str(h)) * 0.9 for h in headers]
    for ri, r in enumerate(rows):
        row_no = hr + 1 + ri
        total = _is_total_row(r)
        for j in range(n):
            v = r[j] if j < len(r) else ''
            k = kinds[j]
            if k == 'date' and isinstance(v, str) and _DATE_RE.match(v):
                v = _dt.date.fromisoformat(v)
            c = ws.cell(row=row_no, column=j + 1, value=None if v == '' else v)
            c.border = Border(top=thin, bottom=thin, left=thin, right=thin)
            if k == 'num':
                c.number_format = '#,##0.00;[Red]-#,##0.00'
                c.alignment = Alignment(horizontal='right', vertical='top')
            elif k == 'int':
                c.number_format = '#,##0;[Red]-#,##0'
                c.alignment = Alignment(horizontal='right', vertical='top')
            elif k == 'date':
                c.number_format = 'DD/MM/YYYY'
                c.alignment = Alignment(horizontal='center', vertical='top')
            else:
                c.alignment = Alignment(horizontal='left', vertical='top', wrap_text=True)
            if total:
                c.font = Font(bold=True)
                c.fill = PatternFill('solid', fgColor='D1FAE5')
            elif ri % 2 == 1:
                c.fill = PatternFill('solid', fgColor='F9FAFB')
            ln = len(_idn(v)) if isinstance(v, (int, float)) else (10 if k == 'date' else len(str(v)))
            widths[j] = max(widths[j], min(ln, 48))
    for j in range(n):
        ws.column_dimensions[get_column_letter(j + 1)].width = min(max(widths[j] + 3, 11), 50)
    ws.freeze_panes = ws.cell(row=hr + 1, column=1)
    ws.page_setup.orientation = 'landscape' if n > 6 else 'portrait'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = f'{hr}:{hr}'
    ws.oddFooter.center.text = 'Halaman &P dari &N'
    ws.sheet_view.showGridLines = False
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return send_file(buf, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', as_attachment=True, download_name=filename)


def _pdf_file(title, headers, rows, filename, subtitle, kinds):
    import datetime as _dt
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from xml.sax.saxutils import escape
    n = len(headers)
    page = landscape(A4) if (n > 5 or sum(1 for k in kinds if k == 'text') > 2) else A4
    margin = 12 * mm
    avail = page[0] - 2 * margin
    cell = ParagraphStyle('c', fontName='Helvetica', fontSize=8, leading=10)
    cell_b = ParagraphStyle('cb', parent=cell, fontName='Helvetica-Bold')
    right = ParagraphStyle('r', parent=cell, alignment=2)
    right_b = ParagraphStyle('rb', parent=right, fontName='Helvetica-Bold')
    center = ParagraphStyle('ce', parent=cell, alignment=1)
    head = ParagraphStyle('h', parent=cell, fontName='Helvetica-Bold', textColor=colors.white)
    head_r = ParagraphStyle('hr', parent=head, alignment=2)
    head_c = ParagraphStyle('hc', parent=head, alignment=1)

    def fmt(v, k):
        if v in ('', None):
            return ''
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            return _idn(v, 0 if k == 'int' else 2)
        if k == 'date' and isinstance(v, str) and _DATE_RE.match(v):
            return _date_idn(v)
        return str(v)

    data = [[Paragraph(escape(str(h)), head_r if kinds[j] in ('num', 'int') else head_c if kinds[j] == 'date' else head) for j, h in enumerate(headers)]]
    total_rows = []
    for ri, r in enumerate(rows):
        total = _is_total_row(r)
        if total:
            total_rows.append(ri + 1)
        line = []
        for j in range(n):
            v = r[j] if j < len(r) else ''
            k = kinds[j]
            st = (right_b if total else right) if k in ('num', 'int') else center if k == 'date' else (cell_b if total else cell)
            line.append(Paragraph(escape(fmt(v, k)), st))
        data.append(line)
    # column widths proportional to content, with floors
    weight = []
    for j in range(n):
        longest = max([len(str(headers[j])) * 0.75] + [len(fmt(r[j], kinds[j])) if j < len(r) else 0 for r in rows[:300]])
        weight.append(min(max(longest, 6), 40 if kinds[j] == 'text' else 20))
    scale = avail / sum(weight)
    col_w = [w * scale for w in weight]
    table = Table(data, colWidths=col_w, repeatRows=1)
    style = [('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#047857')), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
             ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#D1D5DB')), ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
             ('LEFTPADDING', (0, 0), (-1, -1), 3), ('RIGHTPADDING', (0, 0), (-1, -1), 3), ('TOPPADDING', (0, 0), (-1, -1), 2.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5)]
    for ri in total_rows:
        style.append(('BACKGROUND', (0, ri), (-1, ri), colors.HexColor('#D1FAE5')))
    table.setStyle(TableStyle(style))
    printed = _dt.datetime.now().strftime('%d/%m/%Y %H:%M')
    company = _company_name()

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColor(colors.HexColor('#6B7280'))
        canvas.drawString(margin, 8 * mm, f'{company} - {title}')
        canvas.drawRightString(page[0] - margin, 8 * mm, f'Dicetak {printed}  |  Halaman {doc.page}')
        canvas.restoreState()

    story = [Paragraph(escape(company), ParagraphStyle('co', fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor('#065F46'))),
             Paragraph(escape(title), ParagraphStyle('ti', fontName='Helvetica-Bold', fontSize=15, leading=19)),
             Paragraph(escape(subtitle or ''), ParagraphStyle('su', fontName='Helvetica', fontSize=9, textColor=colors.HexColor('#4B5563'))),
             Spacer(1, 5 * mm), table]
    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=page, leftMargin=margin, rightMargin=margin, topMargin=margin, bottomMargin=14 * mm, title=title, author=company).build(story, onFirstPage=footer, onLaterPages=footer)
    buf.seek(0)
    return send_file(buf, mimetype='application/pdf', as_attachment=True, download_name=filename)


def _xlsx(title, headers, rows, filename, subtitle=None, number_cols=()):
    """Single export entry point: `format=pdf` returns a real PDF, anything else the formatted Excel workbook."""
    kinds = _col_kinds(headers, [r for r in rows if not _is_total_row(r)] or rows)
    if subtitle:
        subtitle = re.sub(r'(\d{4})-(\d{2})-(\d{2})', r'\3/\2/\1', str(subtitle))
    base = filename.rsplit('.', 1)[0]
    if (request.args.get('format') or '').lower() == 'pdf':
        return _pdf_file(title, headers, rows, base + '.pdf', subtitle, kinds)
    return _xlsx_file(title, headers, rows, base + '.xlsx', subtitle, kinds)


def _wants_xlsx():
    return (request.args.get('format') or '').lower() in ('xlsx', 'pdf')


def _err(e, code=400):
    return jsonify({'error': str(e)}), code


def _descendant_ids(account):
    ids = {account.id}
    if account.is_header:
        frontier = [account.id]
        while frontier:
            kids = Account.query.filter(Account.parent_id.in_(frontier)).all()
            frontier = [k.id for k in kids if k.id not in ids]
            ids.update(frontier)
        ids.update(a.id for a in Account.query.filter(
            Account.account_code.like(account.account_code + '%'), Account.account_code != account.account_code).all())
    return ids


def _sums_by_account(date_from, date_to, account_ids=None):
    """{account_id: (opening_net, debit, credit)} using posted lines only. net = debit - credit."""
    opening = func.coalesce(func.sum(case((AccountingEntry.entry_date < date_from, AccountingEntry.debit_amount - AccountingEntry.credit_amount), else_=0)), 0)
    debit = func.coalesce(func.sum(case((db.and_(AccountingEntry.entry_date >= date_from, AccountingEntry.entry_date <= date_to), AccountingEntry.debit_amount), else_=0)), 0)
    credit = func.coalesce(func.sum(case((db.and_(AccountingEntry.entry_date >= date_from, AccountingEntry.entry_date <= date_to), AccountingEntry.credit_amount), else_=0)), 0)
    q = db.session.query(AccountingEntry.account_id, opening, debit, credit).filter(
        AccountingEntry.status == 'posted', AccountingEntry.entry_date <= date_to)
    if account_ids is not None:
        q = q.filter(AccountingEntry.account_id.in_(account_ids))
    return {aid: (_f(o), _f(d), _f(c)) for aid, o, d, c in q.group_by(AccountingEntry.account_id).all()}


# ------------------------------------------------------------------ trial balance
@finance_reports_bp.route('/trial-balance', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def trial_balance():
    try:
        date_from, date_to = _period()
    except ValueError as e:
        return _err(e)
    hide_zero = request.args.get('hide_zero', 'true').lower() != 'false'
    sums = _sums_by_account(date_from, date_to)
    rows = []
    for a in Account.query.filter(Account.is_header.is_(False)).order_by(Account.account_code).all():
        o, d, c = sums.get(a.id, (0.0, 0.0, 0.0))
        closing = o + d - c
        if hide_zero and abs(o) < 0.005 and abs(d) < 0.005 and abs(c) < 0.005 and abs(closing) < 0.005:
            continue
        rows.append({
            'account_id': a.id, 'account_code': a.account_code, 'account_name': a.account_name, 'account_type': a.account_type,
            'opening_debit': round(o, 2) if o > 0 else 0.0, 'opening_credit': round(-o, 2) if o < 0 else 0.0,
            'period_debit': round(d, 2), 'period_credit': round(c, 2),
            'closing_debit': round(closing, 2) if closing > 0 else 0.0, 'closing_credit': round(-closing, 2) if closing < 0 else 0.0,
        })
    keys = ('opening_debit', 'opening_credit', 'period_debit', 'period_credit', 'closing_debit', 'closing_credit')
    totals = {k: round(sum(r[k] for r in rows), 2) for k in keys}
    balanced = abs(totals['closing_debit'] - totals['closing_credit']) < 0.01 and abs(totals['period_debit'] - totals['period_credit']) < 0.01
    if _wants_xlsx():
        headers = ['Kode', 'Nama Akun', 'Jenis', 'Saldo Awal Debit', 'Saldo Awal Kredit', 'Mutasi Debit', 'Mutasi Kredit', 'Saldo Akhir Debit', 'Saldo Akhir Kredit']
        data = [[r['account_code'], r['account_name'], r['account_type']] + [r[k] for k in keys] for r in rows]
        data.append(['', 'TOTAL', ''] + [totals[k] for k in keys])
        return _xlsx('Neraca Saldo', headers, data, f'neraca_saldo_{date_from}_{date_to}.xlsx', f'Periode {date_from} s/d {date_to}')
    return jsonify({'period': {'date_from': date_from.isoformat(), 'date_to': date_to.isoformat()}, 'rows': rows, 'totals': totals, 'is_balanced': balanced}), 200


# ------------------------------------------------------------------ account ledger (also bank / cash mutation)
def _ledger(account, date_from, date_to):
    ids = _descendant_ids(account)
    sign = 1 if account.normal_balance == 'debit' else -1
    opening_net = _f(db.session.query(func.coalesce(func.sum(AccountingEntry.debit_amount - AccountingEntry.credit_amount), 0)).filter(
        AccountingEntry.account_id.in_(ids), AccountingEntry.status == 'posted', AccountingEntry.entry_date < date_from).scalar())
    from utils.finance_helpers import hide_voided_pairs
    q = hide_voided_pairs(AccountingEntry.query.filter(
        AccountingEntry.account_id.in_(ids), AccountingEntry.status == 'posted',
        AccountingEntry.entry_date >= date_from, AccountingEntry.entry_date <= date_to,
    )).order_by(AccountingEntry.entry_date, AccountingEntry.id)
    total = q.count()
    entries = q.limit(5000).all()
    balance = opening_net
    rows, total_debit, total_credit = [], 0.0, 0.0
    for e in entries:
        d, c = _f(e.debit_amount), _f(e.credit_amount)
        balance += d - c
        total_debit += d
        total_credit += c
        rows.append({
            'id': e.id, 'entry_date': e.entry_date.isoformat(), 'entry_number': e.entry_number,
            'account_code': e.account_code, 'account_name': e.account_name,
            'description': e.description, 'reference_type': e.reference_type, 'reference_id': e.reference_id,
            'reference_number': e.reference_number, 'document_url': _doc_url(e.reference_type, e.reference_id),
            'debit': round(d, 2), 'credit': round(c, 2), 'balance': round(sign * balance, 2),
        })
    return {
        'account': {'id': account.id, 'code': account.account_code, 'name': account.account_name, 'type': account.account_type,
                    'normal_balance': account.normal_balance, 'is_header': bool(account.is_header), 'is_cash_bank': bool(account.is_cash_bank)},
        'period': {'date_from': date_from.isoformat(), 'date_to': date_to.isoformat()},
        'opening_balance': round(sign * opening_net, 2), 'total_debit': round(total_debit, 2), 'total_credit': round(total_credit, 2),
        'closing_balance': round(sign * balance, 2), 'rows': rows, 'row_count': total, 'truncated': total > len(entries),
    }


@finance_reports_bp.route('/account-ledger', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def account_ledger():
    try:
        date_from, date_to = _period()
    except ValueError as e:
        return _err(e)
    account = db.session.get(Account, int(request.args['account_id'])) if str(request.args.get('account_id', '')).isdigit() else \
        Account.query.filter_by(account_code=request.args.get('account_code', '')).first()
    if not account:
        return _err('Akun tidak ditemukan', 404)
    data = _ledger(account, date_from, date_to)
    if _wants_xlsx():
        headers = ['Tanggal', 'No. Jurnal', 'Akun', 'Keterangan', 'Referensi', 'Debit', 'Kredit', 'Saldo']
        rows = [['', '', '', 'Saldo awal', '', 0.0, 0.0, data['opening_balance']]]
        rows += [[r['entry_date'], r['entry_number'], f"{r['account_code']} {r['account_name']}", r['description'] or '',
                  r['reference_number'] or r['reference_type'] or '', r['debit'], r['credit'], r['balance']] for r in data['rows']]
        rows.append(['', '', '', 'TOTAL / Saldo akhir', '', data['total_debit'], data['total_credit'], data['closing_balance']])
        return _xlsx('Mutasi ' + account.account_code, headers, rows, f'mutasi_{account.account_code}_{date_from}_{date_to}.xlsx',
                     f'{account.account_code} - {account.account_name} | {date_from} s/d {date_to}')
    return jsonify(data), 200


@finance_reports_bp.route('/cash-accounts', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def cash_accounts():
    accs = Account.query.filter(Account.is_cash_bank.is_(True), Account.is_header.is_(False), Account.is_active.is_(True)).order_by(Account.account_code).all()
    return jsonify({'accounts': [{'id': a.id, 'code': a.account_code, 'name': a.account_name} for a in accs]}), 200


# ------------------------------------------------------------------ daily cash recap
@finance_reports_bp.route('/cash-daily', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def cash_daily():
    try:
        date_from, date_to = _period()
    except ValueError as e:
        return _err(e)
    accs = Account.query.filter(Account.is_cash_bank.is_(True), Account.is_header.is_(False)).order_by(Account.account_code).all()
    if request.args.get('account_id'):
        accs = [a for a in accs if str(a.id) == request.args['account_id']]
    ids = [a.id for a in accs]
    sums = _sums_by_account(date_from, date_to, ids)
    per_account = []
    opening_total = 0.0
    for a in accs:
        o, d, c = sums.get(a.id, (0.0, 0.0, 0.0))
        if abs(o) < 0.005 and abs(d) < 0.005 and abs(c) < 0.005:
            continue
        per_account.append({'account_id': a.id, 'code': a.account_code, 'name': a.account_name, 'opening': round(o, 2),
                            'receipts': round(d, 2), 'disbursements': round(c, 2), 'closing': round(o + d - c, 2)})
        opening_total += o
    daily = db.session.query(
        AccountingEntry.entry_date, func.coalesce(func.sum(AccountingEntry.debit_amount), 0), func.coalesce(func.sum(AccountingEntry.credit_amount), 0), func.count(AccountingEntry.id),
    ).filter(AccountingEntry.account_id.in_(ids), AccountingEntry.status == 'posted',
             AccountingEntry.entry_date >= date_from, AccountingEntry.entry_date <= date_to
             ).group_by(AccountingEntry.entry_date).order_by(AccountingEntry.entry_date).all() if ids else []
    rows, running = [], opening_total
    for day, d, c, n in daily:
        opening = running
        running += _f(d) - _f(c)
        rows.append({'date': day.isoformat(), 'opening': round(opening, 2), 'receipts': round(_f(d), 2), 'disbursements': round(_f(c), 2),
                     'closing': round(running, 2), 'transactions': n})
    totals = {'opening': round(opening_total, 2), 'receipts': round(sum(r['receipts'] for r in rows), 2),
              'disbursements': round(sum(r['disbursements'] for r in rows), 2), 'closing': round(running, 2)}
    if _wants_xlsx():
        headers = ['Tanggal', 'Saldo Awal', 'Penerimaan', 'Pengeluaran', 'Saldo Akhir', 'Jumlah Transaksi']
        data = [[r['date'], r['opening'], r['receipts'], r['disbursements'], r['closing'], r['transactions']] for r in rows]
        data.append(['TOTAL', totals['opening'], totals['receipts'], totals['disbursements'], totals['closing'], sum(r['transactions'] for r in rows)])
        return _xlsx('Rekap Kas Harian', headers, data, f'rekap_kas_harian_{date_from}_{date_to}.xlsx', f'Periode {date_from} s/d {date_to}')
    return jsonify({'period': {'date_from': date_from.isoformat(), 'date_to': date_to.isoformat()}, 'rows': rows, 'accounts': per_account, 'totals': totals}), 200


@finance_reports_bp.route('/cash-daily-detail', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def cash_daily_detail():
    """All cash/bank lines of one day, each with the account on the other side of its journal."""
    try:
        day = date.fromisoformat(request.args['date'])
    except (KeyError, ValueError):
        return _err('date wajib diisi (YYYY-MM-DD)')
    accs = Account.query.filter(Account.is_cash_bank.is_(True), Account.is_header.is_(False)).all()
    if request.args.get('account_id'):
        accs = [a for a in accs if str(a.id) == request.args['account_id']]
    ids = [a.id for a in accs]
    from utils.finance_helpers import hide_voided_pairs
    lines = hide_voided_pairs(AccountingEntry.query.filter(AccountingEntry.account_id.in_(ids), AccountingEntry.status == 'posted',
                                         AccountingEntry.entry_date == day)).order_by(AccountingEntry.id).all() if ids else []
    bases = {e.entry_number.rsplit('-', 1)[0] for e in lines if e.entry_number}
    counters = {}
    if bases:
        for e in AccountingEntry.query.filter(AccountingEntry.status == 'posted', db.or_(*[AccountingEntry.entry_number.like(b + '-%') for b in bases])).all():
            if e.account_id not in ids:
                counters.setdefault(e.entry_number.rsplit('-', 1)[0], []).append(f'{e.account_code} {e.account_name}')
    rows = [{'id': e.id, 'entry_number': e.entry_number, 'account_code': e.account_code, 'account_name': e.account_name,
             'description': e.description, 'counter_accounts': ', '.join(sorted(set(counters.get(e.entry_number.rsplit('-', 1)[0], [])))),
             'reference_type': e.reference_type, 'reference_number': e.reference_number, 'document_url': _doc_url(e.reference_type, e.reference_id),
             'receipt': round(_f(e.debit_amount), 2), 'disbursement': round(_f(e.credit_amount), 2)} for e in lines]
    totals = {'receipts': round(sum(r['receipt'] for r in rows), 2), 'disbursements': round(sum(r['disbursement'] for r in rows), 2)}
    if _wants_xlsx():
        data = [[r['entry_number'], f"{r['account_code']} {r['account_name']}", r['description'] or '', r['counter_accounts'], r['receipt'], r['disbursement']] for r in rows]
        data.append(['', '', '', 'TOTAL', totals['receipts'], totals['disbursements']])
        return _xlsx('Kas Harian ' + str(day), ['No. Jurnal', 'Rekening', 'Keterangan', 'Akun Lawan', 'Penerimaan', 'Pengeluaran'], data, f'kas_harian_{day}.xlsx', str(day))
    return jsonify({'date': day.isoformat(), 'rows': rows, 'totals': totals}), 200


@finance_reports_bp.route('/cash-position', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def cash_position():
    try:
        as_of = date.fromisoformat(request.args['as_of']) if request.args.get('as_of') else get_local_today()
    except ValueError:
        return _err('Format tanggal harus YYYY-MM-DD')
    accs = Account.query.filter(Account.is_cash_bank.is_(True), Account.is_header.is_(False), Account.is_active.is_(True)).order_by(Account.account_code).all()
    bal = {aid: (_f(d) - _f(c), last) for aid, d, c, last in db.session.query(
        AccountingEntry.account_id, func.sum(AccountingEntry.debit_amount), func.sum(AccountingEntry.credit_amount), func.max(AccountingEntry.entry_date),
    ).filter(AccountingEntry.status == 'posted', AccountingEntry.entry_date <= as_of, AccountingEntry.account_id.in_([a.id for a in accs])).group_by(AccountingEntry.account_id).all()}
    rows = [{'account_id': a.id, 'code': a.account_code, 'name': a.account_name, 'balance': round(bal.get(a.id, (0.0, None))[0], 2),
             'last_transaction': bal.get(a.id, (0.0, None))[1].isoformat() if bal.get(a.id, (0.0, None))[1] else None} for a in accs]
    total = round(sum(r['balance'] for r in rows), 2)
    if _wants_xlsx():
        data = [[r['code'], r['name'], r['balance'], r['last_transaction'] or ''] for r in rows] + [['', 'TOTAL', total, '']]
        return _xlsx('Posisi Kas dan Bank', ['Kode', 'Rekening', 'Saldo', 'Transaksi Terakhir'], data, f'posisi_kas_bank_{as_of}.xlsx', f'Per {as_of}')
    return jsonify({'as_of': as_of.isoformat(), 'rows': rows, 'total': total}), 200


# ------------------------------------------------------------------ customer / supplier statements
def _party_events(kind, party_id=None):
    """All sub-ledger events (date, type, number, description, amount (+ increases the balance), url) per party id."""
    events = {}

    def add(pid, when, etype, number, desc, amount, url=None):
        if pid is None:
            return
        events.setdefault(pid, []).append({'date': _d(when), 'type': etype, 'number': number, 'description': desc, 'amount': round(amount, 2), 'url': url})

    if kind == 'customer':
        q = Invoice.query.filter(Invoice.invoice_type == 'sales', Invoice.status != 'cancelled')
        if party_id:
            q = q.filter(Invoice.customer_id == party_id)
        for inv in q.all():
            add(inv.customer_id, inv.invoice_date, 'invoice', inv.invoice_number, 'Faktur penjualan', _f(inv.total_amount), f'/app/finance/invoices/{inv.id}')
        pq = Payment.query.filter(Payment.customer_id.isnot(None), Payment.status != 'cancelled')
        if party_id:
            pq = pq.filter(Payment.customer_id == party_id)
        for p in pq.all():
            add(p.customer_id, p.payment_date, 'payment', p.payment_number, 'Penerimaan pembayaran', -_f(p.amount), f'/app/finance/payments/{p.id}')
        from models.returns import CustomerReturn
        rq = db.session.query(AccountingEntry, CustomerReturn).join(CustomerReturn, CustomerReturn.id == AccountingEntry.reference_id).filter(
            AccountingEntry.reference_type == 'sales_return', AccountingEntry.status == 'posted', AccountingEntry.credit_amount > 0)
        if party_id:
            rq = rq.filter(CustomerReturn.customer_id == party_id)
        ar_ids = [a.id for a in Account.query.filter(Account.account_code.like('1002%')).all()] or [a.id for a in Account.query.filter(Account.account_code == '1-1100').all()]
        for e, ret in rq.all():
            if e.account_id in ar_ids:
                add(ret.customer_id, e.entry_date, 'return', ret.return_number, 'Retur penjualan', -_f(e.credit_amount), '/app/returns')
        cq = db.session.query(CreditMemoApplication, CreditMemo).join(CreditMemo, CreditMemo.id == CreditMemoApplication.memo_id).filter(
            CreditMemoApplication.kind == 'refund', CreditMemoApplication.reversed_at.is_(None))
        if party_id:
            cq = cq.filter(CreditMemo.customer_id == party_id)
        for app_row, memo in cq.all():
            add(memo.customer_id, app_row.applied_date, 'refund', memo.memo_number, 'Pengembalian dana nota kredit', _f(app_row.amount), '/app/finance/credit-memos')
    else:
        q = Invoice.query.filter(Invoice.invoice_type == 'purchase', Invoice.status != 'cancelled')
        if party_id:
            q = q.filter(Invoice.supplier_id == party_id)
        for inv in q.all():
            rate = _f(inv.exchange_rate) if (inv.currency or 'IDR') != 'IDR' else 1.0
            add(inv.supplier_id, inv.invoice_date, 'invoice', inv.invoice_number,
                'Faktur pembelian' + (f' ({inv.currency} {_f(inv.total_amount):,.2f})' if rate != 1.0 else ''), _f(inv.total_amount) * rate, f'/app/purchasing/invoices/{inv.id}')
        pq = Payment.query.filter(Payment.supplier_id.isnot(None), Payment.status != 'cancelled')
        if party_id:
            pq = pq.filter(Payment.supplier_id == party_id)
        for p in pq.all():
            amount = _f(p.amount)
            if p.allocations and (p.currency or 'IDR') != 'IDR':
                amount = sum(_f(a.amount) * (_f(a.invoice.exchange_rate) if a.invoice else 1.0) for a in p.allocations)
            add(p.supplier_id, p.payment_date, 'payment', p.payment_number, 'Pembayaran hutang', -amount, f'/app/finance/payments/{p.id}')
    return events


def _party_summary(kind, events, date_from, date_to):
    rows = []
    for pid, evs in events.items():
        opening = sum(e['amount'] for e in evs if e['date'] < date_from)
        period = [e for e in evs if date_from <= e['date'] <= date_to]
        invoiced = sum(e['amount'] for e in period if e['type'] == 'invoice')
        payments = -sum(e['amount'] for e in period if e['type'] == 'payment')
        returns = -sum(e['amount'] for e in period if e['type'] == 'return')
        refunds = sum(e['amount'] for e in period if e['type'] == 'refund')
        closing = opening + sum(e['amount'] for e in period)
        if abs(opening) < 0.005 and not period and abs(closing) < 0.005:
            continue
        rows.append({'party_id': pid, 'opening': round(opening, 2), 'invoiced': round(invoiced, 2), 'returns': round(returns, 2),
                     'payments': round(payments, 2), 'refunds': round(refunds, 2), 'closing': round(closing, 2),
                     'invoice_count': len([e for e in period if e['type'] == 'invoice']),
                     'last_activity': max((e['date'] for e in period), default=None)})
    return rows


def _party_model(kind):
    if kind == 'customer':
        from models.sales import Customer
        return Customer
    from models.purchasing import Supplier
    return Supplier


@finance_reports_bp.route('/party-statements', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def party_statements():
    kind = request.args.get('type', 'customer')
    if kind not in ('customer', 'supplier'):
        return _err("type harus 'customer' atau 'supplier'")
    try:
        date_from, date_to = _period()
    except ValueError as e:
        return _err(e)
    Model = _party_model(kind)
    rows = _party_summary(kind, _party_events(kind), date_from, date_to)
    names = {p.id: p for p in Model.query.filter(Model.id.in_([r['party_id'] for r in rows])).all()} if rows else {}
    for r in rows:
        p = names.get(r['party_id'])
        r['party_name'] = p.company_name if p else f"#{r['party_id']}"
        r['tax_id'] = getattr(p, 'tax_id', None)
        r['last_activity'] = r['last_activity'].isoformat() if r['last_activity'] else None
    rows.sort(key=lambda r: -abs(r['closing']))
    keys = ('opening', 'invoiced', 'returns', 'payments', 'refunds', 'closing')
    totals = {k: round(sum(r[k] for r in rows), 2) for k in keys}
    if _wants_xlsx():
        label = 'Customer' if kind == 'customer' else 'Supplier'
        headers = [label, 'NPWP', 'Saldo Awal', 'Faktur', 'Retur', 'Pembayaran', 'Pengembalian Dana', 'Saldo Akhir', 'Jml Faktur']
        data = [[r['party_name'], r['tax_id'] or '', r['opening'], r['invoiced'], r['returns'], r['payments'], r['refunds'], r['closing'], r['invoice_count']] for r in rows]
        data.append(['TOTAL', ''] + [totals[k] for k in keys] + [sum(r['invoice_count'] for r in rows)])
        return _xlsx('Kartu Piutang' if kind == 'customer' else 'Kartu Hutang', headers, data,
                     f'{"kartu_piutang" if kind == "customer" else "kartu_hutang"}_{date_from}_{date_to}.xlsx', f'Periode {date_from} s/d {date_to}')
    return jsonify({'type': kind, 'period': {'date_from': date_from.isoformat(), 'date_to': date_to.isoformat()}, 'rows': rows, 'totals': totals}), 200


@finance_reports_bp.route('/party-statement/<string:kind>/<int:party_id>', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def party_statement(kind, party_id):
    if kind not in ('customer', 'supplier'):
        return _err("type harus 'customer' atau 'supplier'")
    try:
        date_from, date_to = _period()
    except ValueError as e:
        return _err(e)
    party = db.session.get(_party_model(kind), party_id)
    if not party:
        return _err('Data tidak ditemukan', 404)
    rank = {'invoice': 0, 'refund': 1, 'return': 2, 'payment': 3}   # same day: charges first, then credits
    evs = sorted(_party_events(kind, party_id).get(party_id, []), key=lambda e: (e['date'], rank.get(e['type'], 9), e['number'] or ''))
    opening = sum(e['amount'] for e in evs if e['date'] < date_from)
    balance, rows = opening, []
    for e in evs:
        if not (date_from <= e['date'] <= date_to):
            continue
        balance += e['amount']
        increase = e['amount'] if e['amount'] > 0 else 0.0
        decrease = -e['amount'] if e['amount'] < 0 else 0.0
        rows.append({**e, 'date': e['date'].isoformat(), 'increase': round(increase, 2), 'decrease': round(decrease, 2), 'balance': round(balance, 2)})
    data = {
        'type': kind, 'party': {'id': party.id, 'name': party.company_name, 'tax_id': getattr(party, 'tax_id', None),
                                'address': getattr(party, 'billing_address', None) or getattr(party, 'address', None)},
        'period': {'date_from': date_from.isoformat(), 'date_to': date_to.isoformat()},
        'opening_balance': round(opening, 2), 'total_increase': round(sum(r['increase'] for r in rows), 2),
        'total_decrease': round(sum(r['decrease'] for r in rows), 2), 'closing_balance': round(balance, 2), 'rows': rows,
    }
    if _wants_xlsx():
        headers = ['Tanggal', 'Jenis', 'No. Dokumen', 'Keterangan', 'Bertambah', 'Berkurang', 'Saldo']
        labels = {'invoice': 'Faktur', 'payment': 'Pembayaran', 'return': 'Retur', 'refund': 'Pengembalian dana'}
        rws = [['', '', '', 'Saldo awal', 0.0, 0.0, data['opening_balance']]]
        rws += [[r['date'], labels.get(r['type'], r['type']), r['number'], r['description'], r['increase'], r['decrease'], r['balance']] for r in rows]
        rws.append(['', '', '', 'TOTAL / Saldo akhir', data['total_increase'], data['total_decrease'], data['closing_balance']])
        return _xlsx('Kartu ' + ('Piutang' if kind == 'customer' else 'Hutang'), headers, rws, f'kartu_{kind}_{party.id}_{date_from}_{date_to}.xlsx',
                     f'{party.company_name} | {date_from} s/d {date_to}')
    return jsonify(data), 200


# ------------------------------------------------------------------ purchase report
@finance_reports_bp.route('/purchase-report', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def purchase_report():
    try:
        date_from, date_to = _period()
    except ValueError as e:
        return _err(e)
    from models.purchasing import PurchaseOrder, Supplier
    invs = Invoice.query.filter(Invoice.invoice_type == 'purchase', Invoice.status != 'cancelled',
                                Invoice.invoice_date >= date_from, Invoice.invoice_date <= date_to).order_by(Invoice.invoice_date, Invoice.id).all()
    sup = {s.id: s for s in Supplier.query.filter(Supplier.id.in_({i.supplier_id for i in invs if i.supplier_id})).all()} if invs else {}
    pos = {p.id: p for p in PurchaseOrder.query.filter(PurchaseOrder.id.in_({i.purchase_order_id for i in invs if i.purchase_order_id})).all()} if invs else {}
    rows = []
    for i in invs:
        rate = _f(i.exchange_rate) if (i.currency or 'IDR') != 'IDR' else 1.0
        tax_amt, total_amt = _f(i.tax_amount), _f(i.total_amount)
        base = _f(i.subtotal) - _f(i.discount_amount)
        if base == 0 and total_amt > 0:
            base = total_amt - tax_amt           # header-only invoice without lines: derive DPP from the total
        returned = max(0.0, base + tax_amt - total_amt)
        rows.append({
            'invoice_id': i.id, 'invoice_number': i.invoice_number, 'invoice_date': i.invoice_date.isoformat(),
            'returns': round(returned * rate, 2),
            'supplier_id': i.supplier_id, 'supplier_name': sup[i.supplier_id].company_name if i.supplier_id in sup else None,
            'po_number': pos[i.purchase_order_id].po_number if i.purchase_order_id in pos else None,
            'supplier_invoice_number': i.supplier_invoice_number, 'currency': i.currency or 'IDR', 'rate': rate,
            'subtotal': round(base * rate, 2), 'tax': round(tax_amt * rate, 2), 'total': round(total_amt * rate, 2),
            'paid': round(_f(i.paid_amount) * rate, 2), 'balance': round(_f(i.balance_due) * rate, 2), 'status': i.status,
            'url': f'/app/purchasing/invoices/{i.id}',
        })
    by_supplier = {}
    for r in rows:
        s = by_supplier.setdefault(r['supplier_id'], {'supplier_id': r['supplier_id'], 'supplier_name': r['supplier_name'], 'invoice_count': 0, 'subtotal': 0.0, 'tax': 0.0, 'returns': 0.0, 'total': 0.0, 'paid': 0.0, 'balance': 0.0})
        s['invoice_count'] += 1
        for k in ('subtotal', 'tax', 'returns', 'total', 'paid', 'balance'):
            s[k] = round(s[k] + r[k], 2)
    summary = sorted(by_supplier.values(), key=lambda s: -s['total'])
    totals = {k: round(sum(r[k] for r in rows), 2) for k in ('subtotal', 'tax', 'returns', 'total', 'paid', 'balance')}
    if _wants_xlsx():
        if request.args.get('group') == 'supplier':
            data = [[s['supplier_name'], s['invoice_count'], s['subtotal'], s['tax'], s['returns'], s['total'], s['paid'], s['balance']] for s in summary]
            data.append(['TOTAL', len(rows), totals['subtotal'], totals['tax'], totals['returns'], totals['total'], totals['paid'], totals['balance']])
            return _xlsx('Pembelian per Supplier', ['Supplier', 'Jml Faktur', 'DPP', 'PPN', 'Retur', 'Total', 'Dibayar', 'Sisa'], data, f'pembelian_per_supplier_{date_from}_{date_to}.xlsx', f'Periode {date_from} s/d {date_to}')
        data = [[r['invoice_date'], r['invoice_number'], r['supplier_invoice_number'] or '', r['supplier_name'] or '', r['po_number'] or '', r['subtotal'], r['tax'], r['returns'], r['total'], r['paid'], r['balance'], r['status']] for r in rows]
        data.append(['', '', '', '', 'TOTAL', totals['subtotal'], totals['tax'], totals['returns'], totals['total'], totals['paid'], totals['balance'], ''])
        return _xlsx('Laporan Pembelian', ['Tanggal', 'No. Faktur', 'No. Faktur Supplier', 'Supplier', 'No. PO', 'DPP', 'PPN', 'Retur', 'Total', 'Dibayar', 'Sisa', 'Status'], data, f'laporan_pembelian_{date_from}_{date_to}.xlsx', f'Periode {date_from} s/d {date_to}')
    return jsonify({'period': {'date_from': date_from.isoformat(), 'date_to': date_to.isoformat()}, 'rows': rows, 'by_supplier': summary, 'totals': totals}), 200


# ------------------------------------------------------------------ VAT
@finance_reports_bp.route('/vat-summary', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def vat_summary():
    try:
        year = int(request.args.get('year') or get_local_today().year)
    except ValueError:
        return _err('year harus angka')
    months = {m: {'month': f'{year}-{m:02d}', 'output_base': 0.0, 'output_vat': 0.0, 'input_base': 0.0, 'input_vat': 0.0, 'output_count': 0, 'input_count': 0} for m in range(1, 13)}
    for inv in Invoice.query.filter(Invoice.status != 'cancelled', Invoice.invoice_type.in_(('sales', 'purchase')),
                                    Invoice.invoice_date >= date(year, 1, 1), Invoice.invoice_date <= date(year, 12, 31)).all():
        rate = _f(inv.exchange_rate) if (inv.currency or 'IDR') != 'IDR' else 1.0
        if _f(inv.tax_amount) == 0:
            continue
        base = (_f(inv.subtotal) - _f(inv.discount_amount)) * rate
        m = months[inv.invoice_date.month]
        if inv.invoice_type == 'sales':
            m['output_base'] += base; m['output_vat'] += _f(inv.tax_amount) * rate; m['output_count'] += 1
        else:
            m['input_base'] += base; m['input_vat'] += _f(inv.tax_amount) * rate; m['input_count'] += 1
    rows = []
    for m in months.values():
        m = {k: (round(v, 2) if isinstance(v, float) else v) for k, v in m.items()}
        m['net_payable'] = round(m['output_vat'] - m['input_vat'], 2)
        rows.append(m)
    keys = ('output_base', 'output_vat', 'input_base', 'input_vat', 'net_payable')
    totals = {k: round(sum(r[k] for r in rows), 2) for k in keys}
    if _wants_xlsx():
        data = [[r['month'], r['output_base'], r['output_vat'], r['input_base'], r['input_vat'], r['net_payable']] for r in rows]
        data.append(['TOTAL'] + [totals[k] for k in keys])
        return _xlsx('Rekap PPN', ['Bulan', 'DPP Keluaran', 'PPN Keluaran', 'DPP Masukan', 'PPN Masukan', 'PPN Kurang/Lebih Bayar'], data, f'rekap_ppn_{year}.xlsx', f'Tahun {year}')
    return jsonify({'year': year, 'rows': rows, 'totals': totals}), 200


@finance_reports_bp.route('/vat-detail', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def vat_detail():
    try:
        y, m = [int(x) for x in (request.args.get('month') or '').split('-')]
        start = date(y, m, 1)
        end = (start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    except Exception:
        return _err('month harus berformat YYYY-MM')
    kind = request.args.get('kind', 'output')
    inv_type = 'sales' if kind == 'output' else 'purchase'
    from models.sales import Customer
    from models.purchasing import Supplier
    rows = []
    for inv in Invoice.query.filter(Invoice.invoice_type == inv_type, Invoice.status != 'cancelled',
                                    Invoice.invoice_date >= start, Invoice.invoice_date <= end).order_by(Invoice.invoice_date, Invoice.id).all():
        rate = _f(inv.exchange_rate) if (inv.currency or 'IDR') != 'IDR' else 1.0
        party = db.session.get(Customer if inv_type == 'sales' else Supplier, inv.customer_id if inv_type == 'sales' else inv.supplier_id)
        vat = _f(inv.tax_amount) * rate
        if vat == 0:
            continue
        rows.append({'invoice_id': inv.id, 'invoice_number': inv.invoice_number, 'invoice_date': inv.invoice_date.isoformat(),
                     'party_name': party.company_name if party else None, 'tax_id': getattr(party, 'tax_id', None),
                     'base': round((_f(inv.subtotal) - _f(inv.discount_amount)) * rate, 2), 'vat': round(vat, 2),
                     'url': ('/app/finance/invoices/' if inv_type == 'sales' else '/app/purchasing/invoices/') + str(inv.id)})
    totals = {'base': round(sum(r['base'] for r in rows), 2), 'vat': round(sum(r['vat'] for r in rows), 2)}
    if _wants_xlsx():
        data = [[r['invoice_date'], r['invoice_number'], r['party_name'] or '', r['tax_id'] or '', r['base'], r['vat']] for r in rows] + [['', '', '', 'TOTAL', totals['base'], totals['vat']]]
        return _xlsx('PPN ' + ('Keluaran' if kind == 'output' else 'Masukan'), ['Tanggal', 'No. Faktur', 'Lawan Transaksi', 'NPWP', 'DPP', 'PPN'], data, f'ppn_{kind}_{request.args.get("month")}.xlsx', request.args.get('month'))
    return jsonify({'month': request.args.get('month'), 'kind': kind, 'rows': rows, 'totals': totals}), 200


# ------------------------------------------------------------------ changes in equity
@finance_reports_bp.route('/equity-changes', methods=['GET'])
@jwt_required()
@require_permission('finance.view')
def equity_changes():
    try:
        date_from, date_to = _period()
    except ValueError as e:
        return _err(e)
    sums = _sums_by_account(date_from, date_to)
    rows = []
    for a in Account.query.filter(Account.account_type == 'equity', Account.is_header.is_(False)).order_by(Account.account_code).all():
        o, d, c = sums.get(a.id, (0.0, 0.0, 0.0))
        if abs(o) < 0.005 and abs(d) < 0.005 and abs(c) < 0.005:
            continue
        rows.append({'account_id': a.id, 'code': a.account_code, 'name': a.account_name, 'opening': round(-o, 2), 'additions': round(c, 2), 'deductions': round(d, 2), 'closing': round(-(o + d - c), 2)})
    # Profit is not closed into equity automatically: show the part earned before the period and in the period.
    period_profit = prior_profit = 0.0
    for a in Account.query.filter(Account.account_type.in_(('revenue', 'expense'))).all():
        o, d, c = sums.get(a.id, (0.0, 0.0, 0.0))
        if a.account_type == 'revenue':
            period_profit += c - d
            prior_profit += -o
        else:
            period_profit -= d - c
            prior_profit -= o
    period_profit, prior_profit = round(period_profit, 2), round(prior_profit, 2)
    total_open = sum(r['opening'] for r in rows) + prior_profit
    total_close = sum(r['closing'] for r in rows) + prior_profit + period_profit
    if _wants_xlsx():
        data = [[r['code'], r['name'], r['opening'], r['additions'], r['deductions'], r['closing']] for r in rows]
        data += [['', 'Laba ditahan berjalan (periode sebelumnya)', prior_profit, 0.0, 0.0, prior_profit], ['', 'Laba (rugi) periode ini', 0.0, period_profit, 0.0, period_profit],
                 ['', 'TOTAL EKUITAS', round(total_open, 2), '', '', round(total_close, 2)]]
        return _xlsx('Perubahan Ekuitas', ['Kode', 'Akun', 'Saldo Awal', 'Penambahan', 'Pengurangan', 'Saldo Akhir'], data, f'perubahan_ekuitas_{date_from}_{date_to}.xlsx', f'Periode {date_from} s/d {date_to}')
    return jsonify({'period': {'date_from': date_from.isoformat(), 'date_to': date_to.isoformat()}, 'rows': rows,
                    'prior_profit': prior_profit, 'period_profit': period_profit,
                    'total_opening': round(total_open, 2), 'total_closing': round(total_close, 2)}), 200


@finance_reports_bp.route('/generate-pdf', methods=['POST'])
@jwt_required()
@require_permission('finance.view')
def generate_pdf_from_rows():
    """PDF dari baris laporan yang sudah dihitung di layar: body {type, data: {title, data: [{kolom: nilai}], period}}."""
    body = request.get_json(silent=True) or {}
    payload = body.get('data') or {}
    records = payload.get('data') if isinstance(payload, dict) else payload
    if not isinstance(records, list) or not records or not all(isinstance(r, dict) for r in records):
        return jsonify({'error': 'Data laporan kosong atau formatnya tidak dikenali'}), 400
    headers = []
    for r in records:
        for k in r:
            if k not in headers:
                headers.append(k)
    rows = [[r.get(h, '') for h in headers] for r in records]
    meta = payload if isinstance(payload, dict) else {}
    title = str(meta.get('title') or body.get('type') or 'Laporan')[:120]
    period = meta.get('period')
    subtitle = f'Periode {period}' if period else None
    kinds = _col_kinds(headers, rows)
    safe = re.sub(r'[^A-Za-z0-9_.-]+', '_', str(body.get('type') or 'laporan'))[:60]
    return _pdf_file(title, headers, rows, f'{safe}.pdf', subtitle, kinds)


# ------------------------------------------------------------------ inventory reports (mutation per item, qty per warehouse)
# Source: the unified stock ledger (inventory_transactions). Value = total_cost (FIFO cost recorded when the stock moved),
# or quantity x unit_cost; movements that carry no cost count as 0 and are reported in `unvalued_rows`.
# Neutral rows are left out of Masuk/Keluar: status changes (qc_disposition pairs) and, in the all-warehouse view, internal transfers.
_NEUTRAL_QC = ('qc_disposition', 'qc_disposition_out')
_TRANSFER_PAIR = ('transfer_in', 'transfer_out')


def _inv_models():
    from models.product import Material, Product
    from models.warehouse import Inventory, WarehouseLocation, WarehouseZone
    from models.wms_advanced import InventoryTransaction
    return InventoryTransaction, Product, Material, WarehouseZone, WarehouseLocation, Inventory


def _inv_item_key(T):
    return case((T.product_id.isnot(None), T.product_id), else_=-T.material_id)


def _inv_avg_cost():
    """Biaya rata-rata tertimbang penerimaan tiap barang (dari baris masuk yang punya biaya), dipakai untuk menilai baris tanpa biaya."""
    T = _inv_models()[0]
    key = _inv_item_key(T)
    return db.session.query(key.label('k'), (func.sum(T.total_cost) / func.nullif(func.sum(T.quantity), 0)).label('avg')).filter(
        T.direction == 'in', T.total_cost.isnot(None), T.quantity > 0,
        T.transaction_type.notin_(_NEUTRAL_QC + _TRANSFER_PAIR + ('transfer',))).group_by(key).subquery()


def _inv_value_exprs(T, avg=None):
    unit = func.coalesce(func.nullif(T.unit_cost, 0), avg.c.avg if avg is not None else None, 0)
    absval = func.coalesce(T.total_cost, T.quantity * unit)
    sign_q = case((T.direction == 'in', T.quantity), else_=-T.quantity)
    sign_v = case((T.direction == 'in', absval), else_=-absval)
    return absval, sign_q, sign_v


def _inv_loc_expr(T):
    return case((T.direction == 'in', func.coalesce(T.to_location_id, T.from_location_id)),
                else_=func.coalesce(T.from_location_id, T.to_location_id))


def _inv_valid(T, date_to):
    end = datetime.combine(date_to + timedelta(days=1), datetime.min.time())
    return [T.transaction_date < end, db.or_(T.status.is_(None), T.status.notin_(['cancelled', 'void', 'failed'])),
            T.transaction_type.notin_(_NEUTRAL_QC)]


def _inv_items(keys, group=None, q=None):
    _, Product, Material, *_ = _inv_models()
    pids = {k[0] for k in keys if k[0]}
    mids = {k[1] for k in keys if k[1]}
    prods = {p.id: p for p in Product.query.filter(Product.id.in_(pids)).all()} if pids else {}
    mats = {m.id: m for m in Material.query.filter(Material.id.in_(mids)).all()} if mids else {}
    out = {}
    needle = (q or '').strip().lower()
    for k in keys:
        it = prods.get(k[0]) if k[0] else mats.get(k[1])
        if not it:
            continue
        if group and group != 'all' and (it.material_type or '') != group:
            continue
        if needle and needle not in f'{it.code} {it.name}'.lower():
            continue
        out[k] = {'code': it.code, 'name': it.name, 'uom': it.primary_uom, 'group': it.material_type or '', 'kind': 'product' if k[0] else 'material'}
    return out


def _legacy_transfers(date_to):
    """Old single-row 'transfer' movements: +qty at the destination, -qty at the source."""
    T = _inv_models()[0]
    absval = _inv_value_exprs(T)[0]
    rows = db.session.query(T.product_id, T.material_id, T.from_location_id, T.to_location_id, T.quantity, absval, T.transaction_date).filter(
        T.transaction_type == 'transfer', *_inv_valid(T, date_to)[:2]).all()
    return rows


def _inv_group_choices():
    _, Product, Material, *_ = _inv_models()
    return sorted({g for (g,) in db.session.query(Product.material_type).distinct() if g} | {g for (g,) in db.session.query(Material.material_type).distinct() if g})


def _inv_args():
    date_from, date_to = _period()
    zone_id = request.args.get('zone_id', type=int)
    group = request.args.get('group') or 'all'
    q = request.args.get('q') or ''
    hide_zero = request.args.get('hide_zero', 'true').lower() != 'false'
    return date_from, date_to, zone_id, group, q, hide_zero


@finance_reports_bp.route('/inventory-mutation', methods=['GET'])
@jwt_required()
@require_permission('finance.view', 'warehouse.view')
def inventory_mutation():
    """Nilai Persediaan: saldo awal, masuk, keluar, saldo akhir per barang (kuantitas dan nilai)."""
    try:
        date_from, date_to, zone_id, group, q, hide_zero = _inv_args()
    except ValueError as e:
        return _err(e)
    T, _, _, Zone, Loc, Inventory = _inv_models()
    avg = _inv_avg_cost()
    absval, sign_q, sign_v = _inv_value_exprs(T, avg)
    start = datetime.combine(date_from, datetime.min.time())
    in_period = T.transaction_date >= start
    zone_scoped = bool(zone_id)
    if zone_id and not db.session.get(Zone, zone_id):
        return _err('Gudang tidak ditemukan', 404)
    loc_ids = {l.id for l in Loc.query.filter_by(zone_id=zone_id).all()} if zone_id else None

    cols = [T.product_id, T.material_id,
            func.coalesce(func.sum(case((~in_period, sign_q), else_=0)), 0), func.coalesce(func.sum(case((~in_period, sign_v), else_=0)), 0),
            func.coalesce(func.sum(case((db.and_(in_period, T.direction == 'in'), T.quantity), else_=0)), 0),
            func.coalesce(func.sum(case((db.and_(in_period, T.direction == 'in'), absval), else_=0)), 0),
            func.coalesce(func.sum(case((db.and_(in_period, T.direction == 'out'), T.quantity), else_=0)), 0),
            func.coalesce(func.sum(case((db.and_(in_period, T.direction == 'out'), absval), else_=0)), 0)]
    query = db.session.query(*cols).select_from(T).outerjoin(avg, _inv_item_key(T) == avg.c.k).filter(*_inv_valid(T, date_to))
    if zone_scoped:
        query = query.filter(T.transaction_type != 'transfer', _inv_loc_expr(T).in_(loc_ids or [-1]))
    else:
        query = query.filter(T.transaction_type.notin_(('transfer',) + _TRANSFER_PAIR))
    agg = {}
    for pid, mid, ob_q, ob_v, in_q, in_v, out_q, out_v in query.group_by(T.product_id, T.material_id).all():
        agg[(pid, mid)] = [_f(ob_q), _f(ob_v), _f(in_q), _f(in_v), _f(out_q), _f(out_v)]
    if zone_scoped:
        for pid, mid, from_loc, to_loc, qty, val, when in _legacy_transfers(date_to):
            cell = agg.setdefault((pid, mid), [0.0] * 6)
            for loc, sign in ((to_loc, 1), (from_loc, -1)):
                if loc in loc_ids:
                    if when < start:
                        cell[0] += sign * _f(qty)
                        cell[1] += sign * _f(val)
                    elif sign > 0:
                        cell[2] += _f(qty)
                        cell[3] += _f(val)
                    else:
                        cell[4] += _f(qty)
                        cell[5] += _f(val)

    items = _inv_items(list(agg.keys()), group, q)
    system = {}
    check_system = date_to >= get_local_today()
    if check_system:
        sq = db.session.query(Inventory.product_id, Inventory.material_id, func.coalesce(func.sum(Inventory.quantity_on_hand), 0))
        if zone_scoped:
            sq = sq.filter(Inventory.location_id.in_(loc_ids or [-1]))
        system = {(p, m): _f(v) for p, m, v in sq.group_by(Inventory.product_id, Inventory.material_id).all()}
    rows = []
    for key, meta in items.items():
        ob_q, ob_v, in_q, in_v, out_q, out_v = agg[key]
        cq, cv = ob_q + in_q - out_q, ob_v + in_v - out_v
        if hide_zero and all(abs(x) < 0.0005 for x in (ob_q, ob_v, in_q, in_v, out_q, out_v, cq, cv)):
            continue
        row = {**meta, 'opening_qty': round(ob_q, 3), 'opening_value': round(ob_v, 2), 'in_qty': round(in_q, 3), 'in_value': round(in_v, 2),
               'out_qty': round(out_q, 3), 'out_value': round(out_v, 2), 'closing_qty': round(cq, 3), 'closing_value': round(cv, 2)}
        if check_system:
            sysq = system.get(key, 0.0)
            row['system_qty'] = round(sysq, 3)
            row['qty_mismatch'] = abs(sysq - cq) > 0.005
        rows.append(row)
    rows.sort(key=lambda r: (r['name'] or '').lower())
    keys = ('opening_qty', 'opening_value', 'in_qty', 'in_value', 'out_qty', 'out_value', 'closing_qty', 'closing_value')
    totals = {k: round(sum(r[k] for r in rows), 3 if k.endswith('qty') else 2) for k in keys}
    unvalued = db.session.query(func.count(T.id)).select_from(T).outerjoin(avg, _inv_item_key(T) == avg.c.k).filter(
        *_inv_valid(T, date_to), T.total_cost.is_(None), func.coalesce(T.unit_cost, 0) == 0, avg.c.avg.is_(None)).scalar() or 0
    zone = db.session.get(Zone, zone_id) if zone_id else None
    if _wants_xlsx():
        headers = ['Nama Barang', 'Kode Barang', 'Satuan', 'Saldo Awal Kuantitas', 'Saldo Awal Nilai', 'Masuk Kuantitas', 'Masuk Nilai',
                   'Keluar Kuantitas', 'Keluar Nilai', 'Saldo Akhir Kuantitas', 'Saldo Akhir Nilai']
        data = [[r['name'], r['code'], r['uom'], r['opening_qty'], r['opening_value'], r['in_qty'], r['in_value'], r['out_qty'], r['out_value'], r['closing_qty'], r['closing_value']] for r in rows]
        data.append(['TOTAL', '', ''] + [totals[k] for k in keys])
        sub = f'Dari {date_from} s/d {date_to} · Gudang: {zone.name if zone else "Semua Gudang"}'
        return _xlsx('Nilai Persediaan', headers, data, f'nilai_persediaan_{date_from}_{date_to}.xlsx', sub)
    return jsonify({
        'period': {'date_from': date_from.isoformat(), 'date_to': date_to.isoformat()}, 'zone': {'id': zone.id, 'name': zone.name} if zone else None,
        'groups': _inv_group_choices(), 'zones': [{'id': z.id, 'name': z.name} for z in Zone.query.filter(Zone.is_active.is_(True)).order_by(Zone.code).all()],
        'rows': rows, 'totals': totals, 'unvalued_rows': int(unvalued),
        'mismatch_count': sum(1 for r in rows if r.get('qty_mismatch')), 'checked_against_stock': check_system,
    })


@finance_reports_bp.route('/inventory-by-warehouse', methods=['GET'])
@jwt_required()
@require_permission('finance.view', 'warehouse.view')
def inventory_by_warehouse():
    """Kuantitas Barang per Gudang: kuantitas dan total biaya tiap barang di tiap gudang per tanggal."""
    try:
        _, date_to, _, group, q, hide_zero = _inv_args()
    except ValueError as e:
        return _err(e)
    if not request.args.get('date_to'):
        date_to = get_local_today()
    T, _, _, Zone, Loc, _ = _inv_models()
    avg = _inv_avg_cost()
    absval, sign_q, sign_v = _inv_value_exprs(T, avg)
    loc_expr = _inv_loc_expr(T)
    zone_of = {l.id: l.zone_id for l in Loc.query.all()}
    zones = Zone.query.filter(Zone.is_active.is_(True)).order_by(Zone.code).all()
    source = 'ledger'
    if (request.args.get('source') or '').lower() == 'stock':
        if date_to < get_local_today():
            return _err('Sumber "Stok saat ini" hanya untuk hari ini; pilih tanggal hari ini atau gunakan sumber mutasi')
        source = 'stock'
    agg = {}
    rows_q = db.session.query(T.product_id, T.material_id, loc_expr, func.coalesce(func.sum(sign_q), 0), func.coalesce(func.sum(sign_v), 0)).select_from(T).outerjoin(avg, _inv_item_key(T) == avg.c.k).filter(
        *_inv_valid(T, date_to), T.transaction_type != 'transfer').group_by(T.product_id, T.material_id, loc_expr).all()
    for pid, mid, loc, sq_, sv_ in rows_q:
        zid = zone_of.get(loc)
        cell = agg.setdefault((pid, mid), {}).setdefault(zid, [0.0, 0.0])
        cell[0] += _f(sq_)
        cell[1] += _f(sv_)
    for pid, mid, from_loc, to_loc, qty, val, _when in _legacy_transfers(date_to):
        cells = agg.setdefault((pid, mid), {})
        for loc, sign in ((to_loc, 1), (from_loc, -1)):
            cell = cells.setdefault(zone_of.get(loc), [0.0, 0.0])
            cell[0] += sign * _f(qty)
            cell[1] += sign * _f(val)
    if source == 'stock':
        # Stok fisik per lokasi (tabel stok). Biaya per satuan = rata-rata tertimbang penerimaan di buku stok, atau biaya master.
        Inventory = _inv_models()[5]
        _, Product, Material = _inv_models()[:3]
        agg = {}
        for pid, mid, loc, qty_ in db.session.query(Inventory.product_id, Inventory.material_id, Inventory.location_id,
                                                    func.coalesce(func.sum(Inventory.quantity_on_hand), 0)).filter(Inventory.is_active.is_(True)).group_by(
                Inventory.product_id, Inventory.material_id, Inventory.location_id).all():
            agg.setdefault((pid, mid), {}).setdefault(zone_of.get(loc), [0.0, 0.0])[0] += _f(qty_)
        recv = {(p_, m_): (_f(v_), _f(q_)) for p_, m_, v_, q_ in db.session.query(
            T.product_id, T.material_id, func.coalesce(func.sum(absval), 0), func.coalesce(func.sum(T.quantity), 0)).filter(
            T.direction == 'in', T.transaction_type.notin_(_NEUTRAL_QC + _TRANSFER_PAIR + ('transfer',)), T.total_cost.isnot(None)).group_by(T.product_id, T.material_id).all()}
        masters = {}
        for pr in Product.query.filter(Product.id.in_({k[0] for k in agg if k[0]})).all() if any(k[0] for k in agg) else []:
            masters[(pr.id, None)] = _f(pr.cost)
        for ma in Material.query.filter(Material.id.in_({k[1] for k in agg if k[1]})).all() if any(k[1] for k in agg) else []:
            masters[(None, ma.id)] = _f(ma.cost_per_unit)
        for key, cells in agg.items():
            tv, tq = recv.get(key, (0.0, 0.0))
            unit = (tv / tq) if tq > 0 else masters.get(key, 0.0)
            for cell in cells.values():
                cell[1] = cell[0] * unit
    items = _inv_items(list(agg.keys()), group, q)
    zone_ids = [z.id for z in zones]
    rows = []
    for key, meta in items.items():
        by_zone = {}
        total_q = total_v = 0.0
        for zid in zone_ids:
            cq, cv = agg[key].get(zid, [0.0, 0.0])
            by_zone[str(zid)] = {'qty': round(cq, 3), 'value': round(cv, 2)}
            total_q += cq
            total_v += cv
        # stock sitting on locations without a warehouse is still part of the total
        for zid, (cq, cv) in agg[key].items():
            if zid not in zone_ids:
                total_q += cq
                total_v += cv
        if hide_zero and abs(total_q) < 0.0005 and abs(total_v) < 0.005 and all(abs(z['qty']) < 0.0005 for z in by_zone.values()):
            continue
        rows.append({**meta, 'by_zone': by_zone, 'total_qty': round(total_q, 3), 'total_value': round(total_v, 2)})
    rows.sort(key=lambda r: (r['name'] or '').lower())
    zone_totals = {str(zid): {'qty': round(sum(r['by_zone'][str(zid)]['qty'] for r in rows), 3), 'value': round(sum(r['by_zone'][str(zid)]['value'] for r in rows), 2)} for zid in zone_ids}
    totals = {'qty': round(sum(r['total_qty'] for r in rows), 3), 'value': round(sum(r['total_value'] for r in rows), 2)}
    if _wants_xlsx():
        headers = ['Nama Barang', 'Kode Barang', 'Satuan']
        for z in zones:
            headers += [f'{z.name} Kuantitas', f'{z.name} Total Biaya']
        headers += ['TOTAL Kuantitas', 'TOTAL Biaya']
        data = []
        for r in rows:
            line = [r['name'], r['code'], r['uom']]
            for z in zones:
                line += [r['by_zone'][str(z.id)]['qty'], r['by_zone'][str(z.id)]['value']]
            data.append(line + [r['total_qty'], r['total_value']])
        foot = ['TOTAL', '', '']
        for z in zones:
            foot += [zone_totals[str(z.id)]['qty'], zone_totals[str(z.id)]['value']]
        data.append(foot + [totals['qty'], totals['value']])
        return _xlsx('Kuantitas Barang per Gudang', headers, data, f'kuantitas_barang_per_gudang_{date_to}.xlsx', f'Per tanggal {date_to}')
    return jsonify({'as_of': date_to.isoformat(), 'source': source, 'zones': [{'id': z.id, 'code': z.code, 'name': z.name} for z in zones], 'groups': _inv_group_choices(),
                    'rows': rows, 'zone_totals': zone_totals, 'totals': totals})
