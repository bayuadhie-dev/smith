#!/usr/bin/env python
"""
Create weekly_production_plans and weekly_production_plan_items tables
"""
import sys
import os
import sqlite3

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def create_tables():
    basedir = os.path.abspath(os.path.dirname(__file__))
    instance_path = os.path.join(basedir, 'instance')
    db_path = os.path.join(instance_path, "erp_database.db")
    
    print(f"Connecting to database: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        print(f"Please check if the database exists in the instance folder")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if tables exist
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='weekly_production_plans'")
    if cursor.fetchone():
        print("✅ Table 'weekly_production_plans' already exists")
    else:
        print("Creating table 'weekly_production_plans'...")
        cursor.execute('''
            CREATE TABLE weekly_production_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_number VARCHAR(50) NOT NULL UNIQUE,
                week_number INTEGER NOT NULL,
                year INTEGER NOT NULL,
                week_start DATE NOT NULL,
                week_end DATE NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'draft',
                created_by INTEGER,
                approved_by INTEGER,
                approved_at DATETIME,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (approved_by) REFERENCES users(id)
            )
        ''')
        cursor.execute('CREATE INDEX ix_weekly_plans_year_week ON weekly_production_plans(year, week_number)')
        cursor.execute('CREATE INDEX ix_weekly_plans_status ON weekly_production_plans(status)')
        print("✅ Table 'weekly_production_plans' created successfully!")
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='weekly_production_plan_items'")
    if cursor.fetchone():
        print("✅ Table 'weekly_production_plan_items' already exists")
    else:
        print("Creating table 'weekly_production_plan_items'...")
        cursor.execute('''
            CREATE TABLE weekly_production_plan_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                planned_quantity NUMERIC(15, 2) NOT NULL,
                uom VARCHAR(20) NOT NULL,
                priority INTEGER DEFAULT 1,
                planned_date DATE,
                machine_id INTEGER,
                work_order_id INTEGER,
                material_status VARCHAR(50),
                shortage_items TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (plan_id) REFERENCES weekly_production_plans(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id),
                FOREIGN KEY (machine_id) REFERENCES machines(id),
                FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
            )
        ''')
        cursor.execute('CREATE INDEX ix_weekly_plan_items_plan ON weekly_production_plan_items(plan_id)')
        cursor.execute('CREATE INDEX ix_weekly_plan_items_product ON weekly_production_plan_items(product_id)')
        print("✅ Table 'weekly_production_plan_items' created successfully!")
    
    conn.commit()
    conn.close()
    
    print("\n✅ All tables created successfully!")
    print("\nYou can now run: python check_may_2026_data.py")

if __name__ == '__main__':
    create_tables()
