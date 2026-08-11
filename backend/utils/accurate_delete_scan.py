"""
Scan item SMITH (materials + products) yang sebelumnya pernah match dari
Accurate tapi sekarang sudah tidak ada lagi di daftar item Accurate, dan
tulis kandidat "item deleted" ke AccurateSyncLog sebagai antrean approval
(transaction_type='item_deleted').

Approve = soft-delete (is_active=False), BUKAN hard-delete -- materials/
products punya 98 tabel dependent (BOM, work orders, purchase orders, dst),
hard-delete terlalu berisiko untuk otomatisasi.

Scope: hanya item yang code-nya diawali 'ACC-' (dibuat oleh item_new sync
sebelumnya) yang dipertimbangkan untuk delete -- item lama/manual yang
sudah ada sebelum integrasi Accurate TIDAK ikut discan, supaya sync ini
tidak pernah menyentuh data yang bukan hasil sync-nya sendiri.
"""
import json
from datetime import datetime

from models import db
from models.product import Material, Product
from models.accurate import AccurateSyncLog
from utils.accurate_client import AccurateClient


def scan_and_queue_deleted_items(created_by=None):
    """
    Ambil semua nama item Accurate saat ini (exact uppercase+trim), lalu
    cek semua Material/Product SMITH yang code-nya berawalan 'ACC-' (hasil
    sync sebelumnya) dan masih is_active=True. Kalau nama item itu TIDAK
    ada lagi di daftar Accurate saat ini, buat AccurateSyncLog
    (transaction_type='item_deleted').

    Returns:
        dict ringkasan: {accurate_total, smith_synced_active, still_exists,
        already_queued, newly_queued}
    """
    client = AccurateClient()
    accurate_items = client.fetch_items_with_category_from_accurate()
    accurate_names = set((it['name'] or '').strip().upper() for it in accurate_items)

    smith_synced = (
        Material.query.filter(Material.code.like('ACC-%'), Material.is_active == True).all()
        + Product.query.filter(Product.code.like('ACC-%'), Product.is_active == True).all()
    )

    summary = {
        'accurate_total': len(accurate_items),
        'smith_synced_active': len(smith_synced),
        'still_exists': 0,
        'already_queued': 0,
        'newly_queued': 0,
    }

    existing_pending_smith_ids = set(
        (row[0], row[1]) for row in
        db.session.query(AccurateSyncLog.matched_smith_table, AccurateSyncLog.matched_smith_id)
        .filter(AccurateSyncLog.status == 'PENDING_APPROVAL')
        .filter(AccurateSyncLog.transaction_type == 'item_deleted')
        .all()
    )

    for row in smith_synced:
        table = 'materials' if isinstance(row, Material) else 'products'
        name_norm = (row.name or '').strip().upper()

        if name_norm in accurate_names:
            summary['still_exists'] += 1
            continue

        if (table, row.id) in existing_pending_smith_ids:
            summary['already_queued'] += 1
            continue

        accurate_item_id = row.code.replace('ACC-', '', 1) if row.code else None

        log = AccurateSyncLog(
            transaction_type='item_deleted',
            accurate_tx_no=None,
            accurate_tx_date=None,
            status='PENDING_APPROVAL',
            is_dry_run=False,
            accurate_item_id=accurate_item_id,
            accurate_item_name=row.name,
            proposed_target_table=table,
            proposed_material_type=None,
            proposed_category=None,
            matched_smith_id=row.id,
            matched_smith_table=table,
            proposed_changes=json.dumps({
                'action': 'soft_delete (is_active=False)',
                'smith_code': row.code,
            }),
            created_by=created_by,
            created_at=datetime.utcnow(),
        )
        db.session.add(log)
        summary['newly_queued'] += 1

    db.session.commit()
    return summary
