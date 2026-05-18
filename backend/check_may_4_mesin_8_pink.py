#!/usr/bin/env python
"""
Check WO Mesin 8 - May 4, 2026 - WETKINS BABY PINK
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from models.production import ShiftProduction, WorkOrder, Machine, PackingList
from models.product import Product
from datetime import datetime, date

print("=" * 80)
print("CHECK WO MESIN 8 - MAY 4, 2026 - WETKINS BABY PINK")
print("=" * 80)

app = create_app()

with app.app_context():
    # Find Mesin 8
    mesin_8 = Machine.query.filter_by(name='Mesin 8').first()
    
    if not mesin_8:
        print("\n❌ Mesin 8 not found!")
        sys.exit(1)
    
    print(f"\n✅ Found Mesin 8 (ID: {mesin_8.id})")
    
    # Find shift productions on May 4, 2026
    target_date = date(2026, 5, 4)
    
    shift_prods = ShiftProduction.query.filter(
        ShiftProduction.machine_id == mesin_8.id,
        ShiftProduction.production_date == target_date
    ).order_by(ShiftProduction.shift).all()
    
    print(f"\nFound {len(shift_prods)} shift production(s) on May 4, 2026:")
    print()
    
    for idx, sp in enumerate(shift_prods, 1):
        print("=" * 80)
        print(f"RECORD #{idx} - ID: {sp.id}")
        print("=" * 80)
        print(f"Date: {sp.production_date}")
        print(f"Shift: {sp.shift}")
        print(f"Machine: {sp.machine.name} (ID: {sp.machine_id})")
        
        print(f"\n📋 Work Order:")
        if sp.work_order:
            print(f"  WO Number: {sp.work_order.wo_number}")
            print(f"  Status: {sp.work_order.status}")
            print(f"  Product: {sp.work_order.product.name if sp.work_order.product else 'N/A'}")
        else:
            print("  No work order linked")
        
        print(f"\n📦 Product:")
        if sp.product:
            print(f"  Name: {sp.product.name}")
            print(f"  Code: {sp.product.code}")
            is_pink = 'PINK' in sp.product.name.upper()
            print(f"  Is BABY PINK: {'✅ YES' if is_pink else '❌ NO'}")
        else:
            print("  No product linked")
        
        print(f"\n📊 Production:")
        print(f"  Grade A: {sp.grade_a_quantity}")
        print(f"  Grade B: {sp.grade_b_quantity}")
        print(f"  Grade C: {sp.grade_c_quantity}")
        print(f"  Pack per Carton: {sp.pack_per_carton}")
        if sp.pack_per_carton > 0:
            print(f"  Karton (Grade A): {sp.grade_a_quantity // sp.pack_per_carton}")
        
        print(f"\n⏱️ Time:")
        print(f"  Runtime: {sp.runtime_minutes} min")
        print(f"  Downtime: {sp.downtime_minutes} min")
        print(f"  Idle: {sp.idle_time_minutes} min")
        print()
    
    # Check packing lists for BABY PINK on this date
    print("\n" + "=" * 80)
    print("PACKING LISTS FOR BABY PINK")
    print("=" * 80)
    
    # Find all BABY PINK products
    pink_products = Product.query.filter(
        Product.name.like('%BABY PINK%')
    ).all()
    
    print(f"\nFound {len(pink_products)} BABY PINK product(s):")
    for prod in pink_products:
        print(f"  - {prod.name} (ID: {prod.id})")
    
    # Find packing lists created around May 4
    start_date = datetime(2026, 5, 4).date()
    end_date = datetime(2026, 5, 5).date()
    
    packing_lists = PackingList.query.filter(
        db.func.date(PackingList.created_at) >= start_date,
        db.func.date(PackingList.created_at) <= end_date
    ).all()
    
    print(f"\nPacking lists created on May 4-5:")
    for pl in packing_lists:
        is_pink = 'PINK' in pl.product_name.upper()
        marker = "🔴 PINK" if is_pink else "🔵 OTHER"
        print(f"\n{marker} ID: {pl.id}")
        print(f"  WO: {pl.work_order.wo_number if pl.work_order else 'N/A'}")
        print(f"  Product: {pl.product_name}")
        print(f"  Total Karton: {pl.total_karton}")
        print(f"  Created: {pl.created_at}")
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    pink_shifts = [sp for sp in shift_prods if sp.product and 'PINK' in sp.product.name.upper()]
    
    if pink_shifts:
        print(f"\n✅ Found {len(pink_shifts)} shift(s) producing BABY PINK:")
        for sp in pink_shifts:
            print(f"  - Shift {sp.shift}: {sp.product.name}")
            print(f"    WO: {sp.work_order.wo_number if sp.work_order else 'N/A'}")
            print(f"    Grade A: {sp.grade_a_quantity} pcs = {sp.grade_a_quantity // sp.pack_per_carton if sp.pack_per_carton > 0 else 0} ctn")
    else:
        print("\n⚠️  No BABY PINK production found on May 4, 2026 at Mesin 8")
