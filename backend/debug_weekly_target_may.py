#!/usr/bin/env python3
"""
Debug script to check weekly targets for May 2026
"""
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from models.production import WeeklyProductionPlan
from models.product import Product
from datetime import datetime, timedelta

# Create Flask app instance
app = Flask(__name__)

# Configure database - use instance folder
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

print(f"Using database: {os.path.join(instance_path, 'erp_database.db')}")

db.init_app(app)

with app.app_context():
    print("=" * 80)
    print("DEBUG WEEKLY TARGETS FOR MAY 2026")
    print("=" * 80)
    
    year = 2026
    month = 5
    
    # Calculate date range
    start_date = datetime(year, month, 1).date()
    if month == 12:
        end_date = datetime(year + 1, 1, 1).date() - timedelta(days=1)
    else:
        end_date = datetime(year, month + 1, 1).date() - timedelta(days=1)
    
    print(f"\nMonth: {year}-{month:02d}")
    print(f"Date Range: {start_date} to {end_date}")
    
    # Get weekly plans
    print("\n" + "-" * 80)
    print("WEEKLY PLANS IN MAY 2026")
    print("-" * 80)
    
    weekly_plans = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.year == year,
        WeeklyProductionPlan.status.in_(['approved', 'in_progress', 'completed']),
        db.and_(
            WeeklyProductionPlan.week_start <= end_date,
            WeeklyProductionPlan.week_end >= start_date
        )
    ).all()
    
    print(f"Found {len(weekly_plans)} weekly plan(s)")
    
    weekly_targets_by_product = {}
    
    for plan in weekly_plans:
        print(f"\nPlan: {plan.plan_number}")
        print(f"Week: {plan.week_number} ({plan.week_start} to {plan.week_end})")
        print(f"Status: {plan.status}")
        
        items = list(plan.items)
        print(f"Items: {len(items)}")
        
        # Calculate working days
        week_start = plan.week_start
        week_end = plan.week_end
        working_days = 0
        current_day = week_start
        while current_day <= week_end:
            if current_day.weekday() != 6:  # 6 = Sunday
                working_days += 1
            current_day += timedelta(days=1)
        
        total_shifts = working_days * 2
        print(f"Working days: {working_days}, Total shifts: {total_shifts}")
        
        for item in items:
            if not item.product:
                continue
            
            product_name = item.product.name
            pack_per_ctn = int(item.product.pack_per_karton) if item.product.pack_per_karton else 50
            
            planned_qty = float(item.planned_quantity or 0)
            if item.uom == 'pcs' and pack_per_ctn > 0:
                target_ctn = planned_qty / pack_per_ctn
            else:
                target_ctn = planned_qty
            
            print(f"  - Product: '{product_name}'")
            print(f"    Quantity: {planned_qty} {item.uom}")
            print(f"    Pack per Ctn: {pack_per_ctn}")
            print(f"    Target Ctn: {target_ctn}")
            
            if product_name not in weekly_targets_by_product:
                weekly_targets_by_product[product_name] = {
                    'target_ctn_weekly': 0,
                    'working_days': working_days,
                    'total_shifts': total_shifts
                }
            
            weekly_targets_by_product[product_name]['target_ctn_weekly'] += target_ctn
    
    print("\n" + "=" * 80)
    print("AGGREGATED WEEKLY TARGETS")
    print("=" * 80)
    
    for product_name, info in weekly_targets_by_product.items():
        print(f"\n{product_name}:")
        print(f"  Target CTN: {info['target_ctn_weekly']:.2f}")
        print(f"  Working Days: {info['working_days']}")
        print(f"  Total Shifts: {info['total_shifts']}")
