#!/usr/bin/env python3
"""
Fix pack_per_karton for WETKINS PINK using direct SQL
"""
import sys
import os
import sqlite3

# Database path
basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, 'instance', 'erp_database.db')

print(f"Database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check current value
cursor.execute("""
    SELECT id, name, pack_per_karton
    FROM products
    WHERE name = 'WETKINS BABY PINK 50S BND @12X2'
""")

product = cursor.fetchone()
if product:
    product_id, name, current_ppc = product
    print(f"\nProduct: {name}")
    print(f"ID: {product_id}")
    print(f"Current pack_per_karton: {current_ppc}")
    
    # Update to 12
    cursor.execute("""
        UPDATE products
        SET pack_per_karton = 12
        WHERE id = ?
    """, (product_id,))
    
    conn.commit()
    print(f"✅ Updated to: 12")
    
    # Verify
    cursor.execute("""
        SELECT pack_per_karton
        FROM products
        WHERE id = ?
    """, (product_id,))
    
    new_ppc = cursor.fetchone()[0]
    print(f"Verified: {new_ppc}")
    
else:
    print("❌ Product not found!")

conn.close()
