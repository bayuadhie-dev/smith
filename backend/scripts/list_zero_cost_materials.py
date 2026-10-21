"""
Fase 9 (fix_report_2.md, lanjutan audit, 2026-10-01) — Daftar Material/Item
BOM Aktif dengan unit_cost 0 atau NULL
=========================================================================
READ-ONLY. Tidak mengisi/mengubah data apapun. JANGAN dijalankan terhadap
produksi tanpa izin eksplisit pemilik - jalankan dulu terhadap database
tes lokal untuk verifikasi. Ini murni laporan untuk pemilik mengisi data
Master Data secara manual - bukan bug kode.

Latar belakang: Fase 5 fix_report.md (job costing) menemukan bahwa
estimasi biaya material WO akan ditandai "tidak lengkap"
(JobCostEntry.is_cost_incomplete=True) kalau ada baris WorkOrderBOMItem
dengan unit_cost 0/kosong. Skrip ini membantu pemilik menemukan SUMBER
masalah data itu - material/item BOM mana yang belum diisi biayanya -
sebelum job costing dipakai secara serius.

Dua sumber dicek (sesuai keputusan Fase 5 fix_report.md: WorkOrderBOMItem
adalah sumber BOM yang otoritatif untuk produksi riil, tapi BOM master
BillOfMaterials/BOMItem dicek juga karena WorkOrderBOMItem biasanya
disalin dari situ - materialnya kalau kosong di source, kemungkinan besar
kosong juga di turunannya):

1. WorkOrderBOMItem pada Work Order yang masih AKTIF (status bukan
   'completed'/'cancelled') dengan unit_cost 0 atau NULL.
2. BOMItem pada BillOfMaterials yang is_active=True dengan unit_cost 0
   atau NULL.

Keluaran: CSV ke stdout (redirect ke file sendiri kalau mau: `python
scripts/list_zero_cost_materials.py > laporan.csv`), plus ringkasan ke
stderr supaya tidak tercampur ke CSV kalau di-redirect.

Cara pakai (di database TES lokal dulu, bukan produksi):
    cd backend && python scripts/list_zero_cost_materials.py
"""
import csv
import sys

sys.path.insert(0, '.')

from app import create_app
from models import db


def _item_label(product_id, material_id):
    from models.product import Product, Material
    if product_id:
        p = db.session.get(Product, product_id)
        return ('Produk', p.code if p else f'#{product_id}', p.name if p else '(dihapus)')
    if material_id:
        m = db.session.get(Material, material_id)
        return ('Bahan', m.code if m else f'#{material_id}', m.name if m else '(dihapus)')
    return ('?', '?', '(tidak diketahui)')


def check_work_order_bom_items(writer):
    from models.work_order_bom import WorkOrderBOMItem
    from models.production import WorkOrder

    rows = WorkOrderBOMItem.query.join(
        WorkOrder, WorkOrderBOMItem.work_order_id == WorkOrder.id
    ).filter(
        WorkOrder.status.notin_(['completed', 'cancelled']),
        db.or_(WorkOrderBOMItem.unit_cost.is_(None), WorkOrderBOMItem.unit_cost == 0),
    ).all()

    count = 0
    for item in rows:
        wo = db.session.get(WorkOrder, item.work_order_id)
        item_type, code, name = _item_label(item.product_id, item.material_id)
        writer.writerow([
            'WorkOrderBOMItem (aktif)', wo.wo_number if wo else f'WO#{item.work_order_id}',
            item_type, code, name, item.quantity_per_unit, item.uom,
            float(item.unit_cost) if item.unit_cost is not None else '',
        ])
        count += 1
    return count


def check_bom_master_items(writer):
    from models.production import BillOfMaterials, BOMItem

    rows = BOMItem.query.join(
        BillOfMaterials, BOMItem.bom_id == BillOfMaterials.id
    ).filter(
        BillOfMaterials.is_active == True,
        db.or_(BOMItem.unit_cost.is_(None), BOMItem.unit_cost == 0),
    ).all()

    count = 0
    for item in rows:
        bom = db.session.get(BillOfMaterials, item.bom_id)
        item_type, code, name = _item_label(item.product_id, item.material_id)
        writer.writerow([
            'BOMItem (master aktif)', bom.bom_number if bom else f'BOM#{item.bom_id}',
            item_type, code, name, item.quantity, item.uom,
            float(item.unit_cost) if item.unit_cost is not None else '',
        ])
        count += 1
    return count


def run():
    app = create_app()
    with app.app_context():
        writer = csv.writer(sys.stdout)
        writer.writerow([
            'sumber', 'referensi (WO/BOM)', 'jenis_item', 'kode_item', 'nama_item',
            'quantity_per_unit', 'uom', 'unit_cost',
        ])
        n1 = check_work_order_bom_items(writer)
        n2 = check_bom_master_items(writer)
        print(f'\nSelesai. {n1} baris WorkOrderBOMItem aktif + {n2} baris BOMItem '
              f'master aktif dengan unit_cost 0/kosong. Ini laporan read-only - '
              f'tidak ada data yang diubah. Isi unit_cost yang kosong lewat '
              f'Master Data Barang/Bahan.', file=sys.stderr)


if __name__ == '__main__':
    run()
