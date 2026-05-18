#!/usr/bin/env python3
"""
Find the correct WETKINS BABY BLUE product
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from models import Product

# Create Flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    print("=" * 80)
    print("WETKINS BABY BLUE PRODUCTS")
    print("=" * 80)
    
    products = Product.query.filter(
        Product.name.like('%WETKINS BABY BLUE%')
    ).all()
    
    for p in products:
        print(f"\nID: {p.id}")
        print(f"Name: {p.name}")
        print(f"Code: {p.code}")
        print(f"Pack per Karton: {p.pack_per_karton}")
    
    print("\n" + "=" * 80)
    print("SHIFT 2 USES WHICH PRODUCT?")
    print("=" * 80)
    
    from models.production import ShiftProduction
    from datetime import date
    
    shift2 = ShiftProduction.query.filter(
        ShiftProduction.production_date == date(2026, 5, 7),
        ShiftProduction.machine_id == 7,
        ShiftProduction.shift == 'shift_2'
    ).first()
    
    if shift2:
        print(f"\nShift 2 Product ID: {shift2.product_id}")
        print(f"Shift 2 Product Name: {shift2.product.name if shift2.product else 'Unknown'}")
    
    print("=" * 80)
