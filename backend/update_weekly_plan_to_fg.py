#!/usr/bin/env python3
"""Update Weekly Production Plan to use Finished Goods instead of WIP"""

from app import create_app
from models import db
from models.production import WeeklyProductionPlan, WeeklyProductionPlanItem

app = create_app()

# Mapping WIP to Finished Goods
WIP_TO_FG_MAPPING = {
    378: 169,  # WIP OCTENIC 4S -> OCTENIC 4S
    336: 164,  # WIP GLOVECLEAN 2S -> GLOVECLEAN BODY WASH GLOVE 2S @96
    288: 92,   # WIP WETKINS BABY PINK 50S -> WETKINS BABY PINK 50S BND @12X2
}

with app.app_context():
    print("=" * 80)
    print("UPDATE WEEKLY PRODUCTION PLAN - WIP TO FINISHED GOODS")
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
    print("ITEMS TO UPDATE:")
    print("-" * 80)
    
    updated_count = 0
    skipped_count = 0
    
    for item in plan.items.all():
        old_product_id = item.product_id
        old_product_name = item.product.name if item.product else "Unknown"
        
        # Check if this is a WIP product that needs to be updated
        if old_product_id in WIP_TO_FG_MAPPING:
            new_product_id = WIP_TO_FG_MAPPING[old_product_id]
            
            # Get new product info
            new_product = db.session.execute(
                db.text("SELECT id, code, name, pack_per_karton FROM products WHERE id = :id"),
                {'id': new_product_id}
            ).fetchone()
            
            if new_product:
                print(f"\nItem ID: {item.id}")
                print(f"  OLD: {old_product_name} (ID: {old_product_id})")
                print(f"  NEW: {new_product[2]} (ID: {new_product_id})")
                print(f"  Machine: {item.machine.name if item.machine else 'Unknown'}")
                print(f"  Quantity: {item.planned_quantity} {item.uom}")
                
                # Update the product_id
                item.product_id = new_product_id
                updated_count += 1
            else:
                print(f"\nERROR: New product ID {new_product_id} not found!")
                skipped_count += 1
        else:
            print(f"\nSkipping: {old_product_name} (ID: {old_product_id}) - Not a WIP product")
            skipped_count += 1
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Items updated: {updated_count}")
    print(f"Items skipped: {skipped_count}")
    
    if updated_count > 0:
        confirm = input("\nDo you want to commit these changes? (yes/no): ")
        if confirm.lower() == 'yes':
            db.session.commit()
            print("\n✓ Changes committed successfully!")
        else:
            db.session.rollback()
            print("\n✗ Changes rolled back.")
    else:
        print("\nNo changes to commit.")
