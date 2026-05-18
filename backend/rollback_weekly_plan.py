#!/usr/bin/env python3
"""
ROLLBACK: Restore Weekly Plan to correct dates
Week 1 should be May 4-10 (Monday-Sunday including weekend)
"""
from app import create_app, db
from models.production import WeeklyProductionPlan
from datetime import datetime

app = create_app()

with app.app_context():
    print("=" * 80)
    print("ROLLBACK WEEKLY PLAN - RESTORE CORRECT DATES")
    print("=" * 80)
    
    # Get the plan
    plan = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.year == 2026,
        WeeklyProductionPlan.week_start >= datetime(2026, 5, 1).date(),
        WeeklyProductionPlan.week_start <= datetime(2026, 5, 31).date()
    ).first()
    
    if not plan:
        print("\n❌ No plan found")
        exit(1)
    
    print(f"\n📋 Current (WRONG) Plan:")
    print(f"  Week Start: {plan.week_start}")
    print(f"  Week End: {plan.week_end}")
    print(f"  Notes: {plan.notes}")
    
    # Correct dates: May 4 (Monday) to May 10 (Sunday)
    correct_week_start = datetime(2026, 5, 4).date()
    correct_week_end = datetime(2026, 5, 10).date()
    
    print(f"\n✏️  Restoring to CORRECT dates:")
    print(f"  Week Start: {correct_week_start} (Monday)")
    print(f"  Week End: {correct_week_end} (Sunday)")
    print(f"  Working Days: May 4-8 (Mon-Fri)")
    
    # Update
    plan.week_start = correct_week_start
    plan.week_end = correct_week_end
    plan.notes = "Week 1 May 2026 (May 4-10) - Working days: Mon 4 - Fri 8"
    
    try:
        db.session.commit()
        print("\n✅ Plan restored successfully!")
        print(f"\nRestored Plan:")
        print(f"  Week Start: {plan.week_start}")
        print(f"  Week End: {plan.week_end}")
        print(f"  Notes: {plan.notes}")
    except Exception as e:
        db.session.rollback()
        print(f"\n❌ Error: {e}")
    
    print("\n" + "=" * 80)
