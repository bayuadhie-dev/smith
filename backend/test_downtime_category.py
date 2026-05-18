#!/usr/bin/env python3
"""Test downtime category detection"""

from utils.helpers import detect_downtime_category

test_cases = [
    ("Ganti order ( setting mc dan packaging )", "design"),
    ("dosing", "mesin"),
    ("dossing", "mesin"),
    ("setting mc", "design", True),  # first entry
    ("setting mc", "mesin", False),  # not first entry
    ("tunggu kain", "idle"),
    ("mesin rusak", "mesin"),
    ("operator error", "operator"),
    ("kain cacat", "material"),
]

print("=" * 80)
print("TESTING DOWNTIME CATEGORY DETECTION")
print("=" * 80)

for test in test_cases:
    if len(test) == 3:
        text, expected, is_first = test
        result = detect_downtime_category(text, is_first)
        status = "✅" if result == expected else "❌"
        print(f"{status} '{text}' (first={is_first})")
        print(f"   Expected: {expected}, Got: {result}")
    else:
        text, expected = test
        result = detect_downtime_category(text)
        status = "✅" if result == expected else "❌"
        print(f"{status} '{text}'")
        print(f"   Expected: {expected}, Got: {result}")
    print()

print("=" * 80)
