#!/usr/bin/env python3
"""
Check if there are sub_shift values in May 2026 shift production
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
    print("CHECKING SUB-SHIFT DATA - MAY 2026")
    print("=" * 80)
    
    shifts = ShiftProduction.query.filter(
        ShiftProduction.production_date >= date(2026, 5, 1),
        ShiftProduction.production_date <= date(2026, 5, 31)
    ).order_by(
        ShiftProduction.production_date,
        ShiftProduction.shift
    ).all()
    
    print(f"\nFound {len(shifts)} shift production records\n")
    
    has_subshift = False
    for sp in shifts:
        product_name = sp.product.name if sp.product else 'Unknown'
        print(f"Date: {sp.production_date} | Shift: {sp.shift} | Sub-shift: {sp.sub_shift or 'None'} | Product: {product_name}")
        if sp.sub_shift:
            has_subshift = True
    
    print("\n" + "=" * 80)
    if has_subshift:
        print("✅ Found sub-shift data")
    else:
        print("⚠️  No sub-shift data found")
    print("=" * 80)
