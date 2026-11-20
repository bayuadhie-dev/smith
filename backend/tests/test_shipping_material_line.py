"""Surat jalan boleh memuat material (waste sliting, drum bekas), bukan hanya produk jadi.

Sebelumnya barang seperti ini hanya bisa ditulis sebagai baris keterangan bebas:
suratnya tercetak benar, tapi stok gudang tidak pernah berkurang.
"""
from datetime import date


def _stok_material(db_session, test_material, qty=100):
    from models.warehouse import Inventory, WarehouseLocation, WarehouseZone

    zona = WarehouseZone(code='Z-WASTE', name='Gudang Bahan Baku', material_type='raw_materials')
    db_session.add(zona)
    db_session.commit()
    lok = WarehouseLocation(zone_id=zona.id, location_code='LOC-WASTE', rack='R1', level='L1',
                            position='P1', capacity=1000, capacity_uom='kg')
    db_session.add(lok)
    db_session.commit()
    inv = Inventory(material_id=test_material.id, location_id=lok.id, batch_number='W-001',
                    quantity_on_hand=qty, quantity_available=qty, stock_status='available',
                    is_active=True)
    db_session.add(inv)
    db_session.commit()
    return inv


def test_kirim_material_mengurangi_stok(client, auth_headers, db_session, test_material, test_customer):
    inv = _stok_material(db_session, test_material, 100)

    r = client.post('/api/shipping/orders', headers=auth_headers, json={
        'customer_id': test_customer.id,
        'shipping_date': date.today().isoformat(),
        'items': [{'material_id': test_material.id, 'quantity': 30, 'uom': 'KG',
                   'description': 'Waste sliting'}],
    })
    assert r.status_code in (200, 201), r.get_json()

    db_session.refresh(inv)
    assert float(inv.quantity_on_hand) == 70, 'stok material harus ikut berkurang'

    from models.shipping import ShippingItem
    baris = ShippingItem.query.filter_by(material_id=test_material.id).all()
    assert len(baris) == 1 and float(baris[0].quantity) == 30
    assert baris[0].batch_number == 'W-001'


def test_tolak_baris_berisi_produk_dan_material_sekaligus(client, auth_headers, db_session, test_material, test_customer, test_product):
    _stok_material(db_session, test_material)
    r = client.post('/api/shipping/orders', headers=auth_headers, json={
        'customer_id': test_customer.id,
        'shipping_date': date.today().isoformat(),
        'items': [{'material_id': test_material.id, 'product_id': test_product.id,
                   'quantity': 1, 'uom': 'KG'}],
    })
    assert r.status_code == 400
    assert 'produk atau material' in r.get_json()['error']


def test_stok_material_bisa_dipilih_lewat_stock_options(client, auth_headers, db_session, test_material):
    _stok_material(db_session, test_material, 42)
    r = client.get(f'/api/shipping/stock-options?material_id={test_material.id}', headers=auth_headers)
    assert r.status_code == 200, r.get_json()
    zones = r.get_json()['zones']
    assert zones and zones[0]['batches'][0]['batch_number'] == 'W-001'
    assert zones[0]['qty'] == 42
