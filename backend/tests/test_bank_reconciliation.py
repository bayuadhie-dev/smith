"""
Tests for Bank Reconciliation (2026-09-17) - CSV parsing and the
match/unmatch flow in routes/bank_reconciliation.py.
"""
import io
from datetime import date


class FakeFileStorage:
    """Minimal stand-in for werkzeug's FileStorage, just enough for
    _parse_rows() (reads filename + .read())."""
    def __init__(self, content: bytes, filename: str):
        self._content = content
        self.filename = filename

    def read(self):
        return self._content


class TestParseRows:
    def test_parses_debit_credit_columns(self):
        from routes.bank_reconciliation import _parse_rows
        csv_text = (
            "Tanggal,Keterangan,Debit,Kredit\n"
            "2026-01-05,Setoran tunai,,5000000\n"
            "2026-01-06,Bayar listrik,750000,\n"
        )
        rows = _parse_rows(FakeFileStorage(csv_text.encode('utf-8'), 'mutasi.csv'))

        assert len(rows) == 2
        assert rows[0]['line_date'] == date(2026, 1, 5)
        assert rows[0]['amount'] == 5_000_000  # credit = money in = positive
        assert rows[1]['amount'] == -750_000  # debit = money out = negative

    def test_parses_single_signed_amount_column(self):
        from routes.bank_reconciliation import _parse_rows
        csv_text = (
            "Date,Description,Amount\n"
            "2026-02-01,Transfer masuk,1200000\n"
            "2026-02-02,Transfer keluar,-300000\n"
        )
        rows = _parse_rows(FakeFileStorage(csv_text.encode('utf-8'), 'mutasi.csv'))

        assert len(rows) == 2
        assert rows[0]['amount'] == 1_200_000
        assert rows[1]['amount'] == -300_000

    def test_skips_zero_amount_and_blank_rows(self):
        from routes.bank_reconciliation import _parse_rows
        csv_text = (
            "Tanggal,Keterangan,Debit,Kredit\n"
            "2026-01-05,Nol,0,0\n"
            ",,,\n"
            "2026-01-06,Valid,,100000\n"
        )
        rows = _parse_rows(FakeFileStorage(csv_text.encode('utf-8'), 'mutasi.csv'))
        assert len(rows) == 1
        assert rows[0]['amount'] == 100_000

    def test_missing_date_column_raises(self):
        from routes.bank_reconciliation import _parse_rows
        csv_text = "Keterangan,Debit,Kredit\nX,100,\n"
        try:
            _parse_rows(FakeFileStorage(csv_text.encode('utf-8'), 'mutasi.csv'))
            assert False, "expected ValueError"
        except ValueError as e:
            assert 'tanggal' in str(e).lower()

    def test_unsupported_extension_raises(self):
        from routes.bank_reconciliation import _parse_rows
        try:
            _parse_rows(FakeFileStorage(b'irrelevant', 'mutasi.pdf'))
            assert False, "expected ValueError"
        except ValueError as e:
            assert 'format' in str(e).lower()


def _setup_bank_account_and_entry(db_session):
    from models.finance import Account, AccountingEntry

    bank_account = Account(
        account_code='TEST-BANK-01', account_name='Test Bank BCA', account_type='asset',
        normal_balance='debit', is_cash_bank=True,
    )
    db_session.add(bank_account)
    db_session.commit()

    entry = AccountingEntry(
        entry_number='JE-TEST-0001', entry_date=date(2026, 1, 5), entry_type='journal',
        account_id=bank_account.id, account_code=bank_account.account_code, account_name=bank_account.account_name,
        description='Setoran tunai dari test',
        debit_amount=0, credit_amount=5_000_000, status='posted',
    )
    db_session.add(entry)
    db_session.commit()
    return bank_account, entry


class TestMatchFlow:
    def test_match_and_unmatch_line(self, db_session):
        from models.finance import BankStatement, BankStatementLine

        bank_account, entry = _setup_bank_account_and_entry(db_session)

        statement = BankStatement(
            account_id=bank_account.id, period_start=date(2026, 1, 1), period_end=date(2026, 1, 31),
        )
        db_session.add(statement)
        db_session.commit()

        line = BankStatementLine(
            statement_id=statement.id, line_date=date(2026, 1, 5),
            description='Setoran tunai', amount=5_000_000,
        )
        db_session.add(line)
        db_session.commit()

        assert line.is_matched is False

        # Match
        line.is_matched = True
        line.matched_accounting_entry_id = entry.id
        db_session.commit()

        assert line.is_matched is True
        assert line.matched_accounting_entry_id == entry.id

        # Unmatch
        line.is_matched = False
        line.matched_accounting_entry_id = None
        db_session.commit()

        assert line.is_matched is False
        assert line.matched_accounting_entry_id is None
