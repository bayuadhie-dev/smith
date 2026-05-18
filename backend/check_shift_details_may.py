#!/usr/bin/env python3
"""
Check shift production details for May 2026
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
    print("SHIFT PRODUCTION DETAILS - MAY 2026")
    print("=" * 80)
    
    start_date = date(2026, 5, 1)
    end_date = date(2026, 5, 31)
    
    shifts = ShiftProduction.query.filter(
        ShiftProduction.production_date >= start_date,
        ShiftProduction.production_date <= end_date
    ).order_by(
        ShiftProduction.production_date,
        ShiftProduction.product_id,
        ShiftProduction.shift
    ).all()
    
    print(f"\nFound {len(shifts)} shift production records\n")
    
    # Group by product
    by_product = {}
    for sp in shifts:
        product_name = sp.product.name if sp.product else 'Unknown'
        if product_name not in by_product:
            by_product[product_name] = []
        by_product[product_name].append(sp)
    
    for product_name, product_shifts in by_product.items():
        print(f"\n{'='*80}")
        print(f"PRODUCT: {product_name}")
        print(f"{'='*80}")
        
        # Group by date
        by_date = {}
        for sp in product_shifts:
            date_str = str(sp.production_date)
            if date_str not in by_date:
                by_date[date_str] = []
            by_date[date_str].append(sp)
        
        total_days = len(by_date)
        total_shifts = len(product_shifts)
        
        for date_str in sorted(by_date.keys()):
            shifts_on_date = by_date[date_str]
            shift_names = [s.shift for s in shifts_on_date]
            print(f"  {date_str}: {', '.join(shift_names)} ({len(shifts_on_date)} shift)")
        
        print(f"\n  TOTAL: {total_days} hari, {total_shifts} shift")
