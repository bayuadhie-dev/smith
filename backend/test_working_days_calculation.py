#!/usr/bin/env python3
"""
Test script to verify working days calculation for May 2026
"""
from datetime import datetime, timedelta

def calculate_working_days(start_date, end_date):
    """Calculate working days (Mon-Fri) between two dates"""
    current_date = start_date
    working_days_count = 0
    
    while current_date <= end_date:
        # 0 = Monday, 6 = Sunday
        if current_date.weekday() < 5:  # Monday to Friday
            working_days_count += 1
        current_date += timedelta(days=1)
    
    return working_days_count

# Test for May 2026
start_date = datetime(2026, 5, 1).date()
end_date = datetime(2026, 5, 31).date()

working_days = calculate_working_days(start_date, end_date)

print("=" * 80)
print("WORKING DAYS CALCULATION TEST - MAY 2026")
print("=" * 80)
print(f"Start Date: {start_date}")
print(f"End Date: {end_date}")
print(f"Total Days: {(end_date - start_date).days + 1}")
print(f"Working Days (Mon-Fri): {working_days}")
print()

# Test target calculation
total_target_ctn = 2050  # 1,600 + 450
daily_target_old = round(total_target_ctn / 22, 2)  # Old hardcoded
daily_target_new = round(total_target_ctn / working_days, 2)  # New calculated

print("TARGET CALCULATION:")
print(f"Total Target: {total_target_ctn} cartons")
print(f"Daily Target (OLD - hardcoded 22 days): {daily_target_old} ctn/day")
print(f"Daily Target (NEW - calculated {working_days} days): {daily_target_new} ctn/day")
print()

# Show the incorrect calculation that was happening
days_with_production = 1  # Only May 5 has production data
incorrect_working_days = days_with_production  # Bug: using len(all_dates)
incorrect_daily_target = round(total_target_ctn / incorrect_working_days, 2) if incorrect_working_days > 0 else 0

print("PREVIOUS BUG (using days with production data):")
print(f"Days with production data: {days_with_production}")
print(f"Incorrect daily target: {incorrect_daily_target} ctn/day")
print(f"This is why it showed ~483 ctn/day!")
print()

# Test for different date ranges
print("=" * 80)
print("TESTING DIFFERENT DATE RANGES:")
print("=" * 80)

test_ranges = [
    ("Full May 2026", datetime(2026, 5, 1).date(), datetime(2026, 5, 31).date()),
    ("Week 19 (May 11-17)", datetime(2026, 5, 11).date(), datetime(2026, 5, 17).date()),
    ("First week (May 1-7)", datetime(2026, 5, 1).date(), datetime(2026, 5, 7).date()),
]

for name, start, end in test_ranges:
    wd = calculate_working_days(start, end)
    print(f"{name}: {wd} working days")

print("=" * 80)
