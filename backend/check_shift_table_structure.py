#!/usr/bin/env python3
"""
Check shift_productions table structure
"""
import sys
import os
import sqlite3

# Database path
basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, 'instance', 'erp_database.db')

print(f"Database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get table structure
cursor.execute("PRAGMA table_info(shift_productions)")
columns = cursor.fetchall()

print("\nshift_productions table columns:")
print("-" * 80)
for col in columns:
    col_id, name, col_type, not_null, default_val, pk = col
    print(f"{name:30} {col_type:15} {'NOT NULL' if not_null else ''}")

# Get sample data
cursor.execute("""
    SELECT id, production_date, shift, product_id, good_quantity, actual_quantity, pack_per_carton
    FROM shift_productions
    WHERE production_date >= '2026-05-01' AND production_date <= '2026-05-31'
    LIMIT 5
""")

print("\n" + "=" * 80)
print("SAMPLE DATA")
print("=" * 80)
rows = cursor.fetchall()
for row in rows:
    print(f"\nID: {row[0]}")
    print(f"Date: {row[1]} | Shift: {row[2]}")
    print(f"Product ID: {row[3]}")
    print(f"Good Qty: {row[4]} pcs")
    print(f"Actual Qty: {row[5]} pcs")
    print(f"Pack per Carton: {row[6]}")
    if row[6] and row[6] > 0:
        print(f"Calculated Cartons: {float(row[4]) / float(row[6]):.2f} ctn")

conn.close()
