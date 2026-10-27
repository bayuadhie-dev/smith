import pytest
from models import db
from models.purchasing import PurchaseOrderItem, PurchaseOrderItemSchedule
from routes.purchasing import _apply_item_schedules


def _item(qty=100):
    it = PurchaseOrderItem(po_id=1, line_number=1, quantity=qty, uom='KG', unit_price=1, total_price=qty)
    return it


def test_valid_schedules_replace_existing():
    it = _item()
    _apply_item_schedules(it, [{'expected_date': '2026-11-05', 'quantity': 40}, {'expected_date': '2026-11-20', 'quantity': 60, 'notes': 'x'}])
    assert [float(s.quantity) for s in it.schedules] == [40.0, 60.0]
    _apply_item_schedules(it, [{'expected_date': '2026-12-01', 'quantity': 10}])
    assert len(it.schedules) == 1


def test_total_over_quantity_rejected():
    with pytest.raises(ValueError):
        _apply_item_schedules(_item(50), [{'expected_date': '2026-11-05', 'quantity': 40}, {'expected_date': '2026-11-06', 'quantity': 20}])


def test_bad_row_rejected():
    with pytest.raises(ValueError):
        _apply_item_schedules(_item(), [{'expected_date': 'bukan-tanggal', 'quantity': 5}])
    with pytest.raises(ValueError):
        _apply_item_schedules(_item(), [{'expected_date': '2026-11-05', 'quantity': 0}])


def test_http_create_get_update_schedules(client, auth_headers, db_session, test_material):
    from models.purchasing import Supplier
    sup = Supplier(code='SUP-SCH', company_name='Sup Sch', is_active=True)
    db_session.add(sup); db_session.commit()
    body = {'supplier_id': sup.id, 'order_date': '2026-10-27', 'currency': 'IDR',
            'items': [{'material_id': test_material.id, 'quantity': 100, 'unit_price': 10, 'uom': 'KG',
                       'schedules': [{'expected_date': '2026-11-05', 'quantity': 40}, {'expected_date': '2026-11-20', 'quantity': 60}]}]}
    r = client.post('/api/purchasing/purchase-orders', json=body, headers=auth_headers)
    assert r.status_code == 201, r.get_json()
    pid = r.get_json()['po_id']
    d = client.get(f'/api/purchasing/purchase-orders/{pid}', headers=auth_headers).get_json()
    item = d['items'][0]
    assert [s['quantity'] for s in item['schedules']] == [40.0, 60.0]
    assert item['quantity_received'] == 0

    r = client.put(f'/api/purchasing/purchase-orders/{pid}/schedules', headers=auth_headers,
                   json={'items': [{'item_id': item['id'], 'schedules': [{'expected_date': '2026-12-01', 'quantity': 100}]}]})
    assert r.status_code == 200
    d = client.get(f'/api/purchasing/purchase-orders/{pid}', headers=auth_headers).get_json()
    assert len(d['items'][0]['schedules']) == 1

    r = client.put(f'/api/purchasing/purchase-orders/{pid}/schedules', headers=auth_headers,
                   json={'items': [{'item_id': item['id'], 'schedules': [{'expected_date': '2026-12-01', 'quantity': 101}]}]})
    assert r.status_code == 400

    bad = dict(body, items=[dict(body['items'][0], schedules=[{'expected_date': '2026-11-05', 'quantity': 999}])])
    assert client.post('/api/purchasing/purchase-orders', json=bad, headers=auth_headers).status_code == 400
