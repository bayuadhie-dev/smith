#!/usr/bin/env python3
"""
Check what happens when querying Week 2 May 2026
"""
from app import create_app, db
from models.production import WeeklyProductionPlan
from datetime import datetime, timedelta

app = create_app()

with app.app_context():
    print("=" * 80)
    print("SIMULATE WEEK 2 QUERY (May 11-17, 2026)")
    print("=" * 80)
    
    # Week 2 of May 2026 = May 11-17
    year = 2026
    month = 5
    week_number = 2  # Week of month
    
    # Calculate week boundaries (week 2 = day 8-14 of month)
    first_day = datetime(year, month, 1).date()
    week_start_day = (week_number - 1) * 7 + 1
    start_date = datetime(year, month, week_start_day).date()
    end_date = start_date + timedelta(days=6)
    
    print(f"\nWeek {week_number} of {month}/{year}:")
    print(f"  Start Date: {start_date}")
    print(f"  End Date: {end_date}")
    print()
    
    # Query like the dashboard does
    plans = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.year == year,
        WeeklyProductionPlan.status.in_(['approved', 'in_progress', 'completed']),
        db.and_(
            WeeklyProductionPlan.week_start <= end_date,
            WeeklyProductionPlan.week_end >= start_date
        )
    ).all()
    
    print(f"📋 Query found {len(plans)} plan(s):\n")
    
    for plan in plans:
        items_list = plan.items.all()
        print(f"Plan ID: {plan.id}")
        print(f"  Week Number (year): {plan.week_number}")
        print(f"  Week Start: {plan.week_start}")
        print(f"  Week End: {plan.week_end}")
        print(f"  Status: {plan.status}")
        
        # Check overlap
        overlaps = plan.week_start <= end_date and plan.week_end >= start_date
        print(f"  Overlaps with Week 2? {overlaps}")
        
        if overlaps:
            print(f"  ⚠️  This plan OVERLAPS with Week 2 query!")
            print(f"     Plan: {plan.week_start} to {plan.week_end}")
            print(f"     Query: {start_date} to {end_date}")
        
        print(f"  Items: {len(items_list)}")
        if items_list:
            for item in items_list:
                if item.product:
                    pack_per_ctn = int(item.product.pack_per_karton) if item.product.pack_per_karton else 50
                    planned_qty = float(item.planned_quantity or 0)
                    if item.uom == 'pcs' and pack_per_ctn > 0:
                        target_ctn = planned_qty / pack_per_ctn
                    else:
                        target_ctn = planned_qty
                    print(f"    - {item.product.name}: {target_ctn:.2f} ctn")
        print()
    
    if len(plans) == 0:
        print("✅ No plans found - Week 2 should show 'Tidak ada target mingguan'")
    else:
        print("⚠️  Plans found - Week 2 will show targets from these plans")
    
    print("\n" + "=" * 80)
    print("CHECK ALL PLANS IN MAY 2026")
    print("=" * 80)
    
    may_start = datetime(2026, 5, 1).date()
    may_end = datetime(2026, 5, 31).date()
    
    all_plans = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.year == 2026,
        WeeklyProductionPlan.week_start >= may_start,
        WeeklyProductionPlan.week_start <= may_end
    ).order_by(WeeklyProductionPlan.week_start).all()
    
    print(f"\nAll plans in May 2026: {len(all_plans)}\n")
    for plan in all_plans:
        print(f"Week {plan.week_number} (year): {plan.week_start} to {plan.week_end}")
        print(f"  Status: {plan.status}")
        print(f"  Notes: {plan.notes}")
        print()
    
    print("=" * 80)
