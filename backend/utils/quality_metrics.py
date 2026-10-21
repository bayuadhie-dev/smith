"""
Combined QC pass-rate metrics (2026-10-07) - this ERP tracks quality in
TWO parallel tables that were never read together: QualityInspection
(incoming-materials QC) and QualityTest (finished-goods QC on completed
Work Orders). Both routes/dashboard.py's main "Quality Pass Rate" card
and routes/quality_enhanced.py's own Quality dashboard only ever queried
QualityInspection, which has essentially 1 real row - while QualityTest
holds 608 real records (144 pending + 464 completed) that were
invisible to every dashboard. Found via a user-requested dashboard
consistency audit.

The two tables use different date columns (inspection_date vs
test_date) and different result vocabularies (accepted/rejected/
conditional vs passed/failed/conditional/pending) for the same
underlying concept - this module is the single place that normalizes
both into one "pass rate" so routes/dashboard.py and
routes/quality_enhanced.py compute the exact same number instead of two
different ones under the same label (the original bug this is fixing).
"""
from datetime import date, timedelta
from models.quality import QualityInspection, QualityTest


def combined_inspection_counts(start_date, end_date=None):
    """Count of QC records (inspections + tests) in [start_date, end_date],
    end_date defaults to start_date (single-day count). QualityTest rows
    still at their default 'pending' result are excluded - they haven't
    been determined yet, same as how a pending QualityInspection
    wouldn't count as a completed inspection either."""
    end_date = end_date or start_date

    inspection_count = QualityInspection.query.filter(
        QualityInspection.inspection_date >= start_date,
        QualityInspection.inspection_date < end_date + timedelta(days=1),
    ).count()
    test_count = QualityTest.query.filter(
        QualityTest.test_date >= start_date,
        QualityTest.test_date < end_date + timedelta(days=1),
        QualityTest.result != 'pending',
    ).count()
    return inspection_count + test_count


def combined_pass_counts(start_date, end_date=None):
    """Count of QC records that passed in [start_date, end_date] -
    QualityInspection's 'accepted' and QualityTest's 'passed' are the
    same concept under different vocabulary."""
    end_date = end_date or start_date

    passed_inspections = QualityInspection.query.filter(
        QualityInspection.inspection_date >= start_date,
        QualityInspection.inspection_date < end_date + timedelta(days=1),
        QualityInspection.result == 'accepted',
    ).count()
    passed_tests = QualityTest.query.filter(
        QualityTest.test_date >= start_date,
        QualityTest.test_date < end_date + timedelta(days=1),
        QualityTest.result == 'passed',
    ).count()
    return passed_inspections + passed_tests


def combined_pass_rate(start_date, end_date=None):
    """(pass_rate_percent, total_count) tuple for [start_date, end_date]."""
    total = combined_inspection_counts(start_date, end_date)
    passed = combined_pass_counts(start_date, end_date)
    rate = (passed / total * 100) if total > 0 else 0
    return rate, total
