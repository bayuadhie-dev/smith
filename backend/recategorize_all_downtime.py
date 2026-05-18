#!/usr/bin/env python3
"""
Recategorize ALL downtime entries based on updated keywords
- guset, relay, inkjet, dosing, simetris error → mesin
- menyiapkan produk → idle
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db
from models.production import ShiftProduction
from utils.helpers import detect_downtime_category
import re

# Create Flask app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
instance_path = os.path.join(basedir, 'instance')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(instance_path, "erp_database.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

def parse_and_recategorize_issues(issues_str):
    """
    Parse issues string and recategorize each entry
    Format: "60 menit - Tunggu kain [material]; 30 menit - Inkjet error [others]"
    Returns: Updated issues string with corrected categories
    """
    if not issues_str:
        return issues_str
    
    entries = issues_str.split(';')
    updated_entries = []
    
    for entry in entries:
        entry = entry.strip()
        if not entry:
            continue
        
        # Parse: "60 menit - Description [category]"
        match = re.match(r'(\d+)\s*menit\s*-\s*(.+?)\s*\[(\w+)\]', entry)
        if match:
            duration = match.group(1)
            description = match.group(2).strip()
            old_category = match.group(3)
            
            # Detect new category
            new_category = detect_downtime_category(description, is_first_entry=False)
            
            # Rebuild entry with new category
            updated_entries.append(f"{duration} menit - {description} [{new_category}]")
        else:
            # Keep as is if format doesn't match
            updated_entries.append(entry)
    
    return '; '.join(updated_entries)

def recalculate_downtime_breakdown(issues_str):
    """
    Recalculate downtime breakdown from issues string
    Returns: dict with downtime_mesin, downtime_operator, downtime_material, downtime_design, downtime_others, idle_time
    """
    breakdown = {
        'downtime_mesin': 0,
        'downtime_operator': 0,
        'downtime_material': 0,
        'downtime_design': 0,
        'downtime_others': 0,
        'idle_time': 0
    }
    
    if not issues_str:
        return breakdown
    
    entries = issues_str.split(';')
    for entry in entries:
        entry = entry.strip()
        if not entry:
            continue
        
        # Parse: "60 menit - Description [category]"
        match = re.match(r'(\d+)\s*menit\s*-\s*(.+?)\s*\[(\w+)\]', entry)
        if match:
            duration = int(match.group(1))
            category = match.group(3)
            
            if category == 'mesin':
                breakdown['downtime_mesin'] += duration
            elif category == 'operator':
                breakdown['downtime_operator'] += duration
            elif category == 'material':
                breakdown['downtime_material'] += duration
            elif category == 'design':
                breakdown['downtime_design'] += duration
            elif category == 'idle':
                breakdown['idle_time'] += duration
            else:
                breakdown['downtime_others'] += duration
    
    return breakdown

with app.app_context():
    print("=" * 80)
    print("RECATEGORIZING ALL DOWNTIME ENTRIES")
    print("=" * 80)
    
    # Get all shift productions with issues
    shifts = ShiftProduction.query.filter(
        ShiftProduction.issues.isnot(None),
        ShiftProduction.issues != ''
    ).all()
    
    print(f"\nFound {len(shifts)} shift production records with downtime\n")
    
    updated_count = 0
    
    for sp in shifts:
        old_issues = sp.issues
        
        # Recategorize
        new_issues = parse_and_recategorize_issues(old_issues)
        
        if old_issues != new_issues:
            # Recalculate breakdown
            breakdown = recalculate_downtime_breakdown(new_issues)
            
            # Update record
            sp.issues = new_issues
            sp.downtime_mesin = breakdown['downtime_mesin']
            sp.downtime_operator = breakdown['downtime_operator']
            sp.downtime_material = breakdown['downtime_material']
            sp.downtime_design = breakdown['downtime_design']
            sp.downtime_others = breakdown['downtime_others']
            sp.idle_time = breakdown['idle_time']
            
            # Recalculate total downtime
            sp.downtime_minutes = (
                breakdown['downtime_mesin'] +
                breakdown['downtime_operator'] +
                breakdown['downtime_material'] +
                breakdown['downtime_design'] +
                breakdown['downtime_others']
            )
            
            updated_count += 1
            
            if updated_count <= 5:  # Show first 5 examples
                print(f"{'='*80}")
                print(f"ID: {sp.id} | Date: {sp.production_date} | Product: {sp.product.name if sp.product else 'Unknown'}")
                print(f"BEFORE: {old_issues}")
                print(f"AFTER:  {new_issues}")
                print()
    
    if updated_count > 0:
        try:
            db.session.commit()
            print(f"\n✅ Updated {updated_count} records")
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Error: {e}")
    else:
        print("\n✅ No records need updating")
    
    print("=" * 80)
