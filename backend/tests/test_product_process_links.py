def _p(db_session, code, name):
    from models.product import Product
    p = Product(code=code, name=name, primary_uom='PCS', material_type='finished_goods', is_active=True)
    db_session.add(p); db_session.commit()
    return p


def test_auto_link_by_name(client, auth_headers, db_session):
    fg = _p(db_session, '4020101001', 'INDOMARET WET WIPES 50S FT @24')
    wip = _p(db_session, '3050201001', 'WIP INDOMARET WET WIPES 50S')
    waste = _p(db_session, '7000000023', 'WASTE INDOMARET WET WIPES 50S')
    ing = _p(db_session, '1050000001', 'INGREDIENTS INDOMARET WET WIPES 50S')
    d = client.post('/api/products-new/auto-link-process', headers=auth_headers, json={'dry_run': True}).get_json()
    assert d['dry_run'] and d['fg_matched'] == 1 and d['fg_updated'] == 0
    db_session.refresh(fg)
    assert fg.wip_product_id is None
    d = client.post('/api/products-new/auto-link-process', headers=auth_headers, json={'dry_run': False}).get_json()
    assert d['fg_updated'] == 1
    db_session.refresh(fg)
    assert (fg.wip_product_id, fg.waste_product_id, fg.ingredient_product_id) == (wip.id, waste.id, ing.id)
    assert client.get(f'/api/products-new/{fg.id}', headers=auth_headers).get_json()['product']['wip_product_id'] == wip.id


def test_create_wo_prepares_package_and_fg_transfer_needs_packing_list(client, auth_headers, db_session):
    from models.production import WorkOrder
    fg = _p(db_session, '4020109001', 'PAKET UJI 50S')
    wip = _p(db_session, '3050109001', 'WIP PAKET UJI 50S')
    waste = _p(db_session, '7000000999', 'WASTE PAKET UJI 50S')
    fg.wip_product_id, fg.waste_product_id = wip.id, waste.id
    db_session.commit()
    r = client.post('/api/production/work-orders', headers=auth_headers, json={'product_id': fg.id, 'quantity': 100})
    assert r.status_code == 201, r.get_json()
    pk = r.get_json()['package_work_orders']
    assert sorted(x['role'] for x in pk) == ['waste', 'wip']
    child = WorkOrder.query.filter_by(parent_wo_id=r.get_json()['wo_id']).all()
    assert len(child) == 2 and all(c.status == 'planned' for c in child)
    r2 = client.post('/api/production/work-orders', headers=auth_headers, json={'product_id': fg.id, 'quantity': 5, 'skip_package': True})
    assert r2.get_json()['package_work_orders'] == []

    from models import WarehouseLocation, WarehouseZone
    z = WarehouseZone(code='ZPK', name='Zona PK', material_type='finished_goods', zone_type='storage', is_active=True)
    db_session.add(z); db_session.commit()
    a = WarehouseLocation(location_code='PKA', zone_id=z.id, rack='R', level='1', position='1', capacity=100, capacity_uom='PCS', is_active=True)
    b = WarehouseLocation(location_code='PKB', zone_id=z.id, rack='R', level='1', position='2', capacity=100, capacity_uom='PCS', is_active=True)
    db_session.add_all([a, b]); db_session.commit()
    t = client.post('/api/stock-transfers', headers=auth_headers, json={
        'from_location_id': a.id, 'to_location_id': b.id, 'lines': [{'product_id': fg.id, 'item_name': fg.name, 'quantity': 5}]})
    assert t.status_code == 400 and 'Packing List' in t.get_json()['error']
