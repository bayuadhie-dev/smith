#!/usr/bin/env python
r"""
Check ALL weekly plans in database (no filters)
"""
import sys
import os
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def check_all_plans():
    basedir = os.path.abspath(os.path.dirname(__file__))
    instance_path = os.path.join(basedir, 'instance')
    db_path = os.path.join(instance_path, "erp_database.db")
    
    print(f"Database: {db_path}\n")
    print("="*80)
    print("ALL WEEKLY PRODUCTION PLANS IN DATABASE")
    print("="*80)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get ALL plans
    cursor.execute("""
        SELECT id, plan_number, year, week_number, week_start, week_end, status, 
               created_at, approved_at, notes
        FROM weekly_production_plans
        ORDER BY id DESC
    """)
    
    plans = cursor.fetchall()
    
    if not plans:
        print("\n❌ NO WEEKLY PLANS FOUND IN DATABASE")
        conn.close()
        return
    
    print(f"\nTotal Plans: {len(plans)}\n")
    
    for plan in plans:
        plan_id, plan_number, year, week_number, week_start, week_end, status, created_at, approved_at, notes = plan
        
        print("-"*80)
        print(f"Plan ID: {plan_id}")
        print(f"Plan Number: {plan_number}")
        print(f"Year: {year} | Week: {week_number}")
        print(f"Period: {week_start} to {week_end}")
        print(f"Status: {status}")
        print(f"Created: {created_at}")
        print(f"Approved: {approved_at or 'Not approved'}")
        if notes:
            print(f"Notes: {notes}")
        
        # Get items
        cursor.execute("""
            SELECT id, product_id, planned_quantity, uom, planned_date, machine_id, 
                   work_order_id, material_status, priority
            FROM weekly_production_plan_items
            WHERE plan_id = ?
            ORDER BY priority, planned_date
        """, (plan_id,))
        
        items = cursor.fetchall()
        print(f"\nItems: {len(items)}")
        
        if items:
            print("\nItem Details:")
            for item in items:
                item_id, product_id, qty, uom, date, machine_id, wo_id, mat_status, priority = item
                
                # Get product name
                cursor.execute("SELECT name, code FROM products WHERE id = ?", (product_id,))
                product = cursor.fetchone()
                product_name = product[0] if product else f"Product #{product_id}"
                product_code = product[1] if product else ""
                
                # Get machine name
                machine_name = "No Machine"
                if machine_id:
                    cursor.execute("SELECT name FROM machines WHERE id = ?", (machine_id,))
                    machine = cursor.fetchone()
                    machine_name = machine[0] if machine else f"Machine #{machine_id}"
                
                # Get WO number if linked
                wo_number = "Not generated"
                if wo_id:
                    cursor.execute("SELECT wo_number, status FROM work_orders WHERE id = ?", (wo_id,))
                    wo = cursor.fetchone()
                    if wo:
                        wo_number = f"{wo[0]} (status: {wo[1]})"
                
                print(f"\n  Item #{item_id} (Priority: {priority})")
                print(f"    Product: {product_name} ({product_code})")
                print(f"    Quantity: {qty} {uom}")
                print(f"    Date: {date}")
                print(f"    Machine: {machine_name}")
                print(f"    Material Status: {mat_status}")
                print(f"    Work Order: {wo_number}")
        
        print()
    
    print("="*80)
    
    # Check for orphaned WOs (WOs with source_type from_weekly_plan but no plan link)
    print("\nCHECKING FOR ORPHANED WORK ORDERS")
    print("-"*80)
    
    cursor.execute("""
        SELECT wo.id, wo.wo_number, wo.product_id, wo.status, wo.scheduled_start_date, 
               wo.notes, p.name
        FROM work_orders wo
        LEFT JOIN products p ON wo.product_id = p.id
        WHERE wo.source_type = 'from_weekly_plan'
        ORDER BY wo.scheduled_start_date DESC
        LIMIT 20
    """)
    
    orphaned_wos = cursor.fetchall()
    
    if orphaned_wos:
        print(f"\nFound {len(orphaned_wos)} WO(s) with source_type='from_weekly_plan':\n")
        for wo in orphaned_wos:
            wo_id, wo_number, product_id, status, start_date, notes, product_name = wo
            
            # Check if this WO is linked to any plan item
            cursor.execute("""
                SELECT plan_id FROM weekly_production_plan_items WHERE work_order_id = ?
            """, (wo_id,))
            linked_plan = cursor.fetchone()
            
            link_status = f"✅ Linked to plan #{linked_plan[0]}" if linked_plan else "❌ NOT linked to any plan"
            
            print(f"  {wo_number} | {product_name} | {status}")
            print(f"    Start: {start_date}")
            print(f"    {link_status}")
            if notes:
                notes_preview = notes[:80] + "..." if len(notes) > 80 else notes
                print(f"    Notes: {notes_preview}")
            print()
    else:
        print("\n✅ No WOs with source_type='from_weekly_plan' found")
    
    conn.close()
    print("="*80)

if __name__ == '__main__':
    check_all_plans()
