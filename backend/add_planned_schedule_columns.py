#!/usr/bin/env python3
"""
Add planned_days and planned_shifts columns to weekly_production_plan_items table
"""
import sys
import os
import sqlite3

# Database path
basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, 'instance', 'erp_database.db')

print(f"Database: {db_path}")
print("=" * 80)
print("Adding planned_days and planned_shifts columns...")
print("=" * 80)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if columns already exist
    cursor.execute("PRAGMA table_info(weekly_production_plan_items)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'planned_days' in columns:
        print("✓ Column 'planned_days' already exists")
    else:
        cursor.execute("""
            ALTER TABLE weekly_production_plan_items 
            ADD COLUMN planned_days INTEGER
        """)
        print("✅ Added column 'planned_days'")
    
    if 'planned_shifts' in columns:
        print("✓ Column 'planned_shifts' already exists")
    else:
        cursor.execute("""
            ALTER TABLE weekly_production_plan_items 
            ADD COLUMN planned_shifts INTEGER
        """)
        print("✅ Added column 'planned_shifts'")
    
    conn.commit()
    print("\n✅ Migration completed successfully!")
    print("\nNote: Existing data will have NULL values for these columns.")
    print("You can update them manually or through the UI.")
    
except Exception as e:
    conn.rollback()
    print(f"\n❌ Error: {e}")
    
finally:
    conn.close()
