#!/usr/bin/env python3
"""Check which dates in May 2026 have production data"""

from app import app
from models import db
from models.production import ShiftProduction
from datetime import date, timedelta
from sqlalchemy import func

with app.app_context():
    print("=" * 80)
    print("CHECKING AVAILABLE DATES IN MAY 2026")
    print("=" * 80)
    
    # Check May 1-31, 2026
    start_date = date(2026, 5, 1)
    end_date = date(2026, 5, 31)
    
    current = start_date
    dates_with_data = []
    
    while current <= end_date:
        count = ShiftProduction.query.filter(
            ShiftProduction.production_date == current
        ).count()
        
        if count > 0:
            day_name = current.strftime('%A')
            print(f"✓ {current.isoformat()} ({day_name}): {count} shift records")
            dates_with_data.append(current.isoformat())
        
        current += timedelta(days=1)
    
    print("\n" + "=" * 80)
    print(f"SUMMARY: {len(dates_with_data)} dates with data in May 2026")
    print("=" * 80)
    
    if dates_with_data:
        print("\nDates with data:")
        for d in dates_with_data:
            print(f"  - {d}")
    else:
        print("\n⚠️  NO DATA FOUND IN MAY 2026!")
