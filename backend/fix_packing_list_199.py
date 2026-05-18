#!/usr/bin/env python
"""
Fix PackingList ID 199 - Change from BABY PINK to BABY BLUE
Because WO-202605-00221 has 2 shifts:
- Shift 1: BABY PINK (133 ctn)
- Shift 2: BABY BLUE (173 ctn)
But the packing list should be for BABY BLUE (shift 2)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from models.production import PackingList

print("=" * 80)
print("FIXING PACKING LIST ID 199 - BABY PINK TO BABY BLUE")
print("=" * 80)

app = create_app()

with app.app_context():
    pl = db.session.get(PackingList, 199)
    
    if not pl:
        print("❌ PackingList 199 not found!")
        sys.exit(1)
    
    print(f"\n❌ BEFORE:")
    print(f"   Packing List ID: {pl.id}")
    print(f"   Work Order: {pl.work_order.wo_number if pl.work_order else 'N/A'}")
    print(f"   Product Name: {pl.product_name}")
    print(f"   Total Karton: {pl.total_karton}")
    
    # Update product name
    pl.product_name = 'WETKINS BABY BLUE 50S BND @12X2'
    
    db.session.commit()
    
    print(f"\n✅ AFTER:")
    print(f"   Packing List ID: {pl.id}")
    print(f"   Work Order: {pl.work_order.wo_number if pl.work_order else 'N/A'}")
    print(f"   Product Name: {pl.product_name}")
    print(f"   Total Karton: {pl.total_karton}")
    
    print("\n" + "=" * 80)
    print("✅ FIXED!")
    print("=" * 80)
    
    print("\n📝 Summary:")
    print("  PackingList ID 199: BABY PINK → BABY BLUE")
    print("\n✅ Now the packing list structure is correct:")
    print("  - Shift 1 (BABY PINK): Separate production")
    print("  - Shift 2a + 2b (BABY BLUE): Combined in PackingList 199 & 200")
