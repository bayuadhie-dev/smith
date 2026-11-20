"""Perkiraan kecukupan bahan untuk batch yang masih draft.

Masalahnya nyata: batch draft belum menahan bahan apa pun - penahanan baru
terjadi saat batch disetujui (routes/batch_scheduling.py::approve_batches
memanggil _create_auto_reserve_issue). Akibatnya dua batch draft yang
memperebutkan bahan yang sama SAMA-SAMA terlihat cukup, dan kekurangannya baru
ketahuan saat yang kedua disetujui.

Modul ini tidak menahan stok (tidak ada baris baru yang ditulis). Yang
dilakukannya: menelusuri batch draft urut jadwal, menurunkan kebutuhan BOM
masing-masing dari stok tersedia, lalu melaporkan batch mana yang sudah tidak
kebagian. Jadi angka yang dilihat perencana sudah memperhitungkan rencana lain
yang antre di depannya.

Batch yang SUDAH disetujui sengaja tidak ikut dihitung: bahannya sudah tertahan
lewat MaterialIssue, dan penahanan itu sudah tercermin di
Inventory.quantity_available.
"""
from models import db
from models.warehouse import Inventory
from sqlalchemy import func


def _stok_tersedia(material_id):
    total = db.session.query(func.sum(Inventory.quantity_available)).filter(
        Inventory.material_id == material_id,
        Inventory.is_active == True  # noqa: E712
    ).scalar()
    return float(total or 0)


def outlook_batch_draft(batches):
    """batches: ProductionBatch (campuran status boleh, yang dihitung hanya draft).

    Mengembalikan {batch_id: {'status': 'cukup'|'kurang'|'tanpa_bom',
                              'kekurangan': [{'material_id', 'nama', 'kurang', 'uom'}]}}
    """
    from utils.auto_reserve import _get_bom_requirements

    draft = [b for b in batches if b.status == 'draft']
    from datetime import date
    draft.sort(key=lambda b: (b.scheduled_date or date.max, b.shift_number or 0,
                              b.sequence_in_shift or 0, b.id))

    sisa = {}
    hasil = {}
    for b in draft:
        product_id = b.recipe.product_id if b.recipe else None
        reqs = _get_bom_requirements(product_id, float(b.planned_qty or 0)) if product_id else []
        if not reqs:
            hasil[b.id] = {'status': 'tanpa_bom', 'kekurangan': []}
            continue
        kurang = []
        for material_id, qty, uom, nama in reqs:
            if material_id not in sisa:
                sisa[material_id] = _stok_tersedia(material_id)
            sisa[material_id] -= float(qty or 0)
            if sisa[material_id] < -1e-6:
                kurang.append({
                    'material_id': material_id,
                    'nama': nama,
                    'uom': uom,
                    'kurang': round(-sisa[material_id], 3),
                })
        hasil[b.id] = {'status': 'kurang' if kurang else 'cukup', 'kekurangan': kurang}
    return hasil
