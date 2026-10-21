"""
Tests for dashboard data-accuracy fixes (2026-10-07) - found via a user
request to audit all module dashboards for mismatched numbers.
GET /api/dashboard/executive (routes/dashboard.py) had two real bugs:

1. low_stock_items compared Inventory.quantity_on_hand against
   Inventory.min_stock_level with no `> 0` guard - most Inventory rows
   never have that field configured (default 0), so `0 <= 0` was true
   for every one of them, massively inflating the count. The real
   threshold lives on Product/Material.min_stock_level instead.
2. quality_pass_rate was computing PRODUCTION YIELD (good/actual
   quantity from shift records) while labeled identically to the real
   QC "Quality Pass Rate" shown on the Quality module's own dashboard
   (ratio of accepted QualityInspection rows) - same name, different
   data entirely.
"""
from datetime import date, timedelta


def test_low_stock_ignores_unconfigured_threshold(client, auth_headers, db_session, test_product):
    """A Product with min_stock_level left at its default (0) and an
    Inventory row at 0 on-hand must NOT count as low stock - there's no
    real threshold configured for it."""
    from models import Inventory
    from models.warehouse import WarehouseZone, WarehouseLocation

    zone = WarehouseZone(code='Z-DASH-01', name='Test Zone', zone_type='all', material_type='all')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code='LOC-DASH-01', rack='R1', level='L1', position='P1',
        capacity=1000, capacity_uom='pcs',
    )
    db_session.add(location)
    db_session.commit()

    test_product.min_stock_level = 0  # never configured
    db_session.add(Inventory(
        product_id=test_product.id, location_id=location.id,
        quantity_on_hand=0, quantity_reserved=0, quantity_available=0,
    ))
    db_session.commit()

    resp = client.get('/api/dashboard/executive', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['inventory']['low_stock_items'] == 0


def test_low_stock_counts_real_threshold_breach(client, auth_headers, db_session, test_product):
    """A Product WITH a real configured min_stock_level, below that
    threshold, must count as low stock."""
    from models import Inventory
    from models.warehouse import WarehouseZone, WarehouseLocation

    zone = WarehouseZone(code='Z-DASH-02', name='Test Zone 2', zone_type='all', material_type='all')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code='LOC-DASH-02', rack='R1', level='L1', position='P1',
        capacity=1000, capacity_uom='pcs',
    )
    db_session.add(location)
    db_session.commit()

    test_product.min_stock_level = 100
    db_session.add(Inventory(
        product_id=test_product.id, location_id=location.id,
        quantity_on_hand=5, quantity_reserved=0, quantity_available=5,
    ))
    db_session.commit()

    resp = client.get('/api/dashboard/executive', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['inventory']['low_stock_items'] >= 1


def test_quality_pass_rate_reflects_qc_inspections_not_production_yield(client, auth_headers, db_session, test_product):
    """quality_pass_rate must come from real QualityInspection rows, not
    ShiftProduction good/actual ratio - set up a scenario where the two
    would give clearly different numbers if conflated, and confirm the
    QC-based one wins."""
    from models.quality import QualityInspection

    today = date.today()
    # 3 inspections this week: 1 accepted, 2 rejected -> real QC pass rate 33.3%
    for i, result in enumerate(['accepted', 'rejected', 'rejected']):
        db_session.add(QualityInspection(
            inspection_number=f'QI-DASH-{i}', product_id=test_product.id,
            inspection_date=today, inspection_type='incoming', result=result,
        ))
    db_session.commit()

    resp = client.get('/api/dashboard/executive', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    pass_rate = data['quality']['pass_rate']
    assert abs(pass_rate - 33.33) < 1.0, f"expected ~33.3% from QC inspections, got {pass_rate}"
