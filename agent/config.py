"""
config.py - Semua konfigurasi agent monitoring SMITH ERP.

=== CARA JALANKAN ===
1. Install dependency:  pip install -r requirements.txt
2. Set environment variable wajib (lihat daftar "# TODO: WAJIB DISESUAIKAN"
   di bawah) - atau isi lewat frontend agent-dashboard setelah agent jalan
   (tersimpan di SQLite, lihat state.py, langsung aktif tanpa restart).
3. Jalankan langsung untuk tes: python main.py
4. Daftarkan ke PM2 (proses ketiga, terpisah dari backend & frontend SMITH):
       pm2 start main.py --name smith-agent-monitor --interpreter python3
   Pastikan PM2 sudah punya proses `smith-backend` dan `smith-frontend`
   berjalan (atau nama lain - sesuaikan PM2_APP_BACKEND/PM2_APP_FRONTEND
   di bawah) supaya ada log yang bisa dipantau.

=== ENV VAR YANG DIKENALI ===
  ANTHROPIC_API_KEY          - default, bisa dioverride dari frontend (SQLite config)
  PM2_APP_BACKEND            - nama app PM2 untuk backend (default: smith-backend)
  PM2_APP_FRONTEND           - nama app PM2 untuk frontend (default: smith-frontend)
  PM2_LOG_BACKEND_ERROR      - override manual path *-error.log backend (opsional)
  PM2_LOG_BACKEND_OUT        - override manual path *-out.log backend (opsional)
  PM2_LOG_FRONTEND_ERROR     - override manual path *-error.log frontend (opsional)
  PM2_LOG_FRONTEND_OUT       - override manual path *-out.log frontend (opsional)
  OPENWA_BASE_URL            - default, bisa dioverride dari frontend (SQLite config)
  OPENWA_SEND_ENDPOINT_PATH  - path endpoint kirim pesan, relatif ke base URL
  OPENWA_TARGET_NUMBER       - nomor WA tujuan notifikasi (format: 62812xxxx@c.us)
  AGENT_WEBHOOK_PORT         - port Flask utk webhook + API frontend (default: 4500)
"""
import os
import subprocess
import json
from pathlib import Path

AGENT_DIR = Path(__file__).parent

# =============================================================================
# TODO: WAJIB DISESUAIKAN #1 - Nama app PM2 backend & frontend SMITH ERP.
# Harus PERSIS sama dengan nama yang muncul di `pm2 list` / `pm2 jlist`.
# =============================================================================
PM2_APP_BACKEND = os.environ.get("PM2_APP_BACKEND", "smith-backend")
PM2_APP_FRONTEND = os.environ.get("PM2_APP_FRONTEND", "smith-frontend")

# Default lokasi log PM2 kalau tidak dioverride & auto-discover (lihat
# discover_pm2_log_paths() di bawah) gagal/tidak dipakai.
PM2_LOG_DIR = Path(os.environ.get("PM2_HOME", str(Path.home() / ".pm2"))) / "logs"


def _default_log_paths(app_name):
    return {
        "out": PM2_LOG_DIR / f"{app_name}-out.log",
        "error": PM2_LOG_DIR / f"{app_name}-error.log",
    }


def discover_pm2_log_paths(app_name):
    """Auto-discover path log lewat `pm2 jlist` (disebut sebagai opsi robust
    di spek asli) - lebih akurat daripada hardcode ~/.pm2/logs/<app>-*.log
    karena pm2.config.js user bisa saja set out_file/error_file custom.
    Fallback ke pola default kalau pm2 tidak ada di PATH, app belum
    terdaftar, atau ada error parsing JSON apapun - jangan sampai config
    loading gagal total hanya karena PM2 belum jalan saat development."""
    try:
        result = subprocess.run(
            ["pm2", "jlist"], capture_output=True, text=True, timeout=5
        )
        procs = json.loads(result.stdout)
        for proc in procs:
            if proc.get("name") == app_name:
                pm2_env = proc.get("pm2_env", {})
                out_path = pm2_env.get("pm_out_log_path")
                error_path = pm2_env.get("pm_err_log_path")
                if out_path and error_path:
                    return {"out": Path(out_path), "error": Path(error_path)}
    except (subprocess.SubprocessError, FileNotFoundError, json.JSONDecodeError, OSError):
        pass
    return _default_log_paths(app_name)


def _resolve_log_path(env_var_name, app_name, kind):
    """Prioritas: 1) env var override manual, 2) auto-discover via pm2 jlist,
    3) pola default ~/.pm2/logs/<app>-<kind>.log"""
    override = os.environ.get(env_var_name)
    if override:
        return Path(override)
    return discover_pm2_log_paths(app_name)[kind]


BACKEND_LOG_ERROR = _resolve_log_path("PM2_LOG_BACKEND_ERROR", PM2_APP_BACKEND, "error")
BACKEND_LOG_OUT = _resolve_log_path("PM2_LOG_BACKEND_OUT", PM2_APP_BACKEND, "out")
FRONTEND_LOG_ERROR = _resolve_log_path("PM2_LOG_FRONTEND_ERROR", PM2_APP_FRONTEND, "error")
FRONTEND_LOG_OUT = _resolve_log_path("PM2_LOG_FRONTEND_OUT", PM2_APP_FRONTEND, "out")

# Daftar file yang benar-benar di-watch: (path, source_app, is_error_log).
# error.log diprioritaskan untuk deteksi tapi out.log tetap dipantau karena
# traceback Python kadang tercetak ke stdout tergantung logger yang dipakai
# (spek poin 1).
WATCHED_LOGS = [
    (BACKEND_LOG_ERROR, "backend", True),
    (BACKEND_LOG_OUT, "backend", False),
    (FRONTEND_LOG_ERROR, "frontend", True),
    (FRONTEND_LOG_OUT, "frontend", False),
]

# =============================================================================
# TODO: WAJIB DISESUAIKAN #2 - Detail koneksi OpenWA.
# Endpoint standar OpenWA BERBEDA-BEDA tergantung versi/fork yang dipakai
# (open-wa/wa-automate vs implementasi custom). Nilai di bawah ini ASUMSI
# yang paling umum dari dokumentasi open-wa - CEK ULANG dokumentasi versi
# OpenWA Anda dan sesuaikan path-nya di wa_notify.py (fungsi send_message())
# dan wa_webhook.py (parsing payload webhook).
# =============================================================================
OPENWA_BASE_URL_DEFAULT = os.environ.get("OPENWA_BASE_URL", "http://localhost:8002")
OPENWA_SEND_ENDPOINT_PATH = os.environ.get("OPENWA_SEND_ENDPOINT_PATH", "/sendText")
OPENWA_TARGET_NUMBER_DEFAULT = os.environ.get("OPENWA_TARGET_NUMBER", "")  # TODO: WAJIB DISESUAIKAN #3 - format 62812xxxx@c.us

# Anthropic API
ANTHROPIC_API_KEY_ENV_DEFAULT = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")

# Flask (webhook + API untuk agent-dashboard)
AGENT_WEBHOOK_PORT = int(os.environ.get("AGENT_WEBHOOK_PORT", "4500"))

# File-file output agent (bukan disimpan di SQLite - permintaan eksplisit
# spek: bug_backlog.md markdown & agent_activity.log log biasa)
BUG_BACKLOG_PATH = AGENT_DIR / "bug_backlog.md"
ACTIVITY_LOG_PATH = AGENT_DIR / "agent_activity.log"

# Berapa baris konteks sebelum/sesudah baris error yang dikirim ke Claude API
# untuk diagnosis (spek poin 1 & 3).
CONTEXT_LINES_BEFORE = 5
CONTEXT_LINES_AFTER = 5

# Interval polling watcher (detik) - baca file dari offset terakhir, bukan tail -f
# real-time, supaya sederhana & robust lintas platform (Linux/tanpa inotify).
WATCH_POLL_INTERVAL_SECONDS = 3


def get_effective_config():
    """Config aktif SAAT INI: SQLite (diisi dari frontend, lihat state.py)
    diprioritaskan di atas environment variable/default - ini yang membuat
    ganti API key dari frontend langsung terpakai tanpa restart proses
    (keputusan desain yang sudah dikonfirmasi user, koreksi dari draft awal
    yang minta tulis ke file .env fisik)."""
    import state  # import lokal - hindari circular import saat state.py belum init_db()

    return {
        "anthropic_api_key": state.get_config("anthropic_api_key") or ANTHROPIC_API_KEY_ENV_DEFAULT,
        "openwa_base_url": state.get_config("openwa_base_url") or OPENWA_BASE_URL_DEFAULT,
        "openwa_target_number": state.get_config("openwa_target_number") or OPENWA_TARGET_NUMBER_DEFAULT,
    }
