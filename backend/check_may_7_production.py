#!/usr/bin/env python3
"""
Check production data for May 7, 2026
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from models.production import ShiftProduction
from datetime import date

# Create Flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    print("=" * 80)
    print("PRODUCTION DATA - MAY 7, 2026")
    print("=" * 80)
    
    target_date = date(2026, 5, 7)
    
    shifts = ShiftProduction.query.filter(
        ShiftProduction.production_date == target_date
    ).order_by(
        ShiftProduction.shift,
        ShiftProduction.product_id
    ).all()
    
    if not shifts:
        print(f"\n❌ NO PRODUCTION DATA for {target_date}")
    else:
        print(f"\nFound {len(shifts)} shift production records\n")
        
        for sp in shifts:
            product_name = sp.product.name if sp.product else 'Unknown'
            machine_name = sp.machine.name if sp.machine else 'Unknown'
            pack_per_ctn = sp.pack_per_carton or (sp.product.pack_per_karton if sp.product else 0)
            
            grade_a = float(sp.good_quantity or 0)
            grade_b = float(sp.rework_quantity or 0)
            grade_c = float(sp.reject_quantity or 0)
            total = grade_a + grade_b + grade_c
            
            cartons = grade_a / pack_per_ctn if pack_per_ctn > 0 else 0
            
            print(f"{'='*80}")
            print(f"Shift: {sp.shift} | Machine: {machine_name}")
            print(f"Product: {product_name}")
            print(f"{'='*80}")
            print(f"  Grade A: {int(grade_a)} pcs")
            print(f"  Grade B: {int(grade_b)} pcs")
            print(f"  Grade C: {int(grade_c)} pcs")
            print(f"  Total: {int(total)} pcs")
            print(f"  Pack per Carton: {pack_per_ctn}")
            print(f"  Cartons (Grade A): {cartons:.2f} ctn")
            print()
    
    print("=" * 80)
