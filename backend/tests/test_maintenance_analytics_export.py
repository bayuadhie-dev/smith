import io

import openpyxl

from tests.test_maintenance_analytics_real_data import _make_machine, _make_record

XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


def test_export_is_real_xlsx_with_same_numbers_as_analytics(client, auth_headers, db_session):
    m = _make_machine(db_session)
    _make_record(db_session, m, maintenance_type='corrective', cost=500000, downtime_hours=3.0, duration_hours=4.5)
    _make_record(db_session, m, maintenance_type='preventive', cost=200000, downtime_hours=0, duration_hours=2)

    api = client.get('/api/maintenance/analytics', headers=auth_headers).get_json()
    r = client.get('/api/maintenance/analytics/export?format=excel', headers=auth_headers)
    assert r.status_code == 200
    assert r.mimetype == XLSX
    cd = r.headers['Content-Disposition']
    assert 'maintenance-analitik-' in cd and '.xlsx' in cd

    wb = openpyxl.load_workbook(io.BytesIO(r.data))
    assert wb.sheetnames == ['Ringkasan', 'Per Jenis', 'Tren Bulanan', 'Per Mesin', 'Biaya', 'Downtime']
    summary = {row[0]: row[1] for row in wb['Ringkasan'].iter_rows(min_row=2, values_only=True)}
    assert summary['Total perintah kerja'] == api['summary']['total_work_orders'] == 2
    assert summary['Total biaya'] == 700000
    assert summary['MTTR (jam)'] == api['summary']['mttr']
    per_machine = list(wb['Per Mesin'].iter_rows(min_row=2, values_only=True))
    assert per_machine and per_machine[0][0] == m.name and per_machine[0][2] == 2


def test_export_rejects_unsupported_format(client, auth_headers, db_session):
    r = client.get('/api/maintenance/analytics/export?format=pdf', headers=auth_headers)
    assert r.status_code == 400 and 'format=excel' in r.get_json()['error']
