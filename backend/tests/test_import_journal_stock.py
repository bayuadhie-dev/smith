import io
from datetime import date

import openpyxl

from tests.test_finance_sync_regressions import _acc


def _xlsx(headers, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(headers)
    for r in rows:
        ws.append(r)
    b = io.BytesIO()
    wb.save(b)
    b.seek(0)
    return b


def _post(client, headers, kind, buf, commit):
    return client.post(f'/api/imports/{kind}', headers=headers, content_type='multipart/form-data',
                       data={'file': (buf, 'x.xlsx'), 'commit': '1' if commit else '0'}).get_json()


JU = ['No. Jurnal', 'Tanggal', 'Kode Akun', 'Debit', 'Kredit', 'Keterangan Baris', 'Keterangan Jurnal']


def test_manual_journal_preview_commit_and_rejections(client, auth_headers, db_session):
    from models.finance import AccountingEntry
    kas, beban = _acc(db_session, '1-1010'), _acc(db_session, '6-6000')
    today = date.today().isoformat()
    rows = [['JU-A', today, beban.account_code, 1000, '', '', 'Biaya'], ['JU-A', today, kas.account_code, '', 1000, '', ''],
            ['JU-B', today, beban.account_code, 500, '', '', ''], ['JU-B', today, kas.account_code, '', 400, '', ''],
            ['JU-C', today, 'TIDAK-ADA', 100, '', '', ''], ['JU-C', today, kas.account_code, '', 100, '', ''],
            ['JU-D', today, beban.account_code, 100, 100, '', '']]
    before = AccountingEntry.query.count()
    prev = _post(client, auth_headers, 'manual_journal', _xlsx(JU, rows), False)
    assert prev['summary']['ok'] == 1 and prev['summary']['error'] == 3
    assert AccountingEntry.query.count() == before                       # pratinjau tidak menyimpan
    errs = ' | '.join(e for t in prev['transactions'] for e in t['errors'])
    assert 'tidak seimbang' in errs and 'TIDAK-ADA' in errs and 'salah satu' in errs
    done = _post(client, auth_headers, 'manual_journal', _xlsx(JU, rows), True)
    assert done['summary']['ok'] == 1
    ents = AccountingEntry.query.filter_by(reference_type='manual_journal', reference_number='JU-A').all()
    assert len(ents) == 2 and sum(float(e.debit_amount) for e in ents) == sum(float(e.credit_amount) for e in ents) == 1000
    again = _post(client, auth_headers, 'manual_journal', _xlsx(JU, rows[:2]), True)    # nomor sama ditolak
    assert again['summary']['ok'] == 0 and 'sudah pernah dipakai' in again['transactions'][0]['errors'][0]


def test_opening_balance_one_journal_per_date_and_must_balance(client, auth_headers, db_session):
    from models.finance import AccountingEntry
    kas, modal = _acc(db_session, '1-1010'), _acc(db_session, '6-6000')
    h = ['Tanggal Saldo Awal', 'Kode Akun', 'Debit', 'Kredit', 'Keterangan']
    ok = _post(client, auth_headers, 'opening_balance', _xlsx(h, [['2026-01-01', kas.account_code, 900, '', ''], ['2026-01-01', modal.account_code, '', 900, '']]), True)
    assert ok['summary'] == {'total': 1, 'ok': 1, 'error': 0, 'amount': 900.0}
    assert AccountingEntry.query.filter_by(reference_number='SALDO-AWAL-2026-01-01').count() == 2
    bad = _post(client, auth_headers, 'opening_balance', _xlsx(h, [['2026-02-01', kas.account_code, 900, '', ''], ['2026-02-01', modal.account_code, '', 800, '']]), True)
    assert bad['summary']['ok'] == 0 and 'tidak seimbang' in bad['transactions'][0]['errors'][0]


def test_opening_stock_adds_lot_and_movement_and_skips_bad_rows(client, auth_headers, db_session, test_material):
    from models.warehouse import Inventory, WarehouseLocation, WarehouseZone
    from models.wms_advanced import InventoryTransaction
    zone = WarehouseZone(code='Z-IMP', name='Z Imp', material_type='raw_materials')
    db_session.add(zone)
    db_session.commit()
    loc = WarehouseLocation(zone_id=zone.id, location_code='LOC-IMP', rack='R1', level='L1', position='P1', capacity=100000, capacity_uom='kg')
    db_session.add(loc)
    db_session.commit()
    h = ['Tanggal', 'Kode Barang', 'Lokasi', 'Batch/Lot', 'Qty', 'Harga Pokok', 'Keterangan']
    rows = [['2026-01-01', test_material.code, 'LOC-IMP', 'B1', 120, 25, 'awal'], ['2026-01-01', 'XXX', 'LOC-IMP', '', 5, '', ''],
            ['2026-01-01', test_material.code, 'LOKASI-SALAH', '', 5, '', ''], ['2026-01-01', test_material.code, 'LOC-IMP', '', 0, '', '']]
    prev = _post(client, auth_headers, 'opening_stock', _xlsx(h, rows), False)
    assert prev['summary']['ok'] == 1 and prev['summary']['error'] == 3
    assert Inventory.query.filter_by(material_id=test_material.id).count() == 0           # pratinjau tidak menambah stok
    done = _post(client, auth_headers, 'opening_stock', _xlsx(h, rows), True)
    assert done['summary']['ok'] == 1
    inv = Inventory.query.filter_by(material_id=test_material.id, location_id=loc.id, batch_number='B1').one()
    assert float(inv.quantity_on_hand) == 120.0
    tx = InventoryTransaction.query.filter_by(material_id=test_material.id, transaction_type='stock_in').one()
    assert float(tx.quantity) == 120.0 and float(tx.unit_cost) == 25.0 and tx.transaction_date.date() == date(2026, 1, 1)
