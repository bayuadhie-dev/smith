"""
api.py - Flask route untuk agent-dashboard (frontend): histori error + config.

PENTING (spek poin 8): endpoint histori TIDAK PERNAH bergantung ke API key
yang sedang aktif - data histori (termasuk hasil diagnosis) sudah permanen
tersimpan di tabel `errors` sejak error itu didiagnosis, lepas dari config
saat ini. Ganti/rotate API key kapan pun tidak mempengaruhi histori lama.

Config endpoint (GET/POST /api/config) sengaja TIDAK PERNAH mengembalikan
nilai penuh dari anthropic_api_key yang sudah tersimpan (hanya beberapa
karakter terakhir untuk konfirmasi visual "sudah keisi") - supaya frontend
tidak perlu handle nilai sensitif di response GET.

Semua route di sini (kecuali /api/auth/login) dilindungi @require_auth
(auth.py) - ditambahkan setelah user minta auth proper sebelum agent ini
ditaruh di tunnel yang sama dengan ERP utama (jadi berpotensi diakses dari
internet). Lihat auth.py untuk detail mekanismenya.
"""
import json

from flask import Blueprint, request, jsonify

import pm2_discovery
import state
import openwa_client
from auth import require_auth, login as auth_login, logout as auth_logout
from activity_log import log_activity

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.route("/auth/login", methods=["POST"])
def login_route():
    data = request.get_json(silent=True) or {}
    token = auth_login(data.get("password", ""))
    if not token:
        return jsonify({"error": "Password salah"}), 401
    return jsonify({"token": token}), 200


@api_bp.route("/auth/logout", methods=["POST"])
@require_auth
def logout_route():
    header = request.headers.get("Authorization", "")
    token = header[len("Bearer "):].strip() if header.startswith("Bearer ") else None
    auth_logout(token)
    return jsonify({"status": "logged_out"}), 200


@api_bp.route("/errors", methods=["GET"])
@require_auth
def list_errors():
    status = request.args.get("status")  # waiting | approved | declined
    risk_level = request.args.get("risk_level")  # HIGH | MEDIUM | LOW
    rows = state.list_errors(status=status, risk_level=risk_level)
    return jsonify({"errors": rows}), 200


@api_bp.route("/errors/<error_id>", methods=["GET"])
@require_auth
def get_error_detail(error_id):
    row = state.get_error(error_id)
    if not row:
        return jsonify({"error": "Tidak ditemukan"}), 404
    return jsonify({"error": row}), 200


@api_bp.route("/stats", methods=["GET"])
@require_auth
def get_stats():
    """Ringkasan untuk header dashboard: jumlah per status + per risk level,
    dari SELURUH histori (bukan cuma yang lagi difilter di layar) - dipisah
    dari list_errors() supaya kartu ringkasan tetap akurat walau user lagi
    filter tabel di bawahnya ke satu status/risk tertentu."""
    all_rows = state.list_errors(limit=100000)
    stats = {
        "total": len(all_rows),
        "by_status": {"waiting": 0, "approved": 0, "declined": 0},
        "by_risk": {"HIGH": 0, "MEDIUM": 0, "LOW": 0},
        "total_occurrences": 0,
    }
    for row in all_rows:
        stats["by_status"][row["status"]] = stats["by_status"].get(row["status"], 0) + 1
        stats["by_risk"][row["risk_level"]] = stats["by_risk"].get(row["risk_level"], 0) + 1
        stats["total_occurrences"] += row.get("occurrence_count", 1)
    return jsonify(stats), 200


@api_bp.route("/pm2/processes", methods=["GET"])
@require_auth
def get_pm2_processes():
    """Live scan `pm2 jlist` (pm2_discovery.py) + tandai mana yang sedang
    dipilih untuk dipantau (state: monitored_pm2_apps) - dipanggil dashboard
    tab "Sumber Log" tiap kali dibuka, bukan sekali di startup, supaya app
    PM2 yang baru ditambahkan setelah agent jalan tetap muncul di daftar."""
    processes = pm2_discovery.list_pm2_processes()
    monitored_raw = state.get_config("monitored_pm2_apps")
    monitored = json.loads(monitored_raw) if monitored_raw else []
    for proc in processes:
        proc["monitored"] = proc["name"] in monitored
    return jsonify({"processes": processes, "pm2_available": True if processes or monitored else None}), 200


@api_bp.route("/pm2/processes", methods=["POST"])
@require_auth
def set_pm2_processes():
    """Simpan pilihan app yang mau dipantau (list nama app PM2) - watcher.py
    membaca ini ulang secara berkala (lihat REFRESH_EVERY_N_POLLS), jadi
    perubahan di sini terpakai tanpa restart proses agent."""
    data = request.get_json(silent=True) or {}
    app_names = data.get("app_names", [])
    if not isinstance(app_names, list):
        return jsonify({"error": "app_names wajib berupa array nama app"}), 400
    state.set_config("monitored_pm2_apps", json.dumps(app_names))
    log_activity(f"api: daftar app PM2 yang dipantau diperbarui: {', '.join(app_names) or '(kosong)'}")
    return jsonify({"status": "saved", "app_names": app_names}), 200


def _mask(value: str) -> str:
    if not value:
        return "(belum diisi)"
    return f"...{value[-4:]}" if len(value) > 4 else "***"


@api_bp.route("/config", methods=["GET"])
@require_auth
def get_config_route():
    all_config = state.get_all_config()
    api_key = all_config.get("anthropic_api_key", "")
    openwa_api_key = all_config.get("openwa_api_key", "")
    return jsonify({
        "anthropic_api_key_masked": _mask(api_key),
        "anthropic_api_key_set": bool(api_key),
        "openwa_base_url": all_config.get("openwa_base_url", ""),
        "openwa_api_key_masked": _mask(openwa_api_key),
        "openwa_api_key_set": bool(openwa_api_key),
        "openwa_target_phone": all_config.get("openwa_target_phone", ""),
        "openwa_session_id_override": all_config.get("openwa_session_id_override", ""),
    }), 200


@api_bp.route("/config", methods=["POST"])
@require_auth
def set_config_route():
    data = request.get_json(silent=True) or {}
    openwa_fields_changed = False
    if data.get("anthropic_api_key"):
        state.set_config("anthropic_api_key", data["anthropic_api_key"])
    if "openwa_base_url" in data:
        state.set_config("openwa_base_url", data["openwa_base_url"])
        openwa_fields_changed = True
    if data.get("openwa_api_key"):
        state.set_config("openwa_api_key", data["openwa_api_key"])
        openwa_fields_changed = True
    if "openwa_target_phone" in data:
        state.set_config("openwa_target_phone", data["openwa_target_phone"])
    if "openwa_session_id_override" in data:
        state.set_config("openwa_session_id_override", data["openwa_session_id_override"])
        openwa_fields_changed = True

    if openwa_fields_changed:
        # Base URL/API key/session override baru diisi (mungkin pertama kali,
        # lewat dashboard setelah agent sudah jalan) - coba auto-setup lagi
        # sekarang juga, jangan tunggu restart PM2 berikutnya.
        try:
            openwa_client.auto_setup(force_refresh=True)
        except Exception as e:
            log_activity(f"api: auto_setup OpenWA gagal setelah config disimpan - {e}", level="warning")

    return jsonify({"status": "saved"}), 200
