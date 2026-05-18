#!/usr/bin/env python
"""
Test to verify weeks_in_month logic always returns all weeks regardless of selected week
"""
from datetime import datetime, timedelta

def test_weeks_logic(year, month, week_number):
    print(f"\n{'='*60}")
    print(f"Testing: {year}-{month:02d}, Week {week_number}")
    print(f"{'='*60}")
    
    # Calculate date range
    start_date = datetime(year, month, 1).date()
    if month == 12:
        end_date = datetime(year + 1, 1, 1).date() - timedelta(days=1)
    else:
        end_date = datetime(year, month + 1, 1).date() - timedelta(days=1)
    
    # Store original month_end for building weeks list
    month_end_original = end_date
    
    print(f"Original month range: {start_date} to {end_date}")
    
    # For weekly view, calculate week boundaries
    if week_number > 0:
        week_start = start_date + timedelta(days=(week_number - 1) * 7)
        week_end = min(week_start + timedelta(days=6), end_date)
        start_date_filtered = week_start
        end_date_filtered = week_end
        print(f"Filtered for Week {week_number}: {start_date_filtered} to {end_date_filtered}")
    
    # Calculate weeks in the month (always use full month range)
    weeks_in_month = []
    temp_date = datetime(year, month, 1).date()
    month_end = month_end_original  # Use original month end
    week_num = 1
    
    while temp_date <= month_end:
        w_start = temp_date
        w_end = min(temp_date + timedelta(days=6), month_end)
        weeks_in_month.append({
            'week': week_num,
            'start_date': w_start.isoformat(),
            'end_date': w_end.isoformat(),
            'label': f"Week {week_num} ({w_start.strftime('%d %b')} - {w_end.strftime('%d %b')})"
        })
        temp_date = w_end + timedelta(days=1)
        week_num += 1
    
    print(f"\nWeeks in month: {len(weeks_in_month)} weeks")
    for w in weeks_in_month:
        print(f"  {w['label']}")
    
    return weeks_in_month

# Test cases
print("\n" + "="*60)
print("TEST: Weeks Logic - Should always return ALL weeks")
print("="*60)

# Test 1: April 2026, no week selected
test_weeks_logic(2026, 4, 0)

# Test 2: April 2026, week 2 selected
test_weeks_logic(2026, 4, 2)

# Test 3: May 2026, week 1 selected
test_weeks_logic(2026, 5, 1)

# Test 4: May 2026, week 4 selected
test_weeks_logic(2026, 5, 4)

print("\n" + "="*60)
print("✅ All tests completed!")
print("="*60)
