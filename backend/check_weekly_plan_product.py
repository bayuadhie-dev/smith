#!/usr/bin/env python3
"""Check actual product in Weekly Plan WPP-202605-0001"""

from app import create_app
from models import db
from models.production import WeeklyProductionPlan

app = create_app()

with app.app_context():
    plan = WeeklyProductionPlan.query.filter_by(plan_number='WPP-202605-0001').first()
    
    if not plan:
        print("Plan not found!")
        exit(1)
    
    print("=" * 80)
    print(f"Plan: {plan.plan_number}")
    print(f"Status: {plan.status}")
    print("=" * 80)
    
    for item in plan.items.all():
        print(f"\nItem ID: {item.id}")
        print(f"Product ID: {item.product_id}")
        if item.product:
            print(f"Product Name: '{item.product.name}'")
            print(f"Product Code: '{item.product.code}'")
        print(f"Quantity: {item.planned_quantity} {item.uom}")
        print(f"Machine: {item.machine.name if item.machine else 'None'}")
