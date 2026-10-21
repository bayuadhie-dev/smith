"""
Fase 5, bagian B (fix_report_2.md, disetujui pemilik via AskUserQuestion
2026-10-01): alur "musnahkan" barang di karantina (hasil GRN-reject, Fase
4 fix_report.md) - endpoint baru yang membuat WasteRecord DAN posting GL
(Dr Beban Kerugian Persediaan / Cr Persediaan), yang sebelumnya tidak ada
sama sekali (WasteRecord murni catatan, 0 efek GL).

Diverifikasi lewat endpoint HTTP asli
(POST /api/purchasing/quarantine/<inventory_id>/destroy).
"""
from datetime import date


def _setup_quarantine_inventory(db_session, qty=20):
    from models.warehouse import WarehouseLocation, WarehouseZone, Inventory
    from models.product import Material

    zone = WarehouseZone(code='Z-F5DESTROY', name='Gudang Reject', material_type='raw_materials')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code='REJECT-F5', rack='R1', level='L1', position='P1',
        capacity=1000, capacity_uom='kg',
    )
    db_session.add(location)
    db_session.commit()

    material = Material(
        code='MAT-F5-DESTROY', name='Test Material Reject', material_type='raw_materials',
        category='Raw Material', primary_uom='KG', cost_per_unit=2500, is_active=True,
    )
    db_session.add(material)
    db_session.commit()

    inv = Inventory(
        location_id=location.id, material_id=material.id, batch_number='BATCH-F5-01',
        quantity_on_hand=qty, quantity_available=qty, stock_status='rejected',
    )
    db_session.add(inv)
    db_session.commit()

    return inv, material, location


def _setup_accounts(db_session):
    from models.finance import Account, GlobalAccountDefault

    beban_account = Account(
        account_code='TEST-F5-BEBAN', account_name='Beban Kerugian Persediaan',
        account_type='expense', normal_balance='debit',
    )
    persediaan_account = Account(
        account_code='TEST-F5-INV', account_name='Persediaan',
        account_type='asset', normal_balance='debit',
    )
    db_session.add_all([beban_account, persediaan_account])
    db_session.commit()
    db_session.add(GlobalAccountDefault(transaction_key='akun_beban_id', account_id=beban_account.id))
    db_session.add(GlobalAccountDefault(transaction_key='akun_persediaan_id', account_id=persediaan_account.id))
    db_session.commit()
    return beban_account, persediaan_account


def test_destroy_quarantine_stock_creates_waste_record_and_posts_gl(client, auth_headers, db_session):
    beban_account, persediaan_account = _setup_accounts(db_session)
    inv, material, location = _setup_quarantine_inventory(db_session, qty=20)

    resp = client.post(f'/api/purchasing/quarantine/{inv.id}/destroy', json={
        'quantity': 8,
        'reason': 'Rusak total, tidak layak retur ke supplier',
    }, headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()

    from models.warehouse import Inventory
    from models import db
    db.session.refresh(inv)
    assert float(inv.quantity_on_hand) == 12, "Stok karantina harus berkurang sesuai qty dimusnahkan"

    from models.waste import WasteRecord
    waste = WasteRecord.query.filter_by(material_id=material.id).first()
    assert waste is not None
    assert float(waste.quantity) == 8

    from models.finance import AccountingEntry
    entries = AccountingEntry.query.filter_by(reference_type='inventory_destruction').all()
    assert len(entries) > 0, "Jurnal pemusnahan tidak terbentuk"

    total_debit = sum(float(e.debit_amount or 0) for e in entries)
    total_credit = sum(float(e.credit_amount or 0) for e in entries)
    assert round(total_debit, 2) == round(total_credit, 2)

    beban_entries = [e for e in entries if e.account_id == beban_account.id]
    persediaan_entries = [e for e in entries if e.account_id == persediaan_account.id]
    assert sum(float(e.debit_amount or 0) for e in beban_entries) == 20000.0  # 8 x 2500
    assert sum(float(e.credit_amount or 0) for e in persediaan_entries) == 20000.0


def test_destroy_more_than_available_is_rejected(client, auth_headers, db_session):
    _setup_accounts(db_session)
    inv, material, location = _setup_quarantine_inventory(db_session, qty=5)

    resp = client.post(f'/api/purchasing/quarantine/{inv.id}/destroy', json={
        'quantity': 10,
        'reason': 'Test overshoot',
    }, headers=auth_headers)
    assert resp.status_code == 400, resp.get_json()


def test_destroy_non_quarantine_inventory_is_rejected(client, auth_headers, db_session):
    _setup_accounts(db_session)
    from models.warehouse import WarehouseLocation, WarehouseZone, Inventory
    from models.product import Material

    zone = WarehouseZone(code='Z-F5MAIN', name='Gudang Utama', material_type='raw_materials')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code='MAIN-F5', rack='R1', level='L1', position='P1',
        capacity=1000, capacity_uom='kg',
    )
    db_session.add(location)
    db_session.commit()
    material = Material(
        code='MAT-F5-AVAIL', name='Test Material Available', material_type='raw_materials',
        category='Raw Material', primary_uom='KG', cost_per_unit=1000, is_active=True,
    )
    db_session.add(material)
    db_session.commit()
    inv = Inventory(
        location_id=location.id, material_id=material.id,
        quantity_on_hand=10, quantity_available=10, stock_status='available',
    )
    db_session.add(inv)
    db_session.commit()

    resp = client.post(f'/api/purchasing/quarantine/{inv.id}/destroy', json={
        'quantity': 5, 'reason': 'Tidak seharusnya bisa',
    }, headers=auth_headers)
    assert resp.status_code == 400, (
        f"Inventory yang bukan quarantine/reject tidak boleh bisa dimusnahkan lewat endpoint ini: {resp.get_json()}"
    )
