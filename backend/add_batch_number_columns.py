import sqlite3
import os

# Adjust DB_PATH to match the project structure
DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'erp_database.db')

columns = [
    ('octn_batch_number', 'VARCHAR(100)'),
    ('glvcn_batch_number', 'VARCHAR(100)'),
]

print(f"Connecting to {DB_PATH}...")
if not os.path.exists(DB_PATH):
    print(f"ERROR: Database not found at {DB_PATH}")
    exit(1)

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
print("Batch Number migration complete!")
