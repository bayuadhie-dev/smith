"""
Regression test for a real crash bug found 2026-10-07 while checking the
QC dashboard: 6 call sites across routes/quality.py, routes/bom.py (x3),
routes/dcc.py, routes/materials_crud.py, routes/materials.py read
`.supplier.name` - but Supplier (models/purchasing.py) only has
`company_name`, never `name`. AttributeError -> 500 whenever a row
actually has a linked supplier (silent/latent until real supplier data
exists, which is why it went unnoticed). Fixed to `.supplier.company_name`
everywhere. This test exercises the one found live in production
(QC incoming-materials with status=all) with a real linked supplier.
"""
from datetime import date, datetime


def test_qc_incoming_materials_with_linked_supplier_does_not_crash(client, auth_headers, db_session, test_product):
    from models.purchasing import PurchaseOrder, PurchaseOrderItem, Supplier, GoodsReceivedNote, GRNItem

    supplier = Supplier(code='SUP-QC-TEST', company_name='Test Supplier QC', is_active=True)
    db_session.add(supplier)
    db_session.commit()

    po = PurchaseOrder(
        po_number='PO-QC-TEST-001', supplier_id=supplier.id, order_date=date.today(),
        status='confirmed', total_amount=100000,
    )
    db_session.add(po)
    db_session.commit()

    po_item = PurchaseOrderItem(
        po_id=po.id, line_number=1, quantity=10, uom='PCS',
        unit_price=10000, total_price=100000, product_id=test_product.id,
    )
    db_session.add(po_item)
    db_session.commit()

    grn = GoodsReceivedNote(
        grn_number='GRN-QC-TEST-001', po_id=po.id, supplier_id=supplier.id,
        receipt_date=datetime.utcnow(), status='pending',
    )
    db_session.add(grn)
    db_session.commit()

    grn_item = GRNItem(
        grn_id=grn.id, po_item_id=po_item.id, product_id=test_product.id,
        quantity_ordered=10, quantity_received=10, uom='PCS',
    )
    db_session.add(grn_item)
    db_session.commit()

    resp = client.get('/api/quality/incoming-materials?status=all', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()
    match = next(m for m in data['materials'] if m['gr_number'] == 'GRN-QC-TEST-001')
    assert match['supplier_name'] == 'Test Supplier QC'


def test_qc_incoming_materials_material_backed_grn_item_does_not_crash(client, auth_headers, db_session):
    """GRNItem.material relationship is disabled on the model
    ('# Disabled temporarily' in models/purchasing.py) - a material-backed
    (not product-backed) receipt item used to crash with
    AttributeError: 'GRNItem' object has no attribute 'material'."""
    from models.purchasing import PurchaseOrder, PurchaseOrderItem, Supplier, GoodsReceivedNote, GRNItem
    from models.product import Material

    supplier = Supplier(code='SUP-QC-MAT', company_name='Material Supplier', is_active=True)
    db_session.add(supplier)
    material = Material(
        code='MAT-QC-TEST', name='Test Raw Material', material_type='raw_materials',
        category='test', primary_uom='KG', cost_per_unit=1000,
    )
    db_session.add(material)
    db_session.commit()

    po = PurchaseOrder(
        po_number='PO-QC-MAT-001', supplier_id=supplier.id, order_date=date.today(),
        status='confirmed', total_amount=50000,
    )
    db_session.add(po)
    db_session.commit()

    po_item = PurchaseOrderItem(
        po_id=po.id, line_number=1, quantity=5, uom='KG',
        unit_price=10000, total_price=50000, material_id=material.id,
    )
    db_session.add(po_item)
    db_session.commit()

    grn = GoodsReceivedNote(
        grn_number='GRN-QC-MAT-001', po_id=po.id, supplier_id=supplier.id,
        receipt_date=datetime.utcnow(), status='pending',
    )
    db_session.add(grn)
    db_session.commit()

    grn_item = GRNItem(
        grn_id=grn.id, po_item_id=po_item.id, material_id=material.id,
        quantity_ordered=5, quantity_received=5, uom='KG',
    )
    db_session.add(grn_item)
    db_session.commit()

    resp = client.get('/api/quality/incoming-materials?status=all', headers=auth_headers)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()
    match = next(m for m in data['materials'] if m['gr_number'] == 'GRN-QC-MAT-001')
    assert match['material_code'] == 'MAT-QC-TEST'
    assert match['material_name'] == 'Test Raw Material'
