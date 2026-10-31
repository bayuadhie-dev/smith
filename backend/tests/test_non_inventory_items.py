from datetime import date

from tests.test_fase11_purchase_invoice_total_price_fallback import _setup_po


def test_non_inventory_material_posts_to_its_expense_account_without_grn(client, auth_headers, db_session):
    from models.finance import Account, AccountingEntry
    from models.product import Material
    supplier, material, po, po_item = _setup_po(db_session, unit_price=500000, quantity=1)
    beban = Account(account_code='TEST-NI-EXP', account_name='Biaya Ekspedisi', account_type='expense', normal_balance='debit')
    db_session.add(beban); db_session.commit()
    r = client.post('/api/materials/', headers=auth_headers, json={
        'code': 'JASA-EKS', 'name': 'Jasa Ekspedisi', 'material_type': 'non_inventory', 'category': 'Non Persediaan',
        'primary_uom': 'TRIP', 'akun_beban_id': beban.id, 'ppn_code': 'Y'})
    assert r.status_code == 201, r.get_json()
    svc = Material.query.filter_by(code='JASA-EKS').first()
    assert svc.is_excluded_from_mrp and svc.akun_beban_id == beban.id and svc.ppn_code == 'Y'

    from models.purchasing import PurchaseOrderItem
    item = PurchaseOrderItem(po_id=po.id, line_number=2, material_id=svc.id, description='Ongkir', quantity=2, uom='TRIP', unit_price=250000, total_price=500000)
    db_session.add(item); db_session.commit()

    # GRN is refused for services
    grn = client.post('/api/purchasing/grn', headers=auth_headers, json={
        'po_id': po.id, 'supplier_id': supplier.id, 'received_date': date.today().isoformat(),
        'items': [{'po_item_id': item.id, 'material_id': svc.id, 'quantity_ordered': 2, 'quantity_received': 2, 'uom': 'TRIP'}]})
    assert grn.status_code == 400 and 'non persediaan' in grn.get_json()['error'].lower()

    inv = client.post('/api/purchasing/purchase-invoices', headers=auth_headers, json={
        'po_id': po.id, 'supplier_id': supplier.id, 'invoice_date': date.today().isoformat(), 'due_date': date.today().isoformat(),
        'items': [{'po_item_id': item.id, 'material_id': svc.id, 'description': 'Ongkir', 'quantity': 2, 'uom': 'TRIP', 'unit_price': 250000}]})
    assert inv.status_code == 201, inv.get_json()
    iid = inv.get_json()['invoice']['id']
    debit = [e for e in AccountingEntry.query.filter(AccountingEntry.reference_id == iid, AccountingEntry.debit_amount > 0)]
    by = {e.account_id: float(e.debit_amount) for e in debit}
    assert by[beban.id] == 500000.0          # biaya langsung ke akun beban barangnya, tanpa GR/IR atau persediaan
    assert sum(by.values()) == 555000.0      # + PPN Masukan 11%


def test_po_with_service_line_still_reaches_received_and_stock_list_hides_services(client, auth_headers, db_session):
    from models.product import Material
    from models import Inventory
    from models.purchasing import PurchaseOrderItem, PurchaseOrder
    from models.warehouse import WarehouseZone, WarehouseLocation
    supplier, material, po, po_item = _setup_po(db_session, unit_price=1000, quantity=10)
    svc = Material(code='JASA-X', name='Jasa X', material_type='non_inventory', category='Non Persediaan', primary_uom='TRIP', is_active=True)
    db_session.add(svc); db_session.commit()
    db_session.add(PurchaseOrderItem(po_id=po.id, line_number=2, material_id=svc.id, description='Jasa', quantity=3, uom='TRIP', unit_price=100, total_price=300))
    zone = WarehouseZone(code='Z-NI', name='Z', zone_type='all', material_type='all'); db_session.add(zone); db_session.commit()
    loc = WarehouseLocation(zone_id=zone.id, location_code='LOC-NI', rack='R', level='L', position='P', capacity=100, capacity_uom='kg')
    db_session.add(loc); po.status = 'approved'; db_session.commit()
    r = client.post('/api/purchasing/grn', headers=auth_headers, json={
        'po_id': po.id, 'supplier_id': supplier.id, 'received_date': date.today().isoformat(),
        'items': [{'po_item_id': po_item.id, 'material_id': material.id, 'quantity_ordered': 10, 'quantity_received': 10, 'uom': 'KG', 'location_id': loc.id}]})
    assert r.status_code in (200, 201), r.get_json()
    db_session.refresh(po)
    assert po.status == 'received'
    codes = [m['code'] for m in client.get('/api/materials/inventory', headers=auth_headers).get_json().get('materials', [])]
    assert 'JASA-X' not in codes


def _item_row(kategori, kode, nama, jenis, persediaan=None, penjualan=None, ppn='Y', satuan=None):
    from routes.master_data_import import COL
    r = [None] * (max(COL.values()) + 1)
    for k, v in (('kategori', kategori), ('kode', kode), ('nama', nama), ('jenis', jenis), ('satuan', satuan), ('ppn', ppn),
                 ('gl_persediaan', persediaan), ('gl_penjualan', penjualan), ('non_aktif', 'TIDAK'), ('harga_beli', 0)):
        r[COL[k]] = v
    return r


def test_accurate_cost_items_import_as_non_inventory_with_expense_account(client, auth_headers, db_session):
    from models.finance import Account
    from models.product import Material, Product
    from routes.master_data_import import import_item_rows
    exp = Account(account_code='610103', account_name='Biaya Impor', account_type='expense', normal_balance='debit')
    rev = Account(account_code='400005', account_name='Penjualan Lain', account_type='revenue', normal_balance='credit')
    db_session.add_all([exp, rev]); db_session.commit()
    rows = [
        _item_row('LAIN-LAIN', '5100000014', 'Biaya Import (Y)', 'NON', '610103', '400005'),
        _item_row('LAIN-LAIN', '5100000001', 'Biaya Makloon', 'SVC', '610103', '400005', ppn='Y'),
        _item_row('LAIN-LAIN', '8000000000', 'Penjualan lain-lain', 'PDC', '610103', '400005'),
        _item_row('Umum', '4010406007', 'POLYMORPH TRAVEL PACK', 'INV', '610103', None, satuan='PCK'),     # barang persediaan nyasar: dilewati
        _item_row('LAIN-LAIN', '9000000001', 'Paket grup', 'GROUP (barang tipe grup tidak dapat diimport ulang)'),
    ]
    res = import_item_rows(rows, commit=True)
    assert res['created_material'] == 3 and res['skipped_category'] == 2 and res['error_count'] == 0, res
    m = Material.query.filter_by(code='5100000001').first()
    assert m.material_type == 'non_inventory' and m.primary_uom == 'UNIT' and m.akun_beban_id == exp.id
    assert m.akun_persediaan_id is None and m.akun_penjualan_id is None and m.is_excluded_from_mrp and m.ppn_code == 'Y'
    assert Material.query.filter_by(code='8000000000').first().akun_penjualan_id == rev.id      # item pendapatan
    assert Material.query.filter_by(code='4010406007').first() is None and Product.query.filter_by(code='4010406007').first() is None
    assert import_item_rows(rows, commit=True)['created_material'] == 0                          # impor ulang tidak menggandakan


def test_accurate_extra_columns_are_stored_and_backfilled_without_overwriting(client, auth_headers, db_session):
    from models.finance import Account
    from models.product import Material, Product, ProductPackaging
    from models.purchasing import Supplier
    from routes.master_data_import import COL, backfill_item_extras, import_item_rows
    db_session.add(Supplier(code='SUP-BL', company_name='PT BEST LABEL', is_active=True))
    db_session.commit()

    def row(kategori, kode, nama, jenis, satuan, **extra):
        r = _item_row(kategori, kode, nama, jenis, satuan=satuan)
        for k, v in extra.items():
            r[COL[k]] = v
        return r
    rows = [
        row('BARANG JADI', 'FG-X1', 'Barang jadi X', 'INV', 'PCK', barcode='8993425280268', merek='ALFA', serial='YA', kadaluarsa='YA',
            isi='24.000000', catatan='Catatan produk', panjang_m='0.48', berat_kg='7.35'),
        row('BAHAN PEMBANTU', 'MAT-X1', 'Label X', 'INV', 'ROL', pemasok='PT BEST LABEL', batas_min='50000.000000', barcode='LBL-1'),
    ]
    res = import_item_rows(rows, commit=True)
    assert res['created_product'] == 1 and res['created_material'] == 1 and res['error_count'] == 0, res
    p = Product.query.filter_by(code='FG-X1').first(); m = Material.query.filter_by(code='MAT-X1').first()
    assert p.barcode == '8993425280268' and p.brand == 'ALFA' and p.require_batch and p.require_expiry and p.notes == 'Catatan produk'
    assert float(p.item_length_m) == 0.48 and float(p.item_weight_kg) == 7.35
    assert ProductPackaging.query.filter_by(product_id=p.id).first().packs_per_karton == 24
    assert m.supplier_id is not None and float(m.min_stock_level) == 50000 and m.barcode == 'LBL-1'

    # backfill on existing items: fills blanks only, never overwrites what is already there
    p.brand = 'MANUAL'; p.barcode = None; db_session.commit()
    out = backfill_item_extras(rows, commit=True)
    assert out['updated'] == 2 and out['error_count'] == 0
    db_session.refresh(p)
    assert p.brand == 'MANUAL' and p.barcode == '8993425280268'
    # API exposes and edits them
    got = client.get(f'/api/products/{p.id}', headers=auth_headers).get_json()
    d = got.get('product', got)
    assert d['barcode'] == '8993425280268' and d['require_batch'] is True
    assert client.put(f'/api/materials/{m.id}', headers=auth_headers, json={'brand': 'ABC', 'barcode': ''}).status_code == 200
    db_session.refresh(m)
    assert m.brand == 'ABC' and m.barcode is None


def test_grn_requires_expiry_only_for_flagged_items_and_never_batch(client, auth_headers, db_session):
    from models.warehouse import WarehouseZone, WarehouseLocation
    supplier, material, po, po_item = _setup_po(db_session, unit_price=1000, quantity=10)
    material.require_batch = True; material.require_expiry = True; po.status = 'approved'
    zone = WarehouseZone(code='Z-RB', name='Z', zone_type='all', material_type='all'); db_session.add(zone); db_session.commit()
    loc = WarehouseLocation(zone_id=zone.id, location_code='LOC-RB', rack='R', level='L', position='P', capacity=100, capacity_uom='kg')
    db_session.add(loc); db_session.commit()
    base = {'po_item_id': po_item.id, 'material_id': material.id, 'quantity_ordered': 10, 'quantity_received': 10, 'uom': 'KG', 'location_id': loc.id}
    post = lambda **extra: client.post('/api/purchasing/grn', headers=auth_headers, json={
        'po_id': po.id, 'supplier_id': supplier.id, 'received_date': date.today().isoformat(), 'items': [{**base, **extra}]})
    r = post()                                        # tanpa batch dan tanpa tanggal: ditolak karena kedaluwarsa, BUKAN batch
    assert r.status_code == 400 and 'kedaluwarsa' in r.get_json()['error'].lower()
    assert post(expiry_date='2027-12-31').status_code in (200, 201)      # tanpa batch tetap boleh
    material.require_expiry = False; db_session.commit()
    assert post().status_code in (200, 201)           # tidak bertanda kedaluwarsa: tidak diminta apa pun
    detail = client.get(f'/api/purchasing/purchase-orders/{po.id}', headers=auth_headers).get_json()
    assert (detail.get('purchase_order', detail))['items'][0]['require_expiry'] is False
