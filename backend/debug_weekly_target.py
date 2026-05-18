#!/usr/bin/env python3
"""Debug why weekly target is not showing in Production Monitoring"""

from app import create_app
from models import db
from models.production import WeeklyProductionPlan, ShiftProduction
from datetime import datetime, timedelta
from utils.timezone import get_local_now

app = create_app()

with app.app_context():
    print("=" * 80)
    print("DEBUG WEEKLY TARGET IN PRODUCTION MONITORING")
    print("=" * 80)
    
    # Simulate Production Monitoring logic
    year = 2026
    month = 5
    
    start_date = datetime(year, month, 1).date()
    end_date = datetime(year, month, 31).date()
    
    print(f"\nMonth: {year}-{month:02d}")
    print(f"Date Range: {start_date} to {end_date}")
    
    # Determine current week
    today = get_local_now().date()
    print(f"Today: {today}")
    
    if start_date <= today <= end_date:
        current_week_start = today - timedelta(days=today.weekday())
        current_week_end = current_week_start + timedelta(days=6)
    else:
        current_week_start = start_date
        current_week_end = min(start_date + timedelta(days=6), end_date)
    
    print(f"Current Week: {current_week_start} to {current_week_end}")
    
    # Get weekly plans
    print("\n" + "-" * 80)
    print("WEEKLY PLANS FOR CURRENT WEEK")
    print("-" * 80)
    
    weekly_plans = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.year == year,
        WeeklyProductionPlan.status.in_(['approved', 'in_progress', 'completed']),
        db.and_(
            WeeklyProductionPlan.week_start <= current_week_end,
            WeeklyProductionPlan.week_end >= current_week_start
        )
    ).all()
    
    print(f"Found {len(weekly_plans)} weekly plan(s)")
    
    weekly_targets = {}
    for plan in weekly_plans:
        print(f"\nPlan: {plan.plan_number}")
        print(f"  Week: {plan.week_number} ({plan.week_start} to {plan.week_end})")
        print(f"  Status: {plan.status}")
        print(f"  Items: {plan.items.count()}")
        
        for item in plan.items.all():
            if not item.product:
                continue
            
            product_name = item.product.name
            pack_per_ctn = int(item.product.pack_per_karton) if item.product.pack_per_karton else 50
            
            planned_qty = float(item.planned_quantity or 0)
            if item.uom == 'pcs' and pack_per_ctn > 0:
                target_ctn = planned_qty / pack_per_ctn
            else:
                target_ctn = planned_qty
            
            print(f"    - Product: '{product_name}'")
            print(f"      Quantity: {item.planned_quantity} {item.uom}")
            print(f"      Pack per Ctn: {pack_per_ctn}")
            print(f"      Target Ctn: {target_ctn}")
            
            if product_name not in weekly_targets:
                weekly_targets[product_name] = 0
            weekly_targets[product_name] += target_ctn
    
    # Get shift productions
    print("\n" + "-" * 80)
    print("SHIFT PRODUCTIONS IN THIS MONTH")
    print("-" * 80)
    
    shifts = ShiftProduction.query.filter(
        ShiftProduction.production_date >= start_date,
        ShiftProduction.production_date <= end_date
    ).all()
    
    print(f"Found {len(shifts)} shift production(s)")
    
    product_names_in_shifts = set()
    for sp in shifts:
        if sp.product:
            product_names_in_shifts.add(sp.product.name)
    
    print(f"\nUnique products in shifts: {len(product_names_in_shifts)}")
    for pname in sorted(product_names_in_shifts):
        print(f"  - '{pname}'")
    
    # Compare
    print("\n" + "=" * 80)
    print("COMPARISON")
    print("=" * 80)
    
    print("\nWeekly Targets:")
    for pname, target in weekly_targets.items():
        print(f"  '{pname}': {target} ctn")
    
    print("\nProducts in Shifts:")
    for pname in sorted(product_names_in_shifts):
        has_target = pname in weekly_targets
        print(f"  '{pname}': {'✓ HAS TARGET' if has_target else '✗ NO TARGET'}")
    
    print("\n" + "=" * 80)
    print("POTENTIAL ISSUES")
    print("=" * 80)
    
    # Check for name mismatches
    for shift_product in product_names_in_shifts:
        if shift_product not in weekly_targets:
            print(f"\n⚠️  Product '{shift_product}' in shifts but NOT in weekly plan")
            # Try to find similar names
            for plan_product in weekly_targets.keys():
                if plan_product.lower() in shift_product.lower() or shift_product.lower() in plan_product.lower():
                    print(f"    Similar: '{plan_product}' in weekly plan")
    
    for plan_product in weekly_targets.keys():
        if plan_product not in product_names_in_shifts:
            print(f"\n⚠️  Product '{plan_product}' in weekly plan but NOT in shifts")
            # Try to find similar names
            for shift_product in product_names_in_shifts:
                if shift_product.lower() in plan_product.lower() or plan_product.lower() in shift_product.lower():
                    print(f"    Similar: '{shift_product}' in shifts")
