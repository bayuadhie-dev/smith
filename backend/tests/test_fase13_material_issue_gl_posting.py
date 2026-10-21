"""
Fase 13 (fix_report_3.md, 2026-10-02): issue_materials()
(PUT /api/production/material-issues/<id>/issue, routes/material_issue.py)
physically deducts raw material Inventory via FIFO but never posted a GL
journal for that consumption - found via a real end-to-end production test
where a large batch of raw materials got consumed with zero accounting
trace. Fixed: posts Dr Persediaan Barang Dalam Proses (WIP) /
Cr Persediaan Bahan Baku for the real cost of whatever this call actually
deducted (skipped when cost basis is 0, matching the zero-cost-material
convention used elsewhere in this codebase).
"""
from datetime import date


def _setup_materials_default_accounts(db_session):
    from models.finance import Account, GlobalAccountDefault

    persediaan = Account(account_code='TEST-F13-RM', account_name='Persediaan Bahan Baku Test', account_type='asset', normal_balance='debit')
    wip = Account(account_code='TEST-F13-WIP', account_name='Persediaan WIP Test', account_type='asset', normal_balance='debit')
    db_session.add_all([persediaan, wip])
    db_session.commit()
    db_session.add(GlobalAccountDefault(transaction_key='akun_persediaan_id', account_id=persediaan.id))
    db_session.add(GlobalAccountDefault(transaction_key='wip_persediaan', account_id=wip.id))
    db_session.commit()
    return persediaan, wip


def _setup_reserved_inventory(db_session, test_material, quantity=100, unit_cost=5000):
    from models.warehouse import WarehouseZone, WarehouseLocation, Inventory

    test_material.cost_per_unit = unit_cost
    db_session.commit()

    zone = WarehouseZone(code='Z-F13-MI', name='Zone Material Issue F13', material_type='raw_materials')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code='LOC-F13-MI', rack='R1', level='L1', position='P1',
        capacity=10000, capacity_uom='kg',
    )
    db_session.add(location)
    db_session.commit()

    inv = Inventory(
        material_id=test_material.id, location_id=location.id,
        quantity_on_hand=quantity, quantity_available=0, quantity_reserved=quantity,
        stock_status='available',
    )
    db_session.add(inv)
    db_session.commit()
    return inv


def _make_material_issue(db_session, test_material, test_user, required=50):
    from models.material_issue import MaterialIssue, MaterialIssueItem

    mi = MaterialIssue(
        issue_number='MI-TEST-F13-001', trigger_source='manual', status='approved',
        requested_by=test_user.id,
    )
    db_session.add(mi)
    db_session.flush()
    item = MaterialIssueItem(
        material_issue_id=mi.id, line_number=1, material_id=test_material.id,
        description=test_material.name, required_quantity=required, issued_quantity=0,
        uom='KG', status='pending',
    )
    db_session.add(item)
    db_session.commit()
    return mi, item


def test_issue_materials_posts_gl_journal_for_consumption(client, auth_headers, db_session, test_material, test_user):
    persediaan, wip = _setup_materials_default_accounts(db_session)
    _setup_reserved_inventory(db_session, test_material, quantity=100, unit_cost=5000)
    mi, item = _make_material_issue(db_session, test_material, test_user, required=50)

    resp = client.put(f'/api/production/material-issues/{mi.id}/issue', json={}, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()['data']
    assert data['issued_items'] == 1

    from models.finance import AccountingEntry
    entries = AccountingEntry.query.filter_by(reference_type='material_issue', reference_id=mi.id).all()
    assert len(entries) == 2, 'harus ada 2 baris jurnal (Dr WIP / Cr Persediaan Bahan Baku)'

    by_account = {e.account_id: e for e in entries}
    assert float(by_account[wip.id].debit_amount) == 250000.0  # 50 kg * 5000
    assert float(by_account[persediaan.id].credit_amount) == 250000.0
    total_debit = sum(float(e.debit_amount or 0) for e in entries)
    total_credit = sum(float(e.credit_amount or 0) for e in entries)
    assert total_debit == total_credit  # jurnal harus balance


def test_issue_materials_skips_gl_when_cost_is_zero(client, auth_headers, db_session, test_material, test_user):
    """Zero-cost material (master data belum lengkap) - tidak boleh posting
    jurnal Rp0 palsu, sama seperti konvensi zero-cost yang sudah ada."""
    persediaan, wip = _setup_materials_default_accounts(db_session)
    _setup_reserved_inventory(db_session, test_material, quantity=100, unit_cost=0)
    mi, item = _make_material_issue(db_session, test_material, test_user, required=50)

    resp = client.put(f'/api/production/material-issues/{mi.id}/issue', json={}, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    from models.finance import AccountingEntry
    entries = AccountingEntry.query.filter_by(reference_type='material_issue', reference_id=mi.id).all()
    assert len(entries) == 0
