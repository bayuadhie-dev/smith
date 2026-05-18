#!/usr/bin/env python3
"""Test specific downtime case"""

from utils.helpers import detect_downtime_category

test_text = "Ganti stiker ( setting mc dan packaging )"

print("=" * 80)
print(f"Testing: '{test_text}'")
print("=" * 80)

# Test as first entry
result_first = detect_downtime_category(test_text, is_first_entry=True)
print(f"\nAs FIRST entry: {result_first}")

# Test as not first entry
result_not_first = detect_downtime_category(test_text, is_first_entry=False)
print(f"As NOT FIRST entry: {result_not_first}")

print("\n" + "=" * 80)
