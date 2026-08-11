"""
Accurate EJO (Work Order) cross-check utility.

Given an Accurate Work Order number (format: EJO/YY/MM/NNN-X S-N), fetches
the full production record from Accurate: summary, recursively-expanded
multi-level BOM material breakdown (Barang Jadi -> WIP -> Mixing), and
process history (EPD -> FG warehouse stages). Then attempts to match it to
a SMITH WorkOrder by output product + nearby completion date, and produces
a diff covering everything except downtime (which Accurate doesn't track).
"""
import requests
from datetime import datetime, timedelta

BASE_URL = 'https://iris.accurate.id/accurate/api'

# how many days apart an Accurate finalDate and a SMITH WorkOrder's
# actual_end_date can be and still be considered a plausible match
MATCH_DATE_WINDOW_DAYS = 2

# Mapping histori tahap produksi Accurate ke istilah gudang perusahaan
# (dikonfirmasi Pak Giwa): MS = barang masuk Gudang EPD (hasil produksi
# sebelum packing list), FGS = barang masuk Gudang FG (setelah packing list)
_WAREHOUSE_STAGE_LABELS = {
    'MS': 'Masuk Gudang EPD (hasil produksi, belum packing list)',
    'FGS': 'Masuk Gudang FG (setelah packing list)',
}


def _get(client, path, params=None):
    """GET helper reusing AccurateClient's headers, with basic error handling."""
    url = f'{BASE_URL}/{path}'
    try:
        resp = requests.get(url, headers=client.get_headers(), params=params, timeout=20)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        return {'s': False, 'error': str(e)}


def find_work_order_by_number(client, ejo_number, max_pages=10, page_size=20):
    """
    Search recent Accurate work orders for an exact `number` match.
    Accurate's list filter params (filter.number.val, filter.keywords.val,
    etc.) were confirmed unreliable via live testing - either silently
    ignored or returning zero results regardless of input. So instead we
    page through the default (newest-first) list and match client-side.
    Covers the most recent `max_pages * page_size` work orders (default 200)
    - sufficient for the intended use case (cross-checking recent production),
    not a full historical search.
    Returns the matching WO id, or None if not found within max_pages.
    """
    for page in range(1, max_pages + 1):
        data = _get(client, 'work-order/list.do', {
            'sp.page': page,
            'sp.pageSize': page_size,
        })
        if not data.get('s'):
            break
        rows = data.get('d', [])
        if not rows:
            break
        for row in rows:
            wid = row['id']
            detail = _get(client, 'work-order/detail.do', {'id': wid})
            if detail.get('s') and detail.get('d', {}).get('number') == ejo_number:
                return wid
    return None


def get_work_order_detail(client, wo_id):
    data = _get(client, 'work-order/detail.do', {'id': wo_id})
    if not data.get('s'):
        return None
    return data['d']


def get_bom_detail(client, bom_id):
    data = _get(client, 'bill-of-material/detail.do', {'id': bom_id})
    if not data.get('s'):
        return None
    return data['d']


def _build_bom_item_index(client, bom_id_cache):
    """
    Loads the item_id -> bom_id index from the AccurateBomItemIndex cache
    table into bom_id_cache (populated by scan_and_cache_bom_item_index()).
    Accurate's bill-of-material/list.do filter params were confirmed
    unreliable via live testing (always returns the full unfiltered 643-row
    set), so a live scan on every request was previously the only option -
    that took ~1.5-2min per ejo-check call. The cache table makes this a
    fast local DB read instead. If the cache is empty (never scanned yet),
    falls back to a live scan so the feature still works, but callers should
    prefer running POST /accurate/bom-item-index-scan periodically instead
    of relying on this fallback path.
    bom_id_cache is a dict passed in by the caller and reused across the
    whole expand_material_tree() call tree, so this only runs once per
    top-level ejo-check request.
    """
    if bom_id_cache.get('_scanned'):
        return

    from models.accurate import AccurateBomItemIndex
    cached_rows = AccurateBomItemIndex.query.all()
    if cached_rows:
        for row in cached_rows:
            bom_id_cache[row.accurate_item_id] = row.accurate_bom_id
        bom_id_cache['_scanned'] = True
        return

    # Fallback: cache table empty, do a live scan (slow, ~1.5-2min)
    page = 1
    while True:
        data = _get(client, 'bill-of-material/list.do', {'sp.page': page, 'sp.pageSize': 50})
        if not data.get('s'):
            break
        rows = data.get('d', [])
        if not rows:
            break
        for row in rows:
            bom_id = row['id']
            detail = get_bom_detail(client, bom_id)
            if not detail:
                continue
            bom_item = detail.get('item', {})
            if bom_item.get('id') is not None:
                bom_id_cache[bom_item['id']] = bom_id
        page += 1

    bom_id_cache['_scanned'] = True


def scan_and_cache_bom_item_index(client):
    """
    Full scan of all Accurate BOMs, rebuilding the AccurateBomItemIndex
    cache table from scratch. Meant to be run manually/periodically (e.g.
    whenever BOM structures change in Accurate), not on every ejo-check
    call. Takes ~1.5-2min for ~643 BOMs. Returns the count of indexed items.
    """
    from models import db
    from models.accurate import AccurateBomItemIndex

    entries = {}  # item_id -> (bom_id, bom_number, item_name)
    page = 1
    while True:
        data = _get(client, 'bill-of-material/list.do', {'sp.page': page, 'sp.pageSize': 50})
        if not data.get('s'):
            break
        rows = data.get('d', [])
        if not rows:
            break
        for row in rows:
            bom_id = row['id']
            detail = get_bom_detail(client, bom_id)
            if not detail:
                continue
            bom_item = detail.get('item', {})
            item_id = bom_item.get('id')
            if item_id is not None:
                entries[item_id] = (bom_id, detail.get('number'), bom_item.get('name'))
        page += 1

    # Rebuild table: clear and reinsert (simplest correct approach, table is
    # small - ~1 row per BOM's output item, well under 1000 rows expected)
    AccurateBomItemIndex.query.delete()
    for item_id, (bom_id, bom_number, item_name) in entries.items():
        db.session.add(AccurateBomItemIndex(
            accurate_item_id=item_id,
            accurate_item_name=item_name,
            accurate_bom_id=bom_id,
            accurate_bom_number=bom_number,
        ))
    db.session.commit()

    return len(entries)


def expand_material_tree(client, detail_material_rows, bom_id_cache, depth=0, max_depth=5):
    """
    Recursively expand a list of Accurate detailMaterial rows.
    For any row whose item is itself produced (itemProduced=True, e.g. a WIP
    or Mixing material), look up that item's own BOM (via the index built by
    _build_bom_item_index) and expand its detailMaterial too - building the
    full Barang Jadi -> WIP -> Mixing tree. Raw materials (itemProduced=False,
    e.g. purchased packaging/chemicals) are leaves.
    max_depth guards against unexpected circular BOM references in the data.
    """
    if depth >= max_depth:
        return []

    _build_bom_item_index(client, bom_id_cache)

    tree = []
    for row in detail_material_rows:
        item = row.get('item', {})
        node = {
            'name': item.get('name'),
            'item_id': item.get('id'),
            'quantity': row.get('quantityDefault'),
            'uom': row.get('itemUnit', {}).get('name'),
            'is_produced': bool(item.get('itemProduced')),
            'children': [],
        }
        if node['is_produced']:
            sub_bom_id = bom_id_cache.get(item.get('id'))
            if sub_bom_id:
                sub_bom = get_bom_detail(client, sub_bom_id)
                if sub_bom:
                    node['sub_bom_number'] = sub_bom.get('number')
                    node['children'] = expand_material_tree(
                        client, sub_bom.get('detailMaterial', []),
                        bom_id_cache, depth=depth + 1, max_depth=max_depth
                    )
            else:
                node['warning'] = 'itemProduced=True tapi BOM turunannya tidak ditemukan di Accurate'
        tree.append(node)
    return tree


def _parse_accurate_date(date_str):
    """Accurate dates come as 'DD/MM/YYYY'."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%d/%m/%Y').date()
    except ValueError:
        return None


def _find_similar_smith_products(item_name, limit=5, min_similarity=0.5):
    """
    When exact-name matching fails, suggest similar SMITH products by name
    similarity (difflib.SequenceMatcher - stdlib, no new dependency). This
    is purely advisory: the user picks manually from the UI, never auto-
    applied - per the prior decision that silent wrong-guesses are worse
    than a visible manual gap. Searches products only (WorkOrder.product_id
    only references products, so materials aren't useful suggestions here).
    Returns a list of {id, name, similarity} sorted by similarity desc.
    """
    from difflib import SequenceMatcher
    from models.product import Product

    name_norm = (item_name or '').strip().upper()
    if not name_norm:
        return []

    all_products = Product.query.with_entities(Product.id, Product.name).all()
    scored = []
    for pid, pname in all_products:
        if not pname:
            continue
        sim = SequenceMatcher(None, name_norm, pname.strip().upper()).ratio()
        if sim >= min_similarity:
            scored.append({'id': pid, 'name': pname, 'similarity': round(sim, 3)})

    scored.sort(key=lambda x: x['similarity'], reverse=True)
    return scored[:limit]


def find_matching_smith_work_order(wo_detail):
    """
    Match an Accurate work order to a SMITH WorkOrder by:
      1. output product exact-name match (reusing find_smith_match, same
         approach as BOM sync - no fuzzy matching, per prior decision that
         silent wrong-guesses are worse than a visible manual gap)
      2. SMITH WorkOrder.actual_end_date within MATCH_DATE_WINDOW_DAYS of
         Accurate's finalDate
    There is no shared identifier between the two systems (SMITH wo_number
    is auto-generated from date, unrelated to the EJO number), so this is
    necessarily a heuristic, best-effort match - confirmed acceptable by
    the user given the lack of any better key.

    Returns a tuple (matched_work_order_or_None, similar_product_suggestions).
    similar_product_suggestions is only populated when exact matching fails
    (either no product match, or a product match but no WorkOrder in the
    date window) - advisory list for the user to pick from manually in the UI.
    """
    from models.production import WorkOrder
    from utils.accurate_item_matcher import find_smith_match

    item = wo_detail.get('item', {})
    item_name = item.get('name')
    if not item_name:
        return None, []

    match = find_smith_match(item_name)
    if not match or match.get('table') != 'products':
        # No match, or matched to `materials` (e.g. a WIP/Mixing output) -
        # SMITH WorkOrder.product_id only references products, so a WIP-level
        # Accurate work order has no corresponding SMITH WorkOrder to match
        # against. This is a real structural gap, not a bug: SMITH currently
        # only tracks finished-goods-level work orders.
        return None, _find_similar_smith_products(item_name)
    product_id = match['id']

    final_date = _parse_accurate_date(wo_detail.get('finalDate'))
    if not final_date:
        return None, []

    window_start = final_date - timedelta(days=MATCH_DATE_WINDOW_DAYS)
    window_end = final_date + timedelta(days=MATCH_DATE_WINDOW_DAYS)

    candidates = WorkOrder.query.filter(
        WorkOrder.product_id == product_id,
        WorkOrder.actual_end_date.isnot(None),
        WorkOrder.actual_end_date >= window_start,
        WorkOrder.actual_end_date <= window_end,
    ).all()

    if not candidates:
        # Product matched exactly, but no WorkOrder in the date window -
        # still offer similar-name suggestions in case the real WO is under
        # a slightly different product name than the exact match found.
        return None, _find_similar_smith_products(item_name)
    if len(candidates) == 1:
        return candidates[0], []

    # multiple candidates in the window: pick the closest actual_end_date
    candidates.sort(key=lambda wo: abs((wo.actual_end_date.date() - final_date).days))
    return candidates[0], []


def diff_against_smith(wo_detail, smith_wo):
    """
    Build a diff between the Accurate work order and its matched SMITH
    WorkOrder, covering everything except downtime (not tracked in Accurate).
    """
    from models.wms_advanced import MaterialConsumption

    accurate_qty = wo_detail.get('quantityReal')
    smith_qty = float(smith_wo.quantity_produced) if smith_wo.quantity_produced is not None else None
    qty_diff = None
    if accurate_qty is not None and smith_qty is not None:
        qty_diff = round(accurate_qty - smith_qty, 4)

    smith_consumptions = MaterialConsumption.query.filter_by(work_order_id=smith_wo.id).all()
    smith_by_name = {}
    for mc in smith_consumptions:
        name = mc.material.name.strip().upper() if mc.material else None
        if name:
            smith_by_name[name] = float(mc.quantity_actual or 0)

    material_diffs = []
    for row in wo_detail.get('detailMaterial', []):
        item = row.get('item', {})
        name = (item.get('name') or '').strip().upper()
        accurate_material_qty = row.get('quantityDefault')
        smith_material_qty = smith_by_name.pop(name, None)
        if smith_material_qty is None:
            material_diffs.append({
                'name': item.get('name'),
                'accurate_qty': accurate_material_qty,
                'smith_qty': None,
                'status': 'only_in_accurate',
            })
        elif accurate_material_qty != smith_material_qty:
            material_diffs.append({
                'name': item.get('name'),
                'accurate_qty': accurate_material_qty,
                'smith_qty': smith_material_qty,
                'status': 'quantity_mismatch',
            })

    # anything left in smith_by_name was consumed in SMITH but not present
    # in Accurate's detailMaterial for this WO
    for name, qty in smith_by_name.items():
        material_diffs.append({
            'name': name,
            'accurate_qty': None,
            'smith_qty': qty,
            'status': 'only_in_smith',
        })

    return {
        'output_quantity': {
            'accurate': accurate_qty,
            'smith': smith_qty,
            'diff': qty_diff,
        },
        'materials': material_diffs,
    }


def check_ejo(client, ejo_number, accurate_id=None):
    """
    Main entry point. Returns a dict with:
      - found: bool
      - summary: basic WO info (item, qty, status, dates)
      - material_tree: recursively expanded Barang Jadi -> WIP -> Mixing tree
      - process_history: EPD/FG stage history from Accurate
      - smith_match: matched SMITH WorkOrder id, or None
      - diff: comparison result, or None if no SMITH match found

    accurate_id: if the caller already knows the Accurate work order's id
    (e.g. selected from the cached work-order list, which covers up to 2500
    recent WOs), pass it to skip find_work_order_by_number() entirely - that
    search only scans the 200 most recent WOs and is slow (~seconds to a
    minute) even when it succeeds. Falls back to number-based search only
    when accurate_id is not provided (e.g. manual number entry in the form).
    """
    if accurate_id:
        wo_id = accurate_id
    else:
        wo_id = find_work_order_by_number(client, ejo_number)
        if not wo_id:
            return {
                'found': False,
                'message': f'Nomor EJO "{ejo_number}" tidak ditemukan di 200 Perintah Kerja Accurate terbaru.',
            }

    wo_detail = get_work_order_detail(client, wo_id)
    if not wo_detail:
        return {'found': False, 'message': 'Gagal mengambil detail Perintah Kerja dari Accurate.'}

    bom_id_cache = {}
    material_tree = expand_material_tree(client, wo_detail.get('detailMaterial', []), bom_id_cache)

    fgs_list = get_finished_good_slip_info(client, wo_id)
    # Prefer the main (non-waste) FGS for the headline machine/operator/shift
    # display; fall back to the first FGS found if only waste records exist.
    main_fgs = next((f for f in fgs_list if not f['is_waste']), fgs_list[0] if fgs_list else {})

    result = {
        'found': True,
        'summary': {
            'accurate_id': wo_detail.get('id'),
            'number': wo_detail.get('number'),
            'item': wo_detail.get('item', {}).get('name'),
            'quantity': wo_detail.get('quantity'),
            'quantity_default': wo_detail.get('quantityDefault'),
            'quantity_real': wo_detail.get('quantityReal'),
            'unit': wo_detail.get('itemUnit', {}).get('name'),
            'status': wo_detail.get('statusName'),
            'start_date': wo_detail.get('startDateView'),
            'end_date': wo_detail.get('endDateView'),
            'final_date': wo_detail.get('finalDateView'),
            'bom_number': wo_detail.get('billOfMaterial', {}).get('number'),
            'machine': main_fgs.get('machine'),
            'operator': main_fgs.get('operator'),
            'shift': main_fgs.get('shift'),
        },
        'finished_good_slips': fgs_list,
        'material_tree': material_tree,
        'process_history': [
            {
                'stage_type': h.get('historyType'),
                'stage_label': _WAREHOUSE_STAGE_LABELS.get(
                    h.get('historyType'), h.get('historyType')
                ),
                'number': h.get('historyNumber'),
                'date': h.get('historyDate'),
            }
            for h in wo_detail.get('processHistory', [])
        ],
        'smith_match': None,
        'diff': None,
        'smith_suggestions': [],
    }

    smith_wo, suggestions = find_matching_smith_work_order(wo_detail)
    if smith_wo:
        result['smith_match'] = {
            'work_order_id': smith_wo.id,
            'wo_number': smith_wo.wo_number,
        }
        result['diff'] = diff_against_smith(wo_detail, smith_wo)
    else:
        result['diff_message'] = (
            'Tidak ditemukan WO SMITH yang cocok (produk + tanggal selesai dalam '
            f'rentang {MATCH_DATE_WINDOW_DAYS} hari). Kroscek manual diperlukan.'
        )
        result['smith_suggestions'] = suggestions

    return result


def scan_and_cache_recent_work_orders(client, max_pages=125, page_size=20):
    """
    Full scan of the most recent Accurate work orders (default up to
    max_pages * page_size = 2500), rebuilding the AccurateWorkOrderCache
    table. Meant to be run manually/periodically, not on every page load -
    fetches 1 detail API call per work order, so this takes several minutes
    for 2500 rows. Powers the "Data Modul" browser tab so users can click
    through to check_ejo() instead of typing the EJO number manually.
    Returns the count of cached rows.
    """
    from models import db
    from models.accurate import AccurateWorkOrderCache

    entries = []
    for page in range(1, max_pages + 1):
        data = _get(client, 'work-order/list.do', {
            'sp.page': page,
            'sp.pageSize': page_size,
        })
        if not data.get('s'):
            break
        rows = data.get('d', [])
        if not rows:
            break
        for row in rows:
            detail = get_work_order_detail(client, row['id'])
            if not detail:
                continue
            entries.append({
                'accurate_id': detail.get('id'),
                'number': detail.get('number'),
                'item_name': detail.get('item', {}).get('name'),
                'quantity_real': detail.get('quantityReal'),
                'unit': detail.get('itemUnit', {}).get('name'),
                'status': detail.get('statusName'),
                'final_date': detail.get('finalDateView'),
            })

    # Rebuild table: clear and reinsert
    AccurateWorkOrderCache.query.delete()
    for e in entries:
        db.session.add(AccurateWorkOrderCache(**e))
    db.session.commit()

    return len(entries)


def get_finished_good_slip_info(client, work_order_id, max_pages=10, page_size=20):
    """
    Fetch all Finished Good Slip ("EJO penyelesaian") records related to a
    work order. One WorkOrder can have MULTIPLE FGS records - each
    completion/reject event (e.g. a partial reject needing extra sticker
    rework) is logged as its own FGS, confirmed by the user. Accurate
    stores Mesin/Operator/Shift as custom fields on finished-good-slip, NOT
    on work-order (confirmed via live testing after obtaining the
    finished_good_slip_view OAuth scope):
      charField1  = Mesin (machine name)
      charField9  = Operator (operator name)
      charField10 = Shift
    charField2-8 are downtime notes, always empty in practice - the company
    tracks downtime in SMITH instead of Accurate, per user confirmation.

    finished-good-slip/list.do's filter params were confirmed unreliable
    (like other Accurate list endpoints), so this scans recent pages and
    matches workOrderId client-side, same approach as find_work_order_by_number.
    Does NOT stop at the first match - collects every FGS tied to this WO,
    since -WASTE/reject slips are separate records worth surfacing.
    Returns a list of dicts: {number, machine, operator, shift, trans_date,
    is_waste}. Empty list if no matching FGS found.
    """
    results = []
    for page in range(1, max_pages + 1):
        data = _get(client, 'finished-good-slip/list.do', {
            'sp.page': page,
            'sp.pageSize': page_size,
        })
        if not data.get('s'):
            break
        rows = data.get('d', [])
        if not rows:
            break
        for row in rows:
            detail = _get(client, 'finished-good-slip/detail.do', {'id': row['id']})
            if not detail.get('s'):
                continue
            fgs = detail.get('d', {})
            if fgs.get('workOrderId') == work_order_id:
                number = fgs.get('number', '')
                results.append({
                    'number': number,
                    'machine': fgs.get('charField1'),
                    'operator': fgs.get('charField9'),
                    'shift': fgs.get('charField10'),
                    'trans_date': fgs.get('transDateView'),
                    'is_waste': 'WASTE' in number.upper(),
                })
    return results


def list_smith_work_orders_for_product(product_id, reference_date=None, limit=20):
    """
    List SMITH WorkOrders for a given product_id, for the manual-match
    picker UI (used when the automatic exact-match + date-window match
    fails and the user picks a similar product from smith_suggestions).
    Sorted by proximity to reference_date if given (closest actual_end_date
    first), otherwise by most recent first.
    Returns a list of dicts with id, wo_number, quantity_produced, status,
    actual_end_date - enough for the user to visually pick the right one.
    """
    from models.production import WorkOrder

    query = WorkOrder.query.filter(WorkOrder.product_id == product_id)
    work_orders = query.order_by(WorkOrder.actual_end_date.desc().nullslast()).limit(200).all()

    def sort_key(wo):
        if reference_date and wo.actual_end_date:
            return abs((wo.actual_end_date.date() - reference_date).days)
        return 0

    if reference_date:
        work_orders.sort(key=sort_key)

    result = []
    for wo in work_orders[:limit]:
        result.append({
            'id': wo.id,
            'wo_number': wo.wo_number,
            'quantity_produced': float(wo.quantity_produced) if wo.quantity_produced is not None else None,
            'status': wo.status,
            'actual_end_date': wo.actual_end_date.strftime('%Y-%m-%d') if wo.actual_end_date else None,
        })
    return result


def diff_against_smith_by_id(wo_detail, smith_wo_id):
    """
    Same as diff_against_smith(), but takes a SMITH WorkOrder id directly
    instead of a model instance - for the manual-match flow where the user
    picks a WorkOrder from the smith_suggestions candidate picker rather
    than relying on the automatic exact-match + date-window match.
    Returns the diff dict, or None if the WorkOrder id doesn't exist.
    """
    from models.production import WorkOrder

    smith_wo = WorkOrder.query.get(smith_wo_id)
    if not smith_wo:
        return None
    return diff_against_smith(wo_detail, smith_wo)


def _get_or_create_warehouse_inventory(location_id, product_id=None, material_id=None):
    """
    Find the Inventory row for a product OR material at a given warehouse
    location, creating one (starting at 0) if it doesn't exist yet.
    Exactly one of product_id/material_id should be given.
    """
    from models import db
    from models.warehouse import Inventory

    query = Inventory.query.filter_by(location_id=location_id)
    query = query.filter_by(product_id=product_id) if product_id else query.filter_by(material_id=material_id)
    inv = query.first()
    if inv:
        return inv

    inv = Inventory(
        product_id=product_id,
        material_id=material_id,
        location_id=location_id,
        quantity_on_hand=0,
        quantity_reserved=0,
        quantity_available=0,
        min_stock_level=0,
        max_stock_level=0,
        is_active=True,
        stock_status='in_stock',
    )
    db.session.add(inv)
    db.session.flush()
    return inv


def sync_ejo_warehouse_stock(client, max_pages=10, page_size=20):
    """
    Manual-trigger sync: scans recent Accurate EJOs and, for each
    processHistory stage (MS=masuk Gudang EPD, FGS=masuk Gudang FG),
    cumulatively adds the completed quantity to the matching SMITH
    Inventory row at the EPD (location_id=5) or FG (location_id=3)
    warehouse location - per user decision, EPD quantity is NOT
    decremented when a batch progresses to FG; both stages are recorded
    as historical/cumulative totals.

    Skips any EJO+stage combination already present in EjoWarehouseSyncLog
    to avoid double-counting on repeated runs. Only EJOs whose output item
    exact-matches a SMITH product (via find_smith_match) can be synced -
    unmatched EJOs are skipped and counted separately in the result.

    Warehouse location_ids are fixed per the one-time seeding done for
    this feature: EPD=5, FG=3 (existing FG-01 zone, already in use by
    other inventory - untouched otherwise).

    Returns a summary dict: {scanned, synced, skipped_already_synced,
    skipped_no_match, skipped_no_history}.
    """
    from models import db
    from models.accurate import EjoWarehouseSyncLog
    from utils.accurate_item_matcher import find_smith_match

    EPD_LOCATION_ID = 5
    FG_LOCATION_ID = 3

    summary = {
        'scanned': 0,
        'synced': 0,
        'skipped_already_synced': 0,
        'skipped_no_match': 0,
        'skipped_no_history': 0,
    }

    already_synced = {
        (row.ejo_number, row.stage_type)
        for row in EjoWarehouseSyncLog.query.all()
    }

    for page in range(1, max_pages + 1):
        data = _get(client, 'work-order/list.do', {'sp.page': page, 'sp.pageSize': page_size})
        if not data.get('s'):
            break
        rows = data.get('d', [])
        if not rows:
            break

        for row in rows:
            wo_detail = get_work_order_detail(client, row['id'])
            if not wo_detail:
                continue
            summary['scanned'] += 1

            ejo_number = wo_detail.get('number')
            process_history = wo_detail.get('processHistory', [])
            if not process_history:
                summary['skipped_no_history'] += 1
                continue

            item_name = wo_detail.get('item', {}).get('name')
            match = find_smith_match(item_name) if item_name else None
            if not match or match.get('table') != 'products':
                summary['skipped_no_match'] += 1
                if item_name:
                    from models.accurate import EjoWarehouseUnmatchedProduct
                    unmatched = EjoWarehouseUnmatchedProduct.query.filter_by(accurate_item_name=item_name).first()
                    if unmatched:
                        unmatched.occurrence_count += 1
                        unmatched.last_ejo_number = ejo_number
                        unmatched.last_seen_at = datetime.utcnow()
                    else:
                        db.session.add(EjoWarehouseUnmatchedProduct(
                            accurate_item_name=item_name,
                            occurrence_count=1,
                            last_ejo_number=ejo_number,
                        ))
                continue
            product_id = match['id']

            # Fetch FGS info once per work order (not per stage) and reuse
            # for both MS/FGS log entries - avoids a second Accurate round
            # trip, and lets warehouse-stock-detail read Mesin/Operator/
            # Shift straight from the log without re-fetching from Accurate
            # (previously took 30+ seconds for ~10 entries).
            fgs_list = get_finished_good_slip_info(client, wo_detail.get('id'))
            main_fgs = next((f for f in fgs_list if not f['is_waste']), fgs_list[0] if fgs_list else {})

            for stage in process_history:
                stage_type = stage.get('historyType')
                if stage_type not in ('MS', 'FGS'):
                    continue
                if (ejo_number, stage_type) in already_synced:
                    summary['skipped_already_synced'] += 1
                    continue

                location_id = EPD_LOCATION_ID if stage_type == 'MS' else FG_LOCATION_ID
                qty = wo_detail.get('quantityReal') if stage_type == 'MS' else wo_detail.get('finishedGoodSlipQuantity')
                if qty is None:
                    qty = wo_detail.get('quantityReal', 0)

                inv = _get_or_create_warehouse_inventory(location_id, product_id=product_id)
                inv.quantity_on_hand = float(inv.quantity_on_hand or 0) + float(qty)
                inv.quantity_available = float(inv.quantity_available or 0) + float(qty)

                db.session.add(EjoWarehouseSyncLog(
                    ejo_number=ejo_number,
                    stage_type=stage_type,
                    accurate_work_order_id=wo_detail.get('id'),
                    product_id=product_id,
                    quantity_added=qty,
                    inventory_id=inv.id,
                    machine=main_fgs.get('machine'),
                    operator=main_fgs.get('operator'),
                    shift=main_fgs.get('shift'),
                    trans_date=main_fgs.get('trans_date'),
                ))
                already_synced.add((ejo_number, stage_type))
                summary['synced'] += 1

    db.session.commit()
    return summary


def get_warehouse_stock_summary():
    """
    Read-only summary of current EPD/FG warehouse stock (as synced by
    sync_ejo_warehouse_stock), for display in the UI. Returns a dict with
    'epd' and 'fg' keys (each a list of {product_id, product_name,
    quantity_on_hand} sorted by quantity descending), plus 'unmatched' -
    Accurate item names seen during sync that had no exact-match SMITH
    product, so they're visible with a warning instead of silently
    disappearing from the sync results.
    """
    from models.warehouse import Inventory
    from models.product import Product
    from models.accurate import EjoWarehouseUnmatchedProduct

    EPD_LOCATION_ID = 5
    FG_LOCATION_ID = 3

    def _rows_for(location_id):
        rows = (
            Inventory.query
            .filter(Inventory.location_id == location_id, Inventory.product_id.isnot(None))
            .join(Product, Inventory.product_id == Product.id)
            .with_entities(Product.id, Product.name, Inventory.quantity_on_hand)
            .order_by(Inventory.quantity_on_hand.desc())
            .all()
        )
        return [
            {'product_id': pid, 'product_name': name, 'quantity_on_hand': float(qty or 0)}
            for pid, name, qty in rows
        ]

    unmatched = (
        EjoWarehouseUnmatchedProduct.query
        .order_by(EjoWarehouseUnmatchedProduct.occurrence_count.desc())
        .all()
    )

    return {
        'epd': _rows_for(EPD_LOCATION_ID),
        'fg': _rows_for(FG_LOCATION_ID),
        'unmatched': [{
            'accurate_item_name': u.accurate_item_name,
            'occurrence_count': u.occurrence_count,
            'last_ejo_number': u.last_ejo_number,
            'last_seen_at': u.last_seen_at.strftime('%Y-%m-%d %H:%M') if u.last_seen_at else None,
        } for u in unmatched],
    }


def get_warehouse_stock_detail(product_id, location_id):
    """
    Full breakdown of a product's cumulative stock at an EPD/FG warehouse
    location: every EjoWarehouseSyncLog entry that contributed to the
    current total. Mesin/Operator/Shift are read directly from the log
    row (stored at sync time by sync_ejo_warehouse_stock) - this used to
    re-fetch each entry's Finished Good Slip info live from Accurate,
    which took 30+ seconds for ~10 entries; now it's a single fast local
    DB query, so anyone (not just the person who ran the sync) can open
    this for audit purposes without a long wait.
    Returns {product_name, total_quantity, entries: [...]}.
    """
    from models.accurate import EjoWarehouseSyncLog
    from models.warehouse import Inventory
    from models.product import Product

    stage_type = 'MS' if location_id == 5 else 'FGS'

    log_entries = (
        EjoWarehouseSyncLog.query
        .filter_by(product_id=product_id, stage_type=stage_type)
        .order_by(EjoWarehouseSyncLog.created_at.desc())
        .all()
    )

    product = Product.query.get(product_id)
    inv = Inventory.query.filter_by(product_id=product_id, location_id=location_id).first()

    entries = [{
        'ejo_number': log.ejo_number,
        'quantity_added': log.quantity_added,
        'synced_at': log.created_at.strftime('%Y-%m-%d %H:%M') if log.created_at else None,
        'machine': log.machine,
        'operator': log.operator,
        'shift': log.shift,
        'trans_date': log.trans_date,
    } for log in log_entries]

    return {
        'product_name': product.name if product else None,
        'total_quantity': float(inv.quantity_on_hand) if inv else 0,
        'entries': entries,
    }


# Accurate warehouse IDs confirmed via live item/detail.do lookup, mapped
# to their SMITH warehouse_locations counterparts (seeded for this feature)
_ACCURATE_WAREHOUSE_TO_SMITH_LOCATION = {
    152: 4,   # GUDANG PM -> ZONE-PM location
    250: 5,   # GUDANG EPD -> ZONE-EPD location
    151: 3,   # GUDANG FG -> FG-01 location (existing)
}


def sync_warehouse_stock_from_item_detail(client, max_items=None):
    """
    Full-catalog sync of PM/EPD/FG warehouse stock, reading Accurate's
    official per-warehouse stock breakdown (item/detail.do's
    detailWarehouseData field) instead of inferring from EJO
    processHistory. More accurate (real stock data, not derived from
    production events) and covers PM (which processHistory-based sync
    could never reach, since EJO doesn't touch packing material stock).

    This REPLACES SMITH Inventory.quantity_on_hand with Accurate's current
    value (snapshot), unlike the EJO-based EPD/FG sync which is
    cumulative/historical - these numbers should always mirror Accurate's
    live state.

    Scans the full item catalog (~1594 items as of Aug 2026), 1 detail
    call per item - takes ~15-25 minutes. max_items caps the scan for
    testing; None means no cap (full catalog).

    Only items whose name exact-matches a SMITH product (via
    find_smith_match) can be synced - unmatched items are tracked in
    EjoWarehouseUnmatchedProduct same as the EJO-based sync, so both
    sync paths share one unmatched-products list.

    Returns summary dict: {scanned, synced, skipped_no_match,
    skipped_no_stock}.
    """
    from models import db
    from models.warehouse import Inventory
    from models.accurate import EjoWarehouseUnmatchedProduct
    from utils.accurate_item_matcher import find_smith_match

    summary = {
        'scanned': 0,
        'synced': 0,
        'skipped_no_match': 0,
        'skipped_no_stock': 0,
    }

    page = 1
    page_size = 100
    items_processed = 0

    while True:
        data = _get(client, 'item/list.do', {
            'fields': 'id,no,name',
            'sp.page': page,
            'sp.pageSize': page_size,
        })
        if not data.get('s'):
            break
        rows = data.get('d', [])
        if not rows:
            break

        for row in rows:
            if max_items is not None and items_processed >= max_items:
                db.session.commit()
                return summary
            items_processed += 1

            detail = _get(client, 'item/detail.do', {'id': row['id']})
            if not detail.get('s'):
                continue
            item_detail = detail.get('d', {})
            summary['scanned'] += 1

            item_name = item_detail.get('name')
            warehouse_rows = item_detail.get('detailWarehouseData', [])
            relevant_stock = {
                wh['id']: wh
                for wh in warehouse_rows
                if wh.get('id') in _ACCURATE_WAREHOUSE_TO_SMITH_LOCATION
            }
            if not relevant_stock:
                summary['skipped_no_stock'] += 1
                continue

            match = find_smith_match(item_name) if item_name else None
            if not match:
                summary['skipped_no_match'] += 1
                if item_name:
                    unmatched = EjoWarehouseUnmatchedProduct.query.filter_by(accurate_item_name=item_name).first()
                    if unmatched:
                        unmatched.occurrence_count += 1
                        unmatched.last_seen_at = datetime.utcnow()
                    else:
                        db.session.add(EjoWarehouseUnmatchedProduct(
                            accurate_item_name=item_name,
                            occurrence_count=1,
                        ))
                continue
            # match can be a product (finished goods) or a material (raw
            # material, chemical, packaging) - PM warehouse in particular
            # is mostly materials, so both must be handled
            is_material = match.get('table') == 'materials'
            product_id = None if is_material else match['id']
            material_id = match['id'] if is_material else None

            from models.accurate import WarehouseStockSnapshotDetail

            for accurate_wh_id, wh_data in relevant_stock.items():
                location_id = _ACCURATE_WAREHOUSE_TO_SMITH_LOCATION[accurate_wh_id]
                qty = wh_data.get('unit1Quantity', 0)

                inv = _get_or_create_warehouse_inventory(location_id, product_id=product_id, material_id=material_id)
                inv.quantity_on_hand = float(qty)
                inv.quantity_available = float(qty)

                # flush before checking so any snapshot inserted earlier in
                # this same request (e.g. a prior page's item) is visible -
                # guards against the unique constraint firing on a stale read
                db.session.flush()
                snapshot_filter = {'material_id': material_id, 'smith_location_id': location_id} if is_material \
                    else {'product_id': product_id, 'smith_location_id': location_id}
                snapshot = WarehouseStockSnapshotDetail.query.filter_by(**snapshot_filter).first()
                if not snapshot:
                    snapshot = WarehouseStockSnapshotDetail(
                        product_id=product_id, material_id=material_id, smith_location_id=location_id
                    )
                    db.session.add(snapshot)
                snapshot.accurate_warehouse_id = accurate_wh_id
                snapshot.accurate_warehouse_name = wh_data.get('warehouseName')
                snapshot.pic = wh_data.get('pic')
                snapshot.unit1_quantity = wh_data.get('unit1Quantity')
                snapshot.unit1_name = item_detail.get('unit1NameWarehouse')
                snapshot.unit2_quantity = wh_data.get('unit2Quantity')
                snapshot.unit2_name = item_detail.get('unit2NameWarehouse')
                snapshot.unit3_quantity = wh_data.get('unit3Quantity')
                snapshot.unit3_name = item_detail.get('unit3NameWarehouse')
                snapshot.synced_at = datetime.utcnow()

                summary['synced'] += 1

        page += 1

    db.session.commit()
    return summary


def get_warehouse_snapshot_summary():
    """
    Read-only summary of current PM/EPD/FG warehouse stock from the
    item/detail.do-based snapshot sync (sync_warehouse_stock_from_item_detail),
    for display in the UI. Returns a dict with 'pm', 'epd', 'fg' keys, each
    a list of {kind, ref_id, name, quantity_on_hand} sorted by quantity
    descending - kind is 'product' or 'material' since PM in particular is
    mostly raw materials/chemicals/packaging, not finished goods.
    """
    from models.warehouse import Inventory
    from models.product import Product, Material

    PM_LOCATION_ID = 4
    EPD_LOCATION_ID = 5
    FG_LOCATION_ID = 3

    def _rows_for(location_id):
        product_rows = (
            Inventory.query
            .filter(Inventory.location_id == location_id, Inventory.product_id.isnot(None))
            .join(Product, Inventory.product_id == Product.id)
            .with_entities(Product.id, Product.name, Inventory.quantity_on_hand)
            .all()
        )
        material_rows = (
            Inventory.query
            .filter(Inventory.location_id == location_id, Inventory.material_id.isnot(None))
            .join(Material, Inventory.material_id == Material.id)
            .with_entities(Material.id, Material.name, Inventory.quantity_on_hand)
            .all()
        )
        combined = [
            {'kind': 'product', 'ref_id': pid, 'product_name': name, 'quantity_on_hand': float(qty or 0)}
            for pid, name, qty in product_rows
        ] + [
            {'kind': 'material', 'ref_id': mid, 'product_name': name, 'quantity_on_hand': float(qty or 0)}
            for mid, name, qty in material_rows
        ]
        combined.sort(key=lambda r: r['quantity_on_hand'], reverse=True)
        return combined

    return {
        'pm': _rows_for(PM_LOCATION_ID),
        'epd': _rows_for(EPD_LOCATION_ID),
        'fg': _rows_for(FG_LOCATION_ID),
    }


def get_warehouse_snapshot_detail(ref_id, location_id, kind='product'):
    """
    Full Accurate warehouse detail for a product OR material at a
    PM/EPD/FG location: real Accurate warehouse name, PIC, and per-unit
    quantity breakdown (unit1/2/3), read from the persisted
    WarehouseStockSnapshotDetail table (populated by
    sync_warehouse_stock_from_item_detail).
    kind: 'product' or 'material'.
    Returns None if no snapshot exists for this item+location.
    """
    from models.accurate import WarehouseStockSnapshotDetail
    from models.product import Product, Material

    if kind == 'material':
        snapshot = WarehouseStockSnapshotDetail.query.filter_by(
            material_id=ref_id, smith_location_id=location_id
        ).first()
        item = Material.query.get(ref_id) if snapshot else None
    else:
        snapshot = WarehouseStockSnapshotDetail.query.filter_by(
            product_id=ref_id, smith_location_id=location_id
        ).first()
        item = Product.query.get(ref_id) if snapshot else None

    if not snapshot:
        return None

    return {
        'product_name': item.name if item else None,
        'accurate_warehouse_name': snapshot.accurate_warehouse_name,
        'pic': snapshot.pic,
        'units': [
            {'quantity': snapshot.unit1_quantity, 'name': snapshot.unit1_name},
            {'quantity': snapshot.unit2_quantity, 'name': snapshot.unit2_name},
            {'quantity': snapshot.unit3_quantity, 'name': snapshot.unit3_name},
        ],
        'synced_at': snapshot.synced_at.strftime('%Y-%m-%d %H:%M') if snapshot.synced_at else None,
    }
