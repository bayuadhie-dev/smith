"""
wa_notify.py - Format & kirim notifikasi error ke WhatsApp lewat OpenWA.

Bentuk request/response di bawah ini SUDAH DIVERIFIKASI dari kode nyata
gateway OpenWA (NestJS) di scripts/OpenWA/ repo ini, bukan tebakan:
  - scripts/OpenWA/src/modules/message/message.controller.ts (route)
  - scripts/OpenWA/src/modules/message/dto/send-message.dto.ts (request/response shape)
  - backend/utils/production_notifications.py (backend SMITH ERP SUDAH
    memanggil endpoint yang sama untuk notifikasi WO selesai - pola
    header/body/response di bawah persis meniru itu)

# TODO: WAJIB DISESUAIKAN - config.OPENWA_SEND_URL_DEFAULT (atau isi lewat
# agent-dashboard > Konfigurasi) harus URL LENGKAP termasuk sessionId:
#   http://<host>:<port>/sessions/<sessionId>/messages/send-text
# Lihat penjelasan lengkap di config.py.
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


def _format_phone_to_chat_id(phone: str) -> str:
    """Sama persis dengan format_phone_to_chat_id() di
    backend/utils/production_notifications.py - disalin (bukan diimpor
    lintas project) supaya agent ini tetap berdiri sendiri tanpa dependency
    ke package backend Flask."""
    clean = "".join(filter(str.isdigit, phone))
    if clean.startswith("0"):
        clean = "62" + clean[1:]
    elif not clean.startswith("62"):
        clean = "62" + clean
    return f"{clean}@c.us"


def _send_raw(text: str) -> str | None:
    """Kirim pesan mentah, return messageId kalau berhasil, None kalau gagal
    (gagal kirim WA TIDAK BOLEH menghentikan agent - error tetap tersimpan
    di SQLite dan bisa dilihat lewat agent-dashboard walau WA gagal)."""
    effective = config.get_effective_config()
    send_url = effective["openwa_send_url"]
    api_key = effective["openwa_api_key"]
    target_phone = effective["openwa_target_phone"]

    if not send_url or not api_key or not target_phone:
        _log_activity("wa_notify: openwa_send_url/api_key/target_phone belum diset, notifikasi WA dilewati")
        return None

    chat_id = _format_phone_to_chat_id(target_phone)
    try:
        resp = requests.post(
            send_url,
            headers={"Content-Type": "application/json", "X-API-Key": api_key},
            json={"chatId": chat_id, "text": text},
            timeout=10,
        )
        if resp.status_code != 201:
            _log_activity(f"wa_notify: OpenWA mengembalikan status {resp.status_code}: {resp.text[:300]}")
            return None
        data = resp.json()
        return data.get("messageId")
    except requests.exceptions.RequestException as e:
        _log_activity(f"wa_notify: GAGAL kirim pesan - {e}")
        return None


def notify_error(error_id: str):
    """Format & kirim notifikasi untuk satu error, simpan wa_message_id ke SQLite
    supaya webhook balasan bisa dicocokkan lewat reply-to-message (quotedMessage.id)."""
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
