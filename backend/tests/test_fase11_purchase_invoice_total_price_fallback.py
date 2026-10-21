"""
Fase 11 (fix_report_2.md, ditemukan lewat testing nyata ke produksi
2026-10-01/02): create_purchase_invoice()/update_purchase_invoice() di
routes/purchase_invoice.py mengharapkan field 'total_price' per item dan
'total_amount' di level invoice dikirim langsung oleh caller, TIDAK
dihitung otomatis dari quantity*unit_price. Kalau caller tidak mengirim
field ini:
  - item: crash 500 NotNullViolation (invoice_items.total_amount NOT NULL)
  - header: invoice tersimpan dengan total_amount=0 / balance_due=0 walau
    item-nya benar, menyesatkan laporan utang/pembayaran.

Pola bug ini identik dengan yang sudah pernah diperbaiki sebelumnya di
purchase_return.py (fallback total_price = quantity*unit_price -
discount_amount + tax_amount saat None). Fix diterapkan dengan pola yang
sama di purchase_invoice.py.

Diverifikasi lewat endpoint HTTP asli (POST /api/purchasing/purchase-invoices).
"""
from datetime import date


def _setup_po(db_session, unit_price=10000, quantity=50):
    from models.purchasing import Supplier, PurchaseOrder, PurchaseOrderItem
    from models.product import Material
    from models.finance import Account, GlobalAccountDefault

    supplier = Supplier(code='SUP-F11', company_name='Test Supplier F11', is_active=True)
    db_session.add(supplier)
    db_session.commit()

    material = Material(
        code='MAT-F11', name='Test Material F11', material_type='raw_materials',
        category='Raw Material', primary_uom='KG', cost_per_unit=unit_price, is_active=True,
    )
    db_session.add(material)
    db_session.commit()

    po = PurchaseOrder(
        po_number='PO-F11-001', supplier_id=supplier.id, order_date=date.today(),
        status='sent', subtotal=unit_price * quantity, total_amount=unit_price * quantity,
    )
    db_session.add(po)
    db_session.commit()

    po_item = PurchaseOrderItem(
        po_id=po.id, line_number=1, material_id=material.id,
        description='Test material F11', quantity=quantity, uom='KG',
        unit_price=unit_price, total_price=unit_price * quantity,
    )
    db_session.add(po_item)
    db_session.commit()

    hutang_account = Account(account_code='TEST-F11-AP', account_name='Hutang Usaha F11', account_type='liability', normal_balance='credit')
    persediaan_account = Account(account_code='TEST-F11-INV', account_name='Persediaan F11', account_type='asset', normal_balance='debit')
    db_session.add_all([hutang_account, persediaan_account])
    db_session.commit()
    db_session.add(GlobalAccountDefault(transaction_key='accounts_payable', account_id=hutang_account.id))
    db_session.add(GlobalAccountDefault(transaction_key='akun_persediaan_id', account_id=persediaan_account.id))
    db_session.commit()

    return supplier, material, po, po_item


def test_create_purchase_invoice_without_total_price_does_not_crash(client, auth_headers, db_session):
    """Sebelum fix: 500 NotNullViolation. Sesudah fix: 201, total_price item
    otomatis dihitung dari quantity*unit_price."""
    supplier, material, po, po_item = _setup_po(db_session, unit_price=10000, quantity=50)

    resp = client.post('/api/purchasing/purchase-invoices', json={
        'po_id': po.id,
        'supplier_id': supplier.id,
        'invoice_date': date.today().isoformat(),
        'due_date': date.today().isoformat(),
        'items': [{
            'po_item_id': po_item.id,
            'material_id': material.id,
            'description': 'Test item tanpa total_price',
            'quantity': 5,
            'uom': 'KG',
            'unit_price': 10000,
            # 'total_price' sengaja TIDAK dikirim
        }],
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    from models.finance import InvoiceItem
    invoice_id = resp.get_json()['invoice']['id']
    item = InvoiceItem.query.filter_by(invoice_id=invoice_id).first()
    assert float(item.total_amount) == 50000.0, (
        f"total_amount item harus otomatis 5*10000=50000, dapat {item.total_amount}"
    )


def test_create_purchase_invoice_without_total_amount_header_sums_from_items(client, auth_headers, db_session):
    """Sebelum fix: invoice.total_amount tetap 0 walau item-nya benar.
    Sesudah fix: dijumlahkan otomatis dari total_price semua item."""
    supplier, material, po, po_item = _setup_po(db_session, unit_price=10000, quantity=50)

    resp = client.post('/api/purchasing/purchase-invoices', json={
        'po_id': po.id,
        'supplier_id': supplier.id,
        'invoice_date': date.today().isoformat(),
        'due_date': date.today().isoformat(),
        'items': [{
            'po_item_id': po_item.id,
            'material_id': material.id,
            'description': 'Test item tanpa total_price/total_amount',
            'quantity': 2,
            'uom': 'KG',
            'unit_price': 10000,
        }],
        # 'total_amount' header sengaja TIDAK dikirim
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    from models.finance import Invoice
    invoice_id = resp.get_json()['invoice']['id']
    invoice = db_session.get(Invoice, invoice_id)
    assert float(invoice.total_amount) == 20000.0, (
        f"total_amount invoice harus otomatis terisi 2*10000=20000, dapat {invoice.total_amount}"
    )
    assert float(invoice.balance_due) == 20000.0, (
        f"balance_due harus ikut terisi 20000, dapat {invoice.balance_due}"
    )


def test_create_purchase_invoice_explicit_total_price_still_respected(client, auth_headers, db_session):
    """Fallback hanya aktif saat total_price/total_amount None - kalau
    caller TETAP mengirim nilai eksplisit (misal karena ada diskon manual
    yang tidak tercermin di quantity*unit_price), nilai itu yang dipakai,
    bukan hasil hitung ulang."""
    supplier, material, po, po_item = _setup_po(db_session, unit_price=10000, quantity=50)

    resp = client.post('/api/purchasing/purchase-invoices', json={
        'po_id': po.id,
        'supplier_id': supplier.id,
        'invoice_date': date.today().isoformat(),
        'due_date': date.today().isoformat(),
        'items': [{
            'po_item_id': po_item.id,
            'material_id': material.id,
            'description': 'Test item dengan total_price eksplisit (ada diskon manual)',
            'quantity': 5,
            'uom': 'KG',
            'unit_price': 10000,
            'total_price': 45000,  # eksplisit, bukan 5*10000=50000
        }],
        'total_amount': 45000,
    }, headers=auth_headers)
    assert resp.status_code == 201, resp.get_json()

    from models.finance import Invoice, InvoiceItem
    invoice_id = resp.get_json()['invoice']['id']
    item = InvoiceItem.query.filter_by(invoice_id=invoice_id).first()
    invoice = db_session.get(Invoice, invoice_id)
    assert float(item.total_amount) == 45000.0
    assert float(invoice.total_amount) == 45000.0
