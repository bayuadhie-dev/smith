#!/usr/bin/env python
"""
Add downtime_action_items table for tracking root cause and follow up
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from sqlalchemy import text

print("=" * 80)
print("ADD DOWNTIME ACTION ITEMS TABLE")
print("=" * 80)

app = create_app()

with app.app_context():
    print("\nCreating downtime_action_items table...")
    
    # Create table
    db.session.execute(text("""
        CREATE TABLE IF NOT EXISTS downtime_action_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            downtime_reason TEXT NOT NULL,
            machine_id INTEGER NOT NULL,
            product_id INTEGER,
            week_number INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            total_duration INTEGER NOT NULL,
            root_cause TEXT,
            follow_up TEXT,
            status TEXT DEFAULT 'pending',
            pic TEXT,
            created_by INTEGER,
            updated_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (machine_id) REFERENCES machines(id),
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (updated_by) REFERENCES users(id)
        )
    """))
    
    # Create indexes
    db.session.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_action_items_machine 
        ON downtime_action_items(machine_id)
    """))
    
    db.session.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_action_items_product 
        ON downtime_action_items(product_id)
    """))
    
    db.session.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_action_items_week 
        ON downtime_action_items(year, month, week_number)
    """))
    
    db.session.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_action_items_status 
        ON downtime_action_items(status)
    """))
    
    db.session.commit()
    
    print("✅ Table created successfully!")
    print("\nTable structure:")
    print("  - id: Primary key")
    print("  - downtime_reason: Alasan downtime")
    print("  - machine_id: Mesin yang mengalami downtime")
    print("  - product_id: Produk yang sedang dikerjakan")
    print("  - week_number: Minggu ke berapa (1-5)")
    print("  - year: Tahun")
    print("  - month: Bulan (1-12)")
    print("  - total_duration: Total durasi downtime (menit)")
    print("  - root_cause: Akar masalah (diisi saat rapat)")
    print("  - follow_up: Tindak lanjut/solusi (diisi saat rapat)")
    print("  - status: pending/in_progress/resolved")
    print("  - pic: Person in charge")
    print("  - created_by: User yang membuat")
    print("  - updated_by: User yang terakhir update")
    
    print("\n" + "=" * 80)
    print("✅ DONE!")
    print("=" * 80)
