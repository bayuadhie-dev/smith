#!/usr/bin/env python
"""
Fix PackingList ID 199 - Change product name from BABY PINK to BABY BLUE
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from models.production import PackingList

print("=" * 80)
print("FIX PACKING LIST ID 199 - CHANGE BABY PINK TO BABY BLUE")
print("=" * 80)

app = create_app()

with app.app_context():
    # Get PackingList ID 199
    pl = db.session.get(PackingList, 199)
    
    if not pl:
        print("\n❌ PackingList ID 199 not found!")
        sys.exit(1)
    
    print("\n📦 CURRENT DATA:")
    print(f"   ID: {pl.id}")
    print(f"   WO: {pl.work_order.wo_number if pl.work_order else 'N/A'}")
    print(f"   Product Name: {pl.product_name}")
    print(f"   Total Karton: {pl.total_karton}")
    print(f"   Created: {pl.created_at}")
    
    if 'PINK' not in pl.product_name.upper():
        print("\n⚠️  This packing list is not BABY PINK!")
        print("   No changes needed.")
        sys.exit(0)
    
    # Change PINK to BLUE
    old_name = pl.product_name
    new_name = pl.product_name.replace('PINK', 'BLUE').replace('Pink', 'Blue').replace('pink', 'blue')
    
    print("\n" + "=" * 80)
    print("PROPOSED CHANGE:")
    print("=" * 80)
    print(f"   OLD: {old_name}")
    print(f"   NEW: {new_name}")
    
    # Ask for confirmation
    print("\n" + "=" * 80)
    response = input("Apply this change? (yes/no): ").strip().lower()
    
    if response != 'yes':
        print("\n❌ Change cancelled by user")
        sys.exit(0)
    
    # Apply change
    pl.product_name = new_name
    db.session.commit()
    
    print("\n" + "=" * 80)
    print("✅ SUCCESS!")
    print("=" * 80)
    print(f"   PackingList ID 199 updated")
    print(f"   New product name: {pl.product_name}")
    print("\n📋 VERIFICATION:")
    
    # Verify
    pl_verify = db.session.get(PackingList, 199)
    print(f"   ID: {pl_verify.id}")
    print(f"   Product Name: {pl_verify.product_name}")
    print(f"   WO: {pl_verify.work_order.wo_number if pl_verify.work_order else 'N/A'}")
    
    if 'BLUE' in pl_verify.product_name.upper():
        print("\n✅ Packing list name successfully changed to BABY BLUE!")
    else:
        print("\n⚠️  Warning: Product name does not contain BLUE")
