#!/usr/bin/env python
"""
Fix ShiftProduction ID 284 (Shift 1) - Change from BABY PINK to BABY BLUE
Also fix PackingList ID 199
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from models.production import ShiftProduction, PackingList
from models.product import Product

print("=" * 80)
print("FIXING MAY 6 SHIFT 1 - BABY PINK TO BABY BLUE")
print("=" * 80)

app = create_app()

with app.app_context():
    # Fix ShiftProduction ID 284
    print("\n1. FIXING SHIFT PRODUCTION ID 284")
    print("-" * 80)
    
    sp = db.session.get(ShiftProduction, 284)
    
    if not sp:
        print("❌ ShiftProduction 284 not found!")
    else:
        print(f"❌ BEFORE:")
        print(f"   Product ID: {sp.product_id}")
        if sp.product:
            print(f"   Product Name: {sp.product.name}")
            print(f"   Product Code: {sp.product.code}")
        
        # Find correct product
        correct_product = Product.query.filter_by(code='4010104002').first()
        
        if not correct_product:
            print("\n❌ Correct product (4010104002) not found!")
            sys.exit(1)
        
        # Update
        sp.product_id = correct_product.id
        
        print(f"\n✅ AFTER:")
        print(f"   Product ID: {sp.product_id}")
        print(f"   Product Name: {correct_product.name}")
        print(f"   Product Code: {correct_product.code}")
    
    # Fix PackingList ID 199
    print("\n\n2. FIXING PACKING LIST ID 199")
    print("-" * 80)
    
    pl = db.session.get(PackingList, 199)
    
    if not pl:
        print("❌ PackingList 199 not found!")
    else:
        print(f"❌ BEFORE:")
        print(f"   Product Name: {pl.product_name}")
        
        # Update product name
        pl.product_name = 'WETKINS BABY BLUE 50S BND @12X2'
        
        print(f"\n✅ AFTER:")
        print(f"   Product Name: {pl.product_name}")
    
    # Commit changes
    db.session.commit()
    
    print("\n" + "=" * 80)
    print("✅ ALL FIXES COMPLETED!")
    print("=" * 80)
    
    print("\n📝 Summary:")
    print("  1. ShiftProduction ID 284: BABY PINK → BABY BLUE")
    print("  2. PackingList ID 199: BABY PINK → BABY BLUE")
    print("\n⚠️  Note: Packing list items are empty (0 cartons)")
    print("     This might be normal if packing list hasn't been filled yet.")
