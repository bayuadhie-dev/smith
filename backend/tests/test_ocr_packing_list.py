"""
UNIT TEST untuk backend/utils/ocr_packing_list.py

Menguji fungsi murni (tidak memanggil API Gemini sama sekali):
- reconstruct_carton_numbers()
- calculate_netto() / get_netto_deduction() / load_netto_deductions()
- round_half_up()

Cara pakai:
    python3 -m unittest backend/tests/test_ocr_packing_list.py -v
"""

import unittest
import sys
import os
import tempfile
import types as _types

# Add backend and backend/utils to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
utils_dir = os.path.join(backend_dir, 'utils')
if utils_dir not in sys.path:
    sys.path.insert(0, utils_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# ocr_packing_list.py mengimpor 'google.genai' di level modul (dipakai
# untuk call_gemini_ocr()). Fungsi yang mau kita test di sini murni logic
# Python biasa, jadi kita mock modul 'google.genai' supaya file ini bisa
# dijalankan tanpa perlu install library 'google-genai' sungguhan.
if "google" not in sys.modules:
    sys.modules["google"] = _types.ModuleType("google")
if "google.genai" not in sys.modules:
    _mock_genai = _types.ModuleType("google.genai")
    _mock_genai.types = _types.ModuleType("types")
    _mock_genai.Client = object
    sys.modules["google.genai"] = _mock_genai
    sys.modules["google"].genai = _mock_genai

from ocr_packing_list import (
    reconstruct_carton_numbers,
    calculate_netto,
    get_netto_deduction,
    load_netto_deductions,
    round_half_up,
    DEFAULT_NETTO_DEDUCTION_KG,
)


def make_rows(ctn_raws):
    return [{"no": i + 1, "ctn_roll_raw": raw} for i, raw in enumerate(ctn_raws)]


class TestReconstructCartonNumbers(unittest.TestCase):

    def test_kasus_nyata_wetkins(self):
        raws = ["5848", "9", "5850", "1", "2", "3"]
        rows = reconstruct_carton_numbers(make_rows(raws))
        expected = [5848, 5849, 5850, 5851, 5852, 5853]
        actual = [r["carton_number_full"] for r in rows]
        self.assertEqual(actual, expected)

    def test_kasus_nyata_octenic_huruf_s(self):
        raws = ["9119", "9120", "1", "2", "3", "4", "S", "6", "7", "8", "9", "9130"]
        rows = reconstruct_carton_numbers(make_rows(raws))
        expected = [9119, 9120, 9121, 9122, 9123, 9124, 9125, 9126, 9127, 9128, 9129, 9130]
        actual = [r["carton_number_full"] for r in rows]
        self.assertEqual(actual, expected)

    def test_normalisasi_huruf_mirip_angka(self):
        test_cases = [
            ("S", "5"), ("s", "5"),
            ("O", "0"), ("o", "0"),
            ("I", "1"), ("l", "1"),
            ("Z", "2"),
            ("B", "8"),
            ("G", "6"),
        ]
        for letter, expected_digit in test_cases:
            rows = reconstruct_carton_numbers(make_rows(["100", letter]))
            note = rows[1].get("carton_number_note", "")
            self.assertIn(f"jadi '{expected_digit}'", note)
            self.assertEqual(rows[1]["carton_number_full"], 101)

    def test_tidak_boleh_ada_gap(self):
        raws = ["5848", "9", "5850", "1", "2", "3", "4", "5", "6", "7", "8", "9",
                "5860", "1", "2", "3"]
        rows = reconstruct_carton_numbers(make_rows(raws))
        nums = [r["carton_number_full"] for r in rows]
        for i in range(1, len(nums)):
            self.assertEqual(nums[i], nums[i - 1] + 1)

    def test_tidak_boleh_ada_duplikat(self):
        raws = ["5848", "9", "5850", "1", "2", "3"]
        rows = reconstruct_carton_numbers(make_rows(raws))
        nums = [r["carton_number_full"] for r in rows]
        self.assertEqual(len(nums), len(set(nums)))

    def test_karakter_tidak_dikenal_tetap_maju_dan_diberi_catatan(self):
        raws = ["100", "1", "??", "3"]
        rows = reconstruct_carton_numbers(make_rows(raws))
        expected = [100, 101, 102, 103]
        actual = [r["carton_number_full"] for r in rows]
        self.assertEqual(actual, expected)
        self.assertIn("WAJIB cek manual", rows[2]["carton_number_note"])

    def test_baris_pendek_tanpa_acuan_sebelumnya(self):
        raws = ["1", "2", "3"]
        rows = reconstruct_carton_numbers(make_rows(raws))
        self.assertIsNone(rows[0]["carton_number_full"])
        self.assertIn("Tidak ada nomor acuan", rows[0]["carton_number_note"])

    def test_dua_angka_besar_berturutan(self):
        raws = ["5848", "5900", "1"]
        rows = reconstruct_carton_numbers(make_rows(raws))
        expected = [5848, 5900, 5901]
        actual = [r["carton_number_full"] for r in rows]
        self.assertEqual(actual, expected)

    def test_rows_kosong(self):
        self.assertEqual(reconstruct_carton_numbers([]), [])


class TestRoundHalfUp(unittest.TestCase):

    def test_kasus_bermasalah_floating_point(self):
        self.assertEqual(round_half_up(4.60 - 0.515, 2), 4.09)

    def test_pembulatan_normal(self):
        self.assertEqual(round_half_up(4.235, 2), 4.24)
        self.assertEqual(round_half_up(4.035, 2), 4.04)

    def test_tidak_perlu_pembulatan(self):
        self.assertEqual(round_half_up(5.00, 2), 5.0)


class TestNettoDeduction(unittest.TestCase):
    """Test logic penentuan potongan Netto dengan struktur rule_type
    (pattern / product_id), prioritas: product_id > pattern > default."""

    def test_default_deduction_tanpa_rules(self):
        empty_rules = {"patterns": [], "product_ids": {}}
        self.assertEqual(
            get_netto_deduction("Wetkins 50's BLUE", rules=empty_rules),
            DEFAULT_NETTO_DEDUCTION_KG,
        )
        self.assertEqual(
            get_netto_deduction("Octenic Body Washgloves 4's", rules=empty_rules),
            DEFAULT_NETTO_DEDUCTION_KG,
        )
        self.assertEqual(DEFAULT_NETTO_DEDUCTION_KG, 0.515)

    def test_pattern_match_case_insensitive(self):
        rules = {"patterns": [("polymorph", 0.862)], "product_ids": {}}
        self.assertEqual(
            get_netto_deduction("Polymorph Magicclean Dry Wipes", rules=rules), 0.862
        )
        self.assertEqual(
            get_netto_deduction("POLYMORPH HEAVY DUTY MD", rules=rules), 0.862
        )
        self.assertEqual(
            get_netto_deduction("polymorph lap rayon", rules=rules), 0.862
        )

    def test_product_id_match(self):
        rules = {"patterns": [], "product_ids": {383: 0.862}}
        self.assertEqual(
            get_netto_deduction("Alfamart Wet Wipes Hand & Mouth 20S @27X3", product_id=383, rules=rules),
            0.862,
        )

    def test_product_id_priority_over_pattern(self):
        """Kalau product_id match DAN pattern juga match, product_id menang
        (paling spesifik)."""
        rules = {"patterns": [("wetkins", 0.7)], "product_ids": {99: 0.862}}
        self.assertEqual(
            get_netto_deduction("Wetkins Something", product_id=99, rules=rules), 0.862
        )

    def test_wetkins_tetap_default_bukan_pengecualian(self):
        """Wetkins SEMPAT SALAH DIKIRA sama dengan Alfamart, tapi sudah
        dikoreksi eksplisit -- Wetkins bukan pengecualian, tetap default."""
        rules = {"patterns": [], "product_ids": {383: 0.862}}
        self.assertEqual(
            get_netto_deduction("Wetkins 50's BLUE", product_id=1, rules=rules),
            DEFAULT_NETTO_DEDUCTION_KG,
        )

    def test_load_netto_deductions_file_tidak_ada(self):
        result = load_netto_deductions("/path/yang/pasti/tidak/ada.csv")
        self.assertEqual(result, {"patterns": [], "product_ids": {}})

    def test_load_netto_deductions_dari_file_asli(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            f.write("rule_type,match_value,deduction_kg\n")
            f.write("pattern,POLYMORPH,0.862\n")
            f.write("product_id,383,0.862\n")
            temp_path = f.name
        try:
            result = load_netto_deductions(temp_path)
            self.assertIn(("polymorph", 0.862), result["patterns"])
            self.assertEqual(result["product_ids"].get(383), 0.862)
        finally:
            os.unlink(temp_path)

    def test_pengecualian_terbaca_dari_file_produksi(self):
        """Sanity check terhadap product_netto_deduction.csv SUNGGUHAN yang
        dipakai produksi -- Polymorph (pattern) & id 383 (product_id),
        dikonfirmasi 24 Jul 2026."""
        rules = load_netto_deductions()
        self.assertEqual(
            get_netto_deduction("Polymorph Magicclean Dry Wipes", rules=rules), 0.862
        )
        self.assertEqual(
            get_netto_deduction("Polymorph Magicclean Wet Wipes", rules=rules), 0.862
        )
        self.assertEqual(
            get_netto_deduction("Produk Apapun", product_id=383, rules=rules), 0.862
        )

    def test_load_netto_deductions_baris_rusak_diabaikan(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
            f.write("rule_type,match_value,deduction_kg\n")
            f.write("pattern,RUSAK,BUKAN_ANGKA\n")
            f.write("product_id,BUKAN_ID,0.7\n")
            f.write("pattern,VALID,0.75\n")
            temp_path = f.name
        try:
            result = load_netto_deductions(temp_path)
            self.assertNotIn(("rusak", "BUKAN_ANGKA"), result["patterns"])
            self.assertEqual(result["product_ids"], {})
            self.assertIn(("valid", 0.75), result["patterns"])
        finally:
            os.unlink(temp_path)


class TestCalculateNetto(unittest.TestCase):

    def test_match_persis_data_excel_octenic(self):
        gross_excel = [4.70, 4.70, 4.75, 4.60, 4.60, 4.60, 4.60, 4.55, 4.60, 4.60, 4.65, 4.80,
                       4.50, 4.55, 4.55, 4.60, 4.55, 4.50, 4.70, 4.70, 4.65, 4.70]
        netto_excel = [4.19, 4.19, 4.24, 4.09, 4.09, 4.09, 4.09, 4.04, 4.09, 4.09, 4.14, 4.29,
                       3.99, 4.04, 4.04, 4.09, 4.04, 3.99, 4.19, 4.19, 4.14, 4.19]
        rows = [{"no": i + 1, "gross_kg": g} for i, g in enumerate(gross_excel)]
        empty_rules = {"patterns": [], "product_ids": {}}
        result, deduction = calculate_netto(rows, "Octenic Body Washgloves 4's", rules=empty_rules)
        self.assertEqual(deduction, 0.515)
        actual_netto = [r["netto_kg"] for r in result]
        self.assertEqual(actual_netto, netto_excel)

    def test_produk_tidak_dikenal_tetap_pakai_default(self):
        rows = [{"no": 1, "gross_kg": 5.0}]
        empty_rules = {"patterns": [], "product_ids": {}}
        result, deduction = calculate_netto(rows, "Produk Yang Belum Pernah Terdengar", rules=empty_rules)
        self.assertEqual(deduction, 0.515)
        self.assertEqual(result[0]["netto_kg"], 4.49)

    def test_override_deduction_manual(self):
        rows = [{"no": 1, "gross_kg": 10.0}]
        result, deduction = calculate_netto(rows, "Apapun", deduction_kg=1.5)
        self.assertEqual(deduction, 1.5)
        self.assertEqual(result[0]["netto_kg"], 8.5)

    def test_gross_kg_kosong(self):
        rows = [{"no": 1, "gross_kg": None}]
        empty_rules = {"patterns": [], "product_ids": {}}
        result, deduction = calculate_netto(rows, "Wetkins 50's BLUE", rules=empty_rules)
        self.assertIsNotNone(deduction)
        self.assertIsNone(result[0]["netto_kg"])
        self.assertIn("kosong", result[0]["netto_note"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
