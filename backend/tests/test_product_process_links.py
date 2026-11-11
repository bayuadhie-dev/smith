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
