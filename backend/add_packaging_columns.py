import sqlite3
import os

def migrate_db():
    db_path = "instance/erp_database.db"
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found!")
        return
        
    print(f"Connecting to {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check existing columns
    cursor.execute("PRAGMA table_info(mbf_report_details)")
    columns = [col[1] for col in cursor.fetchall()]
    
    new_columns = [
        "target_roll_packaging_octenic NUMERIC(15, 2) DEFAULT 0",
        "actual_roll_packaging_octenic NUMERIC(15, 2) DEFAULT 0",
        "target_roll_packaging_gloveclean NUMERIC(15, 2) DEFAULT 0",
        "actual_roll_packaging_gloveclean NUMERIC(15, 2) DEFAULT 0",
        "target_roll_sticker_octenic NUMERIC(15, 2) DEFAULT 0",
        "actual_roll_sticker_octenic NUMERIC(15, 2) DEFAULT 0",
    ]
    
    for col_def in new_columns:
        col_name = col_def.split()[0]
        if col_name not in columns:
            print(f"Adding column {col_name}...")
            try:
                cursor.execute(f"ALTER TABLE mbf_report_details ADD COLUMN {col_def}")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")
        else:
            print(f"Column {col_name} already exists.")
            
    conn.commit()
    conn.close()
    print("Database migration for packaging and sticker complete!")

if __name__ == "__main__":
    migrate_db()
