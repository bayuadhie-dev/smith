"""
Migration script: Add new MBF report detail columns
- Panjang Kain (cloth length) for Octenic & Gloveclean
- Roll Isolasi for Octenic
- Karton for Octenic & Gloveclean

Run: python migrate_mbf_columns.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'erp_database.db')

columns_to_add = [
    # Panjang Kain
    ("target_cloth_octenic", "NUMERIC(15,2) DEFAULT 0"),
    ("target_cloth_gloveclean", "NUMERIC(15,2) DEFAULT 0"),
    ("actual_cloth_octenic", "NUMERIC(15,2) DEFAULT 0"),
    ("actual_cloth_gloveclean", "NUMERIC(15,2) DEFAULT 0"),
    # Roll Isolasi
    ("target_isolation_roll", "NUMERIC(10,2) DEFAULT 0"),
    ("actual_isolation_roll", "NUMERIC(10,2) DEFAULT 0"),
    # Karton
    ("target_karton_octenic", "NUMERIC(15,2) DEFAULT 0"),
    ("target_karton_gloveclean", "NUMERIC(15,2) DEFAULT 0"),
    ("actual_karton_octenic", "NUMERIC(15,2) DEFAULT 0"),
    ("actual_karton_gloveclean", "NUMERIC(15,2) DEFAULT 0"),
]

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get existing columns
    cursor.execute("PRAGMA table_info(mbf_report_details)")
    existing = {row[1] for row in cursor.fetchall()}
    print(f"Existing columns: {len(existing)}")
    
    added = 0
    for col_name, col_type in columns_to_add:
        if col_name not in existing:
            sql = f"ALTER TABLE mbf_report_details ADD COLUMN {col_name} {col_type}"
            print(f"  Adding: {col_name} ({col_type})")
            cursor.execute(sql)
            added += 1
        else:
            print(f"  Exists: {col_name}")
    
    conn.commit()
    conn.close()
    print(f"\nDone! Added {added} new columns.")

if __name__ == '__main__':
    migrate()
