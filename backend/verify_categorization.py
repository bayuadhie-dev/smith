#!/usr/bin/env python3
"""Verify downtime categorization in database"""

from app import create_app
from models import db
from models.production import ShiftProduction
from datetime import date

app = create_app()

with app.app_context():
    print("=" * 80)
    print("VERIFYING DOWNTIME CATEGORIZATION")
    print("=" * 80)
    
    # Find the specific record from screenshot
    # "GLOVECLEAN BODY WASH GLOVE 2S" with "Ganti stiker ( setting mc dan packaging )"
    
    # Search for records with this issue text
    records = ShiftProduction.query.filter(
        ShiftProduction.issues.like('%Ganti stiker%setting mc%packaging%')
    ).all()
    
    print(f"\nFound {len(records)} records with 'Ganti stiker ( setting mc dan packaging )'\n")
    
    for sp in records:
        print(f"ShiftProduction ID: {sp.id}")
        print(f"  Date: {sp.production_date}")
        print(f"  Shift: {sp.shift}")
        print(f"  Product: {sp.product.name if sp.product else 'N/A'}")
        print(f"  Machine: {sp.machine.name if sp.machine else 'N/A'}")
        print(f"  Issues: {sp.issues}")
        print(f"\n  DOWNTIME BREAKDOWN:")
        print(f"    Mesin: {sp.downtime_mesin or 0} minutes")
        print(f"    Operator: {sp.downtime_operator or 0} minutes")
        print(f"    Material: {sp.downtime_material or 0} minutes")
        print(f"    Design: {sp.downtime_design or 0} minutes")
        print(f"    Idle: {sp.idle_time or 0} minutes")
        print(f"    Others: {sp.downtime_others or 0} minutes")
        print()
    
    # Also check the API response for Production Monitoring
    print("=" * 80)
    print("CHECKING API RESPONSE FOR PRODUCTION MONITORING")
    print("=" * 80)
    
    # Get May 2026 data
    year = 2026
    month = 5
    
    # Get downtime_by_category for May 2026
    from datetime import datetime, timedelta
    start_date = datetime(year, month, 1).date()
    if month == 12:
        end_date = datetime(year + 1, 1, 1).date() - timedelta(days=1)
    else:
        end_date = datetime(year, month + 1, 1).date() - timedelta(days=1)
    
    shift_productions = ShiftProduction.query.filter(
        ShiftProduction.production_date >= start_date,
        ShiftProduction.production_date <= end_date
    ).all()
    
    downtime_by_category = {
        'mesin': 0, 'operator': 0, 'material': 0, 'design': 0, 'idle': 0, 'others': 0
    }
    
    for sp in shift_productions:
        downtime_by_category['mesin'] += float(sp.downtime_mesin or 0)
        downtime_by_category['operator'] += float(sp.downtime_operator or 0)
        downtime_by_category['material'] += float(sp.downtime_material or 0)
        downtime_by_category['design'] += float(sp.downtime_design or 0)
        downtime_by_category['idle'] += float(sp.idle_time or 0)
        downtime_by_category['others'] += float(sp.downtime_others or 0)
    
    print(f"\nDowntime by Category for May 2026:")
    for cat, minutes in downtime_by_category.items():
        print(f"  {cat.capitalize()}: {minutes} minutes")
    
    print("\n" + "=" * 80)
