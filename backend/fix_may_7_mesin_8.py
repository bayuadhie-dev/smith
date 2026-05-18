#!/usr/bin/env python3
"""
Fix May 7, 2026 - Mesin 8 shift 1 should be WETKINS BABY BLUE, not PINK
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
    print("FIXING MAY 7, 2026 - MESIN 8 SHIFT 1")
    print("=" * 80)
    
    target_date = date(2026, 5, 7)
    
    # Find the wrong record (Mesin 8, shift 1, WETKINS BABY PINK)
    wrong_shift = ShiftProduction.query.filter(
        ShiftProduction.production_date == target_date,
        ShiftProduction.machine_id == 8,
        ShiftProduction.shift == 'shift_1'
    ).first()
    
    if wrong_shift:
        print(f"\n❌ FOUND WRONG DATA:")
        print(f"   Machine: {wrong_shift.machine.name if wrong_shift.machine else 'Unknown'}")
        print(f"   Shift: {wrong_shift.shift}")
        print(f"   Current Product: {wrong_shift.product.name if wrong_shift.product else 'Unknown'}")
        print(f"   Grade A: {int(wrong_shift.good_quantity or 0)} pcs")
        
        # Find WETKINS BABY BLUE product ID
        from models import Product
        blue_product = Product.query.filter(
            Product.name.like('%WETKINS BABY BLUE%')
        ).first()
        
        if blue_product:
            print(f"\n✅ CHANGING TO:")
            print(f"   Product: {blue_product.name} (ID: {blue_product.id})")
            
            # Update the product_id
            wrong_shift.product_id = blue_product.id
            
            db.session.commit()
            print(f"\n✅ FIXED! Mesin 8 shift 1 now produces WETKINS BABY BLUE")
        else:
            print(f"\n❌ ERROR: WETKINS BABY BLUE product not found!")
    else:
        print(f"\n❌ Record not found!")
    
    print("=" * 80)
