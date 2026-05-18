#!/usr/bin/env python
"""
Check ALL production on May 4, 2026 - Find BABY PINK
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from models.production import ShiftProduction, WorkOrder, Machine, PackingList
from models.product import Product
from datetime import datetime, date

print("=" * 80)
print("CHECK ALL PRODUCTION - MAY 4, 2026")
print("=" * 80)

app = create_app()

with app.app_context():
    target_date = date(2026, 5, 4)
    
    # Get all shift productions on May 4
    all_shifts = ShiftProduction.query.filter(
        ShiftProduction.production_date == target_date
    ).order_by(ShiftProduction.machine_id, ShiftProduction.shift).all()
    
    print(f"\nFound {len(all_shifts)} shift production(s) on May 4, 2026:")
    print()
    
    # Group by machine
    by_machine = {}
    for sp in all_shifts:
        machine_name = sp.machine.name if sp.machine else 'Unknown'
        if machine_name not in by_machine:
            by_machine[machine_name] = []
        by_machine[machine_name].append(sp)
    
    # Display by machine
    for machine_name, shifts in sorted(by_machine.items()):
        print("=" * 80)
        print(f"MACHINE: {machine_name}")
        print("=" * 80)
        
        for sp in shifts:
            is_pink = sp.product and 'PINK' in sp.product.name.upper()
            marker = "🔴 PINK" if is_pink else "🔵"
            
            print(f"\n{marker} Shift: {sp.shift} | ID: {sp.id}")
            print(f"  Product: {sp.product.name if sp.product else 'N/A'}")
            print(f"  WO: {sp.work_order.wo_number if sp.work_order else 'N/A'}")
            print(f"  Grade A: {sp.grade_a_quantity} pcs")
            if sp.pack_per_carton > 0:
                print(f"  Karton: {sp.grade_a_quantity // sp.pack_per_carton}")
        print()
    
    # Find BABY PINK specifically
    print("\n" + "=" * 80)
    print("BABY PINK PRODUCTION ON MAY 4, 2026")
    print("=" * 80)
    
    pink_shifts = [sp for sp in all_shifts if sp.product and 'BABY PINK' in sp.product.name.upper()]
    
    if pink_shifts:
        print(f"\nFound {len(pink_shifts)} BABY PINK shift(s):")
        for sp in pink_shifts:
            print(f"\n🔴 Machine: {sp.machine.name if sp.machine else 'N/A'} (ID: {sp.machine_id})")
            print(f"  Shift: {sp.shift}")
            print(f"  Product: {sp.product.name}")
            print(f"  WO: {sp.work_order.wo_number if sp.work_order else 'N/A'}")
            print(f"  Grade A: {sp.grade_a_quantity} pcs = {sp.grade_a_quantity // sp.pack_per_carton if sp.pack_per_carton > 0 else 0} ctn")
    else:
        print("\n⚠️  No BABY PINK production found on May 4, 2026")
    
    # Check Mesin 8 specifically
    print("\n" + "=" * 80)
    print("MESIN 8 CHECK")
    print("=" * 80)
    
    mesin_8_by_name = Machine.query.filter_by(name='Mesin 8').first()
    mesin_8_by_id = Machine.query.filter_by(id=7).first()
    
    print(f"\nMesin 8 by name: {mesin_8_by_name.name if mesin_8_by_name else 'NOT FOUND'} (ID: {mesin_8_by_name.id if mesin_8_by_name else 'N/A'})")
    print(f"Machine ID 7: {mesin_8_by_id.name if mesin_8_by_id else 'NOT FOUND'}")
    
    if mesin_8_by_id:
        mesin_8_shifts = [sp for sp in all_shifts if sp.machine_id == 7]
        print(f"\nMachine ID 7 has {len(mesin_8_shifts)} shift(s) on May 4:")
        for sp in mesin_8_shifts:
            print(f"  - Shift {sp.shift}: {sp.product.name if sp.product else 'N/A'}")
