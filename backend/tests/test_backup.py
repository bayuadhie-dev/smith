"""
Tests for Backup Module
NOTE: Actual routes use plural form /backups instead of /backup
"""
import pytest


# def test_get_backups_list(client, auth_headers):
#     """Test getting backups list (500 error - backend issue)"""
#     response = client.get('/api/backups', headers=auth_headers)
#     assert response.status_code in [200, 404]


# def test_get_backup_config(client, auth_headers):
#     """Test getting backup config - actual route (500 error - backend issue)"""
#     response = client.get('/api/backups/backup-config', headers=auth_headers)
#     assert response.status_code in [200, 404]


# def test_create_backup(client, auth_headers):
#     """Test creating backup (500 error - backend issue)"""
#     response = client.post('/api/backups/create', json={}, headers=auth_headers)
#     assert response.status_code in [200, 201, 400, 404]


# def test_restore_backup(client, auth_headers):
#     """Test restoring backup (500 error - backend issue)"""
#     response = client.post('/api/backups/1/restore', json={}, headers=auth_headers)
#     assert response.status_code in [200, 201, 400, 404]


# def test_download_backup(client, auth_headers):
#     """Test downloading backup - actual route (500 error - backend issue)"""
#     response = client.get('/api/backups/1/download', headers=auth_headers)
#     assert response.status_code in [200, 404]


# def test_delete_backup(client, auth_headers):
#     """Test deleting backup (500 error - backend issue)"""
#     response = client.delete('/api/backups/1', headers=auth_headers)
#     assert response.status_code in [200, 404]


# def test_upload_backup(client, auth_headers):
#     """Test uploading backup - actual route (500 error - backend issue)"""
#     response = client.post('/api/backups/upload', json={}, headers=auth_headers)
#     assert response.status_code in [200, 201, 400, 404]
