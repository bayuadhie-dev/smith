"""
Shared helpers for posting approved journal entries to the General Ledger.

Root-cause fix (2026-08-14 audit): AccountingEntry has NO `lines_data` column.
The old pattern of writing `gl_entry.lines_data = [...]` silently discarded
debit/credit data on flush. AccountingEntry is a FLAT table — one row per
account per journal line — so a pending journal with N lines must produce
N AccountingEntry rows, not one row with an embedded array.
"""
from datetime import datetime
from models import db
from models.finance import AccountingEntry, Account
from models.approval_workflow import PendingJournalEntry
from utils.helpers import generate_number


_CLASSIFY_PREFIX_MAP = {'1': 'asset', '2': 'liability', '3': 'equity', '4': 'revenue'}
_CLASSIFY_EXPENSE_PREFIXES = ('5', '6', '7', '8', '9')
_CLASSIFY_VALID_BUCKETS = {'asset', 'liability', 'equity', 'revenue', 'expense'}


def classify_account(account):
    """
    Single source of truth for "which top-level bucket does this account
    belong to" (asset/liability/equity/revenue/expense), shared by
    get_balance_sheet() and get_income_statement() (routes/finance.py).

    Before this (fix_report_3.md): both reports classified accounts by
    hand-maintained account_code PREFIX lists ('4-' = revenue, '5-'/'6-' =
    expense, etc). Twice in production this went stale - a real '7-1000'
    Beban Gaji account and a real '2-1210' Hutang PPN account each existed
    for a while without matching any prefix branch the code checked,
    silently excluding them from the Neraca until someone happened to
    notice the imbalance (see fix_report_2.md Fase 11). A 3rd, previously
    UNNOTICED instance of the same class of bug: get_balance_sheet()'s
    current-year-earnings calculation only ever summed prefixes '5-'/'6-'/
    '7-' for expense, never '8-'/'9-' - which get_income_statement() DOES
    include - so the two reports could silently disagree on net income
    for any company whose chart of accounts posts to an 8-xxxx/9-xxxx
    expense account (this repo's own CoA has exactly that: '9-1000' Beban
    Bunga). Routing both reports through this one function closes all 3
    gaps at once and prevents a 4th recurrence for any future prefix.

    Primary source of truth: Account.account_type (set per real account
    row, not inferred) - verified against erp_db 2026-10-02: every active
    account's account_type matches the obvious prefix (1=asset, 2=
    liability, 3=equity, 4=revenue, 5-9=expense), 0 exceptions. Falls back
    to the account_code prefix ONLY when account_type is missing/invalid -
    a safety net for stray fixture data, not the primary mechanism.

    Returns one of 'asset', 'liability', 'equity', 'revenue', 'expense',
    or None if the account cannot be classified at all (no usable
    account_type AND an account_code that doesn't start with a digit
    1-9 - should not happen for any real account, but code should never
    crash on it, just report it as unclassified).
    """
    if account.account_type in _CLASSIFY_VALID_BUCKETS:
        return account.account_type

    code = (account.account_code or '').strip()
    first = code[:1]
    if first in _CLASSIFY_PREFIX_MAP:
        return _CLASSIFY_PREFIX_MAP[first]
    if first in _CLASSIFY_EXPENSE_PREFIXES:
        return 'expense'
    return None


def post_pending_journal(pending_journal_id, posted_by_user_id=None, reference_type='pending_journal', reference_id=None):
    """
    Promote an approved PendingJournalEntry into real AccountingEntry rows.

    For each line in PendingJournalEntry.lines (JSON array of
    {account_id, debit, credit, description}), creates one AccountingEntry
    row. All rows from the same pending journal share one base entry_number
    (suffixed -01, -02, ...) and are linked back via reference_type/
    reference_id so they can be queried as a group later.

    Returns the list of created AccountingEntry objects.
    Raises ValueError if the pending journal or its lines are invalid.
    """
    pending = PendingJournalEntry.query.get(pending_journal_id)
    if not pending:
        raise ValueError(f"PendingJournalEntry {pending_journal_id} not found")

    if not pending.lines:
        raise ValueError(f"PendingJournalEntry {pending_journal_id} has no lines")

    # One shared base number for this journal, per-line suffix keeps
    # entry_number unique while keeping the group visually together.
    #
    # NOTE: generate_number()'s built-in last-number lookup does a plain
    # .order_by(field.desc()) STRING sort on entry_number, which is wrong
    # here because our numbers have a "-01"/"-02" line suffix appended
    # (e.g. "JE-202608-00003-02"). String-sorting picks the highest suffix,
    # not the highest base sequence, and int(last.split('-')[-1]) then
    # parses the SUFFIX digit (e.g. "02") instead of the base sequence
    # ("00003") - producing a base_number that collides with one already
    # in use. Confirmed via live testing 2026-08-17 (Payroll approval hit
    # a UniqueViolation on JE-202608-00003-01, already used by a
    # recurring_payment entry). Fix: derive the next sequence ourselves by
    # looking only at the BASE part (before the line-suffix) of entries
    # from the current year+month, sorted numerically.
    year_month = datetime.utcnow().strftime('%Y%m')
    prefix_pattern = f'JE-{year_month}-'
    existing_bases = db.session.query(AccountingEntry.entry_number).filter(
        AccountingEntry.entry_number.like(f'{prefix_pattern}%')
    ).all()
    max_seq = 0
    for (entry_number,) in existing_bases:
        # entry_number looks like "JE-202608-00003-01" - the base sequence
        # is the segment right after the year_month prefix, before the
        # next "-" (the line suffix).
        rest = entry_number[len(prefix_pattern):]
        seq_part = rest.split('-')[0]
        try:
            seq = int(seq_part)
            if seq > max_seq:
                max_seq = seq
        except ValueError:
            continue
    base_number = f'{prefix_pattern}{max_seq + 1:05d}'

    created_entries = []
    total_debit = 0
    total_credit = 0

    for idx, line in enumerate(pending.lines, start=1):
        account_id = line.get('account_id')
        if not account_id:
            raise ValueError(
                f"PendingJournalEntry {pending_journal_id} line {idx} missing account_id"
            )

        account = Account.query.get(account_id)
        if not account:
            raise ValueError(
                f"PendingJournalEntry {pending_journal_id} line {idx}: "
                f"account_id {account_id} not found"
            )

        if account.is_header:
            raise ValueError(
                f"PendingJournalEntry {pending_journal_id} line {idx}: "
                f"account_id {account_id} ({account.account_code}) is a header "
                f"account and cannot receive direct postings"
            )

        debit = line.get('debit', 0) or 0
        credit = line.get('credit', 0) or 0

        entry = AccountingEntry(
            entry_number=f"{base_number}-{idx:02d}",
            entry_date=pending.entry_date,
            entry_type='general',
            reference_type=reference_type,
            reference_id=reference_id if reference_id is not None else pending.id,
            reference_number=pending.reference,
            account_id=account.id,
            account_code=account.account_code,
            account_name=account.account_name,
            debit_amount=debit,
            credit_amount=credit,
            description=line.get('description') or pending.description,
            status='posted',
            posted_by=posted_by_user_id,
            posted_at=datetime.utcnow(),
        )
        db.session.add(entry)
        created_entries.append(entry)
        total_debit += float(debit)
        total_credit += float(credit)

    # Sanity check: journal must balance before we commit it.
    if round(total_debit, 2) != round(total_credit, 2):
        raise ValueError(
            f"PendingJournalEntry {pending_journal_id} does not balance: "
            f"debit={total_debit} credit={total_credit}"
        )

    return created_entries


def reverse_accounting_entries(reference_type, reference_id, entry_date, user_id,
                                description=None, new_reference_type=None):
    """
    Post a reversing journal for every posted AccountingEntry tagged with
    the given (reference_type, reference_id) - i.e. the original journal
    created by post_pending_journal(..., reference_type=X, reference_id=Y).

    Used by void/cancel flows (Fase 3 audit fix, 2026-09-30: Sales Invoice,
    Purchase Invoice, Payment) so a void always produces a real, balanced
    reversing journal instead of silently leaving the original posting in
    place. Debit and credit are swapped per account (summed if an account
    appears on multiple original lines), and a fresh PendingJournalEntry +
    AccountingEntry set is posted with new_reference_type (defaults to
    'void_<reference_type>') tagged to the SAME reference_id, so the void's
    journal is easy to find via the same reference_id used for the original.

    The original entries are left at status='posted', UNCHANGED (2026-10-22
    fix - this function used to also flip them to status='reversed', which
    every balance query (_account_balance_in_range, year_balance, etc.)
    already excludes via its own `status == 'posted'` filter. Flipping the
    original on top of posting an explicit reversing entry double-subtracted
    the same amount: once by excluding the original, once by the reversing
    entry's opposite-sign posting - caught live when a voided-and-recreated
    Rp54.000.000 invoice made the Income Statement's 4-1000 balance come out
    Rp54.000.000 LOWER than the Laporan Penjualan's independently-computed
    total for the identical period. Standard double-entry practice is to
    never alter a posted entry's own record - only ever post a new entry
    that nets against it - which is also what makes a date-ranged report
    correctly show the original's effect on its own date and the reversal's
    effect on the void date, rather than erasing history.

    Returns the list of created (reversing) AccountingEntry objects, or an
    empty list if there was nothing posted to reverse (not an error - some
    callers may void something that never had GL impact).

    Raises ValueError if reference_id is falsy or a resolved account is
    missing (shouldn't happen since these accounts were valid to post the
    original journal).
    """
    if not reference_id:
        raise ValueError('reverse_accounting_entries: reference_id wajib diisi')

    original_entries = AccountingEntry.query.filter_by(
        reference_type=reference_type, reference_id=reference_id, status='posted',
    ).all()
    if not original_entries:
        return []

    from models.approval_workflow import PendingJournalEntry

    totals_by_account = {}
    for entry in original_entries:
        acc_id = entry.account_id
        if acc_id not in totals_by_account:
            totals_by_account[acc_id] = {'debit': 0.0, 'credit': 0.0}
        totals_by_account[acc_id]['debit'] += float(entry.debit_amount or 0)
        totals_by_account[acc_id]['credit'] += float(entry.credit_amount or 0)

    reversal_lines = []
    for acc_id, totals in totals_by_account.items():
        net = totals['debit'] - totals['credit']
        if net == 0:
            continue
        reversal_lines.append({
            'account_id': acc_id,
            # swap: what was originally debited gets credited back, and
            # vice versa
            'debit': max(-net, 0),
            'credit': max(net, 0),
            'description': description or f'Pembalikan jurnal {reference_type} #{reference_id}',
        })

    if not reversal_lines:
        # original entries net to zero already (shouldn't normally happen
        # for a balanced journal unless every line was on the same
        # account) - nothing to post. Re-void idempotency is the caller's
        # job (Invoice.status/Payment.status == 'cancelled' guard), not
        # this function's - see the 2026-10-22 note on why original_entries
        # is never mutated here.
        return []

    pending = PendingJournalEntry(
        workflow_id=None,
        entry_date=entry_date,
        description=description or f'Pembalikan jurnal {reference_type} #{reference_id}',
        reference=f'VOID-{reference_type}-{reference_id}',
        lines=reversal_lines,
        total_debit=sum(l['debit'] for l in reversal_lines),
        total_credit=sum(l['credit'] for l in reversal_lines),
        created_by=user_id,
    )
    db.session.add(pending)
    db.session.flush()

    created = post_pending_journal(
        pending.id, posted_by_user_id=user_id,
        reference_type=new_reference_type or f'void_{reference_type}',
        reference_id=reference_id,
    )

    return created


def resolve_account(slot_name, product_id=None, category_id=None):
    """
    Resolve an account_id for a given "slot" (e.g. 'akun_hpp_id') using the
    3-level fallback: item override (Product) -> category default
    (CategoryAccountDefault) -> global default (GlobalAccountDefault).

    Args:
        slot_name (str): one of the 9 slot column names, e.g. 'akun_hpp_id',
            'akun_persediaan_id', 'akun_penjualan_id', etc.
        product_id (int, optional): Product.id to check for an item-level override.
        category_id (int, optional): product_categories.id to check for a
            category-level default. If not given but product_id is, the
            product's own category_id is used automatically.

    Returns:
        int: resolved account_id.

    Raises:
        ValueError: if slot_name is invalid, or no account can be resolved
            at any of the 3 levels (item, category, global).
    """
    from models.product import Product
    from models.finance import CategoryAccountDefault, GlobalAccountDefault

    valid_slots = {
        'akun_persediaan_id', 'akun_penjualan_id', 'akun_retur_penjualan_id',
        'akun_diskon_penjualan_id', 'akun_barang_terkirim_id', 'akun_hpp_id',
        'akun_retur_pembelian_id', 'akun_beban_id', 'akun_pembelian_belum_tertagih_id',
    }
    if slot_name not in valid_slots:
        raise ValueError(f"resolve_account: unknown slot_name '{slot_name}'")

    # Level 1: item override
    if product_id:
        product = Product.query.get(product_id)
        if product:
            account_id = getattr(product, slot_name, None)
            if account_id:
                return account_id
            # If category_id wasn't explicitly passed, fall back to the
            # product's own category for level 2.
            if category_id is None:
                category_id = product.category_id

    # Level 2: category default
    if category_id:
        cat_default = CategoryAccountDefault.query.filter_by(category_id=category_id).first()
        if cat_default:
            account_id = getattr(cat_default, slot_name, None)
            if account_id:
                return account_id

    # Level 3: global default. GlobalAccountDefault is keyed by transaction_key
    # (a string), not by the 9 slot names directly - slot_name doubles as the
    # transaction_key for item-related postings (e.g. 'akun_hpp_id').
    global_default = GlobalAccountDefault.query.filter_by(transaction_key=slot_name).first()
    if global_default:
        return global_default.account_id

    raise ValueError(
        f"resolve_account: could not resolve '{slot_name}' for "
        f"product_id={product_id}, category_id={category_id} - "
        f"no item override, category default, or global default found"
    )


def resolve_payroll_account(transaction_key):
    """
    Resolve an account_id for a payroll GL slot (e.g. 'payroll_expense',
    'payroll_tax_payable'). Payroll has no per-item/per-category override -
    it's company-wide, so this is a direct GlobalAccountDefault lookup
    (same 1-level pattern as resolve_accounts_payable's global fallback).

    Args:
        transaction_key (str): one of the 6 payroll transaction keys.

    Returns:
        int: resolved account_id.

    Raises:
        ValueError: if no GlobalAccountDefault is configured for this key.
    """
    from models.finance import GlobalAccountDefault

    valid_keys = {
        'payroll_expense', 'payroll_pph21_expense', 'payroll_tax_payable',
        'payroll_insurance_payable', 'payroll_pension_payable',
        'payroll_other_deduction_payable', 'payroll_net_payable',
    }
    if transaction_key not in valid_keys:
        raise ValueError(f"resolve_payroll_account: unknown transaction_key '{transaction_key}'")

    global_default = GlobalAccountDefault.query.filter_by(transaction_key=transaction_key).first()
    if global_default:
        return global_default.account_id

    raise ValueError(
        f"resolve_payroll_account: '{transaction_key}' belum diatur di "
        f"Preferensi Akun (GlobalAccountDefault) - tab Perusahaan"
    )


class PayrollPaymentError(ValueError):
    pass


def post_payroll_payment_journal(record, payment_date, bank_account_id=None, posted_by_user_id=None):
    """Journal for actually paying one payroll record's net salary:
        Dr Hutang Gaji (payroll_net_payable)   net_salary
            Cr Kas/Bank                         net_salary
    Idempotent per record (reference_type='payroll_payment'). Kas/Bank comes from
    bank_account_id, else the global 'cash' default. Returns the posted entries
    (empty list when already posted or nothing to pay)."""
    from models import db
    from models.finance import AccountingEntry, Account, GlobalAccountDefault
    from models.approval_workflow import PendingJournalEntry

    amount = float(record.net_salary or 0)
    if amount <= 0:
        return []
    if AccountingEntry.query.filter_by(reference_type='payroll_payment', reference_id=record.id, status='posted').first():
        return []

    if is_period_locked(payment_date, transaction_type='payroll'):
        raise PayrollPaymentError(f'Periode {payment_date.strftime("%Y-%m")} sudah ditutup (period-close), pembayaran gaji tidak bisa dicatat.')

    if bank_account_id:
        bank = db.session.get(Account, int(bank_account_id))
        if not bank or not bank.is_cash_bank:
            raise PayrollPaymentError('bank_account_id harus akun Kas/Bank')
        bank_id = bank.id
    else:
        default = GlobalAccountDefault.query.filter_by(transaction_key='cash').first()
        if not default:
            raise PayrollPaymentError('Pilih akun Kas/Bank untuk pembayaran gaji (bank_account_id), atau atur akun "cash" di Preferensi Akun.')
        bank_id = default.account_id

    lines = [
        {'account_id': resolve_payroll_account('payroll_net_payable'), 'debit': amount, 'credit': 0,
         'description': f'Pembayaran gaji - record #{record.id}'},
        {'account_id': bank_id, 'debit': 0, 'credit': amount,
         'description': f'Pembayaran gaji - record #{record.id}'},
    ]
    pending = PendingJournalEntry(
        workflow_id=None, entry_date=payment_date,
        description=f'Pembayaran gaji record #{record.id}', reference=f'PAYROLL-PAY-{record.id}',
        lines=lines, total_debit=amount, total_credit=amount, created_by=posted_by_user_id,
    )
    db.session.add(pending)
    db.session.flush()
    return post_pending_journal(pending.id, posted_by_user_id=posted_by_user_id,
                                reference_type='payroll_payment', reference_id=record.id)


def post_payroll_journal(period, records, posted_by_user_id=None):
    """
    Post one combined journal entry for an entire PayrollPeriod, summing
    across all its PayrollRecord rows (Accurate's pattern: one payroll
    posting form covers all employees, not one journal per employee).

    Journal structure (Metode Net - PPh 21 ditanggung perusahaan, tidak
    dipotong dari gaji karyawan; lihat calculate_employee_payroll()):
        Dr  Beban Gaji                          sum(gross_salary - absence_deduction)
        Dr  Beban PPh 21 Ditanggung Perusahaan   sum(tax_deduction)
            Cr  Hutang PPh 21                        sum(tax_deduction)
            Cr  Hutang BPJS Kesehatan                sum(insurance_deduction)
            Cr  Hutang BPJS Ketenagakerjaan (JHT)     sum(pension_deduction)
            Cr  Hutang Potongan Lain                 sum(other_deductions)
            Cr  Hutang Gaji Karyawan (net)            sum(net_salary)

    Args:
        period (PayrollPeriod): the period being approved.
        records (list[PayrollRecord]): all records belonging to this period.
        posted_by_user_id (int, optional): user approving the period.

    Returns:
        list[AccountingEntry]: the created GL rows.

    Raises:
        ValueError: if any of the 6 payroll accounts aren't configured yet,
            or if the resulting journal doesn't balance.
    """
    from models.approval_workflow import PendingJournalEntry
    from models.finance import Account

    # Direct factory labor vs administrative salary split (2026-10-22) -
    # previously ALL payroll posted to one account (7-1000 Beban Gaji),
    # miscategorizing piecework/daily-rate factory floor wages as
    # administrative expense instead of Cost of Sales. User-confirmed rule:
    # pay_type 'piecework' (Borongan) or 'daily' (Harian) -> direct labor
    # COGS, posted as TWO separate lines per user request (not combined):
    # base wage -> 5-1210 HPP - Upah Borongan, allowances -> 5-1220 HPP -
    # Tunjangan Karyawan Langsung (both children of 5-1200). Everyone else
    # (monthly/fixed/weekly/outsourcing, incl. factory supervisors/managers
    # who are salaried) stays as administrative Beban Gaji, unchanged.
    DIRECT_LABOR_PAY_TYPES = {'piecework', 'daily'}

    def is_direct_labor(r):
        return bool(r.employee and r.employee.pay_type in DIRECT_LABOR_PAY_TYPES)

    # Upah (base wage): basic_salary + overtime, net of attendance deduction.
    # Tunjangan (allowances): position + transport allowance, tracked
    # separately on the model (not reduced by absence_deduction - allowances
    # are typically paid regardless of days absent in this system's
    # calculate_employee_payroll()).
    total_upah_langsung = sum(
        float(r.basic_salary + r.overtime_amount - r.absence_deduction)
        for r in records if is_direct_labor(r)
    )
    total_tunjangan_langsung = sum(
        float(r.allowances) for r in records if is_direct_labor(r)
    )
    total_gaji_admin = sum(
        float(r.gross_salary - r.absence_deduction) for r in records
        if not is_direct_labor(r)
    )
    total_gaji = total_upah_langsung + total_tunjangan_langsung + total_gaji_admin
    total_pph21 = sum(float(r.tax_deduction) for r in records)
    total_bpjs_kesehatan = sum(float(r.insurance_deduction) for r in records)
    total_bpjs_tk = sum(float(r.pension_deduction) for r in records)
    total_potongan_lain = sum(float(r.other_deductions) for r in records)
    total_net = sum(float(r.net_salary) for r in records)

    lines = []

    upah_account = Account.query.filter_by(account_code='5-1210').first()
    tunjangan_account = Account.query.filter_by(account_code='5-1220').first()
    if not upah_account or not tunjangan_account:
        # Sub-accounts missing (e.g. migration not yet applied on this
        # environment) - fall back to the old single-account behavior
        # rather than silently dropping this portion of payroll.
        total_gaji_admin += total_upah_langsung + total_tunjangan_langsung
        total_upah_langsung = total_tunjangan_langsung = 0

    if total_upah_langsung > 0:
        lines.append({
            'account_id': upah_account.id,
            'debit': total_upah_langsung, 'credit': 0,
            'description': f'HPP - Upah Borongan - {period.period_name}',
        })
    if total_tunjangan_langsung > 0:
        lines.append({
            'account_id': tunjangan_account.id,
            'debit': total_tunjangan_langsung, 'credit': 0,
            'description': f'HPP - Tunjangan Karyawan Langsung - {period.period_name}',
        })
    if total_gaji_admin > 0:
        lines.append({
            'account_id': resolve_payroll_account('payroll_expense'),
            'debit': total_gaji_admin, 'credit': 0,
            'description': f'Beban Gaji - {period.period_name}',
        })
    if total_pph21 > 0:
        lines.append({
            'account_id': resolve_payroll_account('payroll_pph21_expense'),
            'debit': total_pph21, 'credit': 0,
            'description': f'Beban PPh 21 DTP - {period.period_name}',
        })
        lines.append({
            'account_id': resolve_payroll_account('payroll_tax_payable'),
            'debit': 0, 'credit': total_pph21,
            'description': f'Hutang PPh 21 - {period.period_name}',
        })
    if total_bpjs_kesehatan > 0:
        lines.append({
            'account_id': resolve_payroll_account('payroll_insurance_payable'),
            'debit': 0, 'credit': total_bpjs_kesehatan,
            'description': f'Hutang BPJS Kesehatan - {period.period_name}',
        })
    if total_bpjs_tk > 0:
        lines.append({
            'account_id': resolve_payroll_account('payroll_pension_payable'),
            'debit': 0, 'credit': total_bpjs_tk,
            'description': f'Hutang BPJS Ketenagakerjaan - {period.period_name}',
        })
    if total_potongan_lain > 0:
        lines.append({
            'account_id': resolve_payroll_account('payroll_other_deduction_payable'),
            'debit': 0, 'credit': total_potongan_lain,
            'description': f'Hutang Potongan Lain - {period.period_name}',
        })
    if total_net > 0:
        lines.append({
            'account_id': resolve_payroll_account('payroll_net_payable'),
            'debit': 0, 'credit': total_net,
            'description': f'Hutang Gaji Karyawan (net) - {period.period_name}',
        })

    if not lines:
        raise ValueError(f"post_payroll_journal: period {period.id} has no non-zero amounts to post")

    pending = PendingJournalEntry(
        workflow_id=None,
        entry_date=period.end_date,
        description=f'Payroll {period.period_name}',
        reference=f'PAYROLL-{period.id}',
        lines=lines,
        total_debit=total_gaji + total_pph21,
        total_credit=total_pph21 + total_bpjs_kesehatan + total_bpjs_tk + total_potongan_lain + total_net,
        created_by=posted_by_user_id,
    )
    db.session.add(pending)
    db.session.flush()

    return post_pending_journal(
        pending.id,
        posted_by_user_id=posted_by_user_id,
        reference_type='payroll_period',
        reference_id=period.id,
    )


def get_or_create_singleton(model_class):
    """
    Get the single row of a "single-row config table" (e.g. SalesAccountSettings,
    TaxAccountSettings), creating it with all-default values if it doesn't exist
    yet. These tables never have more than one row - there's no natural key to
    filter by, so callers always want "the row" rather than "a specific row".
    """
    row = model_class.query.first()
    if not row:
        row = model_class()
        db.session.add(row)
        db.session.commit()
    return row


def resolve_accounts_payable(supplier_id):
    """
    Resolve the accounts payable (Akun Hutang Usaha) account_id for a given
    supplier. Per Accurate's pattern, this is set per-supplier (not per-
    module), with a 2-level fallback: supplier override -> global default.

    Args:
        supplier_id (int): Supplier.id to check for an override.

    Returns:
        int: resolved account_id.

    Raises:
        ValueError: if no account can be resolved at either level.
    """
    from models.purchasing import Supplier
    from models.finance import GlobalAccountDefault

    supplier = Supplier.query.get(supplier_id)
    if supplier and supplier.akun_hutang_usaha_id:
        return supplier.akun_hutang_usaha_id

    global_default = GlobalAccountDefault.query.filter_by(transaction_key='accounts_payable').first()
    if global_default:
        return global_default.account_id

    raise ValueError(
        f"resolve_accounts_payable: could not resolve accounts payable account for "
        f"supplier_id={supplier_id} - no supplier override or global default found"
    )


def apply_customer_deposit(invoice):
    """
    Auto-apply available customer deposit balance(s) to an invoice, oldest
    deposit first (FIFO), up to the invoice's total_amount. Per Bayu's
    2026-08-16 decision, deposits are a free-floating balance per customer
    (not tied to a specific Sales Order), consumed automatically whenever
    an invoice for that customer is created - matching Accurate's behavior
    of auto-deducting uang muka pelanggan from new invoices.

    Mutates invoice.balance_due in place (reduces it by the amount applied)
    and creates CustomerDepositUsage rows + updates CustomerDeposit.amount_used
    for whatever deposits were drawn from. Does NOT commit - caller is
    expected to commit alongside the rest of the invoice creation.

    Returns the total amount applied (float, 0 if no deposits available or
    invoice has no customer_id).
    """
    from models import db
    from models.sales import CustomerDeposit, CustomerDepositUsage

    if not invoice.customer_id:
        return 0

    remaining_to_apply = float(invoice.balance_due or invoice.total_amount or 0)
    if remaining_to_apply <= 0:
        return 0

    deposits = (
        CustomerDeposit.query
        .filter_by(customer_id=invoice.customer_id)
        .order_by(CustomerDeposit.deposit_date.asc(), CustomerDeposit.id.asc())
        .all()
    )

    total_applied = 0
    for deposit in deposits:
        if remaining_to_apply <= 0:
            break

        available = float(deposit.amount) - float(deposit.amount_used)
        if available <= 0:
            continue

        amount_to_use = min(available, remaining_to_apply)

        usage = CustomerDepositUsage(
            deposit_id=deposit.id,
            invoice_id=invoice.id,
            amount_applied=amount_to_use,
        )
        db.session.add(usage)

        deposit.amount_used = float(deposit.amount_used) + amount_to_use
        remaining_to_apply -= amount_to_use
        total_applied += amount_to_use

    if total_applied > 0:
        invoice.balance_due = float(invoice.balance_due or invoice.total_amount or 0) - total_applied
        invoice.credit_applied = float(invoice.credit_applied or 0) + total_applied

    return total_applied


def apply_credit_to_invoice(invoice, amount):
    """Apply a non-cash credit (e.g. a sales return) to an invoice so the
    invoice subledger follows the GL: balance_due = total - paid - credit.
    Credit beyond what is still owed is NOT tracked on the invoice (it is a
    customer credit; the GL AR account carries it as a credit balance)."""
    amount = float(amount or 0)
    if amount <= 0 or invoice is None or invoice.status == 'cancelled':
        return 0.0
    invoice.credit_applied = float(invoice.credit_applied or 0) + amount
    invoice.balance_due = max(0.0, float(invoice.total_amount or 0) - float(invoice.paid_amount or 0) - float(invoice.credit_applied or 0))
    if invoice.balance_due <= 0.005:
        invoice.status = 'paid'
    elif invoice.status in ('draft', 'sent'):
        invoice.status = 'partial'
    return amount


def get_negative_stock_items():
    """Daftar item Inventory dengan quantity_on_hand < 0, untuk ditampilkan
    sebagai PERINGATAN (bukan blocker keras) saat closing (2026-09-28,
    Accurate-style guard rail yang tadinya sengaja ditunda).

    ADVISORY, BUKAN HARD BLOCK - sengaja: quantity_on_hand punya known
    accuracy issue pre-existing di sistem ini (dicatat di
    close_accounting_period() sebelum perbaikan ini) yang belum diperbaiki
    secara terpisah. Memblokir closing keras berdasarkan data yang sendiri
    belum tentu akurat berisiko mengunci proses closing berdasarkan angka
    palsu. Endpoint tetap MENAMPILKAN daftar ini supaya finance tahu &
    bisa putuskan sendiri (lanjut atau investigasi dulu), tanpa sistem
    memaksa satu arah berdasarkan data yang belum terpercaya."""
    from models.warehouse import Inventory
    from models.product import Product, Material

    negative = Inventory.query.filter(Inventory.quantity_on_hand < 0).all()
    result = []
    for inv in negative:
        item_name = None
        if inv.product_id:
            product = db.session.get(Product, inv.product_id)
            item_name = product.name if product else f'Product #{inv.product_id}'
        elif inv.material_id:
            material = db.session.get(Material, inv.material_id)
            item_name = material.name if material else f'Material #{inv.material_id}'
        result.append({
            'inventory_id': inv.id,
            'item_name': item_name or '(tidak diketahui)',
            'location_id': inv.location_id,
            'quantity_on_hand': float(inv.quantity_on_hand),
            'batch_number': getattr(inv, 'batch_number', None),
        })
    return result


def run_monthly_depreciation(period_year, period_month, posted_by_user_id=None):
    """
    Compute and post monthly depreciation for all active Assets
    (models.asset_management.Asset - consolidated 2026-09-17 from the old,
    now-retired FixedAsset model, which this used to read from), mirroring
    Accurate's "Proses Akhir Bulan" (Period End) behavior of auto-generating
    depreciation journals each month.

    For each active asset (straight_line AND declining_balance both
    supported - Asset.annual_depreciation computes both), posts:
        Debit: Beban Penyusutan (depreciation_expense)
        Credit: Akumulasi Penyusutan (accumulated_depreciation)
    for 1/12th of the asset's annual depreciation, increments the asset's
    own accumulated_depreciation field to match, and records one
    DepreciationSchedule row per asset (book_type='commercial', is_posted=True,
    linked to the AccountingEntry actually created) for traceability. Skips
    (does not post, does not error) any asset already fully depreciated (net
    book value <= salvage value).

    This does NOT check for a duplicate run in the same period - callers
    (the period-end endpoint) are responsible for guarding against running
    this twice for the same month.

    Returns a dict summary: {'assets_processed': int, 'total_depreciation': float, 'skipped': int}.
    """
    from datetime import date
    import calendar
    from models import db
    from models.finance import GlobalAccountDefault
    from models.asset_management import Asset, DepreciationSchedule
    from models.approval_workflow import PendingJournalEntry

    depreciation_default = GlobalAccountDefault.query.filter_by(transaction_key='depreciation_expense').first()
    accumulated_default = GlobalAccountDefault.query.filter_by(transaction_key='accumulated_depreciation').first()
    if not depreciation_default or not accumulated_default:
        raise ValueError(
            "run_monthly_depreciation: Akun Beban Penyusutan atau Akumulasi Penyusutan "
            "belum diatur di Preferensi Akun (GlobalAccountDefault)"
        )

    assets = Asset.query.filter_by(status='active').all()
    last_day = calendar.monthrange(period_year, period_month)[1]
    period_end_date = date(period_year, period_month, last_day)

    journal_lines = []
    posted_assets = []
    total_depreciation = 0
    assets_processed = 0
    skipped = 0

    # Idempoten: aset yang jadwal penyusutannya untuk periode ini SUDAH
    # diposting dilewati. Tanpa ini, menutup ulang periode yang pernah dibuka
    # kembali menghitung penyusutan dobel / gagal 500 di constraint unik
    # (asset_id, period_date, book_type).
    already_posted_ids = {
        row.asset_id for row in DepreciationSchedule.query.filter_by(
            period_date=period_end_date, book_type='commercial', is_posted=True
        ).all()
    }

    for asset in assets:
        if asset.id in already_posted_ids:
            skipped += 1
            continue
        monthly_depreciation = float(asset.annual_depreciation) / 12
        if monthly_depreciation <= 0:
            skipped += 1
            continue

        remaining_depreciable = asset.net_book_value - float(asset.salvage_value or 0)
        if remaining_depreciable <= 0:
            skipped += 1
            continue

        # Don't depreciate past salvage value in the final partial month.
        amount = min(monthly_depreciation, remaining_depreciable)

        asset.accumulated_depreciation = float(asset.accumulated_depreciation or 0) + amount
        total_depreciation += amount
        assets_processed += 1
        posted_assets.append((asset, amount))

        journal_lines.append({
            'account_id': depreciation_default.account_id,
            'debit': amount,
            'credit': 0,
            'description': f'Penyusutan {asset.asset_code} - {period_year}-{period_month:02d}',
        })
        journal_lines.append({
            'account_id': accumulated_default.account_id,
            'debit': 0,
            'credit': amount,
            'description': f'Penyusutan {asset.asset_code} - {period_year}-{period_month:02d}',
        })

    if journal_lines:
        pending = PendingJournalEntry(
            workflow_id=None,
            entry_date=period_end_date,
            description=f'Penyusutan Bulanan - {period_year}-{period_month:02d}',
            reference=f'DEPR-{period_year}{period_month:02d}',
            lines=journal_lines,
            total_debit=total_depreciation,
            total_credit=total_depreciation,
            created_by=posted_by_user_id,
        )
        db.session.add(pending)
        db.session.flush()
        created_entries = post_pending_journal(pending.id, posted_by_user_id=posted_by_user_id)

        # Each asset contributed 2 lines (debit, credit) in the same order as
        # posted_assets - take the debit line's AccountingEntry for traceability.
        for i, (asset, amount) in enumerate(posted_assets):
            debit_entry = created_entries[i * 2] if len(created_entries) > i * 2 else None
            db.session.add(DepreciationSchedule(
                asset_id=asset.id,
                period_date=period_end_date,
                book_type='commercial',
                depreciation_amount=amount,
                accumulated_depreciation=asset.accumulated_depreciation,
                net_book_value=asset.net_book_value,
                is_posted=True,
                posted_date=datetime.utcnow(),
                accounting_entry_id=debit_entry.id if debit_entry else None,
            ))

    db.session.commit()

    return {
        'assets_processed': assets_processed,
        'total_depreciation': total_depreciation,
        'skipped': skipped,
    }


# SAP-equivalence plan item #2 (2026-10-06): static mapping from the
# transaction_type strings already used throughout this codebase (see
# PeriodTransactionTypeLock's docstring for the full list) to SAP's 5
# posting-period-variant buckets (D=Debitur/AR, K=Kreditur/AP,
# M=Material/Inventory, S=GL langsung, A=Aset Tetap). 'payment' is
# intentionally excluded here - its bucket is ambiguous from the string
# alone (could be a customer receipt=D or a supplier disbursement=K), so
# it's resolved dynamically per-row by resolve_payment_sap_bucket()
# instead of this static map.
TRANSACTION_TYPE_TO_SAP_BUCKET = {
    'purchase_invoice': 'K',
    'purchase_return': 'K',
    'recurring_payment': 'K',
    'sales_invoice': 'D',
    'sales_return': 'D',
    'customer_deposit_usage': 'D',
    'stock_opname': 'M',
    'goods_receipt': 'M',
    'work_order': 'M',
    'sales_delivery': 'M',
    'inventory_destruction': 'M',
    'asset': 'A',
    'asset_disposal': 'A',
    'journal_entry': 'S',
    'expense': 'S',
    'reimbursement': 'S',
    'payroll': 'S',
}


def resolve_payment_sap_bucket(payment):
    """Payment.customer_id vs supplier_id is the reliable direction signal
    (same one create_payment() already uses to decide Dr Kas/Cr Piutang
    vs Dr Hutang/Cr Kas via invoice.invoice_type - payment_type itself has
    3 inconsistent historical string values and isn't trustworthy, see
    PaymentDetail.tsx fix notes). Returns None if neither is set (shouldn't
    happen for a real Payment row, but don't guess if it does)."""
    if payment.customer_id is not None:
        return 'D'
    if payment.supplier_id is not None:
        return 'K'
    return None


def is_period_locked(transaction_date, transaction_type=None, sap_bucket=None):
    """
    Check whether a given transaction_date falls within a locked period -
    either a FULL close (PeriodClose - every transaction type blocked) or,
    when transaction_type is given, a PARTIAL lock scoped to just that type
    (PeriodTransactionTypeLock - 2026-09-28, see its model docstring for
    why this exists: SAP-style "close AP but leave GL manual entries open"
    without a full period close).

    Coverage as of 2026-09-28: checked at Purchase Invoice, Sales Invoice,
    manual Journal Entry, Payment, Expense, Asset Depreciation, Payroll
    approval, and the generic Approval Workflow endpoint (which itself
    covers any flow that queues a PendingJournalEntry with workflow_id
    set). Several other GL-writing flows (Stock Opname, GRN, Purchase
    Return, Shipping/COGS, Production/WIP) were audited and found to
    already date their journals to "today" rather than a user-editable
    business date, so a full close already blocks them structurally
    without needing an explicit check - see the commit history for that
    verification. transaction_type is not yet passed by every one of the
    checked call sites (some only ever check the full PeriodClose) -
    adding it is a small, low-risk follow-up per call site as each one's
    business need for partial locking comes up, not a structural gap.
    """
    from models.finance import PeriodClose, PeriodTransactionTypeLock, PeriodAccountTypeLock

    if not transaction_date:
        return False

    year = transaction_date.year
    month = transaction_date.month

    if PeriodClose.query.filter_by(period_year=year, period_month=month).first() is not None:
        return True

    if transaction_type:
        if PeriodTransactionTypeLock.query.filter_by(
            period_year=year, period_month=month, transaction_type=transaction_type
        ).first() is not None:
            return True

    bucket = sap_bucket or (TRANSACTION_TYPE_TO_SAP_BUCKET.get(transaction_type) if transaction_type else None)
    if bucket:
        if PeriodAccountTypeLock.query.filter_by(
            period_year=year, period_month=month, account_type_bucket=bucket
        ).first() is not None:
            return True

    return False


def resolve_accounts_receivable(customer_id):
    """
    Resolve the accounts receivable (Akun Piutang Usaha) account_id for a
    given customer. Per Accurate's pattern (confirmed via web search
    2026-08-17), this is set per-customer, mirroring
    resolve_accounts_payable()'s per-supplier logic - 2-level fallback:
    customer override -> global default.

    Args:
        customer_id (int): Customer.id to check for an override.

    Returns:
        int: resolved account_id.

    Raises:
        ValueError: if no account can be resolved at either level.
    """
    from models.sales import Customer
    from models.finance import GlobalAccountDefault

    customer = Customer.query.get(customer_id)
    if customer and customer.akun_piutang_id:
        return customer.akun_piutang_id

    global_default = GlobalAccountDefault.query.filter_by(transaction_key='accounts_receivable').first()
    if global_default:
        return global_default.account_id

    raise ValueError(
        f"resolve_accounts_receivable: could not resolve accounts receivable account for "
        f"customer_id={customer_id} - no customer override or global default found"
    )


def get_real_cash_flow(start_date, end_date):
    """Real cash-in/cash-out for a date range, computed from actual GL
    postings against Kas/Bank accounts (Account.is_cash_bank=True) - NOT an
    estimate. Fixes the Cash Flow module (routes/finance.py's /reports/
    cash-flow, /dashboard/cash-flow, /cash-flow/forecast, /cash-flow/analysis)
    previously being 100% hardcoded/estimated (fixed ratios like "cash_out =
    80% of cash_in", "operating = 28% of revenue") despite real GL data now
    existing (Payment posting to GL was fixed the same day as this).

    cash_in = sum of debit postings to cash/bank accounts (money coming in)
    cash_out = sum of credit postings to cash/bank accounts (money going out)

    Also splits cash_in/cash_out by AccountingEntry.reference_type into a
    best-effort operating/investing/financing classification - 'payment',
    'sales_invoice', 'purchase_invoice' are operating (the only real
    categories this system currently posts); investing/financing are 0
    unless/until fixed-asset or loan transactions actually post to GL (they
    don't yet - see the still-open Asset-depreciation-never-posts-to-GL
    finding), reported honestly as 0 rather than a fabricated percentage.

    Returns a dict: {cash_in, cash_out, net_cash_flow, operating, investing, financing}
    where operating/investing/financing are each {'in':, 'out':, 'net':}.
    """
    # Aktivitas investasi = transaksi aset tetap. Pembiayaan belum punya
    # transaksi pencatat khusus, jadi 0. SEMUA sisanya (pembayaran, faktur,
    # gaji, beban, void, jurnal manual, dll) adalah operasional - dengan begitu
    # operasional + investasi + pembiayaan selalu sama dengan perubahan kas
    # total (sebelumnya hanya 3 tipe referensi yang dihitung operasional).
    INVESTING_REF_TYPES = ('asset', 'asset_disposal', 'asset_purchase')

    # Hanya jurnal berstatus 'posted' - sama dengan saldo buku besar / neraca.
    rows = db.session.query(
        AccountingEntry.reference_type, AccountingEntry.debit_amount, AccountingEntry.credit_amount
    ).join(Account, AccountingEntry.account_id == Account.id).filter(
        Account.is_cash_bank == True,
        AccountingEntry.status == 'posted',
        AccountingEntry.entry_date >= start_date,
        AccountingEntry.entry_date <= end_date,
    ).all()

    cash_in = sum(float(r[1] or 0) for r in rows)
    cash_out = sum(float(r[2] or 0) for r in rows)

    investing_in = sum(float(r[1] or 0) for r in rows if r[0] in INVESTING_REF_TYPES)
    investing_out = sum(float(r[2] or 0) for r in rows if r[0] in INVESTING_REF_TYPES)
    operating_in = cash_in - investing_in
    operating_out = cash_out - investing_out

    return {
        'cash_in': cash_in,
        'cash_out': cash_out,
        'net_cash_flow': cash_in - cash_out,
        'operating': {'in': operating_in, 'out': operating_out, 'net': operating_in - operating_out},
        'investing': {'in': investing_in, 'out': investing_out, 'net': investing_in - investing_out},
        'financing': {'in': 0.0, 'out': 0.0, 'net': 0.0},
    }


def get_cash_balance_as_of(as_of_date):
    """Real cash/bank balance as of a given date - sum of all debit minus
    credit postings to Kas/Bank accounts up to and including that date."""
    result = db.session.query(
        db.func.coalesce(db.func.sum(AccountingEntry.debit_amount - AccountingEntry.credit_amount), 0)
    ).join(Account, AccountingEntry.account_id == Account.id).filter(
        Account.is_cash_bank == True,
        AccountingEntry.status == 'posted',
        AccountingEntry.entry_date <= as_of_date,
    ).scalar()
    return float(result or 0)


def _resolve_po_item_account(item_data_or_model):
    """Resolve the GL account a PurchaseOrderItem/line dict would eventually
    post to (inventory vs expense) - the exact same logic
    routes/purchase_invoice.py uses for the real posting, reused here so
    budget commitment tracks the same account the actual will later hit.
    Accepts either a PurchaseOrderItem model instance or a plain dict with
    product_id/material_id keys.
    """
    from models.product import Product

    if isinstance(item_data_or_model, dict):
        product_id = item_data_or_model.get('product_id')
        material_id = item_data_or_model.get('material_id')
    else:
        product_id = item_data_or_model.product_id
        material_id = item_data_or_model.material_id

    is_inventory_item = False
    if material_id:
        is_inventory_item = True
    elif product_id:
        product = db.session.get(Product, product_id)
        if product and product.material_type in ('raw_materials', 'packaging_materials', 'chemical_materials', 'finished_goods'):
            is_inventory_item = True

    slot = 'akun_persediaan_id' if is_inventory_item else 'akun_beban_id'
    return resolve_account(slot, product_id=product_id, category_id=None)


def _find_active_budget_line(account_id, on_date):
    """Find the BudgetLine for account_id whose parent Budget covers on_date
    and is approved/active. Returns None if no budget control is configured
    for that account - callers should treat that as 'no commitment tracked
    for this line', not an error, since not every account needs budgeting."""
    from models.finance import Budget, BudgetLine

    return BudgetLine.query.join(Budget).filter(
        BudgetLine.account_id == account_id,
        Budget.status.in_(['approved', 'active']),
        Budget.start_date <= on_date,
        Budget.end_date >= on_date,
    ).first()


def reserve_po_budget_commitment(po):
    """Reserve (encumber) budget for a PurchaseOrder being approved - SAP
    FI-CO commitment accounting equivalent. For each PO line, resolves the
    account it will eventually post to (same helper the real invoice posting
    uses) and increments that account's active BudgetLine.committed_amount
    by the line's total_price. Lines whose account has no active budget
    configured are silently skipped (no budget control there, not an error).

    Returns the total amount actually reserved (for logging/testing).
    """
    on_date = po.order_date.date() if hasattr(po.order_date, 'date') else po.order_date
    total_reserved = 0.0

    for item in po.items:
        try:
            account_id = _resolve_po_item_account(item)
        except ValueError:
            continue  # no account resolvable at all (no default configured) - skip, don't block PO approval

        line = _find_active_budget_line(account_id, on_date)
        if not line:
            continue

        # PO amounts are in po.currency; budgets are IDR (2026-10-19).
        amount = float(item.total_price or 0) * float(po.exchange_rate or 1)
        line.committed_amount = float(line.committed_amount or 0) + amount
        total_reserved += amount

    return total_reserved


def release_po_budget_commitment(po, items=None):
    """Release previously-reserved commitment for a PurchaseOrder - either
    fully (PO cancelled, items=None uses po.items) or for a specific subset
    of items being invoiced now (items=list of PurchaseOrderItem/dicts with
    the invoiced amount already applied). Mirrors reserve_po_budget_commitment's
    account resolution so it decrements the exact same BudgetLine that was
    incremented - never goes below 0 (defensive, in case of drift/partial
    double-releases rather than assuming perfect bookkeeping).

    Returns the total amount released.
    """
    on_date = po.order_date.date() if hasattr(po.order_date, 'date') else po.order_date
    total_released = 0.0
    target_items = items if items is not None else po.items

    for item in target_items:
        if isinstance(item, dict):
            account_hint = item
            amount = float(item.get('amount') or 0)
        else:
            account_hint = item
            amount = float(item.total_price or 0)
        # Amounts (model or dict) are in po.currency; budgets are IDR.
        amount *= float(po.exchange_rate or 1)
        try:
            account_id = _resolve_po_item_account(account_hint)
        except ValueError:
            continue

        line = _find_active_budget_line(account_id, on_date)
        if not line:
            continue

        release_amount = min(amount, float(line.committed_amount or 0))
        line.committed_amount = float(line.committed_amount or 0) - release_amount
        total_released += release_amount

    return total_released


FX_ACCOUNT_CODE = '9-8000'


def get_fx_gain_loss_account():
    """Akun Laba/Rugi Selisih Kurs (dibuat otomatis kalau belum ada)."""
    from models.finance import Account
    acc = Account.query.filter_by(account_code=FX_ACCOUNT_CODE).first()
    if acc:
        return acc
    acc = Account(account_code=FX_ACCOUNT_CODE, account_name='Laba/Rugi Selisih Kurs', account_type='expense',
                  normal_balance='debit', is_active=True, is_header=False)
    db.session.add(acc)
    db.session.flush()
    return acc


def fx_difference_line(cash_idr, ap_idr, description):
    """Jurnal selisih kurs saat melunasi hutang valas: kas keluar lebih besar dari
    nilai hutang = rugi (debit), lebih kecil = laba (kredit). None kalau nol."""
    diff = round(float(cash_idr) - float(ap_idr), 2)
    if abs(diff) < 0.005:
        return None
    acc = get_fx_gain_loss_account()
    return {'account_id': acc.id, 'debit': diff if diff > 0 else 0, 'credit': -diff if diff < 0 else 0,
            'description': description}


def resolve_ppn_masukan_account_id():
    """Akun PPN Masukan: pengaturan pajak -> akun bernama 'PPN Masukan' -> buat 1-1700.
    Hasilnya disimpan ke pengaturan pajak supaya konsisten."""
    from models.finance import TaxAccountSettings
    from sqlalchemy import func
    settings = get_or_create_singleton(TaxAccountSettings)
    if settings.akun_ppn_masukan_id:
        return settings.akun_ppn_masukan_id
    acc = Account.query.filter(func.lower(Account.account_name) == 'ppn masukan', Account.is_active.is_(True)).first()
    if not acc:
        acc = Account(account_code='1-1700', account_name='PPN Masukan', account_type='asset',
                      normal_balance='debit', is_active=True, is_header=False)
        db.session.add(acc)
        db.session.flush()
    settings.akun_ppn_masukan_id = acc.id
    db.session.flush()
    return acc.id


def split_wip_vs_raw_material_credit(work_order_id, material_cost_total):
    """Saat barang jadi diterima, bagian bahan baku yang sudah dipindah ke WIP lewat jurnal
    pengeluaran material (Dr WIP / Cr Bahan Baku) harus dikreditkan ke WIP, bukan ke Bahan Baku
    lagi (kalau tidak, Bahan Baku terkredit dua kali dan WIP tidak pernah berkurang).
    Mengembalikan (wip_part, raw_material_part); sisa tanpa jurnal WIP tetap ke Bahan Baku."""
    from models.finance import GlobalAccountDefault
    from sqlalchemy import text
    material_cost_total = round(float(material_cost_total or 0), 2)
    wip_default = GlobalAccountDefault.query.filter_by(transaction_key='wip_persediaan').first()
    if not wip_default or material_cost_total <= 0:
        return 0.0, material_cost_total
    wip_code = db.session.get(Account, wip_default.account_id).account_code
    issued = db.session.execute(text("""
        SELECT COALESCE(SUM(e.debit_amount - e.credit_amount), 0)
        FROM accounting_entries e
        JOIN material_issues mi ON mi.id = e.reference_id
        WHERE e.reference_type = 'material_issue' AND e.status = 'posted'
          AND e.account_code = :code AND mi.work_order_id = :wo
    """), {'code': wip_code, 'wo': work_order_id}).scalar() or 0
    already = db.session.execute(text("""
        SELECT COALESCE(SUM(credit_amount - debit_amount), 0) FROM accounting_entries
        WHERE reference_type = 'work_order' AND reference_id = :wo AND status = 'posted' AND account_code = :code
    """), {'code': wip_code, 'wo': work_order_id}).scalar() or 0
    wip_part = round(max(0.0, min(material_cost_total, float(issued) - float(already))), 2)
    return wip_part, round(material_cost_total - wip_part, 2)


def credit_customer_for_return(invoice, customer_id, amount, return_id, memo_date, user_id):
    """Sales-return credit has just been posted to AR. Apply what the linked invoice still owes;
    anything beyond that (or the whole amount when no invoice is linked) becomes a Nota Kredit
    (CreditMemo) so it is tracked and can be applied to another invoice or refunded.
    Returns (applied_to_invoice, memo_or_None). Does not commit."""
    from models.finance import CreditMemo
    amount = round(float(amount or 0), 2)
    applied = 0.0
    if invoice is not None and invoice.status != 'cancelled':
        owed = max(0.0, float(invoice.total_amount or 0) - float(invoice.paid_amount or 0) - float(invoice.credit_applied or 0))
        applied = round(min(amount, owed), 2)
        if applied > 0:
            apply_credit_to_invoice(invoice, applied)
    excess = round(amount - applied, 2)
    memo = None
    if excess > 0.005 and customer_id:
        memo = CreditMemo(
            memo_number=generate_number('NK', CreditMemo, 'memo_number'), customer_id=customer_id, memo_date=memo_date,
            amount=excess, source_type='sales_return', source_id=return_id, created_by=user_id,
            notes='Kredit dari retur penjualan' + ('' if invoice is None else f' (melebihi sisa faktur {invoice.invoice_number})'),
        )
        db.session.add(memo)
        db.session.flush()
    return applied, memo


def apply_credit_memo_to_invoice(memo, invoice, amount, user_id, applied_date):
    """Use part of a credit memo against an open sales invoice. AR was already credited when the
    return was posted, so no new journal. Raises ValueError with a user-facing message."""
    from models.finance import CreditMemoApplication
    amount = round(float(amount or 0), 2)
    if amount <= 0:
        raise ValueError('Jumlah harus lebih dari 0')
    if invoice.invoice_type != 'sales' or invoice.customer_id != memo.customer_id:
        raise ValueError('Faktur harus faktur penjualan milik customer yang sama dengan nota kredit')
    if invoice.status in ('cancelled', 'paid'):
        raise ValueError(f'Faktur {invoice.invoice_number} sudah {"dibatalkan" if invoice.status == "cancelled" else "lunas"}')
    if amount > memo.balance + 0.005:
        raise ValueError(f'Jumlah melebihi sisa nota kredit (Rp{memo.balance:,.2f})')
    owed = float(invoice.balance_due or 0)
    if amount > owed + 0.005:
        raise ValueError(f'Jumlah melebihi sisa tagihan faktur (Rp{owed:,.2f})')
    apply_credit_to_invoice(invoice, amount)
    memo.amount_applied = float(memo.amount_applied or 0) + amount
    db.session.add(CreditMemoApplication(memo_id=memo.id, kind='invoice', invoice_id=invoice.id, amount=amount,
                                         applied_date=applied_date, created_by=user_id))
    db.session.flush()


def refund_credit_memo(memo, bank_account_id, amount, user_id, refund_date):
    """Pay a credit memo back to the customer: Dr Piutang Usaha / Cr Kas-Bank."""
    from models.finance import CreditMemoApplication
    amount = round(float(amount or 0), 2)
    if amount <= 0:
        raise ValueError('Jumlah harus lebih dari 0')
    if amount > memo.balance + 0.005:
        raise ValueError(f'Jumlah melebihi sisa nota kredit (Rp{memo.balance:,.2f})')
    bank = db.session.get(Account, bank_account_id) if bank_account_id else None
    if not bank or not bank.is_cash_bank:
        raise ValueError('Pilih akun Kas/Bank untuk pengembalian dana')
    if is_period_locked(refund_date, transaction_type='payment', sap_bucket='D'):
        raise ValueError(f'Periode {refund_date.strftime("%Y-%m")} sudah ditutup (period-close)')
    memo.amount_refunded = float(memo.amount_refunded or 0) + amount
    application = CreditMemoApplication(memo_id=memo.id, kind='refund', bank_account_id=bank.id, amount=amount,
                                        applied_date=refund_date, created_by=user_id)
    db.session.add(application)
    db.session.flush()
    pending = PendingJournalEntry(
        workflow_id=None, entry_date=refund_date, description=f'Pengembalian dana nota kredit {memo.memo_number}',
        reference=memo.memo_number,
        lines=[
            {'account_id': resolve_accounts_receivable(memo.customer_id), 'debit': amount, 'credit': 0,
             'description': f'Pengembalian dana nota kredit {memo.memo_number}'},
            {'account_id': bank.id, 'debit': 0, 'credit': amount, 'description': f'Pengembalian dana ke customer - {memo.memo_number}'},
        ],
        total_debit=amount, total_credit=amount, created_by=user_id,
    )
    db.session.add(pending)
    db.session.flush()
    post_pending_journal(pending.id, posted_by_user_id=user_id, reference_type='credit_memo_refund', reference_id=application.id)


def undo_credit_memo_application(application, user_id):
    """Cancel one use of a credit memo. Invoice use: the invoice owes that amount again.
    Refund: a reversing journal (Dr Kas / Cr Piutang) is posted. The row is kept, marked reversed.
    Raises ValueError with a user-facing message."""
    from models.finance import BankStatementLine, Invoice
    from utils.timezone import get_local_now
    if application.reversed_at:
        raise ValueError('Transaksi ini sudah dibatalkan')
    memo = application.memo
    amount = float(application.amount or 0)
    today = get_local_now().date()
    if application.kind == 'invoice':
        invoice = db.session.query(Invoice).filter_by(id=application.invoice_id).with_for_update().first()
        if invoice is None or invoice.status == 'cancelled':
            raise ValueError('Faktur terkait sudah dibatalkan; pembatalan pemakaian tidak bisa dilakukan')
        invoice.credit_applied = max(0.0, float(invoice.credit_applied or 0) - amount)
        invoice.balance_due = max(0.0, float(invoice.total_amount or 0) - float(invoice.paid_amount or 0) - float(invoice.credit_applied or 0))
        if invoice.balance_due > 0.005:
            invoice.status = 'partial' if (float(invoice.paid_amount or 0) > 0 or float(invoice.credit_applied or 0) > 0) else 'sent'
        memo.amount_applied = max(0.0, float(memo.amount_applied or 0) - amount)
    else:
        entry_ids = [e.id for e in AccountingEntry.query.filter_by(
            reference_type='credit_memo_refund', reference_id=application.id, status='posted').all()]
        if entry_ids and BankStatementLine.query.filter(BankStatementLine.matched_accounting_entry_id.in_(entry_ids),
                                                        BankStatementLine.is_matched == True).first():
            raise ValueError('Pengembalian dana ini sudah dicocokkan di Rekonsiliasi Bank. Batalkan pencocokannya dulu.')
        if is_period_locked(today, transaction_type='payment', sap_bucket='D'):
            raise ValueError(f'Periode {today.strftime("%Y-%m")} sudah ditutup (period-close)')
        reverse_accounting_entries(reference_type='credit_memo_refund', reference_id=application.id, entry_date=today,
                                   user_id=user_id, description=f'Batal pengembalian dana nota kredit {memo.memo_number}')
        memo.amount_refunded = max(0.0, float(memo.amount_refunded or 0) - amount)
    application.reversed_at = get_local_now()
    application.reversed_by = user_id
    db.session.flush()


OPENING_STOCK_ACCOUNT_CODE = '3-4000'
MANUAL_STOCK_REF_TYPES = ('manual_input', 'quick_add')


def manual_stock_unit_cost(product_id=None, material_id=None):
    """Master cost of an item (materials.cost_per_unit / products.cost), 0 when unknown."""
    from models.product import Product, Material
    if material_id:
        m = db.session.get(Material, material_id)
        return float(getattr(m, 'cost_per_unit', 0) or 0) if m else 0.0
    if product_id:
        p = db.session.get(Product, product_id)
        return float(getattr(p, 'cost', 0) or 0) if p else 0.0
    return 0.0


def get_opening_stock_account():
    """Equity account that offsets stock entered by hand (opening/initial stock)."""
    acc = Account.query.filter_by(account_code=OPENING_STOCK_ACCOUNT_CODE).first()
    if acc:
        return acc
    acc = Account(account_code=OPENING_STOCK_ACCOUNT_CODE, account_name='Saldo Awal Persediaan', account_type='equity',
                  normal_balance='credit', is_active=True, is_header=False)
    db.session.add(acc)
    db.session.flush()
    return acc


def post_manual_stock_inflow_journal(movement, user_id, product_id=None, material_id=None, entry_date=None):
    """Stock entered by hand (Input Stok / Quick Add / Tambah Stok) brings value into the warehouse
    without a purchase, so the GL needs Dr Persediaan / Cr Saldo Awal Persediaan - otherwise later
    shipments credit inventory for goods that never debited it. Skipped (never an error) when the
    item has no master cost, the inventory account cannot be resolved, or the period is closed.
    Idempotent per movement. Returns the posted entries or []."""
    from utils.timezone import get_local_now
    qty = float(getattr(movement, 'quantity', 0) or 0)
    unit_cost = float(getattr(movement, 'unit_cost', 0) or 0) or manual_stock_unit_cost(product_id, material_id)
    value = round(qty * unit_cost, 2)
    if value <= 0:
        return []
    db.session.flush()
    if AccountingEntry.query.filter_by(reference_type='manual_stock_in', reference_id=movement.id, status='posted').first():
        return []
    entry_date = entry_date or get_local_now().date()
    if is_period_locked(entry_date, transaction_type='journal_entry'):
        return []
    try:
        inventory_account_id = resolve_account('akun_persediaan_id', product_id=product_id, category_id=None)
    except ValueError:
        return []
    offset = get_opening_stock_account()
    ref = getattr(movement, 'reference_number', None) or f'STK-{movement.id}'
    pending = PendingJournalEntry(
        workflow_id=None, entry_date=entry_date, description=f'Stok masuk manual {ref}', reference=ref,
        lines=[
            {'account_id': inventory_account_id, 'debit': value, 'credit': 0, 'description': f'Persediaan masuk manual - {ref}'},
            {'account_id': offset.id, 'debit': 0, 'credit': value, 'description': f'Saldo awal persediaan - {ref}'},
        ],
        total_debit=value, total_credit=value, created_by=user_id,
    )
    db.session.add(pending)
    db.session.flush()
    entries = post_pending_journal(pending.id, posted_by_user_id=user_id, reference_type='manual_stock_in', reference_id=movement.id)
    if entries:
        movement.accounting_entry_number = entries[0].entry_number.rsplit('-', 1)[0]
        movement.accounting_entry_status = 'posted'
    return entries
