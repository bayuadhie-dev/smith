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

    total_gaji = sum(float(r.gross_salary - r.absence_deduction) for r in records)
    total_pph21 = sum(float(r.tax_deduction) for r in records)
    total_bpjs_kesehatan = sum(float(r.insurance_deduction) for r in records)
    total_bpjs_tk = sum(float(r.pension_deduction) for r in records)
    total_potongan_lain = sum(float(r.other_deductions) for r in records)
    total_net = sum(float(r.net_salary) for r in records)

    lines = []

    if total_gaji > 0:
        lines.append({
            'account_id': resolve_payroll_account('payroll_expense'),
            'debit': total_gaji, 'credit': 0,
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

    return total_applied


def run_monthly_depreciation(period_year, period_month, posted_by_user_id=None):
    """
    Compute and post monthly depreciation for all active FixedAssets,
    mirroring Accurate's "Proses Akhir Bulan" (Period End) behavior of
    auto-generating depreciation journals each month.

    For each active asset with straight_line depreciation (declining_balance
    is not yet supported - FixedAsset.annual_depreciation returns 0 for it,
    a pre-existing gap, not something newly introduced here), posts:
        Debit: Beban Penyusutan (depreciation_expense)
        Credit: Akumulasi Penyusutan (accumulated_depreciation)
    for 1/12th of the asset's annual depreciation, and increments the
    asset's own accumulated_depreciation field to match. Skips (does not
    post, does not error) any asset already fully depreciated (net book
    value <= salvage value).

    This does NOT check for a duplicate run in the same period - callers
    (the period-end endpoint) are responsible for guarding against running
    this twice for the same month.

    Returns a dict summary: {'assets_processed': int, 'total_depreciation': float, 'skipped': int}.
    """
    from models import db
    from models.finance import FixedAsset, GlobalAccountDefault
    from models.approval_workflow import PendingJournalEntry

    depreciation_default = GlobalAccountDefault.query.filter_by(transaction_key='depreciation_expense').first()
    accumulated_default = GlobalAccountDefault.query.filter_by(transaction_key='accumulated_depreciation').first()
    if not depreciation_default or not accumulated_default:
        raise ValueError(
            "run_monthly_depreciation: Akun Beban Penyusutan atau Akumulasi Penyusutan "
            "belum diatur di Preferensi Akun (GlobalAccountDefault)"
        )

    assets = FixedAsset.query.filter_by(status='active').all()

    journal_lines = []
    total_depreciation = 0
    assets_processed = 0
    skipped = 0

    for asset in assets:
        monthly_depreciation = float(asset.annual_depreciation) / 12
        if monthly_depreciation <= 0:
            skipped += 1
            continue

        remaining_depreciable = asset.net_book_value - float(asset.salvage_value)
        if remaining_depreciable <= 0:
            skipped += 1
            continue

        # Don't depreciate past salvage value in the final partial month.
        amount = min(monthly_depreciation, remaining_depreciable)

        asset.accumulated_depreciation = float(asset.accumulated_depreciation) + amount
        total_depreciation += amount
        assets_processed += 1

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
        from datetime import date
        import calendar
        last_day = calendar.monthrange(period_year, period_month)[1]
        period_end_date = date(period_year, period_month, last_day)

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
        post_pending_journal(pending.id, posted_by_user_id=posted_by_user_id)

    db.session.commit()

    return {
        'assets_processed': assets_processed,
        'total_depreciation': total_depreciation,
        'skipped': skipped,
    }


def is_period_locked(transaction_date):
    """
    Check whether a given transaction_date falls within a period that has
    already been closed (see PeriodClose). Callers (transaction-creating
    routes) should call this and reject the transaction with a 400 if it
    returns True, mirroring Accurate's period-lock behavior of preventing
    edits to closed periods.

    NOTE: as of 2026-08-16, this check is only WIRED IN at
    close_accounting_period() itself (to prevent re-closing an already-
    closed period) - it is NOT yet called from create_invoice(),
    create_purchase_invoice(), or other transaction-creating routes. Adding
    that enforcement everywhere is a separate, larger follow-up task (many
    call sites to touch), not done as part of this initial period-close
    feature build.
    """
    from models.finance import PeriodClose

    if not transaction_date:
        return False

    year = transaction_date.year
    month = transaction_date.month

    return PeriodClose.query.filter_by(period_year=year, period_month=month).first() is not None


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
    OPERATING_REF_TYPES = ('payment', 'sales_invoice', 'purchase_invoice')

    rows = db.session.query(
        AccountingEntry.reference_type, AccountingEntry.debit_amount, AccountingEntry.credit_amount
    ).join(Account, AccountingEntry.account_id == Account.id).filter(
        Account.is_cash_bank == True,
        AccountingEntry.entry_date >= start_date,
        AccountingEntry.entry_date <= end_date,
    ).all()

    cash_in = sum(float(r[1] or 0) for r in rows)
    cash_out = sum(float(r[2] or 0) for r in rows)

    operating_in = sum(float(r[1] or 0) for r in rows if r[0] in OPERATING_REF_TYPES)
    operating_out = sum(float(r[2] or 0) for r in rows if r[0] in OPERATING_REF_TYPES)

    return {
        'cash_in': cash_in,
        'cash_out': cash_out,
        'net_cash_flow': cash_in - cash_out,
        'operating': {'in': operating_in, 'out': operating_out, 'net': operating_in - operating_out},
        'investing': {'in': 0.0, 'out': 0.0, 'net': 0.0},
        'financing': {'in': 0.0, 'out': 0.0, 'net': 0.0},
    }


def get_cash_balance_as_of(as_of_date):
    """Real cash/bank balance as of a given date - sum of all debit minus
    credit postings to Kas/Bank accounts up to and including that date."""
    result = db.session.query(
        db.func.coalesce(db.func.sum(AccountingEntry.debit_amount - AccountingEntry.credit_amount), 0)
    ).join(Account, AccountingEntry.account_id == Account.id).filter(
        Account.is_cash_bank == True,
        AccountingEntry.entry_date <= as_of_date,
    ).scalar()
    return float(result or 0)
