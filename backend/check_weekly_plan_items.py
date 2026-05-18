#!/usr/bin/env python3
"""
Check weekly plan items in database
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

# Get weekly plan
cursor.execute("""
    SELECT id, plan_number, week_number, week_start, week_end, status
    FROM weekly_production_plans
    WHERE plan_number = 'WPP-202605-0001'
""")

plan = cursor.fetchone()
if plan:
    plan_id, plan_number, week_number, week_start, week_end, status = plan
    print(f"\nPlan: {plan_number}")
    print(f"ID: {plan_id}")
    print(f"Week: {week_number} ({week_start} to {week_end})")
    print(f"Status: {status}")
    
    # Get items
    cursor.execute("""
        SELECT wpi.id, wpi.product_id, p.name, wpi.planned_quantity, wpi.uom, p.pack_per_karton
        FROM weekly_production_plan_items wpi
        LEFT JOIN products p ON wpi.product_id = p.id
        WHERE wpi.plan_id = ?
    """, (plan_id,))
    
    items = cursor.fetchall()
    print(f"\nItems in database: {len(items)}")
    
    for item in items:
        item_id, product_id, product_name, planned_qty, uom, pack_per_ctn = item
        print(f"\nItem ID: {item_id}")
        print(f"  Product ID: {product_id}")
        print(f"  Product Name: {product_name}")
        print(f"  Planned Qty: {planned_qty} {uom}")
        print(f"  Pack per Ctn: {pack_per_ctn}")
        
        if pack_per_ctn and uom == 'pcs':
            target_ctn = float(planned_qty) / int(pack_per_ctn)
            print(f"  Target CTN: {target_ctn:.2f}")
else:
    print("Plan not found!")

conn.close()
