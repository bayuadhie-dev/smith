"""
Fase 20 (fix_report_3.md, 2026-10-03): found live while verifying the demo
chain was screenshot-ready - GET /api/wms/transactions and
GET /api/wms/transactions/summary (the "Transaksi Stok" / MB51-style page)
and GET /api/materials/stock/movements both filtered
`InventoryTransaction.transaction_date <= datetime.fromisoformat(end_date)`
where end_date is a bare date string (e.g. "2026-10-02") from the
frontend's date picker - that parses to midnight, so a transaction
recorded later that SAME day (e.g. 2026-10-02 06:48) was silently
excluded. A "Bulan Ini" search for today's own WO completion never showed
it. Fixed with a shared `_end_of_day_filter_bound()` helper that extends a
bare-date end_date to 23:59:59.999999 of that day; a caller-supplied
end_date that already carries a time component is left untouched.
"""
from datetime import datetime, timedelta
import pytest


@pytest.fixture
def warehouse_location(db_session):
    from models.warehouse import WarehouseZone, WarehouseLocation

    zone = WarehouseZone(code='Z-F20', name='Zone Fase 20 Test', material_type='finished_goods')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code='LOC-F20', rack='R1', level='L1', position='P1',
        capacity=10000, capacity_uom='pcs', is_active=True,
    )
    db_session.add(location)
    db_session.commit()
    return location


def _make_txn(db_session, test_product, warehouse_location, transaction_date, transaction_number):
    from models.wms_advanced import InventoryTransaction

    txn = InventoryTransaction(
        transaction_number=transaction_number,
        transaction_type='production_receipt',
        transaction_date=transaction_date,
        product_id=test_product.id,
        quantity=10,
        direction='in',
        to_location_id=warehouse_location.id,
    )
    db_session.add(txn)
    db_session.commit()
    return txn


def test_end_date_without_time_includes_transactions_later_same_day(client, auth_headers, db_session, test_product, warehouse_location):
    today = datetime.now().date()
    morning = datetime.combine(today, datetime.min.time()) + timedelta(hours=6, minutes=48)
    _make_txn(db_session, test_product, warehouse_location, morning, 'TXN-F20-TEST-001')

    resp = client.get(
        f'/api/wms/transactions?start_date={today.isoformat()}&end_date={today.isoformat()}',
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()
    numbers = [t['transaction_number'] for t in data['transactions']]
    assert 'TXN-F20-TEST-001' in numbers, (
        "transaksi yang dicatat siang hari harus tetap muncul saat end_date "
        "diisi hari yang sama (tanpa jam)"
    )


def test_transactions_summary_also_includes_same_day(client, auth_headers, db_session, test_product, warehouse_location):
    today = datetime.now().date()
    evening = datetime.combine(today, datetime.min.time()) + timedelta(hours=17, minutes=51)
    _make_txn(db_session, test_product, warehouse_location, evening, 'TXN-F20-TEST-002')

    resp = client.get(
        f'/api/wms/transactions/summary?start_date={today.isoformat()}&end_date={today.isoformat()}',
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()
    assert data['total_in'] >= 10


def test_end_date_with_explicit_time_is_not_altered(client, auth_headers, db_session, test_product, warehouse_location):
    """Kalau caller sudah kasih jam eksplisit, jangan diutak-atik lagi -
    cuma end_date tanpa komponen jam (date-only picker) yang perlu
    diperpanjang ke akhir hari."""
    today = datetime.now().date()
    late_morning = datetime.combine(today, datetime.min.time()) + timedelta(hours=10)
    _make_txn(db_session, test_product, warehouse_location, late_morning, 'TXN-F20-TEST-003')

    cutoff = datetime.combine(today, datetime.min.time()) + timedelta(hours=9)
    resp = client.get(
        f'/api/wms/transactions?end_date={cutoff.isoformat()}',
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.get_json()
    numbers = [t['transaction_number'] for t in resp.get_json()['transactions']]
    assert 'TXN-F20-TEST-003' not in numbers, (
        "end_date dengan jam eksplisit (09:00) tidak boleh diperpanjang ke "
        "akhir hari - transaksi jam 10:00 harus tetap ter-exclude"
    )


def test_shift_production_reject_is_not_mislabeled_as_opname_adjustment(db_session):
    """Found alongside the end_date bug above (same live verification pass):
    the reject-landing InventoryTransaction (Fase 15) uses
    transaction_type='adjustment', which derive_movement_type_code()
    mapped to code 701 "Penyesuaian Opname (Lebih)" (stock opname count
    correction) regardless of reference_type - mislabeling a real
    production reject as a stock count adjustment. Fixed with a dedicated
    branch checked before the generic 'adjustment' catch-all."""
    from routes.wms_advanced import derive_movement_type_code

    class FakeTxn:
        transaction_type = 'adjustment'
        reference_type = 'shift_production_reject'
        direction = 'in'

    code, label = derive_movement_type_code(FakeTxn())
    assert code == '552'
    assert 'Reject' in label

    # A genuine stock opname adjustment (no shift_production_reject
    # reference) must still map to 701/702 as before - regression check.
    class FakeOpnameTxn:
        transaction_type = 'adjustment'
        reference_type = 'stock_opname'
        direction = 'in'

    code, label = derive_movement_type_code(FakeOpnameTxn())
    assert code == '701'
