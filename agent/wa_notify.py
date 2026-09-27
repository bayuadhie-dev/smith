"""
wa_notify.py - Format & kirim notifikasi error ke WhatsApp lewat OpenWA.

# TODO: WAJIB DISESUAIKAN - endpoint & payload OpenWA di bawah adalah ASUMSI
# dari dokumentasi open-wa/wa-automate yang paling umum:
#   POST {base_url}{send_path}   body: {"phone": "<nomor>@c.us", "text": "<pesan>"}
# Response yang diasumsikan mengandung message ID terkirim di salah satu dari:
#   response.json()["id"], response.json()["response"]["id"], atau
#   response.json()["messageId"] - kode di bawah mencoba ketiganya.
# CEK ULANG dokumentasi versi OpenWA Anda dan sesuaikan _send_raw() di bawah
# kalau field/path-nya berbeda.
"""
import requests

import config
import state

RISK_EMOJI = {"HIGH": "🔴", "MEDIUM": "🟡", "LOW": "🟢"}


def format_message(error_row: dict) -> str:
    emoji = RISK_EMOJI.get(error_row["risk_level"], "🟡")
    lines = [
        f"{emoji} *{error_row['risk_level']}* - {error_row['id']}",
        f"_{error_row['risk_reason']}_",
        "",
        f"🕐 {error_row['detected_at']} WIB",
        f"📦 App: {error_row['source_app']}",
    ]
    if error_row.get("occurrence_count", 1) > 1:
        lines.append(f"🔁 Muncul {error_row['occurrence_count']}x")
    lines.append("")
    if error_row.get("diagnosis_cause"):
        lines.append(f"*Penyebab:* {error_row['diagnosis_cause']}")
    if error_row.get("diagnosis_file"):
        lines.append(f"*File:* {error_row['diagnosis_file']}")
    if error_row.get("diagnosis_fix"):
        lines.append(f"*Usulan fix:* {error_row['diagnosis_fix']}")

    # Risk HIGH: sedikit friksi ekstra (spek poin 6) - ringkasan dampak lebih
    # detail, tapi mekanisme approve/skip TETAP SAMA (reply "ok"/"skip"), jadi
    # bukan blocking confirmation tambahan, cuma info tambahan di body pesan.
    if error_row["risk_level"] == "HIGH":
        lines.append("")
        lines.append("⚠️ *Ini error HIGH - kemungkinan user tidak bisa lanjut kerja sampai di-fix.*")

    lines.append("")
    lines.append('Balas *"ok"* untuk approve fix, atau *"skip"* untuk simpan ke backlog.')
    return "\n".join(lines)


def _send_raw(text: str) -> str | None:
    """Kirim pesan mentah, return message ID kalau berhasil, None kalau gagal
    (gagal kirim WA TIDAK BOLEH menghentikan agent - error tetap tersimpan
    di SQLite dan bisa dilihat lewat agent-dashboard walau WA gagal)."""
    effective = config.get_effective_config()
    base_url = effective["openwa_base_url"]
    target = effective["openwa_target_number"]

    if not base_url or not target:
        _log_activity("wa_notify: base_url/target_number belum diset, notifikasi WA dilewati")
        return None

    url = base_url.rstrip("/") + config.OPENWA_SEND_ENDPOINT_PATH
    try:
        resp = requests.post(
            url,
            json={"phone": target, "text": text},  # TODO: WAJIB DISESUAIKAN - nama field body sesuai versi OpenWA Anda
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        message_id = (
            data.get("id")
            or (data.get("response") or {}).get("id")
            or data.get("messageId")
        )
        return message_id
    except Exception as e:
        _log_activity(f"wa_notify: GAGAL kirim pesan - {e}")
        return None


def notify_error(error_id: str):
    """Format & kirim notifikasi untuk satu error, simpan wa_message_id ke SQLite
    supaya webhook balasan bisa dicocokkan lewat reply-to-message."""
    error_row = state.get_error(error_id)
    if not error_row:
        return
    text = format_message(error_row)
    message_id = _send_raw(text)
    if message_id:
        state.set_wa_message_id(error_id, message_id)
        _log_activity(f"wa_notify: notifikasi terkirim untuk {error_id} (wa_message_id={message_id})")
    else:
        _log_activity(f"wa_notify: notifikasi TIDAK terkirim untuk {error_id} (lihat error di atas)")


def send_plain(text: str):
    """Untuk pesan klarifikasi (bukan notifikasi error baru), mis. saat
    balasan 'ok'/'skip' tidak bisa dicocokkan ke error manapun."""
    _send_raw(text)


def _log_activity(message: str):
    # Import lokal untuk hindari circular import (activity_log juga dipakai watcher.py dkk)
    from activity_log import log_activity

    log_activity(message)
