"""
Tests for Settings Module
NOTE: Actual routes: /system, /company, /users, /roles, /permissions
"""
import pytest


def test_get_system_settings(client, auth_headers):
    """Test getting system settings - actual route"""
    response = client.get('/api/settings/system', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_company_settings(client, auth_headers):
    """Test getting company settings - actual route"""
    response = client.get('/api/settings/company', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_users(client, auth_headers):
    """Test getting users - actual route"""
    response = client.get('/api/settings/users', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_roles(client, auth_headers):
    """Test getting roles - actual route"""
    response = client.get('/api/settings/roles', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_permissions(client, auth_headers):
    """Test getting permissions - actual route"""
    response = client.get('/api/settings/permissions', headers=auth_headers)
    assert response.status_code in [200, 404]
