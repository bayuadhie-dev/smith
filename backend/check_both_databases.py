#!/usr/bin/env python
r"""
Check both database locations for weekly plans
"""
import sys
import os
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def check_database(db_path, db_name):
    print("\n" + "="*80)
    print(f"CHECKING: {db_name}")
    print(f"Path: {db_path}")
    print("="*80)
    
    if not os.path.exists(db_path):
        print(f"❌ Database does not exist at this path")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if weekly_production_plans table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='weekly_production_plans'")
    if not cursor.fetchone():
        print("❌ Table 'weekly_production_plans' does NOT exist")
        conn.close()
        return
    
    print("✅ Table 'weekly_production_plans' exists")
    
    # Count all weekly plans
    cursor.execute("SELECT COUNT(*) FROM weekly_production_plans")
    total_count = cursor.fetchone()[0]
    print(f"\nTotal weekly plans in database: {total_count}")
    
    if total_count > 0:
        # Show all plans
        cursor.execute("""
            SELECT id, plan_number, year, week_number, week_start, week_end, status
            FROM weekly_production_plans
            ORDER BY year DESC, week_number DESC
        """)
        plans = cursor.fetchall()
        
        print("\nAll Weekly Plans:")
        print("-" * 80)
        for plan in plans:
            plan_id, plan_number, year, week_number, week_start, week_end, status = plan
            print(f"\nID: {plan_id} | {plan_number}")
            print(f"  Year: {year} | Week: {week_number}")
            print(f"  Period: {week_start} to {week_end}")
            print(f"  Status: {status}")
            
            # Count items
            cursor.execute("SELECT COUNT(*) FROM weekly_production_plan_items WHERE plan_id = ?", (plan_id,))
            item_count = cursor.fetchone()[0]
            print(f"  Items: {item_count}")
            
            if item_count > 0:
                # Show items
                cursor.execute("""
                    SELECT product_id, planned_quantity, uom, planned_date, machine_id, work_order_id
                    FROM weekly_production_plan_items
                    WHERE plan_id = ?
                """, (plan_id,))
                items = cursor.fetchall()
                
                for item in items:
                    product_id, qty, uom, date, machine_id, wo_id = item
                    
                    # Get product name
                    cursor.execute("SELECT name FROM products WHERE id = ?", (product_id,))
                    product = cursor.fetchone()
                    product_name = product[0] if product else f"Product #{product_id}"
                    
                    # Get machine name
                    machine_name = "No Machine"
                    if machine_id:
                        cursor.execute("SELECT name FROM machines WHERE id = ?", (machine_id,))
                        machine = cursor.fetchone()
                        machine_name = machine[0] if machine else f"Machine #{machine_id}"
                    
                    print(f"    - {product_name} | {qty} {uom} | {date} | {machine_name} | WO: {wo_id}")
    
    conn.close()

if __name__ == '__main__':
    basedir = os.path.abspath(os.path.dirname(__file__))
    
    # Check database in backend root
    db1_path = os.path.join(basedir, "erp_database.db")
    check_database(db1_path, "DATABASE 1: backend/erp_database.db")
    
    # Check database in instance folder
    instance_path = os.path.join(basedir, 'instance')
    db2_path = os.path.join(instance_path, "erp_database.db")
    check_database(db2_path, "DATABASE 2: instance/erp_database.db")
    
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print("\nIf weekly plans are found in DATABASE 1 but not DATABASE 2,")
    print("it means the tables were created in the wrong database.")
    print("\nThe application uses: instance/erp_database.db")
    print("="*80 + "\n")
