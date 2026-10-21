"""
Tests for utils/quality_metrics.py (2026-10-07) - user asked to check the
QC dashboard, which led to discovering QC is tracked in TWO parallel
tables (QualityInspection for incoming-materials QC, QualityTest for
finished-goods QC on completed Work Orders) that no dashboard ever read
together - "Quality Pass Rate" only reflected QualityInspection (~1 real
row) while QualityTest held 608 real records invisible to every
dashboard. User asked to combine them.
"""
from datetime import date, timedelta


def test_combined_pass_rate_includes_both_tables(client, db_session, test_product):
    from models.quality import QualityInspection, QualityTest

    today = date.today()

    # 1 QualityInspection: accepted
    db_session.add(QualityInspection(
        inspection_number='QI-COMB-001', product_id=test_product.id,
        inspection_date=today, inspection_type='incoming', result='accepted',
    ))
    # 2 QualityTest: 1 passed, 1 failed
    db_session.add(QualityTest(
        test_number='QT-COMB-001', product_id=test_product.id,
        test_date=today, test_type='final', result='passed',
    ))
    db_session.add(QualityTest(
        test_number='QT-COMB-002', product_id=test_product.id,
        test_date=today, test_type='final', result='failed',
    ))
    db_session.commit()

    from utils.quality_metrics import combined_pass_rate, combined_inspection_counts

    total = combined_inspection_counts(today)
    assert total == 3  # 1 inspection + 2 tests

    rate, total2 = combined_pass_rate(today)
    assert total2 == 3
    assert abs(rate - (2 / 3 * 100)) < 0.01  # 2 passed (1 accepted + 1 passed) out of 3


def test_combined_pass_rate_excludes_pending_quality_tests(client, db_session, test_product):
    """A QualityTest still at its default 'pending' result hasn't been
    determined yet - must not count as a completed/failed test, same as
    a pending QualityInspection wouldn't count as a completed inspection."""
    from models.quality import QualityTest

    today = date.today()
    db_session.add(QualityTest(
        test_number='QT-COMB-PENDING', product_id=test_product.id,
        test_date=today, test_type='final', result='pending',
    ))
    db_session.commit()

    from utils.quality_metrics import combined_inspection_counts
    assert combined_inspection_counts(today) == 0


def test_quality_enhanced_dashboard_reflects_quality_test_data(client, auth_headers, db_session, test_product):
    """The real-world bug this is fixing: QualityTest data (the bulk of
    real QC activity, 608 rows in production) was completely invisible to
    the Quality module's own dashboard. A fresh QualityTest row must move
    inspections_this_week off zero."""
    from models.quality import QualityTest

    today = date.today()
    db_session.add(QualityTest(
        test_number='QT-DASH-001', product_id=test_product.id,
        test_date=today, test_type='final', result='passed',
    ))
    db_session.commit()

    resp = client.get('/api/quality-enhanced/dashboard', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['summary']['inspections_this_week'] >= 1
    assert data['summary']['pass_rate'] > 0


def test_main_dashboard_quality_pass_rate_matches_quality_module(client, auth_headers, db_session, test_product):
    """routes/dashboard.py's 'Quality Pass Rate' card and
    routes/quality_enhanced.py's own dashboard must report the SAME
    number now - the original bug was these two disagreeing under an
    identical label."""
    from models.quality import QualityTest

    today = date.today()
    db_session.add(QualityTest(
        test_number='QT-MATCH-001', product_id=test_product.id,
        test_date=today, test_type='final', result='passed',
    ))
    db_session.commit()

    r1 = client.get('/api/dashboard/executive', headers=auth_headers)
    r2 = client.get('/api/quality-enhanced/dashboard', headers=auth_headers)
    assert r1.status_code == 200
    assert r2.status_code == 200

    main_rate = r1.get_json()['quality']['pass_rate']
    qc_rate = r2.get_json()['summary']['pass_rate']
    assert abs(main_rate - qc_rate) < 0.01
