"""
OCR Packing List Utilities

Logic murni untuk membaca form "STATUS PENGIRIMAN BARANG" (packing list
tulisan tangan) lewat Gemini API, merekonstruksi nomor karton, dan
menghitung Netto weight otomatis.

Diporting dari test_ocr_gemini.py (skrip standalone, sudah divalidasi
manual terhadap 2 foto asli dan 22 baris data Excel Octenic). Dibersihkan
dari bagian CLI (main(), sys.argv) -- file ini hanya berisi fungsi-fungsi
murni yang dipanggil dari route Flask produksi.

PENTING soal Netto deduction (temuan 24 Jul 2026):
- Default: SEMUA produk pakai potongan flat 0.515 kg (termasuk Wetkins,
  Octenic, dan mayoritas produk lain).
- Pengecualian disimpan di file CSV (bukan tabel DB, sesuai keputusan
  final -- lebih simpel & konsisten dengan pola config_manager.py) yang
  mendukung DUA jenis rule:
    - rule_type=pattern     -> match substring nama produk (case-insensitive)
    - rule_type=product_id  -> match ID produk spesifik
  Prioritas matching: product_id dulu (paling spesifik), baru pattern,
  baru fallback ke default 0.515.
"""

import os
import csv
import time
import json
import logging
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None


# =============================================================================
# KONFIGURASI
# =============================================================================

PROMPT = """Kamu membaca form "STATUS PENGIRIMAN BARANG" (packing list) pabrik nonwoven.
Form ini punya DUA tabel identik berdampingan (kolom kiri No 1-30, kolom kanan No 31-60),
masing-masing dengan kolom: No, Ctn/Roll #, Weight (Gross, Netto), Batch Number.

ATURAN PENTING YANG WAJIB DIIKUTI (ini konvensi tulisan tangan pabrik, bukan aturan umum):

1. GROSS WEIGHT SINGKATAN:
   Jika suatu baris Gross ditulis lengkap dengan format "X.XX" (misal "5.75"), itu nilai penuh.
   Jika baris SETELAHNYA cuma ditulis angka pendek tanpa titik (misal "75" atau "80"),
   itu SINGKATAN yang berarti sama seperti baris lengkap terakhir di ATAS-nya, hanya digit
   di belakang koma yang berubah. Contoh: baris 1 = "5.75" (lengkap), baris 2 tertulis "75"
   -> artinya 5.75. Baris 10 tertulis "80" -> artinya 5.80 (pakai digit depan dari nilai
   lengkap TERAKHIR yang muncul di atasnya, bukan selalu dari baris 1).
   Selalu output angka gross dalam bentuk lengkap (misal 5.75), JANGAN output "75" mentah.

2. BATCH NUMBER DIKELOMPOKKAN:
   Batch Number hanya ditulis SEKALI di baris pertama sebuah kolom/grup, dan berlaku untuk
   SEMUA baris di bawahnya sampai akhir tabel kolom itu (atau sampai baris lain yang punya
   Batch Number baru tertulis, jika ada). Salin nilai batch itu ke SETIAP baris dalam grup,
   jangan biarkan kosong.

3. NOMOR KARTON (Ctn/Roll #):
   Kolom ini kadang berisi angka besar (misal 5848, 5850) yang menandai AWAL urutan fisik
   karton, dan baris-baris berikutnya berisi angka kecil (1, 2, 3, ...) yang merupakan index
   lanjutan bukan nomor karton fisik yang berdiri sendiri. Output apa adanya sesuai yang
   tertulis di kertas untuk field "ctn_roll_raw" -- JANGAN mencoba menghitung ulang nomor
   karton fisik sebenarnya, itu akan ditangani terpisah oleh sistem.

4. Field SPK#, Product, Size, Quantity/Ctn, Target, Old Delivery, Status, Netto -- ABAIKAN,
   tidak perlu diekstrak.

Output HARUS berupa JSON valid saja, tanpa teks lain, dengan format:
{
  "batch_numbers_detected": ["<semua nilai batch number yang tertulis di kertas, verbatim>"],
  "rows": [
    {"no": 1, "ctn_roll_raw": "5848", "gross_kg": 5.75, "batch_number": "1112 205 26 JUL 29", "confidence": "high"},
    {"no": 2, "ctn_roll_raw": "9", "gross_kg": 5.75, "batch_number": "1112 205 26 JUL 29", "confidence": "high"},
    ...
  ],
  "flagged_rows": [<nomor baris yang tulisannya meragukan/susah dibaca, tuliskan alasannya singkat>]
}

Baca SEMUA baris dari No 1 sampai No 60 (kedua tabel kiri dan kanan). Jangan lewati baris
yang sulit dibaca -- tetap output tebakan terbaik tapi masukkan ke flagged_rows dengan
confidence "low"."""

# Model Gemini yang dipakai. Google sering update line model -- kalau ada
# error 404 NOT_FOUND, cek model mana yang aktif sekarang.
GEMINI_MODEL = "gemini-flash-latest"
MAX_RETRIES = 4

# Potongan default yang berlaku untuk SEMUA produk KECUALI yang ada di file
# aturan (lihat NETTO_DEDUCTION_CSV_PATH). Dikonfirmasi berlaku untuk
# Wetkins & Octenic dari pengecekan langsung formula Excel (24 Jul 2026).
DEFAULT_NETTO_DEDUCTION_KG = 0.515

# Path file CSV aturan potongan Netto. Format CSV:
#   rule_type,match_value,deduction_kg
#   pattern,POLYMORPH,0.862
#   product_id,383,0.862
# - rule_type=pattern: match_value adalah substring nama produk (case-insensitive)
# - rule_type=product_id: match_value adalah ID produk (integer)
# Kalau file ini tidak ada / kosong, semua produk otomatis pakai
# DEFAULT_NETTO_DEDUCTION_KG.
logger = logging.getLogger(__name__)

# Path file CSV aturan potongan Netto (Single Source of Truth: backend/product_netto_deduction.csv).
# Catatan Arsitektur:
# - Jalur Env Var (NETTO_DEDUCTION_CSV_PATH): Memerlukan fail-fast (FileNotFoundError) agar kesalahan setting konfigurasi eksplisit langsung terdeteksi.
# - Jalur Default (backend/product_netto_deduction.csv): Tidak fail-fast jika file tidak ada di disk, melainkan secara halus (gracefully) menggunakan DEFAULT_NETTO_DEDUCTION_KG (0.515 kg) untuk semua produk.
_env_csv_path = os.environ.get("NETTO_DEDUCTION_CSV_PATH")
if _env_csv_path:
    if not os.path.isfile(_env_csv_path):
        raise FileNotFoundError(
            f"NETTO_DEDUCTION_CSV_PATH di-set ke '{_env_csv_path}' tetapi file tersebut tidak ditemukan!"
        )
    NETTO_DEDUCTION_CSV_PATH = _env_csv_path
else:
    NETTO_DEDUCTION_CSV_PATH = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "product_netto_deduction.csv",
    )

logger.info("NETTO_DEDUCTION_CSV_PATH aktif: %s", NETTO_DEDUCTION_CSV_PATH)

# Direktori tempat menyimpan hasil OCR mentah untuk audit/debug.
OCR_RAW_LOG_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "logs", "ocr_packing_list",
)


# =============================================================================
# NETTO DEDUCTION (rule_type: pattern / product_id)
# =============================================================================

def load_netto_deductions(csv_path=NETTO_DEDUCTION_CSV_PATH):
    """Baca file aturan potongan Netto dari CSV.

    Return dict dengan dua key:
      {
        "patterns": [(pattern_lowercase, deduction_kg), ...],
        "product_ids": {product_id: deduction_kg, ...},
      }
    Kalau file tidak ada, return struktur kosong (semua produk otomatis
    pakai DEFAULT_NETTO_DEDUCTION_KG). Sengaja TIDAK mem-fail-kan program
    kalau file tidak ada -- itu kondisi normal.
    """
    result = {"patterns": [], "product_ids": {}}
    if not os.path.isfile(csv_path):
        return result

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            rule_type = (row.get("rule_type") or "").strip().lower()
            match_value = (row.get("match_value") or "").strip()
            deduction_str = (row.get("deduction_kg") or "").strip()

            if not rule_type or not match_value or not deduction_str:
                continue

            try:
                deduction_kg = float(deduction_str)
            except ValueError:
                logger.warning(
                    "Baris %d di %s punya deduction_kg tidak valid ('%s'), diabaikan",
                    row_num, csv_path, deduction_str,
                )
                continue

            if rule_type == "pattern":
                result["patterns"].append((match_value.lower(), deduction_kg))
            elif rule_type == "product_id":
                try:
                    product_id = int(match_value)
                except ValueError:
                    logger.warning(
                        "Baris %d di %s: rule_type=product_id tapi match_value ('%s') "
                        "bukan angka, diabaikan",
                        row_num, csv_path, match_value,
                    )
                    continue
                result["product_ids"][product_id] = deduction_kg
            else:
                logger.warning(
                    "Baris %d di %s: rule_type tidak dikenal ('%s'), diabaikan",
                    row_num, csv_path, rule_type,
                )

    return result


def round_half_up(value, ndigits=2):
    """Bulatkan seperti Excel/kalkulator biasa (round half away from zero),
    BUKAN seperti Python round() bawaan yang pakai 'round half to even' dan
    rentan salah akibat representasi floating point (misal round(4.085, 2)
    di Python bawaan bisa jadi 4.08, padahal harusnya 4.09).
    """
    quantizer = Decimal("1").scaleb(-ndigits)
    return float(Decimal(str(value)).quantize(quantizer, rounding=ROUND_HALF_UP))


def get_netto_deduction(product_name, product_id=None, rules=None):
    """Tentukan potongan Netto (kg) untuk suatu produk.

    Prioritas matching:
      1. product_id match (paling spesifik)
      2. pattern match (substring nama produk, case-insensitive)
      3. fallback ke DEFAULT_NETTO_DEDUCTION_KG (0.515)

    rules: dict hasil load_netto_deductions(). Kalau None, di-load otomatis
    dari path default.
    """
    if rules is None:
        rules = load_netto_deductions()

    if product_id is not None and product_id in rules.get("product_ids", {}):
        return rules["product_ids"][product_id]

    name_lower = (product_name or "").strip().lower()
    for pattern, deduction_kg in rules.get("patterns", []):
        if pattern in name_lower:
            return deduction_kg

    return DEFAULT_NETTO_DEDUCTION_KG


def calculate_netto(rows, product_name, product_id=None, deduction_kg=None, rules=None):
    """Hitung Netto = Gross - deduction_kg.

    deduction_kg: kalau None, otomatis diambil dari get_netto_deduction()
    (default 0.515, atau nilai khusus dari aturan pattern/product_id kalau
    ada). Bisa juga di-override manual dengan memberikan angka langsung.
    """
    if deduction_kg is None:
        deduction_kg = get_netto_deduction(product_name, product_id=product_id, rules=rules)

    for row in rows:
        gross = row.get("gross_kg")
        if gross is None:
            row["netto_kg"] = None
            row["netto_note"] = "gross_kg kosong"
            continue
        row["netto_kg"] = round_half_up(gross - deduction_kg, 2)

    return rows, deduction_kg


# =============================================================================
# REKONSTRUKSI NOMOR KARTON
# =============================================================================

# Karakter yang sering salah dibaca OCR pada tulisan tangan angka.
HANDWRITING_DIGIT_FIXES = {
    "S": "5", "s": "5",
    "O": "0", "o": "0",
    "I": "1", "l": "1",
    "Z": "2",
    "B": "8",
    "G": "6",
}


def reconstruct_carton_numbers(rows):
    """Rekonstruksi nomor karton penuh dari ctn_roll_raw.

    Aturan (dikonfirmasi manual dengan pabrik):
    - Kalau ctn_roll_raw adalah angka besar (>= 100, indikasi nomor fisik
      penuh ditulis lengkap di kertas), itu jadi titik acuan baru.
    - Kalau ctn_roll_raw adalah angka pendek (< 100, biasanya 1-2 digit),
      itu penerus incremental +1 dari nomor fisik terakhir (BUKAN dihitung
      dari nilai angka pendek itu sendiri -- selalu +1 per baris apapun
      angkanya).

    Dilakukan normalisasi karakter yang mirip angka pada tulisan tangan
    (S->5, O->0, dst) SEBELUM parsing. Kalau parsing tetap gagal total,
    counter tetap dimajukan +1 dengan catatan "WAJIB cek manual" supaya
    baris sesudahnya tidak ikut kegeser/salah.
    """
    reconstructed = []
    last_full_number = None

    for row in rows:
        raw = str(row.get("ctn_roll_raw", "")).strip()
        normalized = "".join(HANDWRITING_DIGIT_FIXES.get(ch, ch) for ch in raw)

        try:
            raw_int = int(normalized)
        except ValueError:
            if last_full_number is not None:
                last_full_number += 1
                row["carton_number_full"] = last_full_number
                row["carton_number_note"] = (
                    f"Tidak bisa parse angka dari '{raw}' -- nomor karton DITEBAK "
                    f"({last_full_number}) berdasarkan urutan, WAJIB cek manual ke foto asli"
                )
            else:
                row["carton_number_full"] = None
                row["carton_number_note"] = f"Tidak bisa parse angka: '{raw}', dan belum ada acuan sebelumnya"
            reconstructed.append(row)
            continue

        if raw != normalized:
            row["carton_number_note"] = f"OCR raw '{raw}' dinormalisasi jadi '{normalized}' (mirip tulisan tangan)"

        if raw_int >= 100:
            last_full_number = raw_int
            row["carton_number_full"] = raw_int
        else:
            if last_full_number is None:
                row["carton_number_full"] = None
                row["carton_number_note"] = "Tidak ada nomor acuan sebelumnya"
            else:
                last_full_number += 1
                row["carton_number_full"] = last_full_number

        reconstructed.append(row)

    return reconstructed


# =============================================================================
# PEMANGGILAN GEMINI API (dengan retry)
# =============================================================================

def call_gemini_ocr(image_bytes, mime_type="image/jpeg", api_key=None, max_retries=MAX_RETRIES):
    """Panggil Gemini API untuk OCR foto packing list, dengan retry +
    exponential backoff.

    Return: (data: dict, raw_text: str, elapsed_seconds: float)
    Raises: RuntimeError kalau semua percobaan gagal, atau ValueError kalau
    hasil bukan JSON valid.
    """
    api_key = api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        try:
            from dotenv import load_dotenv
            env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
            load_dotenv(env_file)
            api_key = os.environ.get("GEMINI_API_KEY")
        except Exception:
            pass

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY tidak ditemukan di environment")

    client = genai.Client(api_key=api_key)

    start_time = time.monotonic()
    response = None
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    PROMPT,
                ],
            )
            break
        except Exception as e:
            last_error = e
            logger.warning("Percobaan OCR Gemini %d/%d gagal: %s", attempt, max_retries, e)
            if attempt < max_retries:
                time.sleep(5 * attempt)

    elapsed_seconds = time.monotonic() - start_time

    if response is None:
        raise RuntimeError(f"Semua {max_retries} percobaan OCR Gemini gagal: {last_error}")

    raw_text = response.text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
        raw_text = raw_text.strip()

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Gagal parse JSON hasil OCR Gemini: {e}\nRaw output: {raw_text}")

    return data, raw_text, elapsed_seconds


def save_raw_ocr_result(packing_list_id, raw_text, data, log_dir=OCR_RAW_LOG_DIR):
    """Simpan hasil OCR mentah ke file untuk audit/debug (bukan cuma
    dikembalikan di response API lalu hilang).

    Return path file yang ditulis.
    """
    os.makedirs(log_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"pl{packing_list_id}_{timestamp}.json"
    path = os.path.join(log_dir, filename)

    log_payload = {
        "packing_list_id": packing_list_id,
        "timestamp": timestamp,
        "raw_text": raw_text,
        "parsed_data": data,
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(log_payload, f, indent=2, ensure_ascii=False)

    return path


# =============================================================================
# ORKESTRASI: OCR + rekonstruksi karton + hitung netto, siap dipakai route
# =============================================================================

def process_packing_list_photo(image_bytes, product_name, product_id, packing_list_id,
                                mime_type="image/jpeg", api_key=None, rules=None):
    """Jalankan alur lengkap: OCR -> rekonstruksi nomor karton -> hitung Netto
    -> simpan log mentah.

    Return dict siap dipakai sebagai response JSON preview (belum commit ke DB).
    """
    data, raw_text, elapsed_seconds = call_gemini_ocr(
        image_bytes, mime_type=mime_type, api_key=api_key
    )

    rows = data.get("rows", [])
    flagged = data.get("flagged_rows", [])
    batches = data.get("batch_numbers_detected", [])

    rows = reconstruct_carton_numbers(rows)
    rows, deduction_kg = calculate_netto(rows, product_name, product_id=product_id, rules=rules)

    data["rows"] = rows
    data["product_name"] = product_name
    data["product_id"] = product_id
    data["netto_deduction_kg"] = deduction_kg

    log_path = save_raw_ocr_result(packing_list_id, raw_text, data)

    return {
        "packing_list_id": packing_list_id,
        "product_name": product_name,
        "product_id": product_id,
        "netto_deduction_kg": deduction_kg,
        "elapsed_seconds": round(elapsed_seconds, 1),
        "rows": rows,
        "flagged_rows": flagged,
        "batch_numbers_detected": batches,
        "raw_log_path": log_path,
    }
