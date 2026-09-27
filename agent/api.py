"""
api.py - Flask route untuk agent-dashboard (frontend): histori error + config.

PENTING (spek poin 8): endpoint histori TIDAK PERNAH bergantung ke API key
yang sedang aktif - data histori (termasuk hasil diagnosis) sudah permanen
tersimpan di tabel `errors` sejak error itu didiagnosis, lepas dari config
saat ini. Ganti/rotate API key kapan pun tidak mempengaruhi histori lama.

Config endpoint (GET/POST /api/config) sengaja TIDAK PERNAH mengembalikan
nilai penuh dari anthropic_api_key yang sudah tersimpan (hanya beberapa
karakter terakhir untuk konfirmasi visual "sudah keisi") - supaya frontend
tidak perlu handle nilai sensitif di response GET, walau frontend ini
sendiri belum ada auth (lihat TODO auth di bawah).
"""
from flask import Blueprint, request, jsonify

import state

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.route("/errors", methods=["GET"])
def list_errors():
    status = request.args.get("status")  # waiting | approved | declined
    risk_level = request.args.get("risk_level")  # HIGH | MEDIUM | LOW
    rows = state.list_errors(status=status, risk_level=risk_level)
    return jsonify({"errors": rows}), 200


@api_bp.route("/errors/<error_id>", methods=["GET"])
def get_error_detail(error_id):
    row = state.get_error(error_id)
    if not row:
        return jsonify({"error": "Tidak ditemukan"}), 404
    return jsonify({"error": row}), 200


def _mask(value: str) -> str:
    if not value:
        return "(belum diisi)"
    return f"...{value[-4:]}" if len(value) > 4 else "***"


@api_bp.route("/config", methods=["GET"])
def get_config_route():
    all_config = state.get_all_config()
    api_key = all_config.get("anthropic_api_key", "")
    openwa_api_key = all_config.get("openwa_api_key", "")
    return jsonify({
        "anthropic_api_key_masked": _mask(api_key),
        "anthropic_api_key_set": bool(api_key),
        "openwa_send_url": all_config.get("openwa_send_url", ""),
        "openwa_api_key_masked": _mask(openwa_api_key),
        "openwa_api_key_set": bool(openwa_api_key),
        "openwa_target_phone": all_config.get("openwa_target_phone", ""),
    }), 200


@api_bp.route("/config", methods=["POST"])
def set_config_route():
    # TODO: WAJIB DITAMBAHKAN sebelum diakses dari luar jaringan kantor -
    # endpoint ini menyimpan/mengubah kredensial (API key) TANPA autentikasi
    # sama sekali saat ini (asumsi eksplisit spek: hanya user sendiri yang
    # akses di jaringan internal/local). Tambahkan minimal API key statis di
    # header atau login sebelum agent-dashboard bisa diakses dari luar.
    data = request.get_json(silent=True) or {}
    if data.get("anthropic_api_key"):
        state.set_config("anthropic_api_key", data["anthropic_api_key"])
    if "openwa_send_url" in data:
        state.set_config("openwa_send_url", data["openwa_send_url"])
    if data.get("openwa_api_key"):
        state.set_config("openwa_api_key", data["openwa_api_key"])
    if "openwa_target_phone" in data:
        state.set_config("openwa_target_phone", data["openwa_target_phone"])
    return jsonify({"status": "saved"}), 200
