"""
Fase 2 (audit 29 Sept 2026): routes/returns.py tidak memposting jurnal GL
sama sekali. create_return()/create_disposition()/_process_disposition()
hanya mengubah Inventory.quantity_on_hand atau membuat WasteRecord, jadi
piutang dan pendapatan tidak dikoreksi saat ada retur penjualan.

Keputusan pemilik (dikonfirmasi sebelum kode ditulis):
- Jurnal pakai akun kontra-revenue "Retur Penjualan" (slot
  akun_retur_penjualan_id), bukan langsung mengoreksi akun Pendapatan asli.
- PPN Keluaran ikut dikoreksi proporsional terhadap nilai barang yang diretur.

Diverifikasi lewat endpoint HTTP asli (bukan panggil fungsi langsung).
"""
from datetime import date


def _setup_accounts(db_session):
    from models.finance import Account, GlobalAccountDefault

    accounts = {
        'retur_penjualan': Account(account_code='TEST-RETUR-01', account_name='Retur Penjualan',
                                    account_type='revenue_contra', normal_balance='debit'),
        'piutang': Account(account_code='TEST-AR-01', account_name='Piutang Dagang',
                            account_type='asset', normal_balance='debit'),
        'persediaan': Account(account_code='TEST-INV-01', account_name='Persediaan',
                               account_type='asset', normal_balance='debit'),
        'hpp': Account(account_code='TEST-HPP-01', account_name='HPP',
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


def _setup_warehouse_location(db_session):
    from models.warehouse import WarehouseLocation, WarehouseZone
    zone = WarehouseZone(code='Z-RTN', name='Zone Retur', material_type='finished_goods')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code='MAIN', rack='R1', level='L1', position='P1',
        capacity=1000, capacity_uom='pcs',
    )
    db_session.add(location)
    db_session.commit()
    return location


def _create_return(client, auth_headers, customer_id, product_id, qty, unit_price):
    resp = client.post('/api/returns/', json={
        'customer_id': customer_id,
        'return_date': date.today().isoformat(),
        'reason': 'defective',
        'qc_required': False,
        'items': [{
            'product_id': product_id,
            'quantity_returned': qty,
            'unit_price': unit_price,
            'condition_received': 'good',
        }],
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()


def test_return_disposition_posts_balanced_gl_journal(client, auth_headers, db_session, test_customer, test_product):
    accounts = _setup_accounts(db_session)
    _setup_warehouse_location(db_session)

    created = _create_return(client, auth_headers, test_customer.id, test_product.id, qty=10, unit_price=150.0)
    return_id = created['return_id']

    # Fetch the created return_item id
    from models.returns import ReturnItem
    return_item = ReturnItem.query.filter_by(return_id=return_id).first()
    assert return_item is not None

    resp = client.post(f'/api/returns/{return_id}/disposition', json={
        'dispositions': [{
            'return_item_id': return_item.id,
            'disposition_type': 'warehouse',
            'quantity': 10,
            'warehouse_location': 'MAIN',
        }],
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    from models.finance import AccountingEntry
    from models.returns import CustomerReturn
    from models import db
    cr = db.session.get(CustomerReturn, return_id)
    assert cr.pending_journal_entry_id is not None, "Jurnal retur tidak terbentuk (GL posting gap belum diperbaiki)"

    entries = AccountingEntry.query.filter_by(
        reference_type='sales_return', reference_id=return_id
    ).all()
    assert len(entries) > 0, "Tidak ada AccountingEntry untuk retur ini"

    total_debit = sum(float(e.debit_amount or 0) for e in entries)
    total_credit = sum(float(e.credit_amount or 0) for e in entries)
    assert round(total_debit, 2) == round(total_credit, 2), (
        f"Jurnal retur tidak balance: debit={total_debit} credit={total_credit}"
    )

    # Dr Retur Penjualan harus 1.500 (10 x 150 - unit_price yang dipakai di tes ini)
    retur_entries = [e for e in entries if e.account_id == accounts['retur_penjualan'].id]
    assert sum(float(e.debit_amount or 0) for e in retur_entries) == 1500.0

    # Cr Piutang harus 1.500 (tidak ada PPN karena tidak ada invoice terkait)
    piutang_entries = [e for e in entries if e.account_id == accounts['piutang'].id]
    assert sum(float(e.credit_amount or 0) for e in piutang_entries) == 1500.0

    # Dr Persediaan / Cr HPP harus sebesar cost (test_product.cost=100 x 10 = 1.000),
    # karena disposisi 'warehouse' mengembalikan barang ke stok layak jual
    persediaan_entries = [e for e in entries if e.account_id == accounts['persediaan'].id]
    hpp_entries = [e for e in entries if e.account_id == accounts['hpp'].id]
    assert sum(float(e.debit_amount or 0) for e in persediaan_entries) == 1000.0
    assert sum(float(e.credit_amount or 0) for e in hpp_entries) == 1000.0

    # Panggil ulang endpoint disposition tidak boleh dobel-posting
    resp2 = client.post(f'/api/returns/{return_id}/disposition', json={
        'dispositions': [],
    }, headers=auth_headers)
    assert resp2.status_code == 201, resp2.get_json()
    entries_after = AccountingEntry.query.filter_by(
        reference_type='sales_return', reference_id=return_id
    ).all()
    assert len(entries_after) == len(entries), "Jurnal retur terbentuk dua kali saat endpoint dipanggil ulang"


def test_partial_return_disposed_to_waste_posts_gl_without_inventory_leg(client, auth_headers, db_session, test_customer, test_product):
    """Retur parsial (3 dari kemungkinan qty lebih besar) yang didisposisi ke
    'waste' (bukan 'warehouse') - AR/Retur Penjualan tetap dikoreksi, tapi
    TIDAK ada leg Persediaan/HPP karena barang tidak kembali ke stok layak
    jual."""
    accounts = _setup_accounts(db_session)

    created = _create_return(client, auth_headers, test_customer.id, test_product.id, qty=3, unit_price=200.0)
    return_id = created['return_id']

    from models.returns import ReturnItem
    return_item = ReturnItem.query.filter_by(return_id=return_id).first()

    resp = client.post(f'/api/returns/{return_id}/disposition', json={
        'dispositions': [{
            'return_item_id': return_item.id,
            'disposition_type': 'waste',
            'quantity': 3,
            'waste_category': 'Customer Return - Defective',
        }],
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    from models.finance import AccountingEntry
    entries = AccountingEntry.query.filter_by(reference_type='sales_return', reference_id=return_id).all()
    assert len(entries) > 0

    total_debit = sum(float(e.debit_amount or 0) for e in entries)
    total_credit = sum(float(e.credit_amount or 0) for e in entries)
    assert round(total_debit, 2) == round(total_credit, 2)

    retur_entries = [e for e in entries if e.account_id == accounts['retur_penjualan'].id]
    assert sum(float(e.debit_amount or 0) for e in retur_entries) == 600.0  # 3 x 200

    persediaan_entries = [e for e in entries if e.account_id == accounts['persediaan'].id]
    hpp_entries = [e for e in entries if e.account_id == accounts['hpp'].id]
    assert len(persediaan_entries) == 0, "Barang waste tidak boleh masuk kembali ke Persediaan"
    assert len(hpp_entries) == 0
