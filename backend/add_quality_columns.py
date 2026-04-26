import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'erp_database.db')

columns = [
    ('octn_setting_packaging', 'NUMERIC(10,2) DEFAULT 0'),
    ('octn_setting_sticker', 'NUMERIC(10,2) DEFAULT 0'),
    ('octn_grade_b', 'NUMERIC(10,2) DEFAULT 0'),
    ('octn_grade_c', 'NUMERIC(10,2) DEFAULT 0'),
    ('octn_waste_packaging', 'NUMERIC(10,2) DEFAULT 0'),
    ('octn_waste_sticker', 'NUMERIC(10,2) DEFAULT 0'),
    ('glvcn_setting_packaging', 'NUMERIC(10,2) DEFAULT 0'),
    ('glvcn_grade_b', 'NUMERIC(10,2) DEFAULT 0'),
    ('glvcn_grade_c', 'NUMERIC(10,2) DEFAULT 0'),
    ('glvcn_waste_packaging', 'NUMERIC(10,2) DEFAULT 0'),
]

print(f"Connecting to {DB_PATH}...")
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

for col_name, col_type in columns:
    try:
        cursor.execute(f"ALTER TABLE mbf_report_details ADD COLUMN {col_name} {col_type}")
        print(f"  + Added {col_name}")
    except sqlite3.OperationalError as e:
        if 'duplicate column' in str(e).lower():
            print(f"  = {col_name} already exists")
        else:
            print(f"  ! Error adding {col_name}: {e}")

conn.commit()
conn.close()
print("Quality/Waste migration complete!")
