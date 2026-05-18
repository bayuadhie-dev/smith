#!/usr/bin/env python
"""
Fix Record 285 - Change from WETKINS BABY PINK to WETKINS BABY BLUE
Date: May 6, 2026
Machine: Mesin 8
Shift: shift_2
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from models.production import ShiftProduction
from models.product import Product

print("=" * 80)
print("FIXING RECORD 285 TO CORRECT PRODUCT")
print("=" * 80)

app = create_app()

with app.app_context():
    # Get the record
    record = db.session.get(ShiftProduction, 285)
    
    if not record:
        print("❌ Record 285 not found!")
        sys.exit(1)
    
    print("\n❌ BEFORE:")
    print(f"Product ID: {record.product_id}")
    if record.product:
        print(f"Product Name: {record.product.name}")
        print(f"Product Code: {record.product.code}")
    
    # Find the correct product: WETKINS BABY BLUE 50S BND @12X2
    correct_product = Product.query.filter_by(code='4010104002').first()
    
    if not correct_product:
        print("\n❌ Correct product (4010104002) not found!")
        print("\nSearching for WETKINS BABY BLUE 50S BND @12X2...")
        blue_products = Product.query.filter(
            Product.name.like('%WETKINS BABY BLUE 50S BND @12X2%')
        ).all()
        
        if blue_products:
            print(f"\nFound {len(blue_products)} matching products:")
            for p in blue_products:
                print(f"  ID: {p.id}, Code: {p.code}, Name: {p.name}")
            
            if len(blue_products) == 1:
                correct_product = blue_products[0]
                print(f"\n✅ Using product ID: {correct_product.id}")
            else:
                print("\n❌ Multiple products found. Please specify which one to use.")
                sys.exit(1)
        else:
            print("\n❌ No matching products found!")
            sys.exit(1)
    
    # Update the record
    record.product_id = correct_product.id
    
    db.session.commit()
    
    print("\n✅ AFTER:")
    print(f"Product ID: {record.product_id}")
    print(f"Product Name: {record.product.name}")
    print(f"Product Code: {record.product.code}")
    
    print("\n✅ FIXED!")
    print("=" * 80)
