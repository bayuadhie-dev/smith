#!/usr/bin/env python
r"""
Create test weekly production plan for May 2026
"""
import sys
import os
import sqlite3
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def create_test_plan():
    basedir = os.path.abspath(os.path.dirname(__file__))
    instance_path = os.path.join(basedir, 'instance')
    db_path = os.path.join(instance_path, "erp_database.db")
    
    print(f"Connecting to: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Week 1 of May 2026: May 4-10
    year = 2026
    week_number = 1
    week_start = date(2026, 5, 4)
    week_end = date(2026, 5, 10)
    
    print(f"\nCreating Weekly Plan for May 2026, Week {week_number}")
    print(f"Period: {week_start} to {week_end}")
    
    # Check if plan already exists
    cursor.execute("""
        SELECT id, plan_number, status FROM weekly_production_plans
        WHERE year = ? AND week_number = ?
    """, (year, week_number))
    
    existing = cursor.fetchone()
    if existing:
        plan_id, plan_number, status = existing
        print(f"\n⚠️  Plan already exists: {plan_number} (Status: {status})")
        
        # Ask if want to update
        print("\nOptions:")
        print("1. Delete and recreate")
        print("2. Keep existing")
        choice = input("Choose (1/2): ").strip()
        
        if choice == "1":
            cursor.execute("DELETE FROM weekly_production_plan_items WHERE plan_id = ?", (plan_id,))
            cursor.execute("DELETE FROM weekly_production_plans WHERE id = ?", (plan_id,))
            print(f"✅ Deleted existing plan")
        else:
            print("Keeping existing plan")
            conn.close()
            return
    
    # Create new plan
    plan_number = f"WPP-{year}{week_number:02d}-0001"
    
    cursor.execute("""
        INSERT INTO weekly_production_plans 
        (plan_number, year, week_number, week_start, week_end, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    """, (plan_number, year, week_number, week_start, week_end, 'approved', 'Test plan for May 2026'))
    
    plan_id = cursor.lastrowid
    print(f"\n✅ Created plan: {plan_number} (ID: {plan_id})")
    
    # Get products and machines from existing WOs
    cursor.execute("""
        SELECT DISTINCT wo.product_id, wo.machine_id, p.name, m.name, p.pack_per_karton
        FROM work_orders wo
        LEFT JOIN products p ON wo.product_id = p.id
        LEFT JOIN machines m ON wo.machine_id = m.id
        WHERE wo.scheduled_start_date >= ? AND wo.scheduled_start_date <= ?
        AND wo.source_type = 'from_schedule'
        LIMIT 3
    """, (f"{week_start} 00:00:00", f"{week_end} 23:59:59"))
    
    products = cursor.fetchall()
    
    if not products:
        print("\n⚠️  No products found from existing WOs")
        print("Using default products...")
        
        # Get any products
        cursor.execute("""
            SELECT id, name, pack_per_karton FROM products LIMIT 3
        """)
        products_data = cursor.fetchall()
        
        cursor.execute("SELECT id, name FROM machines LIMIT 1")
        machine_data = cursor.fetchone()
        machine_id = machine_data[0] if machine_data else 1
        
        products = [(p[0], machine_id, p[1], machine_data[1] if machine_data else "Machine", p[2]) 
                    for p in products_data]
    
    # Add items to plan
    print(f"\nAdding {len(products)} items to plan:")
    
    for idx, (product_id, machine_id, product_name, machine_name, pack_per_ctn) in enumerate(products, 1):
        planned_quantity = 5000 + (idx * 1000)  # 6000, 7000, 8000
        planned_date = date(2026, 5, 4 + idx)  # May 5, 6, 7
        
        cursor.execute("""
            INSERT INTO weekly_production_plan_items
            (plan_id, product_id, planned_quantity, uom, priority, planned_date, machine_id, 
             material_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        """, (plan_id, product_id, planned_quantity, 'pcs', idx, planned_date, machine_id, 'available'))
        
        item_id = cursor.lastrowid
        
        pack_per_ctn = pack_per_ctn or 50
        target_ctn = planned_quantity / pack_per_ctn
        
        print(f"  {idx}. {product_name}")
        print(f"     Machine: {machine_name}")
        print(f"     Quantity: {planned_quantity} pcs ({target_ctn:.2f} ctn)")
        print(f"     Date: {planned_date}")
        print(f"     Item ID: {item_id}")
    
    conn.commit()
    conn.close()
    
    print("\n" + "="*80)
    print("✅ TEST WEEKLY PLAN CREATED SUCCESSFULLY!")
    print("="*80)
    print(f"\nPlan Number: {plan_number}")
    print(f"Status: approved")
    print(f"Items: {len(products)}")
    print(f"\nNow you can:")
    print(f"1. Generate Work Orders from this plan")
    print(f"2. Check Production Monitoring Dashboard for May 2026")
    print(f"3. Run: python check_may_2026_data.py")
    print("="*80 + "\n")

if __name__ == '__main__':
    create_test_plan()
