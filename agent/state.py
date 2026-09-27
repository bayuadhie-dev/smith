"""
state.py - Satu-satunya titik akses ke SQLite untuk agent monitoring.

Kenapa SQLite (bukan file JSON): permintaan eksplisit user - query filter
(status/risk_level) dan histori dari frontend lebih cepat & rapi lewat SQL
daripada parse ulang JSON tiap request, dan SQLite built-in di Python
(modul `sqlite3`) jadi tidak menambah dependency/instalasi server.

Tiga tabel:
- errors          : histori lengkap tiap error yang pernah terdeteksi (PERMANEN,
                     tidak pernah dihapus otomatis) + status approval + hasil diagnosis.
- config           : key-value store untuk ANTHROPIC_API_KEY, OpenWA base URL, dst.
                     Dipisah dari tabel errors dengan sengaja (lihat catatan poin 8
                     di bawah) supaya ganti/rotate API key TIDAK PERNAH menyentuh
                     atau mempengaruhi histori error yang sudah ada.
- watcher_offsets  : posisi baca terakhir per file log, supaya watcher tidak baca
                     ulang dari awal file tiap kali proses restart (PM2 restart,
                     crash, dsb) dan tidak re-trigger notifikasi untuk error lama.

Kenapa config di SQLite, bukan file .env fisik (koreksi dari draft awal user,
sudah dikonfirmasi user): kalau config.py hanya baca os.environ sekali saat
proses start, menulis ke .env dari frontend tidak akan terpakai sampai proses
di-restart manual lewat PM2 - mengalahkan tujuan "isi key dari frontend, langsung
kepakai". Dengan disimpan di SQLite, get_config() dipanggil ulang setiap kali mau
diagnosis, jadi key baru langsung aktif tanpa restart. Key tetap tidak pernah
ada di kode/localStorage browser - hanya lewat backend endpoint tersimpan di sini.
"""
import sqlite3
import threading
from pathlib import Path
from datetime import datetime, timezone, timedelta

DB_PATH = Path(__file__).parent / "agent_state.db"

# WIB = UTC+7, sesuai kebutuhan timestamp di pesan WA (poin 4 spek)
WIB = timezone(timedelta(hours=7))

# SQLite connections tidak thread-safe secara default kalau dipakai lintas
# thread tanpa check_same_thread=False - main.py menjalankan watcher (thread
# terpisah) + Flask (thread lain) bersamaan, jadi wajib pakai lock manual
# di setiap query supaya tidak ada race condition menulis ke file .db yang sama.
_lock = threading.Lock()


def _connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Panggil sekali di awal main.py sebelum watcher/Flask jalan."""
    with _lock:
        conn = _connect()
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS errors (
                id TEXT PRIMARY KEY,
                signature TEXT NOT NULL,
                source_app TEXT NOT NULL,
                log_file TEXT NOT NULL,
                detected_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                occurrence_count INTEGER NOT NULL DEFAULT 1,
                risk_level TEXT NOT NULL,
                risk_reason TEXT,
                raw_context TEXT NOT NULL,
                diagnosis_cause TEXT,
                diagnosis_file TEXT,
                diagnosis_fix TEXT,
                diagnosis_confidence TEXT,
                diagnosis_raw_json TEXT,
                status TEXT NOT NULL DEFAULT 'waiting',
                wa_message_id TEXT,
                decline_reason TEXT,
                resolved_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_errors_signature ON errors(signature);
            CREATE INDEX IF NOT EXISTS idx_errors_status ON errors(status);
            CREATE INDEX IF NOT EXISTS idx_errors_wa_message_id ON errors(wa_message_id);

            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS watcher_offsets (
                file_path TEXT PRIMARY KEY,
                offset INTEGER NOT NULL,
                inode INTEGER
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            """
        )
        conn.commit()
        conn.close()


def now_wib_iso():
    return datetime.now(WIB).isoformat()


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

def next_error_id():
    """Format ERR-YYYYMMDD-XXX, XXX = urutan ke-berapa hari ini (reset tiap hari)."""
    today = datetime.now(WIB).strftime("%Y%m%d")
    with _lock:
        conn = _connect()
        row = conn.execute(
            "SELECT COUNT(*) AS c FROM errors WHERE id LIKE ?", (f"ERR-{today}-%",)
        ).fetchone()
        conn.close()
    seq = (row["c"] if row else 0) + 1
    return f"ERR-{today}-{seq:03d}"


def find_waiting_by_signature(signature):
    """Dedup (dikonfirmasi user): kalau ada error dengan signature sama yang
    masih 'waiting', jangan buat entry baru - panggil bump_occurrence() saja."""
    with _lock:
        conn = _connect()
        row = conn.execute(
            "SELECT * FROM errors WHERE signature = ? AND status = 'waiting' "
            "ORDER BY detected_at DESC LIMIT 1",
            (signature,),
        ).fetchone()
        conn.close()
    return dict(row) if row else None


def bump_occurrence(error_id):
    with _lock:
        conn = _connect()
        conn.execute(
            "UPDATE errors SET occurrence_count = occurrence_count + 1, last_seen_at = ? WHERE id = ?",
            (now_wib_iso(), error_id),
        )
        conn.commit()
        conn.close()


def create_error(signature, source_app, log_file, risk_level, risk_reason, raw_context):
    error_id = next_error_id()
    ts = now_wib_iso()
    with _lock:
        conn = _connect()
        conn.execute(
            """INSERT INTO errors
               (id, signature, source_app, log_file, detected_at, last_seen_at,
                occurrence_count, risk_level, risk_reason, raw_context, status)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'waiting')""",
            (error_id, signature, source_app, log_file, ts, ts, risk_level, risk_reason, raw_context),
        )
        conn.commit()
        conn.close()
    return error_id


def update_diagnosis(error_id, cause, file_hint, fix_suggestion, confidence, raw_json):
    with _lock:
        conn = _connect()
        conn.execute(
            """UPDATE errors SET diagnosis_cause = ?, diagnosis_file = ?,
               diagnosis_fix = ?, diagnosis_confidence = ?, diagnosis_raw_json = ?
               WHERE id = ?""",
            (cause, file_hint, fix_suggestion, confidence, raw_json, error_id),
        )
        conn.commit()
        conn.close()


def set_wa_message_id(error_id, wa_message_id):
    with _lock:
        conn = _connect()
        conn.execute("UPDATE errors SET wa_message_id = ? WHERE id = ?", (wa_message_id, error_id))
        conn.commit()
        conn.close()


def get_error(error_id):
    with _lock:
        conn = _connect()
        row = conn.execute("SELECT * FROM errors WHERE id = ?", (error_id,)).fetchone()
        conn.close()
    return dict(row) if row else None


def get_error_by_wa_message_id(wa_message_id):
    with _lock:
        conn = _connect()
        row = conn.execute(
            "SELECT * FROM errors WHERE wa_message_id = ?", (wa_message_id,)
        ).fetchone()
        conn.close()
    return dict(row) if row else None


def get_waiting_errors():
    with _lock:
        conn = _connect()
        rows = conn.execute(
            "SELECT * FROM errors WHERE status = 'waiting' ORDER BY detected_at DESC"
        ).fetchall()
        conn.close()
    return [dict(r) for r in rows]


def set_status(error_id, status, decline_reason=None):
    with _lock:
        conn = _connect()
        conn.execute(
            "UPDATE errors SET status = ?, decline_reason = ?, resolved_at = ? WHERE id = ?",
            (status, decline_reason, now_wib_iso(), error_id),
        )
        conn.commit()
        conn.close()


def list_errors(status=None, risk_level=None, limit=200):
    query = "SELECT * FROM errors WHERE 1=1"
    params = []
    if status:
        query += " AND status = ?"
        params.append(status)
    if risk_level:
        query += " AND risk_level = ?"
        params.append(risk_level)
    query += " ORDER BY detected_at DESC LIMIT ?"
    params.append(limit)
    with _lock:
        conn = _connect()
        rows = conn.execute(query, params).fetchall()
        conn.close()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Config (API key, OpenWA URL, dst - lihat catatan di docstring atas file)
# ---------------------------------------------------------------------------

def get_config(key, default=None):
    with _lock:
        conn = _connect()
        row = conn.execute("SELECT value FROM config WHERE key = ?", (key,)).fetchone()
        conn.close()
    return row["value"] if row else default


def set_config(key, value):
    with _lock:
        conn = _connect()
        conn.execute(
            "INSERT INTO config (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        conn.commit()
        conn.close()


def get_all_config():
    with _lock:
        conn = _connect()
        rows = conn.execute("SELECT key, value FROM config").fetchall()
        conn.close()
    return {r["key"]: r["value"] for r in rows}


# ---------------------------------------------------------------------------
# Watcher offsets (posisi baca terakhir per file log)
# ---------------------------------------------------------------------------

def get_offset(file_path):
    with _lock:
        conn = _connect()
        row = conn.execute(
            "SELECT offset, inode FROM watcher_offsets WHERE file_path = ?", (str(file_path),)
        ).fetchone()
        conn.close()
    if row:
        return row["offset"], row["inode"]
    return 0, None


def set_offset(file_path, offset, inode):
    with _lock:
        conn = _connect()
        conn.execute(
            "INSERT INTO watcher_offsets (file_path, offset, inode) VALUES (?, ?, ?) "
            "ON CONFLICT(file_path) DO UPDATE SET offset = excluded.offset, inode = excluded.inode",
            (str(file_path), offset, inode),
        )
        conn.commit()
        conn.close()


# ---------------------------------------------------------------------------
# Sessions (dashboard/API auth - added after user asked to tunnel this
# alongside the public ERP domain, which meant the previously-open
# /api/* endpoints needed real auth before being reachable from outside
# the internal network)
# ---------------------------------------------------------------------------

def create_session(token: str, ttl_hours: int):
    now = datetime.now(WIB)
    expires = now + timedelta(hours=ttl_hours)
    with _lock:
        conn = _connect()
        conn.execute(
            "INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)",
            (token, now.isoformat(), expires.isoformat()),
        )
        conn.commit()
        conn.close()


def is_session_valid(token: str) -> bool:
    if not token:
        return False
    with _lock:
        conn = _connect()
        row = conn.execute("SELECT expires_at FROM sessions WHERE token = ?", (token,)).fetchone()
        conn.close()
    if not row:
        return False
    return datetime.fromisoformat(row["expires_at"]) > datetime.now(WIB)


def delete_session(token: str):
    with _lock:
        conn = _connect()
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()


def cleanup_expired_sessions():
    """Dipanggil sesekali (bukan tiap request - lihat auth.py) supaya tabel
    sessions tidak numpuk baris kedaluwarsa selamanya."""
    with _lock:
        conn = _connect()
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now_wib_iso(),))
        conn.commit()
        conn.close()
