#!/usr/bin/env python3
"""Fix Weekly Plan - Remove GLOVECLEAN and fix OCTENIC quantity"""

from app import create_app
from models import db
from models.production import WeeklyProductionPlan, WeeklyProductionPlanItem

app = create_app()

with app.app_context():
    plan = WeeklyProductionPlan.query.filter_by(plan_number='WPP-202605-0001').first()
    
    if not plan:
        print("Plan not found!")
        exit(1)
    
    print("=" * 80)
    print(f"FIXING WEEKLY PLAN: {plan.plan_number}")
    print("=" * 80)
    
    print("\nCurrent items:")
    for item in plan.items.all():
        product_name = item.product.name if item.product else "Unknown"
        print(f"  - [{item.id}] {product_name}: {item.planned_quantity} {item.uom}")
    
    print("\n" + "-" * 80)
    print("ACTIONS:")
    print("-" * 80)
    
    # Delete all items
    deleted_count = 0
    for item in plan.items.all():
        product_name = item.product.name if item.product else "Unknown"
        print(f"  DELETE: [{item.id}] {product_name}: {item.planned_quantity} {item.uom}")
        db.session.delete(item)
        deleted_count += 1
    
    print(f"\nTotal items to delete: {deleted_count}")
    
    # Create new item for OCTENIC 4S with correct quantity
    print("\n" + "-" * 80)
    print("CREATE NEW ITEM:")
    print("-" * 80)
    
    # Get OCTENIC 4S product (ID: 169)
    # Get Mesin 7 (assuming ID: 7, adjust if needed)
    
    new_item = WeeklyProductionPlanItem(
        plan_id=plan.id,
        product_id=169,  # OCTENIC 4S
        machine_id=7,    # Mesin 7
        planned_quantity=62400,  # 62,400 pcs
        uom='pcs',
        notes='Target mingguan: 1,600 ctn (62,400 pcs / 39 pack per ctn)'
    )
    
    print(f"  CREATE: OCTENIC 4S: 62,400 pcs on Mesin 7")
    print(f"          = 1,600 ctn (62,400 / 39)")
    
    db.session.add(new_item)
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Items to delete: {deleted_count}")
    print(f"Items to create: 1")
    print(f"Net change: {1 - deleted_count}")
    
    confirm = input("\nCommit changes? (yes/no): ")
    if confirm.lower() == 'yes':
        db.session.commit()
        print("\n✓ Changes committed!")
        
        # Verify
        print("\nNew items:")
        plan = WeeklyProductionPlan.query.filter_by(plan_number='WPP-202605-0001').first()
        for item in plan.items.all():
            product_name = item.product.name if item.product else "Unknown"
            pack_per_ctn = int(item.product.pack_per_karton) if item.product and item.product.pack_per_karton else 50
            target_ctn = float(item.planned_quantity or 0) / pack_per_ctn if pack_per_ctn > 0 else 0
            print(f"  - {product_name}: {item.planned_quantity} {item.uom} = {target_ctn:.2f} ctn")
    else:
        db.session.rollback()
        print("\n✗ Changes rolled back")
