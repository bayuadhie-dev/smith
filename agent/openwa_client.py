"""
openwa_client.py - Auto-discovery session + auto-register webhook ke OpenWA.

Ditambahkan setelah user bertanya "harus manual semua ya?" - dua langkah
manual dari commit sebelumnya (cari sessionId, daftarkan webhook lewat curl)
ternyata BISA diotomatiskan karena gateway OpenWA (scripts/OpenWA/) punya
endpoint untuk keduanya:
  - GET  /sessions                    -> daftar sesi + status (session.controller.ts)
  - POST /sessions/:id/webhooks       -> daftarkan webhook (webhook.controller.ts)
  - GET  /sessions/:id/webhooks       -> daftar webhook yang sudah ada (untuk cek idempotent)

Yang TETAP tidak bisa diotomatiskan (butuh keputusan manusia): membuat sesi
WhatsApp itu sendiri (scan QR / pairing code pertama kali) - itu satu kali
saja lewat dashboard OpenWA (scripts/OpenWA/dashboard/), di luar scope agent
monitoring ini.
"""
import secrets

import requests

import config
import state
from activity_log import log_activity

_cached_session_id = None


def _headers(api_key: str) -> dict:
    return {"Content-Type": "application/json", "X-API-Key": api_key}


def resolve_session_id(base_url: str, api_key: str, force_refresh: bool = False) -> str | None:
    """Auto-discover session ID: kalau OPENWA_SESSION_ID_OVERRIDE diisi manual
    (kasus ada >1 sesi, agent tidak bisa menebak mana yang dimaksud), pakai itu.
    Selain itu, ambil GET /sessions, cari yang status READY - kalau PERSIS SATU,
    pakai itu; kalau nol atau lebih dari satu, gagal dengan pesan jelas (jangan
    menebak mana yang benar).

    Di-cache di memori proses (bukan SQLite - session bisa reconnect dengan id
    sama, tidak perlu persist lintas restart, cukup dalam 1 lifetime proses)
    supaya tidak panggil GET /sessions di setiap kirim pesan."""
    global _cached_session_id

    override = config.get_effective_config().get("openwa_session_id_override")
    if override:
        return override

    if _cached_session_id and not force_refresh:
        return _cached_session_id

    try:
        resp = requests.get(f"{base_url.rstrip('/')}/sessions", headers=_headers(api_key), timeout=10)
        resp.raise_for_status()
        sessions = resp.json()
    except Exception as e:
        log_activity(f"openwa_client: gagal GET /sessions - {e}", level="warning")
        return None

    ready = [s for s in sessions if s.get("status") == "READY"]
    if len(ready) == 1:
        _cached_session_id = ready[0]["id"]
        return _cached_session_id
    if len(ready) == 0:
        log_activity("openwa_client: tidak ada sesi OpenWA berstatus READY - buat/scan sesi dulu lewat dashboard OpenWA", level="warning")
        return None

    log_activity(
        f"openwa_client: ada {len(ready)} sesi READY ({', '.join(s['id'] for s in ready)}) - "
        "tidak bisa auto-pilih, isi openwa_session_id_override lewat agent-dashboard > Konfigurasi",
        level="warning",
    )
    return None


def build_send_url(base_url: str, session_id: str) -> str:
    return f"{base_url.rstrip('/')}/sessions/{session_id}/messages/send-text"


def _get_or_create_webhook_secret() -> str:
    """Secret HMAC dibuat SEKALI dan disimpan permanen di SQLite (bukan
    di-generate ulang tiap registrasi) - supaya webhook yang sudah terdaftar
    di OpenWA (dengan secret lama) tetap valid selama idempotent-check di
    bawah tidak re-register dengan secret baru. Dipakai wa_webhook.py untuk
    verifikasi X-OpenWA-Signature (ditambahkan setelah user minta auth
    proper sebelum di-tunnel publik - tanpa ini siapa saja yang tahu URL
    webhook bisa kirim payload "ok"/"skip" palsu dan memicu approve/skip)."""
    existing = state.get_config("openwa_webhook_secret")
    if existing:
        return existing
    new_secret = secrets.token_hex(32)
    state.set_config("openwa_webhook_secret", new_secret)
    return new_secret


def ensure_webhook_registered(base_url: str, api_key: str, session_id: str, callback_url: str):
    """Idempotent: cek dulu apakah callback_url ini sudah terdaftar untuk sesi
    ini sebelum POST webhook baru - supaya restart PM2 berkali-kali tidak
    numpuk webhook duplikat yang masing-masing akan mengirim event sendiri-
    sendiri (agent akan terima 1 balasan WA jadi N kali notifikasi)."""
    secret = _get_or_create_webhook_secret()

    try:
        resp = requests.get(
            f"{base_url.rstrip('/')}/sessions/{session_id}/webhooks",
            headers=_headers(api_key),
            timeout=10,
        )
        resp.raise_for_status()
        existing = resp.json()
        if any(w.get("url") == callback_url for w in existing):
            log_activity(f"openwa_client: webhook {callback_url} sudah terdaftar untuk sesi {session_id}, skip")
            return
    except Exception as e:
        log_activity(f"openwa_client: gagal cek webhook existing - {e}", level="warning")
        # Lanjut coba daftarkan meski gagal cek - lebih baik ada risiko duplikat
        # daripada diam-diam tidak pernah terdaftar sama sekali.

    try:
        resp = requests.post(
            f"{base_url.rstrip('/')}/sessions/{session_id}/webhooks",
            headers=_headers(api_key),
            json={"url": callback_url, "events": ["message.received"], "secret": secret},
            timeout=10,
        )
        if resp.status_code in (200, 201):
            log_activity(f"openwa_client: webhook {callback_url} terdaftar untuk sesi {session_id} (dengan HMAC secret)")
        else:
            log_activity(f"openwa_client: gagal daftarkan webhook - status {resp.status_code}: {resp.text[:300]}", level="warning")
    except Exception as e:
        log_activity(f"openwa_client: gagal daftarkan webhook - {e}", level="warning")


def auto_setup(force_refresh: bool = False):
    """Dipanggil di main.py saat startup, dan lagi dari api.py tiap kali
    field OpenWA disimpan lewat agent-dashboard (force_refresh=True supaya
    tidak kepakai cache session lama kalau base_url/override baru saja
    diganti) - best effort, TIDAK BOLEH membuat agent gagal start hanya
    karena OpenWA belum siap/offline saat boot (mis. urutan start PM2 tidak
    terjamin: agent bisa start sebelum OpenWA gateway siap). Kegagalan di
    sini hanya berarti notifikasi WA belum aktif sampai dicoba lagi saat
    kirim pesan pertama."""
    effective = config.get_effective_config()
    base_url = effective["openwa_base_url"]
    api_key = effective["openwa_api_key"]

    if not base_url or not api_key:
        log_activity("openwa_client: openwa_base_url/api_key belum diset, lewati auto-setup (isi lewat agent-dashboard > Konfigurasi)")
        return

    session_id = resolve_session_id(base_url, api_key, force_refresh=force_refresh)
    if not session_id:
        return  # sudah di-log di resolve_session_id()

    callback_url = config.AGENT_PUBLIC_CALLBACK_URL
    ensure_webhook_registered(base_url, api_key, session_id, callback_url)
