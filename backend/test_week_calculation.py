#!/usr/bin/env python3
"""
Test new week calculation logic
"""
from datetime import datetime, timedelta

def calculate_weeks_in_month(year, month):
    """Calculate weeks based on Monday-Sunday, starting from first Monday"""
    first_day_of_month = datetime(year, month, 1).date()
    
    # Find first Monday (weekday 0 = Monday)
    days_until_monday = (7 - first_day_of_month.weekday()) % 7
    if first_day_of_month.weekday() != 0:  # If not already Monday
        first_monday = first_day_of_month + timedelta(days=days_until_monday)
    else:
        first_monday = first_day_of_month
    
    # Get last day of month
    if month == 12:
        last_day = datetime(year + 1, 1, 1).date() - timedelta(days=1)
    else:
        last_day = datetime(year, month + 1, 1).date() - timedelta(days=1)
    
    weeks = []
    
    # Add partial week before first Monday if exists
    if first_monday > first_day_of_month:
        weeks.append({
            'week': 0,
            'start': first_day_of_month,
            'end': first_monday - timedelta(days=1),
            'label': 'Partial week'
        })
    
    # Calculate full weeks
    temp_date = first_monday
    week_num = 1
    
    while temp_date <= last_day:
        w_start = temp_date
        w_end = min(temp_date + timedelta(days=6), last_day)
        weeks.append({
            'week': week_num,
            'start': w_start,
            'end': w_end,
            'label': f'Week {week_num}'
        })
        temp_date += timedelta(days=7)
        week_num += 1
    
    return weeks, first_monday

print("=" * 80)
print("TEST WEEK CALCULATION FOR MAY 2026")
print("=" * 80)

# May 2026
year = 2026
month = 5

weeks, first_monday = calculate_weeks_in_month(year, month)

print(f"\nFirst day of May 2026: {datetime(2026, 5, 1).date()} ({datetime(2026, 5, 1).strftime('%A')})")
print(f"First Monday: {first_monday} ({first_monday.strftime('%A')})")
print(f"\nWeeks in May 2026:\n")

for week in weeks:
    start = week['start']
    end = week['end']
    week_num = week['week']
    
    # Count working days (Mon-Fri)
    working_days = 0
    current = start
    while current <= end:
        if current.weekday() < 5:  # Monday=0, Friday=4
            working_days += 1
        current += timedelta(days=1)
    
    if week_num == 0:
        print(f"Partial Week: {start} to {end}")
    else:
        print(f"Week {week_num}: {start} to {end}")
    print(f"  Days: {start.strftime('%a %d')} - {end.strftime('%a %d')}")
    print(f"  Working days (Mon-Fri): {working_days}")
    print()

print("=" * 80)
print("VERIFY WEEKLY PLAN ALIGNMENT")
print("=" * 80)

# Check if Week 1 plan (May 4-10) aligns with calculated Week 1
plan_start = datetime(2026, 5, 4).date()
plan_end = datetime(2026, 5, 10).date()

week_1 = [w for w in weeks if w['week'] == 1][0]

print(f"\nWeekly Plan Week 1: {plan_start} to {plan_end}")
print(f"Calculated Week 1: {week_1['start']} to {week_1['end']}")

if plan_start == week_1['start'] and plan_end == week_1['end']:
    print("\n✅ PERFECT MATCH! Plan aligns with dashboard calculation")
else:
    print("\n⚠️  MISMATCH! Plan does not align with dashboard")
    print(f"   Difference: Plan starts {(plan_start - week_1['start']).days} days off")

print("\n" + "=" * 80)
print("CHECK WEEK 2")
print("=" * 80)

week_2 = [w for w in weeks if w['week'] == 2]
if week_2:
    week_2 = week_2[0]
    print(f"\nWeek 2: {week_2['start']} to {week_2['end']}")
    print(f"  Days: {week_2['start'].strftime('%a %d')} - {week_2['end'].strftime('%a %d')}")
    
    # Check if Week 1 plan overlaps with Week 2
    overlaps = plan_start <= week_2['end'] and plan_end >= week_2['start']
    print(f"\nDoes Week 1 plan (May 4-10) overlap with Week 2 ({week_2['start']} to {week_2['end']})? {overlaps}")
    
    if not overlaps:
        print("✅ No overlap - Week 2 should show 'Tidak ada target mingguan'")
    else:
        print("⚠️  Overlap detected!")
else:
    print("\n❌ No Week 2 found")

print("\n" + "=" * 80)
