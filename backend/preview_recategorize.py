#!/usr/bin/env python3
"""
PREVIEW ONLY - Show what will be changed without committing to database
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
    """Parse and recategorize issues string"""
    if not issues_str:
        return issues_str, []
    
    entries = issues_str.split(';')
    updated_entries = []
    changes = []
    
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
            
            if old_category != new_category:
                changes.append({
                    'description': description,
                    'old': old_category,
                    'new': new_category
                })
            
            # Rebuild entry with new category
            updated_entries.append(f"{duration} menit - {description} [{new_category}]")
        else:
            updated_entries.append(entry)
    
    return '; '.join(updated_entries), changes

with app.app_context():
    print("=" * 80)
    print("PREVIEW: DOWNTIME RECATEGORIZATION")
    print("=" * 80)
    print("\n⚠️  THIS IS PREVIEW ONLY - NO CHANGES WILL BE SAVED\n")
    
    # Get all shift productions with issues
    shifts = ShiftProduction.query.filter(
        ShiftProduction.issues.isnot(None),
        ShiftProduction.issues != ''
    ).all()
    
    print(f"Found {len(shifts)} shift production records with downtime\n")
    
    will_change_count = 0
    all_changes = []
    
    for sp in shifts:
        old_issues = sp.issues
        new_issues, changes = parse_and_recategorize_issues(old_issues)
        
        if changes:
            will_change_count += 1
            all_changes.append({
                'id': sp.id,
                'date': sp.production_date,
                'product': sp.product.name if sp.product else 'Unknown',
                'machine': sp.machine.name if sp.machine else 'Unknown',
                'changes': changes
            })
    
    print(f"{'='*80}")
    print(f"SUMMARY: {will_change_count} records will be updated")
    print(f"{'='*80}\n")
    
    # Show first 20 changes
    for i, item in enumerate(all_changes[:20]):
        print(f"{i+1}. ID: {item['id']} | {item['date']} | {item['machine']} | {item['product']}")
        for change in item['changes']:
            print(f"   '{change['description']}'")
            print(f"   {change['old']} → {change['new']}")
        print()
    
    if len(all_changes) > 20:
        print(f"... and {len(all_changes) - 20} more records\n")
    
    print("=" * 80)
    print("CATEGORY CHANGE STATISTICS")
    print("=" * 80)
    
    # Count category changes
    category_changes = {}
    for item in all_changes:
        for change in item['changes']:
            key = f"{change['old']} → {change['new']}"
            if key not in category_changes:
                category_changes[key] = 0
            category_changes[key] += 1
    
    for key, count in sorted(category_changes.items(), key=lambda x: x[1], reverse=True):
        print(f"{key}: {count} entries")
    
    print("\n" + "=" * 80)
    print("⚠️  REVIEW THE CHANGES ABOVE")
    print("If everything looks correct, run: python recategorize_all_downtime.py")
    print("=" * 80)
