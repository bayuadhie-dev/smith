#!/usr/bin/env python3
"""Check ALL Weekly Plans for May 2026"""

from app import create_app
from models import db
from models.production import WeeklyProductionPlan

app = create_app()

with app.app_context():
    print("=" * 80)
    print("ALL WEEKLY PLANS FOR MAY 2026")
    print("=" * 80)
    
    plans = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.year == 2026,
        db.or_(
            WeeklyProductionPlan.week_start >= '2026-05-01',
            WeeklyProductionPlan.week_end <= '2026-05-31'
        )
    ).order_by(WeeklyProductionPlan.week_start).all()
    
    print(f"\nFound {len(plans)} plan(s)\n")
    
    for plan in plans:
        print(f"Plan: {plan.plan_number}")
        print(f"  Week: {plan.week_number} ({plan.week_start} to {plan.week_end})")
        print(f"  Status: {plan.status}")
        print(f"  Items: {plan.items.count()}")
        print(f"  Created: {plan.created_at}")
        
        for item in plan.items.all():
            product_name = item.product.name if item.product else "Unknown"
            product_id = item.product_id
            print(f"    - [{product_id}] '{product_name}': {item.planned_quantity} {item.uom}")
        
        print()
