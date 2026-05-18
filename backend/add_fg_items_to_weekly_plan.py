#!/usr/bin/env python3
"""Add Finished Goods items to Weekly Production Plan alongside WIP items"""

from app import create_app
from models import db
from models.production import WeeklyProductionPlan, WeeklyProductionPlanItem
import datetime

app = create_app()

# Mapping WIP to Finished Goods
WIP_TO_FG_MAPPING = {
    378: 169,  # WIP OCTENIC 4S -> OCTENIC 4S
    336: 164,  # WIP GLOVECLEAN 2S -> GLOVECLEAN BODY WASH GLOVE 2S @96
    288: 92,   # WIP WETKINS BABY PINK 50S -> WETKINS BABY PINK 50S BND @12X2
}

with app.app_context():
    print("=" * 80)
    print("ADD FINISHED GOODS ITEMS TO WEEKLY PRODUCTION PLAN")
    print("=" * 80)
    
    # Get Weekly Production Plan for May 2026
    plan = WeeklyProductionPlan.query.filter_by(
        plan_number='WPP-202605-0001'
    ).first()
    
    if not plan:
        print("ERROR: Plan WPP-202605-0001 not found!")
        exit(1)
    
    print(f"\nPlan: {plan.plan_number}")
    print(f"Week: {plan.week_number} ({plan.week_start} to {plan.week_end})")
    print(f"Status: {plan.status}")
    print(f"Total Items: {plan.items.count()}")
    
    print("\n" + "-" * 80)
    print("NEW ITEMS TO ADD:")
    print("-" * 80)
    
    new_items = []
    
    for item in plan.items.all():
        wip_product_id = item.product_id
        wip_product_name = item.product.name if item.product else "Unknown"
        
        # Check if this is a WIP product that has a FG equivalent
        if wip_product_id in WIP_TO_FG_MAPPING:
            fg_product_id = WIP_TO_FG_MAPPING[wip_product_id]
            
            # Get FG product info
            fg_product = db.session.execute(
                db.text("SELECT id, code, name, pack_per_karton FROM products WHERE id = :id"),
                {'id': fg_product_id}
            ).fetchone()
            
            if fg_product:
                print(f"\nBased on WIP item:")
                print(f"  WIP: {wip_product_name} (ID: {wip_product_id})")
                print(f"  Machine: {item.machine.name if item.machine else 'Unknown'}")
                print(f"  Quantity: {item.planned_quantity} {item.uom}")
                print(f"\nWill add FG item:")
                print(f"  FG: {fg_product[2]} (ID: {fg_product_id})")
                print(f"  Pack per Carton: {fg_product[3]}")
                
                # Create new item for FG
                new_item = WeeklyProductionPlanItem(
                    plan_id=plan.id,
                    product_id=fg_product_id,
                    machine_id=item.machine_id,
                    planned_quantity=item.planned_quantity,
                    uom=item.uom,
                    notes=f"FG equivalent of WIP item (added automatically)"
                )
                new_items.append(new_item)
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"New FG items to add: {len(new_items)}")
    
    if new_items:
        confirm = input("\nDo you want to add these items? (yes/no): ")
        if confirm.lower() == 'yes':
            for item in new_items:
                db.session.add(item)
            db.session.commit()
            print(f"\n✓ Added {len(new_items)} FG items successfully!")
            print(f"Total items in plan now: {plan.items.count()}")
        else:
            print("\n✗ Operation cancelled.")
    else:
        print("\nNo new items to add.")
