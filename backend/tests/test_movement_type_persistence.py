"""
SAP-equivalence plan item #1 (2026-10-05): SAP-style 3-digit movement type
codes (101/131/261/311/551/552/601/701/702/999) are now persisted on
InventoryTransaction.movement_type at write time (via
utils.inventory_helpers.derive_movement_type_code(), called from
record_inventory_transaction() and the handful of raw
InventoryTransaction(...) construction sites) instead of being derived
fresh on every read. These tests cover: the derivation logic itself,
record_inventory_transaction() persisting it, GET /api/wms/transactions'
movement_type filter, and the read-time fallback for legacy rows where the
column is still NULL.
"""
import pytest


def test_derive_movement_type_code_covers_known_cases():
    from utils.inventory_helpers import derive_movement_type_code

    class FakeTxn:
        def __init__(self, transaction_type, reference_type, direction):
            self.transaction_type = transaction_type
            self.reference_type = reference_type
            self.direction = direction

    cases = [
        (('stock_in', 'purchase_order', 'in'), '101'),
        (('production_receipt', 'fg_conversion', 'in'), '131'),
        (('material_issue', 'material_issue', 'out'), '261'),
        (('transfer', None, 'out'), '311'),
        (('qc_disposition', None, 'out'), '551'),
        (('adjustment', 'shift_production_reject', 'in'), '552'),
        (('sales_delivery', 'sales_order', 'out'), '601'),
        (('adjustment', None, 'in'), '701'),
        (('adjustment', None, 'out'), '702'),
        (('something_else', None, 'in'), '999'),
    ]
    for (t, ref, direction), expected_code in cases:
        code, label = derive_movement_type_code(FakeTxn(t, ref, direction))
        assert code == expected_code, f'{t}/{ref}/{direction} -> expected {expected_code}, got {code}'
        assert label


def test_record_inventory_transaction_persists_movement_type(app, db_session, test_product):
    from utils.inventory_helpers import record_inventory_transaction
    from models import db

    with app.app_context():
        txn = record_inventory_transaction(
            transaction_type='material_issue', direction='out', quantity=10,
            product_id=test_product.id, reference_type='material_issue', reference_id=1,
        )
        db.session.commit()

        assert txn.movement_type == '261'


def test_transactions_list_filters_by_movement_type(client, auth_headers, db_session, test_product):
    from utils.inventory_helpers import record_inventory_transaction
    from models import db

    record_inventory_transaction(
        transaction_type='material_issue', direction='out', quantity=5,
        product_id=test_product.id, reference_type='material_issue', reference_id=1,
    )
    record_inventory_transaction(
        transaction_type='transfer', direction='out', quantity=3,
        product_id=test_product.id,
    )
    db.session.commit()

    resp = client.get('/api/wms/transactions', query_string={'movement_type': '261'}, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['pagination']['total'] >= 1
    assert all(t['movement_type_code'] == '261' for t in data['transactions'])

    resp_multi = client.get('/api/wms/transactions', query_string={'movement_type': '261,311'}, headers=auth_headers)
    assert resp_multi.status_code == 200
    codes = {t['movement_type_code'] for t in resp_multi.get_json()['transactions']}
    assert codes <= {'261', '311'}


def test_enrich_transaction_dict_falls_back_for_legacy_null_row(client, auth_headers, db_session, test_product):
    """A row written before this column existed (movement_type still NULL)
    must still show a derived code/label on read, not null/blank."""
    from models.wms_advanced import InventoryTransaction
    from utils.helpers import generate_number
    from utils.timezone import get_local_now

    txn = InventoryTransaction(
        transaction_number=generate_number('TXN', InventoryTransaction, 'transaction_number'),
        transaction_type='transfer',
        transaction_date=get_local_now(),
        product_id=test_product.id,
        quantity=1,
        direction='out',
        status='completed',
    )
    assert txn.movement_type is None
    db_session.add(txn)
    db_session.commit()

    resp = client.get(f'/api/wms/transactions/{txn.id}', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()['transaction']
    assert data['movement_type_code'] == '311'
    assert data['movement_type_label']
