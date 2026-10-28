import io

import openpyxl

from utils.import_center import Col, ImportKind, REGISTRY, register

SAVED = []


class _Dummy(ImportKind):
    key = 'dummy_test'
    label = 'Dummy'
    create_permission = 'finance.create'
    view_permission = 'finance.view'
    group_field = 'no'
    columns = [Col('no', 'No. Dokumen'), Col('tanggal', 'Tanggal', required=True), Col('nilai', 'Nilai', required=True)]

    def build(self, key, rows):
        from utils.import_center import parse_amount, parse_date
        total = sum(parse_amount(r['nilai']) for _, r in rows)
        d = parse_date(rows[0][1]['tanggal'])
        if total == 0:
            raise ValueError('Total tidak boleh 0')
        return {'key': key, 'total': total}, {'date': d.isoformat(), 'total': total}

    def save(self, data, user_id):
        if data['total'] > 1000:
            raise ValueError('Terlalu besar')
        SAVED.append(data['key'])
        return {'number': f"DOC-{data['key']}"}


def _xlsx(rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(['No. Dokumen', 'Tanggal', 'Nilai'])
    for r in rows:
        ws.append(r)
    b = io.BytesIO()
    wb.save(b)
    b.seek(0)
    return b


def _post(client, headers, buf, commit):
    return client.post('/api/imports/dummy_test', headers=headers, content_type='multipart/form-data',
                       data={'file': (buf, 'x.xlsx'), 'commit': '1' if commit else '0'})


def test_preview_then_commit_groups_and_skips_bad(client, auth_headers, db_session):
    register(_Dummy())
    rows = [['A', '2026-10-01', 100], ['A', '2026-10-01', 50], ['B', '2026-10-02', 5000], ['C', 'salah', 1], ['D', '2026-10-03', 0]]
    SAVED.clear()
    prev = _post(client, auth_headers, _xlsx(rows), False).get_json()
    assert prev['committed'] is False and prev['summary'] == {'total': 4, 'ok': 1, 'error': 3, 'amount': 150.0}
    assert SAVED == ['A']                                   # save() dipanggil saat pratinjau, lalu dibatalkan kerangka
    errs = [e for t in prev['transactions'] for e in t['errors']]
    assert any('Terlalu besar' in e for e in errs) and any('salah' in e for e in errs) and any('0' in e for e in errs)
    done = _post(client, auth_headers, _xlsx(rows), True).get_json()
    assert done['committed'] and [t['created'] for t in done['transactions'] if t['created']] == ['DOC-A']


def test_kinds_template_and_permission(client, auth_headers, db_session):
    register(_Dummy())
    kinds = client.get('/api/imports/kinds', headers=auth_headers).get_json()['kinds']
    assert any(k['key'] == 'dummy_test' and k['can_import'] for k in kinds)
    r = client.get('/api/imports/dummy_test/template', headers=auth_headers)
    assert r.status_code == 200 and r.data[:2] == b'PK'
    assert client.get('/api/imports/tidak_ada/template', headers=auth_headers).status_code == 404
    bad = client.post('/api/imports/dummy_test', headers=auth_headers, content_type='multipart/form-data', data={})
    assert bad.status_code == 400


def test_payment_kinds_registered_and_work_through_import_center(client, auth_headers, db_session):
    from datetime import date
    from models.finance import Payment
    from tests.test_finance_sync_regressions import _acc, _bank
    bank, beban = _bank(db_session), _acc(db_session, '6-6000')
    kinds = {k['key'] for k in client.get('/api/imports/kinds', headers=auth_headers).get_json()['kinds']}
    assert {'receipt_kas', 'receipt_invoice', 'payment_kas', 'payment_invoice'} <= kinds
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(['Tanggal', 'No. Bukti', 'Kas/Bank', 'Akun Lawan', 'Nilai', 'Pihak', 'Keterangan', 'No. Referensi'])
    today = date.today().isoformat()
    ws.append([today, 'IMP-PC1', bank.account_code, beban.account_code, 75000, 'PT A', 'Biaya', ''])
    ws.append([today, 'IMP-PC1', bank.account_code, beban.account_code, 0, '', 'nol dilewati', ''])
    ws.append([today, 'IMP-PC2', bank.account_code, 'TIDAK-ADA', 5, '', '', ''])
    def fresh():
        b = io.BytesIO()
        wb.save(b)
        b.seek(0)
        return b
    before = Payment.query.count()
    prev = client.post('/api/imports/payment_kas', headers=auth_headers, content_type='multipart/form-data', data={'file': (fresh(), 'p.xlsx'), 'commit': '0'}).get_json()
    assert prev['summary']['ok'] == 1 and prev['summary']['error'] == 1 and prev['summary']['amount'] == 75000.0
    assert Payment.query.count() == before
    done = client.post('/api/imports/payment_kas', headers=auth_headers, content_type='multipart/form-data', data={'file': (fresh(), 'p.xlsx'), 'commit': '1'}).get_json()
    assert done['committed'] and Payment.query.filter_by(payment_number='IMP-PC1').count() == 1
