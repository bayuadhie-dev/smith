"""
Scan item Accurate, klasifikasi + matching, tulis kandidat baru ke
AccurateSyncLog sebagai antrean approval (transaction_type='item_new').

Hanya menangani item BARU (belum ada match di SMITH) untuk saat ini --
item_deleted/item_stock_change/item_price_change scope terpisah, belum
diimplementasi di sini.
"""
import json
from datetime import datetime

from models import db
from models.accurate import AccurateSyncLog
from utils.accurate_client import AccurateClient
from utils.accurate_item_classifier import classify_accurate_item
from utils.accurate_item_matcher import find_smith_match


def scan_and_queue_new_items(created_by=None):
    """
    Ambil semua item dari Accurate, klasifikasikan, cek exact-name match
    ke SMITH. Untuk item yang TIDAK match (kandidat item baru) dan belum
    di-skip oleh classifier, buat AccurateSyncLog baru (jika belum ada
    entry PENDING_APPROVAL untuk accurate_item_id yang sama).

    Returns:
        dict ringkasan: {total, skipped, already_matched, already_queued,
        newly_queued}
    """
    client = AccurateClient()
    accurate_items = client.fetch_items_with_category_from_accurate()

    summary = {
        'total': len(accurate_items),
        'skipped': 0,
        'already_matched': 0,
        'already_queued': 0,
        'newly_queued': 0,
    }

    # Ambil semua accurate_item_id yang sedang PENDING_APPROVAL sekali di
    # awal (bukan query per-item di dalam loop) supaya tidak N+1.
    existing_pending_ids = set(
        row[0] for row in
        db.session.query(AccurateSyncLog.accurate_item_id)
        .filter(AccurateSyncLog.status == 'PENDING_APPROVAL')
        .filter(AccurateSyncLog.accurate_item_id.isnot(None))
        .all()
    )

    for item in accurate_items:
        accurate_id_str = str(item['accurate_id'])
        classification = classify_accurate_item(item['name'], item['accurate_category'])

        if classification['skip']:
            summary['skipped'] += 1
            continue

        match = find_smith_match(item['name'])
        if match is not None:
            summary['already_matched'] += 1
            continue

        if accurate_id_str in existing_pending_ids:
            summary['already_queued'] += 1
            continue

        log = AccurateSyncLog(
            transaction_type='item_new',
            accurate_tx_no=item['item_no'],
            accurate_tx_date=None,
            status='PENDING_APPROVAL',
            is_dry_run=False,
            accurate_item_id=accurate_id_str,
            accurate_item_name=item['name'],
            proposed_target_table=classification['target_table'],
            proposed_material_type=classification['material_type'],
            proposed_category=classification['category'],
            matched_smith_id=None,
            matched_smith_table=None,
            proposed_changes=json.dumps({
                'unit': item['unit'],
                'unit_price': item['unit_price'],
                'stock': item['stock'],
                'accurate_category_raw': item['accurate_category'],
            }),
            created_by=created_by,
            created_at=datetime.utcnow(),
        )
        db.session.add(log)
        summary['newly_queued'] += 1

    db.session.commit()
    return summary
