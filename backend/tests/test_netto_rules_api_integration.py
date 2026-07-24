"""
End-to-End Integration Tests for Super Admin Netto Deduction Rules Endpoints (/api/config/netto-deductions)
Using Flask Test Client (HTTP requests).
"""

import pytest
import json
import os
import csv
from models.user import User
from models.product import Product
from models.settings_extended import AuditLog


@pytest.fixture
def super_admin_user(app, db_session):
    """Create a Super Admin user"""
    password_hash = app.bcrypt.generate_password_hash('superpass123').decode('utf-8')
    user = User(
        username='superadmin_test',
        email='super@example.com',
        full_name='Super Admin Test',
        password_hash=password_hash,
        is_admin=True,
        is_super_admin=True,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def normal_user(app, db_session):
    """Create a normal non-super-admin user"""
    password_hash = app.bcrypt.generate_password_hash('normpass123').decode('utf-8')
    user = User(
        username='normaluser_test',
        email='normal@example.com',
        full_name='Normal User Test',
        password_hash=password_hash,
        is_admin=False,
        is_super_admin=False,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def super_admin_headers(client, super_admin_user):
    """JWT headers for Super Admin"""
    response = client.post('/api/auth/login', json={
        'username': 'superadmin_test',
        'password': 'superpass123'
    })
    token = response.json['access_token']
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def normal_headers(client, normal_user):
    """JWT headers for non-super-admin"""
    response = client.post('/api/auth/login', json={
        'username': 'normaluser_test',
        'password': 'normpass123'
    })
    token = response.json['access_token']
    return {'Authorization': f'Bearer {token}'}


class TestNettoRulesE2E:

    def test_get_netto_rules_happy_path(self, client, super_admin_headers):
        """GET /api/config/netto-deductions returns rules and product list for super admin"""
        response = client.get('/api/config/netto-deductions', headers=super_admin_headers)
        assert response.status_code == 200
        data = response.json
        assert data['success'] is True
        assert 'rules' in data
        assert 'products' in data

    def test_forbidden_non_super_admin_403(self, client, normal_headers):
        """Non-super-admin user receives 403 Forbidden on all 4 CRUD endpoints"""
        # GET
        res_get = client.get('/api/config/netto-deductions', headers=normal_headers)
        assert res_get.status_code == 403

        # POST
        res_post = client.post('/api/config/netto-deductions', json={
            'rule_type': 'pattern',
            'match_value': 'UNAUTHORIZED',
            'deduction_kg': 0.5
        }, headers=normal_headers)
        assert res_post.status_code == 403

        # PUT
        res_put = client.put('/api/config/netto-deductions', json={
            'target_rule_type': 'pattern',
            'target_match_value': 'POLYMORPH',
            'rule_type': 'pattern',
            'match_value': 'POLYMORPH',
            'deduction_kg': 0.9
        }, headers=normal_headers)
        assert res_put.status_code == 403

        # DELETE
        res_del = client.delete('/api/config/netto-deductions', json={
            'rule_type': 'pattern',
            'match_value': 'POLYMORPH'
        }, headers=normal_headers)
        assert res_del.status_code == 403

    def test_add_netto_rule_happy_path(self, client, super_admin_headers):
        """POST /api/config/netto-deductions adds new pattern rule atomically + AuditLog"""
        res = client.post('/api/config/netto-deductions', json={
            'rule_type': 'pattern',
            'match_value': 'TEST_E2E_PATTERN',
            'deduction_kg': 0.75
        }, headers=super_admin_headers)
        
        assert res.status_code == 201
        data = res.json
        assert data['success'] is True
        assert any(r['match_value'] == 'TEST_E2E_PATTERN' for r in data['rules'])

        # Clean up added rule
        client.delete('/api/config/netto-deductions', json={
            'rule_type': 'pattern',
            'match_value': 'TEST_E2E_PATTERN'
        }, headers=super_admin_headers)

    def test_add_netto_rule_duplicate_409(self, client, super_admin_headers):
        """POST /api/config/netto-deductions returns 409 Conflict when adding duplicate rule"""
        rule_payload = {
            'rule_type': 'pattern',
            'match_value': 'DUP_TEST_PATTERN',
            'deduction_kg': 0.60
        }
        # First creation
        res1 = client.post('/api/config/netto-deductions', json=rule_payload, headers=super_admin_headers)
        assert res1.status_code == 201

        # Second creation (duplicate)
        res2 = client.post('/api/config/netto-deductions', json=rule_payload, headers=super_admin_headers)
        assert res2.status_code == 409
        assert 'sudah ada' in res2.json['message']

        # Clean up
        client.delete('/api/config/netto-deductions', json={
            'rule_type': 'pattern',
            'match_value': 'DUP_TEST_PATTERN'
        }, headers=super_admin_headers)

    def test_add_netto_rule_invalid_product_404(self, client, super_admin_headers):
        """POST /api/config/netto-deductions returns 404 when product_id does not exist in DB"""
        res = client.post('/api/config/netto-deductions', json={
            'rule_type': 'product_id',
            'match_value': '99999999',  # Non-existent product ID
            'deduction_kg': 0.862
        }, headers=super_admin_headers)
        
        assert res.status_code == 404
        assert 'tidak ditemukan' in res.json['message']

    def test_update_netto_rule_composite_key_happy_path(self, client, super_admin_headers):
        """PUT /api/config/netto-deductions updates rule using composite key"""
        # Create initial rule
        client.post('/api/config/netto-deductions', json={
            'rule_type': 'pattern',
            'match_value': 'UPDATE_TARGET_PATTERN',
            'deduction_kg': 0.50
        }, headers=super_admin_headers)

        # Update via composite key
        res = client.put('/api/config/netto-deductions', json={
            'target_rule_type': 'pattern',
            'target_match_value': 'UPDATE_TARGET_PATTERN',
            'rule_type': 'pattern',
            'match_value': 'UPDATE_TARGET_PATTERN',
            'deduction_kg': 0.999
        }, headers=super_admin_headers)

        assert res.status_code == 200
        data = res.json
        updated_rule = next(r for r in data['rules'] if r['match_value'] == 'UPDATE_TARGET_PATTERN')
        assert updated_rule['deduction_kg'] == 0.999

        # Clean up
        client.delete('/api/config/netto-deductions', json={
            'rule_type': 'pattern',
            'match_value': 'UPDATE_TARGET_PATTERN'
        }, headers=super_admin_headers)

    def test_update_netto_rule_missing_composite_key_400(self, client, super_admin_headers):
        """PUT /api/config/netto-deductions returns 400 Bad Request when composite key is missing"""
        res = client.put('/api/config/netto-deductions', json={
            'rule_type': 'pattern',
            'match_value': 'SOMETHING',
            'deduction_kg': 0.5
        }, headers=super_admin_headers)
        assert res.status_code == 400
        assert 'wajib disertakan' in res.json['message']

    def test_delete_netto_rule_composite_key_happy_path(self, client, super_admin_headers):
        """DELETE /api/config/netto-deductions deletes rule using composite key"""
        # Create rule
        client.post('/api/config/netto-deductions', json={
            'rule_type': 'pattern',
            'match_value': 'DELETE_TARGET_PATTERN',
            'deduction_kg': 0.70
        }, headers=super_admin_headers)

        # Delete rule
        res = client.delete('/api/config/netto-deductions', json={
            'rule_type': 'pattern',
            'match_value': 'DELETE_TARGET_PATTERN'
        }, headers=super_admin_headers)

        assert res.status_code == 200
        assert not any(r['match_value'] == 'DELETE_TARGET_PATTERN' for r in res.json['rules'])

    def test_delete_netto_rule_not_found_404(self, client, super_admin_headers):
        """DELETE /api/config/netto-deductions returns 404 Not Found for non-existent composite key"""
        res = client.delete('/api/config/netto-deductions', json={
            'rule_type': 'pattern',
            'match_value': 'NON_EXISTENT_KEY_XYZ'
        }, headers=super_admin_headers)
        assert res.status_code == 404
        assert 'tidak ditemukan' in res.json['message']
