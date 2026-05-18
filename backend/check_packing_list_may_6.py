#!/usr/bin/env python
"""
Check ALL Packing Lists for May 6, 2026 - Mesin 8 ONLY
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from models.production import PackingList, PackingListItem, PackingListNew, PackingListNewItem, WorkOrder, ShiftProduction, Machine
from datetime import datetime

print("=" * 80)
print("CHECKING PACKING LISTS - MAY 6, 2026 - MESIN 8 ONLY")
print("=" * 80)

app = create_app()

with app.app_context():
    target_date = datetime(2026, 5, 6).date()
    
    # Get Mesin 8
    mesin_8 = Machine.query.filter_by(name='Mesin 8').first()
    
    if not mesin_8:
        print("❌ Mesin 8 not found!")
        sys.exit(1)
    
    print(f"\n✅ Found Mesin 8 (ID: {mesin_8.id})")
    
    # Get all shift productions on May 6, 2026 for Mesin 8
    shift_productions = ShiftProduction.query.filter(
        ShiftProduction.machine_id == mesin_8.id,
        ShiftProduction.production_date == target_date
    ).all()
    
    print(f"\nFound {len(shift_productions)} Shift Production(s) on May 6, 2026:")
    
    wo_ids = set()
    for sp in shift_productions:
        wo_num = sp.work_order.wo_number if sp.work_order else 'N/A'
        prod_name = sp.product.name if sp.product else 'N/A'
        print(f"  - ID: {sp.id}, Shift: {sp.shift}, WO: {wo_num}, Product: {prod_name}")
        if sp.work_order_id:
            wo_ids.add(sp.work_order_id)
    
    if not wo_ids:
        print("\n⚠️  No Work Orders found for these shift productions")
        sys.exit(0)
    
    print(f"\nWork Order IDs: {wo_ids}")
    
    # Check PackingList (old) for these Work Orders
    print(f"\n" + "=" * 80)
    print(f"CHECKING OLD PACKING LISTS (PackingList)")
    print("=" * 80)
    
    old_packing_lists = PackingList.query.filter(
        PackingList.work_order_id.in_(wo_ids)
    ).order_by(PackingList.created_at).all()
    
    if old_packing_lists:
        print(f"\n📦 Found {len(old_packing_lists)} Old Packing List(s):")
        for pl in old_packing_lists:
            print(f"\n{'=' * 80}")
            print(f"Packing List ID: {pl.id}")
            print(f"Work Order: {pl.work_order.wo_number if pl.work_order else 'N/A'}")
            print(f"Product Name: {pl.product_name}")
            print(f"Total Karton: {pl.total_karton}")
            print(f"Created: {pl.created_at}")
            
            items = PackingListItem.query.filter_by(packing_list_id=pl.id).all()
            print(f"Items: {len(items)} cartons")
            
            # Check if product name is PINK
            if 'PINK' in pl.product_name.upper():
                print(f"⚠️  ⚠️  ⚠️  THIS IS BABY PINK - SHOULD BE BABY BLUE! ⚠️  ⚠️  ⚠️")
            
            if items:
                print(f"First 5 items:")
                for item in items[:5]:
                    prod_date = item.production_date.strftime('%Y-%m-%d') if item.production_date else 'N/A'
                    print(f"  - Carton #{item.carton_number}: {item.weight_kg} kg, Batch: {item.batch_number}, Date: {prod_date}")
    else:
        print(f"\n⚠️  No Old Packing List found for these Work Orders")
    
    # Check PackingListNew (new) - filter by date and check if related to these WOs
    print(f"\n" + "=" * 80)
    print(f"CHECKING NEW PACKING LISTS (PackingListNew)")
    print("=" * 80)
    
    # Get all new packing lists created on May 6
    new_packing_lists = PackingListNew.query.filter(
        db.func.date(PackingListNew.created_at) == target_date
    ).order_by(PackingListNew.created_at).all()
    
    if new_packing_lists:
        print(f"\n📦 Found {len(new_packing_lists)} New Packing List(s) on May 6, 2026:")
        for pl in new_packing_lists:
            print(f"\n{'=' * 80}")
            print(f"Packing List ID: {pl.id}")
            print(f"PL Number: {pl.pl_number}")
            print(f"Product: {pl.product.name if pl.product else 'N/A'}")
            print(f"Product Code: {pl.product.code if pl.product else 'N/A'}")
            print(f"Status: {pl.status}")
            print(f"Created: {pl.created_at}")
            
            items = PackingListNewItem.query.filter_by(packing_list_id=pl.id).all()
            print(f"Items: {len(items)} cartons")
            
            # Check if this is BABY PINK
            if pl.product and 'PINK' in pl.product.name.upper():
                print(f"⚠️  ⚠️  ⚠️  THIS IS BABY PINK - SHOULD BE BABY BLUE! ⚠️  ⚠️  ⚠️")
            
            if items:
                print(f"First 5 items:")
                for item in items[:5]:
                    weigh_date = item.weigh_date.strftime('%Y-%m-%d') if item.weigh_date else 'N/A'
                    print(f"  - Carton #{item.carton_number}: {item.weight_kg} kg, Weigh Date: {weigh_date}")
    else:
        print(f"\n⚠️  No New Packing List found on May 6, 2026")
    
    print("\n" + "=" * 80)
    print("CHECK COMPLETED")
    print("=" * 80)


