"""
Fase 5, bagian A (fix_report_2.md, disetujui pemilik via AskUserQuestion
2026-10-01): retur ke supplier dari stok karantina hasil GRN-reject (Fase
4 fix_report.md). Sebelumnya create_purchase_return() hanya bisa dibuat
dari invoice_item_id manapun tanpa mengaitkan ke Inventory karantina yang
sebenarnya - tidak ada cara membuat PurchaseReturn LANGSUNG dari baris
Inventory quarantine/reject tertentu dengan qty dibatasi stok yang benar-
benar ada di karantina.

Endpoint baru: POST /api/purchasing/purchase-returns/from-quarantine.
PurchaseReturn.invoice_id dan PurchaseReturnItem.invoice_item_id tetap
NOT NULL di skema (tidak diubah) - caller tetap wajib memberi invoice_id +
invoice_item_id yang valid (biasanya sudah diketahui dari alur GRN->PO->
Invoice), endpoint ini menambahkan VALIDASI bahwa qty yang diretur tidak
melebihi stok yang benar-benar ada di baris Inventory karantina yang
ditunjuk - beda dari create_purchase_return() biasa yang tidak
memvalidasi terhadap stok fisik sama sekali.

Perbaikan kedua di fase ini: approve_purchase_return() (fungsi lama, GL-
wired sejak 2026-09-11) sebelumnya memilih baris Inventory untuk dikurangi
lewat `order_by(quantity_on_hand.desc()).first()` TANPA filter status -
bisa saja salah memotong stok 'available' padahal seharusnya memotong
stok 'quarantine'/'reject' yang sebenarnya sedang diretur. Diperbaiki agar
memprioritaskan baris berstatus quarantine/reject/rejected kalau ada.

Diverifikasi lewat endpoint HTTP asli.
"""
from datetime import date


def _setup_quarantine_and_invoice(db_session, qty_in_quarantine=15):
    from models.warehouse import WarehouseLocation, WarehouseZone, Inventory
    from models.product import Material
    from models.purchasing import Supplier
    from models.finance import Invoice, InvoiceItem

    zone = WarehouseZone(code='Z-F5A', name='Gudang Reject F5A', material_type='raw_materials')
    db_session.add(zone)
    db_session.commit()
    location = WarehouseLocation(
        zone_id=zone.id, location_code='REJECT-F5A', rack='R1', level='L1', position='P1',
        capacity=1000, capacity_uom='kg',
    )
    db_session.add(location)
    db_session.commit()

    material = Material(
        code='MAT-F5A', name='Test Material F5A', material_type='raw_materials',
        category='Raw Material', primary_uom='KG', cost_per_unit=3000, is_active=True,
    )
    db_session.add(material)
    db_session.commit()

    quarantine_inv = Inventory(
        location_id=location.id, material_id=material.id, batch_number='BATCH-F5A-01',
        quantity_on_hand=qty_in_quarantine, quantity_available=qty_in_quarantine, stock_status='rejected',
    )
    db_session.add(quarantine_inv)
    db_session.commit()

    supplier = Supplier(code='SUP-F5A', company_name='Test Supplier F5A', is_active=True)
    db_session.add(supplier)
    db_session.commit()

    invoice = Invoice(
        invoice_number='PI-F5A-001', invoice_type='purchase', invoice_date=date.today(),
        supplier_id=supplier.id, subtotal=300000, total_amount=300000, status='sent',
    )
    db_session.add(invoice)
    db_session.commit()

    invoice_item = InvoiceItem(
        invoice_id=invoice.id, line_number=1, material_id=material.id,
        description='Test material invoice item', quantity=100, unit_price=3000, total_amount=300000,
    )
    db_session.add(invoice_item)
    db_session.commit()

    return quarantine_inv, material, supplier, invoice, invoice_item, location


def test_create_purchase_return_from_quarantine_caps_at_available_stock(client, auth_headers, db_session):
    quarantine_inv, material, supplier, invoice, invoice_item, location = _setup_quarantine_and_invoice(db_session, qty_in_quarantine=15)

    resp = client.post('/api/purchasing/purchase-returns/from-quarantine', json={
        'inventory_id': quarantine_inv.id,
        'invoice_id': invoice.id,
        'invoice_item_id': invoice_item.id,
        'quantity': 20,  # lebih dari stok karantina (15)
        'reason': 'Barang rusak dari GRN',
        'return_type': 'defective',
    }, headers=auth_headers)
    assert resp.status_code == 400, (
        f"Qty retur melebihi stok karantina seharusnya ditolak: {resp.status_code} {resp.get_json()}"
    )


def test_create_purchase_return_from_quarantine_succeeds_within_stock(client, auth_headers, db_session):
    quarantine_inv, material, supplier, invoice, invoice_item, location = _setup_quarantine_and_invoice(db_session, qty_in_quarantine=15)

    resp = client.post('/api/purchasing/purchase-returns/from-quarantine', json={
        'inventory_id': quarantine_inv.id,
        'invoice_id': invoice.id,
        'invoice_item_id': invoice_item.id,
        'quantity': 10,
        'reason': 'Barang rusak dari GRN',
        'return_type': 'defective',
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    from models.purchasing import PurchaseReturn, PurchaseReturnItem
    from models import db
    return_id = resp.get_json()['return']['id']
    pr = db.session.get(PurchaseReturn, return_id)
    assert pr.supplier_id == supplier.id
    assert pr.invoice_id == invoice.id

    item = PurchaseReturnItem.query.filter_by(return_id=return_id).first()
    assert float(item.quantity) == 10
    assert float(item.unit_price) == 3000.0  # dari invoice_item


def test_approve_purchase_return_prefers_quarantine_inventory_row_over_available(client, auth_headers, db_session):
    """approve_purchase_return() sekarang memprioritaskan baris Inventory
    quarantine/reject saat memilih baris mana yang dikurangi, bukan asal
    ambil quantity_on_hand terbesar."""
    quarantine_inv, material, supplier, invoice, invoice_item, location = _setup_quarantine_and_invoice(db_session, qty_in_quarantine=15)

    # Baris Inventory LAIN untuk material yang sama, status 'available',
    # dengan qty jauh lebih besar - kalau logika lama (order by qty desc
    # tanpa filter status) masih dipakai, baris INI yang akan salah
    # terpotong, bukan baris quarantine.
    from models.warehouse import WarehouseLocation, WarehouseZone, Inventory
    from models import db
    zone2 = WarehouseZone(code='Z-F5A-MAIN', name='Gudang Utama F5A', material_type='raw_materials')
    db_session.add(zone2)
    db_session.commit()
    main_location = WarehouseLocation(
        zone_id=zone2.id, location_code='MAIN-F5A', rack='R1', level='L1', position='P1',
        capacity=1000, capacity_uom='kg',
    )
    db_session.add(main_location)
    db_session.commit()
    available_inv = Inventory(
        location_id=main_location.id, material_id=material.id,
        quantity_on_hand=500, quantity_available=500, stock_status='available',
    )
    db_session.add(available_inv)
    db_session.commit()

    from models.finance import Account, GlobalAccountDefault
    hutang_account = Account(account_code='TEST-F5A-AP', account_name='Hutang', account_type='liability', normal_balance='credit')
    persediaan_account = Account(account_code='TEST-F5A-INV', account_name='Persediaan', account_type='asset', normal_balance='debit')
    db_session.add_all([hutang_account, persediaan_account])
    db_session.commit()
    db_session.add(GlobalAccountDefault(transaction_key='accounts_payable', account_id=hutang_account.id))
    db_session.add(GlobalAccountDefault(transaction_key='persediaan', account_id=persediaan_account.id))
    db_session.commit()

    resp = client.post('/api/purchasing/purchase-returns/from-quarantine', json={
        'inventory_id': quarantine_inv.id,
        'invoice_id': invoice.id,
        'invoice_item_id': invoice_item.id,
        'quantity': 10,
        'reason': 'Barang rusak dari GRN',
        'return_type': 'defective',
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()
    return_id = resp.get_json()['return']['id']

    resp2 = client.post(f'/api/purchasing/purchase-returns/{return_id}/approve', headers=auth_headers)
    assert resp2.status_code == 200, resp2.get_json()

    db.session.refresh(quarantine_inv)
    db.session.refresh(available_inv)
    assert float(quarantine_inv.quantity_on_hand) == 5, (
        f"Baris quarantine harus berkurang 10 (15->5), dapat {quarantine_inv.quantity_on_hand}"
    )
    assert float(available_inv.quantity_on_hand) == 500, (
        f"Baris 'available' TIDAK BOLEH ikut terpotong, dapat {available_inv.quantity_on_hand}"
    )
