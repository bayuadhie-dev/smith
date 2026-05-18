#!/usr/bin/env python3
"""
Check shift production cartons for May 2026
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
    print("SHIFT PRODUCTION CARTONS - MAY 2026")
    print("=" * 80)
    
    start_date = date(2026, 5, 1)
    end_date = date(2026, 5, 31)
    
    shifts = ShiftProduction.query.filter(
        ShiftProduction.production_date >= start_date,
        ShiftProduction.production_date <= end_date
    ).order_by(ShiftProduction.production_date, ShiftProduction.shift).all()
    
    print(f"\nFound {len(shifts)} shift production records")
    print("-" * 80)
    
    # Aggregate by product
    product_totals = {}
    
    for sp in shifts:
        product_name = sp.product.name if sp.product else 'Unknown'
        
        print(f"\nDate: {sp.production_date} | Shift: {sp.shift}")
        print(f"Product: {product_name}")
        print(f"  Good Qty (A): {sp.good_quantity} pcs")
        print(f"  Good Cartons: {sp.good_cartons} ctn")
        print(f"  Rework (B): {sp.rework_quantity} pcs")
        print(f"  Reject (C): {sp.reject_quantity} pcs")
        print(f"  Total Actual: {sp.actual_quantity} pcs")
        
        if product_name not in product_totals:
            product_totals[product_name] = {
                'good_pcs': 0,
                'good_ctn': 0
            }
        
        product_totals[product_name]['good_pcs'] += float(sp.good_quantity or 0)
        product_totals[product_name]['good_ctn'] += float(sp.good_cartons or 0)
    
    print("\n" + "=" * 80)
    print("TOTALS BY PRODUCT")
    print("=" * 80)
    
    grand_total_pcs = 0
    grand_total_ctn = 0
    
    for product_name, totals in product_totals.items():
        print(f"\n{product_name}:")
        print(f"  Good (Grade A): {totals['good_pcs']:,.0f} pcs")
        print(f"  Good Cartons: {totals['good_ctn']:,.0f} ctn")
        
        grand_total_pcs += totals['good_pcs']
        grand_total_ctn += totals['good_ctn']
    
    print("\n" + "=" * 80)
    print("GRAND TOTAL")
    print("=" * 80)
    print(f"Good (Grade A): {grand_total_pcs:,.0f} pcs")
    print(f"Good Cartons: {grand_total_ctn:,.0f} ctn")
