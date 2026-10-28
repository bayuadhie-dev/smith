from datetime import date

from tests.test_grn_reject_quarantine import _setup_warehouse


def test_create_grn_saves_lot_dates_notes_and_updates_stock(client, auth_headers, db_session, test_material):
    from models.purchasing import GRNItem, PurchaseOrder, PurchaseOrderItem, Supplier
    from models.warehouse import Inventory
    main_location, _ = _setup_warehouse(db_session)
    sup = Supplier(code='SUP-GF', company_name='Sup GF', is_active=True)
    db_session.add(sup); db_session.commit()
    po = PurchaseOrder(po_number='PO-GF-1', supplier_id=sup.id, order_date=date.today(), status='approved', total_amount=1000000)
    db_session.add(po); db_session.commit()
    poi = PurchaseOrderItem(po_id=po.id, line_number=1, material_id=test_material.id, quantity=100, uom='KG', unit_price=10000, total_price=1000000)
    db_session.add(poi); db_session.commit()
    body = {'po_id': po.id, 'supplier_id': sup.id, 'items': [{
        'po_item_id': poi.id, 'material_id': test_material.id, 'quantity_ordered': 100, 'quantity_received': 60, 'quantity_accepted': 60,
        'uom': 'KG', 'batch_number': 'B-GF-1', 'lot_number': 'LOT-9', 'production_date': '2026-10-01', 'expiry_date': '2027-10-01',
        'notes': 'kemasan penyok', 'location_id': main_location.id}]}
    r = client.post('/api/purchasing/grn', json=body, headers=auth_headers)
    assert r.status_code == 201, r.get_json()
    gi = GRNItem.query.filter_by(po_item_id=poi.id).first()
    assert gi.lot_number == 'LOT-9' and str(gi.production_date) == '2026-10-01' and str(gi.expiry_date) == '2027-10-01' and gi.notes == 'kemasan penyok'
    inv = Inventory.query.filter_by(location_id=main_location.id, material_id=test_material.id, batch_number='B-GF-1').first()
    assert float(inv.quantity_on_hand) == 60
    db_session.refresh(poi)
    assert float(poi.quantity_received) == 60
    assert PurchaseOrder.query.get(po.id).status == 'partial'
