"""
One-off cleanup of legacy finance test data found by the 2026-10-24 audit.
Safe to re-run (idempotent). Default is a DRY RUN; pass --apply to write.

    cd backend && python scripts/cleanup_legacy_finance_test_data.py          # simulasi
    cd backend && python scripts/cleanup_legacy_finance_test_data.py --apply  # terapkan

What it fixes (only rows that match the exact legacy symptom):
 1. Active payments that have NO GL journal at all (inserted directly during
    early testing, e.g. PAY-TEST-001): marked 'cancelled' with a void reason
    (nothing to reverse - there was never a journal).
 3. Payroll records already marked 'paid' with no payment journal (paying salary
    used to post nothing): post Dr Hutang Gaji / Cr Kas (global 'cash') dated at
    the record's payment_date; skipped (with a warning) when that period is locked.
 2. Purchase invoices whose header total is <= 0 although their items are not
    (created before the header-total fix; items/journal are fine): header
    subtotal/total recomputed from the items minus completed purchase returns,
    balance = total - paid - credit.
Anything else the audit flagged (e.g. an invoice paid before a return, which is
a legitimate supplier credit) is deliberately left alone.
"""
import sys

sys.path.insert(0, '.')

from app import create_app
from models import db
from models.finance import Invoice, InvoiceItem, Payment, AccountingEntry


def run(apply):
    app = create_app()
    with app.app_context():
        changes = 0

        # 1. payments without any journal
        for p in Payment.query.filter(Payment.status != 'cancelled').all():
            has_gl = AccountingEntry.query.filter_by(reference_type='payment', reference_id=p.id).first() is not None
            if has_gl:
                continue
            print(f'[1] pembayaran tanpa jurnal: {p.payment_number} (Rp{float(p.amount):,.0f}, status {p.status}) -> cancelled')
            changes += 1
            if apply:
                p.status = 'cancelled'
                p.void_reason = 'Data uji lama tanpa jurnal (pembersihan audit 2026-10-24)'

        # 2. purchase invoices with a zero/negative header but real items
        from models.purchasing import PurchaseReturn
        for inv in Invoice.query.filter(Invoice.invoice_type == 'purchase', Invoice.status != 'cancelled').all():
            if float(inv.total_amount or 0) > 0:
                continue
            items_total = sum(float(i.total_amount or 0) for i in inv.items)
            if items_total <= 0:
                continue
            returned = sum(
                float(r.total_amount or 0)
                for r in PurchaseReturn.query.filter_by(invoice_id=inv.id).all()
                if (r.status or '') == 'completed'
            )
            new_total = max(0.0, items_total - returned)
            paid = float(inv.paid_amount or 0)
            new_balance = max(0.0, new_total - paid - float(inv.credit_applied or 0))
            print(f'[2] faktur pembelian {inv.invoice_number}: total {float(inv.total_amount or 0):,.0f} -> {new_total:,.0f} '
                  f'(item {items_total:,.0f} - retur {returned:,.0f}), sisa {new_balance:,.0f}')
            changes += 1
            if apply:
                inv.subtotal = items_total
                inv.total_amount = new_total
                inv.balance_due = new_balance

        # 3. paid payroll records without a payment journal
        from models.hr_extended import PayrollRecord
        from utils.finance_helpers import post_payroll_payment_journal, PayrollPaymentError
        for rec in PayrollRecord.query.filter_by(status='paid').all():
            if AccountingEntry.query.filter_by(reference_type='payroll_payment', reference_id=rec.id).first():
                continue
            when = rec.payment_date
            print(f'[3] gaji dibayar tanpa jurnal: record #{rec.id} (Rp{float(rec.net_salary or 0):,.0f}, tgl {when}) -> Dr Hutang Gaji / Cr Kas')
            changes += 1
            if apply:
                try:
                    post_payroll_payment_journal(rec, payment_date=when, posted_by_user_id=None)
                except PayrollPaymentError as e:
                    changes -= 1
                    print(f'    DILEWATI: {e}')

        if apply:
            db.session.commit()
            print(f'\nSelesai: {changes} perubahan diterapkan.')
        else:
            db.session.rollback()
            print(f'\nSimulasi: {changes} perubahan akan dilakukan. Jalankan dengan --apply untuk menerapkan.')


if __name__ == '__main__':
    run('--apply' in sys.argv)
