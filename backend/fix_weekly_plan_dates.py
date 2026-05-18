#!/usr/bin/env python3
"""
Fix Weekly Plan dates to align with dashboard week boundaries
Dashboard uses: Week 1 = Day 1-7, Week 2 = Day 8-14, etc.
"""
from app import create_app, db
from models.production import WeeklyProductionPlan
from datetime import datetime, timedelta

app = create_app()

with app.app_context():
    print("=" * 80)
    print("FIX WEEKLY PLAN DATES - ALIGN WITH DASHBOARD")
    print("=" * 80)
    
    # Get the existing plan for May 2026
    plan = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.year == 2026,
        WeeklyProductionPlan.week_start >= datetime(2026, 5, 1).date(),
        WeeklyProductionPlan.week_start <= datetime(2026, 5, 31).date()
    ).first()
    
    if not plan:
        print("\n❌ No plan found for May 2026")
        exit(1)
    
    print(f"\n📋 Current Plan:")
    print(f"  ID: {plan.id}")
    print(f"  Plan Number: {plan.plan_number}")
    print(f"  Week Number (year): {plan.week_number}")
    print(f"  Current Week Start: {plan.week_start}")
    print(f"  Current Week End: {plan.week_end}")
    print(f"  Status: {plan.status}")
    print(f"  Notes: {plan.notes}")
    
    # Calculate correct Week 1 boundaries for May 2026
    # Week 1 = May 1-7
    correct_week_start = datetime(2026, 5, 1).date()
    correct_week_end = datetime(2026, 5, 7).date()
    
    print(f"\n✏️  Correct Week 1 boundaries:")
    print(f"  Should be: {correct_week_start} to {correct_week_end}")
    
    # Ask for confirmation
    print(f"\n⚠️  This will update:")
    print(f"  - week_start: {plan.week_start} → {correct_week_start}")
    print(f"  - week_end: {plan.week_end} → {correct_week_end}")
    print(f"  - notes: Update to reflect correct dates")
    
    response = input("\nProceed with update? (yes/no): ")
    
    if response.lower() != 'yes':
        print("\n❌ Update cancelled")
        exit(0)
    
    # Update the plan
    plan.week_start = correct_week_start
    plan.week_end = correct_week_end
    plan.notes = "Week 1 May 2026 (May 1-7) - Updated to align with dashboard"
    
    try:
        db.session.commit()
        print("\n✅ Plan updated successfully!")
        print(f"\nUpdated Plan:")
        print(f"  Week Start: {plan.week_start}")
        print(f"  Week End: {plan.week_end}")
        print(f"  Notes: {plan.notes}")
    except Exception as e:
        db.session.rollback()
        print(f"\n❌ Error updating plan: {e}")
    
    print("\n" + "=" * 80)
    print("VERIFICATION")
    print("=" * 80)
    
    # Verify Week 2 query now
    week_2_start = datetime(2026, 5, 8).date()
    week_2_end = datetime(2026, 5, 14).date()
    
    plans_week_2 = WeeklyProductionPlan.query.filter(
        WeeklyProductionPlan.year == 2026,
        WeeklyProductionPlan.status.in_(['approved', 'in_progress', 'completed']),
        db.and_(
            WeeklyProductionPlan.week_start <= week_2_end,
            WeeklyProductionPlan.week_end >= week_2_start
        )
    ).all()
    
    print(f"\nWeek 2 query (May 8-14):")
    print(f"  Found {len(plans_week_2)} plan(s)")
    
    if len(plans_week_2) == 0:
        print("  ✅ No overlap - Week 2 will correctly show 'Tidak ada target mingguan'")
    else:
        print("  ⚠️  Still has overlap:")
        for p in plans_week_2:
            print(f"    - Plan {p.id}: {p.week_start} to {p.week_end}")
    
    print("\n" + "=" * 80)
