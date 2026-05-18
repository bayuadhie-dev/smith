#!/usr/bin/env python3
"""Check detailed Weekly Plan data"""

from app import create_app
from models import db
from models.production import WeeklyProductionPlan

app = create_app()

with app.app_context():
    plan = WeeklyProductionPlan.query.filter_by(plan_number='WPP-202605-0001').first()
    
    print("=" * 80)
    print(f"Plan: {plan.plan_number}")
    print("=" * 80)
    
    for item in plan.items.all():
        print(f"\nItem ID: {item.id}")
        print(f"Product: {item.product.name if item.product else 'Unknown'} (ID: {item.product_id})")
        print(f"Machine: {item.machine.name if item.machine else 'Unknown'}")
        print(f"Planned Quantity: {item.planned_quantity}")
        print(f"UOM: {item.uom}")
        
        # Check if there's order_ctn field
        if hasattr(item, 'order_ctn'):
            print(f"Order CTN: {item.order_ctn}")
        
        # Calculate target
        pack_per_ctn = int(item.product.pack_per_karton) if item.product and item.product.pack_per_karton else 50
        print(f"Pack per Carton: {pack_per_ctn}")
        
        planned_qty = float(item.planned_quantity or 0)
        if item.uom == 'pcs' and pack_per_ctn > 0:
            target_ctn = planned_qty / pack_per_ctn
        else:
            target_ctn = planned_qty
        
        print(f"Calculated Target CTN: {target_ctn}")
