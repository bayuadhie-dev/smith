"""
watcher.py - Tail log PM2, deteksi error, klasifikasi risk, diagnosis, notifikasi WA.

Baca-dari-posisi-terakhir (spek poin 1): offset per file disimpan di SQLite
(state.py) supaya restart watcher (PM2 restart proses agent ini sendiri)
tidak baca ulang dari awal file & tidak re-trigger notifikasi untuk error lama.

Deteksi log rotation: kalau inode file berubah (PM2 log rotation biasanya
lewat modul pm2-logrotate yang me-rename lalu buat file baru, kadang juga
truncate) atau ukuran file mengecil dari offset tersimpan, offset direset
ke 0 - anggap file baru.

Loop polling (bukan inotify/watchdog library): sederhana, tidak butuh
dependency tambahan, cukup untuk interval beberapa detik (config
WATCH_POLL_INTERVAL_SECONDS) - traceback biasanya tidak butuh reaksi
sub-detik.
"""
import hashlib
import re
import threading
import time
from collections import deque
from pathlib import Path

import config
import diagnose
import risk_classifier
import state
import wa_notify
from activity_log import log_activity

# Kata kunci indikasi error (spek poin 1) - dicek per baris baru.
ERROR_LINE_PATTERN = re.compile(
    r"\b(Exception|Traceback|Error|CRITICAL|FATAL)\b|(?<!\d)5\d\d(?!\d)\s*(error|Error)?",
)

# Baris yang jelas noise/tidak relevan meski mengandung kata "error" secara
# harfiah - dicek sebelum ERROR_LINE_PATTERN supaya tidak salah trigger.
NOISE_PATTERN = re.compile(r"error_rate|error_count|errorBoundary", re.IGNORECASE)


class LogTailer:
    """Satu instance per file log yang dipantau. Menjaga rolling buffer baris
    terakhir untuk konteks 'sebelum' error, karena baris konteks bisa saja
    berasal dari pembacaan chunk sebelumnya (bukan cuma chunk saat ini)."""

    def __init__(self, path: Path, source_app: str, is_error_log: bool):
        self.path = path
        self.source_app = source_app
        self.is_error_log = is_error_log
        self.context_buffer = deque(maxlen=config.CONTEXT_LINES_BEFORE)

    def poll(self):
        if not self.path.exists():
            return

        try:
            stat = self.path.stat()
        except OSError:
            return

        offset, saved_inode = state.get_offset(self.path)
        current_inode = stat.st_ino

        if saved_inode is not None and saved_inode != current_inode:
            # File dirotasi (di-rename lalu dibuat baru) - baca dari awal file baru.
            offset = 0
        elif stat.st_size < offset:
            # File mengecil dari offset tersimpan (truncate) - baca dari awal.
            offset = 0

        if stat.st_size <= offset:
            return  # tidak ada baris baru

        with open(self.path, "r", encoding="utf-8", errors="replace") as f:
            f.seek(offset)
            new_content = f.read()
            new_offset = f.tell()

        state.set_offset(self.path, new_offset, current_inode)

        new_lines = new_content.splitlines()
        self._scan_lines(new_lines)

    def _scan_lines(self, new_lines):
        for i, line in enumerate(new_lines):
            if line.strip() and not NOISE_PATTERN.search(line) and ERROR_LINE_PATTERN.search(line):
                context_before = list(self.context_buffer)
                context_after = new_lines[i + 1 : i + 1 + config.CONTEXT_LINES_AFTER]
                full_context = "\n".join(context_before + [line] + context_after)
                handle_detected_error(
                    log_context=full_context,
                    error_line=line,
                    source_app=self.source_app,
                    log_file=str(self.path),
                )
            self.context_buffer.append(line)


def _make_signature(source_app: str, error_line: str) -> str:
    """Dedup key (dikonfirmasi user): hash dari app + baris error yang sudah
    dinormalisasi (angka/timestamp/id dibuang) supaya kemunculan berulang
    dari EXCEPTION YANG SAMA dikenali sebagai signature sama walau detail
    angkanya (mis. id request, waktu) berbeda tiap kemunculan."""
    normalized = re.sub(r"\d+", "#", error_line)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    raw = f"{source_app}:{normalized}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def handle_detected_error(log_context: str, error_line: str, source_app: str, log_file: str):
    signature = _make_signature(source_app, error_line)

    existing = state.find_waiting_by_signature(signature)
    if existing:
        # Dedup (dikonfirmasi user): signature sama & masih waiting -> jangan
        # panggil Claude API lagi / kirim WA lagi, cukup tambah counter.
        state.bump_occurrence(existing["id"])
        log_activity(f"watcher: {existing['id']} muncul lagi (signature sama, occurrence bertambah)")
        return

    risk = risk_classifier.classify(log_context)
    error_id = state.create_error(
        signature=signature,
        source_app=source_app,
        log_file=log_file,
        risk_level=risk["level"],
        risk_reason=risk["reason"],
        raw_context=log_context,
    )
    log_activity(f"watcher: error baru terdeteksi {error_id} ({risk['level']}) di {log_file}")

    try:
        result = diagnose.diagnose_error(
            log_context=log_context,
            risk_level=risk["level"],
            risk_reason=risk["reason"],
            source_app=source_app,
        )
        state.update_diagnosis(
            error_id,
            cause=result["cause"],
            file_hint=result["file_hint"],
            fix_suggestion=result["fix_suggestion"],
            confidence=result["confidence"],
            raw_json=result["raw_json"],
        )
        log_activity(f"watcher: diagnosis selesai untuk {error_id} (confidence={result['confidence']})")
    except Exception as e:
        # Diagnosis gagal (mis. API key belum diset, rate limit, dsb) TIDAK
        # BOLEH menghentikan notifikasi - user tetap perlu tahu ada error,
        # hanya tanpa hasil diagnosis Claude.
        log_activity(f"watcher: diagnosis GAGAL untuk {error_id} - {e}", level="warning")

    wa_notify.notify_error(error_id)


class Watcher:
    """Dijalankan di thread terpisah dari Flask (main.py) - lihat docstring
    main.py untuk alasan kenapa harus threading, bukan proses terpisah."""

    def __init__(self):
        self._stop_event = threading.Event()
        self._thread = None
        self.tailers = [
            LogTailer(path, source_app, is_error_log)
            for path, source_app, is_error_log in config.WATCHED_LOGS
        ]

    def start(self):
        self._thread = threading.Thread(target=self._run, name="log-watcher", daemon=False)
        self._thread.start()
        log_activity("watcher: dimulai, memantau: " + ", ".join(str(t.path) for t in self.tailers))

    def _run(self):
        while not self._stop_event.is_set():
            for tailer in self.tailers:
                try:
                    tailer.poll()
                except Exception as e:
                    log_activity(f"watcher: error saat poll {tailer.path} - {e}", level="error")
            self._stop_event.wait(config.WATCH_POLL_INTERVAL_SECONDS)
        log_activity("watcher: berhenti (graceful shutdown)")

    def stop(self, timeout=10):
        """Graceful shutdown (spek poin 7): minta loop berhenti setelah
        iterasi poll yang sedang berjalan selesai, tunggu thread benar-benar
        keluar sebelum main.py lanjut exit - offset per file sudah tersimpan
        ke SQLite di setiap poll() (bukan hanya di akhir), jadi tidak ada
        state yang hilang walau proses dihentikan paksa di tengah jalan.
        """
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=timeout)
