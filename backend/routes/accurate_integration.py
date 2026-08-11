"""
Accurate Online Integration Routes
Endpoint REST API untuk konfigurasi, item mapping, dry-run simulation, dan approval queue log sync Accurate.
"""
import base64
import requests
from datetime import datetime
from flask import Blueprint, request, jsonify, redirect
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db
from models.accurate import AccurateConfig, AccurateItemMapping, AccurateSyncLog
from utils.accurate_client import AccurateClient
from utils.i18n import success_response, error_response

accurate_bp = Blueprint('accurate_integration', __name__)


@accurate_bp.route('/oauth/callback', methods=['GET'])
def oauth_callback():
    """OAuth2 Callback Receiver dari Accurate Online (Tanpa @jwt_required karena di-redirect dari browser Accurate)."""
    try:
        error = request.args.get('error')
        if error:
            error_desc = request.args.get('error_description', error)
            return redirect(f"/app/integration/accurate?oauth_error={error_desc}")

        code = request.args.get('code')
        if not code:
            return redirect("/app/integration/accurate?oauth_error=no_code_provided")

        config = AccurateConfig.query.first()
        if not config or not config.client_id or not config.client_secret:
            return redirect("/app/integration/accurate?oauth_error=config_missing")

        token_url = "https://account.accurate.id/oauth/token"
        redirect_uri = 'https://erp.graterp.my.id/api/integrations/accurate/oauth/callback'

        auth_header = base64.b64encode(f"{config.client_id}:{config.client_secret}".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri
        }

        resp = requests.post(token_url, data=data, headers=headers, timeout=15)
        if resp.status_code == 200:
            token_data = resp.json()
            config.access_token = token_data.get('access_token') or token_data.get('token') or token_data.get('data')
            config.refresh_token = token_data.get('refresh_token')
            
            # Auto fetch db_id via databaseId param or db-list.do
            db_id_param = request.args.get('databaseId') or request.args.get('db_id')
            if db_id_param:
                config.db_id = str(db_id_param)

            try:
                if not config.db_id and config.access_token:
                    db_resp = requests.get(
                        "https://account.accurate.id/api/db-list.do",
                        headers={"X-Session-ID": config.access_token},
                        timeout=10
                    )
                    if db_resp.status_code == 200 and db_resp.json().get('d'):
                        dbs = db_resp.json()['d']
                        if len(dbs) > 0:
                            config.db_id = str(dbs[0].get('id'))
            except Exception:
                pass

            db.session.commit()
            return redirect("/app/integration/accurate?connected=true")
        else:
            print(f"[ACCURATE OAUTH ERROR] status={resp.status_code} body={resp.text}")
            error_snippet = resp.text[:200].replace(chr(10), " ")
            return redirect(f"/app/integration/accurate?oauth_error=token_exchange_failed&detail={error_snippet}")

    except Exception as e:
        db.session.rollback()
        return redirect(f"/app/integration/accurate?oauth_error={str(e)}")



@accurate_bp.route('/config', methods=['GET'])
@jwt_required()
def get_config():
    """Mengambil konfigurasi integrasi Accurate saat ini."""
    try:
        config = AccurateConfig.query.first()
        if not config:
            config = AccurateConfig(is_dry_run=True, api_url='https://accurate.id')
            db.session.add(config)
            db.session.commit()
        return success_response('accurate.config_fetched', data=config.to_dict()), 200
    except Exception as e:
        return error_response('accurate.config_error', details=str(e)), 500


@accurate_bp.route('/config', methods=['POST'])
@jwt_required()
def update_config():
    """Memperbarui konfigurasi API Accurate & mode Dry-Run."""
    try:
        data = request.get_json() or {}
        config = AccurateConfig.query.first()
        if not config:
            config = AccurateConfig()
            db.session.add(config)

        if 'client_id' in data:
            config.client_id = data['client_id']
        if 'client_secret' in data:
            config.client_secret = data['client_secret']
        if 'db_id' in data:
            config.db_id = data['db_id']
        if 'api_url' in data:
            config.api_url = data['api_url']
        if 'access_token' in data:
            config.access_token = data['access_token']
        if 'refresh_token' in data:
            config.refresh_token = data['refresh_token']
        if 'is_dry_run' in data:
            config.is_dry_run = bool(data['is_dry_run'])
        if 'auto_approve' in data:
            config.auto_approve = bool(data['auto_approve'])

        db.session.commit()
        return success_response('accurate.config_updated', data=config.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return error_response('accurate.update_error', details=str(e)), 500


@accurate_bp.route('/accurate-items', methods=['GET'])
@jwt_required()
def get_accurate_items():
    """Mengambil daftar barang/BOM dari API Accurate Online (atau mock data)."""
    print("[ROUTE DEBUG] get_accurate_items() called")
    try:
        client = AccurateClient()
        items = client.fetch_items_from_accurate()
        print("[MARKER TEST123] returning items now")
        return success_response('accurate.items_fetched', data=items), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500


@accurate_bp.route('/mappings', methods=['GET'])
@jwt_required()
def get_mappings():
    """Daftar pemetaan barang Accurate ↔ SMITH ERP."""
    try:
        mappings = AccurateItemMapping.query.all()
        return success_response('accurate.mappings_fetched', data=[m.to_dict() for m in mappings]), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500


@accurate_bp.route('/mappings', methods=['POST'])
@jwt_required()
def save_mapping():
    """Membuat atau memperbarui pemetaan item Accurate ke SMITH ERP."""
    try:
        data = request.get_json() or {}
        acc_no = data.get('accurate_item_no')
        if not acc_no:
            return error_response('accurate.missing_item_no', error_code=400), 400

        mapping = AccurateItemMapping.query.filter_by(accurate_item_no=acc_no).first()
        if not mapping:
            mapping = AccurateItemMapping(accurate_item_no=acc_no)
            db.session.add(mapping)

        mapping.accurate_item_name = data.get('accurate_item_name')
        mapping.accurate_item_type = data.get('accurate_item_type', 'ITEM')
        mapping.smith_item_type = data.get('smith_item_type', 'material')
        mapping.smith_material_id = data.get('smith_material_id')
        mapping.smith_product_id = data.get('smith_product_id')
        mapping.uom_conversion_ratio = data.get('uom_conversion_ratio', 1.0)
        mapping.notes = data.get('notes')

        db.session.commit()
        return success_response('accurate.mapping_saved', data=mapping.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return error_response('accurate.save_error', details=str(e)), 500


@accurate_bp.route('/sync/dry-run', methods=['POST'])
@jwt_required()
def run_dry_run():
    """Menjalankan Simulasi Dry-Run Penarikan API Accurate & Perhitungan Diff Stok."""
    try:
        current_user_id = get_jwt_identity()
        client = AccurateClient()
        sim_results = client.run_simulation(user_id=current_user_id)
        return success_response('accurate.dry_run_completed', data=sim_results), 200
    except Exception as e:
        return error_response('accurate.simulation_error', details=str(e)), 500


@accurate_bp.route('/sync-logs', methods=['GET'])
@jwt_required()
def get_sync_logs():
    """Mengambil daftar log sync / approval queue Accurate."""
    try:
        status_filter = request.args.get('status')
        query = AccurateSyncLog.query.order_by(AccurateSyncLog.id.desc())
        if status_filter:
            query = query.filter(AccurateSyncLog.status == status_filter.upper())
        logs = query.limit(5000).all()
        return success_response('accurate.logs_fetched', data=[l.to_dict() for l in logs]), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500


@accurate_bp.route('/sync-logs/<int:log_id>/approve', methods=['POST'])
@jwt_required()
def approve_sync_log(log_id):
    """Menyetujui (Approve) transaksi sync log dari Accurate ke WMS SMITH ERP."""
    try:
        current_user_id = get_jwt_identity()
        client = AccurateClient()
        result = client.apply_sync_log(log_id, user_id=current_user_id)
        return success_response('accurate.log_approved', data=result), 200
    except Exception as e:
        db.session.rollback()
        return error_response('accurate.approve_error', details=str(e)), 500


@accurate_bp.route('/sync-logs/<int:log_id>/reject', methods=['POST'])
@jwt_required()
def reject_sync_log(log_id):
    """Menolak (Reject) transaksi sync log dari Accurate."""
    try:
        log = AccurateSyncLog.query.get(log_id)
        if not log:
            return error_response('accurate.log_not_found', error_code=404), 404

        log.status = 'REJECTED'
        db.session.commit()
        return success_response('accurate.log_rejected', data=log.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return error_response('accurate.reject_error', details=str(e)), 500

@accurate_bp.route('/sync-scan-cron', methods=['POST'])
def trigger_sync_scan_cron():
    """
    Sama seperti /sync-scan tapi tanpa auth -- untuk dipanggil dari system
    cron via curl polos, mengikuti pola endpoint /machine-health/check-and-notify
    yang sudah ada. created_by disimpan sebagai None (bukan user asli, tapi
    scheduled job) di setiap AccurateSyncLog yang dibuat.
    """
    try:
        from utils.accurate_sync_scan import scan_and_queue_new_items
        result = scan_and_queue_new_items(created_by=None)
        return success_response('accurate.sync_scan_done', data=result), 200
    except Exception as e:
        db.session.rollback()
        return error_response('accurate.sync_scan_error', details=str(e)), 500


@accurate_bp.route('/sync-scan', methods=['POST'])
@jwt_required()
def trigger_sync_scan():
    """
    Scan seluruh item Accurate, klasifikasikan + cocokkan dengan data SMITH,
    dan tambahkan kandidat item baru ke antrean approval sync.
    Manual-trigger untuk sekarang; akan dipanggil hourly via APScheduler.
    """
    try:
        from utils.accurate_sync_scan import scan_and_queue_new_items
        current_user_id = get_jwt_identity()
        result = scan_and_queue_new_items(created_by=current_user_id)
        return success_response('accurate.sync_scan_done', data=result), 200
    except Exception as e:
        db.session.rollback()
        return error_response('accurate.sync_scan_error', details=str(e)), 500


@accurate_bp.route('/delete-scan', methods=['POST'])
@jwt_required()
def trigger_delete_scan():
    """
    Scan item SMITH hasil sync Accurate (code berawalan ACC-) yang sudah
    tidak ada lagi di daftar item Accurate saat ini, tambahkan ke antrean
    approval sebagai kandidat item_deleted (soft-delete via is_active=False
    saat di-approve). Manual-trigger saja -- sengaja tidak dijadwalkan
    cron otomatis karena efeknya menonaktifkan data.
    """
    try:
        from utils.accurate_delete_scan import scan_and_queue_deleted_items
        current_user_id = get_jwt_identity()
        result = scan_and_queue_deleted_items(created_by=current_user_id)
        return success_response('accurate.delete_scan_done', data=result), 200
    except Exception as e:
        db.session.rollback()
        return error_response('accurate.delete_scan_error', details=str(e)), 500


@accurate_bp.route('/bom-scan', methods=['POST'])
@jwt_required()
def trigger_bom_scan():
    """
    Scan seluruh BOM/formula Accurate, bandingkan dengan BillOfMaterials
    Internal ERP, tambahkan kandidat bom_new/bom_line_changed ke antrean
    approval. Manual-trigger -- cadence disarankan mingguan/beberapa hari
    sekali (bukan hourly), karena scan ~1.5-9.5 menit tergantung kondisi
    API Accurate.
    """
    try:
        from utils.accurate_bom_scan import scan_and_queue_bom_changes
        current_user_id = get_jwt_identity()
        result = scan_and_queue_bom_changes(created_by=current_user_id)
        return success_response('accurate.bom_scan_done', data=result), 200
    except Exception as e:
        db.session.rollback()
        return error_response('accurate.bom_scan_error', details=str(e)), 500


@accurate_bp.route('/bom-delete-scan', methods=['POST'])
@jwt_required()
def trigger_bom_delete_scan():
    """
    Scan BillOfMaterials Internal ERP (hasil sync Accurate) yang BOM-nya
    sudah tidak ada lagi di Accurate, tambahkan kandidat bom_deleted ke
    antrean approval. Manual-trigger saja.
    """
    try:
        from utils.accurate_bom_delete_scan import scan_and_queue_deleted_boms
        current_user_id = get_jwt_identity()
        result = scan_and_queue_deleted_boms(created_by=current_user_id)
        return success_response('accurate.bom_delete_scan_done', data=result), 200
    except Exception as e:
        db.session.rollback()
        return error_response('accurate.bom_delete_scan_error', details=str(e)), 500


@accurate_bp.route('/bom-item-index-scan', methods=['POST'])
@jwt_required()
def trigger_bom_item_index_scan():
    """
    Scan seluruh BOM Accurate (~643) dan bangun ulang cache index
    item_id -> bom_id (AccurateBomItemIndex). Dipakai oleh fitur cek EJO
    untuk expand pohon bahan bertingkat (Barang Jadi -> WIP -> Mixing)
    tanpa harus scan live tiap kali (yang makan ~1.5-2 menit). Manual
    trigger -- jalankan ulang setiap kali struktur BOM Accurate berubah.
    """
    try:
        from utils.accurate_ejo_check import scan_and_cache_bom_item_index
        client = AccurateClient()
        count = scan_and_cache_bom_item_index(client)
        return success_response('accurate.bom_item_index_scan_done', data={'indexed_count': count}), 200
    except Exception as e:
        db.session.rollback()
        return error_response('accurate.bom_item_index_scan_error', details=str(e)), 500


@accurate_bp.route('/work-order-cache-scan', methods=['POST'])
@jwt_required()
def trigger_work_order_cache_scan():
    """
    Scan Perintah Kerja (EJO) Accurate terbaru (default hingga 2500) dan
    simpan ke cache lokal untuk ditampilkan di tab Data Modul. Manual
    trigger -- makan waktu beberapa menit karena 1 API call detail per WO.
    """
    try:
        from utils.accurate_ejo_check import scan_and_cache_recent_work_orders
        client = AccurateClient()
        count = scan_and_cache_recent_work_orders(client)
        return success_response('accurate.wo_cache_scan_done', data={'cached_count': count}), 200
    except Exception as e:
        db.session.rollback()
        return error_response('accurate.wo_cache_scan_error', details=str(e)), 500


@accurate_bp.route('/work-order-cache', methods=['GET'])
@jwt_required()
def get_work_order_cache():
    """
    Ambil daftar Perintah Kerja (EJO) Accurate dari cache lokal (hasil
    scan terakhir), untuk ditampilkan di tab Data Modul.
    """
    try:
        from models.accurate import AccurateWorkOrderCache
        rows = AccurateWorkOrderCache.query.order_by(AccurateWorkOrderCache.id.desc()).limit(500).all()
        data = [{
            'accurate_id': r.accurate_id,
            'number': r.number,
            'item_name': r.item_name,
            'quantity_real': r.quantity_real,
            'unit': r.unit,
            'status': r.status,
            'final_date': r.final_date,
        } for r in rows]
        return success_response('accurate.wo_cache_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500


@accurate_bp.route('/ejo-manual-match', methods=['POST'])
@jwt_required()
def ejo_manual_match():
    """
    Hitung diff lengkap (quantity + bahan) antara sebuah EJO Accurate dan
    WO Internal ERP yang dipilih MANUAL oleh user (dari daftar kandidat
    produk mirip), untuk kasus di mana exact-match otomatis gagal.
    Body: { accurate_id, smith_work_order_id }
    """
    try:
        from utils.accurate_ejo_check import get_work_order_detail, diff_against_smith_by_id
        data = request.get_json() or {}
        accurate_id = data.get('accurate_id')
        smith_work_order_id = data.get('smith_work_order_id')
        if not accurate_id or not smith_work_order_id:
            return error_response('accurate.ejo_manual_match_missing_params'), 400

        client = AccurateClient()
        wo_detail = get_work_order_detail(client, accurate_id)
        if not wo_detail:
            return error_response('accurate.fetch_error'), 404

        diff = diff_against_smith_by_id(wo_detail, smith_work_order_id)
        if diff is None:
            return error_response('accurate.smith_wo_not_found'), 404

        from models.production import WorkOrder
        smith_wo = WorkOrder.query.get(smith_work_order_id)
        return success_response('accurate.ejo_manual_match_done', data={
            'smith_match': {'work_order_id': smith_wo.id, 'wo_number': smith_wo.wo_number},
            'diff': diff,
        }), 200
    except Exception as e:
        return error_response('accurate.ejo_manual_match_error', details=str(e)), 500


@accurate_bp.route('/warehouse-snapshot-summary', methods=['GET'])
@jwt_required()
def get_warehouse_snapshot_summary_endpoint():
    """
    Ringkasan stok Gudang PM/EPD/FG dari hasil sync snapshot resmi
    Accurate (item/detail.do), untuk ditampilkan di UI.
    """
    try:
        from utils.accurate_ejo_check import get_warehouse_snapshot_summary
        result = get_warehouse_snapshot_summary()
        return success_response('accurate.warehouse_snapshot_summary_fetched', data=result), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500


@accurate_bp.route('/warehouse-snapshot-detail', methods=['GET'])
@jwt_required()
def get_warehouse_snapshot_detail_endpoint():
    """
    Detail resmi Accurate untuk sebuah produk ATAU material di Gudang
    PM/EPD/FG: nama gudang asli, PIC, dan breakdown qty per satuan
    (PCK/CTN/BND dll). Query params: ref_id (wajib), location (wajib,
    'pm'/'epd'/'fg'), kind (opsional, 'product' default atau 'material').
    """
    try:
        from utils.accurate_ejo_check import get_warehouse_snapshot_detail
        ref_id = request.args.get('ref_id', type=int)
        location = request.args.get('location')
        kind = request.args.get('kind', 'product')
        location_map = {'pm': 4, 'epd': 5, 'fg': 3}
        if not ref_id or location not in location_map or kind not in ('product', 'material'):
            return error_response('accurate.warehouse_detail_params_required'), 400

        result = get_warehouse_snapshot_detail(ref_id, location_map[location], kind=kind)
        if result is None:
            return error_response('accurate.warehouse_snapshot_not_found'), 404
        return success_response('accurate.warehouse_snapshot_detail_fetched', data=result), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500


@accurate_bp.route('/warehouse-stock-full-sync', methods=['POST'])
@jwt_required()
def trigger_warehouse_stock_full_sync():
    """
    Full-catalog sync stok Gudang PM/EPD/FG dari data resmi Accurate
    (item/detail.do -> detailWarehouseData), menggantikan/melengkapi
    pendekatan EJO processHistory yang sebelumnya hanya menjangkau
    EPD/FG. Ini SNAPSHOT (replace qty), bukan kumulatif. Manual trigger,
    scan seluruh katalog (~1594 item), makan waktu 15-25 menit.
    """
    try:
        from utils.accurate_ejo_check import sync_warehouse_stock_from_item_detail
        client = AccurateClient()
        result = sync_warehouse_stock_from_item_detail(client)
        return success_response('accurate.warehouse_full_sync_done', data=result), 200
    except Exception as e:
        db.session.rollback()
        return error_response('accurate.warehouse_full_sync_error', details=str(e)), 500


@accurate_bp.route('/warehouse-unmatched-suggestions', methods=['GET'])
@jwt_required()
def get_warehouse_unmatched_suggestions():
    """
    Kandidat produk mirip di Internal ERP untuk sebuah nama item Accurate
    yang belum tersinkron (dari daftar unmatched di tab Gudang EPD/FG).
    Informasional saja -- tidak membuat mapping otomatis, user
    menyesuaikan penamaan secara manual di sistem terkait.
    Query param: item_name (wajib).
    """
    try:
        from utils.accurate_ejo_check import _find_similar_smith_products
        item_name = request.args.get('item_name')
        if not item_name:
            return error_response('accurate.item_name_required'), 400

        result = _find_similar_smith_products(item_name)
        return success_response('accurate.warehouse_unmatched_suggestions_fetched', data=result), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500


@accurate_bp.route('/warehouse-stock-detail', methods=['GET'])
@jwt_required()
def get_warehouse_stock_detail_endpoint():
    """
    Detail lengkap kontribusi stok sebuah produk di Gudang EPD/FG: daftar
    semua EJO yang tercatat, dengan Mesin/Operator/Shift, untuk kroscek
    dan audit oleh siapa pun (bukan cuma yang menjalankan sync).
    Query params: product_id (wajib), location (wajib, 'epd' atau 'fg').
    """
    try:
        from utils.accurate_ejo_check import get_warehouse_stock_detail
        product_id = request.args.get('product_id', type=int)
        location = request.args.get('location')
        if not product_id or location not in ('epd', 'fg'):
            return error_response('accurate.warehouse_detail_params_required'), 400

        location_id = 5 if location == 'epd' else 3
        result = get_warehouse_stock_detail(product_id, location_id)
        return success_response('accurate.warehouse_stock_detail_fetched', data=result), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500


@accurate_bp.route('/warehouse-stock-summary', methods=['GET'])
@jwt_required()
def get_warehouse_stock_summary_endpoint():
    """
    Ringkasan stok Gudang EPD dan FG saat ini (hasil sync EJO), untuk
    ditampilkan di UI.
    """
    try:
        from utils.accurate_ejo_check import get_warehouse_stock_summary
        result = get_warehouse_stock_summary()
        return success_response('accurate.warehouse_stock_summary_fetched', data=result), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500


@accurate_bp.route('/ejo-warehouse-sync', methods=['POST'])
@jwt_required()
def trigger_ejo_warehouse_sync():
    """
    Scan EJO Accurate terbaru dan sinkronkan stok Gudang EPD dan FG di
    Internal ERP berdasarkan processHistory (MS -> EPD, FGS -> FG).
    Kumulatif/historis (bukan snapshot) -- qty EPD tidak dikurangi saat
    batch naik ke FG. Manual trigger, aman dijalankan berulang (skip
    EJO+tahap yang sudah pernah disync).
    """
    try:
        from utils.accurate_ejo_check import sync_ejo_warehouse_stock
        client = AccurateClient()
        result = sync_ejo_warehouse_stock(client)
        return success_response('accurate.ejo_warehouse_sync_done', data=result), 200
    except Exception as e:
        db.session.rollback()
        return error_response('accurate.ejo_warehouse_sync_error', details=str(e)), 500


@accurate_bp.route('/smith-work-orders-by-product', methods=['GET'])
@jwt_required()
def get_smith_work_orders_by_product():
    """
    Daftar WO Internal ERP untuk sebuah product_id, dipakai UI pemilihan
    manual saat kandidat produk mirip dipilih (exact-match gagal di
    check_ejo). Query param: product_id (wajib), reference_date (opsional,
    format YYYY-MM-DD, untuk mengurutkan berdasarkan kedekatan tanggal).
    """
    try:
        from utils.accurate_ejo_check import list_smith_work_orders_for_product
        from datetime import datetime

        product_id = request.args.get('product_id', type=int)
        if not product_id:
            return error_response('accurate.product_id_required'), 400

        reference_date = None
        ref_str = request.args.get('reference_date')
        if ref_str:
            try:
                reference_date = datetime.strptime(ref_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        result = list_smith_work_orders_for_product(product_id, reference_date=reference_date)
        return success_response('accurate.smith_wo_by_product_fetched', data=result), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500


@accurate_bp.route('/ejo-check', methods=['POST'])
@jwt_required()
def check_ejo_number():
    """
    Kroscek hasil produksi: input nomor EJO (Perintah Kerja Accurate),
    ambil ringkasan, breakdown bahan bertingkat (Barang Jadi -> WIP ->
    Mixing, rekursif), histori tahap gudang (EPD -> FG), dan cocokkan
    ke WO SMITH terkait (by produk + tanggal selesai) untuk diff.
    """
    try:
        from utils.accurate_ejo_check import check_ejo
        data = request.get_json() or {}
        ejo_number = (data.get('ejo_number') or '').strip()
        accurate_id = data.get('accurate_id')
        if not ejo_number:
            return error_response('accurate.ejo_number_required'), 400

        client = AccurateClient()
        result = check_ejo(client, ejo_number, accurate_id=accurate_id)
        return success_response('accurate.ejo_check_done', data=result), 200
    except Exception as e:
        return error_response('accurate.ejo_check_error', details=str(e)), 500


# ================= SALES =================
@accurate_bp.route('/sales-invoices', methods=['GET'])
@jwt_required()
def get_accurate_sales_invoices():
    try:
        client = AccurateClient()
        data = client.fetch_sales_invoices()
        return success_response('accurate.sales_invoices_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/sales-orders', methods=['GET'])
@jwt_required()
def get_accurate_sales_orders():
    try:
        client = AccurateClient()
        data = client.fetch_sales_orders()
        return success_response('accurate.sales_orders_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/customers', methods=['GET'])
@jwt_required()
def get_accurate_customers():
    try:
        client = AccurateClient()
        data = client.fetch_customers()
        return success_response('accurate.customers_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

# ================= PURCHASING =================
@accurate_bp.route('/purchase-invoices', methods=['GET'])
@jwt_required()
def get_accurate_purchase_invoices():
    try:
        client = AccurateClient()
        data = client.fetch_purchase_invoices()
        return success_response('accurate.purchase_invoices_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/purchase-orders', methods=['GET'])
@jwt_required()
def get_accurate_purchase_orders():
    try:
        client = AccurateClient()
        data = client.fetch_purchase_orders()
        return success_response('accurate.purchase_orders_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/vendors', methods=['GET'])
@jwt_required()
def get_accurate_vendors():
    try:
        client = AccurateClient()
        data = client.fetch_vendors()
        return success_response('accurate.vendors_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

# ================= FINANCE =================
@accurate_bp.route('/bank-transfers', methods=['GET'])
@jwt_required()
def get_accurate_bank_transfers():
    try:
        client = AccurateClient()
        data = client.fetch_bank_transfers()
        return success_response('accurate.bank_transfers_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/expenses', methods=['GET'])
@jwt_required()
def get_accurate_expenses():
    try:
        client = AccurateClient()
        data = client.fetch_expenses()
        return success_response('accurate.expenses_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

# ================= ACCOUNTING =================
@accurate_bp.route('/gl-accounts', methods=['GET'])
@jwt_required()
def get_accurate_gl_accounts():
    try:
        client = AccurateClient()
        data = client.fetch_gl_accounts()
        return success_response('accurate.gl_accounts_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/journal-vouchers', methods=['GET'])
@jwt_required()
def get_accurate_journal_vouchers():
    try:
        client = AccurateClient()
        data = client.fetch_journal_vouchers()
        return success_response('accurate.journal_vouchers_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

# ================= MANUFACTURING / BOM =================
@accurate_bp.route('/bills-of-material', methods=['GET'])
@jwt_required()
def get_accurate_bills_of_material():
    try:
        client = AccurateClient()
        data = client.fetch_bills_of_material()
        return success_response('accurate.boms_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

# ================= DETAIL ENDPOINTS =================
@accurate_bp.route('/item-detail/<path:no>', methods=['GET'])
@jwt_required()
def get_accurate_item_detail(no):
    try:
        client = AccurateClient()
        data = client.fetch_item_detail(no)
        return success_response('accurate.detail_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/vendor-detail/<path:no>', methods=['GET'])
@jwt_required()
def get_accurate_vendor_detail(no):
    try:
        client = AccurateClient()
        data = client.fetch_vendor_detail(no)
        return success_response('accurate.detail_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/customer-detail/<path:no>', methods=['GET'])
@jwt_required()
def get_accurate_customer_detail(no):
    try:
        client = AccurateClient()
        data = client.fetch_customer_detail(no)
        return success_response('accurate.detail_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/gl-account-detail/<path:no>', methods=['GET'])
@jwt_required()
def get_accurate_gl_account_detail(no):
    try:
        client = AccurateClient()
        data = client.fetch_gl_account_detail(no)
        return success_response('accurate.detail_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/sales-invoice-detail/<path:number>', methods=['GET'])
@jwt_required()
def get_accurate_sales_invoice_detail(number):
    try:
        client = AccurateClient()
        data = client.fetch_sales_invoice_detail(number)
        return success_response('accurate.detail_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/sales-order-detail/<path:number>', methods=['GET'])
@jwt_required()
def get_accurate_sales_order_detail(number):
    try:
        client = AccurateClient()
        data = client.fetch_sales_order_detail(number)
        return success_response('accurate.detail_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/purchase-invoice-detail/<path:number>', methods=['GET'])
@jwt_required()
def get_accurate_purchase_invoice_detail(number):
    try:
        client = AccurateClient()
        data = client.fetch_purchase_invoice_detail(number)
        return success_response('accurate.detail_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/purchase-order-detail/<path:number>', methods=['GET'])
@jwt_required()
def get_accurate_purchase_order_detail(number):
    try:
        client = AccurateClient()
        data = client.fetch_purchase_order_detail(number)
        return success_response('accurate.detail_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/bank-transfer-detail/<path:number>', methods=['GET'])
@jwt_required()
def get_accurate_bank_transfer_detail(number):
    try:
        client = AccurateClient()
        data = client.fetch_bank_transfer_detail(number)
        return success_response('accurate.detail_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/journal-voucher-detail/<path:number>', methods=['GET'])
@jwt_required()
def get_accurate_journal_voucher_detail(number):
    try:
        client = AccurateClient()
        data = client.fetch_journal_voucher_detail(number)
        return success_response('accurate.detail_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500

@accurate_bp.route('/bill-of-material-detail/<path:number>', methods=['GET'])
@jwt_required()
def get_accurate_bill_of_material_detail(number):
    try:
        client = AccurateClient()
        data = client.fetch_bill_of_material_detail(number)
        return success_response('accurate.detail_fetched', data=data), 200
    except Exception as e:
        return error_response('accurate.fetch_error', details=str(e)), 500
