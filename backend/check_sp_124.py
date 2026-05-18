#!/usr/bin/env python3
"""Check specific ShiftProduction ID 124"""

from app import create_app
from models import db
from models.production import ShiftProduction
from utils.helpers import detect_downtime_category
import re

app = create_app()

with app.app_context():
    sp = ShiftProduction.query.get(124)
    
    if not sp:
        print("ShiftProduction ID 124 not found!")
        exit(1)
    
    print("=" * 80)
    print(f"ShiftProduction ID: {sp.id}")
    print(f"Date: {sp.production_date}, Shift: {sp.shift}")
    print(f"Product: {sp.product.name if sp.product else 'N/A'}")
    print("=" * 80)
    
    print(f"\nIssues: {sp.issues}\n")
    
    # Parse and re-categorize each issue
    issue_parts = sp.issues.split(';')
    
    print("PARSING EACH ISSUE:")
    print("-" * 80)
    
    for idx, part in enumerate(issue_parts):
        part = part.strip()
        if not part:
            continue
        
        match = re.match(r'(\d+)\s*menit\s*-\s*(.+?)(?:\s*\[([^\]]+)\])?\s*$', part, re.IGNORECASE)
        if match:
            duration = int(match.group(1))
            reason = match.group(2).strip()
            explicit_cat = match.group(3).strip() if match.group(3) else None
            
            # Remove category tag from reason
            reason_clean = re.sub(r'\s*\[.+\]\s*$', '', reason).strip()
            
            # Detect category
            is_first = (idx == 0)
            detected_cat = detect_downtime_category(reason_clean, is_first)
            
            print(f"\n{idx+1}. {duration} menit - {reason_clean}")
            print(f"   Explicit tag: [{explicit_cat}]" if explicit_cat else "   No explicit tag")
            print(f"   Detected category: {detected_cat}")
            print(f"   Is first entry: {is_first}")
    
    print("\n" + "=" * 80)
    print("CURRENT DATABASE VALUES:")
    print(f"  Mesin: {sp.downtime_mesin or 0}")
    print(f"  Operator: {sp.downtime_operator or 0}")
    print(f"  Material: {sp.downtime_material or 0}")
    print(f"  Design: {sp.downtime_design or 0}")
    print(f"  Idle: {sp.idle_time or 0}")
    print(f"  Others: {sp.downtime_others or 0}")
    print("=" * 80)
