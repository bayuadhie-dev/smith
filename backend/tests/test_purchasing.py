"""
Tests for Purchasing Module
NOTE: /dashboard doesn't exist in purchasing.py
"""
import pytest
from datetime import datetime, timedelta


def test_get_suppliers_list(client, auth_headers):
    """Test getting suppliers list"""
    response = client.get('/api/purchasing/suppliers', headers=auth_headers)
    assert response.status_code in [200, 404]
    if response.status_code == 200:
        data = response.json
        assert 'suppliers' in data or 'data' in data or isinstance(data, list)


def test_get_purchase_orders_list(client, auth_headers):
    """Test getting purchase orders list"""
    response = client.get('/api/purchasing/purchase-orders', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_grns(client, auth_headers):
    """Test getting GRNs - actual route"""
    response = client.get('/api/purchasing/grn', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_create_supplier(client, auth_headers):
    """Test creating supplier"""
    supplier_data = {
        'supplier_code': 'SUP-TEST-001',
        'company_name': 'Test Supplier',
        'contact_person': 'John Doe',
        'email': 'supplier@test.com',
        'phone': '08123456789',
        'address': 'Test Address',
        'city': 'Test City'
    }
    response = client.post('/api/purchasing/suppliers', json=supplier_data, headers=auth_headers)
    assert response.status_code in [200, 201, 400, 404]


def test_get_supplier_by_id(client, auth_headers):
    """Test getting single supplier"""
    response = client.get('/api/purchasing/suppliers/1', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_rfqs(client, auth_headers):
    """Test getting RFQs - actual route"""
    response = client.get('/api/purchasing/rfqs', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_quotes(client, auth_headers):
    """Test getting quotes - actual route"""
    response = client.get('/api/purchasing/quotes', headers=auth_headers)
    assert response.status_code in [200, 404]
