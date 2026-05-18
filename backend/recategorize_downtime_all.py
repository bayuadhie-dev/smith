#!/usr/bin/env python3
"""
Recategorize ALL downtime entries in database based on updated keywords.
This script:
- Reads all ShiftProduction records with issues
- Re-parses issues and re-detects categories using updated detect_downtime_category()
- Updates downtime_mesin, downtime_operator, downtime_material, downtime_design, downtime_others, idle_time
- Does NOT change the issues text or duration values
"""

from app import create_app
from models import db
from models.production import ShiftProduction
from utils.helpers import detect_downtime_category
import re

app = create_app()

def recategorize_shift_production(sp):
    """Recategorize downtime for a single ShiftProduction record"""
    if not sp.issues:
        return None
    
    # Initialize all downtime categories to 0
    new_dt_mesin = 0
    new_dt_operator = 0
    new_dt_material = 0
    new_dt_design = 0
    new_dt_others = 0
    new_idle = 0
    
    # Parse issues
    issue_parts = sp.issues.split(';')
    
    for idx, part in enumerate(issue_parts):
        part = part.strip()
        if not part:
            continue
        
        # Match pattern: "XX menit - reason [category]"
        match = re.match(r'(\d+)\s*menit\s*-\s*(.+?)(?:\s*\[([^\]]+)\])?\s*$', part, re.IGNORECASE)
        if not match:
            continue
        
        duration = int(match.group(1))
        reason = match.group(2).strip()
        # Ignore explicit category tag, we'll re-detect
        
        # Remove any existing category tag from reason
        reason = re.sub(r'\s*\[.+\]\s*$', '', reason).strip()
        
        # Re-detect category using updated function
        is_first = (idx == 0)
        category = detect_downtime_category(reason, is_first)
        
        # Skip istirahat (break time)
        if category == 'istirahat':
            continue
        
        # Accumulate to appropriate category
        if category == 'mesin':
            new_dt_mesin += duration
        elif category == 'operator':
            new_dt_operator += duration
        elif category == 'material':
            new_dt_material += duration
        elif category == 'design':
            new_dt_design += duration
        elif category == 'idle':
            new_idle += duration
        else:
            new_dt_others += duration
    
    return {
        'downtime_mesin': new_dt_mesin,
        'downtime_operator': new_dt_operator,
        'downtime_material': new_dt_material,
        'downtime_design': new_dt_design,
        'downtime_others': new_dt_others,
        'idle_time': new_idle
    }

with app.app_context():
    print("=" * 80)
    print("RECATEGORIZING ALL DOWNTIME ENTRIES")
    print("=" * 80)
    
    # Get all ShiftProduction records with issues
    all_sp = ShiftProduction.query.filter(
        ShiftProduction.issues.isnot(None),
        ShiftProduction.issues != ''
    ).all()
    
    print(f"\nFound {len(all_sp)} ShiftProduction records with downtime issues\n")
    
    updated_count = 0
    skipped_count = 0
    
    for sp in all_sp:
        try:
            new_values = recategorize_shift_production(sp)
            
            if new_values is None:
                skipped_count += 1
                continue
            
            # Check if values changed
            old_values = {
                'downtime_mesin': sp.downtime_mesin or 0,
                'downtime_operator': sp.downtime_operator or 0,
                'downtime_material': sp.downtime_material or 0,
                'downtime_design': sp.downtime_design or 0,
                'downtime_others': sp.downtime_others or 0,
                'idle_time': sp.idle_time or 0
            }
            
            if new_values != old_values:
                # Update the record
                sp.downtime_mesin = new_values['downtime_mesin']
                sp.downtime_operator = new_values['downtime_operator']
                sp.downtime_material = new_values['downtime_material']
                sp.downtime_design = new_values['downtime_design']
                sp.downtime_others = new_values['downtime_others']
                sp.idle_time = new_values['idle_time']
                
                updated_count += 1
                
                # Print changes for first 10 records
                if updated_count <= 10:
                    print(f"Updated SP ID {sp.id} ({sp.production_date}, {sp.shift}):")
                    print(f"  Issues: {sp.issues[:100]}...")
                    print(f"  OLD: Mesin={old_values['downtime_mesin']}, Operator={old_values['downtime_operator']}, "
                          f"Material={old_values['downtime_material']}, Design={old_values['downtime_design']}, "
                          f"Idle={old_values['idle_time']}, Others={old_values['downtime_others']}")
                    print(f"  NEW: Mesin={new_values['downtime_mesin']}, Operator={new_values['downtime_operator']}, "
                          f"Material={new_values['downtime_material']}, Design={new_values['downtime_design']}, "
                          f"Idle={new_values['idle_time']}, Others={new_values['downtime_others']}")
                    print()
            else:
                skipped_count += 1
        
        except Exception as e:
            print(f"❌ Error processing SP ID {sp.id}: {e}")
            continue
    
    # Commit all changes
    if updated_count > 0:
        print(f"\n{'=' * 80}")
        print(f"Committing {updated_count} changes to database...")
        db.session.commit()
        print(f"✅ Successfully recategorized {updated_count} records")
    else:
        print(f"\n✅ No changes needed - all records already correctly categorized")
    
    print(f"⏭️  Skipped {skipped_count} records (no changes)")
    print("=" * 80)
