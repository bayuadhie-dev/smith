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
