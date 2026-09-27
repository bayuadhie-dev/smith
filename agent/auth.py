"""
auth.py - Login password + session token untuk melindungi /api/* dan
agent-dashboard, ditambahkan setelah user minta "auth yg proper" sebelum
agent ini ditaruh di tunnel yang sama dengan ERP (jadi berpotensi diakses
dari internet, bukan cuma jaringan internal).

Desain (sengaja sederhana - satu user/password bersama, bukan sistem user
management penuh, karena ini alat operasional internal untuk satu orang):
  - Satu password (AGENT_DASHBOARD_PASSWORD di environment - TIDAK ADA
    default, kalau tidak diset maka login SELALU ditolak, bukan diam-diam
    membuka akses tanpa password).
  - POST /api/auth/login {password} -> dibandingkan pakai
    hmac.compare_digest (bukan `==`, supaya tidak bocor lewat timing
    attack) -> kalau cocok, buat token acak (secrets.token_urlsafe),
    simpan ke SQLite (state.py: tabel sessions) dengan masa berlaku
    AGENT_SESSION_TTL_HOURS (default 7 hari).
  - Token dikirim balik ke frontend, disimpan di localStorage, dikirim
    lagi sebagai header `Authorization: Bearer <token>` di setiap request
    berikutnya - divalidasi lewat @require_auth di bawah.
  - Token TIDAK di-encode/self-contained (bukan JWT) - dicek langsung ke
    tabel sessions tiap request, supaya logout benar-benar mencabut akses
    seketika (JWT stateless tidak bisa di-revoke sebelum expiry tanpa
    blocklist terpisah - untuk tool sekecil ini, cek DB langsung lebih
    simpel dan sama amannya).

/health TETAP tanpa auth (dipakai buat cek proses masih hidup, tidak
membocorkan apa-apa yang sensitif). /webhook/wa TIDAK memakai mekanisme
ini - itu punya verifikasi sendiri (HMAC signature dari OpenWA, lihat
wa_webhook.py) karena yang memanggilnya adalah OpenWA, bukan user lewat
browser.
"""
import functools
import hmac
import os
import secrets

from flask import request, jsonify

import state
from activity_log import log_activity

SESSION_TTL_HOURS = int(os.environ.get("AGENT_SESSION_TTL_HOURS", "168"))  # 7 hari


def _get_password() -> str:
    return os.environ.get("AGENT_DASHBOARD_PASSWORD", "")


def login(password: str) -> str | None:
    """Return token kalau password cocok, None kalau salah atau
    AGENT_DASHBOARD_PASSWORD belum diset sama sekali (fail-closed, bukan
    fail-open - lebih aman diam-diam menolak semua login daripada diam-diam
    menerima password kosong)."""
    expected = _get_password()
    if not expected:
        log_activity("auth: AGENT_DASHBOARD_PASSWORD belum diset di environment - semua login ditolak", level="warning")
        return None
    if not hmac.compare_digest(password or "", expected):
        return None

    token = secrets.token_urlsafe(32)
    state.create_session(token, SESSION_TTL_HOURS)
    state.cleanup_expired_sessions()  # kesempatan murah untuk beres-beres, tidak perlu cron terpisah
    return token


def logout(token: str):
    if token:
        state.delete_session(token)


def _extract_token() -> str | None:
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[len("Bearer "):].strip()
    return None


def require_auth(view_func):
    """Decorator untuk route Flask - taruh SETELAH @api_bp.route(...) seperti
    dekorator lain, urutan tidak masalah karena Flask menerapkan semua
    dekorator sebelum request masuk."""

    @functools.wraps(view_func)
    def wrapper(*args, **kwargs):
        token = _extract_token()
        if not state.is_session_valid(token):
            return jsonify({"error": "Unauthorized - login diperlukan"}), 401
        return view_func(*args, **kwargs)

    return wrapper
