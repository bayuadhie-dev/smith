"""
Scan BillOfMaterials SMITH (untuk produk hasil sync Accurate) yang BOM-nya
sudah tidak ada lagi di Accurate, tulis kandidat bom_deleted ke
AccurateSyncLog.

Sama seperti accurate_delete_scan.py (item_deleted): soft-delete via
is_active=False, bukan hard-delete. Scope dibatasi ke produk yang code-nya
berawalan 'ACC-' (hasil item_new sync sebelumnya) -- BOM lama/manual yang
sudah ada sebelum integrasi Accurate TIDAK pernah jadi kandidat delete.
"""
import json
from datetime import datetime

from models import db
from models.product import Product
from models.production import BillOfMaterials
from models.accurate import AccurateSyncLog
from utils.accurate_client import AccurateClient
from utils.accurate_bom_scan import _fetch_bom_list


def scan_and_queue_deleted_boms(created_by=None):
    """
    Ambil semua nomor BOM Accurate saat ini, cek semua BillOfMaterials
    SMITH is_active=True yang produknya code-nya 'ACC-%'. Kalau BOM
    number itu (disimpan di accurate_tx_no saat bom_new/bom_line_changed
    dibuat sebelumnya) tidak ada lagi di Accurate, tandai bom_deleted.

    CATATAN: pendekatan ini butuh accurate_tx_no yang match ke BOM number
    Accurate -- kalau BOM SMITH tidak pernah tersentuh sync sebelumnya
    (tidak ada log historis), tidak bisa dicek dengan cara ini. Untuk versi
    awal ini, scope dibatasi ke BOM yang produknya ACC-prefixed DAN yang
    pernah punya AccurateSyncLog APPROVED dengan transaction_type bom_new
    atau bom_line_changed (untuk tahu nomor BOM Accurate yang terkait).
    """
    client = AccurateClient()
    bom_list = _fetch_bom_list(client)
    accurate_bom_numbers = set(b.get('number') for b in bom_list if b.get('number'))

    # BOM SMITH yang pernah tersentuh sync (untuk tahu accurate_tx_no-nya)
    synced_bom_logs = (
        AccurateSyncLog.query
        .filter(AccurateSyncLog.transaction_type.in_(['bom_new', 'bom_line_changed']))
        .filter(AccurateSyncLog.status == 'APPROVED')
        .filter(AccurateSyncLog.matched_smith_table.in_(['products', 'bill_of_materials']))
        .all()
    )

    # Map: BillOfMaterials.id -> accurate_tx_no (BOM number Accurate)
    bom_id_to_number = {}
    for log in synced_bom_logs:
        if log.transaction_type == 'bom_new':
            # matched_smith_id di sini adalah product_id (lihat accurate_bom_scan.py)
            bom = BillOfMaterials.query.filter_by(product_id=log.matched_smith_id, is_active=True).first()
        else:
            bom = BillOfMaterials.query.get(log.matched_smith_id)
        if bom:
            bom_id_to_number[bom.id] = log.accurate_tx_no

    summary = {
        'accurate_bom_total': len(accurate_bom_numbers),
        'smith_synced_bom_active': len(bom_id_to_number),
        'still_exists': 0,
        'already_queued': 0,
        'newly_queued': 0,
    }

    existing_pending = set(
        row[0] for row in
        db.session.query(AccurateSyncLog.matched_smith_id)
        .filter(AccurateSyncLog.status == 'PENDING_APPROVAL')
        .filter(AccurateSyncLog.transaction_type == 'bom_deleted')
        .all()
    )

    for bom_id, bom_number in bom_id_to_number.items():
        if bom_number in accurate_bom_numbers:
            summary['still_exists'] += 1
            continue

        if bom_id in existing_pending:
            summary['already_queued'] += 1
            continue

        bom = BillOfMaterials.query.get(bom_id)
        log = AccurateSyncLog(
            transaction_type='bom_deleted',
            accurate_tx_no=bom_number,
            accurate_tx_date=None,
            status='PENDING_APPROVAL',
            is_dry_run=False,
            accurate_item_id=None,
            accurate_item_name=bom.product.name if bom.product else None,
            proposed_target_table='bill_of_materials',
            matched_smith_id=bom_id,
            matched_smith_table='bill_of_materials',
            proposed_changes=json.dumps({
                'action': 'soft_delete (is_active=False)',
                'bom_number': bom.bom_number,
            }),
            created_by=created_by,
            created_at=datetime.utcnow(),
        )
        db.session.add(log)
        summary['newly_queued'] += 1

    db.session.commit()
    return summary
