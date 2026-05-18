#!/usr/bin/env python3
"""
Calculate planned_days and planned_shifts from ScheduleGridItem.schedule_days
This is the PLANNED schedule (kotak-kotak biru s1 s2 s3 di UI)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from models.production import WeeklyProductionPlan, WeeklyProductionPlanItem
from routes.schedule_grid import ScheduleGridItem
import json

# Create Flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    print("=" * 80)
    print("CALCULATING PLANNED SCHEDULE FROM SCHEDULE GRID (UI KOTAK-KOTAK)")
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
            
            # Find schedule grid items for this product in this week
            schedule_items = ScheduleGridItem.query.filter(
                ScheduleGridItem.product_id == item.product_id,
                ScheduleGridItem.week_start == plan.week_start
            ).all()
            
            if schedule_items:
                # Aggregate all schedule_days from all machines for this product
                all_dates = set()
                total_shifts = 0
                
                for sched in schedule_items:
                    if sched.schedule_days:
                        try:
                            schedule_data = json.loads(sched.schedule_days)
                            # schedule_data format: {"2026-05-04": [1, 2], "2026-05-05": [1, 2, 3]}
                            for date_str, shifts in schedule_data.items():
                                all_dates.add(date_str)
                                total_shifts += len(shifts)  # Count number of shifts
                        except:
                            pass
                
                if all_dates:
                    planned_days = len(all_dates)
                    planned_shifts = total_shifts
                    
                    # Update item
                    item.planned_days = planned_days
                    item.planned_shifts = planned_shifts
                    
                    print(f"\n✅ {product_name}")
                    print(f"   Planned Days: {planned_days}")
                    print(f"   Planned Shifts: {planned_shifts}")
                    print(f"   Dates: {sorted(all_dates)}")
                else:
                    print(f"\n⚠️  {product_name} - schedule_days is empty")
            else:
                print(f"\n⚠️  {product_name} - no schedule grid item found")
        
        try:
            db.session.commit()
            print(f"\n✅ Updated {len(items)} items for {plan.plan_number}")
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Error updating {plan.plan_number}: {e}")
    
    print("\n" + "=" * 80)
    print("✅ CALCULATION COMPLETED")
    print("=" * 80)
