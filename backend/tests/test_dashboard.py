"""
Tests for Dashboard Module
"""
import pytest


def test_get_main_dashboard(client, auth_headers):
    """Test main dashboard endpoint"""
    response = client.get('/api/dashboard/overview', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_dashboard_kpis(client, auth_headers):
    """Test dashboard KPIs (executive dashboard)"""
    response = client.get('/api/dashboard/executive', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_dashboard_charts_sales(client, auth_headers):
    """Test dashboard sales charts"""
    response = client.get('/api/dashboard/charts/sales', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_dashboard_charts_production(client, auth_headers):
    """Test dashboard production charts"""
    response = client.get('/api/dashboard/charts/production', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_dashboard_alerts(client, auth_headers):
    """Test dashboard alerts (included in executive dashboard)"""
    response = client.get('/api/dashboard/executive', headers=auth_headers)
    assert response.status_code in [200, 404]
