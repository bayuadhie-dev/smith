"""
Scan BOM/formula Accurate dan bandingkan dengan BillOfMaterials SMITH.
Accurate adalah source of truth -- SMITH direkonsiliasi mengikuti Accurate.

Menangani 2 dari 3 transaction type BOM (loop dari sisi Accurate):
- bom_new: produk output match ke SMITH, tapi belum ada BillOfMaterials
  is_active=True untuk produk itu.
- bom_line_changed: BillOfMaterials SMITH ada, tapi baris ingredient-nya
  beda (ditambah/dihapus/qty berubah) dari Accurate.

bom_deleted (kebalikannya, loop dari sisi SMITH) ada di file terpisah
accurate_bom_delete_scan.py.

PERFORMA: fetch detail per-BOM ke Accurate API, ~0.9 detik per BOM x 643
BOM = ~9-10 menit total. Sengaja TIDAK dijadwalkan hourly -- cadence
mingguan/beberapa hari sekali, dijalankan manual/one-off.
"""
import json
from datetime import datetime

from models import db
from models.production import BillOfMaterials, BOMItem
from models.accurate import AccurateSyncLog
from utils.accurate_client import AccurateClient
from utils.accurate_item_matcher import find_smith_match
import requests


def _fetch_bom_list(client):
    """Ambil semua nomor+id BOM dari Accurate (list.do, paginated)."""
    boms = []
    page = 1
    page_size = 100
    while True:
        url = (f"{client.config.api_url}/accurate/api/bill-of-material/list.do"
               f"?fields=id,number&sp.page={page}&sp.pageSize={page_size}")
        try:
            resp = requests.get(url, headers=client.get_headers(), timeout=30)
        except requests.exceptions.RequestException:
            break
        if resp.status_code != 200:
            break
        data = resp.json()
        if not data.get('s') or not data.get('d'):
            break
        boms.extend(data['d'])
        sp = data.get('sp', {})
        if page >= sp.get('pageCount', 1):
            break
        page += 1
    return boms


def _fetch_bom_detail(client, bom_id):
    """Ambil detail 1 BOM (output product + ingredient lines)."""
    url = f"{client.config.api_url}/accurate/api/bill-of-material/detail.do?id={bom_id}"
    try:
        resp = requests.get(url, headers=client.get_headers(), timeout=30)
    except requests.exceptions.RequestException:
        return None
    if resp.status_code != 200:
        return None
    data = resp.json()
    if not data.get('s'):
        return None
    d = data['d']
    output_item = d.get('item') or {}
    lines = []
    for m in d.get('detailMaterial', []):
        item = m.get('item') or {}
        lines.append({
            'name': item.get('name'),
            'quantity': float(m.get('quantityDefault') or 0),
            'unit': (m.get('itemUnit') or {}).get('name', 'Pcs'),
        })
    return {
        'number': d.get('number'),
        'output_name': output_item.get('name'),
        'batch_size': float(d.get('quantity') or 1),
        'lines': lines,
    }


def _diff_bom_lines(smith_bom_id: int, accurate_lines: list):
    """
    Bandingkan baris SMITH (BOMItem existing untuk 1 BillOfMaterials) vs
    baris Accurate (list dict {name, quantity, unit}), matching by name.
    Returns (added, removed, changed) atau None kalau tidak ada beda.
    """
    smith_items = BOMItem.query.filter_by(bom_id=smith_bom_id).all()
    smith_by_name = {}
    for it in smith_items:
        ref_name = it.material.name if it.material else (it.product.name if it.product else None)
        if ref_name:
            smith_by_name[ref_name.strip().upper()] = it

    accurate_by_name = {(l['name'] or '').strip().upper(): l for l in accurate_lines if l['name']}

    added = []
    removed = []
    changed = []

    for name_norm, acc_line in accurate_by_name.items():
        if name_norm not in smith_by_name:
            added.append(acc_line)
        else:
            smith_line = smith_by_name[name_norm]
            smith_qty = float(smith_line.quantity or 0)
            if abs(smith_qty - acc_line['quantity']) > 0.0001:
                changed.append({
                    'name': acc_line['name'],
                    'old_quantity': smith_qty,
                    'new_quantity': acc_line['quantity'],
                    'unit': acc_line['unit'],
                })

    for name_norm, smith_line in smith_by_name.items():
        if name_norm not in accurate_by_name:
            ref_name = smith_line.material.name if smith_line.material else smith_line.product.name
            removed.append({
                'name': ref_name,
                'quantity': float(smith_line.quantity or 0),
                'unit': smith_line.uom,
            })

    if not added and not removed and not changed:
        return None
    return {'added_lines': added, 'removed_lines': removed, 'changed_lines': changed}


def scan_and_queue_bom_changes(created_by=None):
    """
    Loop semua BOM Accurate, match output product ke SMITH, bandingkan
    dengan BillOfMaterials is_active=True SMITH untuk produk itu. Buat
    AccurateSyncLog bom_new atau bom_line_changed sesuai kondisi.

    Returns dict ringkasan.
    """
    client = AccurateClient()
    bom_list = _fetch_bom_list(client)

    summary = {
        'accurate_bom_total': len(bom_list),
        'output_not_matched': 0,
        'bom_new': 0,
        'bom_no_change': 0,
        'bom_line_changed': 0,
        'already_queued': 0,
        'fetch_errors': 0,
    }

    existing_pending = set(
        row[0] for row in
        db.session.query(AccurateSyncLog.accurate_tx_no)
        .filter(AccurateSyncLog.status == 'PENDING_APPROVAL')
        .filter(AccurateSyncLog.transaction_type.in_(['bom_new', 'bom_line_changed']))
        .all()
    )

    for bom_summary in bom_list:
        bom_id = bom_summary.get('id')
        bom_number = bom_summary.get('number')

        if bom_number in existing_pending:
            summary['already_queued'] += 1
            continue

        detail = _fetch_bom_detail(client, bom_id)
        if not detail:
            summary['fetch_errors'] += 1
            continue

        output_match = find_smith_match(detail['output_name'])
        if output_match is None:
            summary['output_not_matched'] += 1
            continue

        smith_product_id = output_match['id'] if output_match['table'] == 'products' else None
        if smith_product_id is None:
            # BOM output harus produk (finished good), bukan material
            summary['output_not_matched'] += 1
            continue

        existing_bom = BillOfMaterials.query.filter_by(
            product_id=smith_product_id, is_active=True
        ).first()

        if existing_bom is None:
            # bom_new
            mapped_lines = []
            for line in detail['lines']:
                match = find_smith_match(line['name'])
                mapped_lines.append({
                    'item_name': line['name'],
                    'quantity': line['quantity'],
                    'unit': line['unit'],
                    'is_mapped': match is not None,
                    'matched_smith_id': match['id'] if match else None,
                    'matched_smith_table': match['table'] if match else None,
                })
            log = AccurateSyncLog(
                transaction_type='bom_new',
                accurate_tx_no=bom_number,
                accurate_tx_date=None,
                status='PENDING_APPROVAL',
                is_dry_run=False,
                accurate_item_id=str(bom_id),
                accurate_item_name=detail['output_name'],
                proposed_target_table='products',
                matched_smith_id=smith_product_id,
                matched_smith_table='products',
                proposed_changes=json.dumps({
                    'batch_size': detail['batch_size'],
                    'batch_uom': detail['lines'][0]['unit'] if detail['lines'] else 'Pcs',
                    'lines': mapped_lines,
                }),
                created_by=created_by,
                created_at=datetime.utcnow(),
            )
            db.session.add(log)
            summary['bom_new'] += 1
        else:
            diff = _diff_bom_lines(existing_bom.id, detail['lines'])
            if diff is None:
                summary['bom_no_change'] += 1
                continue
            log = AccurateSyncLog(
                transaction_type='bom_line_changed',
                accurate_tx_no=bom_number,
                accurate_tx_date=None,
                status='PENDING_APPROVAL',
                is_dry_run=False,
                accurate_item_id=str(bom_id),
                accurate_item_name=detail['output_name'],
                proposed_target_table='products',
                matched_smith_id=existing_bom.id,  # BillOfMaterials.id, bukan product_id
                matched_smith_table='bill_of_materials',
                proposed_changes=json.dumps(diff),
                created_by=created_by,
                created_at=datetime.utcnow(),
            )
            db.session.add(log)
            summary['bom_line_changed'] += 1

    db.session.commit()
    return summary
