import pytest
from models.production import PackingListNew, PackingListNewItem, WIPStock, WIPStockMovement, BillOfMaterials, BOMItem
from models.product import Product, Material
from models.user import User

@pytest.fixture
def fg_and_wip_setup(db_session):
    # 1. Finished Good Product
    fg_product = Product(
        code='FG-ALFA',
        name='Alfa Finished Good',
        material_type='finished_goods',
        primary_uom='PCS',
        is_producible=True,
        is_active=True
    )
    db_session.add(fg_product)
    
    # 2. WIP Component Products (BOM multi-komponen "Alfa 3 WIP")
    wip1 = Product(
        code='WIP-ALFA-01',
        name='WIP Alfa Part 1',
        material_type='wip',
        primary_uom='PCS',
        is_producible=True,
        is_active=True
    )
    wip2 = Product(
        code='WIP-ALFA-02',
        name='WIP Alfa Part 2',
        material_type='wip',
        primary_uom='PCS',
        is_producible=True,
        is_active=True
    )
    db_session.add_all([wip1, wip2])
    db_session.commit()
    
    # 3. Materials mapping to these WIPs (name start with "WIP ")
    mat1 = Material(
        code='WIP-ALFA-01',
        name='WIP Alfa Part 1',
        material_type='wip',
        category='WIP',
        primary_uom='PCS',
        is_active=True
    )
    mat2 = Material(
        code='WIP-ALFA-02',
        name='WIP Alfa Part 2',
        material_type='wip',
        category='WIP',
        primary_uom='PCS',
        is_active=True
    )
    db_session.add_all([mat1, mat2])
    db_session.commit()
    
    # 4. Bill of Materials
    bom = BillOfMaterials(
        product_id=fg_product.id,
        bom_number='BOM-ALFA-01',
        version='1.0',
        pack_per_carton=24,
        batch_uom='PCS',
        is_active=True
    )
    db_session.add(bom)
    db_session.commit()
    
    bom_item1 = BOMItem(
        bom_id=bom.id,
        line_number=1,
        material_id=mat1.id,
        quantity=24.0, # 24 pcs per FG carton
        uom='PCS'
    )
    bom_item2 = BOMItem(
        bom_id=bom.id,
        line_number=2,
        material_id=mat2.id,
        quantity=24.0, # 24 pcs per FG carton
        uom='PCS'
    )
    db_session.add_all([bom_item1, bom_item2])
    
    # 5. WIP Stocks with enough inventory for testing
    wip_stock1 = WIPStock(
        product_id=wip1.id,
        quantity_pcs=1000,
        quantity_carton=41,
        pack_per_carton=24
    )
    wip_stock2 = WIPStock(
        product_id=wip2.id,
        quantity_pcs=1000,
        quantity_carton=41,
        pack_per_carton=24
    )
    db_session.add_all([wip_stock1, wip_stock2])
    db_session.commit()
    
    return {
        'fg': fg_product,
        'wip1': wip1,
        'wip2': wip2,
        'wip_stock1': wip_stock1,
        'wip_stock2': wip_stock2,
        'bom': bom
    }


def test_packing_list_flow(client, auth_headers, fg_and_wip_setup, db_session):
    fg = fg_and_wip_setup['fg']
    
    # Skenario 1: Buat PL Kosong (Draft total_carton = 0)
    response = client.post('/api/packing-list', json={
        'product_id': fg.id,
        'total_carton': 0,
        'notes': 'Test draft kosong'
    }, headers=auth_headers)
    
    assert response.status_code == 201
    pl_data = response.json['packing_list']
    pl_id = pl_data['id']
    assert pl_data['total_carton'] == 0
    assert pl_data['status'] == 'draft'
    
    # Skenario 2: Tambah Batch-01 (5 karton, cartons_per_pallet = 5)
    response = client.post(f'/api/packing-list/{pl_id}/batches', json={
        'batch_mixing': 'BATCH-01',
        'total_carton': 5,
        'cartons_per_pallet': 5
    }, headers=auth_headers)
    
    assert response.status_code == 201
    # Check that stock was reduced correctly
    db_session.expire_all()
    assert fg_and_wip_setup['wip_stock1'].quantity_pcs == 1000 - (5 * 24)
    assert fg_and_wip_setup['wip_stock2'].quantity_pcs == 1000 - (5 * 24)
    
    # Check that highest_carton_number_used was set to 5
    pl = db_session.get(PackingListNew, pl_id)
    assert pl.total_carton == 5
    assert pl.highest_carton_number_used == 5
    assert pl.status == 'in_progress'
    
    # Skenario 3: Timbang semua 5 karton di Batch-01 -> pastikan status TETAP in_progress, bukan completed
    items = pl.items.filter_by(batch_mixing='BATCH-01').all()
    assert len(items) == 5
    weigh_payload = {
        'items': [{'id': item.id, 'weight_kg': 12.5} for item in items]
    }
    response = client.put(f'/api/packing-list/{pl_id}/items/weigh', json=weigh_payload, headers=auth_headers)
    assert response.status_code == 200
    
    db_session.expire_all()
    pl = db_session.get(PackingListNew, pl_id)
    assert pl.status == 'in_progress' # STATUS HARUS TETAP IN_PROGRESS (Point 9!)
    
    # Skenario 4: Tambah Batch-02 (5 karton, cartons_per_pallet = 5) -> Harus berhasil karena status masih in_progress
    response = client.post(f'/api/packing-list/{pl_id}/batches', json={
        'batch_mixing': 'BATCH-02',
        'total_carton': 5,
        'cartons_per_pallet': 5
    }, headers=auth_headers)
    assert response.status_code == 201
    
    # Check numbering continues from highest_carton_number_used (starts at 6, ends at 10)
    db_session.expire_all()
    pl = db_session.get(PackingListNew, pl_id)
    assert pl.total_carton == 10
    assert pl.highest_carton_number_used == 10
    
    batch2_items = pl.items.filter_by(batch_mixing='BATCH-02').order_by(PackingListNewItem.carton_number).all()
    assert len(batch2_items) == 5
    assert batch2_items[0].carton_number == 6
    assert batch2_items[-1].carton_number == 10
    
    # Skenario 5: Coba panggil completion manual sebelum Batch-02 ditimbang -> harus ditolak (400)
    response = client.put(f'/api/packing-list/{pl_id}', json={'status': 'completed'}, headers=auth_headers)
    assert response.status_code == 400
    assert 'Semua karton harus ditimbang' in response.json['error']
    
    # Skenario 6: Coba hapus Batch-01 yang sudah tertimbang -> harus ditolak (400)
    response = client.delete(f'/api/packing-list/{pl_id}/batches/BATCH-01', headers=auth_headers)
    assert response.status_code == 400
    assert 'Tidak dapat menghapus batch yang sudah ditimbang' in response.json['error']
    
    # Skenario 7: Hapus Batch-02 yang belum ditimbang -> harus berhasil & reverse stock
    prev_pcs1 = fg_and_wip_setup['wip_stock1'].quantity_pcs
    response = client.delete(f'/api/packing-list/{pl_id}/batches/BATCH-02', headers=auth_headers)
    assert response.status_code == 200
    
    db_session.expire_all()
    pl = db_session.get(PackingListNew, pl_id)
    assert pl.total_carton == 5 # Decreased back to 5
    assert pl.highest_carton_number_used == 10 # highest_carton_number_used is NOT decreased (Pilihan B)
    assert fg_and_wip_setup['wip_stock1'].quantity_pcs == prev_pcs1 + (5 * 24) # Stock returned!
    
    # Skenario 8: Selesaikan PL secara manual (karena Batch-01 sudah ditimbang semua, dan Batch-02 sudah dihapus)
    response = client.put(f'/api/packing-list/{pl_id}', json={'status': 'completed'}, headers=auth_headers)
    assert response.status_code == 200
    
    db_session.expire_all()
    pl = db_session.get(PackingListNew, pl_id)
    assert pl.status == 'completed'
    
    # Skenario 9: Coba tambah Batch baru setelah completed -> harus ditolak (400)
    response = client.post(f'/api/packing-list/{pl_id}/batches', json={
        'batch_mixing': 'BATCH-03',
        'total_carton': 5,
        'cartons_per_pallet': 5
    }, headers=auth_headers)
    assert response.status_code == 400
    assert 'Tidak dapat menambah batch' in response.json['error']
