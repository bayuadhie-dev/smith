"""
config.py - Semua konfigurasi agent monitoring PM2 (error watcher + notifikasi WA).

=== CARA JALANKAN ===
1. Install dependency:  pip install -r requirements.txt
2. Set ANTHROPIC_API_KEY + config OpenWA (lihat "# TODO: WAJIB DISESUAIKAN"
   di bawah) - atau isi lewat frontend agent-dashboard setelah agent jalan
   (tersimpan di SQLite, lihat state.py, langsung aktif tanpa restart).
3. Jalankan langsung untuk tes: python main.py
4. Buka agent-dashboard > tab "Sumber Log", centang app PM2 mana saja yang
   mau dipantau - TIDAK PERLU diisi manual di sini, agent otomatis scan
   `pm2 jlist` dan menampilkan semua app PM2 yang ada (lihat pm2_discovery.py).
5. Daftarkan ke PM2 (proses terpisah dari app lain yang dipantau):
       pm2 start main.py --name agent-monitor --interpreter python3

=== ENV VAR YANG DIKENALI ===
  ANTHROPIC_API_KEY          - default, bisa dioverride dari frontend (SQLite config)
  OPENWA_BASE_URL            - default, bisa dioverride dari frontend (SQLite config)
  OPENWA_API_KEY             - default, bisa dioverride dari frontend (SQLite config)
  OPENWA_TARGET_PHONE        - default, bisa dioverride dari frontend (SQLite config)
  OPENWA_SESSION_ID_OVERRIDE - opsional, hanya kalau ada >1 sesi OpenWA READY
  AGENT_PUBLIC_CALLBACK_URL  - URL webhook yang didaftarkan ke OpenWA (default: localhost)
  AGENT_WEBHOOK_PORT         - port Flask utk webhook + API frontend (default: 4500)

Daftar app PM2 yang dipantau BUKAN environment variable lagi (dulu
PM2_APP_BACKEND/PM2_APP_FRONTEND, 2 slot tetap) - sekarang dipilih dari
agent-dashboard dan disimpan di SQLite (state.py, key monitored_pm2_apps),
karena app PM2 yang perlu dipantau bisa lebih dari 2 dan bisa berubah-ubah
tanpa perlu redeploy agent ini. Lihat pm2_discovery.py + watcher.py.
"""
import os
from pathlib import Path

AGENT_DIR = Path(__file__).parent

# =============================================================================
# TODO: WAJIB DISESUAIKAN - Detail koneksi OpenWA.
# BUKAN LAGI ASUMSI - ini bentuk request/response NYATA dari gateway OpenWA
# (NestJS) yang sudah ada di scripts/OpenWA/ repo ini, dikonfirmasi dari 2
# sumber: (1) scripts/OpenWA/src/modules/message/message.controller.ts +
# dto/send-message.dto.ts, (2) backend/utils/production_notifications.py yang
# SUDAH memanggilnya untuk notifikasi WO selesai.
#
# session ID dan pendaftaran webhook TIDAK PERLU diisi manual lagi
# (lihat openwa_client.py, ditambahkan setelah user bertanya "harus manual
# semua ya?") - agent ini otomatis:
#   1. GET {OPENWA_BASE_URL}/sessions saat startup, pilih sesi berstatus
#      READY (kalau PERSIS SATU yang READY - kalau nol/lebih dari satu,
#      gagal dengan pesan jelas di agent_activity.log, isi
#      openwa_session_id_override lewat agent-dashboard untuk override manual)
#   2. Daftarkan webhook /webhook/wa ke sesi itu (idempotent - cek dulu
#      apakah sudah terdaftar sebelum POST lagi, supaya restart PM2
#      berulang tidak numpuk webhook duplikat)
# Yang TETAP wajib manual (bukan sesuatu yang bisa/pantas diotomatiskan):
#   - OPENWA_BASE_URL + OPENWA_API_KEY di bawah (kredensial, tidak bisa ditebak)
#   - Sesi WhatsApp itu sendiri harus SUDAH connected/READY (scan QR sekali
#     lewat dashboard OpenWA, scripts/OpenWA/dashboard/) SEBELUM agent ini
#     start - agent tidak bisa membuat sesi baru atau scan QR untuk Anda.
#
# Detail request/response kirim pesan (untuk referensi, sudah di-encode di
# openwa_client.py/wa_notify.py, tidak perlu diketik ulang manual):
#   POST {OPENWA_BASE_URL}/sessions/<sessionId>/messages/send-text
#   Header: X-API-Key: <OPENWA_API_KEY>
#   Body: {"chatId": "62812xxxx@c.us", "text": "..."}
#   Sukses = HTTP 201, body respons: {"messageId": "...", "timestamp": ...}
#
# Backend ERP internal sendiri sudah punya setting yang mirip
# (notifications.whatsapp_api_url / notifications.whatsapp_token di
# backend/routes/config_manager.py) - TAPI agent ini sengaja punya config
# SENDIRI (SQLite terpisah, dikonfirmasi user) supaya tidak perlu akses ke
# DB utama ERP internal. Boleh isi base URL/token YANG SAMA kalau mau pakai
# gateway OpenWA yang sama dengan notifikasi WO.
# =============================================================================
OPENWA_BASE_URL_DEFAULT = os.environ.get("OPENWA_BASE_URL", "")  # TODO: WAJIB DIISI - http://host:port (TANPA /sessions/... di belakang)
OPENWA_API_KEY_DEFAULT = os.environ.get("OPENWA_API_KEY", "")  # TODO: WAJIB DIISI - nilai X-API-Key
OPENWA_TARGET_PHONE_DEFAULT = os.environ.get("OPENWA_TARGET_PHONE", "")  # TODO: WAJIB DIISI - nomor digit saja (boleh diawali 0 atau 62), dikonversi otomatis ke format 62xxxx@c.us saat kirim
OPENWA_SESSION_ID_OVERRIDE_DEFAULT = os.environ.get("OPENWA_SESSION_ID_OVERRIDE", "")  # opsional - isi HANYA kalau ada >1 sesi READY sekaligus (auto-discovery tidak bisa menebak mana yang dimaksud)

# URL yang didaftarkan ke OpenWA sebagai webhook penerima balasan (poin 2
# auto-setup di atas). Default menganggap OpenWA & agent ini jalan di mesin
# yang sama (localhost tetap reachable satu sama lain). TODO: WAJIB DIISI
# manual via env var kalau OpenWA gateway jalan di MESIN LAIN - localhost
# dari sudut pandang OpenWA bukan mesin agent ini.
AGENT_PUBLIC_CALLBACK_URL = os.environ.get(
    "AGENT_PUBLIC_CALLBACK_URL", f"http://localhost:{os.environ.get('AGENT_WEBHOOK_PORT', '4500')}/webhook/wa"
)

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
        "openwa_api_key": state.get_config("openwa_api_key") or OPENWA_API_KEY_DEFAULT,
        "openwa_target_phone": state.get_config("openwa_target_phone") or OPENWA_TARGET_PHONE_DEFAULT,
        "openwa_session_id_override": state.get_config("openwa_session_id_override") or OPENWA_SESSION_ID_OVERRIDE_DEFAULT,
    }
