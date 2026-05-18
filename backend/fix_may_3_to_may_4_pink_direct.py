#!/usr/bin/env python
"""
Fix Mesin 8 production using direct SQL:
- Change date from May 3 → May 4, 2026
- Change product from WIP WETKINS BABY PINK 50S → WETKINS BABY PINK 50S BND @12X2
- Pack per carton already correct = 12
"""
import sys
import os
import sqlite3
from datetime import datetime

DB_PATH = 'erp_database.db'

print("=" * 80)
print("FIX MESIN 8 - MAY 3 → MAY 4, 2026 (DIRECT SQL)")
print("=" * 80)

if not os.path.exists(DB_PATH):
    print(f"\n❌ Database not found: {DB_PATH}")
    sys.exit(1)

# Connect to database
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check current data
print("\n📋 BEFORE CHANGES:")

cursor.execute("""
    SELECT sp.id, sp.production_date, sp.shift, sp.product_id, p.name, 
           sp.good_quantity, sp.pack_per_carton
    FROM shift_productions sp
    LEFT JOIN products p ON sp.product_id = p.id
    WHERE sp.id IN (305, 306)
    ORDER BY sp.id
""")

records = cursor.fetchall()

if not records:
    print("\n❌ Records 305 and 306 not found!")
    conn.close()
    sys.exit(1)

for record in records:
    rec_id, prod_date, shift, prod_id, prod_name, good_qty, ppc = record
    print(f"\nRecord {rec_id}:")
    print(f"  Date: {prod_date}")
    print(f"  Shift: {shift}")
    print(f"  Product: {prod_name} (ID: {prod_id})")
    print(f"  Good Quantity: {good_qty} pcs")
    print(f"  Pack per Carton: {ppc}")
    if ppc and ppc > 0:
        print(f"  Karton: {int(good_qty / ppc)}")

# Show target product
print("\n" + "=" * 80)
print("TARGET PRODUCT:")
print("=" * 80)

cursor.execute("""
    SELECT id, name, code
    FROM products
    WHERE id = 92
""")

target = cursor.fetchone()
if target:
    print(f"\n✅ Product ID 92:")
    print(f"  Name: {target[1]}")
    print(f"  Code: {target[2]}")
else:
    print("\n❌ Product ID 92 not found!")
    conn.close()
    sys.exit(1)

# Confirm changes
print("\n" + "=" * 80)
print("PLANNED CHANGES:")
print("=" * 80)
print("\n✏️  Records 305 & 306:")
print(f"  Date: 2026-05-03 → 2026-05-04")
print(f"  Product ID: 288 (WIP WETKINS BABY PINK 50S) → 92 (WETKINS BABY PINK 50S BND @12X2)")
print(f"  Pack per Carton: 12 (no change)")

confirm = input("\n⚠️  Apply these changes? (yes/no): ").strip().lower()

if confirm != 'yes':
    print("\n❌ Changes cancelled")
    conn.close()
    sys.exit(0)

# Apply changes
print("\n🔧 Applying changes...")

try:
    updated_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    cursor.execute("""
        UPDATE shift_productions
        SET production_date = ?,
            product_id = ?,
            updated_at = ?
        WHERE id IN (305, 306)
    """, ('2026-05-04', 92, updated_at))
    
    conn.commit()
    
    print(f"\n✅ Updated {cursor.rowcount} record(s)")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    conn.rollback()
    conn.close()
    sys.exit(1)

# Verify changes
print("\n" + "=" * 80)
print("AFTER CHANGES:")
print("=" * 80)

cursor.execute("""
    SELECT sp.id, sp.production_date, sp.shift, sp.product_id, p.name, 
           sp.good_quantity, sp.pack_per_carton
    FROM shift_productions sp
    LEFT JOIN products p ON sp.product_id = p.id
    WHERE sp.id IN (305, 306)
    ORDER BY sp.id
""")

records = cursor.fetchall()

for record in records:
    rec_id, prod_date, shift, prod_id, prod_name, good_qty, ppc = record
    print(f"\nRecord {rec_id}:")
    print(f"  Date: {prod_date}")
    print(f"  Shift: {shift}")
    print(f"  Product: {prod_name} (ID: {prod_id})")
    print(f"  Good Quantity: {good_qty} pcs")
    print(f"  Pack per Carton: {ppc}")
    if ppc and ppc > 0:
        print(f"  Karton: {int(good_qty / ppc)}")

conn.close()

print("\n" + "=" * 80)
print("✅ DONE!")
print("=" * 80)
print("\nMesin 8 production on May 4, 2026:")
print("  - Shift 1: WETKINS BABY PINK 50S BND @12X2 - 143 karton")
print("  - Shift 2: WETKINS BABY PINK 50S BND @12X2 - 210 karton")
print("  - Total: 353 karton")
