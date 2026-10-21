"""SAP-equivalence plan item #2 (2026-10-06): PeriodAccountTypeLock, a
coarser SAP-style posting-period lock keyed by Account Type bucket
(D/K/M/S/A), sitting alongside the existing per-transaction_type lock
(PeriodTransactionTypeLock) rather than replacing it.

These tests exercise is_period_locked() directly (the single choke point
all 13+ route call sites go through) rather than every individual route,
since the routes themselves just forward transaction_date/transaction_type
to this function - the risk is entirely in the mapping/precedence logic,
not in each call site's plumbing (those are covered by their own existing
route tests, unaffected by this change beyond the extra bucket check).
"""
from datetime import date

from models import db
from models.finance import PeriodClose, PeriodTransactionTypeLock, PeriodAccountTypeLock
from utils.finance_helpers import is_period_locked, TRANSACTION_TYPE_TO_SAP_BUCKET, resolve_payment_sap_bucket


def _lock_bucket(db_session, year, month, bucket):
    db_session.add(PeriodAccountTypeLock(period_year=year, period_month=month, account_type_bucket=bucket))
    db_session.commit()


class TestBucketMapping:
    def test_all_five_buckets_present_in_map(self):
        assert set(TRANSACTION_TYPE_TO_SAP_BUCKET.values()) == {'D', 'K', 'M', 'S', 'A'}

    def test_known_mappings(self):
        assert TRANSACTION_TYPE_TO_SAP_BUCKET['purchase_invoice'] == 'K'
        assert TRANSACTION_TYPE_TO_SAP_BUCKET['sales_invoice'] == 'D'
        assert TRANSACTION_TYPE_TO_SAP_BUCKET['stock_opname'] == 'M'
        assert TRANSACTION_TYPE_TO_SAP_BUCKET['journal_entry'] == 'S'
        assert TRANSACTION_TYPE_TO_SAP_BUCKET['asset_disposal'] == 'A'

    def test_payment_excluded_from_static_map(self):
        # 'payment' is resolved dynamically per-row (see TestPaymentBucket),
        # not from the static map - direction isn't knowable from the
        # transaction_type string alone.
        assert 'payment' not in TRANSACTION_TYPE_TO_SAP_BUCKET


class TestPaymentBucket:
    def test_customer_id_resolves_to_d(self):
        class FakePayment:
            customer_id = 5
            supplier_id = None
        assert resolve_payment_sap_bucket(FakePayment()) == 'D'

    def test_supplier_id_resolves_to_k(self):
        class FakePayment:
            customer_id = None
            supplier_id = 7
        assert resolve_payment_sap_bucket(FakePayment()) == 'K'

    def test_neither_resolves_to_none(self):
        class FakePayment:
            customer_id = None
            supplier_id = None
        assert resolve_payment_sap_bucket(FakePayment()) is None


class TestIsPeriodLockedWithBucket:
    def test_unlocked_period_allows_posting(self, app, db_session):
        with app.app_context():
            assert is_period_locked(date(2031, 1, 15), transaction_type='sales_invoice') is False

    def test_bucket_lock_blocks_mapped_transaction_type(self, app, db_session):
        with app.app_context():
            _lock_bucket(db_session, 2031, 2, 'K')
            assert is_period_locked(date(2031, 2, 10), transaction_type='purchase_invoice') is True

    def test_bucket_lock_does_not_block_other_buckets(self, app, db_session):
        with app.app_context():
            _lock_bucket(db_session, 2031, 3, 'K')
            # sales_invoice -> D, unaffected by a K-bucket lock
            assert is_period_locked(date(2031, 3, 10), transaction_type='sales_invoice') is False

    def test_transaction_type_lock_still_works_independently(self, app, db_session):
        with app.app_context():
            db_session.add(PeriodTransactionTypeLock(period_year=2031, period_month=4, transaction_type='payroll'))
            db_session.commit()
            # payroll maps to bucket S, but no S-bucket lock exists - the
            # older granular transaction_type lock must still catch it.
            assert is_period_locked(date(2031, 4, 5), transaction_type='payroll') is True

    def test_full_period_close_overrides_everything(self, app, db_session):
        with app.app_context():
            db_session.add(PeriodClose(period_year=2031, period_month=5))
            db_session.commit()
            # No PeriodAccountTypeLock or PeriodTransactionTypeLock row
            # exists for this period at all - PeriodClose alone must block.
            assert is_period_locked(date(2031, 5, 1), transaction_type='journal_entry') is True

    def test_payment_dynamic_bucket_blocks_on_d(self, app, db_session):
        with app.app_context():
            _lock_bucket(db_session, 2031, 6, 'D')
            assert is_period_locked(date(2031, 6, 1), transaction_type='payment', sap_bucket='D') is True

    def test_payment_dynamic_bucket_does_not_block_on_k(self, app, db_session):
        with app.app_context():
            _lock_bucket(db_session, 2031, 7, 'D')
            assert is_period_locked(date(2031, 7, 1), transaction_type='payment', sap_bucket='K') is False

    def test_no_transaction_type_no_bucket_check(self, app, db_session):
        with app.app_context():
            _lock_bucket(db_session, 2031, 8, 'S')
            # No transaction_type given at all -> can't resolve a bucket,
            # must not false-positive block.
            assert is_period_locked(date(2031, 8, 1)) is False
