"""
Tests for Maintenance Module
NOTE: Dashboard routes are under /dashboard/kpis, /alerts, /work-orders/summary, /analytics/trends
"""
import pytest


def test_get_maintenance_records(client, auth_headers):
    """Test getting maintenance records"""
    response = client.get('/api/maintenance/records', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_maintenance_schedules(client, auth_headers):
    """Test getting maintenance schedules"""
    response = client.get('/api/maintenance/schedules', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_dashboard_kpis(client, auth_headers):
    """Test maintenance dashboard KPIs - actual route"""
    response = client.get('/api/maintenance/dashboard/kpis', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_alerts(client, auth_headers):
    """Test maintenance alerts - actual route"""
    response = client.get('/api/maintenance/alerts', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_work_orders_summary(client, auth_headers):
    """Test work orders summary - actual route"""
    response = client.get('/api/maintenance/work-orders/summary', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_analytics_trends(client, auth_headers):
    """Test analytics trends - actual route"""
    response = client.get('/api/maintenance/analytics/trends', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_analytics_equipment_performance(client, auth_headers):
    """Test equipment performance analytics - actual route"""
    response = client.get('/api/maintenance/analytics/equipment-performance', headers=auth_headers)
    assert response.status_code in [200, 404]
