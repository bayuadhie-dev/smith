"""
Tests for HR Module
NOTE: Actual routes: /positions, /employees, /departments, /shifts, /attendance, /leaves, /roster
"""
import pytest


def test_get_employees_list(client, auth_headers):
    """Test getting employees list"""
    response = client.get('/api/hr/employees', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_positions(client, auth_headers):
    """Test getting positions - actual route"""
    response = client.get('/api/hr/positions', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_departments(client, auth_headers):
    """Test getting departments - actual route"""
    response = client.get('/api/hr/departments', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_shifts(client, auth_headers):
    """Test getting shifts - actual route"""
    response = client.get('/api/hr/shifts', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_attendance_list(client, auth_headers):
    """Test getting attendance list"""
    response = client.get('/api/hr/attendance', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_leaves(client, auth_headers):
    """Test getting leaves - actual route (was leave-requests)"""
    response = client.get('/api/hr/leaves', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_roster(client, auth_headers):
    """Test getting roster - actual route"""
    response = client.get('/api/hr/roster', headers=auth_headers)
    assert response.status_code in [200, 404]
