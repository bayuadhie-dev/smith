from datetime import datetime


def _po(db_session, num='PO-DA-1'):
    from models.purchasing import Supplier, PurchaseOrder
    sup = Supplier(code='SUP-' + num, company_name='PT ' + num); db_session.add(sup); db_session.commit()
    po = PurchaseOrder(po_number=num, supplier_id=sup.id, order_date=datetime(2026, 11, 5), status='draft', currency='IDR', total_amount=0)
    db_session.add(po); db_session.commit()
    return po


def test_change_number_and_unique(client, auth_headers, db_session):
    a, b = _po(db_session, 'PO-DA-1'), _po(db_session, 'PO-DA-2')
    r = client.put(f'/api/doc-actions/purchase_order/{a.id}/number', json={'number': '26-11-OLC-099'}, headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    db_session.refresh(a); assert a.po_number == '26-11-OLC-099'
    assert client.put(f'/api/doc-actions/purchase_order/{b.id}/number', json={'number': '26-11-OLC-099'}, headers=auth_headers).status_code == 400
    assert client.put(f'/api/doc-actions/purchase_order/{b.id}/number', json={'number': ' '}, headers=auth_headers).status_code == 400


def test_delete_unused_and_blocked(client, auth_headers, db_session):
    from models.purchasing import PurchaseOrder, GoodsReceivedNote
    a = _po(db_session, 'PO-DA-3')
    assert client.get(f'/api/doc-actions/purchase_order/{a.id}/can-delete', headers=auth_headers).get_json()['can_delete'] is True
    assert client.delete(f'/api/doc-actions/purchase_order/{a.id}', headers=auth_headers).status_code == 200
    assert db_session.get(PurchaseOrder, a.id) is None
    b = _po(db_session, 'PO-DA-4')
    db_session.add(GoodsReceivedNote(grn_number='G-1', po_id=b.id, supplier_id=b.supplier_id, receipt_date=datetime(2026, 11, 5).date(), status='received'))
    db_session.commit()
    r = client.delete(f'/api/doc-actions/purchase_order/{b.id}', headers=auth_headers)
    assert r.status_code == 400 and 'GRN' in r.get_json()['error']
