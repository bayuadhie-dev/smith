"""
pm2_discovery.py - Auto-discovery PROSES PM2 apa saja yang berjalan, live.

Ditambahkan setelah user bertanya "udah auto detect nama pm2nya belum?" -
sebelumnya agent ini butuh PM2_APP_BACKEND/PM2_APP_FRONTEND diisi manual
dengan asumsi tetap "cuma ada 2 app: backend & frontend". Itu asumsi yang
terlalu sempit (server bisa punya proses PM2 lain juga, nama app bisa apa
saja) - sekarang agent betul-betul scan SEMUA proses PM2 yang ada lewat
`pm2 jlist`, dan user TINGGAL PILIH dari agent-dashboard mana saja yang mau
dipantau (state.py: config key `monitored_pm2_apps`, list nama app) -
bukan lagi 2 slot tetap "backend"/"frontend".
"""
import json
import subprocess


def list_pm2_processes() -> list[dict]:
    """Return semua proses PM2 yang terdaftar, live, apa adanya:
    [{"name": ..., "pm_id": ..., "status": "online"|"stopped"|"errored"|...,
      "out_log": "...", "err_log": "...", "pid": ..., "uptime_ms": ...}]

    Return list kosong (bukan exception) kalau `pm2` tidak ada di PATH atau
    daemon PM2 belum jalan - caller (api.py) yang memutuskan cara
    menampilkan "tidak ada proses PM2 ditemukan" ke user."""
    try:
        result = subprocess.run(["pm2", "jlist"], capture_output=True, text=True, timeout=5)
        procs = json.loads(result.stdout)
    except (subprocess.SubprocessError, FileNotFoundError, json.JSONDecodeError, OSError):
        return []

    out = []
    for proc in procs:
        pm2_env = proc.get("pm2_env", {}) or {}
        out.append({
            "name": proc.get("name"),
            "pm_id": proc.get("pm_id"),
            "status": pm2_env.get("status"),
            "out_log": pm2_env.get("pm_out_log_path"),
            "err_log": pm2_env.get("pm_err_log_path"),
            "pid": proc.get("pid"),
            "uptime_ms": pm2_env.get("pm_uptime"),
            "restart_time": pm2_env.get("restart_time"),
            "cwd": pm2_env.get("pm_cwd"),
        })
    return out


def resolve_watched_logs(monitored_app_names: list[str]) -> list[tuple]:
    """Bangun daftar (path, source_app, is_error_log) untuk watcher.py, HANYA
    untuk app yang user pilih (monitored_app_names) - dipanggil ulang secara
    berkala oleh watcher (bukan sekali di config.py saat startup) supaya
    kalau user tambah/kurangi pilihan lewat dashboard, atau PM2 restart app
    dengan path log baru, perubahan itu terpakai tanpa perlu restart proses
    agent ini."""
    processes = list_pm2_processes()
    by_name = {p["name"]: p for p in processes}

    watched = []
    for app_name in monitored_app_names:
        proc = by_name.get(app_name)
        if not proc:
            continue  # app dipilih tapi sudah tidak ada di PM2 lagi (dihapus/di-rename) - skip diam-diam, bukan error
        if proc["err_log"]:
            watched.append((proc["err_log"], app_name, True))
        if proc["out_log"]:
            watched.append((proc["out_log"], app_name, False))
    return watched
