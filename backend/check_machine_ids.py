#!/usr/bin/env python3
"""
Check machine IDs for May 7, 2026
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
    print("MACHINE IDs - MAY 7, 2026")
    print("=" * 80)
    
    target_date = date(2026, 5, 7)
    
    shifts = ShiftProduction.query.filter(
        ShiftProduction.production_date == target_date
    ).order_by(
        ShiftProduction.shift,
        ShiftProduction.machine_id
    ).all()
    
    for sp in shifts:
        product_name = sp.product.name if sp.product else 'Unknown'
        machine_name = sp.machine.name if sp.machine else 'Unknown'
        
        print(f"ID: {sp.id} | Machine ID: {sp.machine_id} | Machine: {machine_name} | Shift: {sp.shift} | Product: {product_name}")
    
    print("=" * 80)
