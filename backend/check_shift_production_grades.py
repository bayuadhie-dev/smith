#!/usr/bin/env python3
"""
Check shift production grades for May 2026
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from models.production import ShiftProduction
from models.product import Product
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
    print("SHIFT PRODUCTION GRADES - MAY 2026")
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
        
        if product_name not in product_totals:
            product_totals[product_name] = {
                'grade_a': 0,
                'grade_b': 0,
                'grade_c': 0,
                'total': 0
            }
        
        product_totals[product_name]['grade_a'] += float(sp.good_quantity or 0)
        product_totals[product_name]['grade_b'] += float(sp.rework_quantity or 0)
        product_totals[product_name]['grade_c'] += float(sp.reject_quantity or 0)
        product_totals[product_name]['total'] += float(sp.actual_quantity or 0)
    
    print("\n" + "=" * 80)
    print("TOTALS BY PRODUCT")
    print("=" * 80)
    
    grand_total_a = 0
    grand_total_b = 0
    grand_total_c = 0
    grand_total = 0
    
    for product_name, totals in product_totals.items():
        print(f"\n{product_name}:")
        print(f"  Grade A: {totals['grade_a']:,.0f}")
        print(f"  Grade B: {totals['grade_b']:,.0f}")
        print(f"  Grade C: {totals['grade_c']:,.0f}")
        print(f"  Total: {totals['total']:,.0f}")
        
        grand_total_a += totals['grade_a']
        grand_total_b += totals['grade_b']
        grand_total_c += totals['grade_c']
        grand_total += totals['total']
    
    print("\n" + "=" * 80)
    print("GRAND TOTAL")
    print("=" * 80)
    print(f"Grade A: {grand_total_a:,.0f}")
    print(f"Grade B: {grand_total_b:,.0f}")
    print(f"Grade C: {grand_total_c:,.0f}")
    print(f"Total: {grand_total:,.0f}")
