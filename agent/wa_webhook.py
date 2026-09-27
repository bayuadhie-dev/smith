"""
wa_webhook.py - Terima balasan WhatsApp (approve/skip) dari OpenWA webhook.

Bentuk payload di bawah SUDAH DIVERIFIKASI dari kode nyata gateway OpenWA
(NestJS) di scripts/OpenWA/ repo ini, bukan tebakan (dikoreksi dari draft
awal yang menebak 3 kemungkinan generik):
  - scripts/OpenWA/src/modules/webhook/webhook.service.ts (fungsi dispatch(),
    ~baris 275-390) - envelope pesan webhook:
      {"event": "message.received", "timestamp": "...", "sessionId": "...",
       "idempotencyKey": "...", "deliveryId": "...", "data": {...}}
    "data" adalah objek IncomingMessage APA ADANYA dari engine WA.
  - scripts/OpenWA/src/modules/session/session.service.ts (~baris 778) -
    field di dalam "data": teks pesan ada di `data.body`, dan kalau pesan ini
    adalah balasan/quote ke pesan lain, ada `data.quotedMessage.id` (BUKAN
    quotedMsgId, BUKAN contextInfo.quotedMessage - itu tebakan generik dari
    draft sebelumnya, sudah dikoreksi).

# TODO: WAJIB DISESUAIKAN - route "/webhook/wa" di bawah harus SAMA
# dengan URL yang didaftarkan sebagai webhook untuk sesi OpenWA yang dipakai.
# Pendaftarannya TIDAK otomatis dilakukan agent ini - lihat catatan lengkap
# di config.py bagian "Registrasi webhook balasan WA".

# TODO: OPSIONAL - webhook OpenWA bisa diberi secret (HMAC, header
# X-OpenWA-Signature) saat didaftarkan - verifikasi signature belum
# diimplementasikan di sini (webhook diterima apa adanya). Tambahkan kalau
# endpoint ini akan diekspos ke luar jaringan internal.

Spek poin 5 - reply tanpa ketik ID manual:
  - Kalau ada TEPAT SATU error berstatus 'waiting', balasan "ok"/"skip" polos
    (tanpa reply-to-message yang match) tetap diproses ke error itu.
  - Kalau ada LEBIH DARI SATU pending dan quoted-id tidak match manapun,
    kirim pesan klarifikasi, JANGAN menebak salah satu secara diam-diam.
"""
from datetime import datetime
from pathlib import Path

from flask import Blueprint, request, jsonify

import config
import state
import wa_notify
from activity_log import log_activity

wa_webhook_bp = Blueprint("wa_webhook", __name__)

# Path utama sudah diverifikasi (lihat docstring atas). Dua fallback lain
# dipertahankan untuk jaga-jaga versi OpenWA berbeda/berubah di masa depan,
# tapi TIDAK LAGI jadi tebakan utama.
_QUOTED_ID_PATHS = [
    ("quotedMessage", "id"),  # VERIFIED - lihat docstring atas
    ("quotedMsgId",),
    ("quotedMsg", "id"),
    ("contextInfo", "quotedMessage", "id"),
]


def _extract_quoted_id(payload: dict):
    for path in _QUOTED_ID_PATHS:
        value = payload
        for key in path:
            if not isinstance(value, dict):
                value = None
                break
            value = value.get(key)
        if value:
            return value
    return None


def _apply_fix(error_row: dict):
    """PLACEHOLDER - user mengisi logic detailnya nanti.

    KENAPA SENGAJA TIDAK OTOMATIS MENULIS KE FILE PRODUKSI (keputusan safety,
    bukan keterbatasan teknis): agent ini punya akses ke output Claude API
    yang hanya melihat potongan log, TANPA membaca isi file source project
    (lihat diagnose.py) - usulan fix bisa saja salah konteks, salah asumsi
    struktur kode, atau bahkan menyarankan perubahan di file yang salah kalau
    traceback menyesatkan. Menulis otomatis ke kode produksi ERP tanpa review
    manusia adalah risiko yang terlalu besar untuk sebuah sistem yang
    dipakai operasional pabrik - approve di WA berarti "saya setuju INI
    dikerjakan", bukan "tulis langsung sekarang juga tanpa saya lihat lagi".
    """
    # TODO: isi logic apply fix di sini. Beberapa opsi yang bisa dipilih nanti:
    #   - Buka PR/commit baru dengan diff dari diagnosis_fix untuk direview manual
    #   - Kirim notifikasi lanjutan berisi diff lengkap untuk di-copy manual
    #   - Trigger task terpisah (mis. lewat Claude Code sendiri) yang MASIH
    #     butuh approval eksplisit sebelum benar-benar menyentuh file
    # Untuk sekarang: hanya dicatat ke activity log, TIDAK ADA file yang disentuh.
    log_activity(f"apply_fix: placeholder dipanggil untuk {error_row['id']} - belum ada aksi nyata (lihat TODO)")


def _write_backlog(error_row: dict, reason: str):
    """Simpan error yang di-skip ke bug_backlog.md sebagai markdown checklist
    (spek poin 5) - referensi maintenance berikutnya."""
    path = Path(config.BUG_BACKLOG_PATH)
    is_new = not path.exists()
    with open(path, "a", encoding="utf-8") as f:
        if is_new:
            f.write("# Bug Backlog - Ops Agent Monitor\n\n")
            f.write("Error yang di-skip (bukan HIGH-priority saat itu, atau butuh keputusan manual).\n\n")
        f.write(f"- [ ] **{error_row['id']}** ({error_row['risk_level']}) - {error_row['source_app']}\n")
        f.write(f"  - Terdeteksi: {error_row['detected_at']} WIB\n")
        f.write(f"  - Penyebab: {error_row.get('diagnosis_cause') or '(belum ada diagnosis)'}\n")
        f.write(f"  - Alasan skip: {reason}\n")
        f.write(f"  - Di-skip pada: {datetime.now().isoformat()}\n\n")


def _handle_decision(error_row: dict, decision: str):
    if decision == "ok":
        state.set_status(error_row["id"], "approved")
        _apply_fix(error_row)
        log_activity(f"decision: {error_row['id']} DIAPPROVE oleh user")
        wa_notify.send_plain(f"✅ {error_row['id']} di-approve. (apply_fix masih placeholder - lihat TODO di wa_webhook.py)")
    elif decision == "skip":
        state.set_status(error_row["id"], "declined", decline_reason="Di-skip oleh user via WA")
        _write_backlog(error_row, reason="Di-skip oleh user via WA")
        log_activity(f"decision: {error_row['id']} DI-SKIP oleh user, disimpan ke bug_backlog.md")
        wa_notify.send_plain(f"📝 {error_row['id']} disimpan ke bug_backlog.md")


@wa_webhook_bp.route("/webhook/wa", methods=["POST"])
def receive_wa_webhook():
    envelope = request.get_json(silent=True) or {}

    # Hanya proses event message.received (spek: OpenWA webhook subscription
    # untuk sesi ini seharusnya hanya di-set ke event ini - lihat config.py -
    # tapi dicek eksplisit di sini juga untuk jaga-jaga kalau webhook yang
    # sama dipakai untuk event lain juga).
    if envelope.get("event") and envelope.get("event") != "message.received":
        return jsonify({"status": "ignored", "reason": f"event {envelope.get('event')} bukan message.received"}), 200

    # Payload asli membungkus data pesan di dalam "data" (lihat docstring
    # file ini) - fallback ke envelope itu sendiri kalau ternyata versi
    # OpenWA yang dipakai TIDAK membungkus (mengirim field pesan langsung
    # di top-level), supaya tidak diam-diam gagal parse.
    message_data = envelope.get("data") if isinstance(envelope.get("data"), dict) else envelope

    body = (message_data.get("body") or "").strip().lower()

    if body not in ("ok", "skip"):
        return jsonify({"status": "ignored", "reason": "bukan balasan ok/skip"}), 200

    quoted_id = _extract_quoted_id(message_data)
    error_row = state.get_error_by_wa_message_id(quoted_id) if quoted_id else None

    if not error_row:
        # Fallback: kalau cuma ada 1 error waiting, proses tanpa perlu match ID
        # (spek poin 5). Kalau lebih dari 1, jangan menebak.
        waiting = state.get_waiting_errors()
        if len(waiting) == 1:
            error_row = waiting[0]
        elif len(waiting) == 0:
            wa_notify.send_plain("Tidak ada error yang sedang menunggu approval saat ini.")
            return jsonify({"status": "no_pending_error"}), 200
        else:
            wa_notify.send_plain(
                f"Ada {len(waiting)} error yang masih menunggu approval. "
                "Mohon balas langsung ke (reply/quote) pesan error yang dimaksud."
            )
            return jsonify({"status": "ambiguous", "pending_count": len(waiting)}), 200

    if error_row["status"] != "waiting":
        wa_notify.send_plain(f"{error_row['id']} sudah diproses sebelumnya (status: {error_row['status']}).")
        return jsonify({"status": "already_resolved"}), 200

    _handle_decision(error_row, body)
    return jsonify({"status": "ok", "error_id": error_row["id"], "decision": body}), 200
