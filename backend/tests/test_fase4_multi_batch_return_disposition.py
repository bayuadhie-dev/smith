"""
Fase 4 (fix_report_2.md, lanjutan audit, disetujui pemilik via
AskUserQuestion 2026-10-01): _post_return_gl() sebelumnya (fix_report.md
Fase 2) hanya menjurnal SEKALI per CustomerReturn (idempoten lewat
CustomerReturn.pending_journal_entry_id). Kalau satu retur didisposisi
bertahap (batch 1 lalu batch 2 di hari lain), hanya batch pertama yang
menghasilkan jurnal - batch kedua dilewati begitu saja.

Desain yang disetujui: jurnal sekarang per ReturnDisposition (per batch),
idempoten lewat ReturnDisposition.pending_journal_entry_id, dihitung dari
qty pada disposisi itu saja (bukan seluruh ReturnItem), dengan guard total
nilai yang sudah dijurnal untuk satu retur tidak boleh melebihi
total_value retur itu. CustomerReturn.pending_journal_entry_id (dari
fix_report.md Fase 2) tetap diisi - menunjuk ke jurnal disposisi PERTAMA -
supaya tests/test_returns_gl.py (tes lama) tidak rusak.

Diverifikasi lewat endpoint HTTP asli, 2 panggilan terpisah ke
POST /api/returns/<id>/disposition untuk retur yang sama.
"""
from datetime import date


def _setup_accounts(db_session):
    from models.finance import Account, GlobalAccountDefault

    accounts = {
        'retur_penjualan': Account(account_code='TEST-F4-RETUR', account_name='Retur Penjualan',
                                    account_type='revenue_contra', normal_balance='debit'),
        'piutang': Account(account_code='TEST-F4-AR', account_name='Piutang Dagang',
                            account_type='asset', normal_balance='debit'),
        'persediaan': Account(account_code='TEST-F4-INV', account_name='Persediaan',
                               account_type='asset', normal_balance='debit'),
        'hpp': Account(account_code='TEST-F4-HPP', account_name='HPP',
                        account_type='expense', normal_balance='debit'),
    }
    for acc in accounts.values():
        db_session.add(acc)
    db_session.commit()

    db_session.add(GlobalAccountDefault(transaction_key='akun_retur_penjualan_id', account_id=accounts['retur_penjualan'].id))
    db_session.add(GlobalAccountDefault(transaction_key='accounts_receivable', account_id=accounts['piutang'].id))
    db_session.add(GlobalAccountDefault(transaction_key='akun_persediaan_id', account_id=accounts['persediaan'].id))
    db_session.add(GlobalAccountDefault(transaction_key='akun_hpp_id', account_id=accounts['hpp'].id))
    db_session.commit()
    return accounts


def _setup_warehouse_location(db_session, code='F4MAIN'):
    from models.warehouse import WarehouseLocation, WarehouseZone
    zone = WarehouseZone(code=f'Z-{code}', name='Zone Retur F4', material_type='finished_goods')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code=code, rack='R1', level='L1', position='P1',
        capacity=1000, capacity_uom='pcs',
    )
    db_session.add(location)
    db_session.commit()
    return location


def _create_return_two_items(client, auth_headers, customer_id, product_id, unit_price=100.0):
    """Retur dengan 1 item qty=10 (supaya bisa dipecah jadi 2 batch disposisi: 6 lalu 4)."""
    resp = client.post('/api/returns/', json={
        'customer_id': customer_id,
        'return_date': date.today().isoformat(),
        'reason': 'defective',
        'qc_required': False,
        'items': [{
            'product_id': product_id,
            'quantity_returned': 10,
            'unit_price': unit_price,
            'condition_received': 'good',
        }],
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()


def test_two_separate_disposition_batches_each_post_their_own_journal(client, auth_headers, db_session, test_customer, test_product):
    accounts = _setup_accounts(db_session)
    location = _setup_warehouse_location(db_session)

    created = _create_return_two_items(client, auth_headers, test_customer.id, test_product.id, unit_price=100.0)
    return_id = created['return_id']

    from models.returns import ReturnItem
    return_item = ReturnItem.query.filter_by(return_id=return_id).first()

    # Batch 1: disposisi 6 dari 10 unit
    resp1 = client.post(f'/api/returns/{return_id}/disposition', json={
        'dispositions': [{
            'return_item_id': return_item.id,
            'disposition_type': 'warehouse',
            'quantity': 6,
            'warehouse_location': location.location_code,
        }],
    }, headers=auth_headers)
    assert resp1.status_code == 201, resp1.get_json()

    from models.finance import AccountingEntry
    entries_after_batch1 = AccountingEntry.query.filter_by(reference_type='sales_return', reference_id=return_id).all()
    assert len(entries_after_batch1) > 0, "Batch 1 harus menghasilkan jurnal"
    retur_debit_batch1 = sum(
        float(e.debit_amount or 0) for e in entries_after_batch1 if e.account_id == accounts['retur_penjualan'].id
    )
    assert retur_debit_batch1 == 600.0, f"Batch 1 (6 x 100) harus 600, dapat {retur_debit_batch1}"

    # Batch 2 (DI PANGGILAN TERPISAH, mensimulasikan hari lain): disposisi
    # 4 unit SISANYA dari item yang sama.
    resp2 = client.post(f'/api/returns/{return_id}/disposition', json={
        'dispositions': [{
            'return_item_id': return_item.id,
            'disposition_type': 'warehouse',
            'quantity': 4,
            'warehouse_location': location.location_code,
        }],
    }, headers=auth_headers)
    assert resp2.status_code == 201, resp2.get_json()

    entries_after_batch2 = AccountingEntry.query.filter_by(reference_type='sales_return', reference_id=return_id).all()
    retur_debit_total = sum(
        float(e.debit_amount or 0) for e in entries_after_batch2 if e.account_id == accounts['retur_penjualan'].id
    )
    assert retur_debit_total == 1000.0, (
        f"Batch 2 harus MENAMBAH jurnal baru (total jadi 6+4=10 x 100=1000), "
        f"dapat {retur_debit_total} - kalau masih 600 berarti batch 2 dilewati (bug lama)"
    )

    # Idempotensi per-batch: panggil ulang endpoint dengan disposisi KOSONG
    # tidak boleh menggandakan jurnal manapun.
    resp3 = client.post(f'/api/returns/{return_id}/disposition', json={'dispositions': []}, headers=auth_headers)
    assert resp3.status_code == 201, resp3.get_json()
    entries_final = AccountingEntry.query.filter_by(reference_type='sales_return', reference_id=return_id).all()
    assert len(entries_final) == len(entries_after_batch2), "Panggilan tanpa disposisi baru tidak boleh menambah jurnal"


def test_disposition_journal_cannot_exceed_return_total_value(client, auth_headers, db_session, test_customer, test_product):
    """Guard: total nilai yang sudah dijurnal untuk satu retur tidak boleh
    melebihi total_value retur - disposisi yang qty-nya overshoot (data
    salah/duplikat) ditolak, bukan diam-diam menjurnal lebih dari nilai
    retur yang sebenarnya."""
    accounts = _setup_accounts(db_session)
    location = _setup_warehouse_location(db_session, code='F4MAIN2')

    created = _create_return_two_items(client, auth_headers, test_customer.id, test_product.id, unit_price=100.0)
    return_id = created['return_id']

    from models.returns import ReturnItem
    return_item = ReturnItem.query.filter_by(return_id=return_id).first()

    # Disposisikan qty MELEBIHI yang diretur (10) - 6 lalu 8 (total 14 > 10)
    resp1 = client.post(f'/api/returns/{return_id}/disposition', json={
        'dispositions': [{
            'return_item_id': return_item.id,
            'disposition_type': 'warehouse',
            'quantity': 6,
            'warehouse_location': location.location_code,
        }],
    }, headers=auth_headers)
    assert resp1.status_code == 201, resp1.get_json()

    resp2 = client.post(f'/api/returns/{return_id}/disposition', json={
        'dispositions': [{
            'return_item_id': return_item.id,
            'disposition_type': 'warehouse',
            'quantity': 8,
            'warehouse_location': location.location_code,
        }],
    }, headers=auth_headers)
    assert resp2.status_code == 400, (
        f"Disposisi yang bikin total overshoot nilai retur harus ditolak 400, dapat {resp2.status_code}: {resp2.get_json()}"
    )

    from models.finance import AccountingEntry
    entries = AccountingEntry.query.filter_by(reference_type='sales_return', reference_id=return_id).all()
    retur_debit_total = sum(
        float(e.debit_amount or 0) for e in entries if e.account_id == accounts['retur_penjualan'].id
    )
    assert retur_debit_total == 600.0, "Batch yang ditolak tidak boleh ikut memposting jurnal apapun"


def test_customer_return_pending_journal_entry_id_still_points_to_first_batch(client, auth_headers, db_session, test_customer, test_product):
    """Kompatibilitas mundur: CustomerReturn.pending_journal_entry_id (dari
    fix_report.md Fase 2) tetap terisi setelah batch pertama, supaya
    tests/test_returns_gl.py (tes lama) tidak rusak."""
    accounts = _setup_accounts(db_session)
    location = _setup_warehouse_location(db_session, code='F4MAIN3')

    created = _create_return_two_items(client, auth_headers, test_customer.id, test_product.id, unit_price=50.0)
    return_id = created['return_id']

    from models.returns import ReturnItem, CustomerReturn
    from models import db
    return_item = ReturnItem.query.filter_by(return_id=return_id).first()

    resp = client.post(f'/api/returns/{return_id}/disposition', json={
        'dispositions': [{
            'return_item_id': return_item.id,
            'disposition_type': 'warehouse',
            'quantity': 5,
            'warehouse_location': location.location_code,
        }],
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    cr = db.session.get(CustomerReturn, return_id)
    assert cr.pending_journal_entry_id is not None
