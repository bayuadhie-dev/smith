#!/usr/bin/env python3
"""
Calculate and update planned_days and planned_shifts for existing weekly plan items
Based on the shift schedule (kotak-kotak biru di UI)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from models.production import WeeklyProductionPlan, WeeklyProductionPlanItem, ShiftProduction
from datetime import timedelta

# Create Flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    print("=" * 80)
    print("CALCULATING PLANNED SCHEDULE FROM SHIFT PRODUCTION DATA")
    print("=" * 80)
    
    # Get all weekly plans
    plans = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.status.in_(['approved', 'in_progress', 'completed'])
    ).all()
    
    print(f"\nFound {len(plans)} weekly plan(s)")
    
    for plan in plans:
        print(f"\n{'='*80}")
        print(f"Plan: {plan.plan_number}")
        print(f"Week: {plan.week_start} to {plan.week_end}")
        print(f"{'='*80}")
        
        items = list(plan.items)
        
        for item in items:
            if not item.product:
                continue
            
            product_name = item.product.name
            
            # Count actual shift productions for this product in this week
            shifts = ShiftProduction.query.filter(
                ShiftProduction.product_id == item.product_id,
                ShiftProduction.production_date >= plan.week_start,
                ShiftProduction.production_date <= plan.week_end
            ).all()
            
            if shifts:
                # Count unique days and total shifts
                unique_dates = set()
                total_shifts = 0
                
                for shift in shifts:
                    unique_dates.add(shift.production_date)
                    total_shifts += 1
                
                planned_days = len(unique_dates)
                planned_shifts = total_shifts
                
                # Update item
                item.planned_days = planned_days
                item.planned_shifts = planned_shifts
                
                print(f"\n✅ {product_name}")
                print(f"   Planned Days: {planned_days}")
                print(f"   Planned Shifts: {planned_shifts}")
            else:
                # No shift production yet, use default (5 days, 10 shifts)
                # Calculate working days in the week
                working_days = 0
                current_day = plan.week_start
                while current_day <= plan.week_end:
                    if current_day.weekday() not in [5, 6]:  # Not Sat/Sun
                        working_days += 1
                    current_day += timedelta(days=1)
                
                item.planned_days = working_days
                item.planned_shifts = working_days * 2  # Assume 2 shifts per day
                
                print(f"\n⚠️  {product_name} (no shift data, using default)")
                print(f"   Planned Days: {working_days}")
                print(f"   Planned Shifts: {working_days * 2}")
        
        try:
            db.session.commit()
            print(f"\n✅ Updated {len(items)} items for {plan.plan_number}")
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Error updating {plan.plan_number}: {e}")
    
    print("\n" + "=" * 80)
    print("✅ CALCULATION COMPLETED")
    print("=" * 80)
