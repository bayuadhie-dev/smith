#!/usr/bin/env python
"""
Fix Mesin 8 production:
- Change date from May 3 → May 4, 2026
- Change product from WIP WETKINS BABY PINK 50S → WETKINS BABY PINK 50S BND @12X2
- Pack per carton already correct = 12
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from models.production import ShiftProduction
from datetime import date

print("=" * 80)
print("FIX MESIN 8 - MAY 3 → MAY 4, 2026")
print("=" * 80)

app = create_app()

with app.app_context():
    # Find the two records
    record_305 = ShiftProduction.query.get(305)
    record_306 = ShiftProduction.query.get(306)
    
    if not record_305 or not record_306:
        print("\n❌ Records not found!")
        if not record_305:
            print("  - Record 305 not found")
        if not record_306:
            print("  - Record 306 not found")
        sys.exit(1)
    
    print("\n📋 BEFORE CHANGES:")
    print(f"\nRecord 305:")
    print(f"  Date: {record_305.production_date}")
    print(f"  Shift: {record_305.shift}")
    print(f"  Product: {record_305.product.name if record_305.product else 'N/A'} (ID: {record_305.product_id})")
    print(f"  Good Quantity: {record_305.good_quantity} pcs")
    print(f"  Pack per Carton: {record_305.pack_per_carton}")
    
    print(f"\nRecord 306:")
    print(f"  Date: {record_306.production_date}")
    print(f"  Shift: {record_306.shift}")
    print(f"  Product: {record_306.product.name if record_306.product else 'N/A'} (ID: {record_306.product_id})")
    print(f"  Good Quantity: {record_306.good_quantity} pcs")
    print(f"  Pack per Carton: {record_306.pack_per_carton}")
    
    # Confirm changes
    print("\n" + "=" * 80)
    print("PLANNED CHANGES:")
    print("=" * 80)
    print("\n✏️  Record 305 & 306:")
    print(f"  Date: 2026-05-03 → 2026-05-04")
    print(f"  Product ID: 288 (WIP WETKINS BABY PINK 50S) → 92 (WETKINS BABY PINK 50S BND @12X2)")
    print(f"  Pack per Carton: 12 (no change)")
    
    confirm = input("\n⚠️  Apply these changes? (yes/no): ").strip().lower()
    
    if confirm != 'yes':
        print("\n❌ Changes cancelled")
        sys.exit(0)
    
    # Apply changes
    print("\n🔧 Applying changes...")
    
    new_date = date(2026, 5, 4)
    new_product_id = 92
    
    # Update record 305
    record_305.production_date = new_date
    record_305.product_id = new_product_id
    
    # Update record 306
    record_306.production_date = new_date
    record_306.product_id = new_product_id
    
    db.session.commit()
    
    print("\n✅ Changes applied successfully!")
    
    # Verify changes
    print("\n" + "=" * 80)
    print("AFTER CHANGES:")
    print("=" * 80)
    
    # Refresh from database
    db.session.refresh(record_305)
    db.session.refresh(record_306)
    
    print(f"\nRecord 305:")
    print(f"  Date: {record_305.production_date}")
    print(f"  Shift: {record_305.shift}")
    print(f"  Product: {record_305.product.name if record_305.product else 'N/A'} (ID: {record_305.product_id})")
    print(f"  Good Quantity: {record_305.good_quantity} pcs")
    print(f"  Pack per Carton: {record_305.pack_per_carton}")
    print(f"  Karton: {int(record_305.good_quantity // record_305.pack_per_carton)}")
    
    print(f"\nRecord 306:")
    print(f"  Date: {record_306.production_date}")
    print(f"  Shift: {record_306.shift}")
    print(f"  Product: {record_306.product.name if record_306.product else 'N/A'} (ID: {record_306.product_id})")
    print(f"  Good Quantity: {record_306.good_quantity} pcs")
    print(f"  Pack per Carton: {record_306.pack_per_carton}")
    print(f"  Karton: {int(record_306.good_quantity // record_306.pack_per_carton)}")
    
    print("\n" + "=" * 80)
    print("✅ DONE!")
    print("=" * 80)
