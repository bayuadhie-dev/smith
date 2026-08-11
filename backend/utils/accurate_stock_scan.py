"""
Scan item Accurate yang SUDAH match dengan SMITH, bandingkan stok, dan
tulis kandidat perubahan stok ke AccurateSyncLog sebagai antrean approval
(transaction_type='item_stock_change').

Threshold: selisih != 0 (berapa pun bedanya, langsung dianggap perlu
direview) -- keputusan eksplisit, bukan threshold persentase/minimal.
"""
import json
from datetime import datetime

from models import db
from models.accurate import AccurateSyncLog
from models.warehouse import Inventory
from utils.accurate_client import AccurateClient
from utils.accurate_item_classifier import classify_accurate_item
from utils.accurate_item_matcher import find_smith_match


def _get_smith_stock(table: str, smith_id: int) -> float:
    """SUM semua baris Inventory untuk 1 material/product (bisa multi-lokasi)."""
    if table == 'materials':
        total = (
            db.session.query(db.func.coalesce(db.func.sum(Inventory.quantity_on_hand), 0))
            .filter(Inventory.material_id == smith_id)
            .scalar()
        )
    elif table == 'products':
        total = (
            db.session.query(db.func.coalesce(db.func.sum(Inventory.quantity_on_hand), 0))
            .filter(Inventory.product_id == smith_id)
            .scalar()
        )
    else:
        return 0.0
    return float(total or 0)


def scan_and_queue_stock_changes(created_by=None):
    """
    Untuk setiap item Accurate yang match ke SMITH (exact-name), bandingkan
    stok Accurate vs SUM(Inventory.quantity_on_hand) SMITH. Kalau beda,
    buat AccurateSyncLog (transaction_type='item_stock_change') jika belum
    ada entry PENDING_APPROVAL untuk accurate_item_id yang sama.

    Returns:
        dict ringkasan: {total, skipped, not_matched, no_change,
        already_queued, newly_queued}
    """
    client = AccurateClient()
    accurate_items = client.fetch_items_with_category_from_accurate()

    summary = {
        'total': len(accurate_items),
        'skipped': 0,
        'not_matched': 0,
        'no_change': 0,
        'already_queued': 0,
        'newly_queued': 0,
    }

    existing_pending_ids = set(
        row[0] for row in
        db.session.query(AccurateSyncLog.accurate_item_id)
        .filter(AccurateSyncLog.status == 'PENDING_APPROVAL')
        .filter(AccurateSyncLog.transaction_type == 'item_stock_change')
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
        if match is None:
            summary['not_matched'] += 1
            continue

        smith_stock = _get_smith_stock(match['table'], match['id'])
        accurate_stock = float(item['stock'] or 0)

        if accurate_stock == smith_stock:
            summary['no_change'] += 1
            continue

        if accurate_id_str in existing_pending_ids:
            summary['already_queued'] += 1
            continue

        log = AccurateSyncLog(
            transaction_type='item_stock_change',
            accurate_tx_no=item['item_no'],
            accurate_tx_date=None,
            status='PENDING_APPROVAL',
            is_dry_run=False,
            accurate_item_id=accurate_id_str,
            accurate_item_name=item['name'],
            proposed_target_table=match['table'],
            proposed_material_type=classification['material_type'],
            proposed_category=classification['category'],
            matched_smith_id=match['id'],
            matched_smith_table=match['table'],
            proposed_changes=json.dumps({
                'smith_stock': smith_stock,
                'accurate_stock': accurate_stock,
                'diff': accurate_stock - smith_stock,
            }),
            created_by=created_by,
            created_at=datetime.utcnow(),
        )
        db.session.add(log)
        summary['newly_queued'] += 1

    db.session.commit()
    return summary
