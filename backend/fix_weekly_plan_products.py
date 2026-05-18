#!/usr/bin/env python3
"""Fix Weekly Plan to use correct Finished Goods products"""

from app import create_app
from models import db
from models.production import WeeklyProductionPlan

app = create_app()

# Mapping WIP to FG
WIP_TO_FG = {
    378: 169,  # WIP OCTENIC 4S -> OCTENIC 4S
    336: 164,  # WIP GLOVECLEAN 2S -> GLOVECLEAN BODY WASH GLOVE 2S @96
}

with app.app_context():
    plan = WeeklyProductionPlan.query.filter_by(plan_number='WPP-202605-0001').first()
    
    if not plan:
        print("Plan not found!")
        exit(1)
    
    print("=" * 80)
    print(f"FIXING WEEKLY PLAN: {plan.plan_number}")
    print("=" * 80)
    
    updated = 0
    for item in plan.items.all():
        old_product_id = item.product_id
        old_name = item.product.name if item.product else "Unknown"
        
        if old_product_id in WIP_TO_FG:
            new_product_id = WIP_TO_FG[old_product_id]
            
            # Get new product info
            new_product = db.session.execute(
                db.text("SELECT name FROM products WHERE id = :id"),
                {'id': new_product_id}
            ).fetchone()
            
            if new_product:
                print(f"\nItem {item.id}:")
                print(f"  OLD: {old_name} (ID: {old_product_id})")
                print(f"  NEW: {new_product[0]} (ID: {new_product_id})")
                
                item.product_id = new_product_id
                updated += 1
    
    print(f"\n{'=' * 80}")
    print(f"Total items updated: {updated}")
    
    if updated > 0:
        confirm = input("\nCommit changes? (yes/no): ")
        if confirm.lower() == 'yes':
            db.session.commit()
            print("✓ Changes committed!")
        else:
            db.session.rollback()
            print("✗ Changes rolled back")
    else:
        print("No changes needed")
