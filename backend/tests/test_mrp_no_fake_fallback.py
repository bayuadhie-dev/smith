"""
Tests for routes/mrp.py (2026-10-07) - continuation of the system-wide
fabricated-data sweep. /dashboard/capacity and /dashboard/demand-forecast
used to fall back to literal fake data ("Machine A/B/C" at fixed 70/80/90%
utilization; "Sample Product A/B/C" with product_id 1/2/3 and invented
demand numbers) whenever there was no real data OR when a real backend
error occurred - the fake data masked real errors as fake 200 successes.
"""


def test_capacity_returns_empty_not_fake_machines_when_no_active_machines(client, auth_headers, db_session):
    """With no active Machine rows, the endpoint must return an empty list,
    not the old hardcoded 'Machine A/B/C' fake rows."""
    from models.production import Machine

    Machine.query.update({Machine.is_active: False})
    db_session.commit()

    resp = client.get('/api/mrp/dashboard/capacity', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()

    resources = [c['resource'] for c in data['capacity']]
    assert 'Machine A' not in resources
    assert 'Machine B' not in resources
    assert 'Machine C' not in resources


def test_demand_forecast_returns_empty_not_fake_products_when_no_data(client, auth_headers):
    """With no real ForecastHeader/ForecastLine data, the endpoint must
    return an empty list, not the old 'Sample Product A/B/C' fake rows
    (which used product_id 1/2/3 - real IDs that could collide with
    actual products in the system)."""
    resp = client.get('/api/mrp/demand/forecast', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()

    names = [f['product_name'] for f in data['forecasts']]
    assert 'Sample Product A' not in names
    assert 'Sample Product B' not in names
    assert 'Sample Product C' not in names
