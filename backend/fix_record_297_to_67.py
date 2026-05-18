#!/usr/bin/env python3
"""
Fix record 297 to product ID 67 (WETKINS BABY BLUE 50S BND @12X2)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from models.production import ShiftProduction

# Create Flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    print("=" * 80)
    print("FIXING RECORD 297 TO PRODUCT ID 67")
    print("=" * 80)
    
    record = ShiftProduction.query.get(297)
    
    if record:
        print(f"\n❌ BEFORE:")
        print(f"   Product ID: {record.product_id}")
        print(f"   Product Name: {record.product.name if record.product else 'Unknown'}")
        
        # Change to product ID 67
        record.product_id = 67
        
        db.session.commit()
        
        # Reload to verify
        db.session.refresh(record)
        
        print(f"\n✅ AFTER:")
        print(f"   Product ID: {record.product_id}")
        print(f"   Product Name: {record.product.name if record.product else 'Unknown'}")
        print(f"\n✅ FIXED!")
    else:
        print(f"\n❌ Record 297 not found!")
    
    print("=" * 80)
