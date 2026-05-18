#!/usr/bin/env python
r"""
Fix weekly plan - Delete old draft plan and create new one for May 2026
"""
import sys
import os
import sqlite3
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def fix_plan():
    basedir = os.path.abspath(os.path.dirname(__file__))
    instance_path = os.path.join(basedir, 'instance')
    db_path = os.path.join(instance_path, "erp_database.db")
    
    print(f"Database: {db_path}\n")
    print("="*80)
    print("FIX WEEKLY PLAN FOR MAY 2026")
    print("="*80)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Step 1: Delete old draft plan (WPP-202512-0001)
    print("\nStep 1: Checking existing plans...")
    cursor.execute("SELECT id, plan_number, status FROM weekly_production_plans WHERE id = 1")
    old_plan = cursor.fetchone()
    
    if old_plan:
        plan_id, plan_number, status = old_plan
        print(f"Found: {plan_number} (Status: {status})")
        
        if status == 'draft':
            print("Deleting draft plan...")
            cursor.execute("DELETE FROM weekly_production_plan_items WHERE plan_id = ?", (plan_id,))
            cursor.execute("DELETE FROM weekly_production_plans WHERE id = ?", (plan_id,))
            print(f"✅ Deleted {plan_number}")
        else:
            print(f"⚠️  Plan status is '{status}', not deleting")
    
    # Step 2: Create new plan for May 2026
    print("\nStep 2: Creating new plan for May 2026...")
    
    # Get admin user ID (usually 1)
    cursor.execute("SELECT id FROM users WHERE username = 'admin' OR id = 1 LIMIT 1")
    user = cursor.fetchone()
    user_id = user[0] if user else 1
    
    # May 2026 Week 1: May 4-10 (ISO week 19)
    year = 2026
    week_number = 19  # ISO week number
    week_start = date(2026, 5, 4)
    week_end = date(2026, 5, 10)
    plan_number = f"WPP-202605-0001"  # May 2026
    
    cursor.execute("""
        INSERT INTO weekly_production_plans 
        (plan_number, year, week_number, week_start, week_end, status, created_by, approved_by, 
         approved_at, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))
    """, (plan_number, year, week_number, week_start, week_end, 'approved', user_id, user_id,
          'Weekly plan for May 2026 Week 1 (May 4-10)'))
    
    plan_id = cursor.lastrowid
    print(f"✅ Created: {plan_number} (ID: {plan_id})")
    print(f"   Period: {week_start} to {week_end}")
    print(f"   Status: approved")
    
    # Step 3: Add items from existing WOs
    print("\nStep 3: Adding items from existing May 2026 WOs...")
    
    # Get products from WOs in May 2026
    cursor.execute("""
        SELECT DISTINCT 
            wo.product_id, 
            wo.machine_id, 
            wo.quantity,
            wo.uom,
            DATE(wo.scheduled_start_date) as start_date,
            p.name as product_name,
            p.pack_per_karton,
            m.name as machine_name
        FROM work_orders wo
        LEFT JOIN products p ON wo.product_id = p.id
        LEFT JOIN machines m ON wo.machine_id = m.id
        WHERE wo.scheduled_start_date >= '2026-05-04' 
        AND wo.scheduled_start_date <= '2026-05-10'
        AND wo.source_type = 'from_schedule'
        ORDER BY wo.scheduled_start_date
        LIMIT 5
    """)
    
    wo_data = cursor.fetchall()
    
    if not wo_data:
        print("⚠️  No WOs found for May 4-10, using sample data...")
        # Get any products
        cursor.execute("""
            SELECT p.id, m.id, 5000, 'pcs', '2026-05-05', p.name, p.pack_per_karton, m.name
            FROM products p, machines m
            LIMIT 3
        """)
        wo_data = cursor.fetchall()
    
    items_added = 0
    for idx, row in enumerate(wo_data, 1):
        product_id, machine_id, quantity, uom, planned_date, product_name, pack_per_ctn, machine_name = row
        
        # Convert to pcs if needed
        if uom == 'pack' and pack_per_ctn:
            quantity = float(quantity) * float(pack_per_ctn)
            uom = 'pcs'
        
        cursor.execute("""
            INSERT INTO weekly_production_plan_items
            (plan_id, product_id, planned_quantity, uom, priority, planned_date, machine_id, 
             material_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        """, (plan_id, product_id, quantity, uom, idx, planned_date, machine_id, 'available'))
        
        item_id = cursor.lastrowid
        items_added += 1
        
        target_ctn = float(quantity) / float(pack_per_ctn or 50)
        
        print(f"\n  Item {idx} (ID: {item_id}):")
        print(f"    Product: {product_name}")
        print(f"    Machine: {machine_name}")
        print(f"    Quantity: {quantity} {uom} ({target_ctn:.2f} ctn)")
        print(f"    Date: {planned_date}")
    
    conn.commit()
    conn.close()
    
    print("\n" + "="*80)
    print("✅ WEEKLY PLAN FIXED SUCCESSFULLY!")
    print("="*80)
    print(f"\nPlan: {plan_number}")
    print(f"Status: approved")
    print(f"Items: {items_added}")
    print(f"\nNow run:")
    print(f"  python check_may_2026_data.py")
    print(f"\nOr check Production Monitoring Dashboard for May 2026")
    print("="*80 + "\n")

if __name__ == '__main__':
    fix_plan()
