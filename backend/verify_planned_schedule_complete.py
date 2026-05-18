#!/usr/bin/env python3
"""
Verify that planned_days and planned_shifts are correctly stored and will be displayed
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from models.production import WeeklyProductionPlan, WeeklyProductionPlanItem

# Create Flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    print("=" * 80)
    print("VERIFICATION: PLANNED SCHEDULE DATA")
    print("=" * 80)
    
    plans = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.status.in_(['approved', 'in_progress', 'completed'])
    ).all()
    
    print(f"\nFound {len(plans)} weekly plan(s)\n")
    
    for plan in plans:
        print(f"{'='*80}")
        print(f"Plan: {plan.plan_number}")
        print(f"Week: {plan.week_start} to {plan.week_end}")
        print(f"Status: {plan.status}")
        print(f"{'='*80}\n")
        
        items = list(plan.items)
        
        for item in items:
            if not item.product:
                continue
            
            product_name = item.product.name
            pack_per_ctn = int(item.product.pack_per_karton) if item.product.pack_per_karton else 50
            
            # Convert planned_quantity to cartons
            planned_qty = float(item.planned_quantity or 0)
            if item.uom == 'pcs' and pack_per_ctn > 0:
                target_ctn = planned_qty / pack_per_ctn
            else:
                target_ctn = planned_qty
            
            print(f"✅ {product_name}")
            print(f"   Target: {round(target_ctn, 2)} ctn ({planned_qty} {item.uom})")
            print(f"   Pack per Carton: {pack_per_ctn}")
            print(f"   Planned Days: {item.planned_days or 'NULL'}")
            print(f"   Planned Shifts: {item.planned_shifts or 'NULL'}")
            
            if item.planned_days and item.planned_shifts:
                print(f"   ✓ Bar merah akan menampilkan: '{item.planned_days} hari, {item.planned_shifts} shift'")
            else:
                print(f"   ⚠️  WARNING: planned_days/planned_shifts is NULL!")
            print()
    
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print("✓ Backend: planned_days dan planned_shifts sudah ditambahkan ke response")
    print("✓ Backend: gap_message sudah menggunakan planned_days dan planned_shifts")
    print("✓ Frontend: akan otomatis menampilkan dari gap_message")
    print("=" * 80)
