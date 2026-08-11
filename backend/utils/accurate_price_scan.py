"""
Scan item Accurate yang SUDAH match dengan SMITH, bandingkan harga, dan
tulis kandidat perubahan harga ke AccurateSyncLog sebagai antrean approval
(transaction_type='item_price_change').

STATUS: dibangun tapi OFF BY DEFAULT -- tidak ada endpoint publik/cron yang
memanggil ini. Harga/cost di SMITH sengaja tidak diisi (kebijakan internal
perusahaan, bukan data kosong yang perlu di-backfill), jadi price sync
perlu diaktifkan manual dan sengaja saat memang dibutuhkan, bukan otomatis.

Threshold: selisih > Rp1 (bukan != 0) untuk meredam floating-point noise
pada nilai uang.
"""
import json
from datetime import datetime

from models import db
from models.product import Material, Product
from models.accurate import AccurateSyncLog
from utils.accurate_client import AccurateClient
from utils.accurate_item_classifier import classify_accurate_item
from utils.accurate_item_matcher import find_smith_match

PRICE_DIFF_THRESHOLD = 1.0


def _get_smith_price(table: str, smith_id: int):
    """Ambil harga SMITH: materials pakai cost_per_unit, products pakai price."""
    if table == 'materials':
        row = Material.query.get(smith_id)
        return float(row.cost_per_unit or 0) if row else None
    elif table == 'products':
        row = Product.query.get(smith_id)
        return float(row.price or 0) if row else None
    return None


def scan_and_queue_price_changes(created_by=None):
    """
    Untuk setiap item Accurate yang match ke SMITH (exact-name), bandingkan
    unit_price Accurate vs harga SMITH (cost_per_unit untuk materials,
    price untuk products). Kalau selisih > PRICE_DIFF_THRESHOLD, buat
    AccurateSyncLog (transaction_type='item_price_change') jika belum ada
    entry PENDING_APPROVAL untuk accurate_item_id yang sama.

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
        .filter(AccurateSyncLog.transaction_type == 'item_price_change')
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

        smith_price = _get_smith_price(match['table'], match['id'])
        accurate_price = float(item['unit_price'] or 0)

        if smith_price is None or abs(accurate_price - smith_price) <= PRICE_DIFF_THRESHOLD:
            summary['no_change'] += 1
            continue

        if accurate_id_str in existing_pending_ids:
            summary['already_queued'] += 1
            continue

        log = AccurateSyncLog(
            transaction_type='item_price_change',
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
                'smith_price': smith_price,
                'accurate_price': accurate_price,
                'diff': accurate_price - smith_price,
            }),
            created_by=created_by,
            created_at=datetime.utcnow(),
        )
        db.session.add(log)
        summary['newly_queued'] += 1

    db.session.commit()
    return summary
