def test_generate_pdf_from_rows(client, auth_headers):
    body = {'type': 'income-statement-2026', 'data': {'title': 'Income Statement - 2026', 'period': '2026',
            'data': [{'Item': 'Sales Revenue', 'Amount': 1500000}, {'Item': 'Net Income', 'Amount': 250000.5}]}}
    r = client.post('/api/finance/reports/generate-pdf', json=body, headers=auth_headers)
    assert r.status_code == 200 and r.mimetype == 'application/pdf' and r.data[:4] == b'%PDF'


def test_generate_pdf_rejects_empty_or_bad_data(client, auth_headers):
    for body in ({}, {'data': {'data': []}}, {'data': {'data': ['x']}}):
        assert client.post('/api/finance/reports/generate-pdf', json=body, headers=auth_headers).status_code == 400
