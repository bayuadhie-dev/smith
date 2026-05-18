#!/usr/bin/env python
"""
Check Mesin 8 production on May 3, 2026 - Find WIP BABY PINK
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from models.production import ShiftProduction, WorkOrder, Machine
from models.product import Product
from datetime import date

print("=" * 80)
print("CHECK MESIN 8 - MAY 3, 2026")
print("=" * 80)

app = create_app()

with app.app_context():
    # Find Mesin 8 by name and ID 7
    mesin_8_by_name = Machine.query.filter_by(name='Mesin 8').first()
    mesin_8_by_id = Machine.query.filter_by(id=7).first()
    
    print(f"\nMesin 8 by name: {mesin_8_by_name.name if mesin_8_by_name else 'NOT FOUND'} (ID: {mesin_8_by_name.id if mesin_8_by_name else 'N/A'})")
    print(f"Machine ID 7: {mesin_8_by_id.name if mesin_8_by_id else 'NOT FOUND'}")
    
    # Use ID 7 as user mentioned
    machine_id = 7
    
    # Check May 3
    target_date = date(2026, 5, 3)
    
    shifts_may_3 = ShiftProduction.query.filter(
        ShiftProduction.machine_id == machine_id,
        ShiftProduction.production_date == target_date
    ).order_by(ShiftProduction.shift).all()
    
    print(f"\n{'=' * 80}")
    print(f"MAY 3, 2026 - Machine ID {machine_id}")
    print(f"{'=' * 80}")
    print(f"\nFound {len(shifts_may_3)} shift production(s):")
    
    for sp in shifts_may_3:
        is_wip = sp.product and 'WIP' in sp.product.name.upper()
        is_pink = sp.product and 'PINK' in sp.product.name.upper()
        marker = "🔴 WIP PINK" if (is_wip and is_pink) else "🔵"
        
        print(f"\n{marker} RECORD ID: {sp.id}")
        print(f"  Date: {sp.production_date}")
        print(f"  Shift: {sp.shift}")
        print(f"  Machine: {sp.machine.name if sp.machine else 'N/A'} (ID: {sp.machine_id})")
        print(f"  Product: {sp.product.name if sp.product else 'N/A'} (ID: {sp.product_id})")
        print(f"  WO: {sp.work_order.wo_number if sp.work_order else 'N/A'}")
        print(f"  Good Quantity: {sp.good_quantity} pcs")
        print(f"  Pack per Carton: {sp.pack_per_carton}")
        if sp.pack_per_carton > 0:
            print(f"  Karton: {sp.good_quantity // sp.pack_per_carton}")
    
    # Find WETKINS BABY PINK 50S BND product
    print(f"\n{'=' * 80}")
    print("FIND TARGET PRODUCT")
    print(f"{'=' * 80}")
    
    target_product = Product.query.filter(
        Product.name.like('%WETKINS BABY PINK 50S BND%')
    ).filter(
        ~Product.name.like('%MCT%'),
        ~Product.name.like('%@%')
    ).first()
    
    if target_product:
        print(f"\n✅ Found target product:")
        print(f"  ID: {target_product.id}")
        print(f"  Name: {target_product.name}")
        print(f"  Code: {target_product.code}")
    else:
        print("\n❌ Target product not found")
        print("\nSearching for all WETKINS BABY PINK 50S BND variants:")
        all_variants = Product.query.filter(
            Product.name.like('%WETKINS BABY PINK 50S BND%')
        ).all()
        for p in all_variants:
            print(f"  - {p.name} (ID: {p.id})")
