#!/usr/bin/env python
r"""
Check Monthly Schedule for May 2026
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from datetime import datetime, date
import sqlite3

app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

def check_monthly_schedule():
    with app.app_context():
        print("\n" + "="*80)
        print("CHECKING MONTHLY SCHEDULE FOR MAY 2026")
        print("="*80)
        
        # Direct SQL query
        db_path = os.path.join(instance_path, "erp_database.db")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if monthly_schedules table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='monthly_schedules'")
        if not cursor.fetchone():
            print("\n❌ Table 'monthly_schedules' does not exist")
            conn.close()
            return
        
        # Query monthly schedules for May 2026
        cursor.execute("""
            SELECT id, product_id, machine_id, target_ctn, year, month, spek_kain
            FROM monthly_schedules
            WHERE year = 2026 AND month = 5
        """)
        
        schedules = cursor.fetchall()
        
        if schedules:
            print(f"\nFound {len(schedules)} monthly schedule(s) for May 2026:")
            print("\n" + "-"*80)
            
            for schedule in schedules:
                schedule_id, product_id, machine_id, target_ctn, year, month, spek_kain = schedule
                
                # Get product name
                cursor.execute("SELECT name, code FROM products WHERE id = ?", (product_id,))
                product = cursor.fetchone()
                product_name = product[0] if product else "Unknown"
                product_code = product[1] if product else ""
                
                # Get machine name
                cursor.execute("SELECT name, code FROM machines WHERE id = ?", (machine_id,))
                machine = cursor.fetchone()
                machine_name = machine[0] if machine else "Unknown"
                
                print(f"\nSchedule ID: {schedule_id}")
                print(f"  Product: {product_name} ({product_code})")
                print(f"  Machine: {machine_name}")
                print(f"  Target: {target_ctn} cartons")
                print(f"  Spek Kain: {spek_kain or '-'}")
        else:
            print("\n❌ No monthly schedules found for May 2026")
        
        conn.close()
        
        print("\n" + "="*80)

if __name__ == '__main__':
    check_monthly_schedule()
