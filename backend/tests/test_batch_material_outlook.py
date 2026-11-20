"""Dua batch draft yang memperebutkan bahan yang sama tidak boleh sama-sama terlihat cukup.

Sebelum ini kecukupan dinilai per batch terhadap stok penuh, padahal batch draft
belum menahan apa pun - penahanan baru terjadi saat batch disetujui. Akibatnya
batch kedua baru ketahuan kurang pada saat persetujuan, bukan saat direncanakan.
"""
from datetime import date


def _siapkan(db_session, test_product, test_material, stok_kg):
    from models.production import WorkOrder, Machine, BillOfMaterials, BOMItem
    from models.batch_scheduling import ProductionBatch, ProductionRecipe
    from models.warehouse import Inventory, WarehouseLocation, WarehouseZone

    machine = Machine(code='MC-OUT', name='Mesin Uji Outlook', machine_type='test', status='active')
    db_session.add(machine)
    db_session.commit()

    bom = BillOfMaterials(bom_number='BOM-OUT-1', product_id=test_product.id, version='1',
                          batch_size=1, batch_uom='PCS', is_active=True)
    db_session.add(bom)
    db_session.commit()
    db_session.add(BOMItem(bom_id=bom.id, line_number=1, material_id=test_material.id, quantity=1, uom='KG'))

    zona = WarehouseZone(code='Z-OUT', name='Zona Uji Outlook', material_type='raw_materials')
    db_session.add(zona)
    db_session.commit()
    lok = WarehouseLocation(zone_id=zona.id, location_code='LOC-OUT', rack='R1', level='L1',
                            position='P1', capacity=100000, capacity_uom='kg')
    db_session.add(lok)
    db_session.commit()
    db_session.add(Inventory(material_id=test_material.id, location_id=lok.id, quantity_on_hand=stok_kg,
                             quantity_reserved=0, quantity_available=stok_kg, stock_status='available'))

    recipe = ProductionRecipe(product_id=test_product.id, machine_id=machine.id, batch_size=60,
                              rate_per_hour=10, is_default=True, is_active=True)
    wo = WorkOrder(wo_number='WO-OUT-1', product_id=test_product.id, quantity=120, uom='PCS',
                   status='planned', machine_id=machine.id)
    db_session.add_all([recipe, wo])
    db_session.commit()

    batches = []
    for i in range(2):
        b = ProductionBatch(batch_number=f'B-OUT-{i+1}', work_order_id=wo.id, machine_id=machine.id,
                            recipe_id=recipe.id, planned_qty=60, scheduled_date=date(2026, 11, 20 + i),
                            shift_number=1, sequence_in_shift=1, status='draft')
        db_session.add(b)
        batches.append(b)
    db_session.commit()
    return batches


def test_batch_kedua_ditandai_kurang(db_session, test_product, test_material):
    """Stok 100 KG, dua batch yang masing-masing butuh 60 KG."""
    from utils.batch_material_outlook import outlook_batch_draft

    b1, b2 = _siapkan(db_session, test_product, test_material, 100)
    hasil = outlook_batch_draft([b1, b2])

    assert hasil[b1.id]['status'] == 'cukup'
    assert hasil[b2.id]['status'] == 'kurang'
    assert hasil[b2.id]['kekurangan'][0]['kurang'] == 20


def test_stok_cukup_untuk_keduanya(db_session, test_product, test_material):
    from utils.batch_material_outlook import outlook_batch_draft

    b1, b2 = _siapkan(db_session, test_product, test_material, 500)
    hasil = outlook_batch_draft([b1, b2])
    assert hasil[b1.id]['status'] == 'cukup' and hasil[b2.id]['status'] == 'cukup'


def test_batch_yang_sudah_disetujui_tidak_ikut_dihitung(db_session, test_product, test_material):
    """Bahannya sudah tertahan lewat MaterialIssue, jadi tidak boleh dihitung dua kali."""
    from utils.batch_material_outlook import outlook_batch_draft

    b1, b2 = _siapkan(db_session, test_product, test_material, 100)
    b1.status = 'approved'
    db_session.commit()

    hasil = outlook_batch_draft([b1, b2])
    assert b1.id not in hasil
    assert hasil[b2.id]['status'] == 'cukup'
