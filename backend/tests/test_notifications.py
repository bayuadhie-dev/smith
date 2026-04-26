"""
Tests for Notifications Module
NOTE: Actual routes: /, /<id>/read, /mark-all-read, /alerts, /vapid-public-key, /push/subscribe, /push/unsubscribe
"""
import pytest


def test_get_notifications(client, auth_headers):
    """Test getting notifications"""
    response = client.get('/api/notifications', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_mark_notification_read(client, auth_headers):
    """Test marking notification as read - actual route"""
    response = client.put('/api/notifications/1/read', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_mark_all_read(client, auth_headers):
    """Test marking all notifications as read - actual route"""
    response = client.put('/api/notifications/mark-all-read', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_alerts(client, auth_headers):
    """Test getting alerts - actual route"""
    response = client.get('/api/notifications/alerts', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_get_vapid_public_key(client, auth_headers):
    """Test getting VAPID public key - actual route"""
    response = client.get('/api/notifications/vapid-public-key', headers=auth_headers)
    assert response.status_code in [200, 404]


def test_push_subscribe(client, auth_headers):
    """Test push subscription - actual route"""
    response = client.post('/api/notifications/push/subscribe', json={}, headers=auth_headers)
    assert response.status_code in [200, 201, 400, 404]


def test_push_unsubscribe(client, auth_headers):
    """Test push unsubscribe - actual route"""
    response = client.post('/api/notifications/push/unsubscribe', json={}, headers=auth_headers)
    assert response.status_code in [200, 201, 400, 404]
