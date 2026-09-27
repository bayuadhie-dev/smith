"""
risk_classifier.py - Penentuan risk level (HIGH/MEDIUM/LOW).

PENTING (spek eksplisit): logikanya berdasarkan DAMPAK, bukan lokasi modul.
Sengaja dipisah jadi satu function murni (input: teks log, output: level+alasan)
supaya gampang diedit aturannya belakangan tanpa perlu menyentuh watcher.py
atau diagnose.py sama sekali.

Cara kerja: dicek berurutan HIGH -> LOW -> fallback MEDIUM. Urutan ini sengaja:
HIGH dicek duluan supaya keyword HIGH tidak pernah "kalah" tertangkap pola LOW
yang kebetulan tumpang tindih; LOW dicek berikutnya untuk menyaring yang jelas
kosmetik; sisanya (tidak cocok pola manapun, dampaknya tidak jelas) jatuh ke
MEDIUM sebagai default aman - lebih baik terlalu sering notifikasi MEDIUM
daripada diam-diam melewatkan sesuatu yang penting.
"""
import re

# Endpoint/aksi yang kalau gagal berarti user tidak bisa menyelesaikan
# pekerjaannya (transaksi inti) - sesuai definisi HIGH di spek.
TRANSACTIONAL_ENDPOINT_PATTERNS = [
    r"/confirm", r"/submit", r"/save", r"/checkout", r"/approve",
    r"/complete", r"/post", r"/pay", r"/clock-in", r"/clock-out",
]

HIGH_PATTERNS = [
    r"\bTraceback \(most recent call last\)",
    r"\bUnhandled\w*Exception\b",
    r"\b500 Internal Server Error\b",
    r"\bOperationalError\b",
    r"\bIntegrityError\b",
    r"\bDatabaseError\b",
    r"\bdeadlock\b",
    r"\bconnection.*(refused|reset|timed out)\b.*(database|db|postgres)",
    r"\bconnection to server.*failed\b",
]

LOW_PATTERNS = [
    r"favicon\.ico.*404",
    r"\bDeprecationWarning\b",
    r"\bFutureWarning\b",
    r"^\s*console\.(warn|log)\b",
    r"\bsourcemap\b",
    r"\b404\b.*\.(png|jpg|jpeg|svg|ico|map)\b",
]


def classify(log_text: str) -> dict:
    """Return {'level': 'HIGH'|'MEDIUM'|'LOW', 'reason': str}"""
    text_lower = log_text.lower()

    # HIGH: exception tidak tertangani / DB error / endpoint transaksi gagal
    for pattern in HIGH_PATTERNS:
        if re.search(pattern, log_text, re.IGNORECASE):
            return {"level": "HIGH", "reason": f"Cocok pola exception/DB kritikal: `{pattern}`"}

    for pattern in TRANSACTIONAL_ENDPOINT_PATTERNS:
        if re.search(pattern, text_lower) and re.search(r"\berror\b|\bfail(ed)?\b|\b5\d\d\b", text_lower):
            return {
                "level": "HIGH",
                "reason": f"Error pada endpoint transaksi inti (pola `{pattern}`) - user kemungkinan tidak bisa lanjut kerja",
            }

    # LOW: kosmetik, jelas tidak mengganggu fungsi utama
    for pattern in LOW_PATTERNS:
        if re.search(pattern, log_text, re.IGNORECASE):
            return {"level": "LOW", "reason": f"Cocok pola kosmetik/non-fungsional: `{pattern}`"}

    # MEDIUM: default aman untuk apapun yang tidak jelas dampaknya
    return {"level": "MEDIUM", "reason": "Tidak cocok pola HIGH maupun LOW - dampak tidak jelas, default MEDIUM"}
