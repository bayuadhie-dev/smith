#!/usr/bin/env python
"""
Verify May 4 data in database
"""
import sys
import os
import sqlite3

DB_PATH = 'instance/erp_database.db'

print("=" * 80)
print("VERIFY DATABASE - MAY 3 & MAY 4, 2026")
print("=" * 80)

if not os.path.exists(DB_PATH):
    print(f"\n❌ Database not found: {DB_PATH}")
    sys.exit(1)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check records 305 and 306
print("\n📋 RECORDS 305 & 306:")

cursor.execute("""
    SELECT sp.id, sp.production_date, sp.shift, sp.machine_id, m.name as machine_name,
           sp.product_id, p.name as product_name, sp.good_quantity, sp.pack_per_carton
    FROM shift_productions sp
    LEFT JOIN machines m ON sp.machine_id = m.id
    LEFT JOIN products p ON sp.product_id = p.id
    WHERE sp.id IN (305, 306)
    ORDER BY sp.id
""")

records = cursor.fetchall()

for record in records:
    rec_id, prod_date, shift, mach_id, mach_name, prod_id, prod_name, good_qty, ppc = record
    print(f"\nRecord {rec_id}:")
    print(f"  Date: {prod_date}")
    print(f"  Shift: {shift}")
    print(f"  Machine: {mach_name} (ID: {mach_id})")
    print(f"  Product: {prod_name} (ID: {prod_id})")
    print(f"  Good Quantity: {good_qty} pcs")
    print(f"  Pack per Carton: {ppc}")
    if ppc and ppc > 0:
        print(f"  Karton: {int(good_qty / ppc)}")

# Check all May 3 data for Machine 7
print("\n" + "=" * 80)
print("ALL MAY 3, 2026 DATA - MACHINE 7:")
print("=" * 80)

cursor.execute("""
    SELECT sp.id, sp.shift, p.name, sp.good_quantity, sp.pack_per_carton
    FROM shift_productions sp
    LEFT JOIN products p ON sp.product_id = p.id
    WHERE sp.production_date = '2026-05-03'
    AND sp.machine_id = 7
    ORDER BY sp.shift
""")

may_3_records = cursor.fetchall()

if may_3_records:
    print(f"\nFound {len(may_3_records)} record(s):")
    for rec in may_3_records:
        rec_id, shift, prod_name, good_qty, ppc = rec
        karton = int(good_qty / ppc) if ppc and ppc > 0 else 0
        print(f"  - ID {rec_id}, {shift}: {prod_name} - {karton} karton")
else:
    print("\n✅ No records found (correct!)")

# Check all May 4 data for Machine 7
print("\n" + "=" * 80)
print("ALL MAY 4, 2026 DATA - MACHINE 7:")
print("=" * 80)

cursor.execute("""
    SELECT sp.id, sp.shift, p.name, sp.good_quantity, sp.pack_per_carton
    FROM shift_productions sp
    LEFT JOIN products p ON sp.product_id = p.id
    WHERE sp.production_date = '2026-05-04'
    AND sp.machine_id = 7
    ORDER BY sp.shift
""")

may_4_records = cursor.fetchall()

if may_4_records:
    print(f"\nFound {len(may_4_records)} record(s):")
    for rec in may_4_records:
        rec_id, shift, prod_name, good_qty, ppc = rec
        karton = int(good_qty / ppc) if ppc and ppc > 0 else 0
        print(f"  - ID {rec_id}, {shift}: {prod_name} - {karton} karton")
else:
    print("\n⚠️  No records found!")

conn.close()

print("\n" + "=" * 80)
