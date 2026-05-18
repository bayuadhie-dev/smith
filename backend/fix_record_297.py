#!/usr/bin/env python3
"""
Fix record ID 297 - Change from WETKINS BABY PINK to WETKINS BABY BLUE
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from models.production import ShiftProduction
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
    print("FIXING RECORD ID 297")
    print("=" * 80)
    
    # Get the record
    record = ShiftProduction.query.get(297)
    
    if record:
        print(f"\n❌ CURRENT DATA:")
        print(f"   ID: {record.id}")
        print(f"   Date: {record.production_date}")
        print(f"   Machine: {record.machine.name if record.machine else 'Unknown'}")
        print(f"   Shift: {record.shift}")
        print(f"   Product: {record.product.name if record.product else 'Unknown'} (ID: {record.product_id})")
        print(f"   Grade A: {int(record.good_quantity or 0)} pcs")
        
        # Find WETKINS BABY BLUE
        blue_product = Product.query.filter(
            Product.name.like('%WETKINS BABY BLUE%')
        ).first()
        
        if blue_product:
            print(f"\n✅ CHANGING TO:")
            print(f"   Product: {blue_product.name} (ID: {blue_product.id})")
            
            # Update
            record.product_id = blue_product.id
            
            db.session.commit()
            print(f"\n✅ FIXED! Record 297 now has WETKINS BABY BLUE")
        else:
            print(f"\n❌ ERROR: WETKINS BABY BLUE not found!")
    else:
        print(f"\n❌ Record 297 not found!")
    
    print("=" * 80)
