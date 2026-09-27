"""
main.py - Entry point agent monitoring SMITH ERP.

=== CARA JALANKAN ===
  Tes manual  : python main.py
  Lewat PM2   : pm2 start main.py --name smith-agent-monitor --interpreter python3
  (jalankan `pm2 save` setelah itu supaya proses ini ikut restart otomatis
  bareng backend/frontend SMITH kalau server reboot)

Lihat config.py untuk daftar lengkap environment variable, dan bagian mana
yang # TODO: WAJIB DISESUAIKAN sebelum agent ini benar-benar berguna
(endpoint OpenWA, nama app PM2 backend/frontend).

=== KENAPA WATCHER + FLASK DALAM SATU PROSES (threading, bukan 2 proses PM2) ===
Spek eksplisit: PM2 mengelola satu proses per app, dan agent ini didaftarkan
sebagai SATU proses PM2 (`smith-agent-monitor`) terpisah dari backend/
frontend SMITH yang sudah ada. Maka watcher (log tailing) dan Flask (terima
webhook WA + serve API ke agent-dashboard) harus jalan bersamaan di dalam
proses yang sama - watcher di thread terpisah, Flask di thread utama.

=== GRACEFUL SHUTDOWN ===
PM2 mengirim SIGTERM saat restart/stop proses. Ditangani di bawah supaya:
  - watcher menyelesaikan iterasi poll yang sedang berjalan (offset log
    sudah tersimpan ke SQLite di SETIAP poll, bukan cuma saat shutdown -
    lihat watcher.py - jadi tidak ada state yang benar-benar "hilang" walau
    proses mati mendadak, tapi shutdown bersih tetap lebih rapi)
  - koneksi Flask (waitress) ditutup dengan bersih, tidak connection yang
    menggantung
"""
import signal
import sys

from flask import Flask
from flask_cors import CORS

import config
import state
import openwa_client
from activity_log import log_activity
from api import api_bp
from wa_webhook import wa_webhook_bp
from watcher import Watcher


def create_app() -> Flask:
    app = Flask(__name__)
    # CORS diaktifkan luas (allow semua origin) karena agent-dashboard
    # (React+Vite, port dev berbeda) perlu fetch endpoint /api/* ini.
    # TODO: WAJIB DIPERKETAT (batasi origin) kalau agent-dashboard nanti
    # di-deploy dan diakses dari luar jaringan internal.
    CORS(app)
    app.register_blueprint(wa_webhook_bp)
    app.register_blueprint(api_bp)

    @app.route("/health", methods=["GET"])
    def health():
        return {"status": "ok"}, 200

    return app


def main():
    state.init_db()
    log_activity("main: agent monitoring SMITH ERP dimulai")

    # Auto-discover session OpenWA + daftarkan webhook balasan (openwa_client.py)
    # - best-effort, tidak boleh menggagalkan startup kalau OpenWA belum
    # siap/offline saat proses ini baru boot (urutan start PM2 antar proses
    # tidak terjamin). Gagal di sini cuma berarti notifikasi WA belum aktif
    # sampai openwa_base_url/api_key diisi atau OpenWA-nya online.
    try:
        openwa_client.auto_setup()
    except Exception as e:
        log_activity(f"main: auto_setup OpenWA gagal (non-fatal, lanjut start) - {e}", level="warning")

    watcher = Watcher()
    watcher.start()

    app = create_app()

    # waitress dipakai alih-alih app.run() bawaan Flask (dev server) karena
    # dev server single-threaded secara default - tidak cocok untuk proses
    # yang harus tetap responsif menerima webhook WA sementara watcher jalan
    # di thread lain. waitress pure-Python, ringan, tidak butuh compile
    # (beda dari gunicorn+gevent), cocok untuk dijalankan langsung lewat PM2.
    from waitress import serve

    def _graceful_shutdown(signum, frame):
        log_activity(f"main: menerima signal {signum}, memulai graceful shutdown")
        watcher.stop()
        log_activity("main: shutdown selesai")
        sys.exit(0)

    signal.signal(signal.SIGTERM, _graceful_shutdown)
    signal.signal(signal.SIGINT, _graceful_shutdown)

    log_activity(f"main: Flask (webhook + API) mendengarkan di port {config.AGENT_WEBHOOK_PORT}")
    serve(app, host="0.0.0.0", port=config.AGENT_WEBHOOK_PORT)


if __name__ == "__main__":
    main()
