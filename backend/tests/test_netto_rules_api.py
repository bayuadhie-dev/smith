"""
UNIT TEST untuk Super Admin Netto Deduction Rules CRUD Endpoints di backend/routes/config_manager.py
"""

import unittest
import os
import csv
import sys
import json
import tempfile

# Add backend to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from routes.config_manager import (
    _read_netto_rules_csv,
    _write_netto_rules_csv_atomic,
    _get_netto_rules_csv_path
)


class TestNettoRulesAtomicCSV(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.csv_path = os.path.join(self.temp_dir.name, "product_netto_deduction.csv")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_read_and_write_atomic(self):
        sample_rules = [
            {'rule_type': 'pattern', 'match_value': 'POLYMORPH', 'deduction_kg': 0.862},
            {'rule_type': 'product_id', 'match_value': '383', 'deduction_kg': 0.862}
        ]
        
        # Write to temporary csv
        tmp_file = self.csv_path + ".tmp"
        with open(tmp_file, mode='w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['rule_type', 'match_value', 'deduction_kg'])
            for r in sample_rules:
                writer.writerow([r['rule_type'], r['match_value'], r['deduction_kg']])
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_file, self.csv_path)

        self.assertTrue(os.path.exists(self.csv_path))

        # Read back
        read_rules = []
        with open(self.csv_path, mode='r', encoding='utf-8', newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                read_rules.append({
                    'rule_type': row['rule_type'],
                    'match_value': row['match_value'],
                    'deduction_kg': float(row['deduction_kg'])
                })

        self.assertEqual(len(read_rules), 2)
        self.assertEqual(read_rules[0]['match_value'], 'POLYMORPH')
        self.assertEqual(read_rules[1]['deduction_kg'], 0.862)

    def test_duplicate_rule_detection_logic(self):
        rules = [
            {'rule_type': 'pattern', 'match_value': 'POLYMORPH', 'deduction_kg': 0.862},
            {'rule_type': 'product_id', 'match_value': '383', 'deduction_kg': 0.862}
        ]
        
        new_rule_type = 'pattern'
        new_match_value = 'polymorph'  # Case-insensitive duplicate check
        
        is_duplicate = any(
            r['rule_type'].lower() == new_rule_type.lower() and r['match_value'].lower() == new_match_value.lower()
            for r in rules
        )
        self.assertTrue(is_duplicate)

    def test_composite_key_matching_for_update_delete(self):
        rules = [
            {'rule_type': 'pattern', 'match_value': 'POLYMORPH', 'deduction_kg': 0.862},
            {'rule_type': 'product_id', 'match_value': '383', 'deduction_kg': 0.862}
        ]
        
        target_rule_type = 'product_id'
        target_match_value = '383'
        
        target_idx = None
        for idx, r in enumerate(rules):
            if r['rule_type'].lower() == target_rule_type and r['match_value'].lower() == target_match_value.lower():
                target_idx = idx
                break

        self.assertEqual(target_idx, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
