#!/usr/bin/env python3
"""
Check Week 2 May 2026 Targets
"""
from app import create_app
from models.production import WeeklyProductionPlan, WeeklyProductionPlanItem
from datetime import datetime

app = create_app()

with app.app_context():
    print("=" * 80)
    print("CHECK WEEK 2 MAY 2026 TARGETS")
    print("=" * 80)
    
    # Get all weekly plans for May 2026
    may_start = datetime(2026, 5, 1).date()
    may_end = datetime(2026, 5, 31).date()
    
    plans = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.year == 2026,
        WeeklyProductionPlan.week_start >= may_start,
        WeeklyProductionPlan.week_start <= may_end
    ).order_by(WeeklyProductionPlan.week_number).all()
    
    print(f"\n📋 Found {len(plans)} weekly plan(s) for May 2026:\n")
    
    for plan in plans:
        items_list = plan.items.all()
        print(f"Week {plan.week_number}:")
        print(f"  - Week Start: {plan.week_start}")
        print(f"  - Week End: {plan.week_end}")
        print(f"  - Status: {plan.status}")
        print(f"  - Notes: {plan.notes or 'N/A'}")
        print(f"  - Items: {len(items_list)}")
        
        if items_list:
            print(f"  - Products:")
            for item in items_list:
                if item.product:
                    print(f"    * {item.product.name}: {item.planned_quantity} {item.uom}")
                    if item.planned_days:
                        print(f"      Planned Days: {item.planned_days}, Planned Shifts: {item.planned_shifts}")
        print()
    
    # Check specifically for week 2
    print("=" * 80)
    print("WEEK 2 SPECIFIC CHECK")
    print("=" * 80)
    
    week_2_plans = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.year == 2026,
        WeeklyProductionPlan.week_number == 2,
        WeeklyProductionPlan.week_start >= may_start,
        WeeklyProductionPlan.week_start <= may_end
    ).all()
    
    if week_2_plans:
        print(f"\n⚠️  Found {len(week_2_plans)} plan(s) for Week 2!")
        for plan in week_2_plans:
            items_list = plan.items.all()
            print(f"\nPlan ID: {plan.id}")
            print(f"Status: {plan.status}")
            print(f"Week Start: {plan.week_start}")
            print(f"Week End: {plan.week_end}")
            print(f"Items count: {len(items_list)}")
            
            if items_list:
                print("\nItems:")
                for item in items_list:
                    if item.product:
                        pack_per_ctn = int(item.product.pack_per_karton) if item.product.pack_per_karton else 50
                        planned_qty = float(item.planned_quantity or 0)
                        if item.uom == 'pcs' and pack_per_ctn > 0:
                            target_ctn = planned_qty / pack_per_ctn
                        else:
                            target_ctn = planned_qty
                        
                        print(f"  - {item.product.name}")
                        print(f"    Planned Qty: {item.planned_quantity} {item.uom}")
                        print(f"    Target Cartons: {target_ctn:.2f}")
                        print(f"    Planned Days: {item.planned_days}")
                        print(f"    Planned Shifts: {item.planned_shifts}")
    else:
        print("\n✅ No plans found for Week 2 (correct!)")
    
    print("\n" + "=" * 80)
