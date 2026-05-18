#!/usr/bin/env python3
"""
Verify production data distribution across weeks after plan update
"""
from app import create_app, db
from models.production import ShiftProduction, WeeklyProductionPlan
from datetime import datetime, timedelta
from sqlalchemy import func

app = create_app()

with app.app_context():
    print("=" * 80)
    print("VERIFY PRODUCTION DATA ACROSS WEEKS - MAY 2026")
    print("=" * 80)
    
    # Define week boundaries (dashboard style)
    weeks = [
        (1, datetime(2026, 5, 1).date(), datetime(2026, 5, 7).date()),
        (2, datetime(2026, 5, 8).date(), datetime(2026, 5, 14).date()),
        (3, datetime(2026, 5, 15).date(), datetime(2026, 5, 21).date()),
        (4, datetime(2026, 5, 22).date(), datetime(2026, 5, 28).date()),
        (5, datetime(2026, 5, 29).date(), datetime(2026, 5, 31).date()),
    ]
    
    print("\n📅 Week Boundaries:")
    for week_num, start, end in weeks:
        print(f"  Week {week_num}: {start} to {end}")
    
    print("\n" + "=" * 80)
    print("PRODUCTION DATA PER WEEK")
    print("=" * 80)
    
    for week_num, start, end in weeks:
        print(f"\n📊 WEEK {week_num} ({start} to {end}):")
        
        # Get production data for this week
        productions = ShiftProduction.query.filter(
            ShiftProduction.production_date >= start,
            ShiftProduction.production_date <= end
        ).all()
        
        print(f"  Total shifts: {len(productions)}")
        
        if productions:
            # Group by date
            by_date = {}
            for sp in productions:
                date_str = sp.production_date.strftime('%Y-%m-%d')
                if date_str not in by_date:
                    by_date[date_str] = []
                by_date[date_str].append(sp)
            
            print(f"  Production dates:")
            for date_str in sorted(by_date.keys()):
                shifts = by_date[date_str]
                total_qty = sum(sp.good_quantity or 0 for sp in shifts)
                print(f"    - {date_str}: {len(shifts)} shift(s), {total_qty} pcs")
        
        # Check if there's a weekly plan for this week
        plan = WeeklyProductionPlan.query.filter(
            WeeklyProductionPlan.year == 2026,
            WeeklyProductionPlan.status.in_(['approved', 'in_progress', 'completed']),
            db.and_(
                WeeklyProductionPlan.week_start <= end,
                WeeklyProductionPlan.week_end >= start
            )
        ).first()
        
        if plan:
            items_list = plan.items.all()
            print(f"  📋 Weekly Plan: YES")
            print(f"     Plan dates: {plan.week_start} to {plan.week_end}")
            print(f"     Items: {len(items_list)}")
            if items_list:
                for item in items_list:
                    if item.product:
                        print(f"       - {item.product.name}: {item.planned_quantity} {item.uom}")
        else:
            print(f"  📋 Weekly Plan: NO (will show 'Tidak ada target mingguan')")
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    # Total production in May
    total_productions = ShiftProduction.query.filter(
        ShiftProduction.production_date >= datetime(2026, 5, 1).date(),
        ShiftProduction.production_date <= datetime(2026, 5, 31).date()
    ).count()
    
    print(f"\nTotal shift productions in May 2026: {total_productions}")
    
    # Total plans
    total_plans = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.year == 2026,
        WeeklyProductionPlan.week_start >= datetime(2026, 5, 1).date(),
        WeeklyProductionPlan.week_start <= datetime(2026, 5, 31).date()
    ).count()
    
    print(f"Total weekly plans in May 2026: {total_plans}")
    
    print("\n✅ Week 1 (1-7 May): Has plan + production data")
    print("✅ Week 2 (8-14 May): No plan (correct!) + may have production data")
    print("✅ Week 3-5: No plan + may have production data")
    
    print("\n" + "=" * 80)
