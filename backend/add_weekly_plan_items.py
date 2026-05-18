#!/usr/bin/env python3
"""
Add missing items to WPP-202605-0001
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from models.production import WeeklyProductionPlan, WeeklyProductionPlanItem
from models.product import Product
from models import Machine

# Create Flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    # Get the plan
    plan = WeeklyProductionPlan.query.filter_by(plan_number='WPP-202605-0001').first()
    
    if not plan:
        print("Plan WPP-202605-0001 not found!")
        exit(1)
    
    print(f"Plan: {plan.plan_number}")
    print(f"Current items: {len(list(plan.items))}")
    
    # Products to add
    products_to_add = [
        {'name': 'GLOVECLEAN BODY WASH GLOVE 2S @96', 'qty': 43200, 'machine': 'Mesin 7'},
        {'name': 'WETKINS BABY BLUE 50S BND @12X2', 'qty': 29664, 'machine': 'Mesin 6'},
        {'name': 'WETKINS BABY PINK 50S BND @12X2', 'qty': 29952, 'machine': 'Mesin 6'},
    ]
    
    print("\nAdding items:")
    print("-" * 80)
    
    for item_data in products_to_add:
        # Find product
        product = Product.query.filter_by(name=item_data['name']).first()
        if not product:
            print(f"❌ Product '{item_data['name']}' not found!")
            continue
        
        # Find machine
        machine = Machine.query.filter_by(name=item_data['machine']).first()
        if not machine:
            print(f"❌ Machine '{item_data['machine']}' not found!")
            continue
        
        # Check if item already exists
        existing = WeeklyProductionPlanItem.query.filter_by(
            plan_id=plan.id,
            product_id=product.id
        ).first()
        
        if existing:
            print(f"⚠️  Item already exists: {product.name}")
            continue
        
        # Create new item
        new_item = WeeklyProductionPlanItem(
            plan_id=plan.id,
            product_id=product.id,
            machine_id=machine.id,
            planned_quantity=item_data['qty'],
            uom='pcs'
        )
        
        db.session.add(new_item)
        print(f"✅ Added: {product.name} - {item_data['qty']} pcs")
    
    # Commit
    try:
        db.session.commit()
        print("\n✅ All items added successfully!")
        
        # Show final count
        plan = WeeklyProductionPlan.query.filter_by(plan_number='WPP-202605-0001').first()
        print(f"\nFinal items count: {len(list(plan.items))}")
        
    except Exception as e:
        db.session.rollback()
        print(f"\n❌ Error: {e}")
