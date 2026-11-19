"""WIP Stock page endpoints (routes/production.py).

The page called /api/packing-list/wip-stock*, which never existed, so it was
broken from 26 Oct 2026 until these routes were added. The tests pin the shape
the page reads plus the rules around a manual correction.
"""
from models import db


def _wip(db_session, code='WIP-T1', pcs=240, carton=10, pack=24):
    from models.product import Product
    from models.production import WIPStock

    p = Product(code=code, name=f'WIP {code}', material_type='wip', primary_uom='PCS', is_active=True)
    db_session.add(p)
    db_session.commit()
    w = WIPStock(product_id=p.id, quantity_pcs=pcs, quantity_carton=carton, pack_per_carton=pack,
                 last_wo_number='WO-T-1')
    db_session.add(w)
    db_session.commit()
    return p, w


def test_wip_stock_list_has_the_shape_the_page_reads(client, auth_headers, db_session):
    p, _ = _wip(db_session)
    r = client.get('/api/production/wip-stock?per_page=5', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['pagination']['pages'] >= 1 and body['pagination']['page'] == 1
    row = next(w for w in body['wip_stocks'] if w['product_id'] == p.id)
    assert row['product_code'] == 'WIP-T1' and row['quantity_carton'] == 10 and row['pack_per_carton'] == 24

    found = client.get('/api/production/wip-stock?search=WIP-T1', headers=auth_headers).get_json()
    assert [w['product_id'] for w in found['wip_stocks']] == [p.id]
    assert client.get('/api/production/wip-stock?search=tidak-ada-ini', headers=auth_headers).get_json()['wip_stocks'] == []


def test_wip_adjustment_needs_a_reason_and_cannot_go_negative(client, auth_headers, db_session):
    p, w = _wip(db_session, code='WIP-T2', pcs=48, carton=2)

    no_reason = client.post('/api/production/wip-stock/adjustment', headers=auth_headers,
                            json={'product_id': p.id, 'adjustment_carton': 1, 'adjustment_pcs': 24})
    assert no_reason.status_code == 400 and 'Alasan' in no_reason.get_json()['error']

    too_much = client.post('/api/production/wip-stock/adjustment', headers=auth_headers,
                           json={'product_id': p.id, 'adjustment_carton': -5, 'adjustment_pcs': -120,
                                 'notes': 'salah hitung'})
    assert too_much.status_code == 400 and 'minus' in too_much.get_json()['error']

    ok = client.post('/api/production/wip-stock/adjustment', headers=auth_headers,
                     json={'product_id': p.id, 'adjustment_carton': -1, 'adjustment_pcs': -24,
                           'notes': 'rusak saat pindah gudang'})
    assert ok.status_code == 200, ok.get_json()
    db.session.refresh(w)
    assert float(w.quantity_pcs) == 24 and float(w.quantity_carton) == 1

    moves = client.get(f'/api/production/wip-stock/{p.id}/movements', headers=auth_headers).get_json()['movements']
    assert len(moves) == 1
    assert moves[0]['movement_type'] == 'adjustment' and moves[0]['notes'] == 'rusak saat pindah gudang'
    assert moves[0]['balance_pcs'] == 24 and moves[0]['quantity_carton'] == -1


def test_wip_adjustment_rejects_unknown_product_and_zero(client, auth_headers, db_session):
    p, _ = _wip(db_session, code='WIP-T3')
    zero = client.post('/api/production/wip-stock/adjustment', headers=auth_headers,
                       json={'product_id': p.id, 'adjustment_carton': 0, 'adjustment_pcs': 0, 'notes': 'kosong'})
    assert zero.status_code == 400 and 'nol' in zero.get_json()['error']

    missing = client.post('/api/production/wip-stock/adjustment', headers=auth_headers,
                          json={'product_id': 999999, 'adjustment_carton': 1, 'notes': 'tidak ada'})
    assert missing.status_code == 404
