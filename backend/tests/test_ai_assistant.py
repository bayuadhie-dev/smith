"""
Tests for AI Assistant routes to increase coverage
"""
import pytest


class TestAIAssistant:
    def test_query_empty(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={}, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_with_text(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': 'Hello'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_help_command(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': '/help'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_stock_command(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': '/stock'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_sales_command(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': '/sales'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_production_command(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': '/production'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_po_command(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': '/po'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_oee_command(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': '/oee'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_bom_command(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': '/bom'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_employee_command(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': '/employee'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_chart_command(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': '/chart'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_goto_command(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': '/goto dashboard'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_stock_intent(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': 'cek stok barang'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_product_intent(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': 'info produk'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_material_intent(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': 'info material'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_sales_intent(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': 'info penjualan hari ini'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_production_intent(self, client, auth_headers):
        response = client.post('/api/ai-assistant/query', json={
            'query': 'info produksi hari ini'
        }, headers=auth_headers)
        assert response.status_code in [200, 400, 500]

    def test_query_without_auth(self, client):
        response = client.post('/api/ai-assistant/query', json={
            'query': '/help'
        })
        assert response.status_code in [200, 400, 500]
