#!/usr/bin/env python
"""
Check ALL Packing Lists in May 2026 to find BABY PINK
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from models.production import PackingList, PackingListNew
from datetime import datetime

print("=" * 80)
print("CHECKING ALL PACKING LISTS IN MAY 2026")
print("=" * 80)

app = create_app()

with app.app_context():
    # Check all PackingList in May
    start_date = datetime(2026, 5, 1).date()
    end_date = datetime(2026, 5, 31).date()
    
    print("\n1. OLD PACKING LISTS (PackingList)")
    print("-" * 80)
    
    old_pls = PackingList.query.filter(
        db.func.date(PackingList.created_at) >= start_date,
        db.func.date(PackingList.created_at) <= end_date
    ).order_by(PackingList.created_at).all()
    
    print(f"\nFound {len(old_pls)} packing lists in May 2026:")
    
    pink_found = False
    for pl in old_pls:
        wo_num = pl.work_order.wo_number if pl.work_order else 'N/A'
        created = pl.created_at.strftime('%Y-%m-%d %H:%M')
        
        is_pink = 'PINK' in pl.product_name.upper()
        marker = "🔴 PINK" if is_pink else "🔵 BLUE"
        
        print(f"\n{marker} ID: {pl.id}, WO: {wo_num}, Created: {created}")
        print(f"     Product: {pl.product_name}")
        print(f"     Total Karton: {pl.total_karton}")
        
        if is_pink:
            pink_found = True
    
    if not pink_found:
        print("\n⚠️  NO BABY PINK PACKING LIST FOUND!")
        print("     Shift 1 BABY PINK needs a packing list!")
    
    # Check PackingListNew
    print("\n\n2. NEW PACKING LISTS (PackingListNew)")
    print("-" * 80)
    
    new_pls = PackingListNew.query.filter(
        db.func.date(PackingListNew.created_at) >= start_date,
        db.func.date(PackingListNew.created_at) <= end_date
    ).order_by(PackingListNew.created_at).all()
    
    print(f"\nFound {len(new_pls)} new packing lists in May 2026:")
    
    for pl in new_pls:
        prod_name = pl.product.name if pl.product else 'N/A'
        created = pl.created_at.strftime('%Y-%m-%d %H:%M')
        
        is_pink = 'PINK' in prod_name.upper()
        marker = "🔴 PINK" if is_pink else "🔵 BLUE"
        
        print(f"\n{marker} ID: {pl.id}, PL#: {pl.pl_number}, Created: {created}")
        print(f"     Product: {prod_name}")
        print(f"     Status: {pl.status}")
    
    print("\n" + "=" * 80)
    print("RECOMMENDATION:")
    print("=" * 80)
    
    if not pink_found:
        print("\n⚠️  MISSING: Packing List for BABY PINK (Shift 1)")
        print("\n💡 Options:")
        print("   1. Create new PackingList for BABY PINK shift 1")
        print("   2. Keep PackingList ID 199 as BABY PINK (don't change it)")
        print("   3. Check if BABY PINK packing list exists elsewhere")
