#!/usr/bin/env python3
"""
Fix pack_per_karton for WETKINS PINK
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from models.product import Product

# Create Flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    print("Fixing WETKINS PINK pack_per_karton...")
    print("-" * 80)
    
    # Fix WETKINS PINK: should be 12 (not 24)
    product = Product.query.filter_by(name='WETKINS BABY PINK 50S BND @12X2').first()
    if product:
        old_val = product.pack_per_karton
        product.pack_per_karton = 12
        print(f"✅ WETKINS PINK: {old_val} → 12")
        print(f"   Now: 14,976 pcs / 12 = 1,248 ctn ✓")
    else:
        print("❌ WETKINS PINK not found")
    
    try:
        db.session.commit()
        print("\n✅ Pack per carton updated successfully!")
    except Exception as e:
        db.session.rollback()
        print(f"\n❌ Error: {e}")
