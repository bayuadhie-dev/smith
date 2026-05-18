#!/usr/bin/env python3
"""Check product names in ShiftProduction vs WeeklyProductionPlan for May 5, 2026"""

from app import create_app
from models import db
from models.production import ShiftProduction, WeeklyProductionPlan, WeeklyProductionPlanItem
import datetime

app = create_app()

with app.app_context():
    print("=" * 80)
    print("PRODUCT NAMES COMPARISON FOR MAY 2026")
    print("=" * 80)
    
    # Get shift productions for May 5, 2026
    target_date = datetime.date(2026, 5, 5)
    shifts = ShiftProduction.query.filter_by(production_date=target_date).all()
    
    print(f"\n1. SHIFT PRODUCTIONS ON {target_date}")
    print("-" * 80)
    for sp in shifts:
        product_name = sp.product.name if sp.product else "Unknown"
        machine_name = sp.machine.name if sp.machine else "Unknown"
        print(f"  Product: '{product_name}'")
        print(f"  Machine: {machine_name}")
        print(f"  Good: {sp.good_quantity}, Reject: {sp.reject_quantity}")
        print(f"  Work Order: {sp.work_order.wo_number if sp.work_order else 'None'}")
        print()
    
    # Get weekly production plans for May 2026
    start_date = datetime.date(2026, 5, 1)
    end_date = datetime.date(2026, 5, 31)
    
    weekly_plans = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.year == 2026,
        WeeklyProductionPlan.status.in_(['approved', 'in_progress', 'completed']),
        db.and_(
            WeeklyProductionPlan.week_start <= end_date,
            WeeklyProductionPlan.week_end >= start_date
        )
    ).all()
    
    print("\n2. WEEKLY PRODUCTION PLAN ITEMS FOR MAY 2026")
    print("-" * 80)
    for plan in weekly_plans:
        print(f"Plan: {plan.plan_number}, Week {plan.week_number}")
        for item in plan.items.all():
            product_name = item.product.name if item.product else "Unknown"
            machine_name = item.machine.name if item.machine else "Unknown"
            print(f"  Product: '{product_name}'")
            print(f"  Machine: {machine_name}")
            print(f"  Quantity: {item.planned_quantity} {item.uom}")
            print()
    
    print("\n3. UNIQUE PRODUCT NAMES")
    print("-" * 80)
    shift_products = set()
    for sp in ShiftProduction.query.filter(
        ShiftProduction.production_date >= start_date,
        ShiftProduction.production_date <= end_date
    ).all():
        if sp.product:
            shift_products.add(sp.product.name)
    
    plan_products = set()
    for plan in weekly_plans:
        for item in plan.items.all():
            if item.product:
                plan_products.add(item.product.name)
    
    print("Products in ShiftProduction:")
    for p in sorted(shift_products):
        print(f"  - '{p}'")
    
    print("\nProducts in WeeklyProductionPlan:")
    for p in sorted(plan_products):
        print(f"  - '{p}'")
    
    print("\nProducts in ShiftProduction but NOT in WeeklyProductionPlan:")
    for p in sorted(shift_products - plan_products):
        print(f"  - '{p}'")
    
    print("\nProducts in WeeklyProductionPlan but NOT in ShiftProduction:")
    for p in sorted(plan_products - shift_products):
        print(f"  - '{p}'")
    
    print("=" * 80)
