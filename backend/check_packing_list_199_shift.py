#!/usr/bin/env python
"""
Check PackingList ID 199 - Which shift is it related to?
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from models.production import PackingList, ShiftProduction, WorkOrder
from datetime import datetime

print("=" * 80)
print("CHECK PACKING LIST ID 199 - SHIFT RELATIONSHIP")
print("=" * 80)

app = create_app()

with app.app_context():
    # Get PackingList ID 199
    pl = db.session.get(PackingList, 199)
    
    if not pl:
        print("\n❌ PackingList ID 199 not found!")
        sys.exit(1)
    
    print("\n📦 PACKING LIST ID 199:")
    print(f"   Product Name: {pl.product_name}")
    print(f"   WO: {pl.work_order.wo_number if pl.work_order else 'N/A'}")
    print(f"   WO ID: {pl.work_order_id}")
    print(f"   Total Karton: {pl.total_karton}")
    print(f"   Created: {pl.created_at}")
    
    # Get all shift productions for this work order
    if pl.work_order_id:
        wo = db.session.get(WorkOrder, pl.work_order_id)
        print(f"\n📋 WORK ORDER: {wo.wo_number}")
        print(f"   Product: {wo.product.name if wo.product else 'N/A'}")
        print(f"   Status: {wo.status}")
        
        # Get all shift productions for this WO
        shift_prods = ShiftProduction.query.filter_by(work_order_id=pl.work_order_id).all()
        
        print(f"\n🔍 SHIFT PRODUCTIONS FOR WO {wo.wo_number}:")
        print(f"   Found {len(shift_prods)} shift production(s)")
        print()
        
        for sp in shift_prods:
            print("   " + "-" * 76)
            print(f"   ID: {sp.id}")
            print(f"   Date: {sp.production_date}")
            print(f"   Shift: {sp.shift}")
            print(f"   Machine: {sp.machine.name if sp.machine else 'N/A'}")
            print(f"   Product: {sp.product.name if sp.product else 'N/A'}")
            print(f"   Grade A: {sp.grade_a_quantity}")
            print(f"   WO: {sp.work_order.wo_number if sp.work_order else 'N/A'}")
    
    print("\n" + "=" * 80)
    print("ANALYSIS:")
    print("=" * 80)
    
    if pl.work_order_id:
        shift_prods = ShiftProduction.query.filter_by(work_order_id=pl.work_order_id).all()
        
        if len(shift_prods) == 1:
            sp = shift_prods[0]
            print(f"\n✅ PackingList ID 199 is for:")
            print(f"   Shift: {sp.shift}")
            print(f"   Date: {sp.production_date}")
            print(f"   Product: {sp.product.name if sp.product else 'N/A'}")
        elif len(shift_prods) > 1:
            print(f"\n⚠️  Multiple shifts found for this WO:")
            for sp in shift_prods:
                product_name = sp.product.name if sp.product else 'N/A'
                is_pink = 'PINK' in product_name.upper()
                is_blue = 'BLUE' in product_name.upper()
                marker = "🔴 PINK" if is_pink else ("🔵 BLUE" if is_blue else "⚪")
                print(f"   {marker} Shift {sp.shift} on {sp.production_date}: {product_name}")
            
            print("\n💡 RECOMMENDATION:")
            print("   If shift 1 is BABY PINK → PackingList should be BABY PINK")
            print("   If shift 2 is BABY BLUE → PackingList should be BABY BLUE")
            print("   Current PackingList name:", pl.product_name)
    else:
        print("\n⚠️  No work order linked to this packing list")
