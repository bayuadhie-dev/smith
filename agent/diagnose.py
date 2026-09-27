"""
diagnose.py - Panggil Claude API untuk mendiagnosis error yang terdeteksi.

Sengaja HANYA mengirim teks log (traceback + beberapa baris konteks) ke
Claude API, TIDAK membaca/mengirim isi file source project (dikonfirmasi
user): agent ini tidak butuh akses baca ke repo SMITH ERP sama sekali,
lebih aman untuk dijalankan sebagai proses terpisah, dan lebih murah dari
sisi token. Konsekuensinya, "file yang kemungkinan bermasalah" dalam hasil
diagnosis adalah TEBAKAN dari traceback (nama file yang muncul di
Traceback), bukan hasil analisis membaca isi file tersebut - confidence
level di response mencerminkan keterbatasan ini.

TIDAK PERNAH mengubah kode - lihat main.py/apply_fix() untuk alasan
kenapa apply fix sengaja jadi placeholder manual, bukan otomatis di sini.
"""
import json
import re

import config

DIAGNOSIS_SYSTEM_PROMPT = """Kamu adalah asisten diagnosis error untuk sebuah aplikasi ERP produksi \
(backend Flask/Python, frontend React/TypeScript). Kamu HANYA menerima potongan log (traceback + \
beberapa baris konteks sebelum/sesudahnya) - kamu TIDAK punya akses ke isi source code project.

Tugasmu: diagnosis singkat dari log yang diberikan, lalu balas HANYA dengan JSON valid \
(tanpa markdown code fence, tanpa teks lain di luar JSON) dengan struktur persis berikut:

{
  "cause": "penyebab singkat dalam 1-2 kalimat Bahasa Indonesia",
  "file_hint": "nama file yang kemungkinan bermasalah, berdasarkan traceback (atau null kalau tidak jelas)",
  "fix_suggestion": "usulan fix singkat - deskripsi, boleh sertakan potongan diff/code kalau relevan",
  "confidence": "low" | "medium" | "high"
}

Confidence WAJIB "low" kalau kamu hanya menebak dari nama file/traceback tanpa benar-benar tahu isi \
kode di sekitarnya - jangan overconfident. Jangan sertakan penjelasan di luar JSON."""


def _extract_json(text: str) -> dict:
    """Claude kadang tetap membungkus JSON dalam ```json ... ``` walau sudah
    diminta tidak - coba parse langsung dulu, fallback strip code fence."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def diagnose_error(log_context: str, risk_level: str, risk_reason: str, source_app: str) -> dict:
    """Return dict: {cause, file_hint, fix_suggestion, confidence, raw_json}.
    Melempar exception kalau API call gagal - caller (watcher.py) yang
    memutuskan mau retry/skip/tetap kirim notifikasi tanpa hasil diagnosis."""
    import anthropic  # import lokal - biar config.py tetap bisa di-import tanpa dependency ini terpasang saat hanya butuh baca config

    effective = config.get_effective_config()
    api_key = effective["anthropic_api_key"]
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY belum diset (env var atau lewat frontend agent-dashboard > Konfigurasi)"
        )

    client = anthropic.Anthropic(api_key=api_key)

    user_prompt = f"""Aplikasi: SMITH ERP - {source_app}
Risk level (sudah ditentukan sistem, bukan tugasmu menilai ulang): {risk_level} ({risk_reason})

Log (traceback + konteks sekitarnya):
```
{log_context}
```

Diagnosis sesuai format JSON yang diminta."""

    response = client.messages.create(
        model=config.ANTHROPIC_MODEL,
        max_tokens=1024,
        system=DIAGNOSIS_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw_text = "".join(block.text for block in response.content if hasattr(block, "text"))
    parsed = _extract_json(raw_text)

    return {
        "cause": parsed.get("cause", ""),
        "file_hint": parsed.get("file_hint"),
        "fix_suggestion": parsed.get("fix_suggestion", ""),
        "confidence": parsed.get("confidence", "low"),
        "raw_json": raw_text,
    }
