#!/usr/bin/env python3
"""
Fix quantities in weekly plan to match target cartons
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from models.production import WeeklyProductionPlanItem
from models.product import Product

# Create Flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    print("Fixing weekly plan quantities...")
    print("-" * 80)
    
    # GLOVECLEAN: 450 ctn × 72 pcs/ctn = 32,400 pcs
    product = Product.query.filter_by(name='GLOVECLEAN BODY WASH GLOVE 2S @96').first()
    if product:
        item = WeeklyProductionPlanItem.query.filter_by(
            plan_id=2,
            product_id=product.id
        ).first()
        if item:
            old_qty = item.planned_quantity
            new_qty = 450 * 72  # 32,400 pcs
            item.planned_quantity = new_qty
            print(f"\nGLOVECLEAN:")
            print(f"  Old: {old_qty} pcs")
            print(f"  New: {new_qty} pcs (450 ctn × 72)")
            print(f"  ✅ Updated")
    
    # WETKINS BLUE: 1,236 ctn × 12 pcs/ctn = 14,832 pcs
    product = Product.query.filter_by(name='WETKINS BABY BLUE 50S BND @12X2').first()
    if product:
        item = WeeklyProductionPlanItem.query.filter_by(
            plan_id=2,
            product_id=product.id
        ).first()
        
        if item:
            old_qty = item.planned_quantity
            new_qty = 1236 * 12  # 14,832 pcs
            item.planned_quantity = new_qty
            print(f"\nWETKINS BLUE:")
            print(f"  Old: {old_qty} pcs")
            print(f"  New: {new_qty} pcs (1,236 ctn × 12)")
            print(f"  ✅ Updated")
    
    # WETKINS PINK: 1,248 ctn × 12 pcs/ctn = 14,976 pcs
    product = Product.query.filter_by(name='WETKINS BABY PINK 50S BND @12X2').first()
    if product:
        item = WeeklyProductionPlanItem.query.filter_by(
            plan_id=2,
            product_id=product.id
        ).first()
        
        if item:
            old_qty = item.planned_quantity
            new_qty = 1248 * 12  # 14,976 pcs
            item.planned_quantity = new_qty
            print(f"\nWETKINS PINK:")
            print(f"  Old: {old_qty} pcs")
            print(f"  New: {new_qty} pcs (1,248 ctn × 12)")
            print(f"  ✅ Updated")
    
    try:
        db.session.commit()
        print("\n✅ Quantities updated successfully!")
    except Exception as e:
        db.session.rollback()
        print(f"\n❌ Error: {e}")
